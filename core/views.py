import calendar
import io
import os
import json
import pandas as pd
import folium
import branca.colormap as cm
import logging

import matplotlib.pyplot as plt
import datetime
import numpy as np

from PIL import Image

from reportlab.pdfgen import canvas
from reportlab.graphics import renderPDF
from reportlab.lib.utils import ImageReader
from reportlab.lib.units import inch
from reportlab.lib.pagesizes import letter

from django.conf import settings
from django.http import JsonResponse, HttpResponse, FileResponse
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
    context = {
        'mpas': mpas,
        'proxy_url': settings.PROXY_URL,
    }

    return render(request, 'core/map.html', context)


def get_mpa_zone_info():
    mpa_name_label = "MPA Name:"
    mpa_name_text = "St. Anns Bank Marine Protected Area"

    mpa_zone_label = "MPA Zone:"
    mpa_zone_text = "Union: Zone 2, Zone 3, Zone 4, Zone 1, Union: Zone 2, Zone 3, Zone 4, Zone 1"

    mpa_url_label = "MPA URL:"
    mpa_url_text = "https://www.dfo-mpo.gc.ca/oceans/mpa-zpm/stanns-sainteanne/index-eng.html"

    mpa_regulation_label = "MPA Regulation:"
    mpa_regulation_text = "http://laws-lois.justice.gc.ca/eng/regulations/SOR-2017-106/index.html"

    mpa_area_label = "km^2"
    mpa_area_text = "4364"

    zone_info = [
        (mpa_name_label, mpa_name_text),
        (mpa_zone_label, mpa_zone_text),
        (mpa_url_label, mpa_url_text),
        (mpa_regulation_label, mpa_regulation_text),
        (mpa_area_label, mpa_area_text),
    ]

    return zone_info


def add_plot(title, mpa_id, start_date='2020-01-01', end_date='2023-01-01'):
    q_upper = 0.9
    q_lower = 0.1
    mpa_zone = models.MPAZone.objects.get(pk=mpa_id)
    mpa_timeseries = mpa_zone.name.timeseries.all().order_by('date_time')

    df = pd.DataFrame(list(mpa_timeseries.values('date_time', 'temperature', 'climatology')))
    df['date_time'] = pd.to_datetime(df['date_time'])
    df = df.set_index('date_time')

    upper = df.groupby([df.index.month, df.index.day]).quantile(q=q_upper)['temperature']
    lower = df.groupby([df.index.month, df.index.day]).quantile(q=q_lower)['temperature']

    df['upper'] = df.index.map(lambda x: upper[(x.month, x.day)])
    df['lower'] = df.index.map(lambda x: lower[(x.month, x.day)])

    if start_date:
        df = df[start_date:]

    if end_date:
        df = df[:end_date]

    # Row: Add chart
    figure, ax = plt.subplots(figsize=(10, 3))
    plt.subplots_adjust(left=0.1, right=0.95, top=0.8, bottom=0.2)

    plt.title(title)
    plt.ylabel("Temperature (C)")
    plt.xticks(rotation=30)

    ax.set_xlim([df.index.min(), df.index.max()])
    # ax.plot(df.index, df['temperature'], df.index, df['climatology'])

    ax.fill_between(
        df.index, df['temperature'], df['climatology'], where=(df['temperature'] > df['climatology']),
        interpolate=True, color="red", alpha=0.25
    )

    ax.fill_between(
        df.index, df['temperature'], df['climatology'], where=(df['temperature'] <= df['climatology']),
        interpolate=True, color="blue", alpha=0.25
    )

    ax.fill_between(
        df.index, df['upper'], df['lower'], where=(df['lower'] <= df['upper']),
        interpolate=True, color="grey", alpha=0.5
    )

    ax.fill_between(
        df.index, df['temperature'], df['upper'], where=(df['temperature'] > df['upper']),
        interpolate=True, color="red", alpha=1.0
    )

    ax.fill_between(
        df.index, df['temperature'], df['lower'], where=(df['temperature'] < df['lower']),
        interpolate=True, color="blue", alpha=1.0
    )

    imgdata = io.BytesIO()
    figure.savefig(imgdata, format='png')
    imgdata.seek(0)

    return ImageReader(imgdata)


def generate_pdf(request):
    buffer = io.BytesIO()

    margin = inch*0.5
    row_offset = letter[1] - margin

    page_top = letter[1]-margin
    page_bottom = margin
    page_right = letter[0]-margin
    page_left = margin

    # align map from the bottom right of the page
    thumbnail_map_size = 200, 200
    thumbnail_map_position = (page_top-thumbnail_map_size[0]), page_right-thumbnail_map_size[1]

    p = canvas.Canvas(buffer, pagesize=letter)

    # Row: Add MPA description and Map
    textob = p.beginText()
    textob.setTextOrigin(page_left, page_top)
    textob.setFont("Helvetica", 8)

    zone_info = get_mpa_zone_info()

    for line in zone_info:
        textob.textLine(line[0])
        textob.textLine(line[1])
        textob.textLine("")

    p.drawText(textob)

    img = Image.open(os.path.join(settings.STATIC_ROOT, 'st_anns_bank_mpa.png'))
    img.thumbnail(thumbnail_map_size, Image.Resampling.LANCZOS)

    p.drawInlineImage(img, thumbnail_map_position[1], thumbnail_map_position[0], showBoundary=True)

    row_offset -= img.height + margin

    # df.set_index('date_time', inplace=True)

    year_span = 30/6
    year = 1993
    for i in range(0, 6):
        plot = add_plot(i, 62, start_date=f'{int(year)}-01-01', end_date=f'{int(year+year_span)}-01-01')
        year += year_span

        ratio = (letter[0] - margin * 2) / plot.getSize()[0]

        height = plot.getSize()[1] * ratio
        width = plot.getSize()[0] * ratio

        row_offset -= height

        if row_offset - margin < 0:

            rect_height = 100

            textob = p.beginText()
            textob.setTextOrigin(page_left+margin, row_offset+height-(rect_height/2))
            textob.setFont("Helvetica", 8)
            textob.textLine("This is an example citation at the bottom of a page because we've run out of space here")

            p.drawText(textob)

            p.setFillGray(gray=0.5, alpha=0.5)
            p.rect(margin, row_offset + height - rect_height, letter[0] - (margin*2), rect_height, fill=1)

            p.showPage()
            row_offset = letter[1] - margin - height

        p.drawImage(plot, margin, row_offset, width=width, height=height, showBoundary=True)

        row_offset -= margin

    p.showPage()
    p.save()

    buffer.seek(0)
    return FileResponse(buffer, as_attachment=True, filename="DTO_Save.pdf")


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


def get_timeseries_data(mpa_id):
    timeseries = {'data': []}

    if mpa_id == -1:
        return timeseries

    if not models.MPAZone.objects.filter(pk=mpa_id).exists():
        return timeseries

    mpa_zone = models.MPAZone.objects.get(pk=mpa_id)
    timeseries['name'] = mpa_zone.name.name_e
    mpa_timeseries = mpa_zone.name.timeseries.all().order_by('date_time')

    if not mpa_timeseries.exists():
        return timeseries

    df = pd.DataFrame(list(mpa_timeseries.values('date_time', 'temperature')))
    df['date_time'] = pd.to_datetime(df['date_time'])
    df.set_index('date_time', inplace=True)

    # clim = df.groupby([df.index.month, df.index.day]).mean()
    quant = df.groupby([df.index.month, df.index.day]).quantile()

    timeseries['data'] = [{"date": mt.date_time.strftime("%Y-%m-%d") + " 00:01",
                           "temp": f'{mt.temperature}',
                           "clim": f'{quant["temperature"][mt.date_time.month, mt.date_time.day]}'}
                          for mt in mpa_timeseries]

    return timeseries


def get_timeseries(request):
    mpa_id = int(request.GET.get('mpa', -1))

    return JsonResponse(get_timeseries_data(mpa_id))


def get_range_chart(request):
    chart_id = request.GET.get('chart_name')
    species = models.Species.objects.all().order_by('name')

    context = {'id': chart_id, 'species': species, 'proxy_url': settings.PROXY_URL}
    html = render(request, 'core/partials/range_chart_row.html', context)
    return HttpResponse(html)


def get_quantile_chart(request):
    chart_id = request.GET.get('chart_name')

    context = {'id': chart_id, 'proxy_url': settings.PROXY_URL}
    html = render(request, 'core/partials/quantile_chart_row.html', context)
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
