"""Compara runners sobre la misma cartera; mide CPU/RSS del proceso completo.

python selector-recursos.py entrada.json runner-anterior.py runner-actual.py salida
Cada repetición arranca procesos nuevos. No usa base de datos ni colas comerciales.
"""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import signal
import statistics
import subprocess
import sys
import threading
import time

CHILD = r'''
import json, resource, runpy, sys, time
started = time.monotonic()
original_stdout = sys.stdout
hitos = []
class Trace:
    pending = ''
    def write(self, text):
        original_stdout.write(text)
        self.pending += text
        while '\n' in self.pending:
            line, self.pending = self.pending.split('\n', 1)
            if line.startswith('GRAFO_OPENNEST_RESULT:'):
                plan = json.loads(line.split(':', 1)[1])
                hitos.append({'ms': (time.monotonic() - started) * 1000,
                              'placas': plan['placas'], 'patrones': len(plan['seleccion'])})
        return len(text)
    def flush(self):
        original_stdout.flush()
sys.stdout = Trace()
try:
    runpy.run_path(sys.argv[1], run_name='__main__')
finally:
    usage = resource.getrusage(resource.RUSAGE_SELF)
    print('GRAFO_RESOURCE:' + json.dumps({
        'elapsedMs': (time.monotonic() - started) * 1000,
        'cpuMs': (usage.ru_utime + usage.ru_stime) * 1000,
        'rssPeakBytes': usage.ru_maxrss * (1 if sys.platform == 'darwin' else 1024),
        'hitos': hitos
    }), file=sys.stderr)
'''


def main():
    input_path, before_path, after_path, output_path = map(Path, sys.argv[1:])
    payload = json.loads(input_path.read_text())
    output_path.mkdir(parents=True, exist_ok=True)
    rows = []
    batches = []
    def run(label, runner, repetition, job):
        started = time.monotonic()
        deadline = started + payload['timeoutMs'] / 1000
        process = subprocess.Popen([sys.executable, '-c', CHILD, str(runner.resolve())],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, start_new_session=True,
            env={**os.environ, 'GRAFONEST_SELECTOR_THREADS': os.environ.get('GRAFONEST_BENCH_THREADS', '1')},
        )
        stdout, stderr, plans, hits = [], [], [], []
        def read_stdout():
            for line in process.stdout:
                stdout.append(line)
                received = time.monotonic()
                if line.startswith('GRAFO_OPENNEST_RESULT:') and received <= deadline:
                    plan = json.loads(line.split(':', 1)[1])
                    plans.append(plan)
                    hits.append({'ms': (received - started) * 1000,
                                 'placas': plan['placas'], 'patrones': len(plan['seleccion'])})
        out_thread = threading.Thread(target=read_stdout)
        err_thread = threading.Thread(target=lambda: stderr.append(process.stderr.read()))
        out_thread.start()
        err_thread.start()
        process.stdin.write(json.dumps(payload))
        process.stdin.close()
        terminated = False
        while True:
            pid, status, usage = os.wait4(process.pid, os.WNOHANG)
            if pid:
                process.returncode = os.waitstatus_to_exitcode(status)
                break
            now = time.monotonic()
            if now > deadline:
                try:
                    os.killpg(process.pid, signal.SIGKILL if now > deadline + 0.25 else signal.SIGTERM)
                except ProcessLookupError:
                    pass
                terminated = True
            time.sleep(0.01)
        out_thread.join()
        err_thread.join()
        process.stdout.close()
        process.stderr.close()
        stdout, stderr = ''.join(stdout), ''.join(stderr)
        name = f'{label}-{repetition}-{job}'
        (output_path / f'{name}.stdout').write_text(stdout)
        (output_path / f'{name}.stderr').write_text(stderr)
        metrics = {'elapsedMs': (time.monotonic() - started) * 1000,
            'cpuMs': (usage.ru_utime + usage.ru_stime) * 1000,
            'rssPeakBytes': usage.ru_maxrss * (1 if sys.platform == 'darwin' else 1024),
            'hitos': hits, 'limiteExterno': terminated, 'codigoSalida': process.returncode}
        if not plans:
            return {'caso': name, **metrics, 'placas': None, 'patrones': None,
                    'candidatos': 0, 'fallo': stderr[-1000:] or 'Sin candidato dentro del límite externo'}
        for plan in plans:
            demand = [0] * len(payload['demanda'])
            for item in plan['seleccion']:
                copies = item['repeticiones']
                assert isinstance(copies, int) and copies > 0
                for i, count in enumerate(payload['patrones'][item['patron']]['counts']):
                    demand[i] += count * copies
            assert demand == payload['demanda'], 'Demanda inexacta'
            assert sum(p['repeticiones'] for p in plan['seleccion']) == plan['placas']
        final = plans[-1]
        return {'caso': name, **metrics, 'placas': final['placas'],
                'patrones': len(final['seleccion']), 'candidatos': len(plans),
                'optimoPlacasEnCartera': final['optimoPlacasDentroCartera'],
                'optimoPatronesEnCartera': final['optimoPatronesDentroCartera']}

    for concurrency in [1, 2]:
        # Alternar evita medir todas las corridas de un motor con distinta
        # temperatura/carga. Tres repeticiones no constituyen un p95.
        for repetition in range(3):
            runners = [('anterior', before_path), ('actual-hilos-' + os.environ.get('GRAFONEST_BENCH_THREADS', '1'), after_path)]
            if repetition % 2:
                runners.reverse()
            for kind, runner in runners:
                label = f'{kind}-concurrencia-{concurrency}'
                start = time.monotonic()
                with ThreadPoolExecutor(max_workers=concurrency) as executor:
                    futures = [executor.submit(run, label, runner, repetition, j) for j in range(concurrency)]
                    results = [future.result() for future in futures]
                elapsed = (time.monotonic() - start) * 1000
                rows.extend(results)
                batches.append({'configuracion': label, 'repeticion': repetition,
                    'totalMs': elapsed, 'cpuMs': sum(r['cpuMs'] for r in results),
                    # La suma de picos individuales es una cota de reserva,
                    # no el pico simultáneo observado del servidor.
                    'sumaPicosRssBytes': sum(r['rssPeakBytes'] for r in results),
                    'fallos': sum(1 for r in results if r.get('fallo')),
                    'calidad': [[r['placas'], r['patrones']] for r in results]})
                print(json.dumps(batches[-1]), flush=True)
                (output_path / 'mediciones.json').write_text(json.dumps({'procesos': rows, 'lotes': batches}, indent=2))
    summary = []
    for label in sorted({r['configuracion'] for r in batches}):
        group = [r for r in batches if r['configuracion'] == label]
        summary.append({'configuracion': label,
            'medianaMs': statistics.median(r['totalMs'] for r in group),
            'medianaCpuMs': statistics.median(r['cpuMs'] for r in group),
            'maxSumaPicosRssBytes': max(r['sumaPicosRssBytes'] for r in group),
            'fallos': sum(r['fallos'] for r in group),
            'calidades': [r['calidad'] for r in group]})
    (output_path / 'resumen.json').write_text(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
