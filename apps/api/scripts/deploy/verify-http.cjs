const assert = require('node:assert/strict');
const { databaseUrl, fail } = require('./target.cjs');

async function main() {
  databaseUrl('DATABASE_URL');
  if (!process.env.DEPLOY_DATABASE_NAME.endsWith('_test')) throw new Error('Sólo ensayo local.');
  const api = 'http://api:3001/api';
  const web = 'http://web:3000';
  const apiOnly = process.env.VERIFY_API_ONLY === 'true';
  const internal = {
    'x-grafoprint-web-token': process.env.STAGING_WEB_API_TOKEN,
    'x-grafoprint-client-ip': '203.0.113.25',
  };
  const browser = {
    authorization: `Basic ${Buffer.from(`${process.env.STAGING_ACCESS_USER}:${process.env.STAGING_ACCESS_PASSWORD}`).toString('base64')}`,
    // Simula el encabezado que Fly agrega. No hay proxy público en Compose.
    'fly-client-ip': '203.0.113.25',
    'x-forwarded-for': '1.1.1.1',
    'x-grafoprint-client-ip': '8.8.8.8',
    'x-grafoprint-web-token': 'forged',
  };
  const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  assert.equal((await request(api)).status, 200);
  assert.equal((await request(`${api}/auth/me`, { headers: { 'fly-client-ip':'1.1.1.1', 'x-forwarded-for':'1.1.1.1' } })).status, 403);
  if (!apiOnly) {
    assert.equal((await request(`${web}/api/health`)).status, 200);
    for (const path of ['/login', '/backoffice', '/api/backend/auth/me', '/api/session', '/brand/logo.svg']) {
      const denied = await request(`${web}${path}`);
      assert.equal(denied.status, 401);
      assert.ok(denied.headers.get('x-robots-tag').includes('noindex'));
    }
    assert.equal((await request(`${web}/login`, { headers: browser })).status, 200);
    assert.ok((await (await request(`${web}/robots.txt`)).text()).includes('Disallow: /'));
  }
  for (const base of apiOnly ? [api] : [api, `${web}/api/backend`]) {
    const response = await request(`${base}/auth/login-plataforma`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(base === api ? internal : browser) },
      body: JSON.stringify({ email: process.env.BOOTSTRAP_ADMIN_EMAIL, password: process.env.BOOTSTRAP_ADMIN_PASSWORD }),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(typeof body.accessToken, 'string');
    assert.equal(body.staff.rolPlataforma, 'ADMIN');
    const logout = await request(`${api}/auth/logout`, {
      method: 'POST', headers: { ...internal, authorization: `Bearer ${body.accessToken}` },
    });
    assert.ok(logout.ok);
  }
  const signup = await request(`${api}/registro`, {
    method: 'POST', headers: { ...internal, 'content-type': 'application/json' },
    body: JSON.stringify({ nombreCompleto: 'Ensayo de despliegue', empresaNombre: 'Empresa ficticia',
      email: 'registro-desactivado@example.invalid', password: 'ensayo-sin-envio-1234', planCodigo: 'ensayo',
      paisCodigo: 'AR', zonaHoraria: 'America/Argentina/Buenos_Aires', aceptaTerminos: true }),
  });
  assert.equal(signup.status, 404);
  console.log(apiOnly ? 'OK: salud API, autenticación directa, logout y registro público cerrado.' :
    'OK: staging restringido, noindex, salud, autenticación por canal interno/BFF, logout y registro público cerrado.');
}

main().catch(fail);
