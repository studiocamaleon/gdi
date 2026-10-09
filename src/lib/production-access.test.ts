import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cabecerasBackendStaging, controlAccesoStaging } from './staging-access';
vi.mock('@/lib/session', () => ({ getSessionToken: async () => 'sesion-ficticia' }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'fly-client-ip': '203.0.113.7' }) }));
import { apiRequest } from './api';
const secret = 'credencial-ficticia-produccion-canal-web-api-12345';
beforeEach(() => {
  vi.stubEnv('STAGING_PRIVATE', 'false');
  vi.stubEnv('GRAFO_DEPLOY_ENV', 'production');
  vi.stubEnv('WEB_API_TOKEN', secret);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('envía la credencial exclusiva de producción y la IP de Fly sin exigir Basic', () => {
  const incoming = new Headers({ 'fly-client-ip': '203.0.113.7' });
  const outgoing = new Headers({ 'x-grafoprint-web-token': 'falso', 'x-forwarded-for': '8.8.8.8' });
  expect(controlAccesoStaging(incoming)).toBeNull();
  cabecerasBackendStaging(incoming, outgoing);
  expect(outgoing.get('x-grafoprint-web-token')).toBe(secret);
  expect(outgoing.get('x-grafoprint-client-ip')).toBe('203.0.113.7');
  expect(outgoing.has('x-forwarded-for')).toBe(false);
});
it('no reutiliza staging si falta el secreto de producción', () => {
  vi.stubEnv('WEB_API_TOKEN', '');
  vi.stubEnv('STAGING_WEB_API_TOKEN', secret);
  expect(() => cabecerasBackendStaging(new Headers({ 'fly-client-ip': '203.0.113.7' }), new Headers())).toThrow();
});
it('rechaza entorno cruzado e IP falsificada sin Fly', () => {
  expect(() => cabecerasBackendStaging(new Headers({ 'x-forwarded-for': '203.0.113.7' }), new Headers())).toThrow();
  vi.stubEnv('STAGING_PRIVATE', 'true');
  expect(() => cabecerasBackendStaging(new Headers({ 'fly-client-ip': '203.0.113.7' }), new Headers())).toThrow();
});
it('las páginas de servidor también autentican el canal y no siguen redirecciones', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  await apiRequest('/auth/me', { redirect: 'follow' });
  expect(fetch).toHaveBeenCalledOnce();
  const init = fetch.mock.calls[0][1];
  expect(init.redirect).toBe('manual');
  expect(init.headers.get('x-grafoprint-web-token')).toBe(secret);
  expect(init.headers.get('Authorization')).toBe('Bearer sesion-ficticia');
});
it('no hace ninguna solicitud SSR si falta el secreto del canal de producción', async () => {
  vi.stubEnv('WEB_API_TOKEN', '');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  await expect(apiRequest('/auth/me')).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it('el navegador usa el proxy y nunca adjunta los secretos exclusivos del servidor', async () => {
  vi.stubGlobal('window', {});
  const fetch = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  await apiRequest('/auth/me');
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe('/api/backend/auth/me');
  expect(init.headers.has('x-grafoprint-web-token')).toBe(false);
  expect(init.headers.has('Authorization')).toBe(false);
});
