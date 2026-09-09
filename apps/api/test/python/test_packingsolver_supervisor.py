"""Fallos reales de procesos propios de prueba; no invoca el motor comercial."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest

RUNNER = Path(__file__).resolve().parents[2] / 'src/workers/geometria/python/packingsolver_runner.py'


class SupervisorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='test-packingsolver-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.pidfile = self.root / 'native.pid'
        self.binary = self.root / 'motor-falso'
        self.payload = {'ejecutable': str(self.binary), 'padrePid': os.getpid(),
                        'memoriaMb': 64, 'timeoutMs': 1200, 'instancia': {}}

    def native(self, body):
        self.binary.write_text('#!/usr/bin/env python3\n' +
            'import json, os, sys, signal, time\nfrom pathlib import Path\n' +
            f'Path({str(self.pidfile)!r}).write_text(str(os.getpid()))\n' +
            "certificate = Path(sys.argv[sys.argv.index('--certificate') + 1])\n" +
            "valid = {'bins': [{'copies': 1, 'items': [{'id': 0, 'x': 0, 'y': 0, 'angle': 0}]}]}\n" + body)
        self.binary.chmod(0o700)

    def run_supervisor(self):
        return subprocess.run([sys.executable, str(RUNNER)], input=json.dumps(self.payload),
                              text=True, capture_output=True, timeout=5)

    def wait_for(self, predicate):
        deadline = time.monotonic() + 5
        while not predicate():
            if time.monotonic() > deadline:
                self.fail('El proceso no alcanzó el estado esperado.')
            time.sleep(0.02)

    def not_running(self, pid):
        result = subprocess.run(['ps', '-o', 'stat=', '-p', str(pid)], capture_output=True, text=True)
        return not result.stdout.strip() or result.stdout.strip().startswith('Z')

    def assert_native_stopped(self):
        pid = int(self.pidfile.read_text())
        self.wait_for(lambda: self.not_running(pid))

    def test_reads_complete_certificate_after_partial_write(self):
        self.native("certificate.write_text('{\\\"bins\\\":')\ntime.sleep(0.1)\ncertificate.write_text(json.dumps(valid))\ntime.sleep(0.15)\n")
        result = self.run_supervisor()
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = [json.loads(line.split(':', 1)[1]) for line in result.stdout.splitlines()]
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0]['certificado']['bins'][0]['copies'], 1)
        self.assert_native_stopped()

    def test_external_deadline_kills_native_that_ignores_term(self):
        self.native("signal.signal(signal.SIGTERM, signal.SIG_IGN)\ncertificate.write_text(json.dumps(valid))\ntime.sleep(20)\n")
        self.payload['timeoutMs'] = 400
        start = time.monotonic()
        result = self.run_supervisor()
        self.assertLess(time.monotonic() - start, 2)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('"fin": "tiempo"', result.stderr)
        self.assertIn('GRAFO_OPENNEST_RESULT:', result.stdout)
        self.assert_native_stopped()

    def test_transfers_only_poses_from_large_geometric_certificate(self):
        self.payload['memoriaMb'] = 256
        self.native("valid['bins'][0]['items'][0]['item_shapes'] = 'x' * (9 * 1024 * 1024)\n"
                    "certificate.write_text(json.dumps(valid))\ntime.sleep(0.2)\n"
                    "valid['bins'][0]['items'][0]['item_shapes'] = 'another representation'\n"
                    "certificate.write_text(json.dumps(valid))\ntime.sleep(0.2)\n")
        result = self.run_supervisor()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertLess(len(result.stdout), 1024)
        self.assertEqual(result.stdout.count('GRAFO_OPENNEST_RESULT:'), 1)
        self.assertNotIn('item_shapes', result.stdout)
        self.assertIn('"rssTotalObservadoMb"', result.stderr)
        self.assert_native_stopped()

    def test_limits_raw_file_before_decoding(self):
        self.payload['memoriaMb'] = 128
        self.native("with certificate.open('wb') as f:\n    f.truncate(33 * 1024 * 1024)\ntime.sleep(20)\n")
        result = self.run_supervisor()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('certificado-excesivo', result.stderr)
        self.assertEqual(result.stdout, '')
        self.assert_native_stopped()

    def test_memory_guard_stops_native_and_keeps_prior_certificate(self):
        self.native("certificate.write_text(json.dumps(valid))\ntime.sleep(0.1)\nbuffer = bytearray(128 * 1024 * 1024)\ntime.sleep(20)\n")
        result = self.run_supervisor()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('"fin": "memoria"', result.stderr)
        self.assertIn('GRAFO_OPENNEST_RESULT:', result.stdout)
        self.assert_native_stopped()

    def test_cancel_cleans_up_native_even_if_it_ignores_term(self):
        self.native("signal.signal(signal.SIGTERM, signal.SIG_IGN)\ncertificate.write_text(json.dumps(valid))\ntime.sleep(20)\n")
        wrapper = subprocess.Popen([sys.executable, str(RUNNER)], stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            wrapper.stdin.write(json.dumps(self.payload)); wrapper.stdin.close()
            self.wait_for(self.pidfile.exists)
            wrapper.terminate()
            wrapper.wait(timeout=3)
            self.assert_native_stopped()
        finally:
            if wrapper.poll() is None: wrapper.kill(); wrapper.wait()
            wrapper.stdout.close(); wrapper.stderr.close()

    def test_parent_crash_does_not_leave_a_native_orphan(self):
        self.native("signal.signal(signal.SIGTERM, signal.SIG_IGN)\ncertificate.write_text(json.dumps(valid))\ntime.sleep(20)\n")
        wrapper_pid = self.root / 'wrapper.pid'
        coordinator_code = """
import json, os, subprocess, sys, time
payload = json.loads(sys.argv[2]); payload['padrePid'] = os.getpid()
with open(sys.argv[3] + '.log', 'w') as log:
    wrapper = subprocess.Popen([sys.executable, sys.argv[1]], stdin=subprocess.PIPE, stdout=log, stderr=log, text=True)
    open(sys.argv[3], 'w').write(str(wrapper.pid))
    wrapper.stdin.write(json.dumps(payload)); wrapper.stdin.close()
    time.sleep(20)
"""
        coordinator = subprocess.Popen([sys.executable, '-c', coordinator_code, str(RUNNER),
                                        json.dumps(self.payload), str(wrapper_pid)])
        try:
            self.wait_for(self.pidfile.exists)
            coordinator.kill(); coordinator.wait(timeout=3)
            self.assert_native_stopped()
            self.wait_for(lambda: self.not_running(int(wrapper_pid.read_text())))
        finally:
            if coordinator.poll() is None: coordinator.kill(); coordinator.wait()

    def test_refuses_to_start_after_parent_changed(self):
        self.native('time.sleep(20)\n')
        self.payload['padrePid'] = -1
        result = self.run_supervisor()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.pidfile.exists())


if __name__ == '__main__':
    unittest.main()
