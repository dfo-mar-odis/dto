import geopandas as gpd

from django.contrib.gis.db.models import Union
from django.contrib.gis.geos import MultiPolygon, GEOSGeometry

from core import models

# Auto-generated `LayerMapping` dictionary for mpa model
mpa_mapping = {
    'name_e': 'SitNm_E',
    'name_f': 'NmDSt_F',
    'url_e': 'URL_E',
    'url_f': 'URL_F',
    'km2': 'Km2',
    'geom': 'MULTIPOLYGON',
}

mpa_shape = r'scripts/data/MPA_Polygons/MPA_polygons.shp'


def merge_zones():
    for mpa in models.MPAName.objects.all():
        geom = None
        map_zone_union = models.MPAZone.objects.filter(name=mpa).aggregate(area=Union('geom'))
        try:
            geom = MultiPolygon(GEOSGeometry(map_zone_union['area']))
            # print(f"Map area: {map_zone_union['area']}")
        except TypeError as e:
            for zone in mpa.zones.all():
                if geom:
                    geom += zone.geom
                else:
                    geom = zone.geom

        zone_names_e = ", ".join([zone.zone_e for zone in mpa.zones.all()])
        zone_names_f = ", ".join([zone.zone_f for zone in mpa.zones.all()])
        meta = mpa.zones.first()
        area = geom.area
        try:
            print(f"{mpa.name_e.encode('utf-8')} - {area / 1000000}")
        except UnicodeEncodeError as ex:
            print(f"Could not decode mpa name - {area / 1000000}")

        merged_zone = models.MPAZone(name=mpa, zone_e=f'Union: {zone_names_e}', zone_f=f'Union: {zone_names_f}',
                                     url_e=meta.url_e, url_f=meta.url_e, regulation=meta.regulation,
                                     reglement=meta.reglement, km2=(area / 1000000), geom=geom, )
        merged_zone.save()
        print(merged_zone.zone_e)


def list_shapefile_fields(shapefile_path=mpa_shape, encoding='ISO-8859-1', show_dtypes=False):
    """
    List all fields/columns in a shapefile.

    Parameters:
    shapefile_path (str): Path to the shapefile
    encoding (str): File encoding (default: ISO-8859-1)
    show_dtypes (bool): Whether to show data types for each field

    Returns:
    dict: Field names with their data types if show_dtypes=True
          Otherwise, a list of field names
    """
    try:
        # Read the shapefile
        data = gpd.read_file(shapefile_path, encoding=encoding)

        # Get fields
        fields = list(data.columns)

        if show_dtypes:
            # Return dictionary of field names and their data types
            field_types = {field: str(data[field].dtype) for field in fields}
            return field_types
        else:
            # Just return list of field names
            return fields

    except FileNotFoundError:
        print(f"Error: Shapefile not found at {shapefile_path}")
        return None
    except Exception as e:
        print(f"Error reading shapefile: {str(e)}")
        return None


def load_mpas():
    data = gpd.read_file(mpa_shape, encoding='ISO-8859-1')

    for _, shp in data.iterrows():
        models.MPAZones.objects.filter(site_id=shp.OBJECTI).delete()

        mpa = models.MPAZones(site_id=shp.OBJECTI, name_e=shp.SitNm_E, name_f=shp.NmDSt_F,
                              url_e=shp.URL_E, url_f=shp.URL_F, km2=shp.Km2)
        try:
            geo = str(shp.geometry)
            if geo.startswith('MULTIPOLYGON'):
                mpa.geom = GEOSGeometry(geo)
            else:
                mpa.geom = MultiPolygon(GEOSGeometry(geo))
            mpa.save()
        except Exception as e:
            print(f"Could not load zone {mpa.name_e} - {shp.OBJECTI}")
            print(str(e))

