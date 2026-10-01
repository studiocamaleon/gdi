#!/bin/sh
set -eu
umask 077
# El proceso de copia no puede reemplazar las entradas que prepara root al
# reiniciar. Primero se protege el padre; después se inspeccionan sus hijos.
directorio_real() {
  if [ -L "$1" ] || { [ -e "$1" ] && [ ! -d "$1" ]; }; then
    echo 'Directorio de respaldo inseguro.' >&2
    exit 1
  fi
}
directorio_real /data
mkdir -p /data
chown root:root /data
chmod 755 /data
directorio_real /data/estado
directorio_real /run/respaldo
mkdir -p /data/estado /run/respaldo
chown respaldo:respaldo /data/estado /run/respaldo
chmod 700 /data/estado /run/respaldo
# Mantener el mismo inode del bloqueo entre arranques; nunca seguir enlaces ni
# permitir que el usuario de la copia lo sustituya mientras flock lo retiene.
if [ -L /data/proceso.lock ] || { [ -e /data/proceso.lock ] && [ ! -f /data/proceso.lock ]; }; then
  echo 'Archivo de bloqueo inseguro.' >&2
  exit 1
fi
if [ -e /data/proceso.lock ]; then
  if [ "$(stat -c %h /data/proceso.lock)" != 1 ]; then
    echo 'Archivo de bloqueo compartido por enlaces.' >&2
    exit 1
  fi
else
  (set -C; : > /data/proceso.lock)
fi
chown respaldo:respaldo /data/proceso.lock
chmod 600 /data/proceso.lock
exec gosu respaldo flock --no-fork -n /data/proceso.lock env RESPALDO_BAJO_FLOCK=1 node /app/servicio.mjs
