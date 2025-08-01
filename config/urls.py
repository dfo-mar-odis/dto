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
import importlib.util

from django.conf.urls.i18n import i18n_patterns
from django.conf.urls.static import static

from django.conf import settings
from django.urls import path, include

from core import views
from core.api.urls import router


# {settings.PROXY_URL}

urlpatterns = [
    path('api/v1/', include((router.urls, 'api'), namespace='api')),
    path(f'language/', views.set_language, name='set_language'),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Localized URLs (user-facing pages)
urlpatterns += i18n_patterns(
    path('', views.index, name='index'),
    path('', include('core.urls')),
)