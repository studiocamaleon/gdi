/* Aceptación de fabricación: biblioteca persistida → nuevas cantidades → TAP real.
 * Sólo usa gdi_saas_test y elimina su tenant temporal al terminar.
 * node apps/api/test/benchmarks/biblioteca-tap.cjs [carpeta-salida]
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../../..');
const out = path.resolve(process.argv[2] || path.join(root, 'output/grafonest-transformacion-2026-09-09/biblioteca-tap'));
const datasourceUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5436/gdi_saas_test?schema=public';
if (!new URL(datasourceUrl).pathname.endsWith('_test')) throw new Error('Esta aceptación exige una base terminada en _test.');
const { PrismaClient } = require('@prisma/client');
const { snapshotsExtension } = require('../../dist/src/prisma/snapshots.extension');
const { BibliotecaPatronesService } = require('../../dist/src/workers/geometria/biblioteca-patrones.service');
const { materializarPatrones } = require('../../dist/src/workers/geometria/cartera-patrones');
const { validarResultadoNestingOpenNest } = require('../../dist/src/workers/geometria/validar-nesting-opennest');
const { crearSvgPlacaDesdeNesting } = require('../../dist/src/recorridos-vectoriales/nesting-svg');
const { RecorridosVectorialesService } = require('../../dist/src/recorridos-vectoriales/recorridos-vectoriales.service');
const db = new PrismaClient({ datasourceUrl }).$extends(snapshotsExtension);
const tenantId = randomUUID();
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { analyzeTap } = await import(pathToFileURL(path.join(root, 'grafo-hotwire-linker-v1/dist/tap-analyzer.js')).href);
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'apps/api/src/workers/geometria/fixtures/puma-200cm.json')));
  const a = { ...fixture.entrada, tenantId };
  const b = { ...a, piezas: a.piezas.map((p) => ({ ...p, cantidad: p.cantidad * 3 })) };
  await db.tenant.create({ data: { id: tenantId, nombre: 'Aceptación biblioteca TAP', slug: tenantId } });
  const biblioteca = new BibliotecaPatronesService(db);
  const referencia = process.env.GRAFONEST_TAP_REFERENCE
    ? JSON.parse(fs.readFileSync(process.env.GRAFONEST_TAP_REFERENCE)) : fixture.solucionDosPlacas;
  await biblioteca.aprender(a, validarResultadoNestingOpenNest(a, referencia));
  const familia = await biblioteca.obtenerFamilia(b);
  assert.equal(familia.planes.length, 1);
  const plan = familia.planes[0];
  const r = validarResultadoNestingOpenNest(b, materializarPatrones(b, familia.patrones, plan));
  assert.equal(r.cantidadColocada, 24);
  assert.equal(r.placasUsadas, 6);
  const vista = {
    substrates: Array.from({ length: r.placasUsadas }, () => ({ kind: 'sheet', count: 1, widthMm: b.placa.anchoMm, heightMm: b.placa.altoMm })),
    placements: r.placements.map((p) => ({ pieceId: p.piezaId, substrateIndex: p.placa,
      meta: { contornos: [{ puntos: p.contorno, esHueco: false }, ...p.huecos.map((puntos) => ({ puntos, esHueco: true }))] } })),
  };
  const servicio = new RecorridosVectorialesService();
  const archivos = [];
  let placa = 0;
  for (const [i, seleccion] of [...plan.seleccion].sort((x, y) => y.repeticiones - x.repeticiones).entries()) {
    const nombre = `puma-patron-${String.fromCharCode(65 + i)}-x${seleccion.repeticiones}`;
    const svg = crearSvgPlacaDesdeNesting(vista, placa);
    const recorrido = await servicio.generar({ modo: 'CORTE', svg, nombreFuente: `${nombre}.svg`, perfil: {
      id: 'validacion-hotwire', nombre: 'Validación de biblioteca', postprocesador: 'HOTWIRE_TAP_V1',
      anchoUtilMm: 1250, altoUtilMm: 600, velocidadMmMin: 350, strictBounds: true,
    } });
    const leido = analyzeTap(recorrido.tap);
    assert.equal(leido.feedRateMmPerMin, 350);
    assert.equal(leido.closed, true);
    assert(leido.coordinateCount > 10);
    assert(Math.abs(leido.routeLengthMm - recorrido.metricas.longitudTotalMm) < 0.01);
    assert(Math.abs(leido.estimatedSeconds - recorrido.metricas.tiempoEstimadoSeg) < 0.01);
    assert(leido.bounds.minX >= -0.001 && leido.bounds.minY >= -0.001);
    assert(leido.bounds.maxX <= 1250.001 && leido.bounds.maxY <= 600.001);
    fs.writeFileSync(path.join(out, `${nombre}.svg`), svg);
    fs.writeFileSync(path.join(out, `${nombre}.tap`), recorrido.tap);
    fs.writeFileSync(path.join(out, `${nombre}-analisis.json`), JSON.stringify(leido, null, 2));
    archivos.push({ nombre, copias: seleccion.repeticiones, piezas: familia.patrones[seleccion.patron].placements.length,
      metricas: recorrido.metricas, tap: leido });
    placa += seleccion.repeticiones;
  }
  assert.equal(archivos.reduce((s, x) => s + x.piezas * x.copias, 0), 24);
  const resumen = { piezas: 24, placas: 6, patrones: archivos.length, archivos,
    tiempoTotalSeg: archivos.reduce((s, x) => s + x.metricas.tiempoEstimadoSeg * x.copias, 0) };
  fs.writeFileSync(path.join(out, 'aceptacion.json'), JSON.stringify(resumen, null, 2));
  console.log(JSON.stringify(resumen));
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await db.tenant.deleteMany({ where: { id: tenantId } });
  await db.$disconnect();
});
