const assert = require('node:assert/strict');
const { databaseUrl, fail } = require('./target.cjs');

async function main() {
  databaseUrl('DATABASE_URL');
  if (!process.env.DEPLOY_DATABASE_NAME.endsWith('_test')) throw new Error('Sólo ensayo local.');
  const api = 'http://api:3001/api';
  const web = 'http://web:3000';
  const apiOnly = process.env.VERIFY_API_ONLY === 'true';
  const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  assert.equal((await request(api)).status, 200);
  if (!apiOnly) {
    assert.equal((await request(`${web}/api/health`)).status, 200);
    assert.equal((await request(`${web}/login`)).status, 200);
  }
  for (const base of apiOnly ? [api] : [api, `${web}/api/backend`]) {
    const response = await request(`${base}/auth/login-plataforma`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: process.env.BOOTSTRAP_ADMIN_EMAIL, password: process.env.BOOTSTRAP_ADMIN_PASSWORD }),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(typeof body.accessToken, 'string');
    assert.equal(body.staff.rolPlataforma, 'ADMIN');
    const logout = await request(`${api}/auth/logout`, {
      method: 'POST', headers: { authorization: `Bearer ${body.accessToken}` },
    });
    assert.ok(logout.ok);
  }
  const signup = await request(`${api}/registro`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nombreCompleto: 'Ensayo de despliegue', empresaNombre: 'Empresa ficticia',
      email: 'registro-desactivado@example.invalid', password: 'ensayo-sin-envio-1234', planCodigo: 'ensayo',
      paisCodigo: 'AR', zonaHoraria: 'America/Argentina/Buenos_Aires', aceptaTerminos: true }),
  });
  assert.equal(signup.status, 404);
  console.log(apiOnly ? 'OK: salud API, autenticación directa, logout y registro público cerrado.' :
    'OK: salud, login web, autenticación directa/BFF, logout y registro público cerrado.');
}

main().catch(fail);
