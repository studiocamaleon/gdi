"""Verificación exhaustiva de la reducción, independiente de las salidas MILP."""
import importlib.util
import io
import json
import os
from pathlib import Path
import random
import runpy
import subprocess
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

RUNNERS = Path(__file__).resolve().parents[2] / 'src/workers/geometria/python'
spec = importlib.util.spec_from_file_location('reduccion_patrones', RUNNERS / 'reduccion_patrones.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReducedCostTests(unittest.TestCase):
    def test_cold_search_keeps_full_primary_and_secondary_formulations(self):
        patterns = [{'counts': [1, 0]}] * 64 + [{'counts': [0, 1]}] * 64
        payload = {'patrones': patterns, 'demanda': [1, 1], 'timeoutMs': 5000}
        calls, output = [], io.StringIO()
        def solve(**kwargs):
            calls.append(len(kwargs['c']))
            if len(calls) == 1:
                values = np.zeros(128); values[0] = values[64] = 1
                return SimpleNamespace(x=values, status=0, mip_dual_bound=2)
            return SimpleNamespace(x=None, status=1)
        with patch.dict(sys.modules, {'reduccion_patrones': module}), \
                patch.object(module, 'proponer_certificado', side_effect=AssertionError('No reducir una búsqueda fría')), \
                patch('sys.stdin', io.StringIO(json.dumps(payload))), patch('sys.stdout', output), \
                patch('scipy.optimize.milp', solve):
            runpy.run_path(str(RUNNERS / 'patrones_runner.py'))
        self.assertEqual(calls, [128, 256])
        final = json.loads(output.getvalue().splitlines()[-1].split(':', 1)[1])
        self.assertEqual((final['placas'], len(final['seleccion'])), (2, 2))

    def test_known_plan_above_certified_minimum_still_searches_fewer_boards(self):
        patterns = [{'counts': [1, 1]}] * 127 + [{'counts': [2, 2]}]
        payload = {'patrones': patterns, 'demanda': [2, 2], 'timeoutMs': 5000,
                   'seleccionInicial': [{'patron': 0, 'repeticiones': 2}]}
        certificate = module.certificar_dual(np.array([p['counts'] for p in patterns]).T, np.array([2, 2]), [.25, .25])
        output, diagnostic = io.StringIO(), io.StringIO()
        def solve(**kwargs):
            self.assertEqual(len(kwargs['c']), 128)
            values = np.zeros(128); values[127] = 1
            return SimpleNamespace(x=values, status=0, mip_dual_bound=1)
        with patch.dict(sys.modules, {'reduccion_patrones': module}), \
                patch.dict(os.environ, {'GRAFONEST_SELECTOR_REDUCCION': '1'}), \
                patch.object(module, 'proponer_certificado', return_value=certificate), \
                patch('sys.stdin', io.StringIO(json.dumps(payload))), patch('sys.stdout', output), \
                patch('sys.stderr', diagnostic), patch('scipy.optimize.milp', solve):
            runpy.run_path(str(RUNNERS / 'patrones_runner.py'))
        plans = [json.loads(line.split(':', 1)[1]) for line in output.getvalue().splitlines()]
        self.assertEqual([p['placas'] for p in plans], [2, 1])
        self.assertNotIn('reduccion-certificada', diagnostic.getvalue())

    def test_disabled_reduction_does_not_spend_time_proposing_a_certificate(self):
        patterns = [{'counts': [1]}] * 128
        payload = {'patrones': patterns, 'demanda': [1], 'timeoutMs': 5000,
                   'seleccionInicial': [{'patron': 127, 'repeticiones': 1}]}
        values = np.zeros(128); values[127] = 1
        with patch.dict(sys.modules, {'reduccion_patrones': module}), \
                patch.dict(os.environ, {'GRAFONEST_SELECTOR_REDUCCION': '0'}), \
                patch.object(module, 'proponer_certificado', side_effect=AssertionError('Desactivado')), \
                patch('sys.stdin', io.StringIO(json.dumps(payload))), patch('sys.stdout', io.StringIO()), \
                patch('scipy.optimize.milp', return_value=SimpleNamespace(x=values, status=0, mip_dual_bound=1)) as solver:
            runpy.run_path(str(RUNNERS / 'patrones_runner.py'))
        solver.assert_called_once()

    def test_preserves_every_feasible_plan_up_to_incumbent_in_small_problems(self):
        randomizer = random.Random(824571)
        solutions_by_bound = {}
        def enumerate_solutions(columns, remaining, prefix=()):
            if not columns:
                yield prefix
                return
            for value in range(remaining + 1):
                yield from enumerate_solutions(columns - 1, remaining - value, prefix + (value,))
        checks, removed = 0, 0
        for _ in range(80):
            A = np.array([[randomizer.randrange(4) for _ in range(5)] for _ in range(3)], dtype=np.int64)
            if np.any(A.sum(axis=0) == 0):
                continue
            known = np.array([randomizer.randrange(3) for _ in range(5)], dtype=np.int64)
            d, B = A @ known, int(known.sum())
            if not B:
                continue
            if B not in solutions_by_bound:
                solutions_by_bound[B] = np.array(list(enumerate_solutions(5, B)), dtype=np.int64)
            solutions = solutions_by_bound[B]
            certificate = module.proponer_certificado(A, d, .5)
            self.assertIsNotNone(certificate)
            allowed = set(module.indices_admisibles(certificate, B).tolist())
            removed += A.shape[1] - len(allowed)
            # No sólo el óptimo: se conservan todas las soluciones factibles
            # de hasta B placas, incluidas las de menor cantidad de patrones.
            feasible = solutions[(solutions.sum(axis=1) <= B) & np.all(solutions @ A.T == d, axis=1)]
            for x in feasible:
                self.assertTrue(set(np.flatnonzero(x)).issubset(allowed))
                checks += 1
        self.assertGreater(checks, 50)
        self.assertGreater(removed, 0)

    def test_keeps_equality_at_reduced_cost_boundary(self):
        A = np.array([[1, 0, 1], [0, 1, 1]], dtype=np.int64)
        c = module.certificar_dual(A, np.array([1, 1]), [.5, .5])
        self.assertEqual(module.indices_admisibles(c, 1).tolist(), [2])
        self.assertEqual(module.indices_admisibles(c, 2).tolist(), [0, 1, 2])

    def test_repairs_numerical_dual_infeasibility_with_exact_integer_check(self):
        A = np.array([[1, 0, 1], [0, 1, 1]], dtype=np.int64)
        c = module.certificar_dual(A, np.array([4, 4]), [.500001, .500002])
        self.assertIsNotNone(c)
        self.assertTrue(np.all(A.T @ c['pesos'] <= c['escala']))
        self.assertLessEqual(c['cotaNumerador'], 4 * c['escala'])

    def test_handles_negative_dual_weights(self):
        A = np.array([[2, 1], [1, 1]], dtype=np.int64)
        c = module.certificar_dual(A, np.array([3, 2]), [1, -1])
        self.assertTrue(np.all(c['residuos'] >= 0))
        self.assertEqual(module.indices_admisibles(c, 2).tolist(), [0, 1])

    def test_rejects_bad_duals_and_overflow_ranges(self):
        A, d = np.array([[1, 0], [0, 1]]), np.array([1, 1])
        for weights in ([float('nan'), 0], [float('inf'), 0], [1e20, 0], ['invalid', 0], [1e6, 1e6]):
            self.assertIsNone(module.certificar_dual(A, d, weights))
        self.assertIsNone(module.certificar_dual(np.array([[10**18]]), np.array([1]), [1]))
        self.assertIsNone(module.certificar_dual(np.array([[-1]]), np.array([1]), [1]))
        self.assertIsNone(module.certificar_dual(np.array([[0]]), np.array([1]), [1]))
        self.assertIsNone(module.certificar_dual(np.array([[1]]), np.array([10**18]), [1]))

    def test_real_runner_preserves_original_indices_and_certifies_only_the_portfolio(self):
        # 127 columnas ineficientes: el índice útil está al final y debe
        # mantenerse al pasar entre matrices reducidas y geometría original.
        patterns = [{'counts': [1, 0]}] * 64 + [{'counts': [0, 1]}] * 63 + [{'counts': [10, 10]}]
        payload = {'patrones': patterns, 'demanda': [100, 100], 'timeoutMs': 5000,
                   'seleccionInicial': [{'patron': 127, 'repeticiones': 10}]}
        result = subprocess.run([sys.executable, str(RUNNERS / 'patrones_runner.py')], input=json.dumps(payload), text=True, capture_output=True, timeout=8)
        self.assertEqual(result.returncode, 0, result.stderr)
        plans = [json.loads(line.split(':', 1)[1]) for line in result.stdout.splitlines() if line.startswith('GRAFO_OPENNEST_RESULT:')]
        self.assertEqual(plans[-1]['seleccion'], [{'patron': 127, 'repeticiones': 10, 'counts': [10, 10]}])
        self.assertTrue(plans[-1]['optimoPlacasDentroCartera'])
        self.assertFalse(plans[-1]['optimoGeometricoGlobalDemostrado'])
        diagnostics = [json.loads(line) for line in result.stderr.splitlines() if line.startswith('{')]
        self.assertLess(diagnostics[0]['despues'], 128)


if __name__ == '__main__':
    unittest.main()
