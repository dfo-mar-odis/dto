
from core import models

rasters = [
    {
        "model": "GLORYS",
        "color": "trend",
        "title": 'Bottom Temperature Trend',
        "description": 'Significant trend for the bottom temperature from GLORYS model for period 1993-2024, expressed in degrees Celsius per decade.',
        "label": 'Trend',
        "units": '°C/decade',
        "precision": 2,
        "rasters": [
            {
                "label": "1993-2024",
                "file_name": "GLORYS_bottomTtrend.tif",
            }
        ]
    },
    {
        "model": "GLORYS",
        "color": "viridis",
        "title": 'Mean Bottom Temperature',
        "description": 'Average of the bottom temperature from GLORYS model for period 1993-2024.',
        "label": 'Mean Bottom Temp.',
        "units": '°C',
        "precision": 2,
        "rasters": [
            {
                "label": "Jan",
                "file_name": "01_ScotianShelf_GLORYS_Jan_avearge_1993-2024.tif",
            },
            {
                "label": "Feb",
                "file_name": "02_ScotianShelf_GLORYS_Feb_avearge_1993-2024.tif",
            },
            {
                "label": "Mar",
                "file_name": "03_ScotianShelf_GLORYS_Mar_avearge_1993-2024.tif",
            },
            {
                "label": "Apr",
                "file_name": "04_ScotianShelf_GLORYS_Apr_avearge_1993-2024.tif",
            },
            {
                "label": "May",
                "file_name": "05_ScotianShelf_GLORYS_May_avearge_1993-2024.tif",
            },
            {
                "label": "Jun",
                "file_name": "06_ScotianShelf_GLORYS_Jun_avearge_1993-2024.tif",
            },
            {
                "label": "Jul",
                "file_name": "07_ScotianShelf_GLORYS_Jul_avearge_1993-2024.tif",
            },
            {
                "label": "Aug",
                "file_name": "08_ScotianShelf_GLORYS_Aug_avearge_1993-2024.tif",
            },
            {
                "label": "Sep",
                "file_name": "09_ScotianShelf_GLORYS_Sep_avearge_1993-2024.tif",
            },
            {
                "label": "Oct",
                "file_name": "10_ScotianShelf_GLORYS_Oct_avearge_1993-2024.tif",
            },
            {
                "label": "Nov",
                "file_name": "11_ScotianShelf_GLORYS_Nov_avearge_1993-2024.tif",
            },
            {
                "label": "Dec",
                "file_name": "12_ScotianShelf_GLORYS_Dec_avearge_1993-2024.tif",
            },
        ]
    },
    {
        "model": "GLORYS",
        "color": "trend",
        "title": 'Duration of thermal stress',
        "description": 'Number of weeks that the bottom temperature spends above the maximum climatological bottom temperature. Duration of thermal stress was computed for each year and averaged for the period 1993-2024.',
        "label": 'Duration of thermal stress',
        "units": 'Weeks',
        "precision": 0,
        "citations": [
            'https://doi.org/10.1525/elementa.2024.00001'
        ],
        "rasters": [
            {
                "label": "1993-2024",
                "file_name": "GLORYS_meanThermalStress.tif",
            }
        ]
    },
    {
        "model": "GLORYS",
        "color": "viridis",
        "title": 'Change in the onset of spring',
        "description": 'Change in the arrival time (in weeks) of a particular sea surface temperature (SST) associated with onset of spring, average for the period 1993-2024. Computation is based on the arrival time of a climatological mean SST for the month of April using a 4th-order low-pass 90d Butterworth filtered time series to remove high-frequency variability (e.g. transient warm eddies). Positive values indicate later arrival of spring.',
        "label": 'Onset of spring',
        "units": 'Weeks',
        "precision": 0,
        "citations": [
            'https://doi.org/10.1525/elementa.2024.00001'
        ],
        "rasters": [
            {
                "label": "1993-2024",
                "file_name": "GLORYS_spring_anomaly_mean_GL.tif",
            }
        ]
    },
    {
        "model": "GLORYS",
        "color": "viridis",
        "title": 'Length of the growing season',
        "description": 'Average length of the growing season or length of summer in weeks for the period 1993-2024. Computation is based on the time between the arrival times of climatological mean sea surface temperatures (SST) for the months of April and October using a 4th-order low-pass 90d Butterworth filtered time series to remove high-frequency variability (e.g. transient warm eddies).',
        "label": 'Growing season',
        "units": 'Weeks',
        "precision": 0,
        "citations": [
            'https://doi.org/10.1525/elementa.2024.00001'
        ],
        "rasters": [
            {
                "label": "1993-2024",
                "file_name": "GLORYS_growingseason_mean_GL.tif",
            }
        ]
    },
]

def load_raster(raster_data: dict) -> None:
    model = models.ClimateModels.objects.get(name__iexact=raster_data['model'])

    color = models.ColorRamps.objects.get_or_create(name=raster_data['color'])[0]
    raster_set = models.SpatialRasterSets(model=model, color=color)
    raster_set.title = raster_data['title']
    raster_set.label = raster_data['label']
    raster_set.description = raster_data['description']
    raster_set.precision = int(raster_data['precision'])
    raster_set.units = raster_data['units']
    raster_set.save()

    if citations:=raster_data.get("citations", None):
        for citation in citations:
            models.SpatialReferences.objects.create(spatial_set=raster_set, citation=citation)

    if rasters:=raster_data.get('rasters', None):
        for order, raster in enumerate(rasters):
            models.Rasters.objects.create(spatial_set=raster_set, order=(order+1), label=raster['label'], file_name=raster['file_name'])


def load_rasters():
    models.SpatialRasterSets.objects.all().delete()
    for raster_data in rasters:
        load_raster(raster_data)


if __name__ == '__main__':
    load_rasters()