import geopandas as gpd

from django.contrib.gis.db.models import Union
from django.contrib.gis.geos import MultiPolygon, GEOSGeometry
from django.core.management import call_command

from core import models

# Auto-generated `LayerMapping` dictionary for mpa model
mpa_mapping = {
    'name_e': 'WEA',
    'km2': 'Area_km2',
    'geom': 'MULTIPOLYGON',
}

mpa_shape = r'scripts/data/WEA_Polygons/Designated_WEAs_25_07_29.shp'


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

def print_mpas():
    data = gpd.read_file(mpa_shape, encoding='ISO-8859-1')

    for _, shp in data.iterrows():
        print(f"{shp}")

def load_wea_classifications() -> models.Classifications:
    name_e = "Wind Energy Areas (WEAs)"
    name_f = "Wind Energy Areas (WEAs)"
    colour = "#4AC38C"

    if(classifications:=models.Classifications.objects.filter(name_e__iexact=name_e)).exists():
        classification = classifications.first()
        classification.name_f = name_f
        classification.colour = colour
        classification.save()
    else:
        classification = models.Classifications.objects.create(name_e=name_e, name_f=name_f, colour=colour)

    return classification


def load_mpas():
    update_mpas()

def fake_timeseries():
    def set_t(timeseries, wea_zone):
        timeseries.pk=None
        timeseries.zone_id=wea_zone
        return timeseries

    st_anns = models.Timeseries.objects.filter(zone_id=35, type=1, model_id=1)

    wea_zones = models.MPAZones.objects.filter(site_id__gte=9000)
    for wea in wea_zones:
        wea.timeseries.all().delete()
        ts = [set_t(t, wea.pk) for t in st_anns]
        models.Timeseries.objects.bulk_create(ts)

def update_mpas(reload=False):
    # if reload is true this will delete the timeseries and recreate the MPA

    data = gpd.read_file(mpa_shape, encoding='ISO-8859-1')
    data = data.reset_index(drop=True)
    data['OBJECTI'] = range(9000, 9000 + len(data))

    classification = load_wea_classifications()

    update_wea_list = []
    new_wea_list = []
    for _, shp in data.iterrows():
        if reload:
            models.MPAZones.objects.filter(site_id=shp.OBJECTI).delete()

            wea = models.MPAZones(site_id=shp.OBJECTI)
            new_wea_list.append(wea)
        elif(wea:=models.MPAZones.objects.filter(site_id=shp.OBJECTI)).exists():
            wea = wea.first()
            update_wea_list.append(wea)
        else:
            wea = models.MPAZones(site_id=shp.OBJECTI)
            new_wea_list.append(wea)

        wea.name_e=shp.WEA
        wea.name_f=shp.WEA
        wea.url_e="https://cnsoer.ca/renewable-energy/lands-management/governments-designated-offshore-wind-energy-areas"
        wea.url_f="https://cnsoer.ca/renewable-energy/lands-management/governments-designated-offshore-wind-energy-areas"
        wea.km2=shp.Area_km2
        wea.classification = classification

        try:
            geo = str(shp.geometry)
            if geo.startswith('MULTIPOLYGON'):
                wea.geom = GEOSGeometry(geo)
            else:
                wea.geom = MultiPolygon(GEOSGeometry(geo))
        except Exception as e:
            print(f"Could not load zone {wea.name_e} - {shp.OBJECTI}")
            print(str(e))

    models.MPAZones.objects.bulk_create(new_wea_list)
    models.MPAZones.objects.bulk_update(update_wea_list, ['name_e', 'name_f', 'url_e', 'url_f', 'km2', 'classification', 'geom'])
    fake_timeseries()