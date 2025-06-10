#!/bin/bash

#gdalinfo --version
#pip freeze

#python manage.py check
python manage.py collectstatic --noinput
python manage.py migrate --noinput
python -m gunicorn -b 0.0.0.0:8000 config.wsgi:application --workers 3