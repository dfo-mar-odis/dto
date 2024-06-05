from django.contrib.gis.db import models
from django.db.models import Avg


# Create your models here.
class StationLookup(models.Model):
    name = models.CharField(max_length=10, unique=True)

    def __str__(self) -> str:
        return self.name

class Station(models.Model):
    station = models.ForeignKey(StationLookup, on_delete=models.CASCADE, related_name='stations')
    number = models.CharField(max_length=10, null=False, blank=False)
    position = models.PointField(srid=4326, null=False, blank=False)

    def __str__(self) -> str:
        return f'{self.station.name}_{self.number} - [{self.position}]'


class MPAName(models.Model):
    name_e = models.CharField(max_length=254, null=True)
    name_f = models.CharField(max_length=254, null=True)


class MPAZone(models.Model):
    name = models.ForeignKey(MPAName, on_delete=models.CASCADE, related_name='zones')
    zone_e = models.CharField(max_length=254, null=True)
    zone_f = models.CharField(max_length=254, null=True)
    url_e = models.CharField(max_length=254, null=True)
    url_f = models.CharField(max_length=254, null=True)
    regulation = models.CharField(max_length=254, null=True)
    reglement = models.CharField(max_length=254, null=True)
    km2 = models.FloatField(null=True)
    geom = models.MultiPolygonField(srid=102001)

    def __str__(self):
        return f"{self.name.name_e} - {self.zone_e}"


class Timeseries(models.Model):
    mpa = models.ForeignKey(MPAName, on_delete=models.CASCADE, related_name='timeseries')
    date_time = models.DateField(verbose_name="Date")
    temperature = models.FloatField(verbose_name="Temperature")
    climatology = models.FloatField(verbose_name="Climatology")
