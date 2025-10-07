from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    MPAZonesViewSet,
    AOIListView,
    MPAZonesWithTimeseriesViewSet,
    SpeciesViewSet,
    HeatWaveIndicatorsViewSet,
    NetworkIndicatorsViewSet,
    SelectedDateDataView,
    TimeseriesDataView,
    QuantileDataView
)
from .. import api

app_name = "api"

router = DefaultRouter()
router.register(r'mpas', MPAZonesViewSet)
router.register(r'species', SpeciesViewSet, basename='species')
router.register(r'heat-wave-indicators', HeatWaveIndicatorsViewSet, basename='heat-wave-indicators')
router.register(r'network-indicator', NetworkIndicatorsViewSet, basename='network-indicator')
router.register(r'mpas-with-timeseries', MPAZonesWithTimeseriesViewSet, basename='mpas-with-timeseries')

api_urlpatterns = router.urls + [
    path('selected-date-data/', SelectedDateDataView.as_view(), name='selected-date-data'),
    path('timeseries-data/', TimeseriesDataView.as_view(), name='timeseries-data'),
    path('quantile-data/', QuantileDataView.as_view(), name='quantile-data'),
    path('climate-aois/', AOIListView.as_view(), name='climate-aois'),
]

urlpatterns = [
    path('api/v1/', include((api_urlpatterns, 'api'), namespace='api')),
]