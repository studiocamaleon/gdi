#!/bin/sh
# Exclusivamente en un contenedor desechable, sin red ni volúmenes del usuario.
set -eu
test "${GRAFO_TEST_DESECHABLE:-}" = 1
test "$(id -u)" = 0
ensayo=$(mktemp -d /tmp/grafo-paths-XXXXXX)
trap 'rm -rf "$ensayo"' EXIT HUP INT TERM
chmod 755 "$ensayo"
cat > "$ensayo/node" <<'SH'
#!/bin/sh
set -eu
test "$(id -u)" = 10001
test ! -w /data
test "$(stat -c '%a:%u:%g' /data/estado)" = 700:10001:10001
test "$(stat -c '%a:%u:%g' /run/respaldo)" = 700:10001:10001
test "$(stat -c '%a:%u:%g:%h' /data/proceso.lock)" = 600:10001:10001:1
test "$RESPALDO_BAJO_FLOCK" = 1
test "$1" = /app/servicio.mjs
if flock --nonblock --conflict-exit-code 73 /data/proceso.lock true; then
  exit 1
else
  test "$?" = 73
fi
SH
chmod 755 "$ensayo/node"
export PATH="$ensayo:$PATH"

preparar() {
  rm -rf /data /run/respaldo "$ensayo/protegido" "$ensayo/archivo"
  mkdir -p /data "$ensayo/protegido"
  chown respaldo:respaldo /data
  chmod 700 /data "$ensayo/protegido"
  printf 'contenido privado ficticio\n' > "$ensayo/archivo"
  chmod 600 "$ensayo/archivo"
}
rechazar() {
  if /app/entrypoint.sh > "$ensayo/salida" 2>&1; then
    echo 'El arranque aceptó una ruta manipulada.' >&2
    exit 1
  fi
  grep -Eq 'Directorio de respaldo inseguro|Archivo de bloqueo' "$ensayo/salida"
  test "$(stat -c '%a:%u:%g' "$ensayo/protegido")" = 700:0:0
  test "$(stat -c '%a:%u:%g' "$ensayo/archivo")" = 600:0:0
  test "$(cat "$ensayo/archivo")" = 'contenido privado ficticio'
}
for caso in volumen estado ejecucion bloqueo enlace_duro fifo archivo; do
  preparar
  case "$caso" in
    volumen) rmdir /data; ln -s "$ensayo/protegido" /data ;;
    estado) ln -s "$ensayo/protegido" /data/estado ;;
    ejecucion) ln -s "$ensayo/protegido" /run/respaldo ;;
    bloqueo) ln -s "$ensayo/archivo" /data/proceso.lock ;;
    enlace_duro) ln "$ensayo/archivo" /data/proceso.lock ;;
    fifo) mkfifo /data/proceso.lock ;;
    archivo) cp "$ensayo/archivo" /data/estado ;;
  esac
  rechazar
  echo "Ruta manipulada rechazada: $caso"
done

# Un volumen anterior válido debe conservar tanto el contenido como el inode
# del bloqueo, y admitir dos arranques consecutivos sin permisos elevados.
preparar
mkdir -p /data/estado
printf 'estado ficticio\n' > /data/estado/conservar
chown -R respaldo:respaldo /data
: > /data/proceso.lock
chown respaldo:respaldo /data/proceso.lock
inode=$(stat -c %i /data/proceso.lock)
/app/entrypoint.sh
/app/entrypoint.sh
test "$(stat -c %i /data/proceso.lock)" = "$inode"
test "$(cat /data/estado/conservar)" = 'estado ficticio'
echo 'Estado anterior conservado y dos arranques seguros aprobados.'
