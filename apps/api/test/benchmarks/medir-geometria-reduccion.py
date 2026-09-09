"""Medición serial sin compilación concurrente; reanuda el frontend en finally."""
import hashlib
import json
import os
from pathlib import Path
import platform
import signal
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[4]
DIR=Path(os.environ.get('GRAFONEST_BENCH_OUTPUT', str(ROOT/'output/grafonest-transformacion-2026-09-09/validacion-patrones')))


def main():
    DIR.mkdir(parents=True, exist_ok=True)
    pid=int(sys.argv[1]);paused=False
    command=subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()
    if not command.startswith('next-server '):raise RuntimeError('No es el frontend esperado.')
    sources={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
             for p in (ROOT/'apps/api/src/workers/geometria').rglob('*') if p.suffix in ('.ts','.py','.lua')}
    (DIR/'fuentes.json').write_text(json.dumps(sources,indent=2))
    (DIR/'condiciones.json').write_text(json.dumps({'sistema':platform.platform(),'cpuLogicas':os.cpu_count(),'frontendPausado':pid,
        'datosComercialesModificados':False,'variantes':'procesos nuevos, mismo presupuesto; orden alternado'},indent=2))
    def stop(_signal,_frame):raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM,stop)
    try:
        os.kill(pid,signal.SIGSTOP);paused=True
        for script,command,timeout in [
            ('geometria',['node','--expose-gc','apps/api/test/benchmarks/validacion-patrones.cjs'],120),
            ('selector',[sys.executable,'apps/api/test/benchmarks/selector-reduccion.py'],240),
        ]:
            if os.environ.get('GRAFONEST_BENCH_ETAPA') not in (None, script):
                continue
            with (DIR/f'{script}-controlado.log').open('w') as log:
                subprocess.run(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=timeout)
            print(script+' completado',flush=True)
    finally:
        if paused:
            os.kill(pid,signal.SIGCONT)
            (DIR/'frontend-reanudado.txt').write_text(str(pid))


if __name__=='__main__':main()
