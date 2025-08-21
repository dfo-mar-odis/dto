from .base import *
from django.conf import settings

# GDAL_LIBRARY_PATH = r'D:\Gov\projects\python\dto_env\Lib\site-packages\osgeo\gdal304.dll'
# GEOS_LIBRARY_PATH = r'D:\Gov\projects\python\dto_env\Lib\site-packages\osgeo\geos_c.dll'
# STATIC_URL = env.str('STATIC_URL', os.getenv('STATIC_URL',  'https://www.bio.gc.ca/dto/staticfiles/'))

if settings.DEBUG:
    print("Debugging")

settings.INSTALLED_APPS.append('django_extensions')