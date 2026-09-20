import {
  proyectarMaterialesOrden,
  type ItemMaterialesSnapshot,
} from './materiales-orden.proyeccion';
type R = Record<string, unknown>;
const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const obj = (v: unknown): R =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as R) : {};
const list = (v: unknown): R[] => (Array.isArray(v) ? v.map(obj) : []);

/** Construye filas virtuales sin persistir la cotización ni la OT. Usa el mismo
 * conteo físico y las conversiones congeladas del control de materiales. */
export function materialesDeCotizaciones(
  entradas: Array<{
    id: string;
    nombre: string;
    cotizacion: unknown;
    jobContext?: unknown;
  }>,
) {
  const items: ItemMaterialesSnapshot[] = [];
  function visitar(
    id: string,
    nombre: string,
    valor: unknown,
    job: unknown,
    padre: string | null,
    codigo: string | null,
    lotes: R[],
    depth = 0,
  ) {
    const traza = obj(valor);
    if (depth > 10) {
      items.push({
        id,
        nombre,
        parentItemId: padre,
        componenteCodigo: codigo,
        contieneLotesEntrega: false,
        trazabilidadSnapshotJson: null,
        cotizacionItem: null,
        pasos: [],
      });
      return;
    }
    const propios = list(obj(traza.analisisNestingCompuesto).grupos)
      .filter((g) => obj(g.aplicacion).aplicado === true)
      .map((g) => obj(g.lote));
    const pasos = list(traza.pasos)
      .filter((p) => p.activado !== false)
      .map((p, i) => {
        const compatibles = lotes.filter((l) =>
          list(l.participantes).some(
            (x) =>
              x.componenteCodigo === codigo && x.rutaPasoId === p.rutaPasoId,
          ),
        );
        const lote = compatibles.length === 1 ? compatibles[0] : null;
        const participante = lote
          ? list(lote.participantes).find(
              (x) =>
                x.componenteCodigo === codigo && x.rutaPasoId === p.rutaPasoId,
            )
          : null;
        return {
          id: `${id}/paso/${i}`,
          nombre: texto(p.nombreVisible) || texto(p.nombre) || `Paso ${i + 1}`,
          rutaPasoId: typeof p.rutaPasoId === 'string' ? p.rutaPasoId : null,
          nestingLoteId: lote && typeof lote.id === 'string' ? lote.id : null,
          nestingLoteRol: lote
            ? participante?.esPasoOperativo === true
              ? 'OPERATIVO'
              : 'PARTICIPANTE'
            : null,
          nestingLoteSnapshotJson:
            participante?.esPasoOperativo === true ? lote : null,
        };
      });
    items.push({
      id,
      nombre,
      parentItemId: padre,
      componenteCodigo: codigo,
      contieneLotesEntrega: false,
      trazabilidadSnapshotJson: { ...traza, componentesFabricados: [] },
      jobContextSnapshotJson: job,
      cotizacionItem: null,
      pasos,
    });
    for (const [i, hijo] of list(
      traza.componentesFabricados ?? traza.componentes,
    ).entries())
      visitar(
        `${id}/componente/${i}`,
        `${nombre} · ${texto(hijo.nombre) || texto(hijo.codigo) || 'Componente'}`,
        hijo,
        hijo.jobContext,
        id,
        texto(hijo.codigo),
        propios,
        depth + 1,
      );
  }
  for (const e of entradas)
    visitar(e.id, e.nombre, e.cotizacion, e.jobContext, null, null, []);
  return proyectarMaterialesOrden('prevision', items);
}
