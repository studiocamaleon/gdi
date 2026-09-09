"""Limpia el grupo nativo si muere Node, incluso si C++ bloquea Python.

Un proceso mínimo espera EOF en un descriptor heredado sólo de Node. No usa
sondeo de PID, no depende del GIL del solver y no confunde reutilización de PID.
"""
import os
import select
import signal
import subprocess
import sys


def wait_for_coordinator(fd, silence_seconds=45):
    """También detecta Node suspendido: deja de enviar pulsos cada 5 segundos.

    El plazo queda por debajo del permiso Redis de 60 segundos, para detener
    nativos antes de que otra réplica pueda recuperar la misma reserva.
    """
    while True:
        ready, _, _ = select.select([fd], [], [], silence_seconds)
        if not ready:
            return 'silencio'
        if not os.read(fd, 1024):
            return 'eof'


def start_guard():
    raw = os.environ.get('GRAFONEST_GUARD_FD')
    if raw is None:
        return  # Ejecución directa de pruebas/CLI, sin coordinador Node.
    fd = int(raw)
    if fd < 3 or os.getpgrp() != os.getpid():
        raise RuntimeError('La guardia requiere un grupo nativo aislado.')
    os.fstat(fd)
    guard = subprocess.Popen([sys.executable, __file__, str(os.getpgrp()), str(fd)],
                             stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                             stderr=subprocess.DEVNULL, pass_fds=(fd,))
    # No iniciar C++ hasta que la guardia pueda sobrevivir a una cancelación.
    ready = guard.stdout.read(1)
    guard.stdout.close()
    if ready != b'1':
        raise RuntimeError('La guardia no pudo iniciar.')
    os.close(fd)


if __name__ == '__main__':
    group, fd = int(sys.argv[1]), int(sys.argv[2])
    if group != os.getpgrp() or group == os.getpid():
        raise RuntimeError('Grupo de procesos inválido.')
    # Sobrevivir al primer TERM: si un descendiente lo ignora, el EOF termina
    # todo el grupo cuando sale el runner o se cae su coordinador.
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    sys.stdout.buffer.write(b'1')
    sys.stdout.buffer.flush()
    sys.stdout.close()
    try:
        wait_for_coordinator(fd)
    finally:
        os.killpg(group, signal.SIGKILL)
