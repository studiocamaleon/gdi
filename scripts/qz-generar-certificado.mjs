#!/usr/bin/env node
// Genera una identidad propia para instalaciones que administran su raíz QZ.
// La clave privada queda fuera del repositorio; nunca se copia a los puestos.
import { existsSync, mkdirSync, chmodSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const destino = resolve(process.argv[2] || '.tmp/qz-signing');
mkdirSync(destino, { recursive: true, mode: 0o700 });
chmodSync(destino, 0o700);
const key = join(destino, 'private-key.pem');
const cert = join(destino, 'digital-certificate.pem');
if (existsSync(key) || existsSync(cert)) {
  console.error('Ya existe una identidad en ese directorio. Se conserva: usá otro directorio para una renovación.');
  process.exit(1);
}
process.umask(0o077);
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', key, '-out', cert, '-sha256', '-days', '365', '-nodes', '-subj', '/CN=Grafo Impresion/O=Grafo/OU=Etiquetas', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,digitalSignature,keyCertSign'], { stdio: ['ignore', 'ignore', 'ignore'] });
copyFileSync(cert, join(destino, 'override.crt'));
console.log(`Identidad creada en ${destino}.\nConfigurá en el API:\nQZ_SIGNING_PRIVATE_KEY_PATH=${key}\nQZ_SIGNING_CERTIFICATE_PATH=${cert}\n\nSólo override.crt se instala en QZ Tray. La clave privada permanece en el servidor.`);
