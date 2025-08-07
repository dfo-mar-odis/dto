import os
import re
import pandas as pd
import numpy as np

from core import models

from pathlib import Path
from tqdm import tqdm


def load_series(mpa, timeseries, climate_model_id=1, depth=None, indicator=1, batch_size=1000):
    """
    Load time series data into the database with batched bulk inserts.

    Parameters:
    mpa: MPA object to associate with the time series data
    timeseries: Pandas DataFrame containing time series data
    depth: Depth value (in meters) for the time series, or None for surface data
    Indicators: ID of the indicator type (default: 1 for temperature)
    batch_size: Number of records to insert in each database batch
    """
    try:
        # Get indicator object once outside the loop
        timeseries_indicator = models.Indicators.objects.get(pk=indicator)
        timeseries_model = models.ClimateModels.objects.get(pk=climate_model_id)

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
                        mpa=mpa,
                        model=timeseries_model,
                        date_time=row[0],
                        value=value,
                        depth=depth,
                        indicator=timeseries_indicator
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


def read_timeseries(mpa, filename, climate_model_id=1, date_col='Date', chunksize=100000):
    """
    Read and load time series data from a CSV file with chunking for large files.

    Parameters:
    mpa: MPA object to associate with the time series
    filename: Path to CSV file containing time series data
    date_col: Column name containing date information
    chunksize: Number of rows to process at once (for large files)
    """
    try:
        file_path = Path(filename)
        print(f"Loading time series from {file_path.name}")

        # Get file size for reporting
        file_size_mb = file_path.stat().st_size / (1024 * 1024)
        print(f"File size: {file_size_mb:.2f} MB")

        # For large files, use chunking
        if file_size_mb > 50:  # Threshold for chunking (50MB)
            print(f"Large file detected, processing in chunks of {chunksize} rows")

            # Process file in chunks with progress bar
            reader = pd.read_csv(filename, chunksize=chunksize)

            # Process each chunk
            for i, chunk in enumerate(tqdm(reader, desc="Processing chunks")):
                chunk = chunk.set_index(date_col)
                load_series(mpa, chunk, climate_model_id)

        else:
            # For smaller files, read all at once
            timeseries = pd.read_csv(filename)
            timeseries = timeseries.set_index(date_col)
            print(f"Read {len(timeseries)} time series records")
            load_series(mpa, timeseries, climate_model_id)

    except Exception as e:
        print(f"Error reading time series file {filename}: {str(e)}")
        raise


def read_depth_timeseries(mpa_name, filename, climate_model_id=1, date_col='Date'):
    """
    Read time series data from a CSV file with multiple columns representing different depths.

    Parameters:
    mpa_name: MPA object to associate with the time series data
    filename: Path to CSV file containing depth time series
    date_col: Column name containing date information
    """
    try:
        # Load the data
        print(f"Reading depth time series from {Path(filename).name}")
        timeseries = pd.read_csv(filename)
        timeseries = timeseries.set_index(date_col)

        # Get total columns for progress tracking
        total_depths = len(timeseries.columns)
        print(f"Found {total_depths} depth columns to process")

        # Process each depth with progress bar
        for col in tqdm(timeseries.columns, desc="Processing depths"):
            try:
                # Extract depth value from column name (e.g., "10 m depth" -> 10)
                depth = int(col.split(' ')[0])

                # Get single-column dataframe for this depth
                depth_timeseries = timeseries[[col]]

                # Load the data for this depth
                load_series(mpa_name, depth_timeseries, climate_model_id, depth)

            except (ValueError, IndexError) as e:
                print(f"Error processing column '{col}': {str(e)}")
                continue

    except Exception as e:
        print(f"Error processing file {filename}: {str(e)}")
        raise


def load_mpas_from_dict(data: dict, climate_model_id=1):
    """
    Load time series data for multiple MPAs from dictionary containing file paths.

    Parameters:
    data (dict): Dictionary with MPA IDs as keys and file paths as values
    """
    print(f"Stage 1: Processing {len(data)} MPAs...")

    # Main progress bar for MPAs
    with tqdm(total=len(data), desc="Loading MPAs") as mpa_pbar:
        for mpa_id, mpa_dict in data.items():
            try:
                # Update description with current MPA ID
                mpa_pbar.set_description(f"Loading MPA {mpa_id}")

                # Get MPA and clear existing data
                mpa = models.MPAZones.objects.get(pk=mpa_id)
                mpa.timeseries.all().delete()

                # Stage 2: Process bottom temperature (simpler file)
                mpa_pbar.set_postfix(file="Bottom temperature")
                bottom_ts = mpa_dict.get('BOTTOM_TS')
                if bottom_ts:
                    read_timeseries(mpa, bottom_ts)

                # Stage 3: Process depth temperature (more complex file with multiple depths)
                mpa_pbar.set_postfix(file="Depth temperature")
                depth_ts = mpa_dict.get('DEPTH_TS')
                if depth_ts:
                    read_depth_timeseries(mpa, depth_ts, climate_model_id)

                mpa_pbar.update(1)

            except models.MPAZones.DoesNotExist:
                print(f"Warning: MPA with ID {mpa_id} not found in database")
            except Exception as e:
                print(f"Error processing MPA {mpa_id}: {str(e)}")

    print("Data loading complete!")


def build_mpa_dictionary(data_directory) -> dict:
    """
    Build a dictionary mapping MPA IDs to their associated temperature time series files.
    Returns a dictionary where keys are MPA IDs and values contain paths to depth and bottom temperature files.
    """
    data = {}
    id_regex = re.compile(r'.*?_(\d*)_.*?\.csv')

    # Stage 1: Scan directory for files
    print("Stage 1: Scanning directory...")
    all_files = list(data_directory.glob('*.csv'))
    total_files = len(all_files)
    print(f"Found {total_files} files to process")

    # Stage 2: Process and organize files
    print("Stage 2: Processing files...")
    for file_path in tqdm(all_files, desc="Organizing MPA files"):
        file_name = file_path.name

        # Skip files that don't match our naming patterns
        if not (file_name.startswith('depth_avebottomT_') or file_name.startswith('avebottomT_')):
            continue

        # Extract MPA ID from filename
        match = id_regex.match(file_name)
        if not match:
            continue

        mpa_id = int(match.group(1))

        # Initialize dict entry if this is the first file for this MPA
        if mpa_id not in data:
            data[mpa_id] = {}

        # Classify file type and add to appropriate category
        if file_name.startswith('depth_avebottomT_'):
            data[mpa_id]['DEPTH_TS'] = str(file_path)
        elif file_name.startswith('avebottomT_'):
            data[mpa_id]['BOTTOM_TS'] = str(file_path)

    print(f"Completed! Found data for {len(data)} MPAs")
    return data

def load_mpas():

    data_directory = Path('./scripts/data/GLORYS/')
    glorys_data = build_mpa_dictionary(data_directory)
    load_mpas_from_dict(glorys_data, climate_model_id=1)