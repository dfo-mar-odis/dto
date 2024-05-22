import os
import pandas as pd

import rioxarray.exceptions
import xarray as xr
import geopandas as gpd

from core import models

data_dir = r"scripts/data"


def get_xarray_data():
    file_name = "AtlanticNW_monthly_Monthly_clim_1993-2018-01_GLORYS12v1.nc"
    file = os.path.join(data_dir, file_name)
    data = xr.open_dataset(file)

    return data


def get_shape_data():
    file_name = r"DFO_MPA_MPO_ZPM_SHP\DFO_MPA_MPO_ZPM.shp"
    file = os.path.join(data_dir, file_name)
    data = gpd.read_file(file)

    return data


def set_spatial(dataframe: xr.Dataset, crs="epsg:4326"):
    dataframe.rio.set_spatial_dims(x_dim="longitude", y_dim="latitude", inplace=True)
    dataframe.rio.write_crs(crs, inplace=True)


def update_avg_temps(name: str = None):
    crs = "epsg:4326"
    xr_data = get_xarray_data()
    shp_data = get_shape_data().to_crs(crs)
    set_spatial(xr_data, crs=crs)

    for shp in shp_data.iterrows():
        name = shp[1].NAME_E
        zone = shp[1].ZONE_E
        mpa = None
        if (mpas := models.MPA.objects.filter(name_e__iexact=name, zone_e__iexact=zone)).exists():
            mpa = mpas.first()

        print(mpa)

        try:
            clipped = xr_data.rio.clip([shp[1].geometry], shp_data.crs, drop=True)
            clipped_time = pd.Timestamp(clipped.time[0].values)

            clipped_depth = clipped.depth[0].values

            avg = clipped.thetao.isel(time=0, depth=0).mean(skipna=True)
            val = avg.values.item()
            models.Climatology(mpa=mpa, time=clipped_time, depth=clipped_depth, avg_temperature=val).save()
            print(avg)
        except rioxarray.exceptions.NoDataInBounds:
            print('No data')
