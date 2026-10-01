import test from 'node:test';
import assert from 'node:assert/strict';
import { validarEntornoRespaldo } from './lib/configuracion.mjs';

const staging = () => ({ b2: { RESPALDO_ENTORNO: 'staging' } });
const produccion = () => ({
  b2: { RESPALDO_ENTORNO: 'produccion' },
  habilitarProduccion: true,
  origenProduccionEsperado: { pgHost: 'ep-ejemplo.sa-east-1.aws.neon.tech', pgDatabase: 'grafoprint_production', r2Bucket: 'grafoprint-production-files' },
  origen: { pgHost: 'ep-ejemplo.sa-east-1.aws.neon.tech', pgDatabase: 'grafoprint_production', r2Bucket: 'grafoprint-production-files' },
});
test('mantiene compatibilidad con staging y exige habilitación explícita para producción', () => {
  assert.equal(validarEntornoRespaldo(staging()), 'staging');
  assert.equal(validarEntornoRespaldo(produccion()), 'produccion');
  for (const entorno of ['', 'production', 'otro', undefined]) {
    assert.throws(() => validarEntornoRespaldo({ b2: { RESPALDO_ENTORNO: entorno } }));
  }
  const c = produccion(); delete c.habilitarProduccion;
  assert.throws(() => validarEntornoRespaldo(c));
});
test('rechaza mezcla de orígenes o nombres de staging al respaldar producción', () => {
  for (const [key, value] of Object.entries({ pgHost: 'ep-otro.neon.tech', pgDatabase: 'grafoprint_staging', r2Bucket: 'grafoprint-staging-files' })) {
    const c = produccion(); c.origen[key] = value;
    assert.throws(() => validarEntornoRespaldo(c));
  }
  const c = produccion(); c.origenProduccionEsperado.pgDatabase = c.origen.pgDatabase = 'grafoprint_staging';
  assert.throws(() => validarEntornoRespaldo(c));
  delete c.origenProduccionEsperado;
  assert.throws(() => validarEntornoRespaldo(c));
});
