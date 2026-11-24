import os

from .base import *
from config.env import env

FORCE_SCRIPT_NAME = "/app/DTO"
STATIC_URL = FORCE_SCRIPT_NAME + '/static/'

LANGUAGE_COOKIE_SECURE = True  # Set to True in production with HTTPS

ALLOWED_HOSTS = ["poc.fsdh-dhsf.science.cloud-nuage.canada.ca", "fsdh-proj-dto-webapp-poc.azurewebsites.net"]
CSRF_TRUSTED_ORIGINS = ["https://poc.fsdh-dhsf.science.cloud-nuage.canada.ca", "https://fsdh-proj-dto-webapp-poc.azurewebsites.net"]
CSRF_ALLOWED_ORIGINS = ["https://poc.fsdh-dhsf.science.cloud-nuage.canada.ca", "https://fsdh-proj-dto-webapp-poc.azurewebsites.net"]
CORS_ORIGINS_WHITELIST = ["https://poc.fsdh-dhsf.science.cloud-nuage.canada.ca", "https://fsdh-proj-dto-webapp-poc.azurewebsites.net"]

LOGGERS = (
    {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": True,
        },
        "dto_info": {
            "handlers": ["console"],
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