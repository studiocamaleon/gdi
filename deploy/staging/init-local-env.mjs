import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const secret = () => randomBytes(32).toString('hex');
const content = [
  '# Generado sólo para el ensayo Docker local. No usar en Fly/Neon/R2.',
  `POSTGRES_PASSWORD=${secret()}`,
  `APP_DB_PASSWORD=${secret()}`,
  `JWT_SECRET=${secret()}`,
  `INTEGRACIONES_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`,
  'BOOTSTRAP_ADMIN_EMAIL=admin@staging.example.invalid',
  'BOOTSTRAP_ADMIN_NAME=Administrador de ensayo',
  `BOOTSTRAP_ADMIN_PASSWORD=${secret()}`,
  'STAGING_ACCESS_USER=ensayo',
  `STAGING_ACCESS_PASSWORD=${secret()}`,
  `STAGING_WEB_API_TOKEN=${secret()}`,
  '',
].join('\n');
// wx: nunca reemplazar claves de una instalación ya inicializada.
writeFileSync(new URL('.env', import.meta.url), content, { mode: 0o600, flag: 'wx' });
console.log('Variables de ensayo creadas en deploy/staging/.env (archivo privado).');
