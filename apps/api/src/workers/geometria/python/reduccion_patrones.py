"""Descarta columnas mediante un certificado dual comprobado con enteros.

SciPy sólo propone los pesos. Para cualquier selección entera x >= 0, A x = d:
  S sum(x) = d.Y + sum_j (S - A_j.Y) x_j.
Si A_j.Y <= S para todas las columnas, todos los residuos son no negativos.
Una columna con residuo > S B - d.Y no puede usarse ni una vez en un plan de
hasta B placas. Esto conserva TODOS los planes <= B, incluido el que usa menos
patrones. La garantía corresponde a esta cartera, no a toda geometría posible.
"""
import numpy as np
from scipy.optimize import linprog

ESCALA = 1_000_000


def certificar_dual(A, demanda, pesos):
    """Devuelve un certificado exacto o None. Las cotas previenen overflow int64."""
    A, demanda = np.asarray(A), np.asarray(demanda)
    try:
        pesos = np.asarray(pesos, dtype=float)
    except (ValueError, TypeError):
        return None
    if (A.ndim != 2 or not A.size or A.size > 2_000_000 or
            demanda.shape != (A.shape[0],) or pesos.shape != demanda.shape or
            not np.issubdtype(A.dtype, np.integer) or
            not np.issubdtype(demanda.dtype, np.integer) or
            np.any(A < 0) or np.any(A > 10_000) or
            np.any(demanda < 0) or np.any(demanda > 10_000) or
            not np.all(np.isfinite(pesos)) or np.any(np.abs(pesos) > 1_000_000)):
        return None
    A, demanda = A.astype(np.int64), demanda.astype(np.int64)
    if (A.shape[0] > 500 or demanda.sum() > 10_000 or
            np.any(A.sum(axis=0) <= 0) or np.any(A.sum(axis=0) > 10_000)):
        return None
    Y = np.floor(pesos.astype(float) * ESCALA).astype(np.int64)
    exceso = max(0, int((A.T @ Y).max()) - ESCALA)
    if exceso > ESCALA:
        return None  # Propuesta muy alejada de factibilidad: conservar cartera.
    # A es no negativa y cada columna suma al menos uno. Restar el exceso a
    # todos los pesos resta al menos ese exceso en cada producto escalar.
    Y -= exceso
    residuos = ESCALA - A.T @ Y
    if np.any(residuos < 0):
        return None
    return {'pesos': Y, 'escala': ESCALA, 'residuos': residuos,
            'cotaNumerador': int(demanda @ Y)}


def proponer_certificado(A, demanda, segundos):
    if segundos <= 0 or A.size > 2_000_000:
        return None
    result = linprog(np.ones(A.shape[1]), A_eq=A, b_eq=demanda,
                     bounds=(0, None), method='highs',
                     options={'time_limit': segundos})
    if result.status != 0 or result.eqlin.marginals is None:
        return None
    return certificar_dual(A, demanda, result.eqlin.marginals)


def indices_admisibles(certificado, placas):
    if type(placas) is not int or not 0 <= placas <= 10_000:
        return None
    margen = certificado['escala'] * placas - certificado['cotaNumerador']
    if margen < 0:
        return None  # Contradice el plan factible: no aplicar una reducción.
    # La igualdad se conserva: puede pertenecer a una solución de B placas.
    return np.flatnonzero(certificado['residuos'] <= margen)
