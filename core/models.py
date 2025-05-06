from django.contrib.gis.db import models
from django.utils.translation import gettext as _


class MPAName(models.Model):
    name_e = models.CharField(max_length=254, null=True)
    name_f = models.CharField(max_length=254, null=True)

    def __str__(self) -> str:
        return self.name_e


class MPAZone(models.Model):
    name = models.ForeignKey(MPAName, on_delete=models.CASCADE, related_name='zones')
    url_e = models.CharField(max_length=254, null=True)
    url_f = models.CharField(max_length=254, null=True)
    km2 = models.FloatField(null=True)
    geom = models.MultiPolygonField(srid=102001)

    def __str__(self):
        return f"{self.name.name_e}"


class Indicator(models.Model):
    name = models.CharField(max_length=50, verbose_name=_('Indicator Name'))


class Timeseries(models.Model):
    mpa = models.ForeignKey(MPAName, on_delete=models.CASCADE, related_name='timeseries')
    date_time = models.DateField(verbose_name="Date")
    value = models.FloatField(verbose_name="Value")
    depth = models.IntegerField(verbose_name="Depth", null=True)
    indicator = models.ForeignKey(Indicator, on_delete=models.CASCADE, related_name='timeseries')


class SpeciesGrouping(models.IntegerChoices):
    benthic = 1, "Benthic fish"
    benthopelagic = 2, "Benthopelagic fish"
    benthic_invertebrates = 3, "Benthic Invertebrates"
    cephalopod = 4, "Cephalopod"
    copepod = 5, "Copepod"
    mammal = 6, "Mammal"
    pelagic = 7, "Pelagic fish"
    reptile = 8, "Reptile"

    @classmethod
    def get(cls, value: str):
        return cls.__getitem__(value.lower())

    @classmethod
    def has_value(cls, value: str):
        return cls.__members__.__contains__(value.lower())


class Importance(models.IntegerChoices):
    commercial = 1, "Commercial"
    important_food_source = 2, "Important food source"

    @classmethod
    def get(cls, value: str):
        return cls.__getitem__(value.lower())

    @classmethod
    def has_value(cls, value: str):
        return cls.__members__.__contains__(value.lower())


class SpeciesStatus(models.IntegerChoices):
    extinct = 1, "Extinct"
    extinct_in_the_wild = 2, "Extinct in the Wild"
    critically_endangered = 3, "Critically Endangered"
    endangered = 4, "Endangered"
    vulnerable = 5, "Vulnerable"
    near_threatened = 6, "Near Threatened"
    least_concern = 7, "Least Concern"
    data_deficient = 8, "Data Deficient"
    not_evaluated = 9, "Not Evaluated"

    @classmethod
    def get(cls, value: str):
        if cls.has_value(value):
            return cls.__getitem__(value.lower())

        return cls.__getitem__('not_evaluated')

    @classmethod
    def has_value(cls, value: str):
        return cls.__members__.__contains__(value.lower())


class Species(models.Model):
    name = models.CharField(max_length=50, verbose_name=_("Common Name"))
    scientific_name = models.CharField(max_length=100, unique=True, verbose_name=_("Scientific Name"))

    grouping = models.IntegerField(choices=SpeciesGrouping.choices, null=True, blank=True, verbose_name="Grouping")
    importance = models.IntegerField(choices=Importance.choices, null=True, blank=True, verbose_name=_("Importance"))
    status = models.IntegerField(choices=SpeciesStatus.choices, default=9, verbose_name=_("Status"))

    lower_temperature = models.FloatField(verbose_name=_("Lower Temperature"))
    upper_temperature = models.FloatField(verbose_name=_("Upper Temperature"))
    lower_depth = models.FloatField(verbose_name=_("Lower Depth"))
    upper_depth = models.FloatField(verbose_name=_("Upper Depth"))
