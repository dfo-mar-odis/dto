from django.contrib.gis.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils.translation import gettext as _


class Classifications(models.Model):
    name_e = models.CharField(max_length=50, verbose_name=_('Classification Name (English)'))
    name_f = models.CharField(max_length=50, verbose_name=_('Classification Name (French)'))
    colour = models.CharField(max_length=10, blank=True, null=True, verbose_name=_('Classification Colour'))

    def __str__(self):
        return f"{self.name_e}"

class MPAZones(models.Model):
    site_id = models.IntegerField(primary_key=True)
    name_e = models.CharField(max_length=254, null=True)
    name_f = models.CharField(max_length=254, null=True)
    url_e = models.CharField(max_length=254, null=True)
    url_f = models.CharField(max_length=254, null=True)
    km2 = models.FloatField(null=True)
    classification = models.ForeignKey(Classifications, on_delete=models.PROTECT, null=True)
    geom = models.MultiPolygonField()
    serialized_representation = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"{self.name_e}"


class TimeseriesVariables(models.Model):
    name = models.CharField(max_length=50, verbose_name=_('Indicator Name'))


class ClimateModels(models.Model):
    name = models.CharField(max_length=50, verbose_name=_('Model Name'))
    priority = models.IntegerField(default=0)


class Timeseries(models.Model):
    TIMESERIES_TYPES = (
        (1, 'BOTTOM'),
        (2, 'SURFACE')
    )
    model = models.ForeignKey(ClimateModels, on_delete=models.CASCADE, related_name='timeseries')
    zone = models.ForeignKey(MPAZones, on_delete=models.CASCADE, related_name='timeseries')
    type = models.IntegerField(choices=TIMESERIES_TYPES, default=1)
    indicator = models.ForeignKey(TimeseriesVariables, on_delete=models.CASCADE, related_name='timeseries')
    date_time = models.DateField(verbose_name="Date")
    depth = models.IntegerField(verbose_name="Depth", null=True)  # if null this is a total average bottom timeseries
    value = models.FloatField(verbose_name="Value")


class Observations(models.Model):
    zone = models.ForeignKey(MPAZones, on_delete=models.CASCADE, related_name='observations')
    indicator = models.ForeignKey(TimeseriesVariables, on_delete=models.CASCADE, related_name='observations')
    date_time = models.DateField(verbose_name="Date")
    depth = models.IntegerField(verbose_name="Depth")
    value = models.FloatField(verbose_name="Value")
    count = models.IntegerField(verbose_name="Count", help_text=_('Number of observations recorded at a depth for a specific date and location'))
    std = models.FloatField(verbose_name="Standard Deviation")


class IndicatorCategories(models.Model):
    name = models.CharField(max_length=50, verbose_name=_('Indicator Category'))
    description = models.CharField(max_length=150, verbose_name=_('Description'))


class IndicatorTypes(models.Model):
    name = models.CharField(max_length=80, verbose_name=_('Indicator Type'))
    description = models.CharField(max_length=150, verbose_name=_('Description'))
    category = models.ForeignKey(IndicatorCategories, on_delete=models.CASCADE, related_name='indicator_types')
    unit = models.CharField(max_length=45, verbose_name=_('Indicator Unit'))


class IndicatorWeights(models.Model):
    weight = models.IntegerField(verbose_name=_('Indicator Weight'), default=1)
    type = models.ForeignKey(IndicatorTypes, on_delete=models.CASCADE, related_name='indicator_weights')
    zone = models.ForeignKey(MPAZones, on_delete=models.CASCADE, related_name='indicator_weights')


class Indicators(models.Model):
    zone = models.ForeignKey(MPAZones, on_delete=models.CASCADE, related_name='indicators')
    type = models.ForeignKey(IndicatorTypes, on_delete=models.CASCADE, related_name='indicators')
    model = models.ForeignKey(ClimateModels, on_delete=models.CASCADE, related_name='indicators')
    year = models.IntegerField(
        validators=[MinValueValidator(1000), MaxValueValidator(9999)],
        verbose_name=_("Year")
    )
    value = models.FloatField(verbose_name="Value")

    def __str__(self):
        return f"{self.model.name} : {self.zone.site_id} - {self.zone.name_e} : {self.type.name} : {self.value}"


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
