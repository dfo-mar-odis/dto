import os

from .base import *
from config.env import env

DEBUG = env.bool('DJANGO_DEBUG', default=True)
FORCE_SCRIPT_NAME = "/app/DTO"
STATIC_URL = FORCE_SCRIPT_NAME + '/static/'

LANGUAGE_COOKIE_SECURE = True  # Set to True in production with HTTPS

ALLOWED_HOSTS = ["poc.fsdh-dhsf.science.cloud-nuage.canada.ca"]
CSRF_TRUSTED_ORIGINS = ["https://poc.fsdh-dhsf.science.cloud-nuage.canada.ca"]
CSRF_ALLOWED_ORIGINS = ["https://poc.fsdh-dhsf.science.cloud-nuage.canada.ca"]
CORS_ORIGINS_WHITELIST = ["https://poc.fsdh-dhsf.science.cloud-nuage.canada.ca"]