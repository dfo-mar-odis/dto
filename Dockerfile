FROM python:3.12.10-slim-bullseye
LABEL authors="Patrick Upson"

# Set environment variables
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
RUN mkdir /opt/project
WORKDIR /opt/project

RUN apt-get update && apt-get install -y binutils libproj-dev gdal-bin python3-gdal

# Install dependencies
COPY ./requirements.txt .
RUN pip install -r requirements.txt

RUN useradd -m -r appuser && chown -R appuser /opt/project

# Copy project
COPY . .
