#!/bin/bash

#gdalinfo --version
#pip freeze

#python manage.py check
python manage.py collectstatic --noinput
python manage.py migrate --noinput
/usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf