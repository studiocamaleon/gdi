import express from 'express';
import request from 'supertest';
import { configurarEntradaStaging } from './staging-ingress';

const secret = 'token-interno-sintetico-de-staging-12345678';
const original = {
  enabled: process.env.STAGING_PRIVATE,
  token: process.env.STAGING_WEB_API_TOKEN,
};
beforeEach(() => {
  process.env.STAGING_PRIVATE = 'true';
  process.env.STAGING_WEB_API_TOKEN = secret;
});
afterEach(() => {
  for (const [name, value] of Object.entries({
    STAGING_PRIVATE: original.enabled,
    STAGING_WEB_API_TOKEN: original.token,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
function server() {
  const app = express();
  configurarEntradaStaging(app);
  app.get('/api', (_req, res) => res.json({ status: 'ok' }));
  app.use((req, res) =>
    res.json({ ip: req.ip, token: req.headers['x-grafoprint-web-token'] }),
  );
  return app;
}
it('salud pública; API, webhooks y variantes de salud requieren la clave interna', async () => {
  const app = server();
  await request(app).get('/api').expect(200);
  for (const path of [
    '/api/auth/login',
    '/api/webhooks/whatsapp',
    '/api/extra',
  ]) {
    await request(app)
      .get(path)
      .set('x-forwarded-for', '1.1.1.1')
      .set('fly-client-ip', '1.1.1.1')
      .expect(403);
  }
  await request(app).post('/api').expect(403);
});
it('resuelve la IP sólo tras autenticar la web y descarta cabeceras falsificadas', async () => {
  const response = await request(server())
    .get('/api/auth/me')
    .set('x-grafoprint-web-token', secret)
    .set('x-grafoprint-client-ip', '203.0.113.25')
    .set('x-forwarded-for', '8.8.8.8, 1.1.1.1')
    .set('fly-client-ip', '9.9.9.9')
    .expect(200);
  expect(response.body).toEqual({ ip: '203.0.113.25' });
  expect(response.headers['x-robots-tag']).toContain('noindex');
});
it.each(['', '1.2.3.4, 5.6.7.8', '::1:invalid'])(
  'rechaza IP %s aun con clave correcta',
  async (ip) => {
    await request(server())
      .get('/api/auth/me')
      .set('x-grafoprint-web-token', secret)
      .set('x-grafoprint-client-ip', ip)
      .expect(400);
  },
);
it('no arranca con staging abierto por falta de secreto', () => {
  delete process.env.STAGING_WEB_API_TOKEN;
  expect(server).toThrow('STAGING_WEB_API_TOKEN');
});
it('no cambia el comportamiento fuera de staging', () => {
  delete process.env.STAGING_PRIVATE;
  const app = express();
  expect(configurarEntradaStaging(app)).toBe(false);
  expect(app.get('trust proxy')).toBe(false);
});
