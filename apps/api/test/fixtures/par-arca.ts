import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export function parFicticio(cuit = '30000000007') {
  const dir = mkdtempSync(join(tmpdir(), 'grafo-cert-test-'));
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '2',
        '-subj',
        `/CN=Prueba ficticia/serialNumber=CUIT ${cuit}`,
        '-addext',
        'basicConstraints=critical,CA:FALSE',
        '-keyout',
        join(dir, 'test.key'),
        '-out',
        join(dir, 'test.crt'),
      ],
      { stdio: 'ignore' },
    );
    return {
      cert: readFileSync(join(dir, 'test.crt'), 'utf8'),
      key: readFileSync(join(dir, 'test.key'), 'utf8'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
