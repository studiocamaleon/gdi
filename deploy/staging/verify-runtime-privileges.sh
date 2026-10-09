#!/bin/sh
# Leer la imagen final con su usuario de ejecución, sin datos ni secretos.
set -eu
if [ "$(id -u)" = 0 ]; then
  echo 'El proceso de aplicación no debe ejecutarse como root.' >&2
  exit 1
fi
elevados=$(find /usr/bin /usr/sbin /usr/local/bin -type f -perm /6000 -print)
if [ -n "$elevados" ]; then
  echo 'La imagen conserva utilidades de consola con elevación de privilegios:' >&2
  printf '%s\n' "$elevados" >&2
  exit 1
fi
echo 'Usuario sin root y utilidades de consola sin setuid/setgid: correcto.'
