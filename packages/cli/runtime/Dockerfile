FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
FROM node:22-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ARG PORTAL_CONFIG=portal.config.json
ENV CSP_CONFIG_PATH=$PORTAL_CONFIG
COPY --chown=node:node . .
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
USER node
EXPOSE 3001
CMD ["node", "dist-api/server.js"]
