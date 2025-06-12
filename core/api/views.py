# core/api.py
from rest_framework import viewsets
from core.api.serializers import MPAZonesSerializer
from core import models
from django.db.models import Exists, OuterRef

class MPAZonesViewSet(viewsets.ModelViewSet):
    queryset = models.MPAZones.objects.all()
    serializer_class = MPAZonesSerializer


class MPAZonesWithTimeseriesViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet that only returns MPAZones that have Timeseries data"""
    serializer_class = MPAZonesSerializer

    def get_queryset(self):
        mpa_ids = models.Timeseries.objects.values_list('mpa__pk', flat=True).distinct()
        # Filter MPAZones that have at least one related Timeseries entry
        return models.MPAZones.objects.filter(
            pk__in=mpa_ids
        ).order_by('-km2')
