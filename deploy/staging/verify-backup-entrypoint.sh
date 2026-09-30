#!/bin/sh
# Sólo en contenedor desechable: sustituye el punto de entrada de Node para
# comprobar el arranque real (permisos, usuario y flock) sin contactar proveedores.
set -eu
ensayo=$(mktemp -d /tmp/grafo-entrypoint-XXXXXX)
trap 'rm -rf "$ensayo"' EXIT HUP INT TERM
chmod 755 "$ensayo"
cat > "$ensayo/node" <<'SH'
#!/bin/sh
set -eu
test "$(id -u)" = 10001
test "$(id -g)" = 10001
test "$RESPALDO_BAJO_FLOCK" = 1
test "$1" = /app/servicio.mjs
test "$(stat -c '%a:%u:%g' /data)" = 700:10001:10001
test "$(stat -c '%a:%u:%g' /data/estado)" = 700:10001:10001
test "$(stat -c '%a:%u:%g' /run/respaldo)" = 700:10001:10001
if flock --nonblock --conflict-exit-code 73 /data/proceso.lock true; then
  echo 'El bloqueo del respaldo no quedó retenido.' >&2
  exit 1
else
  test "$?" = 73
fi
pg_dump --version
age --version
/usr/local/bin/node -e 'if (process.getuid() !== 10001) process.exit(1)'
echo 'Arranque de respaldo: usuario, directorios privados y exclusión correctos.'
SH
chmod 755 "$ensayo/node"
PATH="$ensayo:$PATH" /app/entrypoint.sh
