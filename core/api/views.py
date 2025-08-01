import pandas as pd

from rest_framework import viewsets
from rest_framework.response import Response
from core.api.serializers import MPAZonesSerializer, SpeciesSerializer
from core import models

class MPAZonesViewSet(viewsets.ModelViewSet):
    queryset = models.MPAZones.objects.all()
    serializer_class = MPAZonesSerializer


class MPAZonesWithTimeseriesViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet that only returns MPAZones that have Timeseries data"""
    serializer_class = MPAZonesSerializer

    def get_queryset(self):
        mpa_ids = models.Timeseries.objects.values_list('mpa__pk', flat=True).distinct()
        # Filter MPAZones that have at least one related Timeseries entry
        return models.MPAZones.objects.filter(
            pk__in=mpa_ids
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


def get_timeseries_dataframe(mpa_zone: models.MPAZones, depth=None, start_date=None, end_date=None, indicator=1):
    mpa_timeseries = mpa_zone.timeseries.filter(depth=depth, indicator=indicator).order_by('date_time')

    if start_date:
        mpa_timeseries = mpa_timeseries.filter(date_time__gte=start_date)

    if end_date:
        mpa_timeseries = mpa_timeseries.filter(date_time__lte=end_date)

    if not mpa_timeseries.exists():
        return None

    df = pd.DataFrame(list(mpa_timeseries.values('date_time', 'value')))
    df['date_time'] = pd.to_datetime(df['date_time'])
    df.set_index('date_time', inplace=True)

    return df


def get_combined_data(mpa_id, selected_date, depth=None, lower_quantile=0.1, upper_quantile=0.9, indicator=1):

    if mpa_id == -1 or not models.MPAZones.objects.filter(pk=mpa_id).exists():
        return {}

    mpa_zone = models.MPAZones.objects.get(pk=mpa_id)

    # Get dataframe for processing
    df = get_timeseries_dataframe(mpa_zone, depth, indicator=indicator)
    if df is None:
        {}

    # Calculate climatology and quantiles
    q_upper = float(upper_quantile)
    q_lower = float(lower_quantile)

    clim = df[(df.index <= '2022-12-31')]
    climatology = clim.groupby([clim.index.month, clim.index.day]).quantile()
    upper = clim.groupby([clim.index.month, clim.index.day]).quantile(q=q_upper)
    lower = clim.groupby([clim.index.month, clim.index.day]).quantile(q=q_lower)

    # Calculate min/max deltas
    max_val = df[(df.value == df.max().value)]
    min_val = df[(df.value == df.min().value)]

    max_delta = df.max().value - climatology.loc[(max_val.index.month[0], max_val.index.day[0])].value
    min_delta = df.min().value - climatology.loc[(min_val.index.month[0], min_val.index.day[0])].value

    # Filter for just the selected date
    selected_date = pd.to_datetime(selected_date)
    date_data = df[df.index.date == selected_date.date()]

    # Prepare combined response
    result = {
        'min_delta': min_delta,
        'max_delta': max_delta,
        'name': mpa_zone.name_e,
        'data': {},
        'quantile': {}
    }

    # If we have data for the selected date
    if not date_data.empty:
        row = date_data.iloc[0]
        date_str = selected_date.strftime("%Y-%m-%d")

        # Get the current value and climatology
        result['data'] = {
            'date': f'{date_str} 00:01',
            'ts_data': float(row['value']),
            'clim': float(climatology.loc[(selected_date.month, selected_date.day), 'value']),
            'std_dev': float(climatology.std().iloc[0])
        }

        # Get the quantile values
        result['quantile'] = {
            'date': f'{date_str} 00:01',
            'lowerq': float(lower.loc[(selected_date.month, selected_date.day), 'value']),
            'upperq': float(upper.loc[(selected_date.month, selected_date.day), 'value'])
        }

    return result

class NetworkIndicatorsViewSet(viewsets.ReadOnlyModelViewSet):

    def list(self, request):
        mpa_ids = request.query_params.getlist('id')
        selected_date = request.query_params.get('date')

        if not mpa_ids or not selected_date:
            return JsonResponse({"error": "Missing required parameters: 'id' and 'date'"}, status=400)

        # Optional parameters with defaults
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
            result[mpa_id] = get_combined_data(
                mpa_id=mpa_id,
                selected_date=selected_date,
                depth=int(depth) if depth else None,
                lower_quantile=float(lower_quantile),
                upper_quantile=float(upper_quantile),
                indicator=int(indicator)
            )

        return Response(result)

    def get_queryset(self):
        return None