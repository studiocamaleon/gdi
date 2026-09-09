"""Comparación fría del motor completo: sólo cambia la reducción del selector.

PACKINGSOLVER_BIN requerido; el motor alternativo se activa sólo en los hijos.
No escribe DB ni configuración. Pausa/reanuda el Next indicado por argumento.
"""
import hashlib
import json
import os
from pathlib import Path
import platform
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / 'output/grafonest-transformacion-2026-09-09/validacion-patrones/integrado'


def main():
    pid = int(sys.argv[1])
    command = subprocess.check_output(['ps', '-p', str(pid), '-o', 'command='], text=True).strip()
    if not command.startswith('next-server '):
        raise RuntimeError('No es el frontend esperado.')
    binary = Path(os.environ['PACKINGSOLVER_BIN']).resolve(strict=True)
    OUT.mkdir(parents=True, exist_ok=True)
    sources = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
               for folder in ['apps/api/src/workers/geometria', 'apps/api/dist/src/workers/geometria']
               for p in (ROOT / folder).rglob('*') if p.suffix in ('.ts', '.js', '.py', '.lua')}
    (OUT / 'fuentes.json').write_text(json.dumps(sources, indent=2))
    (OUT / 'condiciones.json').write_text(json.dumps({
        'sistema': platform.platform(), 'cpuLogicas': os.cpu_count(), 'frontendPausado': pid,
        'binario': str(binary), 'binarioSha256': hashlib.sha256(binary.read_bytes()).hexdigest(),
        'presupuestoMs': 120000, 'datosComercialesModificados': False, 'frio': True,
        'repeticiones': 1, 'orden': ['sin-reduccion', 'con-reduccion']}, indent=2))
    def stop(_signal, _frame):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, stop)
    paused = False
    try:
        os.kill(pid, signal.SIGSTOP); paused = True
        rows = []
        for name, reduction in [('sin-reduccion', '0'), ('con-reduccion', '1')]:
            env = {**os.environ, 'GRAFONEST_SELECTOR_REDUCCION': reduction,
                   'GRAFONEST_SELECTOR_THREADS': '0', 'GRAFONEST_PACKINGSOLVER_ENABLED': '1'}
            with (OUT / (name + '.log')).open('w') as log:
                child = subprocess.Popen(['node', 'apps/api/test/benchmarks/grafonest-portafolio.cjs',
                    'output/grafonest-mejoras-2026-09-09/entrada-100.json', str(OUT / name), '120000'],
                    cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
                try:
                    code = child.wait(timeout=150)
                    if code:
                        raise RuntimeError(f'{name}: salida {code}; ver log')
                finally:
                    if child.poll() is None:
                        os.killpg(child.pid, signal.SIGTERM)
                        try: child.wait(timeout=1)
                        except subprocess.TimeoutExpired:
                            os.killpg(child.pid, signal.SIGKILL); child.wait()
            row = json.loads((OUT / name / 'mediciones.json').read_text())
            rows.append({'variante': name, **row})
            print(json.dumps({'variante': name, 'placas': row['placas'], 'patrones': row['patrones'],
                              'retornoMs': row['retornoMs']}), flush=True)
        (OUT / 'mediciones.json').write_text(json.dumps(rows, indent=2))
    finally:
        if paused:
            os.kill(pid, signal.SIGCONT)
            (OUT / 'frontend-reanudado.txt').write_text(str(pid))


if __name__ == '__main__':
    main()
