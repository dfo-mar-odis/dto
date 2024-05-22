import os
import geopandas as gpd

from django.contrib.gis.geos import MultiPolygon, GEOSGeometry
from core import models

# Auto-generated `LayerMapping` dictionary for mpa model
mpa_mapping = {
    'name_e': 'NAME_E',
    'name_f': 'NAME_F',
    'zone_e': 'ZONE_E',
    'zone_f': 'ZONE_F',
    'url_e': 'URL_E',
    'url_f': 'URL_F',
    'regulation': 'REGULATION',
    'reglement': 'REGLEMENT',
    'km2': 'KM2',
    'geom': 'MULTIPOLYGON',
}

mpa_shape = r'scripts/data/DFO_MPA_MPO_ZPM_SHP/DFO_MPA_MPO_ZPM.shp'


def load_mpas():
    data = gpd.read_file(mpa_shape)

    for shp in data.iterrows():

        if not (mpa_name := models.MPAName.objects.filter(name_e=shp[1].NAME_E)).exists():
            mpa_name = models.MPAName(name_e=shp[1].NAME_E, name_f=shp[1].NAME_F)
            mpa_name.save()
        else:
            mpa_name = mpa_name.first()

        if not (mpa_zone := models.MPAZone.objects.filter(name=mpa_name, zone_e=shp[1].ZONE_E)).exists():
            mpa_zone = models.MPAZone(name=mpa_name, zone_e=shp[1].ZONE_E, zone_f=shp[1].ZONE_F)
            mpa_zone.url_e = shp[1].URL_E
            mpa_zone.url_f = shp[1].URL_F
            mpa_zone.regulation = shp[1].REGULATION
            mpa_zone.reglement = shp[1].REGLEMENT
            mpa_zone.km2 = shp[1].KM2
            try:
                geo = str(shp[1].geometry)
                if geo.startswith('MULTIPOLYGON'):
                    mpa_zone.geom = GEOSGeometry(geo)
                else:
                    mpa_zone.geom = MultiPolygon(GEOSGeometry(geo))
                mpa_zone.save()
            except:
                print(f"Could not load zone {mpa_name.name_e} - {shp[1].ZONE_E}")
                print(f"{str(shp[1].geometry)}")

