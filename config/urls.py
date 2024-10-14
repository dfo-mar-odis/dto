"""
URL configuration for digital_twin_ocean project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf.urls.static import static
from django.conf import settings
from django.urls import path

from core import views

urlpatterns = [
    path(f'{settings.PROXY_URL}', views.index, name='map'),
    path(f'{settings.PROXY_URL}timeseries/', views.get_timeseries, name='timeseries'),
    path(f'{settings.PROXY_URL}quantiles/', views.get_quantiles, name='quantiles'),
    path(f'{settings.PROXY_URL}species_range/<int:species_id>/', views.get_species_range, name='species_range'),
    path(f'{settings.PROXY_URL}range_chart/', views.get_range_chart, name='range_chart'),
    path(f'{settings.PROXY_URL}quantile_chart/', views.get_quantile_chart, name='quantile_chart'),
    path(f'{settings.PROXY_URL}generate_pdf/', views.generate_pdf, name='generate_pdf'),
    path(f'{settings.PROXY_URL}get_depths/', views.get_depths, name='get_depths'),

] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
