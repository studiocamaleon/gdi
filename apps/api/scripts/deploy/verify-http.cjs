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
    if (base !== api) {
      const session = await request(`${web}/api/session`, {
        method: 'POST', headers: { ...browser, 'content-type': 'application/json' },
        body: JSON.stringify({ token: body.accessToken }),
      });
      assert.equal(session.status, 200);
      const setCookie = session.headers.get('set-cookie');
      assert.ok(setCookie?.startsWith('gdi_access_token='), 'El ingreso debe guardar la sesión.');
      for (const attribute of [/; HttpOnly/i, /; Secure/i, /; SameSite=Lax/i]) {
        assert.match(setCookie, attribute);
      }
      const cookie = setCookie.split(';')[0];
      // La pantalla consulta el API desde el servidor de Next. Comprueba que
      // el canal autenticado y la IP también funcionan fuera del BFF.
      const paginaClave = await request(`${web}/backoffice/cambiar-clave`, {
        headers: { ...browser, cookie }, redirect: 'manual',
      });
      assert.equal(paginaClave.status, 200);
      assert.ok((await paginaClave.text()).includes('Elegí tu clave'));
      for (const path of ['/cambiar-clave', '/plataforma', '/backoffice/seguridad']) {
        const redirected = await request(`${web}${path}`, { headers: { ...browser, cookie }, redirect: 'manual' });
        assert.equal(redirected.status, 307);
        assert.equal(new URL(redirected.headers.get('location'), web).pathname, '/backoffice/cambiar-clave');
      }
      const authHeaders = { ...browser, cookie, 'content-type': 'application/json' };
      const contexto = () => request(`${base}/plataforma/contexto`, { headers: authHeaders }).then(r => r.json());
      assert.equal((await contexto()).debeCambiarPassword, true);
      assert.equal((await request(`${base}/plataforma/empresas`, { headers: authHeaders })).status, 403);
      const nueva = `ensayo-${require('node:crypto').randomUUID()}`;
      const cambiar = (actual, claveNueva) => request(`${base}/auth/password`, {
        method: 'POST', headers: authHeaders, body: JSON.stringify({ actual, nueva: claveNueva }),
      });
      assert.equal((await cambiar('clave-incorrecta', nueva)).status, 400);
      assert.equal((await contexto()).debeCambiarPassword, true);
      assert.equal((await cambiar(process.env.BOOTSTRAP_ADMIN_PASSWORD, process.env.BOOTSTRAP_ADMIN_PASSWORD)).status, 400);
      assert.equal((await cambiar(process.env.BOOTSTRAP_ADMIN_PASSWORD, nueva)).status, 201);
      const actualizado = await contexto();
      assert.equal(actualizado.debeCambiarPassword, false);
      assert.equal(actualizado.requiereSeguridad, true);
      assert.equal((await request(`${base}/plataforma/empresas`, { headers: authHeaders })).status, 403);
      const security = await request(`${web}/backoffice/seguridad`, {
        headers: { ...browser, cookie }, redirect: 'manual',
      });
      assert.equal(security.status, 200);
      const html = await security.text();
      assert.ok(html.includes('Protegé tu acceso'), 'Debe renderizar la pantalla de seguridad, sin error SSR.');
      assert.ok(html.includes(process.env.BOOTSTRAP_ADMIN_EMAIL));
      const reingresar = (password) => request(`${base}/auth/login-plataforma`, {
        method: 'POST', headers: { ...browser, 'content-type': 'application/json' },
        body: JSON.stringify({ email: process.env.BOOTSTRAP_ADMIN_EMAIL, password }),
      });
      assert.equal((await reingresar(process.env.BOOTSTRAP_ADMIN_PASSWORD)).status, 401);
      const reingreso = await reingresar(nueva);
      assert.equal(reingreso.status, 201);
      const otra = await reingreso.json();
      assert.ok((await request(`${api}/auth/logout`, { method: 'POST', headers: { ...internal, authorization: `Bearer ${otra.accessToken}` } })).ok);
      const clearSession = await request(`${web}/api/session`, {
        method: 'DELETE', headers: { ...browser, cookie },
      });
      assert.equal(clearSession.status, 200);
      assert.match(clearSession.headers.get('set-cookie') ?? '', /^gdi_access_token=;/);
    }
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
    'OK: staging restringido, salud, autenticación interna/BFF, cookie segura, cambio de clave de staff sin empresa, MFA obligatorio, SSR, logout y registro público cerrado.');
}

main().catch(fail);
