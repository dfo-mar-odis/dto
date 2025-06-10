#!/bin/bash

#gdalinfo --version
#pip freeze

#python manage.py check
python manage.py collectstatic --noinput
python manage.py migrate --noinput
python -m gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3