import { cotizacionesExhibidor } from '../../../test/fixtures/f6-planificacion/cotizaciones-exhibidor';
import { exhibidorControlado } from '../../../test/fixtures/f6-planificacion/exhibidor-controlado';
import {
  adaptarCotizacionesF6,
  planificarCotizacionesF6,
  type SolicitudAdaptadorF6,
} from './adaptador-cotizacion';
import { proponerEntregasPiloto } from './prototipo-entregas';

function solicitud(): SolicitudAdaptadorF6 {
  const fuentes = cotizacionesExhibidor(),
    controlado = exhibidorControlado();
  const pasos = [
    ...fuentes[0].cotizacion.pasos,
    ...fuentes[0].cotizacion.componentesFabricados!.flatMap((h) => h.pasos!),
  ].filter((p) => p.activado);
  return {
    tenantId: fuentes[0].tenantId,
    configuracionId: fuentes[0].configuracionId,
    fuentes,
    cantidad: 200,
    entregas: controlado.entregas,
    margenDiasHabiles: 0,
    prioridadSinFechas: 'PRIMERAS_ENTREGAS',
    condicionesPendientes: [],
    operacionesUnaVez: ['producto/ruta:1760ef39-b40d-425e-b9fa-c6566536913b'],
    taller: {
      ...controlado.taller,
      items: [],
      estaciones: pasos.map((p) => ({
        ...controlado.taller.estaciones[0],
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
    },
  };
}
const impresion = (s: SolicitudAdaptadorF6, index = 0) =>
  s.fuentes[index].cotizacion.componentesFabricados![0].pasos!.find(
    (p) => p.familiaCodigo === 'impresion_por_area',
  )!;
const corte = (s: SolicitudAdaptadorF6, index = 0) =>
  s.fuentes[index].cotizacion.componentesFabricados![0].pasos!.find(
    (p) => p.familiaCodigo === 'corte_laser',
  )!;

it('proyecta el grafo real: pre-prensa → impresión → corte → ensamble, atravesando opcionales omitidos', () => {
  const r = adaptarCotizacionesF6(solicitud());
  expect(r.entrada.operaciones.map((o) => o.familiaCodigo)).toEqual([
    'pre_prensa',
    'impresion_por_area',
    'corte_laser',
    'ensamble_estructural',
  ]);
  for (let i = 1; i < r.entrada.operaciones.length; i++)
    expect(r.entrada.operaciones[i].predecesoras).toEqual([
      r.entrada.operaciones[i - 1].codigo,
    ]);
  expect(r.entrada.operaciones[1].piezasPorProducto).toBe(9);
  expect(r.entrada.operaciones[2].particionVinculadaA).toBe(
    r.entrada.operaciones[1].codigo,
  );
});
it('reconcilia costo total real, 128 placas y 1800 piezas sin duplicar material en el corte', () => {
  const s = solicitud(),
    r = planificarCotizacionesF6(s);
  expect(
    r.resultado.alternativas.find((a) => a.id === 'completo')!.costo,
  ).toBeCloseTo(s.fuentes[3].cotizacion.costos.total, 6);
  for (const a of r.resultado.alternativas) {
    const d = r.detalles.find((d) => d.alternativaId === a.id)!;
    expect(d.placasNuevas).toBe(128);
    expect(d.materiales.find((m) => m.unidad === 'pliego')!.cantidad).toBe(128);
    for (const o of r.entrada.operaciones.filter(
      (o) =>
        o.familiaCodigo.includes('impresion') ||
        o.familiaCodigo === 'corte_laser',
    )) {
      const lotes = d.lotesGeometricos.filter((l) => l.operacion === o.codigo);
      expect(lotes.reduce((s, l) => s + l.cantidadProductos * 9, 0)).toBe(1800);
      for (const lote of lotes) {
        expect(new Set(lote.layouts.flatMap((l) => l.placasIndices)).size).toBe(
          lote.placas,
        );
        for (const pieza of lote.piezas)
          expect(
            lote.layouts.reduce(
              (s, l) =>
                s + (l.contenido[pieza.id] ?? 0) * l.placasIndices.length,
              0,
            ),
          ).toBe(pieza.porProducto * lote.cantidadProductos);
      }
    }
    expect(
      a.operaciones.filter(
        (o) => o.operacion === r.entrada.operaciones[0].codigo,
      ),
    ).toHaveLength(1);
  }
  expect(
    r.resultado.alternativas.find((a) => a.id === 'por-entrega')!
      .costoAdicional,
  ).toBeCloseTo(47061.7535, 4);
});
it('usa duraciones exactas de cada cotización y condiciona el ensamble fijo del catálogo', () => {
  const r = adaptarCotizacionesF6(solicitud());
  expect(
    r.entrada.operaciones[1].mediciones.map(
      (m) => m.preparacionMin + m.ejecucionMin,
    ),
  ).toEqual([281, 555, 829, 1104]);
  expect(r.observaciones).toEqual(
    expect.arrayContaining([expect.stringContaining('30 minutos fijos')]),
  );
  expect(
    proponerEntregasPiloto(r.entrada).alternativas.every(
      (a) => a.estado === 'CONDICIONADA',
    ),
  ).toBe(true);
});
it('hereda las mismas tandas aunque el corte sea terminal y no haya ensamble', () => {
  const s = solicitud();
  for (const f of s.fuentes) {
    const p = f.cotizacion.pasos.find(
      (p) => p.familiaCodigo === 'ensamble_estructural',
    )!;
    p.activado = false;
    f.cotizacion.costos.total -= p.costoTotal;
  }
  const r = planificarCotizacionesF6(s);
  for (const a of r.resultado.alternativas) {
    const [imp, cut] = r.entrada.operaciones.slice(1);
    expect(
      a.operaciones
        .filter((o) => o.operacion === cut.codigo)
        .map((o) => [o.desde, o.hasta]),
    ).toEqual(
      a.operaciones
        .filter((o) => o.operacion === imp.codigo)
        .map((o) => [o.desde, o.hasta]),
    );
  }
});
it('no inventa medición para una tanda sin cotización', () => {
  const s = solicitud();
  s.fuentes = s.fuentes.filter((f) => f.cotizacion.cantidadPedida !== 50);
  const r = planificarCotizacionesF6(s),
    a = r.resultado.alternativas.find((a) => a.id === 'por-entrega')!;
  expect(a.estado).toBe('SIN_ESTIMACION');
  expect(a.costo).toBeNull();
  expect(a.entregas.every((e) => e.finProduccion === null)).toBe(true);
});
it('identifica la operación sin estación en lugar de presentar una fecha confirmada', () => {
  const s = solicitud();
  s.taller.estaciones = s.taller.estaciones.filter(
    (e) => e.id !== 'ensamble_estructural',
  );
  const r = planificarCotizacionesF6(s);
  expect(r.observaciones).toContain(
    'Ensamble estructural: falta una estación activa que reciba esta operación.',
  );
  expect(
    r.resultado.alternativas.every((a) => a.estado === 'CONDICIONADA'),
  ).toBe(true);
});
it('conserva snapshots y devuelve referencias livianas, sin copiar los contornos', () => {
  const s = solicitud();
  const antes = s.fuentes.map((f) => f.cotizacion.costos.total);
  const n = impresion(s).nestingResult!,
    primera = n.placements[0];
  const r = planificarCotizacionesF6(s);
  expect(impresion(s).nestingResult).toBe(n);
  expect(n.placements[0]).toBe(primera);
  expect(s.fuentes.map((f) => f.cotizacion.costos.total)).toEqual(antes);
  const json = JSON.stringify(r);
  expect(json).not.toContain('"contornos"');
  expect(json).not.toContain('"puntos"');
  expect(Buffer.byteLength(json)).toBeLessThan(256 * 1024);
});
it.each([
  [
    'otro tenant',
    (s: SolicitudAdaptadorF6) => {
      s.fuentes[0].tenantId = 'otro';
    },
    'tenants',
  ],
  [
    'otra solicitud',
    (s: SolicitudAdaptadorF6) => {
      s.fuentes[0].configuracionId = 'otra';
    },
    'configuración',
  ],
  [
    'cantidad repetida',
    (s: SolicitudAdaptadorF6) => {
      s.fuentes.push(s.fuentes[0]);
    },
    'duplicadas',
  ],
  [
    'revisión distinta',
    (s: SolicitudAdaptadorF6) => {
      s.fuentes[0].cotizacion.receta!.revisionId = 'otra';
    },
    'cambió',
  ],
  [
    'tarifa distinta',
    (s: SolicitudAdaptadorF6) => {
      impresion(s).tiempo!.tarifaHora = 10;
    },
    'cambió',
  ],
  [
    'geometría distinta',
    (s: SolicitudAdaptadorF6) => {
      impresion(s).nestingResult!.demandaNesting![0].geometria.anchoMm += 1;
    },
    'cambió',
  ],
  [
    'pieza faltante',
    (s: SolicitudAdaptadorF6) => {
      impresion(s).nestingResult!.placements.pop();
    },
    'demanda',
  ],
  [
    'pieza fuera de placa',
    (s: SolicitudAdaptadorF6) => {
      impresion(s).nestingResult!.placements[0].xMm = 900;
    },
    'fuera de la placa',
  ],
  [
    'registro desplazado',
    (s: SolicitudAdaptadorF6) => {
      corte(s).nestingResult!.placements[0].xMm += 1;
    },
    'registro físico',
  ],
  [
    'costo omitido',
    (s: SolicitudAdaptadorF6) => {
      s.fuentes[0].cotizacion.costos.total += 100;
    },
    'reconcilian',
  ],
  [
    'consolidación no soportada',
    (s: SolicitudAdaptadorF6) => {
      s.fuentes[0].cotizacion.analisisNestingCompuesto!.aplicadoACostos = true;
    },
    'consolidada',
  ],
  [
    'tercerizado',
    (s: SolicitudAdaptadorF6) => {
      corte(s).tercerizado = true;
    },
    'tipo de ejecución',
  ],
  [
    'preparación inventada',
    (s: SolicitudAdaptadorF6) => {
      s.operacionesUnaVez = ['fantasma'];
    },
    'inexistente',
  ],
] as const)(
  'rechaza %s antes de proponer fechas',
  (_nombre, mutar, mensaje) => {
    const s = solicitud();
    mutar(s);
    expect(() => adaptarCotizacionesF6(s)).toThrow(mensaje);
  },
);
