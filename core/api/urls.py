from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    MPAZonesViewSet,
    MPAZonesWithTimeseriesViewSet,
    SpeciesViewSet,
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
router.register(r'network-indicators', NetworkIndicatorsViewSet, basename='network-indicators')
router.register(r'mpas-with-timeseries', MPAZonesWithTimeseriesViewSet, basename='mpas-with-timeseries')

api_urlpatterns = router.urls + [
    path('selected-date-data/', SelectedDateDataView.as_view(), name='selected-date-data'),
    path('timeseries-data/', TimeseriesDataView.as_view(), name='timeseries-data'),
    path('quantile-data/', QuantileDataView.as_view(), name='quantile-data'),
]

urlpatterns = [
    path('api/v1/', include((api_urlpatterns, 'api'), namespace='api')),
]