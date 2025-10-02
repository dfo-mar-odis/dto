import os

from .base import *
from config.env import env

DEBUG = env.bool('DJANGO_DEBUG', default=True)
FORCE_SCRIPT_NAME = "/app/DTO"
STATIC_URL = FORCE_SCRIPT_NAME + '/static/'

LANGUAGE_COOKIE_SECURE = True  # Set to True in production with HTTPS

ALLOWED_HOSTS = ["poc.fsdh-dhsf.science.cloud-nuage.canada.ca", "fsdh-proj-dto-webapp-poc.azurewebsites.net"]
CSRF_TRUSTED_ORIGINS = ["https://poc.fsdh-dhsf.science.cloud-nuage.canada.ca", "https://fsdh-proj-dto-webapp-poc.azurewebsites.net"]
CSRF_ALLOWED_ORIGINS = ["https://poc.fsdh-dhsf.science.cloud-nuage.canada.ca", "https://fsdh-proj-dto-webapp-poc.azurewebsites.net"]
CORS_ORIGINS_WHITELIST = ["https://poc.fsdh-dhsf.science.cloud-nuage.canada.ca", "https://fsdh-proj-dto-webapp-poc.azurewebsites.net"]