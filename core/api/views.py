# core/api.py
from rest_framework import viewsets
from rest_framework.response import Response
from core.api.serializers import MPAZonesSerializer, SpeciesSerializer
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


class SpeciesViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet that returns all species with their temperature ranges"""
    queryset = models.Species.objects.all().order_by('name')
    serializer_class = SpeciesSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        return queryset

    def list(self, request, *args, **kwargs):
        # Check for a parameter that explicitly requests all records
        if request.query_params.get('all') == 'true':
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        return super().list(request, *args, **kwargs)