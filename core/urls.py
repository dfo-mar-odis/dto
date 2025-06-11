from django.urls import path

from . import views, models

app_name = 'core'
urlpatterns = [
    # path(f'', views.index, name='map'),
    path('timeseries/', views.get_timeseries, name='timeseries'),
    path('anomaly/', views.get_anomaly, name='anomaly'),
    path('quantiles/', views.get_quantiles, name='quantiles'),
    path('species_range/', views.get_species_range, name='species_range'),
    path('species_range/<int:species_id>/', views.get_species_range, name='species_range'),
    path('standard_anomalies_chart/', views.get_standard_anomalies_chart, name='stda_chart'),
    path('range_chart/', views.get_range_chart, name='range_chart'),
    path('quantile_chart/', views.get_quantile_chart, name='quantile_chart'),
    path('generate_pdf/', views.generate_pdf, name='generate_pdf'),
    path('get_depths/', views.get_depths, name='get_depths'),

    path('mpa_polygons/', views.get_polygons, name='get_polygons'),
    path('indicators/', views.indicators, name='get_indicators'),
]