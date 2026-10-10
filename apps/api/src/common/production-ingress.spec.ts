import express from 'express';
import request from 'supertest';
import { configurarEntradaStaging } from './staging-ingress';

const original = { ...process.env };
const secret = 'credencial-ficticia-produccion-canal-web-api-12345';
beforeEach(() => {
  delete process.env.STAGING_PRIVATE;
  process.env.GRAFO_DEPLOY_ENV = 'production';
  process.env.WEB_API_TOKEN = secret;
});
afterEach(() => {
  process.env = { ...original };
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
it('producción exige su propia credencial, sin aceptar la de staging ni IP falsa', async () => {
  process.env.STAGING_WEB_API_TOKEN =
    'otra-credencial-ficticia-para-staging-1234';
  const app = server();
  await request(app).get('/api').expect(200);
  for (const path of [
    '/api/auth/login',
    '/api/webhooks/whatsapp',
    '/api/webhooks/paddle',
    '/api/extra',
  ]) {
    await request(app)
      .post(path)
      .set('fly-client-ip', '203.0.113.4')
      .expect(403);
  }
  await request(app)
    .get('/api/auth/me')
    .set('x-grafoprint-web-token', process.env.STAGING_WEB_API_TOKEN)
    .expect(403);
  const result = await request(app)
    .get('/api/auth/me')
    .set('x-grafoprint-web-token', secret)
    .set('x-grafoprint-client-ip', '203.0.113.25')
    .set('x-forwarded-for', '8.8.8.8')
    .set('fly-client-ip', '1.1.1.1')
    .expect(200);
  expect(result.body).toEqual({ ip: '203.0.113.25' });
});
it('no inicia producción sin secreto exclusivo ni con configuración cruzada', () => {
  delete process.env.WEB_API_TOKEN;
  expect(server).toThrow('WEB_API_TOKEN');
  process.env.WEB_API_TOKEN = secret;
  process.env.STAGING_PRIVATE = 'true';
  expect(server).toThrow('staging');
});
it('rechaza una IP inválida incluso con la credencial de producción correcta', async () => {
  await request(server())
    .get('/api/auth/me')
    .set('x-grafoprint-web-token', secret)
    .set('x-grafoprint-client-ip', '1.1.1.1, 8.8.8.8')
    .expect(400);
});
