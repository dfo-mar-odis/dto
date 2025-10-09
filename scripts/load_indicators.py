import math
import os
import re
import pandas as pd
import numpy as np

from core import models

from pathlib import Path
from tqdm import tqdm


def load_onset_of_spring(mpa, data, climate_model, batch_size=1000):
    """
    Load onset of spring data into the database with batched bulk inserts.

    Parameters:
    mpa: MPA object to associate with the time series data
    data: Pandas DataFrame containing onset of spring data
    climate_model: What climate model to use when saving data
    batch_size: Number of records to insert in each database batch
    """
    try:
        # Setup tracking variables
        add_data = []
        total_rows = len(data)
        rows_processed = 0
        batches_completed = 0
        unit = "Onset of Spring Anomalies (weeks)"

        indicator_category = models.IndicatorCategories.objects.get_or_create(name="Unknown")[0]
        indicator_type = models.IndicatorTypes.objects.get_or_create(name="Anomaly in Onset of Spring (weeks)", unit=unit, category=indicator_category)[0]
        models.IndicatorWeights.objects.get_or_create(type=indicator_type, zone=mpa)
        indicator_type.indicators.filter(zone=mpa).delete()

        # Initialize progress bar
        with tqdm(total=total_rows, desc=f"Loading data ({indicator_type.name})") as pbar:
            # Process each row
            for row in data.iterrows():
                try:
                    # Convert value to float or NaN
                    value = float(row[1].iloc[0])
                except ValueError:
                    value = np.nan

                # Create new time series entry
                add_data.append(
                    models.Indicators(
                        zone=mpa,
                        type=indicator_type,
                        model=climate_model,
                        year=row[0],
                        value=value,
                    )
                )

                rows_processed += 1

                # Batch insert when reaching batch size
                if len(add_data) >= batch_size:
                    models.Indicators.objects.bulk_create(add_data)
                    batches_completed += 1
                    pbar.set_postfix(batches=batches_completed)
                    add_data = []

                # Update progress bar
                pbar.update(1)

            # Insert any remaining records
            if add_data:
                models.Indicators.objects.bulk_create(add_data)
                batches_completed += 1

        print(f"Completed loading {rows_processed} records in {batches_completed} batches")

    except Exception as e:
        print(f"Error loading onset of spring data: {str(e)}")
        raise


def read_onset_of_spring(mpa, filename, climate_model, date_col='Date', chunksize=100000):
    """
    Read and load onset of spring data from a CSV file with chunking for large files.

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
                load_onset_of_spring(mpa, chunk, climate_model)

        else:
            # For smaller files, read all at once
            timeseries = pd.read_csv(filename)
            timeseries = timeseries.set_index(date_col)
            print(f"Read {len(timeseries)} timeseries records")
            load_onset_of_spring(mpa, timeseries, climate_model)

    except Exception as e:
        print(f"Error reading time series file {filename}: {str(e)}")
        raise

def load_mpas_from_dict(data: dict, climate_model):
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

                # Stage 1: Process Onset Of Spring
                mpa_pbar.set_postfix(file="Onset of Spring Anomalies")
                spring_anom = mpa_dict.get('ONSET_OF_SPRING')
                if spring_anom:
                    read_onset_of_spring(mpa, spring_anom, climate_model)

                mpa_pbar.update(1)

            except models.MPAZones.DoesNotExist:
                print(f"Warning: MPA with ID {mpa_id} not found in database")
            except Exception as e:
                print(f"Error processing MPA {mpa_id}: {str(e)}")

    print("Data loading complete!")


def build_surface_mpa_dictionary(data_directory) -> dict:
    """
    Build a dictionary mapping MPA IDs to their associated temperature time series files.
    Returns a dictionary where keys are MPA IDs and values contain paths to depth and bottom temperature files.
    """
    data = {}
    id_regex = re.compile(r'.*?_(\d*)_.*?\.csv')

    # Stage 1: Scan directory for files
    print("Stage 1: Scanning directory...")
    all_files = [file for file in data_directory.glob('*.csv') if file.name.startswith('aveonsetspring_') ]
    total_files = len(all_files)
    print(f"Found {total_files} files to process")

    # Stage 2: Process and organize files
    print("Stage 2: Processing files...")
    for file_path in tqdm(all_files, desc="Organizing MPA files"):
        file_name = file_path.name

        # Skip files that don't match our naming patterns
        if not file_name.startswith('aveonsetspring_'):
            continue

        # Extract MPA ID from filename
        match = id_regex.match(file_name)
        if not match:
            continue

        mpa_id = int(match.group(1))

        # Initialize dict entry if this is the first file for this MPA
        if mpa_id not in data:
            data[mpa_id] = {}

        data[mpa_id]['TYPE'] = 2
        # Classify file type and add to appropriate category
        if file_name.startswith('aveonsetspring_'):
            data[mpa_id]['ONSET_OF_SPRING'] = str(file_path)

    print(f"Completed! Found data for {len(data)} MPAs")
    return data


def load_std_anomaly(indicator_type, climate_model, zone, timeseries_type):
    """
    Load standardized anomaly data into the database for a specific indicator type, climate model, zone, and timeseries type.

    Parameters:
    indicator_type: The variable this timeseries tracks (e.g., 'Temperature', 'Salinity').
    climate_model: The model the timeseries is based on (e.g., 'GLORYS', 'Canso100', 'CIOPS').
    zone: The MPA (Marine Protected Area) the anomaly is being generated for.
    timeseries_type: The type of timeseries data (1 = Bottom, 2 = Surface).
    """

    indicator_type.indicators.filter(zone=zone, model=climate_model).delete()

    mpa_timeseries = zone.timeseries.filter(model=climate_model, indicator=1, type=timeseries_type, depth=None).order_by('date_time')

    if not mpa_timeseries.exists():
        return

    df = pd.DataFrame(list(mpa_timeseries.values('date_time', 'depth', 'value')))
    df['date_time'] = pd.to_datetime(df['date_time'])
    df.set_index('date_time', inplace=True)

    # Step 1: Calculate annual mean temperatures for each year
    df['year'] = df.index.year
    annual_means = df.groupby('year')['value'].mean()

    # Step 2: Calculate annual climatology (mean of annual means from 1993 to 2021)
    climatology_years = annual_means.iloc[:30]
    climatology_mean = climatology_years.mean()

    # Step 3: Calculate standard deviation for climatology (std deviation of the 30 years)
    climatology_std = climatology_years.std()

    # Step 4: Annual standardized anomaly
    anomaly = (annual_means - climatology_mean) / climatology_std

    data = {
        'dates': [str(year) for year in anomaly.index],
        'values': anomaly.values.tolist()
    }

    add_data = []
    rows_processed = 0
    batches_completed = 0
    total_rows = len(anomaly)
    batch_size = 1000

    with tqdm(total=total_rows, desc=f"Loading data ({indicator_type.name})") as pbar:
        # Process each row
        for year, val in zip(data['dates'], data['values']):
            try:
                # Convert value to float or NaN
                value = float(val)
            except ValueError:
                value = np.nan

            # Create new time series entry
            add_data.append(
                models.Indicators(
                    zone=zone,
                    type=indicator_type,
                    model=climate_model,
                    year=year,
                    value=value,
                )
            )

            rows_processed += 1

            # Batch insert when reaching batch size
            if len(add_data) >= batch_size:
                models.Indicators.objects.bulk_create(add_data)
                batches_completed += 1
                pbar.set_postfix(batches=batches_completed)
                add_data = []

            # Update progress bar
            pbar.update(1)

        # Insert any remaining records
        if add_data:
            models.Indicators.objects.bulk_create(add_data)
            batches_completed += 1


def load_std_anomalies(climate_model: models.ClimateModels, batch_limit=10):
    # for each Model, for each Zone, for each year, for each timeseries type (surface, bottom)
    # compute a standardized anomaly and store it in the Indicators table
    #
    # we won't be computing a std. anomaly for each depth. Just the general surface and the total average bottom
    indicator_category = models.IndicatorCategories.objects.get_or_create(name="Unknown")[0]

    types = [1, 2] # 1 is Bottom, 2 is surface

    unit = 'Standardized Anomalies (σ)'
    zone_ids = climate_model.timeseries.values_list('zone__site_id', flat=True).distinct()
    zones_total = models.MPAZones.objects.filter(site_id__in=zone_ids)
    total = zones_total.count()
    batches = math.ceil(float(total / batch_limit))
    print(str(batches))
    with tqdm(total=total, desc=f"Loading data ({climate_model.name})") as pbar:
        for batch in range(batches):
            zones = zones_total[batch_limit * batch: batch_limit * batch + batch_limit]
            for zone in zones:
                for timeseries_type in types:
                    name = ("Total Average Bottom" if timeseries_type == 1 else "Surface") + " Standardized Temperature Anomaly"
                    std_anom_indicator = \
                    models.IndicatorTypes.objects.get_or_create(name=name, unit=unit, category=indicator_category)[0]
                    models.IndicatorWeights.objects.get_or_create(type=std_anom_indicator, zone=zone)
                    load_std_anomaly(std_anom_indicator, climate_model, zone, timeseries_type)
            pbar.update(len(zones))
    print(f"Data Transfer Completed!")


def load_ciopse():
    cm = models.ClimateModels.objects.get(name__iexact='ciopse')
    load_std_anomalies(cm, 4)


def load_onset():
    model = models.ClimateModels.objects.get_or_create(name="GLORYS", priority=1)
    data_directory = Path('./scripts/data/GLORYS_surface/')
    glorys_data = build_surface_mpa_dictionary(data_directory)
    load_mpas_from_dict(glorys_data, climate_model=model[0])

def load_mpas():
    load_std_anomalies()
    load_onset()
