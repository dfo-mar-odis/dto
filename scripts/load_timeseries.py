import os
import re
import pandas as pd
import numpy as np

from core import models


def load_series(mpa_name, timeseries, depth=None, indicator=1):
    add_time_series = []
    timeseries_indicator = models.Indicator.objects.get(pk=indicator)
    for row in timeseries.iterrows():
        try:
            value = float(row[1][0])
        except ValueError:
            value = np.nan

        add_time_series.append(
            models.Timeseries(mpa=mpa_name, date_time=row[0], value=value, depth=depth, indicator=timeseries_indicator)
        )

        # print(len(add_time_series))
        if len(add_time_series) > 1000:
            print("loading 1000 items")
            models.Timeseries.objects.bulk_create(add_time_series)
            add_time_series = []

    models.Timeseries.objects.bulk_create(add_time_series)


def read_timeseries(mpa_name, filename, date_col='Date'):
    timeseries = pd.read_csv(filename)
    timeseries = timeseries.set_index(date_col)

    load_series(mpa_name, timeseries)


def read_depth_timeseries(mpa_name, filename, date_col='Date'):
    timeseries = pd.read_csv(filename)
    timeseries = timeseries.set_index(date_col)

    for col in timeseries.columns:
        depth_timeseries = timeseries[[col]]

        depth = int(col.split(' ')[0])
        load_series(mpa_name, depth_timeseries, depth)


def load_mpas_from_dict(data: dict):
    for k,mpa_dict in data.items():
        print(mpa_dict)
        mpa = models.MPAName.objects.get(pk=k)
        mpa.timeseries.all().delete()

        bottom_ts = mpa_dict['BOTTOM_TS']
        depth_ts = mpa_dict['DEPTH_TS']
        read_timeseries(mpa, bottom_ts)
        read_depth_timeseries(mpa, depth_ts)


def build_mpa_dictionary() -> dict:
    data = {}

    data_directory = './scripts/data/GLORYS/'
    id_regex = re.compile(r'.*?_(\d*)_.*?.csv')
    for f in os.listdir(data_directory):
        if not os.path.isfile(os.path.join(data_directory, f)):
            continue

        if (mpa_id := id_regex.match(f)) is None:
            continue

        if not f.startswith('depth_avebottomT_') and not f.startswith('avebottomT_'):
            continue

        mpa_id = int(mpa_id.group(1))
        if mpa_id not in data:
            mpa_id = mpa_id
            data[mpa_id] = {}

        if f.startswith('depth_avebottomT_'):
            data[mpa_id]['DEPTH_TS'] = os.path.join(data_directory, f)
        elif f.startswith('avebottomT_'):
            data[mpa_id]['BOTTOM_TS'] = os.path.join(data_directory, f)

    return data


def load_dictionary_mpas():
    mpas = build_mpa_dictionary()
    load_mpas_from_dict(mpas)


def load_mpas():
    # this is how we'll actually load data when we have real data to load
    # for now, every MPA is getting loaded with the St. Anne's bank data
    data = build_mpa_dictionary()
    load_mpas_from_dict(data)