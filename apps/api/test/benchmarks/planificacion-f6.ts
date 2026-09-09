/** TS_NODE_PROJECT=tsconfig.json node -r ts-node/register test/benchmarks/planificacion-f6.ts [carpeta]
 * Sólo fixture + ETA puro: sin Prisma, HTTP, Redis ni escrituras comerciales.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { proponerEntregasPiloto } from '../../src/eta/planificacion/prototipo-entregas';
import {
  conFechasAlcanzables,
  exhibidorControlado,
} from '../fixtures/f6-planificacion/exhibidor-controlado';

const carpeta = resolve(
  process.argv[2] ?? '../../output/f6-planificacion-2026-09-09',
);
mkdirSync(carpeta, { recursive: true });
const exigente = conFechasAlcanzables();
exigente.entregas[0].fechaSolicitada = '2026-09-09';
const condicionado = exhibidorControlado();
condicionado.condicionesPendientes = [
  'No se confirmó la disponibilidad del material.',
];
const entradas = [
  {
    nombre: 'Sugerir fechas: primeras entregas cuanto antes',
    entrada: exhibidorControlado(),
  },
  {
    nombre: 'Cumplir fechas indicadas: 10/09, 14/09, 15/09 y 16/09',
    entrada: conFechasAlcanzables(),
  },
  { nombre: 'Primera entrega solicitada el 09/09', entrada: exigente },
  { nombre: 'Material todavía sin confirmar', entrada: condicionado },
];
const resultados = entradas.map(({ nombre, entrada }) => {
  const inicio = performance.now();
  const resultado = proponerEntregasPiloto(entrada);
  return { nombre, tiempoMs: performance.now() - inicio, resultado };
});
writeFileSync(
  join(carpeta, 'resultados.json'),
  JSON.stringify(resultados, null, 2),
);
const lineas = [
  '# F6: primera prueba de planificación por entregas',
  '',
  'Datos controlados de aceptación; no son velocidades, costos ni fechas prometidas de Visual Ilusión.',
  '',
  'OT hipotética: 200 exhibidores, un cuerpo y dos estantes por unidad. Cuatro entregas de 50. Taller L–V de 08:00 a 17:00, una mesa de corte y un puesto de armado; hay 180 minutos de corte comprometidos al comenzar el 09/09/2026. Margen cero sólo en este ejercicio.',
  '',
  'Los importes son unidades monetarias de prueba. Cada cantidad tiene su medición explícita; no se divide el tiempo/costo de 200 entre cuatro.',
  '',
];
for (const r of resultados) {
  lineas.push(
    `## ${r.nombre}`,
    '',
    `Simulación local: ${r.tiempoMs.toFixed(1)} ms para ${r.resultado.alternativas.length} alternativas. Una corrida, sin búsqueda geométrica ni acceso a base de datos.`,
    '',
    '| Alternativa | Estado | Primera | Segunda | Tercera | Cuarta | Costo | Diferencia |',
    '| --- | --- | --- | --- | --- | --- | ---: | ---: |',
  );
  for (const a of r.resultado.alternativas)
    lineas.push(
      `| ${a.id === r.resultado.recomendadaId ? '**' : ''}${a.nombre}${a.id === r.resultado.recomendadaId ? '**' : ''} | ${a.estado} | ${a.entregas.map((e) => e.fechaSugerida ?? 'Sin estimar').join(' | ')} | ${a.costo ?? '—'} | ${a.costoAdicional ?? '—'} |`,
    );
  const elegida = r.resultado.alternativas.find(
    (a) => a.id === r.resultado.recomendadaId,
  );
  if (elegida) {
    lineas.push(
      '',
      `**Propuesta:** ${elegida.nombre}. Preparaciones: ${elegida.preparacionMin} minutos.`,
      '',
    );
    for (const condicion of elegida.condiciones)
      lineas.push(`- Condición: ${condicion}`);
    if (elegida.entregas.some((e) => e.cumple === false)) {
      for (const e of elegida.entregas.filter((e) => e.cumple === false))
        lineas.push(
          `- ${e.id}: solicitada ${e.fechaSolicitada}; proyección ${e.fechaSugerida}. Última operación: ${e.ultimaOperacion?.nombre ?? 'sin estimar'} en ${e.ultimaOperacion?.estacion ?? '—'}. La traza JSON conserva sus precedencias y esperas. No es una demostración de imposibilidad global.`,
        );
    }
  }
  lineas.push('');
}
lineas.push(
  '## Alcance demostrado y pendientes',
  '',
  'Se generan alternativas de agrupación por operación y se evalúan con el ETA existente. Se conservan las piezas y las precedencias; se comparan costo, fechas y margen. El selector prioriza las primeras entregas cuando las fechas están abiertas.',
  '',
  'La prueba automatizada detecta y descarta alternativas que desplazan operaciones ya comprometidas. El prototipo no busca exhaustivamente huecos reservables. No se confirmó una OT ni se reservó capacidad: falta implementar la revalidación concurrente.',
  '',
  'Todavía faltan el adaptador a snapshots reales de cotización/nesting, el contrato autoritativo del plan, las tablas y API, la interfaz, la ejecución por cantidades y las entregas parciales. Tampoco se evalúan terceros ni cantidades fraccionarias en este piloto.',
  '',
);
writeFileSync(join(carpeta, 'INFORME.md'), lineas.join('\n'));
console.log(
  JSON.stringify(
    resultados.map((r) => ({
      nombre: r.nombre,
      tiempoMs: r.tiempoMs,
      recomendada: r.resultado.recomendadaId,
    })),
    null,
    2,
  ),
);
