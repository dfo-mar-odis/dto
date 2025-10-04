import io
import os
import numpy as np
import pandas as pd
import branca.colormap as cm
import logging

import matplotlib.pyplot as plt

from PIL import Image
from django.db.models import Max, Min

from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib.units import inch
from reportlab.lib.pagesizes import letter

from django.conf import settings
from django.http import JsonResponse, HttpResponse, HttpResponseRedirect, FileResponse
from django.urls import translate_url
from django.shortcuts import render, redirect
from django.utils.http import url_has_allowed_host_and_scheme
from django.utils.translation import activate


from core import models
from core.api.views import get_timeseries_dataframe, get_base_timeseries, get_quantile_data

logger = logging.getLogger('')

colormap = cm.linear.Paired_07.scale(-2, 35)

def get_common_context(request):
    context = {
    }

    models_array = [(m.pk, f'{m.name}') for m in models.ClimateModels.objects.all()]
    context['models'] = models_array
    context['selected_model'] = {'id': int(request.session.get('selected_model', 1))}
    context['selected_model']['name'] = models.ClimateModels.objects.get(id=context['selected_model']['id']).name

    mpa_ids = []
    get_mpa_ids = request.GET.getlist('mpa_id')
    if get_mpa_ids:
        for mpa in get_mpa_ids:
            mpa_ids += mpa.split(',') if ',' in mpa else [mpa]

    if mpa_ids:
        context['mpa_ids'] = mpa_ids

    return context

def bottom(request, **kwargs):
    context = get_common_context(request)
    return render(request, 'core/bottom_map.html', context)


def surface(request, **kwargs):
    context = get_common_context(request)
    return render(request, 'core/surface_map.html', context)


def get_network_indicators(year, zone, climate_model):
    indicators = [
        # {
        #     'title': "Total Average Bottom Heat/Cold Wave",
        #     'description': 'Some description of what or how this indicator is computed',
        #     'year': 2025,
        #     'value': 50,
        #     'weight': 1,
        #     'colorbar': 'danger-subtle'
        # },
    ]

    db_indicators = zone.indicators.filter(model=climate_model, year=year)
    if db_indicators.exists():
        for db_indicator in db_indicators:
            value = db_indicator.value
            min_max = db_indicator.type.indicators.exclude(value=np.nan).aggregate(
                min_value=Min('value'),
                max_value=Max('value')
            )
            min = min_max['min_value']
            max = min_max['max_value']
            # Ensure min and max are not equal to avoid division by zero
            if max != min:
                percentage = ((value - min) / (max - min)) * 100
            else:
                percentage = 0  # Default to 0 if min and max are the same
            indicators.append({
                'title': db_indicator.type.name,
                'description': db_indicator.type.description,
                'year': db_indicator.year,
                'value': value,
                'min': min,
                'max': max,
                'width': percentage,
                'weight': zone.indicator_weights.get(type=db_indicator.type).weight,
                'colorbar': 'success'
            })

        weight = 0
        weighted_value = 0
        weighted_min = 0
        weighted_max = 0
        weighted_width = 0
        for indicator in indicators:
            weight += indicator['weight']
            weighted_min += indicator['min'] * indicator['weight']
            weighted_max += indicator['max'] * indicator['weight']
            weighted_width += indicator['width'] * indicator['weight']
            weighted_value += indicator['value'] * indicator['weight']

        overall_health = {
            'title': "Overall Health",
            'description': 'A weighted average of the available indicators',
            'year': year,
            'min': (weighted_min / weight),
            'max': (weighted_max / weight),
            'value': (weighted_value / weight),
            'width': (weighted_width / weight),
            'colorbar': 'primary'
        }
        indicators.insert(0, overall_health)

    return indicators


# this is a view for me to mockup and test out UI design ideas.
def test(request, **kwargs):
    context = get_common_context(request)

    year = 2024
    climate_model = models.ClimateModels.objects.get(pk=1)
    zones = [35, 8, 42]
    context['mpa_indicators'] = []

    for zone_id in zones:
        zone = models.MPAZones.objects.get(pk=zone_id)
        context['mpa_indicators'].append({
            'mpa': zone,
            'indicators': get_network_indicators(year, zone, climate_model)
        })
    return render(request, 'core/test.html', context)


def set_model(request):
    model_id = request.POST.get('model_id')
    request.session['selected_model'] = model_id
    return redirect(request.META.get('HTTP_REFERER', request.POST.get('next_page')))


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
    indicator = models.TimeseriesVariables.objects.get(pk=indicator)
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
    mpa_id, climate_model, depth, start_date, end_date, timeseries_type = parse_request_variables(request)

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
    mpa_id, climate_model, depth, start_date, end_date, timeseries_type = parse_request_variables(request)
    mpa_zone = models.MPAZones.objects.get(pk=mpa_id)

    mpa_timeseries = mpa_zone.timeseries.filter(indicator=1, type=timeseries_type, depth=None).order_by('date_time')

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


def parse_request_variables(request):
    mpa_id = int(request.GET.get('mpa', -1))
    climate_model = int(request.session.get('selected_model', 1))
    depth = request.GET.get('depth', None)
    depth = None if depth == '' or depth is None else int(depth)

    start_date = request.GET.get('start_date', None)
    start_date = None if start_date == '' or start_date is None else start_date

    end_date = request.GET.get('end_date', None)
    end_date = None if end_date == '' or end_date is None else end_date

    timeseries_type = request.GET.get('type', 1)

    return mpa_id, climate_model, depth, start_date, end_date, timeseries_type


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


def get_classification_colours(request):
    cla = models.Classifications.objects.all()

    return JsonResponse([{'name': c.name_e, 'colour': c.colour} for c in cla], safe=False)


def get_max_date(request):
    ts_type = request.GET.get('type', 1)  # we need bottom or surface data

    # use the session variable for the climate model, unless otherwise specified
    ts_model = int(request.session.get('selected_model', 1))
    ts_model = request.GET.get('model', ts_model)

    return JsonResponse({'max_date': models.Timeseries.objects.filter(type=ts_type, model=ts_model).aggregate(Max('date_time'))["date_time__max"]})

def get_climate_models(request):
    mpa_id = int(request.GET.get('mpa_id', -1))
    mpa = models.MPAZones.objects.get(site_id=mpa_id)
    climate_models = models.Timeseries.objects.filter(zone=mpa).values_list('model', flat=True).distinct()
    models_array = [(m.pk, f'{m.name}') for m in models.ClimateModels.objects.filter(pk__in=climate_models)]
    return JsonResponse({'climate_models': models_array})
