import os
import re
import pandas as pd

from core import models
from tqdm import tqdm

# dataframe example:
# --------------------------------------------------------------------
# | date | 66 m T | 66 m std(T) | 66 m | 78 m T | 78 m std(T) | 78 m | etc...
# --------------------------------------------------------------------
def load_observations(zone: models.MPAZones, indicator: models.Indicators, dataframe: pd.DataFrame):
    # Find all depths from column names (e.g., '66 m T')
    depth_pattern = re.compile(r"(\d+)\s*m\s*T")
    depths = []
    for col in dataframe.columns:
        match = depth_pattern.match(col)
        if match:
            depths.append(int(match.group(1)))

    zone.observations.all().delete()

    for _, row in tqdm(dataframe.iterrows(), desc=f"Loading {zone.name_e} observations"):
        date = row['Date']
        for depth in depths:
            value = row.get(f"{depth} m T")
            std = row.get(f"{depth} m std(T)")
            count = row.get(f"{depth} m N")
            if pd.notnull(value) and pd.notnull(std) and count > 0:
                models.Observations.objects.create(
                    zone=zone,
                    indicator=indicator,
                    date_time=date,
                    depth=depth,
                    value=value,
                    std=std,
                    count=int(count)
                )


def load_mpa():
    data_dir = os.path.join("scripts", "data", "MPA_Observations")
    files = [f for f in os.listdir(data_dir) if os.path.isfile(os.path.join(data_dir, f))]

    temp_indicator = models.Indicators.objects.get(id=1)  # for now we're only loading temperature data

    for file_name in tqdm(files, desc=f"Loading files"):
        if not (site_id_str:=file_name.split('_')[0]).isdigit():
            continue

        mpa_id = int(site_id_str)
        mpa = models.MPAZones.objects.get(site_id=mpa_id)

        file = os.path.join(data_dir, file_name)
        temp_dataframe = pd.read_csv(file)
        load_observations(mpa, temp_indicator, temp_dataframe)


if __name__ == "__main__":
    load_mpa()