import os

from .base import *
from config.env import env

DEBUG = env.bool('DJANGO_DEBUG', default=True)
FORCE_SCRIPT_NAME = "/app/DTO"
STATIC_URL = FORCE_SCRIPT_NAME + '/static/'
# https://poc.fsdh-dhsf.science.cloud-nuage.canada.ca/webapp-DTO/static/core/js/range_chart.js
# STATIC_URL = env.str('STATIC_URL', os.getenv('STATIC_URL',  'https://www.bio.gc.ca/dto/staticfiles/'))
# STATIC_URL = env.str('STATIC_URL', os.getenv('STATIC_URL',  'staticfiles/'))

# ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[]