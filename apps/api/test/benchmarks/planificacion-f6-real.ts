/** Replay del catálogo real. Contexto de taller opcional capturado en lectura;
 * por defecto usa calendario CONTROLADO. No conecta a DB ni crea ventas/OTs.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { cotizacionesExhibidor } from '../fixtures/f6-planificacion/cotizaciones-exhibidor';
import { exhibidorControlado } from '../fixtures/f6-planificacion/exhibidor-controlado';
import { planificarCotizacionesF6 } from '../../src/eta/planificacion/adaptador-cotizacion';
import type { ContextoPiloto } from '../../src/eta/planificacion/prototipo-entregas';

const fuentes = cotizacionesExhibidor();
const carpeta = resolve(
  process.argv[2] || '../../output/f6-caso-real-2026-09-09/replay',
);
const archivoTaller = process.argv[3];
let taller: ContextoPiloto;
if (archivoTaller) {
  const t = JSON.parse(readFileSync(archivoTaller, 'utf8')) as Omit<
    ContextoPiloto,
    'ahora' | 'medianas' | 'noLaborables'
  > & {
    ahora: string;
    medianas: Array<[string, number]>;
    noLaborables: string[];
  };
  taller = {
    ...t,
    ahora: new Date(t.ahora),
    medianas: new Map(t.medianas),
    noLaborables: new Set(t.noLaborables),
  };
} else {
  const controlado = exhibidorControlado().taller;
  const q = fuentes[0].cotizacion;
  const pasos = [
    ...q.pasos,
    ...q.componentesFabricados!.flatMap((c) => c.pasos!),
  ].filter((p) => p.activado);
  taller = {
    ...controlado,
    items: [],
    estaciones: pasos.map((p) => ({
      ...controlado.estaciones[0],
      id: p.familiaCodigo,
      familias: [p.familiaCodigo],
      maquinas: p.tiempo?.maquinaId
        ? [
            {
              id: p.tiempo.maquinaId,
              centroCostoId: p.tiempo.centroCostoId ?? null,
            },
          ]
        : [],
    })),
  };
}
const inicio = performance.now();
const r = planificarCotizacionesF6({
  tenantId: fuentes[0].tenantId,
  configuracionId: fuentes[0].configuracionId,
  fuentes,
  cantidad: 200,
  entregas: [1, 2, 3, 4].map((i) => ({ id: `entrega-${i}`, cantidad: 50 })),
  taller,
  margenDiasHabiles: 0,
  prioridadSinFechas: 'PRIMERAS_ENTREGAS',
  condicionesPendientes: [
    'Materiales y calibración de tiempos del catálogo sin confirmar.',
  ],
  operacionesUnaVez: ['producto/ruta:1760ef39-b40d-425e-b9fa-c6566536913b'],
});
const duracionMs = performance.now() - inicio;
mkdirSync(carpeta, { recursive: true });
writeFileSync(
  resolve(carpeta, 'resultado.json'),
  JSON.stringify(
    {
      contexto: archivoTaller
        ? 'captura del taller'
        : 'calendario controlado, cola vacía',
      duracionMs,
      ...r,
    },
    null,
    2,
  ),
);
const filas = r.resultado.alternativas.map((a) => {
  const d = r.detalles.find((d) => d.alternativaId === a.id)!;
  return `| ${a.nombre} | ${a.entregas.map((e) => e.fechaSugerida ?? 'Sin fecha').join(' · ')} | ${a.costo?.toFixed(2)} | ${a.costoAdicional?.toFixed(2)} | ${d.placasNuevas} | ${a.estado} |`;
});
writeFileSync(
  resolve(carpeta, 'INFORME.md'),
  `# F6 — Catálogo real del exhibidor\n\nCotizaciones del catálogo local; no mediciones físicas de Visual Ilusión. Contexto: ${archivoTaller ? 'captura real del taller' : 'calendario controlado, cola vacía'}. Simulación sin reserva ni escritura comercial.\n\nPreparación del vector una vez por pedido, como política explícita de este escenario. Margen cero para comparar disponibilidad, sin promesa comercial.\n\n| Alternativa | Disponibilidad de 4 × 50 | Costo configurado | Diferencia | Placas nuevas | Estado |\n| --- | --- | ---: | ---: | ---: | --- |\n${filas.join('\n')}\n\nRecomendación provisional: ${r.resultado.recomendadaId ?? 'ninguna'}. Menor costo: ${r.resultado.economicaId ?? 'sin estimación'}.\n\nCondiciones:\n${r.observaciones.map((o) => `- ${o}`).join('\n')}\n\nLos grupos reutilizan copias completas de los snapshots por cantidad. El corte hereda las placas impresas y no vuelve a consumir ese sustrato. No se promete que una fracción arbitraria de las placas de 200 abastezca 50 completos.\n\nAdaptación y comparación: ${duracionMs.toFixed(0)} ms locales, excluye cotización/nesting e IO externo. No es una prueba de carga SaaS.\n`,
);
console.log(
  JSON.stringify(
    {
      duracionMs,
      carpeta,
      recomendada: r.resultado.recomendadaId,
      alternativas: r.resultado.alternativas.map((a) => ({
        id: a.id,
        estado: a.estado,
        costo: a.costo,
        delta: a.costoAdicional,
        fechas: a.entregas.map((e) => e.fechaSugerida),
        desplazados: a.trabajosDesplazados.length,
      })),
      placas: r.detalles.map((d) => [d.alternativaId, d.placasNuevas]),
    },
    null,
    2,
  ),
);
