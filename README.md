[![Build and Push DTO Image to GitHub Container Registry (GHCR)](https://github.com/dfo-mar-odis/dto/actions/workflows/build-image.yml/badge.svg?branch=master)](https://github.com/dfo-mar-odis/dto/actions/workflows/build-image.yml)

# Digital Twin Ocean (DTO) Viewer

A web application for viewing and analyzing climate data related to Marine Protected Areas (MPAs), enabling scientists to make physical and biological assessments concerning ocean state and marine habitat suitability.

## Overview

The Digital Twin Ocean (DTO) Viewer is deployed on the Federal Science Data Hub (FSDH) as a web application, providing researchers with tools to analyze ocean data and assess changing marine habitats. The application leverages the FSDH's PostgreSQL database and web server infrastructure, deployed via Docker containers.

## Purpose

This application enables marine scientists to:
- View climate data specific to Marine Protected Areas (MPAs)
- Conduct physical and biological assessments of ocean conditions
- Analyze marine species habitat suitability
- Track changes in marine environments over time
- Create digital representations of ocean environments for research and analysis

## Access Requirements

### User Access
- Must be a Government of Canada employee
- Requires an account on the Federal Science Data Hub (FSDH)
- Contact the development team for guest permissions:
  - Primary contact: Patrick Upson
  - Secondary contact: Hui Shen
- Access URL: https://poc.fsdh-dhsf.science.cloud-nuage.canada.ca/app/DTO/

## Technical Stack

- **Backend**: Django (Python)
- **Frontend**: JavaScript-heavy application with AJAX
- **Database**: PostgreSQL (provided by FSDH)
- **Data Processing**: Pandas
- **Visualization**: Chart.js
- **Deployment**: Docker & Docker Compose

## Development Requirements

Developers should have experience with:
- Python and Django framework
- JavaScript and AJAX
- Docker and Docker Compose
- Chart.js for data visualization
- Pandas for data manipulation
- PostgreSQL database management

## License

© His Majesty the King in Right of Canada, as represented by the Minister of Fisheries and Oceans Canada, 2025


## Contact

For questions about access or technical issues, please contact the development team through the appropriate Government of Canada channels.
