import { exigir } from './seguro.mjs';

/** Evita habilitar producción por accidente al copiar una configuración de staging. */
export function validarEntornoRespaldo(c) {
  const entorno = c.b2?.RESPALDO_ENTORNO;
  exigir(['staging', 'produccion'].includes(entorno), 'El entorno del respaldo debe ser explícito.');
  if (entorno === 'produccion') {
    exigir(c.habilitarProduccion === true, 'Falta habilitar expresamente los respaldos de producción.');
    const esperado = c.origenProduccionEsperado;
    exigir(esperado?.pgDatabase === 'grafoprint_production' && esperado?.r2Bucket === 'grafoprint-production-files' &&
      typeof esperado?.pgHost === 'string' && /^[a-z0-9][a-z0-9.-]+\.neon\.tech$/.test(esperado.pgHost),
      'Registrar la identidad del proyecto de producción antes de operar.');
    for (const key of ['pgHost', 'pgDatabase', 'r2Bucket']) {
      exigir(c.origen?.[key] === esperado[key], 'El origen no coincide con la identidad de producción.');
    }
  }
  return entorno;
}
