import os

from .base import *
from config.env import env

DEBUG = env.bool('DJANGO_DEBUG', default=False)
STATIC_URL = env.str('STATIC_URL', os.getenv('STATIC_URL',  'static/'))

# ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[]