from .base import *
from django.conf import settings

# GDAL_LIBRARY_PATH = r'D:\Gov\projects\python\dto_env\Lib\site-packages\osgeo\gdal304.dll'
# GEOS_LIBRARY_PATH = r'D:\Gov\projects\python\dto_env\Lib\site-packages\osgeo\geos_c.dll'
# STATIC_URL = env.str('STATIC_URL', os.getenv('STATIC_URL',  'https://www.bio.gc.ca/dto/staticfiles/'))

if settings.DEBUG:
    print("Debugging")

settings.INSTALLED_APPS.append('django_extensions')

ALLOWED_HOSTS = ["localhost"]

LOGGERS = (
    {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": True,
        },
        "dto_info": {
            "handlers": ["console", "file"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": True,
        },
    },
)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
        "file": {
            "class": "concurrent_log_handler.ConcurrentRotatingFileHandler",
            "filename": f"{BASE_DIR}/error.log",
            "mode": "a",
            "encoding": "utf-8",
            "formatter": "simple",
            "backupCount": 5,
            "maxBytes": 1024 * 1024 * 2  # 2 MB
        }
    },
    "loggers": LOGGERS[0],
    "formatters": {
        "verbose": {
            "format": "[{levelname}] {asctime} - {name} {module}.py (line: {lineno:d}): {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
}