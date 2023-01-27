#!/bin/bash

#gunicorn --workers=2 --threads=4 --worker-class=gthread -b 0.0.0.0:80 main:app

DOCKER_BUILDKIT=1 docker build -t cs-rp-app .
