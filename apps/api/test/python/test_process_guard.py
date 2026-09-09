"""Protocolo real por descriptor; plazos cortos sólo en esta prueba unitaria."""
import importlib.util
import os
from pathlib import Path
import threading
import time
import unittest

spec = importlib.util.spec_from_file_location('process_guard', Path(__file__).resolve().parents[2] / 'src/workers/geometria/python/process_guard.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class ProcessGuardTest(unittest.TestCase):
    def setUp(self):
        self.read, self.write = os.pipe()

    def tearDown(self):
        os.close(self.read)
        if self.write is not None:
            os.close(self.write)

    def test_eof(self):
        os.close(self.write)
        self.write = None
        self.assertEqual(guard.wait_for_coordinator(self.read, .1), 'eof')

    def test_silence(self):
        started = time.monotonic()
        self.assertEqual(guard.wait_for_coordinator(self.read, .1), 'silencio')
        self.assertGreaterEqual(time.monotonic() - started, .09)

    def test_heartbeats_keep_guard_alive(self):
        result = []
        thread = threading.Thread(target=lambda: result.append(guard.wait_for_coordinator(self.read, .3)))
        thread.start()
        for _ in range(8):
            os.write(self.write, b'.')
            time.sleep(.05)
        self.assertTrue(thread.is_alive())
        os.close(self.write)
        self.write = None
        thread.join(1)
        self.assertEqual(result, ['eof'])


if __name__ == '__main__':
    unittest.main()
