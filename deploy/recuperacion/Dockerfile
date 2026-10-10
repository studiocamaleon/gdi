# Compilar en remoto. La imagen resultante se fija por digest al desplegar.
FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM postgres:16.15-bookworm@sha256:efedf3595f1d6f415c08568ba171029bf54052e754cc9f030e3f2412b21f3d67
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl util-linux \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz -o /tmp/age.tar.gz \
    && echo 'cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10  /tmp/age.tar.gz' | sha256sum -c - \
    && tar -xzf /tmp/age.tar.gz -C /tmp \
    && install -m 0755 /tmp/age/age /usr/local/bin/age \
    && rm -rf /tmp/age /tmp/age.tar.gz \
    && useradd --uid 10001 --create-home --shell /usr/sbin/nologin respaldo
COPY --from=dependencias /usr/local/bin/node /usr/local/bin/node
COPY --from=dependencias /app/node_modules /app/node_modules
WORKDIR /app
COPY lib ./lib
COPY ejecutar.mjs servicio.mjs validar-destino.mjs entrypoint.sh ./
RUN chmod 0555 /app/entrypoint.sh && age --version && pg_dump --version && node --version
# gosu baja desde root mediante setuid(2); no necesita el bit setuid en su archivo.
RUN find /usr/bin /usr/sbin /usr/local/bin -type f -perm /6000 -exec chmod a-s {} +
ENV NODE_ENV=production
ENTRYPOINT ["/app/entrypoint.sh"]
