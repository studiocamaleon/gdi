import { expect, it } from 'vitest';
import config from '../../next.config';
it('la web evita que sitios ajenos la incrusten y no transmite el enlace privado como referencia', async () => {
  const reglas = await config.headers?.();
  const cabeceras = Object.fromEntries((reglas?.find(r=>r.source==='/:path*')?.headers ?? []).map(h=>[h.key.toLowerCase(),h.value]));
  expect(cabeceras['referrer-policy']).toBe('no-referrer');
  expect(cabeceras['x-frame-options']).toBe('SAMEORIGIN');
  expect(cabeceras['x-content-type-options']).toBe('nosniff');
  expect(cabeceras['content-security-policy']).toContain("frame-ancestors 'self'");
  expect(cabeceras['content-security-policy']).toContain("base-uri 'self'");
});
