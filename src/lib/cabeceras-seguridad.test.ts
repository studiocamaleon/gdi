import { expect, it } from 'vitest';
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants';
import configurarNext from '../../next.config';
it.each([PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD])('la web evita incrustaciones ajenas y referencias privadas en %s', async (phase) => {
  const config = await configurarNext(phase);
  const reglas = await config.headers?.();
  const cabeceras = Object.fromEntries((reglas?.find(r=>r.source==='/:path*')?.headers ?? []).map(h=>[h.key.toLowerCase(),h.value]));
  expect(cabeceras['referrer-policy']).toBe('no-referrer');
  expect(cabeceras['x-frame-options']).toBe('SAMEORIGIN');
  expect(cabeceras['x-content-type-options']).toBe('nosniff');
  expect(cabeceras['content-security-policy']).toContain("frame-ancestors 'self'");
  expect(cabeceras['content-security-policy']).toContain("base-uri 'self'");
});
