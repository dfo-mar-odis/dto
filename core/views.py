import json
import matplotlib as mpl
import folium
import rioxarray
import branca.colormap as cm
import logging

import numpy as np
import xarray as xr
from django.http import JsonResponse
from django.shortcuts import render

from osgeo import gdal
from folium.plugins import HeatMap

from django.views.generic import TemplateView
from django.contrib.gis.db.models.functions import Transform
from django.db.models import Min, Max, Avg

from core import models

logger = logging.getLogger(__name__)

colormap = cm.linear.Paired_07.scale(-2, 35)


def color_map_test(*args):
    if args[0] == -32767 or np.isnan(args[0]):
        return 0, 0, 0, 0

    return colormap.rgba_floats_tuple(args[0])


def add_mpa_raster_gdal(folium_map):
    ds = gdal.Open("scripts/data/mpa_clipped.tif")
    img = ds.GetRasterBand(1).ReadAsArray()
    GT = ds.GetGeoTransform()
    xRes = ds.GetGeoTransform()[1]
    yRes = ds.GetGeoTransform()[5]
    width = ds.RasterXSize
    height = ds.RasterYSize
    folium.raster_layers.ImageOverlay(
        image=np.flip(img, 0),
        opacity=0.5,
        bounds=[[GT[3] + height * yRes, GT[0]], [GT[3], GT[0] + width * xRes]],
        colormap=lambda x: (x, 0, 0, 0 if x == -32767 else 1),
        crs="EPSG:3857",
    ).add_to(folium_map)


def add_map_raster_rio(raster_location, folium_map):
    with rioxarray.open_rasterio(raster_location) as src:
        img = src.data
        src_min_lon, src_min_lat, src_max_lon, src_max_lat = src.rio.bounds()

    src_bounds_orig = [[src_min_lat, src_min_lon], [src_max_lat, src_max_lon]]

    folium_map.add_child(colormap)

    folium.raster_layers.ImageOverlay(
        image=np.flip(img[0], 0),
        opacity=.8,
        bounds=src_bounds_orig,
        mercator_project=True,
        colormap=color_map_test,
    ).add_to(folium_map)


def add_heat_map(file, folium_map):
    ncdf_data = xr.load_dataset(file)
    temp = ncdf_data.thetao.isel(time=0, depth=0)
    temp_df = temp.to_dataframe()[['thetao']].dropna()

    HeatMap(
        [(index[0], index[1], row['thetao']) for index, row in temp_df.iterrows()],
        name="MPA Temperature",
        min_opacity=0.2,
        radius=20,
        blur=15,
        max_zoom=1
    ).add_to(folium_map)


def add_attributes(mpa):

    temp = 20
    geo_json = {
        "type": "Feature",
        "style": {
            "color": mpl.colors.rgb2hex(color_map_test(temp), keep_alpha=False),
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

    context = {
        'mpas': mpas,
    }

    return render(request, 'core/map.html', context)


def get_timeseries(request):
    timeseries = {}
    mpa_id = int(request.GET.get('mpa', -1))
    if mpa_id == -1:
        return JsonResponse(timeseries)

    mpa_zone = models.MPAZone.objects.get(pk=mpa_id)
    timeseries['name'] = mpa_zone.name.name_e
    mpa_timeseries = mpa_zone.name.timeseries.all()
    stats = mpa_timeseries.exclude(temperature='nan').aggregate(min=Min('temperature'), max=Max('temperature'),
                                                                avg=Avg('temperature'))
    timeseries.update(stats)
    timeseries['data'] = [{"date": mt.date_time.strftime("%Y-%m-%d"),
                           "temp": f'{mt.temperature}'} for mt in mpa_timeseries]
    #timeseries['data'] = {'2000-01-01': 3.4, '2000-02-01': 5}
    # if mpa_zone.name.name_e.lower() == "st. anns bank marine protected area":
    #     timeseries = pd.read_csv('data/GLORYS_StAnnsBank_daily_aveBottomT.csv')
    #     timeseries = timeseries.set_index('Date')
    #     timeseries.columns = ['temp']
    #     timeseries = json.loads(timeseries.to_json())

    return JsonResponse(timeseries)


# Create your views here.
class MapView(TemplateView):
    template_name = 'core/map.html'

    def get_context_data(self, **kwargs):
        figure = folium.Figure()
        raster_location = 'scripts/data/mpa_clipped.tif'
        # raster_location = 'scripts/data/glorys.tif'

        # netcdf_location = 'scripts/data/mpa.nc'
        netcdf_location = 'scripts/data/AtlanticNW_monthly_Monthly_clim_1993-2018-01_GLORYS12v1.nc'

        # Add a Marker
        # for station in models.Station.objects.all():
        #     folium.Marker(
        #         location=station.position,
        #         popup=str(station),
        #     ).add_to(map)

        # Make the map
        # map = folium.Map(location=[44.666830, -63.631500], zoom_start=6, crs="EPSG4326")
        map = folium.Map(location=[44.666830, -63.631500], zoom_start=6)
        map.add_to(figure)

        # add_heat_map(netcdf_location, map)
        add_map_raster_rio(raster_location, map)

        # for mpa in models.MPA.objects.annotate(trans=Transform('geom', srid=102001)):
        #     geo_j = folium.GeoJson(data=mpa.trans.geojson)
        #     folium.Popup(mpa.name_e).add_to(geo_j)
        #     geo_j.add_to(map)

        for mpa in models.MPA.objects.annotate(trans=Transform('geom', srid=4326)):
            geo_j = folium.GeoJson(data=mpa.trans.geojson)
            folium.Popup(mpa.name_e).add_to(geo_j)
            geo_j.add_to(map)

        # Render and send to template
        figure.render()
        map.save(r'scripts/data/sample.html')
        return {"map": figure}