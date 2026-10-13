# syntax=docker/dockerfile:1
# Compilar JavaScript en la arquitectura del builder evita emular TypeScript
# en las Mac ARM. Las dependencias finales se instalan para TARGETPLATFORM.
FROM --platform=$BUILDPLATFORM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build-base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS base
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
COPY apps/api/test/dependencias-prisma.test.cjs ./test/dependencias-prisma.test.cjs
RUN npm ci --include=dev --no-audit --no-fund && npm run test:dependencias && npm run prisma:generate

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

# Sólo los contenedores/codecs que admite Inbox. Sin red, listas remotas,
# subtítulos, filtros de video, dispositivos ni bibliotecas gráficas de escritorio.
# Compilar en TARGETPLATFORM: los binarios se copian al runtime de esa arquitectura.
FROM base AS inbox-ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends build-essential pkg-config nasm libopus-dev curl xz-utils gnupg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /tmp/ffmpeg
RUN curl --fail --location --proto '=https' https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz -o source.tar.xz \
    && echo '8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e  source.tar.xz' | sha256sum --check --strict \
    && curl --fail --location --proto '=https' https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz.asc -o source.asc \
    && curl --fail --location --proto '=https' https://ffmpeg.org/ffmpeg-devel.asc -o release-key.asc \
    && gpg --batch --import release-key.asc \
    && gpg --batch --status-fd=1 --verify source.asc source.tar.xz > verified.txt \
    && grep -q '^\[GNUPG:\] VALIDSIG FCF986EA15E6E293A5644F10B4322F04D67658D8 ' verified.txt \
    && tar -xJf source.tar.xz --strip-components=1 \
    && ./configure --prefix=/opt/inbox-ffmpeg --disable-autodetect --disable-network --disable-doc --disable-debug \
       --disable-shared --enable-static --disable-everything --disable-avdevice --disable-swscale --disable-ffplay \
       --enable-ffmpeg --enable-ffprobe --enable-libopus --enable-swresample \
       --enable-protocol=file,pipe --enable-demuxer=matroska,mov,ogg,mp3,aac,amr --enable-muxer=ogg \
       --enable-decoder=aac,opus,vorbis,mp3,mp3float,amrnb,amrwb,h264 \
       --enable-encoder=libopus --enable-parser=aac,aac_latm,opus,vorbis,mpegaudio,h264 \
       --enable-filter=abuffer,abuffersink,aformat,anull,aresample,atrim,asetpts \
    && make -j2 && make install

FROM python:3.12-slim-bookworm@sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e AS backend
# compas_nest publica su wheel Linux para Python >= 3.12 (x86_64).
COPY --from=base /usr/local/bin/node /usr/local/bin/node
# Sharp rasteriza los textos de las etiquetas mediante las fuentes del sistema.
# Las imágenes slim no incluyen ninguna: sin ésta se imprimen cuadros vacíos.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl libgomp1 fontconfig fonts-dejavu-core libopus0 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 node && useradd --uid 1000 --gid node --create-home node \
    && python3 -m venv /opt/grafoprint-python
WORKDIR /app
COPY apps/api/requirements-opennest.txt /tmp/requirements-opennest.txt
COPY apps/api/requirements-build.txt /tmp/requirements-build.txt
RUN python3 -m pip install --no-cache-dir --only-binary=:all: --require-hashes -r /tmp/requirements-build.txt \
    && /opt/grafoprint-python/bin/python -m pip install --no-cache-dir --only-binary=:all: --require-hashes -r /tmp/requirements-build.txt \
    && /opt/grafoprint-python/bin/pip install --no-cache-dir --only-binary=:all: -r /tmp/requirements-opennest.txt \
    && /opt/grafoprint-python/bin/pip check \
    && /opt/grafoprint-python/bin/python -c "import compas_nest, scipy, ezdxf"
COPY --from=inbox-ffmpeg /opt/inbox-ffmpeg/bin/ffmpeg /opt/inbox-ffmpeg/bin/ffprobe /usr/local/bin/
COPY --from=inbox-ffmpeg /tmp/ffmpeg/COPYING.LGPLv2.1 /tmp/ffmpeg/LICENSE.md /usr/local/share/licenses/ffmpeg/
ARG GRAFO_RELEASE
ENV GRAFO_RELEASE=$GRAFO_RELEASE
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
# Ningún servicio necesita elevarse mediante utilidades de administración.
# Conservar los permisos ordinarios y las herramientas de procesamiento.
RUN find /usr/bin /usr/sbin /usr/local/bin -type f -perm /6000 -exec chmod a-s {} +
USER node
# Ensayo sobre los binarios finales, con el mismo usuario de la aplicación.
COPY --chown=node:node src/app/dev/diseno/inbox/archivo/fixtures/tono.m4a /tmp/inbox-verificacion/tono.m4a
RUN node scripts/deploy/verify-media.cjs /tmp/inbox-verificacion/tono.m4a
EXPOSE 3001
CMD ["node", "dist/src/main.js"]

FROM api-build AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY next.config.ts tsconfig.json postcss.config.mjs ./
COPY scripts/postcss-heroui-scope.cjs ./scripts/postcss-heroui-scope.cjs
COPY src ./src
COPY public ./public
# Módulos puros compartidos y tipos Prisma importados por el frontend.
COPY apps/api/src ./apps/api/src
# Fixture sintético importado por los tests que también comprueba TypeScript.
COPY apps/api/test/fixtures/f6-planificacion/exhibidor-controlado.ts ./apps/api/test/fixtures/f6-planificacion/exhibidor-controlado.ts
# Webpack evita el pico de memoria de Turbopack durante el empaquetado.
ARG SKIP_TYPECHECK=false
RUN GRAFOPRINT_BUILD_SKIP_TYPECHECK=$SKIP_TYPECHECK NODE_OPTIONS=--max-old-space-size=4096 npm run build -- --webpack

FROM base AS web-production-deps
COPY --from=web-build /app/.next/standalone ./
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM base AS web
ARG GRAFO_RELEASE
ENV GRAFO_RELEASE=$GRAFO_RELEASE
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=web-production-deps --chown=node:node /app ./
# Reponer también las dependencias compartidas de la arquitectura final.
COPY --from=api-production-deps --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=hotwire --chown=node:node /app/grafo-hotwire-linker-v1/package.json ./grafo-hotwire-linker-v1/package.json
COPY --from=hotwire --chown=node:node /app/grafo-hotwire-linker-v1/dist ./grafo-hotwire-linker-v1/dist
COPY --from=web-build --chown=node:node /app/.next/static ./.next/static
COPY --from=web-build --chown=node:node /app/public ./public
RUN find /usr/bin /usr/sbin /usr/local/bin -type f -perm /6000 -exec chmod a-s {} +
USER node
EXPOSE 3000
CMD ["node", "server.js"]
