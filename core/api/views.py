import pandas as pd
import numpy as np

from itertools import groupby
from operator import attrgetter

from django.db.models import Min, Max

from django.http import JsonResponse

from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from core.api.pagination import CustomPageNumberPagination
from core.api.serializers import MPAZonesSerializer, MPAZonesWithoutGeometrySerializer, SpeciesSerializer
from core import models


def get_timeseries_dataframe(mpa_zone: models.MPAZones, ts_model=1, ts_type=1, depth=None, start_date=None, end_date=None, indicator=1):
    mpa_timeseries = mpa_zone.timeseries.filter(
        model__pk=ts_model,
        type=ts_type,
        depth=depth,
        indicator=indicator
    ).order_by('date_time')

    observations = mpa_zone.observations.filter(
        depth=depth,
        indicator=indicator
    ).order_by('date_time')

    if start_date:
        mpa_timeseries = mpa_timeseries.filter(date_time__gte=start_date)
        observations = observations.filter(date_time__gte=start_date)

    if end_date:
        mpa_timeseries = mpa_timeseries.filter(date_time__lte=end_date)
        observations = observations.filter(date_time__lte=end_date)

    if not mpa_timeseries.exists():
        return None

    df = pd.DataFrame(list(mpa_timeseries.values('date_time', 'value')))
    df['date_time'] = pd.to_datetime(df['date_time'])
    df.set_index('date_time', inplace=True)

    if observations.exists():
        # Create observations dataframe with additional fields
        obs_df = pd.DataFrame(list(observations.values('date_time', 'value', 'count', 'std')))
        obs_df['date_time'] = pd.to_datetime(obs_df['date_time'])
        obs_df = obs_df.rename(columns={'value': 'observation'})
        obs_df.set_index('date_time', inplace=True)

        # Merge dataframes
        df = df.join(obs_df, how='left')

    return df


def get_base_timeseries(mpa_zone, ts_model=1, ts_type=1, depth=None, indicator=1):

    data_dict = {}

    # Get dataframe for processing
    df = get_timeseries_dataframe(
        mpa_zone,
        ts_model,
        ts_type,
        depth,
        indicator=indicator
    )
    if df is None:
        raise ValueError(f"No data found for zone {mpa_zone}")

    # our climatology data is based off the first 30 years of data we have, basically start of 1993 to end of 2022
    timeseries_30_year = df[(df.index <= '2022-12-31')]
    data_dict['data'] = timeseries_30_year.groupby([timeseries_30_year.index.month, timeseries_30_year.index.day])

    data_dict['std'] = data_dict['data'].std()
    data_dict['climatology'] = data_dict['data'].quantile()

    # Calculate min/max deltas
    max_val = df[(df.value == df.max().value)]
    min_val = df[(df.value == df.min().value)]

    # min and max possible difference across the entire timeseries
    data_dict['max_delta'] = df.max().value - data_dict['climatology'].loc[(max_val.index.month[0], max_val.index.day[0])].value
    data_dict['min_delta'] = df.min().value - data_dict['climatology'].loc[(min_val.index.month[0], min_val.index.day[0])].value

    return df, data_dict


def get_timeseries_data(mpa_id, ts_model=1, ts_type=1, depth=None, start_date=None, end_date=None, indicator=1):
    results = {}

    if mpa_id == -1 or not models.MPAZones.objects.filter(pk=mpa_id).exists():
        return results

    mpa_zone = models.MPAZones.objects.get(pk=mpa_id)
    results['name'] = mpa_zone.name_e

    df, data_dict = get_base_timeseries(mpa_zone, ts_model, ts_type, depth, indicator)

    results['max_delta'] = data_dict['max_delta']
    results['min_delta'] = data_dict['min_delta']

    df = df[(df.index >= start_date) & (df.index <= end_date)]

    # Calculate RMSE if observations exist
    if 'observation' in df.columns and df['observation'].notnull().any():
        df['squared_error'] = (df['value'] - df['observation']) ** 2
        rmse = np.sqrt(df['squared_error'].mean())
        results['rmse'] = rmse

    results['data'] = [{
        "type": {
            "id": ts_type,
            "label": dict(models.Timeseries.TIMESERIES_TYPES).get(ts_type),
        },
        "date": f'{date.strftime("%Y-%m-%d")} 00:01',
        "ts_data": str(daily_data['value'].item()),
        "climatology": f'{data_dict['climatology']["value"][date.month, date.day]}',
        "std_dev": f'{data_dict['std']["value"][date.month, date.day]}',
        "observation": ({
            'value': daily_data['observation'],
            'count': daily_data['count'],
            'std_dev': daily_data['std'] } if 'observation' in daily_data and pd.notnull(daily_data['observation']) else None)
    } for date, daily_data in df.iterrows()]

    return results

def get_quantile_data(mpa_id, ts_model=1, ts_type=1, depth=None, start_date=None,
                      end_date=None, indicator=1, quantile_upper=None, quantile_lower=None):
    results = {}

    if mpa_id == -1 or not models.MPAZones.objects.filter(pk=mpa_id).exists():
        return results

    mpa_zone = models.MPAZones.objects.get(pk=mpa_id)
    results['name'] = mpa_zone.name_e

    df, data_dict = get_base_timeseries(mpa_zone, ts_model, ts_type, depth, indicator)

    if df is None:
        return None

    lower = data_dict['data'].quantile(quantile_lower)
    upper = data_dict['data'].quantile(quantile_upper)

    # the min/max delta is used by the progress bar to have an absolute zero and absolute max
    results['max_delta'] = data_dict['max_delta']
    results['min_delta'] = data_dict['min_delta']

    df = df[(df.index >= start_date) & (df.index <= end_date)]
    results['data'] = [{"date": f'{date.strftime("%Y-%m-%d")} 00:01',
                        "lowerq": f'{lower["value"][date.month, date.day]}',
                        "upperq": f'{upper["value"][date.month, date.day]}'}
                       for date, mt in df.iterrows()]
    return results


def get_selected_date_data(mpa_id, selected_date, ts_model=1, ts_type=1, depth=None, lower_quantile=0.1, upper_quantile=0.9, indicator=1):

    results = {}
    if mpa_id == -1 or not models.MPAZones.objects.filter(pk=mpa_id).exists():
        return results

    mpa_zone = models.MPAZones.objects.get(pk=mpa_id)
    results['name'] = mpa_zone.name_e

    df, data_dict = get_base_timeseries(mpa_zone, ts_model, ts_type, depth, indicator)

    # Filter for just the selected date
    selected_date = pd.to_datetime(selected_date)
    date_data = df[df.index.date == selected_date.date()]

    # Calculate climatology and quantiles
    q_upper = float(upper_quantile)
    q_lower = float(lower_quantile)

    upper = data_dict['data'].quantile(q=q_upper)
    lower = data_dict['data'].quantile(q=q_lower)

    # Prepare combined response
    results = {
        'min_delta': data_dict['min_delta'],
        'max_delta': data_dict['max_delta'],
        'name': mpa_zone.name_e,
        'data': {},
        'quantile': {}
    }

    # If we have data for the selected date
    if not date_data.empty:
        row = date_data.iloc[0]
        date_str = selected_date.strftime("%Y-%m-%d")

        # Get the current value and climatology
        results['data'] = {
            'date': f'{date_str} 00:01',
            'ts_data': float(row['value']),
            'climatology': float(data_dict['climatology'].loc[(selected_date.month, selected_date.day), 'value']),
            'std_dev': float(data_dict['std'].loc[(selected_date.month, selected_date.day), 'value'  ])
        }

        results['data']['observations'] = { 'value': None, 'std_dev': None, 'count': None }
        if 'observation' in row and pd.notnull(row['observation']):
            results['data']['observations'] = {
                'value': row['observation'],
                'std_dev': row['count'],
                'count': row['std']
            }

        # Get the quantile values
        results['quantile'] = {
            'date': f'{date_str} 00:01',
            'lowerq': float(lower.loc[(selected_date.month, selected_date.day), 'value']),
            'upperq': float(upper.loc[(selected_date.month, selected_date.day), 'value'])
        }

    return results


class MPAZonesViewSet(viewsets.ModelViewSet):
    queryset = models.MPAZones.objects.all()
    serializer_class = MPAZonesSerializer


class MPAZonesWithTimeseriesViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet that only returns MPAZones that have Timeseries data"""
    serializer_class = MPAZonesSerializer
    pagination_class = CustomPageNumberPagination

    def get_serializer_class(self):
        # Use the serializer without geometry unless 'include_geometry' is requested
        if self.request.query_params.get('geometry') == 'false':
            return MPAZonesWithoutGeometrySerializer

        return MPAZonesSerializer

    def get_queryset(self):
        filter_mpas = None
        if "mpa_id" in self.request.GET:
            filter_mpas = self.request.GET.getlist('mpa_id')

        model = int(self.request.session.get('selected_model', 1))
        ts_type = int(self.request.session.get('type', 1))
        timeseries = models.Timeseries.objects.filter(type=ts_type, model__id=model)
        if filter_mpas:
            timeseries = timeseries.filter(zone__pk__in=filter_mpas)

        timeseries = timeseries.values_list('zone__pk', flat=True).distinct()
        # Filter MPAZones that have at least one related Timeseries entry
        return models.MPAZones.objects.filter(
            pk__in=timeseries
        ).order_by('-km2')


class SpeciesViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet that returns all species with their temperature ranges"""
    queryset = models.Species.objects.all().order_by('name')
    serializer_class = SpeciesSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        return queryset

    def list(self, request, *args, **kwargs):
        # Check for a parameter that explicitly requests all records
        if request.query_params.get('all') == 'true':
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        return super().list(request, *args, **kwargs)


class HeatWaveIndicatorsViewSet(viewsets.ReadOnlyModelViewSet):

    def list(self, request):
        mpa_ids = request.query_params.getlist('mpa_id')
        selected_date = request.query_params.get('date')

        if not mpa_ids or not selected_date:
            return JsonResponse({"error": "Missing required parameters: 'id' and 'date'"}, status=400)

        # Optional parameters with defaults
        ts_model = request.query_params.get('model', 1)
        ts_type = request.query_params.get('type', 1)
        depth = request.query_params.get('depth', None)
        lower_quantile = request.query_params.get('lower_quantile', 0.1)
        upper_quantile = request.query_params.get('upper_quantile', 0.9)
        indicator = request.query_params.get('indicator', 1)

        # Convert string IDs to integers
        if len(mpa_ids) == 1 and ',' in mpa_ids[0]:
            mpa_ids = [int(mpa_id) for mpa_id in mpa_ids[0].split(',')]
        else:
            mpa_ids = [int(mpa_id) for mpa_id in mpa_ids]

        # Build response object with data for each MPA
        result = {}
        for mpa_id in mpa_ids:
            try:
                result[mpa_id] = get_selected_date_data(
                    mpa_id=mpa_id,
                    ts_model=ts_model,
                    ts_type=ts_type,
                    selected_date=selected_date,
                    depth=int(depth) if depth else None,
                    lower_quantile=float(lower_quantile),
                    upper_quantile=float(upper_quantile),
                    indicator=int(indicator)
                )
            except ValueError as e:
                result[mpa_id] = {}
        return Response(result)

    def get_queryset(self):
        return None


class SelectedDateDataView(APIView):
    def get(self, request):
        # Extract query parameters
        mpa_id = request.query_params.get('mpa_id')
        selected_date = request.query_params.get('selected_date')

        # use the session variable for the climate model, unless otherwise specified
        model = int(self.request.session.get('selected_model', 1))
        model = request.query_params.get('model', model)

        depth = request.query_params.get('depth', None)
        lower_quantile = request.query_params.get('lower_quantile', 0.1)
        upper_quantile = request.query_params.get('upper_quantile', 0.9)
        indicator = request.query_params.get('indicator', 1)

        # Validate required parameters
        if not mpa_id or not selected_date:
            raise ValidationError("Missing required parameters: 'mpa_id' and 'selected_date'")

        # Call the function and return the result
        result = get_selected_date_data(
            mpa_id=int(mpa_id),
            selected_date=selected_date,
            ts_model=int(model),
            depth=int(depth) if depth else None,
            lower_quantile=float(lower_quantile),
            upper_quantile=float(upper_quantile),
            indicator=int(indicator)
        )
        return Response(result)


class TimeseriesDataView(APIView):
    def get(self, request):
        # Extract query parameters
        mpa_id = request.query_params.get('mpa_id')

        # use the session variable for the climate model, unless otherwise specified
        model = int(self.request.session.get('selected_model', 1))
        model = request.query_params.get('modell', model)

        ts_type = request.query_params.get('type', 1)
        depth = request.query_params.get('depth', None)
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        indicator = request.query_params.get('indicator', 1)

        # Validate required parameters
        if not mpa_id or not start_date or not end_date:
            raise ValidationError("Missing required parameters: 'mpa_id', 'start_date', and 'end_date'")

        # Call the function and return the result
        result = get_timeseries_data(
            mpa_id=int(mpa_id),
            ts_model=int(model),
            ts_type=int(ts_type),
            depth=int(depth) if depth else None,
            start_date=start_date,
            end_date=end_date,
            indicator=int(indicator)
        )
        return Response(result)


class QuantileDataView(APIView):
    def get(self, request):
        # Extract query parameters
        mpa_id = request.query_params.get('mpa_id')

        # use the session variable for the climate model, unless otherwise specified
        model = int(self.request.session.get('selected_model', 1))
        model = request.query_params.get('modell', model)

        ts_type = request.query_params.get('type', 1)
        depth = request.query_params.get('depth', None)
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        indicator = request.query_params.get('indicator', 1)

        upper_quantile = request.query_params.get('upper_quantile', 0.9)
        lower_quantile = request.query_params.get('lower_quantile', 0.1)

        # Validate required parameters
        if not mpa_id or not start_date or not end_date:
            raise ValidationError("Missing required parameters: 'mpa_id', 'start_date', and 'end_date'")

        # Call the function and return the result
        result = get_quantile_data(
            mpa_id=int(mpa_id),
            ts_model=int(model),
            ts_type=int(ts_type),
            depth=int(depth) if depth else None,
            start_date=start_date,
            end_date=end_date,
            indicator=int(indicator),
            quantile_upper=float(upper_quantile),
            quantile_lower=float(lower_quantile)
        )
        return Response(result)


class NetworkIndicatorsViewSet(viewsets.ReadOnlyModelViewSet):

    def list(self, request):
        results = []

        # accepts:
        #   map_id: list of selected mpas,
        #   climate Model: 1 - GLORYS (default),
        #   year: If none all years will be included, else just the provided year is included
        mpa_ids = request.query_params.getlist('mpa_id')
        ts_model = request.query_params.get('model', 1)

        if not mpa_ids:
            return JsonResponse({"error": "Missing required parameters: 'id' and 'date'"}, status=400)

        # bottom or surface may not matter for Network indicators. Either the indicator exists for a given MPA, Climate Model
        ts_type = request.query_params.get('type', 1)

        # if a year isn't provided then we'll include the indicator with all data.
        year = request.query_params.get('year', None)

        climate_model = models.ClimateModels.objects.get(pk=ts_model)
        for mid in mpa_ids:
            zone = models.MPAZones.objects.get(site_id=mid)
            db_indicators = zone.indicators.filter(model=climate_model)
            if year:
                db_indicators = db_indicators.filter(year=year)

            if db_indicators:
                indicator_types = db_indicators.values_list('type', flat=True).distinct()
                indicator = {
                    "mpa": {
                        "id": zone.site_id,
                        "name": zone.name_e,
                    },
                    "indicators": []
                }
                for indicator_type in indicator_types:
                    indicator_type_meta = models.IndicatorTypes.objects.get(pk=indicator_type)
                    min_max = indicator_type_meta.indicators.exclude(value=np.nan).aggregate(
                        min_value=Min('value'),
                        max_value=Max('value')
                    )
                    min = min_max['min_value']
                    max = min_max['max_value']

                    indicator_meta = {
                        "indicator_id": indicator_type_meta.id,
                        "title": indicator_type_meta.name,
                        "description": indicator_type_meta.description,
                        "unit": indicator_type_meta.unit,
                        "min": min,
                        "max": max,
                        "weight": zone.indicator_weights.get(type=indicator_type_meta).weight,
                        "data": []
                    }
                    tmp_indicators = db_indicators.filter(type=indicator_type)
                    for tmp_indicator in tmp_indicators:
                        value = tmp_indicator.value
                        # Ensure min and max are not equal to avoid division by zero
                        if max != min:
                            percentage = ((value - min) / (max - min)) * 100
                        else:
                            percentage = 0  # Default to 0 if min and max are the same
                        indicator_meta["data"].append({
                            "year": tmp_indicator.year,
                            "value": str(value),
                            "width": str(percentage),
                            "colorbar": "success"
                        })
                    indicator["indicators"].append(indicator_meta)

                results.append(indicator)

        return Response(results)

    def get_queryset(self):
        return None