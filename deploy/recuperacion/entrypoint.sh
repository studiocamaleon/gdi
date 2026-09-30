#!/bin/sh
set -eu
umask 077
# El volumen llega con dueño root. Sólo se prepara este directorio exclusivo;
# el proceso de copia baja a un usuario sin privilegios antes de leer secretos.
mkdir -p /data/estado /run/respaldo
chown respaldo:respaldo /data /data/estado /run/respaldo
chmod 700 /data /data/estado /run/respaldo
exec gosu respaldo flock --no-fork -n /data/proceso.lock env RESPALDO_BAJO_FLOCK=1 node /app/servicio.mjs
