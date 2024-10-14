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


def load_stAnns():
    # load overall average bottom time series
    file = 'core/scripts/data/GLORYS_StAnnsBank_daily_aveBottomT.csv'
    mpa = models.MPAName.objects.get(pk=9)
    read_timeseries(mpa, file)


def load_stAnns_depths():
    # load depth stratified bottom8 time series
    file = 'core/scripts/data/SAB_GLORYS_daily_depth_temp.csv'
    mpa = models.MPAName.objects.get(pk=9)
    read_depth_timeseries(mpa, file)