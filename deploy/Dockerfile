# syntax=docker/dockerfile:1
# Compilar JavaScript en la arquitectura del builder evita emular TypeScript
# en las Mac ARM. Las dependencias finales se instalan para TARGETPLATFORM.
FROM --platform=$BUILDPLATFORM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS build-base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM build-base AS hotwire
COPY grafo-hotwire-linker-v1/package*.json grafo-hotwire-linker-v1/tsconfig.json ./grafo-hotwire-linker-v1/
WORKDIR /app/grafo-hotwire-linker-v1
RUN npm ci --include=dev --no-audit --no-fund
COPY grafo-hotwire-linker-v1/src ./src
RUN npm run build

FROM build-base AS api-deps
COPY --from=hotwire /app/grafo-hotwire-linker-v1/package.json ./grafo-hotwire-linker-v1/package.json
COPY --from=hotwire /app/grafo-hotwire-linker-v1/dist ./grafo-hotwire-linker-v1/dist
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
COPY apps/api/prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci --include=dev --no-audit --no-fund && npm run prisma:generate

FROM api-deps AS api-build
COPY apps/api/tsconfig*.json apps/api/nest-cli.json ./
COPY apps/api/src ./src
# Sólo para ensayos con pocos recursos, después de verificar tipos fuera de Docker.
ARG SKIP_TYPECHECK=false
RUN if [ "$SKIP_TYPECHECK" = "true" ]; then \
      node -e "const fs=require('fs');const p='tsconfig.build.json';const c=JSON.parse(fs.readFileSync(p));c.compilerOptions.noCheck=true;fs.writeFileSync(p,JSON.stringify(c))"; \
    fi && npm run build

FROM base AS api-production-deps
COPY --from=hotwire /app/grafo-hotwire-linker-v1/package.json ./grafo-hotwire-linker-v1/package.json
COPY --from=hotwire /app/grafo-hotwire-linker-v1/dist ./grafo-hotwire-linker-v1/dist
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
COPY apps/api/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=api-build /app/apps/api/dist ./dist
RUN npm ci --omit=dev --no-audit --no-fund && npm run prisma:generate

FROM python:3.12-slim-bookworm@sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e AS backend
# compas_nest publica su wheel Linux para Python >= 3.12 (x86_64).
COPY --from=base /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 node && useradd --uid 1000 --gid node --create-home node \
    && python3 -m venv /opt/grafoprint-python
WORKDIR /app
COPY apps/api/requirements-opennest.txt /tmp/requirements-opennest.txt
RUN /opt/grafoprint-python/bin/pip install --no-cache-dir --only-binary=:all: -r /tmp/requirements-opennest.txt
ENV NODE_ENV=production PORT=3001 HOST=:: \
    OPENNEST_PYTHON=/opt/grafoprint-python/bin/python \
    DXF_PYTHON=/opt/grafoprint-python/bin/python \
    GRAFONEST_PACKINGSOLVER_ENABLED=0
COPY --from=hotwire --chown=node:node /app/grafo-hotwire-linker-v1/package.json ./grafo-hotwire-linker-v1/package.json
COPY --from=hotwire --chown=node:node /app/grafo-hotwire-linker-v1/dist ./grafo-hotwire-linker-v1/dist
WORKDIR /app/apps/api
COPY --from=api-production-deps --chown=node:node /app/apps/api/node_modules ./node_modules
COPY --from=api-build --chown=node:node /app/apps/api/dist ./dist
COPY --chown=node:node apps/api/package.json ./package.json
COPY --chown=node:node apps/api/prisma/schema.prisma ./prisma/schema.prisma
COPY --chown=node:node apps/api/prisma/migrations ./prisma/migrations
COPY --chown=node:node apps/api/scripts/deploy ./scripts/deploy
# LocalDriver crea su directorio al inicializarse, incluso cuando se usa R2.
RUN mkdir -p .storage && chown node:node .storage
USER node
EXPOSE 3001
CMD ["node", "dist/src/main.js"]

FROM api-build AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY next.config.ts tsconfig.json postcss.config.mjs ./
COPY src ./src
COPY public ./public
# Módulos puros compartidos y tipos Prisma importados por el frontend.
COPY apps/api/src ./apps/api/src
# Webpack evita el pico de memoria de Turbopack durante el empaquetado.
ARG SKIP_TYPECHECK=false
RUN GRAFOPRINT_BUILD_SKIP_TYPECHECK=$SKIP_TYPECHECK NODE_OPTIONS=--max-old-space-size=4096 npm run build -- --webpack

FROM base AS web-production-deps
COPY --from=web-build /app/.next/standalone ./
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM base AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=web-production-deps --chown=node:node /app ./
# Reponer también las dependencias compartidas de la arquitectura final.
COPY --from=api-production-deps --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=hotwire --chown=node:node /app/grafo-hotwire-linker-v1/package.json ./grafo-hotwire-linker-v1/package.json
COPY --from=hotwire --chown=node:node /app/grafo-hotwire-linker-v1/dist ./grafo-hotwire-linker-v1/dist
COPY --from=web-build --chown=node:node /app/.next/static ./.next/static
COPY --from=web-build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
