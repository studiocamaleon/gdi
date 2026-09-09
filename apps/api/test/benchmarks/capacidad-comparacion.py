"""Comparación controlada del despertar de cola y aceptación geométrica real.

Opcional --frontend-pid pausa sólo un next-server verificado y lo reanuda en
finally. No modifica código, bibliotecas ni cotizaciones durante la medición.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import signal
import subprocess


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--frontend-pid', type=int)
    parser.add_argument('--native', required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[4]
    folder = root / 'output/grafonest-transformacion-2026-09-09/capacidad-serie-controlada'
    folder.mkdir(parents=True, exist_ok=True)
    node = subprocess.check_output(['which', 'node'], text=True).strip()
    conditions = {'sistema': platform.platform(), 'cpuLogicas': os.cpu_count(),
                  'frontendPausado': args.frontend_pid,
                  'nativeSha256': hashlib.sha256(Path(args.native).read_bytes()).hexdigest(),
                  'node': subprocess.check_output([node, '--version'], text=True).strip()}
    sources = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
               for p in (root / 'apps/api/src/workers').rglob('*') if p.suffix in ('.ts', '.py', '.lua')}
    (folder / 'condiciones.json').write_text(json.dumps(conditions, indent=2))
    (folder / 'fuentes.json').write_text(json.dumps(sources, indent=2))
    paused = False
    def run(command, env, log):
        with log.open('w') as out:
            subprocess.run(command, cwd=root, env=env, stdout=out, stderr=subprocess.STDOUT, check=True, timeout=180)
    def stop(_signal, _frame):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, stop)
    try:
        if args.frontend_pid:
            command = subprocess.check_output(['ps', '-p', str(args.frontend_pid), '-o', 'command='], text=True).strip()
            if not command.startswith('next-server '):
                raise RuntimeError('El PID no es el next-server esperado.')
            os.kill(args.frontend_pid, signal.SIGSTOP)
            paused = True
        rows = []
        for label, no_wake in [('sin-despertar', '1'), ('con-despertar', '0')]:
            destination = folder / label
            run([node, 'apps/api/test/benchmarks/capacidad-colas.cjs', str(destination)],
                {**os.environ, 'GRAFONEST_BENCH_NO_WAKE': no_wake}, folder / f'{label}.log')
            row = json.loads((destination / 'aceptacion.json').read_text())
            rows.append({'variante': label, **row})
            print(json.dumps(rows[-1]), flush=True)
        source = root / 'output/grafonest-transformacion-2026-09-09/serie-controlada/geometrias/puma/entrada.json'
        geometry = []
        for repetition in range(3):
            for label, native in ([('nativo','1'),('actual','0')] if repetition % 2 else [('actual','0'),('nativo','1')]):
                destination = folder / f'puma-{repetition}-{label}'
                run([node, 'apps/api/test/benchmarks/grafonest-portafolio.cjs', str(source), str(destination), '15000'],
                    {**os.environ, 'GRAFONEST_PACKINGSOLVER_ENABLED': native, 'PACKINGSOLVER_BIN': args.native}, folder / f'puma-{repetition}-{label}.log')
                row = json.loads((destination / 'mediciones.json').read_text())
                geometry.append({'repeticion': repetition, 'variante': label, **row})
                print(json.dumps({k: geometry[-1][k] for k in ('repeticion','variante','retornoMs','placas','patrones')}), flush=True)
        (folder / 'comparacion.json').write_text(json.dumps({'colas': rows, 'geometria': geometry}, indent=2))
    finally:
        if paused:
            os.kill(args.frontend_pid, signal.SIGCONT)
            (folder / 'frontend-reanudado.txt').write_text(str(args.frontend_pid))


if __name__ == '__main__':
    main()
