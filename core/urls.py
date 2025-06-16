from django.urls import path

from . import views, models

app_name = 'core'
urlpatterns = [
    # path(f'', views.index, name='map'),
    path('timeseries/', views.get_timeseries, name='timeseries'),
    path('anomaly/', views.get_anomaly, name='anomaly'),
    path('quantiles/', views.get_quantiles, name='quantiles'),
    path('classifications/', views.get_classification_colours, name='get_classification_colours'),
    path('max_date/', views.get_max_date, name='get_max_date'),
    path('get_depths/', views.get_depths, name='get_depths'),
    path('generate_pdf/', views.generate_pdf, name='generate_pdf'),
]