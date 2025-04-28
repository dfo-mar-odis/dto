import time
import pandas as pd
import numpy as np

from core import models


def load_series(mpa_name, timeseries, depth=None):
    add_time_series = []
    for row in timeseries.iterrows():
        try:
            value = float(row[1][0])
        except ValueError:
            value = np.nan

        add_time_series.append(
            models.Timeseries(mpa=mpa_name, date_time=row[0], temperature=value, depth=depth, climatology=0)
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


def load_mpas():
    models.Timeseries.objects.all().delete()

    # this is how we'll actually load data when we have real data to load
    # for now, every MPA is getting loaded with the St. Anne's bank data
    data = [
        {
            "MPA": "St. Anns Bank",
            "MPA_ID": 9,
            "BOTTOM_TS": 'core/scripts/data/GLORYS_StAnnsBank_daily_aveBottomT.csv',
            "DEPTH_TS": 'core/scripts/data/SAB_GLORYS_daily_depth_temp.csv'
        },
        {
            "MPA": "Gully",
            "MPA_ID": 3,
            "BOTTOM_TS": 'core/scripts/data/GLORYS_StAnnsBank_daily_aveBottomT.csv',
            "DEPTH_TS": 'core/scripts/data/SAB_GLORYS_daily_depth_temp.csv'
        },
        {
            "MPA": "Laurentian Channel",
            "MPA_ID": 14,
            "BOTTOM_TS": 'core/scripts/data/GLORYS_StAnnsBank_daily_aveBottomT.csv',
            "DEPTH_TS": 'core/scripts/data/SAB_GLORYS_daily_depth_temp.csv'
        }
    ]
    data = [{
        "MPA": mpa.name_e,
        "MPA_ID": mpa.pk,
        "BOTTOM_TS": 'core/scripts/data/GLORYS_StAnnsBank_daily_aveBottomT.csv',
        "DEPTH_TS": 'core/scripts/data/SAB_GLORYS_daily_depth_temp.csv'
    } for mpa in models.MPAName.objects.all()]

    for mpa_dict in data:
        mpa = models.MPAName.objects.get(pk=mpa_dict['MPA_ID'])
        bottom_ts = mpa_dict['BOTTOM_TS']
        depth_ts = mpa_dict['DEPTH_TS']
        read_timeseries(mpa, bottom_ts)
        read_depth_timeseries(mpa, depth_ts)
