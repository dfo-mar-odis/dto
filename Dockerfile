FROM python:3.11.5-slim-bullseye
LABEL authors="Patrick Upson"

# Set environment variables
ENV PIP_DISABLE_PIP_VERSION_CHECK 1
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /code

#RUN apt-get update
#RUN apt-get install -y gdal-bin python3-gdal
#ARG CPLUS_INCLUDE_PATH=/usr/include/gdal
#ARG C_INCLUDE_PATH=/usr/include/gdal
#
#RUN apt-get install -y wget
#RUN apt-get install bzip2
#
#RUN wget https://repo.anaconda.com/archive/Anaconda3-2024.02-1-Linux-x86_64.sh
#RUN bash Anaconda3-2024.02-1-Linux-x86_64.sh -b
#RUN rm Anaconda3-2024.02-1-Linux-x86_64.sh
#
#ENV PATH /root/anaconda3/bin:$PATH
#
#RUN conda install anaconda
#RUN conda update conda
#RUN conda update anaconda
#RUN conda update --all
#
#RUN conda install -c conda-forge gdal

# Install dependencies
COPY ./requirements.txt .
RUN pip install -r requirements.txt

RUN apt-get update && apt-get install -y binutils libproj-dev gdal-bin python3-gdal

# Copy project
COPY . .
CMD ["python", "manage.py", "migrate", "--no-input"]