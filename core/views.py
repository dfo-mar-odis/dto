import json
import os

import folium
import branca.colormap as cm
import logging

import pandas as pd
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render

from django.views.generic import TemplateView
from django.contrib.gis.db.models.functions import Transform

from core import models

logger = logging.getLogger(__name__)

colormap = cm.linear.Paired_07.scale(-2, 35)


def add_attributes(mpa):

    temp = 20
    geo_json = {
        "type": "Feature",
        "style": {
            "color": "#FF5555",
        },
        "id": mpa.pk,
        "properties": {
            'name': mpa.name.name_e,
            'zone': mpa.zone_e,
            'url': mpa.url_e,
            'regulation': mpa.regulation,
            'km2': round(mpa.km2, 0),
            'temperature': temp,
        },
        "geometry": {
            "type": "MultiPolygon",
            "coordinates": mpa.trans.coords,
        }
    }
    # geo_json = json.loads(mpa.trans.geojson)
    # geo_json['properties'] = {
    #     'name': mpa.name_e,
    #     'temperature': 5.0,
    # }

    return json.dumps(geo_json)


def index(request):
    mpas = [add_attributes(mpa) for mpa in
            models.MPAZone.objects.filter(zone_e__icontains='union').annotate(trans=Transform('geom', srid=4326))]
    # mpas = list(models.MPA.objects.all())

    return render(request, 'core/map.html')


def get_quantiles(request):
    timeseries = {'data': []}
    mpa_id = int(request.GET.get('mpa', -1))
    q_upper = float(request.GET.get('upper', 0.9))
    q_lower = float(request.GET.get('lower', 0.1))

    if mpa_id == -1:
        return JsonResponse(timeseries)

    if not models.MPAZone.objects.filter(pk=mpa_id).exists():
        return JsonResponse(timeseries)

    mpa_zone = models.MPAZone.objects.get(pk=mpa_id)
    timeseries['name'] = mpa_zone.name.name_e
    mpa_timeseries = mpa_zone.name.timeseries.all().order_by('date_time')

    if not mpa_timeseries.exists():
        return JsonResponse(timeseries)

    df = pd.DataFrame(list(mpa_timeseries.values('date_time', 'temperature')))
    df['date_time'] = pd.to_datetime(df['date_time'])
    df.set_index('date_time', inplace=True)

    # clim = df.groupby([df.index.month, df.index.day]).mean()
    upper = df.groupby([df.index.month, df.index.day]).quantile(q=q_upper)
    lower = df.groupby([df.index.month, df.index.day]).quantile(q=q_lower)

    timeseries['data'] = [{"date": mt.date_time.strftime("%Y-%m-%d") + " 00:01",
                           "lowerq": f'{lower["temperature"][mt.date_time.month, mt.date_time.day]}',
                           "upperq": f'{upper["temperature"][mt.date_time.month, mt.date_time.day]}'}
                          for mt in mpa_timeseries]

    return JsonResponse(timeseries)


def get_timeseries(request):
    timeseries = {'data': []}
    mpa_id = int(request.GET.get('mpa', -1))

    if mpa_id == -1:
        return JsonResponse(timeseries)

    if not models.MPAZone.objects.filter(pk=mpa_id).exists():
        return JsonResponse(timeseries)

    mpa_zone = models.MPAZone.objects.get(pk=mpa_id)
    timeseries['name'] = mpa_zone.name.name_e
    mpa_timeseries = mpa_zone.name.timeseries.all().order_by('date_time')

    if not mpa_timeseries.exists():
        return JsonResponse(timeseries)

    df = pd.DataFrame(list(mpa_timeseries.values('date_time', 'temperature')))
    df['date_time'] = pd.to_datetime(df['date_time'])
    df.set_index('date_time', inplace=True)

    # clim = df.groupby([df.index.month, df.index.day]).mean()
    quant = df.groupby([df.index.month, df.index.day]).quantile()

    timeseries['data'] = [{"date": mt.date_time.strftime("%Y-%m-%d") + " 00:01",
                           "temp": f'{mt.temperature}',
                           "clim": f'{quant["temperature"][mt.date_time.month, mt.date_time.day]}'}
                          for mt in mpa_timeseries]

    return JsonResponse(timeseries)


def get_range_chart(request):
    chart_id = request.GET.get('chart_name')
    species = models.Species.objects.all().order_by('name')
    html = render(request, 'core/partials/range_chart_row.html', {'id': chart_id, 'species': species})
    return HttpResponse(html)


def get_quantile_chart(request):
    chart_id = request.GET.get('chart_name')
    html = render(request, 'core/partials/quantile_chart_row.html', {'id': chart_id})
    return HttpResponse(html)


def get_species_range(request, species_id):
    upper = 5
    lower = 2
    if models.Species.objects.filter(pk=species_id).exists():
        species = models.Species.objects.get(pk=species_id)
        upper = species.upper_temperature
        lower = species.lower_temperature

    return JsonResponse({'upper': upper, 'lower': lower})


# Create your views here.
class MapView(TemplateView):
    template_name = 'core/map.html'

    def get_context_data(self, **kwargs):
        figure = folium.Figure()

        # Add a Marker
        # for station in models.Station.objects.all():
        #     folium.Marker(
        #         location=station.position,
        #         popup=str(station),
        #     ).add_to(map)

        # Make the map
        map = folium.Map(location=[44.666830, -63.631500], zoom_start=6)
        map.add_to(figure)

        for mpa in models.MPA.objects.annotate(trans=Transform('geom', srid=4326)):
            geo_j = folium.GeoJson(data=mpa.trans.geojson)
            folium.Popup(mpa.name_e).add_to(geo_j)
            geo_j.add_to(map)

        # Render and send to template
        figure.render()
        map.save(r'scripts/data/sample.html')
        return {"map": figure}
