import time
import pandas as pd
import numpy as np

from core import models

def read_timeseries(mpa_name, filename, date_col='Date'):
    timeseries = pd.read_csv(filename)
    timeseries = timeseries.set_index(date_col)

    add_time_series = []
    for row in timeseries.iterrows():
        try:
            value = float(row[1][0])
        except ValueError:
            value = np.nan

        add_time_series.append(models.Timeseries(mpa=mpa_name, date_time=row[0], temperature=value, climatology=0))

        print(len(add_time_series))
        if len(add_time_series) > 1000:
            print("loading 1000 items")
            models.Timeseries.objects.bulk_create(add_time_series)
            add_time_series = []

    models.Timeseries.objects.bulk_create(add_time_series)


def load_stAnns():
    file = 'data/GLORYS_StAnnsBank_daily_aveBottomT.csv'
    mpa = models.MPAName.objects.get(pk=9)
    read_timeseries(mpa, file)