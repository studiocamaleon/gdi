# Gotenberg 8.37.0 con Chromium de seguridad actualizado de Debian 13.
# La versión base fija todavía incluye Chromium 152; revisar este pin al actualizar.
FROM gotenberg/gotenberg@sha256:f29984bd1e226bf1b93ba90af06000afa8b315853e99d27b9aaa41b93f15c769
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       chromium=154.0.8037.57-1~deb13u1 \
       chromium-common=154.0.8037.57-1~deb13u1 \
    && rm -rf /var/lib/apt/lists/* \
    && chromium --version | grep -F 'Chromium 154.0.8037.57 '
USER gotenberg
