import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { exhibidorControlado } from '../../../test/fixtures/f6-planificacion/exhibidor-controlado';
import {
  adaptarCotizacionesF6,
  planificarCotizacionesF6,
  planesGuardadosF6,
  type FuenteCotizacionF6,
  type SolicitudAdaptadorF6,
} from './adaptador-cotizacion';
import { evaluarLayoutsEntregas } from './layouts-entregas';

/** Capturas del motor del 12/09: tarjetas 500/100, impresión en pliegos y
 * laminado en rollo. El calendario vacío es sintético para aislar el cálculo. */
function solicitud(): SolicitudAdaptadorF6 {
  const fuentes = JSON.parse(
    gunzipSync(
      readFileSync(
        join(
          __dirname,
          '../../../test/fixtures/f6-planificacion/tarjetas-500-100.json.gz',
        ),
      ),
    ).toString(),
  ) as FuenteCotizacionF6[];
  const taller = exhibidorControlado().taller;
  const pasos = fuentes[0].cotizacion.pasos.filter((p) => p.activado);
  return {
    fuentes,
    tenantId: fuentes[0].tenantId,
    configuracionId: fuentes[0].configuracionId,
    cantidad: 500,
    entregas: Array.from({ length: 5 }, (_, i) => ({
      id: `e${i}`,
      cantidad: 100,
    })),
    porEntrega: true,
    margenDiasHabiles: 0,
    prioridadSinFechas: 'PRIMERAS_ENTREGAS',
    condicionesPendientes: [],
    operacionesUnaVez: [],
    taller: {
      ...taller,
      items: [],
      estaciones: pasos.map((p) => ({
        ...taller.estaciones[0],
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

it('calcula cinco entregas de 100 con costos y tiempos propios, pliegos repetidos y laminado en rollo', () => {
  const s = solicitud();
  const r = planificarCotizacionesF6(s);
  const a = r.resultado.alternativas.find((a) => a.id === 'por-entrega')!;
  const detalle = r.detalles.find((d) => d.alternativaId === a.id)!;
  expect(a.estado).not.toBe('SIN_ESTIMACION');
  expect(a.entregas).toHaveLength(5);
  expect(a.entregas.every((e) => e.cantidad === 100 && e.finProduccion)).toBe(
    true,
  );
  expect(a.costo).toBeCloseTo(5 * s.fuentes[1].cotizacion.costos.total, 6);
  expect(a.costo).not.toBeCloseTo(s.fuentes[0].cotizacion.costos.total, 2);
  expect(detalle.placasNuevas).toBe(50);
  expect(detalle.lotesGeometricos).toHaveLength(10);
  expect(
    detalle.lotesGeometricos.every(
      (l) => l.modo === 'LOTE_COMPLETO' && l.cantidadProductos === 100,
    ),
  ).toBe(true);
  const desgaste = detalle.materiales.filter((m) =>
    m.id.startsWith('desgaste:'),
  );
  expect(desgaste).toHaveLength(7);
  expect(new Set(desgaste.map((m) => m.id)).size).toBe(7);
  expect(desgaste.every((m) => m.cantidad === 50 && m.costo > 0)).toBe(true);
  for (const paso of s.fuentes[1].cotizacion.pasos.filter((p) => p.activado)) {
    const lotes = a.operaciones.filter((o) =>
      o.operacion.endsWith(`ruta:${paso.rutaPasoId}`),
    );
    expect(lotes).toHaveLength(5);
    const operacion = r.entrada.operaciones.find(
      (o) => o.codigo === lotes[0].operacion,
    )!;
    const medicion = operacion.mediciones.find(
      (m) => m.cantidadProductos === 100,
    )!;
    expect(medicion.preparacionMin + medicion.ejecucionMin).toBe(
      paso.tiempo!.totalMin,
    );
  }
});

it('requiere aceptar el acomodo de cada entrega y conserva una entrega única sin inventar copias de layouts', () => {
  const s = solicitud();
  const originales = planesGuardadosF6(s.fuentes[0], true);
  const r = planificarCotizacionesF6(s);
  const revision = evaluarLayoutsEntregas(
    originales,
    r.detalles[0].lotesGeometricos,
  );
  expect(revision.estado).toBe('REQUIERE_AJUSTE');
  expect(revision.motivo).toContain('cada entrega');
  expect(revision.placasOriginales).toBe(21);
  expect(revision.placasPlan).toBe(50);
  expect(revision.lotes.every((l) => l.modo === 'LOTE_COMPLETO')).toBe(true);
  s.entregas = [{ id: 'unica', cantidad: 500 }];
  const unico = planificarCotizacionesF6(s);
  expect(
    evaluarLayoutsEntregas(originales, unico.detalles[0].lotesGeometricos)
      .estado,
  ).toBe('CONSERVADO');
});

it('rechaza posiciones fuera del sustrato y conserva el límite de reparto físico del piloto', () => {
  const s = solicitud();
  s.porEntrega = false;
  expect(() => adaptarCotizacionesF6(s)).toThrow(
    'placas físicas individualizadas',
  );
  s.porEntrega = true;
  s.fuentes[1].cotizacion.pasos.find(
    (p) => p.nestingResult,
  )!.nestingResult!.placements[0].xMm = 5000;
  expect(() => adaptarCotizacionesF6(s)).toThrow('fuera del sustrato');
});
