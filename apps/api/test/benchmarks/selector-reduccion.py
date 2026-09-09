"""A/B del selector con matriz congelada, mismo presupuesto y proceso nuevo.

Incluye tiempo de importación y preparación. Valida cada candidato por enteros
independientes de NumPy/HiGHS. SIGTERM/SIGKILL respetan el plazo externo.
"""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[4]
DIR=ROOT/'output/grafonest-transformacion-2026-09-09/validacion-patrones'
OUT=Path(os.environ.get('GRAFONEST_BENCH_OUTPUT', str(DIR)))


def execute(name, source, version, budget, repetition):
    data=json.loads(source.read_text());data['timeoutMs']=budget
    runner=DIR/'selector-anterior.py' if version=='anterior' else ROOT/'apps/api/src/workers/geometria/python/patrones_runner.py'
    start=time.monotonic()
    child=subprocess.Popen([sys.executable,str(runner)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                           text=True,start_new_session=True,env={**os.environ,'GRAFONEST_SELECTOR_THREADS':'0'})
    timed_out=False
    try:
        stdout,stderr=child.communicate(json.dumps(data),timeout=budget/1000)
    except subprocess.TimeoutExpired:
        timed_out=True;os.killpg(child.pid,signal.SIGTERM)
        try:stdout,stderr=child.communicate(timeout=.25)
        except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);stdout,stderr=child.communicate()
    elapsed=(time.monotonic()-start)*1000
    plans=[]
    for line in stdout.splitlines():
        if not line.startswith('GRAFO_OPENNEST_RESULT:'):continue
        plan=json.loads(line.split(':',1)[1]);qty=[0]*len(data['demanda']);seen=set()
        for item in plan['seleccion']:
            index,copies=item['patron'],item['repeticiones']
            assert type(index) is int and index not in seen and 0<=index<len(data['patrones'])
            assert type(copies) is int and copies>0
            seen.add(index)
            for i,n in enumerate(data['patrones'][index]['counts']):qty[i]+=n*copies
        assert qty==data['demanda']
        assert sum(p['repeticiones'] for p in plan['seleccion'])==plan['placas']
        plans.append(plan)
    if not plans:raise RuntimeError(f'{name}/{version} sin candidato: {stderr}')
    score=lambda p:(p['placas'],len(p['seleccion']))
    assert all(score(b)<=score(a) for a,b in zip(plans,plans[1:])), 'No degradar el candidato anterior.'
    # Los candidatos son monótonos. El último conserva también certificados
    # que mejoraron aunque placas/patrones empaten con el candidato inicial.
    best=plans[-1]
    file=OUT/f'selector-{name}-{budget}-{repetition}-{version}'
    file.with_suffix('.stdout').write_text(stdout);file.with_suffix('.stderr').write_text(stderr)
    file.with_suffix('.json').write_text(json.dumps(best))
    row={'caso':name,'variante':version,'repeticion':repetition,'presupuestoMs':budget,'retornoMs':elapsed,
         'placas':best['placas'],'patrones':len(best['seleccion']),'candidatos':len(plans),'timeoutExterno':timed_out,
         'minimoPlacasCartera':best['optimoPlacasDentroCartera'],'minimoPatronesCartera':best['optimoPatronesDentroCartera']}
    print(json.dumps(row),flush=True);return row


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files=[('base',ROOT/'output/grafonest-transformacion-2026-09-09/recursos-selector/entrada-inicial.json'),
           ('sin-inicial',ROOT/'output/auditoria-grafonest-2026-09-09/evidencia/selector-input.json'),
           ('nativo',DIR/'matriz-nativa.json')]
    rows=[]
    for rep in range(int(os.environ.get('GRAFONEST_BENCH_REPETICIONES','2'))):
        for name,file in files:
            for version in (['actual','anterior'] if rep%2 else ['anterior','actual']):
                rows.append(execute(name,file,version,15000,rep))
    (OUT/'selector-mediciones.json').write_text(json.dumps(rows,indent=2))


if __name__=='__main__':main()
