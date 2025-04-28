FROM python:3.12.10-slim-bullseye
LABEL authors="Patrick Upson"

# Set environment variables
ENV PIP_DISABLE_PIP_VERSION_CHECK 1
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /opt/project

# Install dependencies
COPY ./requirements.txt .
RUN pip install -r requirements.txt

RUN apt-get update && apt-get install -y binutils libproj-dev gdal-bin python3-gdal

RUN pip install -r requirements.txt

# Copy project
COPY . .
