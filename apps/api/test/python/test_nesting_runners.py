import io
import json
import os
from pathlib import Path
import runpy
import sys
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

RUNNERS = Path(__file__).resolve().parents[2] / 'src/workers/geometria/python'


class PatternProtocolTests(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(os.environ, {'GRAFONEST_SELECTOR_THREADS': '1'})
        environment.start()
        self.addCleanup(environment.stop)

    def test_emits_feasible_plan_before_secondary_failure(self):
        output = io.StringIO()
        calls = []
        def solve(**kwargs):
            calls.append(kwargs)
            self.assertEqual(kwargs['options']['threads'], 1)
            if len(calls) == 1:
                return SimpleNamespace(x=np.array([1, 1]), status=0, mip_dual_bound=2)
            self.assertIn('GRAFO_OPENNEST_RESULT:', output.getvalue())
            raise RuntimeError('fallo del segundo objetivo')
        payload = {'patrones': [{'counts': [1, 0]}, {'counts': [0, 1]}], 'demanda': [1, 1], 'timeoutMs': 10000}
        with patch('sys.stdin', io.StringIO(json.dumps(payload))), patch('sys.stdout', output), patch('scipy.optimize.milp', solve):
            with self.assertRaisesRegex(RuntimeError, 'segundo objetivo'):
                runpy.run_path(str(RUNNERS / 'patrones_runner.py'))
        plan = json.loads(output.getvalue().split(':', 1)[1])
        self.assertEqual(plan['placas'], 2)
        self.assertEqual(len(plan['seleccion']), 2)
        self.assertFalse(plan['optimoPatronesDentroCartera'])
        self.assertFalse(plan['optimoGeometricoGlobalDemostrado'])

    def test_real_selector_fulfills_exact_demand_and_avoids_unnecessary_secondary_solve(self):
        output = io.StringIO()
        payload = {'patrones': [{'counts': [1, 1]}, {'counts': [1, 0]}, {'counts': [0, 1]}], 'demanda': [5, 5], 'timeoutMs': 5000}
        with patch('sys.stdin', io.StringIO(json.dumps(payload))), patch('sys.stdout', output):
            runpy.run_path(str(RUNNERS / 'patrones_runner.py'))
        plans = [json.loads(line.split(':', 1)[1]) for line in output.getvalue().splitlines()]
        self.assertEqual(len(plans), 1)
        self.assertEqual(plans[0]['placas'], 5)
        self.assertEqual(plans[0]['seleccion'], [{'patron': 0, 'repeticiones': 5, 'counts': [1, 1]}])
        self.assertTrue(plans[0]['optimoPatronesDentroCartera'])

    def test_never_emits_incomplete_primary_solution(self):
        output = io.StringIO()
        payload = {'patrones': [{'counts': [1, 0]}], 'demanda': [1, 1], 'timeoutMs': 5000}
        with patch('sys.stdin', io.StringIO(json.dumps(payload))), patch('sys.stdout', output):
            with self.assertRaisesRegex(RuntimeError, 'plan completo'):
                runpy.run_path(str(RUNNERS / 'patrones_runner.py'))
        self.assertEqual(output.getvalue(), '')

    def test_explicit_thread_limit_reaches_highs_and_blas(self):
        payload = {'patrones': [{'counts': [1]}], 'demanda': [3], 'timeoutMs': 5000}
        def solve(**kwargs):
            self.assertEqual(kwargs['options']['threads'], 3)
            self.assertEqual(os.environ['OPENBLAS_NUM_THREADS'], '3')
            return SimpleNamespace(x=np.array([3]), status=0, mip_dual_bound=3)
        with patch.dict(os.environ, {'GRAFONEST_SELECTOR_THREADS': '3'}), \
                patch('sys.stdin', io.StringIO(json.dumps(payload))), \
                patch('sys.stdout', io.StringIO()), patch('scipy.optimize.milp', solve):
            runpy.run_path(str(RUNNERS / 'patrones_runner.py'))

    def test_emits_known_plan_first_and_never_replaces_it_with_more_patterns(self):
        output = io.StringIO()
        payload = {'patrones': [{'counts': [1, 1]}, {'counts': [2, 0]}, {'counts': [0, 2]}],
                   'demanda': [2, 2], 'timeoutMs': 5000,
                   'seleccionInicial': [{'patron': 0, 'repeticiones': 2}]}
        def solve(**kwargs):
            initial = json.loads(output.getvalue().split(':', 1)[1])
            self.assertEqual(initial['placas'], 2)
            self.assertFalse(initial['optimoPlacasDentroCartera'])
            self.assertTrue(np.array_equal(kwargs['constraints'].ub, [2, 2]))
            return SimpleNamespace(x=np.array([0, 1, 1]), status=0, mip_dual_bound=2)
        with patch('sys.stdin', io.StringIO(json.dumps(payload))), patch('sys.stdout', output), patch('scipy.optimize.milp', solve):
            runpy.run_path(str(RUNNERS / 'patrones_runner.py'))
        final = json.loads(output.getvalue().splitlines()[-1].split(':', 1)[1])
        self.assertEqual(final['seleccion'], [{'patron': 0, 'repeticiones': 2, 'counts': [1, 1]}])
        self.assertTrue(final['optimoPlacasDentroCartera'])

    def test_continues_from_known_plan_when_primary_budget_runs_out(self):
        output, calls = io.StringIO(), []
        payload = {'patrones': [{'counts': [1, 0]}, {'counts': [0, 1]}],
                   'demanda': [1, 1], 'timeoutMs': 5000,
                   'seleccionInicial': [{'patron': 0, 'repeticiones': 1}, {'patron': 1, 'repeticiones': 1}]}
        def solve(**kwargs):
            calls.append(kwargs)
            if len(calls) == 1:
                return SimpleNamespace(x=None, status=1, message='tiempo agotado')
            self.assertEqual(kwargs['constraints'].ub[-1], 2)
            return SimpleNamespace(x=np.array([1, 1, 1, 1]), status=0, mip_dual_bound=2)
        with patch('sys.stdin', io.StringIO(json.dumps(payload))), patch('sys.stdout', output), patch('scipy.optimize.milp', solve):
            runpy.run_path(str(RUNNERS / 'patrones_runner.py'))
        final = json.loads(output.getvalue().splitlines()[-1].split(':', 1)[1])
        self.assertFalse(final['optimoPlacasDentroCartera'])
        self.assertTrue(final['optimoPatronesDentroCartera'])
        self.assertEqual(len(calls), 2)

    def test_fewer_boards_take_priority_over_fewer_patterns_in_known_plan(self):
        output, calls = io.StringIO(), []
        payload = {'patrones': [{'counts': [1, 1]}, {'counts': [4, 0]}, {'counts': [0, 4]}],
                   'demanda': [4, 4], 'timeoutMs': 5000,
                   'seleccionInicial': [{'patron': 0, 'repeticiones': 4}]}
        def solve(**kwargs):
            calls.append(kwargs)
            if len(calls) == 1:
                return SimpleNamespace(x=np.array([0, 1, 1]), status=0, mip_dual_bound=2)
            self.assertEqual(kwargs['constraints'].ub[-1], 2)
            return SimpleNamespace(x=None, status=1)
        with patch('sys.stdin', io.StringIO(json.dumps(payload))), patch('sys.stdout', output), patch('scipy.optimize.milp', solve):
            runpy.run_path(str(RUNNERS / 'patrones_runner.py'))
        plans = [json.loads(line.split(':', 1)[1]) for line in output.getvalue().splitlines()]
        self.assertEqual([(p['placas'], len(p['seleccion'])) for p in plans], [(4, 1), (2, 2)])

    def test_invalid_known_plan_is_never_emitted(self):
        for initial in [[{'patron': 0, 'repeticiones': 1}], [{'patron': -1, 'repeticiones': 2}],
                        [{'patron': 0, 'repeticiones': 1.5}], [{'patron': 0, 'repeticiones': 2}, {'patron': 0, 'repeticiones': 2}]]:
            output = io.StringIO()
            payload = {'patrones': [{'counts': [1]}], 'demanda': [2], 'timeoutMs': 5000, 'seleccionInicial': initial}
            with patch('sys.stdin', io.StringIO(json.dumps(payload))), patch('sys.stdout', output):
                with self.assertRaises((ValueError, RuntimeError)):
                    runpy.run_path(str(RUNNERS / 'patrones_runner.py'))
            self.assertEqual(output.getvalue(), '')

    def test_rejects_unbounded_or_invalid_thread_configuration(self):
        for value in ['9', '-1', '1.5', 'automatico']:
            with self.subTest(value=value), patch.dict(os.environ, {'GRAFONEST_SELECTOR_THREADS': value}):
                with self.assertRaisesRegex(ValueError, 'entre 0 y 8'):
                    runpy.run_path(str(RUNNERS / 'patrones_runner.py'))


class NativeDeadlineTests(unittest.TestCase):
    def test_cancels_cooperatively_at_global_deadline(self):
        runner = runpy.run_path(str(RUNNERS / 'opennest_runner.py'))
        class Handle:
            cancelled = False
            def is_running(self): return not self.cancelled
            def cancel(self): self.cancelled = True
            def wait(self): return 'terminado'
        handle = Handle()
        solver = SimpleNamespace(start=lambda *args: handle)
        result = runner['_solve_until'](solver, None, None, time.monotonic() + 0.01)
        self.assertTrue(handle.cancelled)
        self.assertEqual(result, 'terminado')

    def test_captures_candidate_without_waiting_indefinitely_for_native_thread(self):
        runner = runpy.run_path(str(RUNNERS / 'opennest_runner.py'))
        handle = SimpleNamespace(is_running=lambda: True, cancel=lambda: None, snapshot=lambda: 'requiere-validacion')
        solver = SimpleNamespace(start=lambda *args: handle)
        start = time.monotonic()
        result = runner['_solve_until'](solver, None, None, start + 0.01)
        self.assertEqual(result, 'requiere-validacion')
        self.assertLess(time.monotonic() - start, 1)


if __name__ == '__main__':
    unittest.main()
