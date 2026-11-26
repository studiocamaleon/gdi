/** node test/benchmarks/emision-ot.cjs [módulo compilado del motor]
 * Un producto por OT, tres pasos, un puesto por estación. Sin base ni servicios externos.
 */
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { resolve } = require('node:path');
const modulo = process.argv[2] ? resolve(process.argv[2]) : '../../dist/src/eta/motor/flujo-produccion';
const { simularFlujo } = require(modulo);
const familias = ['corte', 'impresion', 'entrega'];
const estaciones = familias.map((familia) => ({
  id: familia, nombre: familia, activo: true, capacidadConcurrente: 1,
  calendario: null, maquinas: [], empleados: [], familias: [familia],
}));

for (const cantidad of [10, 100, 300]) {
  const items = Array.from({ length: cantidad }, (_, i) => ({
    id: 'i' + i,
    ordenId: 'ot' + i,
    ordenNumero: 'OT-' + String(i).padStart(5, '0'),
    fechaEntrega: null,
    sinRuta: false,
    pasos: familias.map((familia, j) => ({
      id: i + '-' + j, indice: j, nombre: familia, estado: 'pendiente',
      familiaCodigo: familia, tipoEjecucion: 'interno', duracionEstimadaMin: 4 + j,
    })),
  }));
  const entrada = {
    items, estaciones, medianas: new Map(), ahora: new Date('2026-11-02T12:00:00Z'), incluirTraza: false,
  };
  simularFlujo(entrada);
  const tiempos = [];
  let huella;
  for (let ronda = 0; ronda < 5; ronda++) {
    const inicio = performance.now();
    const { porItem } = simularFlujo(entrada);
    tiempos.push(performance.now() - inicio);
    assert.equal(porItem.size, cantidad);
    assert.ok([...porItem.values()].every((item) => item.finEstimado instanceof Date));
    const actual = createHash('sha256').update(JSON.stringify([...porItem])).digest('hex');
    if (huella) assert.equal(actual, huella);
    huella = actual;
  }
  tiempos.sort((a, b) => a - b);
  console.log(JSON.stringify({ ordenes: cantidad, pasos: cantidad * 3, medianaMs: tiempos[2], huella }));
}
