
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
            "GLORYS_bottomTtrend.tif",
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
            "GLORYS_meanBottomTemp.tif",
        ]
    },
    {
        "model": "GLORYS",
        "color": "trend",
        "title": 'Mean Thermal Stress',
        "description": 'Number of weeks that the bottom temperature spends above the maximum climatological bottom temperature. Duration of thermal stress was computed for each year and averaged for the period 1993-2024.',
        "label": 'Mean Thermal Stress',
        "units": 'Weeks',
        "precision": 0,
        "citations": [
            'https://doi.org/10.1525/elementa.2024.00001'
        ],
        "rasters": [
            "GLORYS_meanThermalStress.tif",
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
            models.Rasters.objects.create(spatial_set=raster_set, order=(order+1), filename=raster)


def load_rasters():
    models.SpatialRasterSets.objects.all().delete()
    for raster_data in rasters:
        load_raster(raster_data)


if __name__ == '__main__':
    load_rasters()