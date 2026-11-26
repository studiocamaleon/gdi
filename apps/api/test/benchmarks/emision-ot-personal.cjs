/** node test/benchmarks/emision-ot-personal.cjs [módulo del motor compilado]
 * Compara las dos corridas de emisión con empleados compartidos y una agenda
 * ya publicada. Todos los datos son ficticios. No requiere base ni servicios.
 */
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { resolve } = require('node:path');

const { simularFlujo } = require(process.argv[2]
  ? resolve(process.argv[2])
  : '../../dist/src/eta/motor/flujo-produccion');

const ahora = new Date('2026-11-26T15:00:00Z');
const jornada = [{ desde: '09:00', hasta: '13:00' }, { desde: '14:00', hasta: '18:00' }];
const calendario = { dias: { lun: jornada, mar: jornada, mie: jornada, jue: jornada, vie: jornada, sab: null, dom: null } };
const estaciones = Array.from({ length: 5 }, (_, i) => ({
  id: 'e' + i,
  activo: true,
  planificacionPorEmpleados: true,
  capacidadConcurrente: 2,
  tiempoPreparacionMin: 3,
  calendario,
  familias: ['f' + i],
  maquinas: [],
  empleados: [0, 1, 2].map((j) => ({
    id: 'emp' + ((i + j) % 7),
    activo: true,
    asignacionAutomatica: true,
    calendario,
  })),
}));

let indicePaso = 0;
const items = Array.from({ length: 95 }, (_, i) => ({
  id: 'i' + i,
  ordenId: 'o' + (i % 63),
  ordenNumero: 'OT-' + String(i % 63).padStart(5, '0'),
  fechaEntrega: '2026-12-04',
  sinRuta: false,
  pasos: Array.from({ length: i < 62 ? 3 : 2 }, (_, j) => {
    const k = indicePaso++;
    const tieneReserva = k >= 44 && k < 65;
    const inicioReserva = ahora.getTime() + 86_400_000 + (k % 5) * 3_600_000;
    return {
      id: 'p' + k,
      indice: j,
      nombre: 'Paso',
      estado: k < 43 ? 'hecho' : 'pendiente',
      tipoEjecucion: 'interno',
      familiaCodigo: 'f' + ((i + j) % 5),
      duracionEstimadaMin: 7 + ((i * 3 + j) % 26),
      planificadoDesde: tieneReserva ? new Date(inicioReserva).toISOString() : null,
      planificadoHasta: tieneReserva ? new Date(inicioReserva + 1_800_000).toISOString() : null,
    };
  }),
}));
const taller = { items, estaciones, medianas: new Map(), ahora, zona: 'America/Argentina/Buenos_Aires' };

for (const incluirTraza of [true, false]) {
  const inicio = performance.now();
  const resultado = simularFlujo({ ...taller, incluirTraza });
  const ms = Math.round(performance.now() - inicio);
  assert.equal(resultado.traza.length, incluirTraza ? 209 : 0);
  const datos = JSON.stringify(resultado, (_, valor) => valor instanceof Map ? [...valor] : valor);
  const huella = createHash('sha256').update(datos).digest('hex');
  console.log(JSON.stringify({ incluirTraza, pasos: indicePaso, ms, huella }));
}
