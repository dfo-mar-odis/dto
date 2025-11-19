import os
import re
import numpy as np
import pandas as pd
from core import models

from scripts import load_indicators

from pathlib import Path
from tqdm import tqdm

import logging

logger = logging.getLogger('dto_info')

def load_series(mpa, timeseries, climate_model: models.ClimateModels, variable: models.TimeseriesVariables,
                timeseries_type=1, depth=None, batch_size=1000):
    """
    Load time series data into the database with batched bulk inserts.

    Parameters:
    mpa: MPA object to associate with the time series data
    timeseries: Pandas DataFrame containing time series data
    climate_model: What climate model to use when saving data
    timeseries_type: 1 = Bottom timeseries, 2 = Surface timeseries
    depth: Depth value (in meters) for the time series, or None for surface data
    variable: ID of the indicator type (default: 1 for temperature)
    batch_size: Number of records to insert in each database batch
    """
    try:
        # Setup tracking variables
        add_time_series = []
        total_rows = len(timeseries)
        rows_processed = 0
        batches_completed = 0

        # Initialize progress bar
        with tqdm(total=total_rows, desc=f"Loading data (depth={depth})") as pbar:
            # Process each row
            for row in timeseries.iterrows():
                try:
                    # Convert value to float or NaN
                    value = float(row[1].iloc[0])
                except ValueError:
                    value = np.nan

                # Create new time series entry
                add_time_series.append(
                    models.Timeseries(
                        zone=mpa,
                        model=climate_model,
                        date_time=row[0],
                        value=value,
                        depth=depth,
                        indicator=variable,
                        type=timeseries_type,
                    )
                )

                rows_processed += 1

                # Batch insert when reaching batch size
                if len(add_time_series) >= batch_size:
                    models.Timeseries.objects.bulk_create(add_time_series)
                    batches_completed += 1
                    pbar.set_postfix(batches=batches_completed)
                    add_time_series = []

                # Update progress bar
                pbar.update(1)

            # Insert any remaining records
            if add_time_series:
                models.Timeseries.objects.bulk_create(add_time_series)
                batches_completed += 1

        print(f"Completed loading {rows_processed} records in {batches_completed} batches")

    except Exception as e:
        print(f"Error loading time series data: {str(e)}")
        raise


def read_timeseries_chunk(mpa, filename, climate_model: models.ClimateModels, variable: models.TimeseriesVariables,
                          timeseries_type=1, date_col='Date', chunksize=100000):
    """
    Read and load time series data from a CSV file with chunking for large files.

    Parameters:
    mpa: MPA object to associate with the time series
    filename: Path to CSV file containing time series data
    climate_model: Model this timeseries is associated with
    variable: Timeseries type e.g Temperature, Salinity, Chlorophyll
    date_col: Column name containing date information
    chunksize: Number of rows to process at once (for large files)
    """
    try:
        file_path = Path(filename)
        logger.info(f"Loading time series from {file_path.name}")

        # Get file size for reporting
        file_size_mb = file_path.stat().st_size / (1024 * 1024)
        logger.info(f"File size: {file_size_mb:.2f} MB")

        # For large files, use chunking
        if file_size_mb > 50:  # Threshold for chunking (50MB)
            logger.info(f"Large file detected, processing in chunks of {chunksize} rows")

            # Process file in chunks with progress bar
            reader = pd.read_csv(filename, chunksize=chunksize)

            # Process each chunk
            for i, chunk in enumerate(tqdm(reader, desc="Processing chunks")):
                chunk = chunk.set_index(date_col)
                load_series(mpa, chunk, climate_model, variable, timeseries_type)

        else:
            # For smaller files, read all at once
            timeseries = pd.read_csv(filename)
            timeseries = timeseries.set_index(date_col)
            logger.info(f"Read {len(timeseries)} time series records")
            load_series(mpa, timeseries, climate_model, variable, timeseries_type)

    except Exception as e:
        logger.info(f"Error reading time series file {filename}: {str(e)}")
        raise


def read_depth_timeseries(mpa_name, filename, climate_model: models.ClimateModels, variable: models.TimeseriesVariables,
                          timeseries_type=1, date_col='Date'):
    """
    Read time series data from a CSV file with multiple columns representing different depths.

    Parameters:
    mpa_name: MPA object to associate with the time series data
    filename: Path to CSV file containing depth time series
    date_col: Column name containing date information
    """
    try:
        # Load the data
        logger.info(f"Reading depth time series from {Path(filename).name}")
        timeseries = pd.read_csv(filename)
        timeseries = timeseries.set_index(date_col)

        # Get total columns for progress tracking
        total_depths = len(timeseries.columns)
        logger.info(f"Found {total_depths} depth columns to process")

        # Process each depth with progress bar
        for col in tqdm(timeseries.columns, desc="Processing depths"):
            try:
                # Extract depth value from column name (e.g., "10 m depth" -> 10)
                depth = int(col.split(' ')[0])

                # Get single-column dataframe for this depth
                depth_timeseries = timeseries[[col]]

                # Load the data for this depth
                load_series(mpa_name, depth_timeseries, climate_model, variable, timeseries_type, depth)

            except (ValueError, IndexError) as e:
                logger.error(f"Error processing column '{col}': {str(e)}")
                continue

    except Exception as e:
        logger.error(f"Error processing file {filename}: {str(e)}")
        raise


def load_mpas_from_array(data: list):
    """
    Load time series data for multiple MPAs from dictionary containing file paths.

    Parameters:
    data (dict): Dictionary with MPA IDs as keys and file paths as values
    """
    logger.info(f"Stage 1: Processing {len(data)} MPAs...")

    # Main progress bar for MPAs
    with tqdm(total=len(data), desc="Loading MPAs") as mpa_pbar:
        for file_dict in data:
            climate_model = file_dict['climate_model']
            variable = file_dict['variable']
            file_path_name = file_dict['file_name']
            file_name = os.path.basename(file_path_name)
            timeseries_type = file_dict['timeseries_type']

            mpa_site_id = file_name.split('_')[0]
            if not mpa_site_id.isdigit():
                continue

            mpa_pbar.set_description(f"Loading MPA {mpa_site_id}")
            try:
                # Update description with current MPA ID

                # Get MPA and clear existing data
                mpa = models.MPAZones.objects.get(pk=mpa_site_id)
            except:
                logger.error(f"MPA {mpa_site_id} not found, skipping")
                continue

            # Stage 2: Process bottom temperature (simpler file)
            logger.info(f"Timeseries Type {timeseries_type}")
            mpa_pbar.set_postfix(file=f"Temperature")
            if 'ts.csv' in file_name:
                mpa.timeseries.filter(model=climate_model, indicator=variable, type=timeseries_type, depth=None).delete()
                read_timeseries_chunk(mpa, file_path_name, climate_model, variable, timeseries_type)
            elif 'vlev_mean.csv' in file_name or 'vlev_mean_GL.csv' in file_name:
                mpa.timeseries.filter(model=climate_model, indicator=variable, type=timeseries_type, depth__gt=0).delete()
                read_depth_timeseries(mpa, file_path_name, climate_model, variable, timeseries_type)
            else:
                logger.error(f"Skipping file: {file_name} (unrecognized pattern)")
                continue

    logger.info("Data loading complete!")


def load_canso100():
    load_model('Canso100', 'CANSO100')

def load_model(model_dir, model_name):

    root_path = Path(f'./scripts/data/model_bottom_conditions_tables/{model_dir}/')
    logger.info(f"Loading {model_name} files")

    files = os.listdir(root_path)
    logger.info(f"Found {len(files)} {model_name} files")

    climate_model = models.ClimateModels.objects.get_or_create(name=model_name, priority=2)[0]

    load_dict = []
    for file_name in files:
        file_path = os.path.join(root_path, file_name)
        if '_stats.csv' in file_name:
            # skipt the stats files.
            continue
        elif '_sbt_' in file_name:
            timeseries_type = 1
            variable = models.TimeseriesVariables.objects.get_or_create(name="Temperature")[0]
        elif '_sst_' in file_name:
            timeseries_type = 2
            variable = models.TimeseriesVariables.objects.get_or_create(name="Temperature")[0]
        elif '_sbs_' in file_name:
            timeseries_type = 1
            variable = models.TimeseriesVariables.objects.get_or_create(name="Salinity")[0]
        elif '_sss_' in file_name:
            timeseries_type = 2
            variable = models.TimeseriesVariables.objects.get_or_create(name="Salinity")[0]
        else:
            logger.error(f"Unrecognized file type: {file_name}")
            return

        load_dict.append(
            {
                'file_name': file_path,
                'climate_model': climate_model,
                'timeseries_type': timeseries_type, # 1 = bottom, 2 = surface
                'variable': variable
            }
        )

    load_mpas_from_array(load_dict)
    climate_model.indicators.filter()
    load_indicators.load_std_anomalies(climate_model)

def load_model_file(model_dir, file_name, model_name):

    root_path = Path(f'./scripts/data/model_bottom_conditions_tables/{model_dir}/')
    logger.info(f"Loading {model_name} files")

    files = os.listdir(root_path)
    logger.info(f"Found {len(files)} {model_name} files")

    climate_model = models.ClimateModels.objects.get_or_create(name=model_name, priority=2)[0]

    load_dict = []
    file_path = os.path.join(root_path, file_name)
    if '_sbt_' in file_name:
        timeseries_type = 1
        variable = models.TimeseriesVariables.objects.get_or_create(name="Temperature")[0]
    elif '_sst_' in file_name:
        timeseries_type = 2
        variable = models.TimeseriesVariables.objects.get_or_create(name="Temperature")[0]
    elif '_sbs_' in file_name:
        timeseries_type = 1
        variable = models.TimeseriesVariables.objects.get_or_create(name="Salinity")[0]
    elif '_sss_' in file_name:
        timeseries_type = 2
        variable = models.TimeseriesVariables.objects.get_or_create(name="Salinity")[0]
    else:
        logger.error(f"Unrecognized file type: {file_name}")
        return

    load_dict.append(
        {
            'file_name': file_path,
            'climate_model': climate_model,
            'timeseries_type': timeseries_type, # 1 = bottom, 2 = surface
            'variable': variable
        }
    )

    load_mpas_from_array(load_dict)
    climate_model.indicators.filter()
    load_indicators.load_std_anomalies(climate_model)


def load_mpas():
    load_model('Canso100_GL_levs', 'Canso100')
    load_model('Canso500_GL_levs', 'Canso500')
    load_model('CIOPSE_GL_levs', 'CIOPSE')
    load_model('Fundy500_GL_levs', 'Fundy500')
    load_model('SJ100_GL_levs', 'SJ100')