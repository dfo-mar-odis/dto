import io
import os
from datetime import datetime

import pandas as pd
import folium
import branca.colormap as cm
import logging

import matplotlib.pyplot as plt

from PIL import Image
from django.db.models import Max

from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib.units import inch
from reportlab.lib.pagesizes import letter

from django.conf import settings
from django.http import JsonResponse, HttpResponse, HttpResponseRedirect, FileResponse
from django.urls import translate_url
from django.shortcuts import render
from django.utils.http import url_has_allowed_host_and_scheme
from django.utils.translation import activate

from django.views.generic import TemplateView
from django.contrib.gis.db.models.functions import Transform

from core import models
from core.api.views import get_timeseries_dataframe


logger = logging.getLogger('')

colormap = cm.linear.Paired_07.scale(-2, 35)


def index(request):
    # ids = models.Timeseries.objects.values_list('mpa', flat=True).distinct()
    # mpas = [json.dumps(add_attributes(mpa)) for mpa in
    #         models.MPAZone.objects.filter(name__in=ids)]
    context = {
        # 'mpas': mpas,
        # 'proxy_url': settings.PROXY_URL,
    }

    return render(request, 'core/map.html', context)


def set_language(request):
    """
    Redirect to a given URL while setting the chosen language in the session
    or cookie. The URL and the language code need to be specified in the
    request parameters.
    """
    next_url = request.POST.get('next', request.GET.get('next'))

    # Remove FORCE_SCRIPT_NAME if set
    if settings.FORCE_SCRIPT_NAME:
        next_url = next_url.replace(settings.FORCE_SCRIPT_NAME, '')

    if not next_url or not url_has_allowed_host_and_scheme(
            url=next_url,
            allowed_hosts={request.get_host()},
            require_https=request.is_secure(),
    ):
        next_url = request.META.get('HTTP_REFERER')
        if not next_url or not url_has_allowed_host_and_scheme(
                url=next_url,
                allowed_hosts={request.get_host()},
                require_https=request.is_secure(),
        ):
            next_url = '/'

    language = request.POST.get('language', request.GET.get('language'))
    if language and language in dict(settings.LANGUAGES):
        activate(language)
        next_url = translate_url(next_url, ('fr' if language == 'en' else 'en'))

        # add FORCE_SCRIPT_NAME if set
        # if settings.FORCE_SCRIPT_NAME:
        #     next_url = settings.FORCE_SCRIPT_NAME + next_url

        response = HttpResponseRedirect(next_url)
        response.set_cookie(
            settings.LANGUAGE_COOKIE_NAME,
            language,
            max_age=settings.LANGUAGE_COOKIE_AGE,
            path=settings.LANGUAGE_COOKIE_PATH,
            domain=settings.LANGUAGE_COOKIE_DOMAIN,
            secure=settings.LANGUAGE_COOKIE_SECURE,
            httponly=settings.LANGUAGE_COOKIE_HTTPONLY,
            samesite=settings.LANGUAGE_COOKIE_SAMESITE,
        )
        return response

    return HttpResponseRedirect(next_url)


def add_attributes(mpa):
    value = 20
    simplified_poly = mpa.geom
    if simplified_poly.num_coords > 10000:
        simplified_poly = mpa.geom.simplify(1, preserve_topology=True)

    geo_json = {
        "type": "Feature",
        "style": {
            "color": "#FF5555",
        },
        "id": mpa.pk,
        "properties": {
            'name': mpa.name_e,
            'url': mpa.url_e,
            'km2': round(mpa.km2, 0),
            'ts_value': value,
        },
        "geometry": {
            "type": simplified_poly.geom_type,
            "coordinates": simplified_poly.coords,
        }
    }

    return geo_json


def get_mpa_zone_info(mpa_id):
    mpa = models.MPAZones.objects.get(pk=mpa_id)

    mpa_name_label = "MPA Name:"
    mpa_name_text = mpa.name_e

    mpa_url_label = "MPA URL:"
    mpa_url_text = f"{mpa.url_e}"

    mpa_area_label = "km^2"
    mpa_area_text = f"{mpa.km2}"

    map = None
    if mpa.name_e.lower() == 'st. anns bank marine protected area':
        map = "st_anns_bank_mpa.png"

    zone_info = [
        (mpa_name_label, mpa_name_text),
        (mpa_url_label, mpa_url_text),
        (mpa_area_label, mpa_area_text),
    ]

    return map, zone_info


def add_plot(title, mpa_id, depth=None, start_date='2020-01-01', end_date='2023-01-01', indicator=1):
    q_upper = 0.9
    q_lower = 0.1

    mpa_zone = models.MPAZones.objects.get(site_id=mpa_id)
    indicator = models.Indicators.objects.get(pk=indicator)
    df = get_timeseries_dataframe(mpa_zone, depth, indicator=indicator)

    clim = df[(df.index <= '2022-12-31')]
    clim = clim.groupby([clim.index.month, clim.index.day]).quantile()['value']
    grouped = df.groupby([df.index.month, df.index.day])
    upper = grouped.quantile(q=q_upper)['value']
    lower = grouped.quantile(q=q_lower)['value']

    df['upper'] = df.index.map(lambda x: upper[(x.month, x.day)])
    df['lower'] = df.index.map(lambda x: lower[(x.month, x.day)])
    df['climatology'] = df.index.map(lambda x: clim[(x.month, x.day)])

    if start_date:
        df = df[start_date:]

    if end_date:
        df = df[:end_date]

    # Row: Add chart
    figure, ax = plt.subplots(figsize=(10, 3.75))
    plt.subplots_adjust(left=0.1, right=0.95, top=0.8, bottom=0.2)

    plt.title(title)
    plt.ylabel(f'{indicator.name}')
    plt.xlabel("Date")
    plt.xticks(rotation=30)

    ax.set_xlim([df.index.min(), df.index.max()])
    # ax.plot(df.index, df['temperature'], df.index, df['climatology'])

    ax.fill_between(
        df.index, df['value'], df['climatology'], where=(df['value'] > df['climatology']),
        interpolate=True, color="red", alpha=0.25
    )

    ax.fill_between(
        df.index, df['value'], df['climatology'], where=(df['value'] <= df['climatology']),
        interpolate=True, color="blue", alpha=0.25
    )

    ax.fill_between(
        df.index, df['upper'], df['lower'], where=(df['lower'] <= df['upper']),
        interpolate=True, color="grey", alpha=0.5
    )

    ax.fill_between(
        df.index, df['value'], df['upper'], where=(df['value'] > df['upper']),
        interpolate=True, color="red", alpha=1.0
    )

    ax.fill_between(
        df.index, df['value'], df['lower'], where=(df['value'] < df['lower']),
        interpolate=True, color="blue", alpha=1.0
    )

    ax.plot(df['value'], color="#801515", linewidth=1)
    ax.plot(df['climatology'], color="black", linewidth=0.7)

    imgdata = io.BytesIO()
    figure.savefig(imgdata, format='png')
    imgdata.seek(0)

    return ImageReader(imgdata)


def generate_pdf(request):
    mpa_id, climate_model, depth, start_date, end_date = parse_request_variables(request)

    timeseries = models.Timeseries.objects.order_by('date_time')
    if not start_date:
        start_date = timeseries.first().date_time

    if not end_date:
        end_date = timeseries.last().date_time

    if not mpa_id:
        return FileResponse()

    buffer = io.BytesIO()

    margin = inch * 0.5
    row_offset = letter[1] - margin

    page_top = letter[1] - margin
    page_bottom = margin
    page_right = letter[0] - margin
    page_left = margin

    # align map from the bottom right of the page
    thumbnail_map_size = 200, 200
    thumbnail_map_position = (page_top - thumbnail_map_size[0]), page_right - thumbnail_map_size[1]

    p = canvas.Canvas(buffer, pagesize=letter)

    # Row: Add MPA description and Map
    textob = p.beginText()
    textob.setTextOrigin(page_left, page_top)
    textob.setFont("Helvetica", 8)

    map, zone_info = get_mpa_zone_info(mpa_id)

    for line in zone_info:
        textob.textLine(line[0])
        textob.textLine(line[1])
        textob.textLine("")

    p.drawText(textob)

    if map:
        img = Image.open(os.path.join(settings.STATIC_ROOT, map))
        img.thumbnail(thumbnail_map_size, Image.Resampling.LANCZOS)

        p.drawInlineImage(img, thumbnail_map_position[1], thumbnail_map_position[0], showBoundary=True)

        row_offset -= img.height + margin

    # df.set_index('date_time', inplace=True)

    year_span = 30 / 6
    year = 1993
    plot = add_plot("Quartile Chart", mpa_id, depth, start_date=start_date, end_date=end_date)
    year += year_span

    ratio = (letter[0] - margin * 2) / plot.getSize()[0]

    height = plot.getSize()[1] * ratio
    width = plot.getSize()[0] * ratio

    row_offset -= height

    if row_offset - margin < 0:
        rect_height = 100

        textob = p.beginText()
        textob.setTextOrigin(page_left + margin, row_offset + height - (rect_height / 2))
        textob.setFont("Helvetica", 8)
        textob.textLine("This is an example citation at the bottom of a page because we've run out of space here")

        p.drawText(textob)

        p.setFillGray(gray=0.5, alpha=0.5)
        p.rect(margin, row_offset + height - rect_height, letter[0] - (margin * 2), rect_height, fill=1)

        p.showPage()
        row_offset = letter[1] - margin - height

    p.drawImage(plot, margin, row_offset, width=width, height=height, showBoundary=True)

    row_offset -= margin

    p.showPage()
    p.save()

    buffer.seek(0)
    return FileResponse(buffer, as_attachment=True, filename="DTO_Save.pdf")


def get_anomaly(request):
    mpa_id, climate_model, depth, start_date, end_date = parse_request_variables(request)
    mpa_zone = models.MPAZones.objects.get(pk=mpa_id)

    mpa_timeseries = mpa_zone.timeseries.filter(indicator=1, depth=None).order_by('date_time')

    df = pd.DataFrame(list(mpa_timeseries.values('date_time', 'depth', 'value')))
    df['date_time'] = pd.to_datetime(df['date_time'])
    df.set_index('date_time', inplace=True)

    # Step 1: Calculate annual mean temperatures for each year
    df['year'] = df.index.year
    annual_means = df.groupby('year')['value'].mean()

    # Step 2: Calculate annual climatology (mean of annual means from 1993 to 2021)
    climatology_years = annual_means.iloc[:30]
    climatology_mean = climatology_years.mean()

    # Step 3: Calculate standard deviation for climatology (std of the 30 points)
    climatology_std = climatology_years.std()

    # Step 4: Annual standardized anomaly
    anomaly = (annual_means - climatology_mean) / climatology_std

    data = {
        'dates': [str(year) for year in anomaly.index],
        'values': anomaly.values.tolist()
    }

    return JsonResponse(data)


def get_quantiles(request):

    timeseries = {'data': []}

    mpa_id, climate_model, depth, start_date, end_date = parse_request_variables(request)

    q_upper = float(request.GET.get('upper_quantile', 0.9))
    q_lower = float(request.GET.get('lower_quantile', 0.1))

    if mpa_id == -1:
        return JsonResponse(timeseries)

    if not models.MPAZones.objects.filter(pk=mpa_id).exists():
        return JsonResponse(timeseries)

    mpa_zone = models.MPAZones.objects.get(pk=mpa_id)
    timeseries['name'] = mpa_zone.name_e

    df = get_timeseries_dataframe(mpa_zone, climate_model, depth)

    if df is None:
        return None

    # just like with the climatology we'll use 1993-2023 for our 30 year window regardless of what the request is for
    clim = df[(df.index <= '2022-12-31')]

    upper = clim.groupby([clim.index.month, clim.index.day]).quantile(q=q_upper)
    lower = clim.groupby([clim.index.month, clim.index.day]).quantile(q=q_lower)
    climatology = clim.groupby([clim.index.month, clim.index.day]).quantile()

    max_val = df[(df.value == df.max().value)]
    min_val = df[(df.value == df.min().value)]

    # the min/max delta is used by the progress bar to have an absolute zero and absolute max
    timeseries['max_delta'] = df.max().value - climatology.loc[(max_val.index.month[0], max_val.index.day[0])].value
    timeseries['min_delta'] = df.min().value - climatology.loc[(min_val.index.month[0], min_val.index.day[0])].value

    df = df[(df.index >= start_date) & (df.index <= end_date)]
    timeseries['data'] = [{"date": f'{date.strftime("%Y-%m-%d")} 00:01',
                           "lowerq": f'{lower["value"][date.month, date.day]}',
                           "upperq": f'{upper["value"][date.month, date.day]}'}
                          for date, mt in df.iterrows()]

    return JsonResponse(timeseries)


def get_timeseries_data(mpa_id, climate_model=1, depth=None, start_date=None, end_date=None, indicator=1):
    timeseries = {'data': []}

    if mpa_id == -1:
        return timeseries

    if not models.MPAZones.objects.filter(pk=mpa_id).exists():
        return timeseries

    mpa_zone = models.MPAZones.objects.get(pk=mpa_id)

    timeseries['name'] = mpa_zone.name_e

    df = get_timeseries_dataframe(mpa_zone, climate_model, depth, indicator=indicator)
    if df is None:
        return None

    clim = df[(df.index <= '2022-12-31')]
    clim = clim.groupby([clim.index.month, clim.index.day]).quantile()

    max_val = df[(df.value == df.max().value)]
    min_val = df[(df.value == df.min().value)]

    timeseries['max_delta'] = df.max().value - clim.loc[(max_val.index.month[0], max_val.index.day[0])].value
    timeseries['min_delta'] = df.min().value - clim.loc[(min_val.index.month[0], min_val.index.day[0])].value
    df = df[(df.index >= start_date) & (df.index <= end_date)]
    timeseries['data'] = [{
        "date": f'{date.strftime("%Y-%m-%d")} 00:01',
        "ts_data": str(mt['value'].item()),
        "clim": f'{clim["value"][date.month, date.day]}',
        "std_dev": f'{clim["value"].std()}'
    } for date, mt in df.iterrows()]

    return timeseries


def get_timeseries(request):
    mpa_id, climate_model, depth, start_date, end_date = parse_request_variables(request)
    return JsonResponse(get_timeseries_data(mpa_id, climate_model, depth, start_date, end_date), safe=False)


def parse_request_variables(request):
    mpa_id = int(request.GET.get('mpa', -1))
    climate_model = int(request.GET.get('climate_model', 1))
    depth = request.GET.get('depth', None)
    depth = None if depth == '' or depth is None else int(depth)

    start_date = request.GET.get('start_date', None)
    start_date = None if start_date == '' or start_date is None else start_date

    end_date = request.GET.get('end_date', None)
    end_date = None if end_date == '' or end_date is None else end_date

    return mpa_id, climate_model, depth, start_date, end_date


def get_standard_anomalies_chart(request):
    chart_id = request.GET.get('chart_name')

    context = {
        'id': chart_id,
        # 'proxy_url': settings.PROXY_URL
    }
    html = render(request, 'core/partials/stda_chart_row.html', context)
    return HttpResponse(html)


def get_range_chart(request):
    chart_id = request.GET.get('chart_name')
    species = models.Species.objects.all().order_by('name')

    context = {
        'id': chart_id,
        'species': species,
        # 'proxy_url': settings.PROXY_URL
    }
    html = render(request, 'core/partials/range_chart_row.html', context)
    return HttpResponse(html)


def get_quantile_chart(request):
    chart_id = request.GET.get('chart_name')

    context = {
        'id': chart_id,
        # 'proxy_url': settings.PROXY_URL
    }
    html = render(request, 'core/partials/quantile_chart_row.html', context)
    return HttpResponse(html)


def get_species_range(request, species_id=None):
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
        logger.debug("Initializing View")
        figure = folium.Figure()

        map = folium.Map(location=[44.666830, -63.631500], zoom_start=6)
        map.add_to(figure)

        for mpa in models.MPAZones.objects.annotate(trans=Transform('geom', srid=4326)):
            geo_j = folium.GeoJson(data=mpa.trans.geojson)
            folium.Popup(mpa.name_e).add_to(geo_j)
            geo_j.add_to(map)

        # Render and send to template
        figure.render()
        map.save(r'scripts/data/sample.html')
        return {"map": figure}


def indicators(request):
    mpa = int(request.GET.get('mpa', 0))
    date_string = request.GET.get('date', None)
    if date_string is None:
        return JsonResponse({})

    date = datetime.strptime(date_string, '%Y-%m-%d')

    climate_model = request.GET.get('climate_model', None)
    climate_model = int(climate_model) if climate_model else None

    depth = request.GET.get('depth', None)
    depth = int(depth) if depth else None

    mpa_zone = models.MPAZones.objects.get(pk=mpa)
    df = get_timeseries_dataframe(mpa_zone, climate_model, depth)

    if df is None:
        return None

    # using a 30 year timeseries for the climatology from 1993-01-01 to 2022-120-31
    clim = df[(df.index <= '2022-12-31')]
    clim = clim.groupby([clim.index.month, clim.index.day]).quantile()
    upper_c = df.groupby([df.index.month, df.index.day]).quantile(q=0.9)
    lower_c = df.groupby([df.index.month, df.index.day]).quantile(q=0.1)

    max_val = df[(df.value == df.max().value)]
    min_val = df[(df.value == df.min().value)]

    min_ts = round(df.min().value - clim.at[(min_val.index.month[0], min_val.index.day[0]), 'value'], 3)
    max_ts = round(df.max().value - clim.at[(max_val.index.month[0], max_val.index.day[0]), 'value'], 3)
    current = round(df.at[date, "value"] - clim.at[(date.month, date.day), 'value'], 3)
    upper = round(upper_c.at[(date.month, date.day), "value"] - clim.at[(date.month, date.day), 'value'], 3)
    lower = round(lower_c.at[(date.month, date.day), "value"] - clim.at[(date.month, date.day), 'value'], 3)

    return JsonResponse(
        {"mpa": mpa, "date": date.strftime('%Y-%m-%d'), "min": min_ts, "max": max_ts, "current": current,
         "lower": lower, "upper": upper})


def get_polygons(request):
    page_size = 5

    if request.GET.get('page', None):
        page_start = (int(request.GET.get('page')) - 1) * page_size
        page_end = page_start + page_size
        ids = models.Timeseries.objects.values_list('mpa', flat=True).distinct()[page_start:page_end]
    else:
        ids = models.Timeseries.objects.values_list('mpa', flat=True).distinct()

    json_data = [add_attributes(mpa) for mpa in models.MPAZones.objects.filter(pk__in=ids).order_by('-km2')]

    return JsonResponse(json_data, safe=False)


def get_classification_colours(request):
    cla = models.Classifications.objects.all()

    return JsonResponse([{'name': c.name_e, 'colour': c.colour} for c in cla], safe=False)


def get_max_date(request):
    return JsonResponse({'max_date': models.Timeseries.objects.aggregate(Max('date_time'))["date_time__max"]})


def get_depths(request):
    mpa_id = int(request.GET.get('mpa_id', -1))
    mpa = models.MPAZones.objects.get(site_id=mpa_id)
    depths = models.Timeseries.objects.filter(zone=mpa).order_by('depth').values_list('depth', flat=True).distinct()
    depth_array = [(d, f'{d} m') for d in depths if d is not None]
    return JsonResponse({'depths': depth_array})


def get_climate_models(request):
    mpa_id = int(request.GET.get('mpa_id', -1))
    mpa = models.MPAZones.objects.get(site_id=mpa_id)
    climate_models = models.Timeseries.objects.filter(zone=mpa).values_list('model', flat=True).distinct()
    models_array = [(m.pk, f'{m.name}') for m in models.ClimateModels.objects.filter(pk__in=climate_models)]
    return JsonResponse({'climate_models': models_array})
