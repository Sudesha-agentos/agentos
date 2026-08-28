# syntax=docker/dockerfile:1
# Production image for AWS App Runner (linux/amd64).
# Matches Render light mode: Hypothesis only, no heavy OSS CLIs.

FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
  && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    QA_OSS_ADAPTERS=0 \
    CANARY_OSS_ADAPTERS=0 \
    OSS_TOOLS_REQUIRED=0 \
    ENGINEERING_SKIP_NPM_INSTALL=1 \
    PIPELINE_MAX_CONCURRENT_ORGS=1 \
    CODEBASE_GITNEXUS_GRAPH=0

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip openssl ca-certificates \
  && pip3 install --break-system-packages --no-cache-dir pytest hypothesis \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/data \
  && chown -R node:node /app

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node package.json ./
COPY --chown=node:node scripts/aws-entrypoint.cjs ./scripts/aws-entrypoint.cjs
COPY --chown=node:node vendor/locust ./vendor/locust
COPY --chown=node:node vendor/aider ./vendor/aider
COPY --chown=node:node vendor/mini-swe-agent ./vendor/mini-swe-agent

USER node
EXPOSE 8080
CMD ["node", "scripts/aws-entrypoint.cjs"]
