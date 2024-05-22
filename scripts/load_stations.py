import pandas as pd
from django.contrib.gis.geos import GEOSGeometry

from core import models


def load_stations():
    stations: pd.DataFrame = pd.read_csv(r'scripts/data/AZMPstations.csv')

    create_stations = []
    station_details = {}

    for i, station in stations.iterrows():
        st_name = station['station'].split("_")
        if st_name[0] not in station_details.keys():
            station_details[st_name[0]] = []

        station_details[st_name[0]].append({'number': st_name[1], 'lat': station['lat'], 'lon': station['lon']})

    for key in station_details.keys():
        station_lookup = models.StationLookup.objects.get_or_create(name=key)
        for details in station_details[key]:
            if models.Station.objects.filter(station=station_lookup[0], number=details['number']).exists():
                continue

            position = GEOSGeometry("POINT({} {})".format(details['lat'], details['lon']))
            create_stations.append(models.Station(station=station_lookup[0], number=details['number'],
                                                  position=position))

    models.Station.objects.bulk_create(create_stations)