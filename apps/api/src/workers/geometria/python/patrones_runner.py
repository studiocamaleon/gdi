"""Selecciona cantidades exactas y entrega cada plan antes de seguir mejorándolo."""
import json
import os
import sys
import time
import warnings

if os.environ.get('GRAFONEST_GUARD_FD'):
    from process_guard import start_guard
    start_guard()

# El arranque y los imports consumen el mismo presupuesto que el optimizador.
started = time.monotonic()
# Cada proceso pertenece a un trabajo: no dejar que HiGHS/BLAS se repartan
# automáticamente los núcleos de todo el servidor cuando se fija una cuota.
# El valor 0 conserva el comportamiento previo hasta completar el corpus de carga.
try:
    threads = int(os.environ.get('GRAFONEST_SELECTOR_THREADS', '0'))
    if not 0 <= threads <= 8:
        raise ValueError('fuera de rango')
except ValueError:
    raise ValueError('GRAFONEST_SELECTOR_THREADS debe ser un entero entre 0 y 8.')
for variable in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS',
                 'VECLIB_MAXIMUM_THREADS', 'NUMEXPR_NUM_THREADS'):
    if threads:
        os.environ[variable] = str(threads)
import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp
from scipy.sparse import csc_matrix, diags, eye, hstack, vstack
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reduccion_patrones import proponer_certificado, indices_admisibles

payload = json.load(sys.stdin)
patterns = payload['patrones']
demand = np.array(payload['demanda'], dtype=int)
timeout = float(payload['timeoutMs']) / 1000
reserve = min(3.0, max(0.25, timeout * 0.1))
deadline = started + max(0.05, timeout - reserve)
A = np.array([p['counts'] for p in patterns]).T
n = A.shape[1]
indices_originales = np.arange(n)
ub = np.array([min(int(demand[i] // v) for i, v in enumerate(p['counts']) if v) for p in patterns])


def remaining():
    return max(0.0, deadline - time.monotonic())


def selection(values):
    integers = np.rint(values).astype(int)
    if np.any(integers < 0) or not np.array_equal(A @ integers, demand):
        raise RuntimeError('La selección no respeta las cantidades exactas.')
    return [{'patron': int(indices_originales[i]), 'repeticiones': int(x), 'counts': patterns[int(indices_originales[i])]['counts']}
            for i, x in enumerate(integers) if x > 0]


def emit(plan):
    print('GRAFO_OPENNEST_RESULT:' + json.dumps(plan), flush=True)


def solve(time_limit, **kwargs):
    # SciPy 1.13.1 pasa estas opciones directamente a HiGHS. Su aviso genérico
    # no indica un rechazo; silenciar sólo la opción verificada y mantener
    # visibles otros avisos de precisión/configuración del optimizador.
    with warnings.catch_warnings():
        warnings.filterwarnings('ignore',
            message=r"Unrecognized options detected: \{'threads'\}.*",
            category=RuntimeWarning)
        return milp(**kwargs, options={'time_limit': time_limit,
            'mip_rel_gap': 0, **({'threads': threads} if threads else {})})


def make_plan(selected):
    return {'placas': sum(p['repeticiones'] for p in selected), 'seleccion': selected,
            'optimoPlacasDentroCartera': False, 'limitePlacasDentroCartera': 0.0,
            'optimoPatronesDentroCartera': len(selected) == 1,
            'limitePatronesDentroCartera': 1.0,
            'optimoGeometricoGlobalDemostrado': False}


def reducir(plan):
    global A, ub, n, indices_originales
    if os.environ.get('GRAFONEST_SELECTOR_REDUCCION', '1') == '0':
        return plan
    inicio = time.monotonic()
    if n < 128 or remaining() < .25:
        return plan
    try:
        certificado = proponer_certificado(A, demand, min(.5, remaining() * .08))
    except Exception as error:
        print(json.dumps({'fase': 'reduccion-no-disponible', 'error': str(error)}), file=sys.stderr)
        return plan
    if certificado is None:
        return plan
    cota, escala = certificado['cotaNumerador'], certificado['escala']
    minimo_placas = -(-cota // escala)
    if minimo_placas != plan['placas']:
        # La formulación completa sigue buscando menos placas. El corpus de
        # 15 s mostró regresión al reducir recién después de ese primer MIP.
        # Usar el certificado para concentrar el objetivo secundario sólo si
        # el plan que ya teníamos alcanza el mínimo de esta cartera.
        return plan
    admisibles = indices_admisibles(certificado, plan['placas'])
    if admisibles is None:
        return plan
    mascara = np.isin(indices_originales, admisibles)
    conservados = set(indices_originales[mascara].tolist())
    if any(p['patron'] not in conservados for p in plan['seleccion']):
        raise RuntimeError('La reducción contradice el plan inicial validado.')
    antes = n
    A, ub, indices_originales = A[:, mascara], ub[mascara], indices_originales[mascara]
    n = A.shape[1]
    if minimo_placas == plan['placas'] and not plan['optimoPlacasDentroCartera']:
        plan = {**plan, 'optimoPlacasDentroCartera': True,
                'limitePlacasDentroCartera': max(plan['limitePlacasDentroCartera'], cota / escala)}
    print(json.dumps({'fase': 'reduccion-certificada', 'antes': antes, 'despues': n,
                      'cotaNumerador': cota, 'escala': escala,
                      'pesosNumeradores': certificado['pesos'].tolist(),
                      'placas': plan['placas'], 'primarioDemostrado': minimo_placas == plan['placas'],
                      'duracionMs': (time.monotonic() - inicio) * 1000}), file=sys.stderr)
    return plan


plan = None
if payload.get('seleccionInicial') is not None:
    values = np.zeros(n, dtype=int)
    for item in payload['seleccionInicial']:
        index, copies = item['patron'], item['repeticiones']
        if (type(index) is not int or not 0 <= index < n or
                type(copies) is not int or copies <= 0 or values[index] or copies > ub[index]):
            raise ValueError('La selección inicial es inválida.')
        values[index] = copies
    plan = make_plan(selection(values))
    # Entregar antes del MILP. Es una solución conocida, no un certificado de
    # optimalidad. Node vuelve a validar las poses de la cartera actual.
    emit(plan)

if plan is not None:
    reducido = reducir(plan)
    if reducido is not plan:
        plan = reducido
        emit(plan)

if remaining() <= 0 and plan is None:
    raise RuntimeError('El presupuesto se agotó durante la preparación del selector.')
if remaining() > 0 and not (plan and plan['optimoPlacasDentroCartera']):
    # Mantener la formulación primaria: una cota redundante de placas cambió
    # las heurísticas de HiGHS y empeoró casos cortos bajo concurrencia. El plan
    # conocido se conserva fuera del optimizador, aunque éste no lo mejore.
    first = solve(max(0.05, remaining() * 0.45),
                  c=np.ones(n), integrality=np.ones(n), bounds=Bounds(np.zeros(n), ub),
                  constraints=LinearConstraint(A, demand, demand))
    if first.x is None and plan is None:
        raise RuntimeError('No se encontró un plan completo: ' + first.message)
    if first.x is not None:
        candidate = make_plan(selection(first.x))
        if plan is None or (candidate['placas'], len(candidate['seleccion'])) < (plan['placas'], len(plan['seleccion'])):
            plan = candidate
        if first.status == 0 and plan['placas'] != candidate['placas']:
            raise RuntimeError('El certificado del selector contradice el plan inicial.')
        plan = {**plan, 'optimoPlacasDentroCartera': first.status == 0,
                'limitePlacasDentroCartera': float(first.mip_dual_bound)}
        emit(plan)

selected, plates = plan['seleccion'], plan['placas']

if len(selected) > 1 and remaining() > 0.1:
    # Segundo objetivo: menos programas distintos, sin aumentar las placas.
    M = vstack([hstack([csc_matrix(A), csc_matrix((len(demand), n))]),
                hstack([csc_matrix(np.ones((1, n))), csc_matrix((1, n))]),
                hstack([eye(n), -diags(ub)]),
                hstack([csc_matrix((1, n)), csc_matrix(np.ones((1, n)))])], format='csc')
    if remaining() > 0.05:
        second = solve(remaining(), c=np.r_[np.zeros(n), np.ones(n)], integrality=np.ones(2*n),
                      bounds=Bounds(np.zeros(2*n), np.r_[ub, np.ones(n)]),
                      constraints=LinearConstraint(M, np.r_[demand, plates, np.full(n, -np.inf), -np.inf],
                                                   np.r_[demand, plates, np.zeros(n), len(selected)]))
        if second.x is not None:
            candidate = selection(second.x[:n])
            if sum(p['repeticiones'] for p in candidate) != plates:
                raise RuntimeError('El objetivo secundario cambió la cantidad de placas.')
            if len(candidate) <= len(selected):
                plan = {**plan, 'seleccion': candidate,
                        'optimoPatronesDentroCartera': second.status == 0,
                        'limitePatronesDentroCartera': float(second.mip_dual_bound)}
                emit(plan)
