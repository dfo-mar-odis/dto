#/bin/bash

#gdalinfo --version
#pip freeze

#python manage.py check
python manage.py migrate
python manage.py runserver 0.0.0.0:8000