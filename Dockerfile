# syntax=docker/dockerfile:1
FROM node:current-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
# npm postinstall generates ignored Protobuf sources using the workspace tools.
# The package token and npm cache/logs never enter an image layer.
RUN --mount=type=secret,id=github_token,env=GITHUB_TOKEN,required=true \
    --mount=type=tmpfs,target=/root/.npm \
    npm ci
USER node
CMD ["npm", "run", "persistence:migrate"]
