import type {
  CotizarResponse,
  NestingViewerInput,
} from "./productos-servicios-api";
import { vincularFuentesFabricacion } from "./fabricacion-export";
import { esFamiliaCorteNesting } from "./nesting-procesos";
export type CotizacionFabricacion = NonNullable<CotizarResponse["cotizacion"]>;
type ComponentePlan = Pick<
  NonNullable<CotizacionFabricacion["componentesFabricados"]>[number],
  | "codigo"
  | "productoId"
  | "nombre"
  | "ocurrenciaId"
  | "jobContext"
  | "pasos"
  | "componentes"
  | "analisisNestingCompuesto"
>;
export type OperacionPlan = {
  id: string;
  origenId?: string;
  nombre: string;
  material: string;
  materialId?: string;
  esCorte: boolean;
  procesamientoCorte?: import("./procesamiento-corte").ProcesamientoCorteCosteado;
  result: NestingViewerInput;
};
export type PlanFabricacion = {
  id: string;
  material: string;
  result: NestingViewerInput;
  operaciones: OperacionPlan[];
};

export function obtenerPlanesFabricacion(
  cotizacion?: CotizacionFabricacion | null,
  jobContext?: Record<string, unknown>,
): PlanFabricacion[] {
  if (!cotizacion) return [];
  const operaciones: OperacionPlan[] = [];
  const recorrer = (
    componentes: ComponentePlan[] | undefined,
    ruta: string,
    analisis?: CotizacionFabricacion["analisisNestingCompuesto"],
  ) => {
    const grupos =
      analisis?.grupos.filter((g) => g.aplicacion?.aplicado && g.lote) ?? [];
    operaciones.push(
      ...grupos.map((g): OperacionPlan => {
        const lote = g.lote!;
        const n = lote.nestingResult;
        const familias = g.participantes.map((participante) =>
          componentes
            ?.find(
              (c) =>
                c.codigo === participante.componenteCodigo &&
                c.productoId === participante.productoId,
            )
            ?.pasos?.find((p) => p.rutaPasoId === participante.rutaPasoId)
            ?.familiaCodigo,
        );
        return {
          id: ruta === "componentes" ? lote.id : `${ruta}/lotes/${lote.id}`,
          origenId: lote.layoutOrigenLoteId
            ? ruta === "componentes"
              ? lote.layoutOrigenLoteId
              : `${ruta}/lotes/${lote.layoutOrigenLoteId}`
            : undefined,
          nombre: g.participantes[0]?.pasoNombre ?? "Fabricación",
          material: lote.materialNombre,
          materialId: lote.materialVarianteId,
          procesamientoCorte: lote.procesamientoCorte,
          esCorte:
            Boolean(lote.procesamientoCorte) ||
            (familias.length > 0 && familias.every(esFamiliaCorteNesting)),
          result: {
            ...n,
            cantidadCalculada:
              n.cantidadCalculada ??
              n.substrates.reduce(
                (s, p) => s + (p.kind === "sheet" ? p.count : 1),
                0,
              ),
            unidad: n.unidad ?? "pliegos",
            piezasAcomodadas: n.piezasAcomodadas ?? n.placements.length,
          },
        };
      }),
    );
    for (const [index, c] of (componentes ?? []).entries()) {
      const scope = `${ruta}/${index}:${c.ocurrenciaId ?? c.codigo}`;
      const contexto = c.jobContext as
        | {
            disenosVectoriales?: unknown[];
            piezas?: Array<{ cantidadPorUnidad?: number }>;
          }
        | undefined;
      if (
        contexto?.disenosVectoriales?.length ||
        contexto?.piezas?.some((p) => p.cantidadPorUnidad != null)
      ) {
        for (const [i, p] of (c.pasos ?? []).entries()) {
          if (
            !p.activado ||
            !p.nestingResult ||
            grupos.some((g) =>
              g.participantes.some(
                (m) =>
                  m.componenteCodigo === c.codigo &&
                  m.productoId === c.productoId &&
                  m.rutaPasoId === p.rutaPasoId,
              ),
            )
          )
            continue;
          const n = vincularFuentesFabricacion(p.nestingResult, c.jobContext);
          const origenes = new Set(
            n.placements.flatMap((v) => {
              const id = (v.meta as { layoutHeredadoDe?: unknown } | undefined)
                ?.layoutHeredadoDe;
              return typeof id === "string" ? [id] : [];
            }),
          );
          const origen = origenes.size === 1 ? [...origenes][0] : undefined;
          operaciones.push({
            id: `${scope}/${p.rutaPasoId ?? i}`,
            origenId: origen ? `${scope}/${origen}` : undefined,
            nombre: p.nombreVisible ?? "Fabricación",
            material: n.sustrato?.nombre ?? c.nombre,
            materialId: n.sustrato?.materialVarianteId,
            esCorte: esFamiliaCorteNesting(p.familiaCodigo),
            procesamientoCorte: p.tiempo?.procesamientoCorte,
            result: n,
          });
        }
      }
      recorrer(
        c.componentes as CotizacionFabricacion["componentesFabricados"],
        scope,
        c.analisisNestingCompuesto,
      );
    }
  };
  if (
    Array.isArray(jobContext?.disenosVectoriales) &&
    jobContext.disenosVectoriales.length
  ) {
    recorrer(
      [
        {
          codigo: "producto",
          productoId: cotizacion.productoId,
          nombre: cotizacion.productoNombre,
          jobContext,
          pasos: cotizacion.pasos,
        },
      ],
      "producto",
    );
  }
  recorrer(
    cotizacion.componentesFabricados,
    "componentes",
    cotizacion.analisisNestingCompuesto,
  );
  const porId = new Map(operaciones.map((o) => [o.id, o]));
  const raiz = (o: OperacionPlan): OperacionPlan => {
    const visitados = new Set([o.id]);
    let actual = o;
    while (actual.origenId) {
      const anterior = porId.get(actual.origenId);
      if (!anterior || visitados.has(anterior.id)) break;
      // Un vínculo inválido no debe ocultar el material de otra operación.
      if (
        actual.materialId &&
        anterior.materialId &&
        actual.materialId !== anterior.materialId
      )
        break;
      visitados.add(anterior.id);
      actual = anterior;
    }
    return actual;
  };
  const planes = new Map<string, PlanFabricacion>();
  for (const operacion of operaciones) {
    const base = raiz(operacion);
    if (!planes.has(base.id))
      planes.set(base.id, {
        id: base.id,
        material: base.material,
        result: base.result,
        operaciones: [],
      });
    planes.get(base.id)!.operaciones.push(operacion);
  }
  return [...planes.values()];
}
