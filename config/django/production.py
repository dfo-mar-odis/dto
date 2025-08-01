import os

from .base import *
from config.env import env

DEBUG = env.bool('DJANGO_DEBUG', default=True)
FORCE_SCRIPT_NAME = "/app/DTO"
STATIC_URL = FORCE_SCRIPT_NAME + '/static/'

LANGUAGE_COOKIE_SECURE = True  # Set to True in production with HTTPS
