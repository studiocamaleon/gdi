"""Supervisor de PackingSolver: envía certificados compactos, nunca contornos.

Comparte el grupo de procesos creado por Node. Vigila plazo, memoria y vida del
padre; el motor sólo propone candidatos, que TypeScript valida por separado.
"""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time

if os.environ.get('GRAFONEST_GUARD_FD'):
    from process_guard import start_guard
    start_guard()

START = time.monotonic()
PARENT = os.getppid()
CANCELLED = False


def cancelled(_signal, _frame):
    global CANCELLED
    CANCELLED = True


def resident_mb(pid):
    if sys.platform.startswith('linux'):
        try:
            pages = int(Path(f'/proc/{pid}/statm').read_text().split()[1])
            return pages * os.sysconf('SC_PAGE_SIZE') / 1024 ** 2
        except FileNotFoundError:
            return 0
    result = subprocess.run(['ps', '-o', 'rss=', '-p', str(pid)], capture_output=True,
                            text=True, timeout=0.5)
    return float(result.stdout.strip() or 0) / 1024


def stop(child):
    if child.poll() is None:
        child.terminate()
        try:
            child.wait(timeout=0.1)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()


def compact_certificate(candidate):
    """El archivo del motor repite contornos transformados. Sólo las poses
    cruzan el límite a Node; éste reconstruye y valida los originales."""
    bins = candidate.get('bins')
    if not isinstance(bins, list) or len(bins) > 1000:
        raise ValueError('Lista de placas inválida.')
    result, items_count = [], 0
    for bin in bins:
        items = bin.get('items', [])
        if not isinstance(items, list):
            raise ValueError('Lista de piezas inválida.')
        items_count += len(items)
        if items_count > 10000:
            raise ValueError('Demasiadas poses en el certificado.')
        result.append({'copies': bin.get('copies'), 'items': [
            {key: pose.get(key) for key in ('id', 'x', 'y', 'angle', 'mirror')}
            for pose in items
        ]})
    return {'bins': result}


def main():
    signal.signal(signal.SIGTERM, cancelled)
    signal.signal(signal.SIGINT, cancelled)
    payload = json.load(sys.stdin)
    if payload['padrePid'] != PARENT:
        raise RuntimeError('El worker finalizó antes de iniciar el motor.')
    timeout = float(payload['timeoutMs']) / 1000
    memory = int(payload['memoriaMb'])
    if not 0 < timeout <= 300 or not 64 <= memory <= 8192:
        raise ValueError('Límites inválidos para PackingSolver.')
    # El plazo incluye escribir la instancia y la preparación nativa.
    deadline = START + timeout
    with tempfile.TemporaryDirectory(prefix='grafonest-packingsolver-') as folder:
        root = Path(folder)
        source, certificate = root / 'input.json', root / 'certificate.json'
        source.write_text(json.dumps(payload['instancia'], separators=(',', ':')))
        with (root / 'native.log').open('wb') as log:
            child = subprocess.Popen([payload['ejecutable'], '--input', str(source),
                '--certificate', str(certificate), '--time-limit', str(max(0.01, deadline - time.monotonic())),
                '--memory-limit', str(memory), '--linear-programming-solver', 'highs', '--verbosity-level', '0'],
                stdin=subprocess.DEVNULL, stdout=log, stderr=log)
            previous, last_signature, last_memory_check = None, None, 0
            accepted, peak_mb, total_peak_mb, reason = 0, 0, 0, 'completado'
            # El JSON nativo incluye geometría y espacios de formato. Acotar
            # su lectura sin confundir ese tamaño con el certificado de poses.
            raw_limit = min(64 * 1024 ** 2, memory * 1024 ** 2 // 4)
            try:
                while True:
                    now = time.monotonic()
                    if CANCELLED or os.getppid() != PARENT:
                        reason = 'cancelado' if CANCELLED else 'padre-finalizado'
                        break
                    if now >= deadline:
                        reason = 'tiempo'
                        break
                    if now - last_memory_check >= 0.2:
                        rss = resident_mb(child.pid)
                        total_rss = rss + resident_mb(os.getpid())
                        peak_mb = max(peak_mb, rss)
                        total_peak_mb = max(total_peak_mb, total_rss)
                        last_memory_check = now
                        if total_rss > memory:
                            reason = 'memoria'
                            break
                    if (root / 'native.log').stat().st_size > 1024 * 1024:
                        reason = 'salida-excesiva'
                        break
                    try:
                        stat = certificate.stat()
                        if stat.st_size > raw_limit:
                            reason = 'certificado-excesivo'
                            break
                        signature = (stat.st_ino, stat.st_size, stat.st_mtime_ns)
                        if signature != last_signature:
                            with certificate.open('rb') as source_file:
                                raw = source_file.read(raw_limit + 1)
                            if len(raw) > raw_limit:
                                reason = 'certificado-excesivo'
                                break
                            candidate = compact_certificate(json.loads(raw))
                            del raw
                            compact = json.dumps(candidate, separators=(',', ':'))
                            last_signature = signature
                            if compact != previous and time.monotonic() < deadline:
                                previous = compact
                                print('GRAFO_OPENNEST_RESULT:' + json.dumps({
                                    'certificado': candidate, 'duracionMs': (time.monotonic() - START) * 1000,
                                }, separators=(',', ':')), flush=True)
                                accepted += 1
                    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError, ValueError, AttributeError, TypeError):
                        pass  # El motor reemplaza el archivo sin escritura atómica.
                    if child.poll() is not None:
                        break
                    time.sleep(0.05)
            finally:
                stop(child)
                print(json.dumps({'motor': 'packingsolver', 'fin': reason, 'certificados': accepted,
                                  'rssObservadoMb': peak_mb, 'rssTotalObservadoMb': total_peak_mb,
                                  'codigoNativo': child.returncode}), file=sys.stderr)
            if not accepted:
                raise RuntimeError('PackingSolver no entregó candidatos: ' + reason)


if __name__ == '__main__':
    main()
