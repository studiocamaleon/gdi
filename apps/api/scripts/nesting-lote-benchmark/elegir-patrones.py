"""Selección exacta de patrones de una cartera finita. No prueba óptimo geométrico global."""
import json
import os
import sys
import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp
from scipy.sparse import csc_matrix, diags, eye, hstack, vstack

folder = sys.argv[1]
with open(os.path.join(folder, 'cartera.json')) as f:
    patterns = json.load(f)
with open(os.path.join(folder, 'demanda.json')) as f:
    demand = np.array(json.load(f))
A = np.array([p['counts'] for p in patterns]).T
n = A.shape[1]
ub = np.array([min(int(demand[i] // v) for i, v in enumerate(p['counts']) if v) for p in patterns])
first = milp(c=np.ones(n), integrality=np.ones(n), bounds=Bounds(np.zeros(n), ub),
             constraints=LinearConstraint(A, demand, demand), options={'time_limit': 45, 'mip_rel_gap': 0})
if first.x is None:
    raise RuntimeError('No se encontró un plan completo: ' + first.message)


def selection(values):
    integers = np.rint(values).astype(int)
    if np.any(integers < 0) or not np.array_equal(A @ integers, demand):
        raise RuntimeError('La selección no respeta las cantidades exactas.')
    return [{'patron': i, 'repeticiones': int(x), 'counts': patterns[i]['counts']}
            for i, x in enumerate(integers) if x > 0]


selected = selection(first.x)
plates = sum(p['repeticiones'] for p in selected)
# Segundo objetivo: minimizar patrones distintos sin aumentar las placas.
M = vstack([hstack([csc_matrix(A), csc_matrix((len(demand), n))]),
            hstack([csc_matrix(np.ones((1, n))), csc_matrix((1, n))]),
            hstack([eye(n), -diags(ub)])], format='csc')
second = milp(c=np.r_[np.zeros(n), np.ones(n)], integrality=np.ones(2*n),
              bounds=Bounds(np.zeros(2*n), np.r_[ub, np.ones(n)]),
              constraints=LinearConstraint(M, np.r_[demand, plates, np.full(n, -np.inf)],
                                           np.r_[demand, plates, np.zeros(n)]),
              options={'time_limit': 45, 'mip_rel_gap': 0})
if second.x is not None:
    candidate = selection(second.x[:n])
    if len(candidate) < len(selected):
        selected = candidate
plan = {'placas': plates, 'seleccion': selected,
        'optimoPlacasDentroCartera': first.status == 0,
        'limitePlacasDentroCartera': float(first.mip_dual_bound),
        'optimoPatronesDentroCartera': second.status == 0,
        'limitePatronesDentroCartera': float(second.mip_dual_bound) if second.x is not None else None,
        'optimoGeometricoGlobalDemostrado': False}
with open(os.path.join(folder, 'plan.json'), 'w') as f:
    json.dump(plan, f)
print(json.dumps({'placas': plates, 'patrones': len(selected), 'optimoGlobalDemostrado': False}))
