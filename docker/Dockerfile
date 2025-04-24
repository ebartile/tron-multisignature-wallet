FROM ubuntu:latest

LABEL maintainer="Emmanuel Bartile"

ARG APP_ENV
ARG DEBIAN_FRONTEND=noninteractive

ENV TZ=UTC
ENV NPM_CONFIG_LOGLEVEL=warn
ENV NPM_CONFIG_CACHE=/tmp/.npm
ARG NODE_VERSION

ENV NODE_ENV=$APP_ENV
ENV TRON_STORAGE_PATH=/home/node/storage
ENV TRON_BIND=0.0.0.0
ENV INSTALLED_FILE=/var/app.installed

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN apt-get update && apt-get install -y curl gnupg2 ca-certificates lsb-release debian-archive-keyring

# Setup nodesource repository
RUN curl -sS https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor \
        | tee /usr/share/keyrings/nodesource-keyring.gpg >/dev/null

RUN echo "deb [signed-by=/usr/share/keyrings/nodesource-keyring.gpg] https://deb.nodesource.com/node_$NODE_VERSION.x nodistro main" \
        | tee /etc/apt/sources.list.d/nodesource.list

RUN echo "Package: nodejs\nPin: origin deb.nodesource.com\nPin-Priority: 900" \
        | tee /etc/apt/preferences.d/nodesource

# Install system dependencies
RUN apt-get update && apt-get install -y gosu git nodejs

# Verify installation
RUN node --version && npm --version && npx --version

RUN mkdir -p /var/scripts

COPY scripts/start-container /usr/local/bin/start-container

RUN useradd -ms /bin/bash server

RUN chmod u+x /usr/local/bin/start-container

WORKDIR /home/node/app

# Image cleanup
RUN apt-get -y autoremove && apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

ENTRYPOINT ["start-container"]
