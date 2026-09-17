import { huellaPlan } from './planificacion-contrato';

const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/** Sólo excluye datos comerciales y metadatos del cálculo. Ante cualquier
 * diferencia productiva se exige recalcular, incluso con el mismo producto. */
export function huellaFuenteProductiva(c: {
  productoId: string;
  rutaAlternativaId: string | null;
  cantidad: unknown;
  recetaRevisionId: string | null;
  recetaHuella: string | null;
  jobContextJson: unknown;
  snapshotJson: unknown;
  trazabilidadJson: unknown;
}) {
  const snapshot = objeto(c.snapshotJson);
  const motor = objeto(snapshot.motor);
  const traza = objeto(c.trazabilidadJson);
  const componentes = (lista: unknown): unknown =>
    Array.isArray(lista)
      ? lista.map((valor: unknown) => {
          const c = objeto(valor);
          const produccion = Object.fromEntries(
            Object.entries(c).filter(
              ([clave]) =>
                ![
                  'pricing',
                  'cantidadComercialPricing',
                  'unidadComercialPricing',
                  'componentes',
                ].includes(clave),
            ),
          );
          return { ...produccion, componentes: componentes(c.componentes) };
        })
      : (lista ?? null);
  return huellaPlan(
    {
      productoId: c.productoId,
      rutaAlternativaId: c.rutaAlternativaId,
      cantidad: Number(c.cantidad),
      recetaRevisionId: c.recetaRevisionId,
      recetaHuella: c.recetaHuella,
      jobContext: c.jobContextJson,
      producto: snapshot.producto,
      receta: snapshot.receta,
      ruta: snapshot.ruta,
      ejecucion: snapshot.ejecucion,
      motor: {
        contractVersion: motor.contractVersion,
        periodo: motor.periodoTarifario,
      },
      pasos: traza.pasos,
      componentes: componentes(traza.componentesFabricados),
      nesting: traza.analisisNestingCompuesto,
      costosCompuesto: traza.desgloseCostosPricingCompuesto,
      cargos: traza.cargosDirectosCotizacion,
    },
    (v) => {
      const resultado = objeto(v);
      if (resultado.algorithm !== 'irregular-2d-bottom-left-v1') return v;
      // Reutilizar un layout cambia el diagnóstico de búsqueda, no el corte.
      return Object.fromEntries(
        Object.entries(resultado).filter(
          ([clave]) =>
            ![
              'duracionMs',
              'busqueda',
              'calidadSolucion',
              'optimizacionAgotada',
            ].includes(clave),
        ),
      );
    },
  );
}
