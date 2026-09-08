import type {
  ComponenteFabricadoCosteado,
  LoteNestingCompuestoSnapshot,
} from './tipos';

export function corteHeredadoDe(paso: {
  nestingResult?: { placements: Array<{ meta?: unknown }> };
}) {
  const placements = paso.nestingResult?.placements ?? [];
  const fuentes = placements.map(
    (p) =>
      (p.meta as { layoutHeredadoDe?: string } | undefined)?.layoutHeredadoDe,
  );
  return fuentes.length && fuentes[0] && fuentes.every((f) => f === fuentes[0])
    ? fuentes[0]
    : undefined;
}

/** La impresión ya fue costeada y congelada. Proyecta sus poses sobre los
 * cortes registrados sin volver a anidar ni crear otro cargo de sustrato. */
export function registrarCortesDelLote(
  lote: LoteNestingCompuestoSnapshot,
  componentes: ComponenteFabricadoCosteado[],
) {
  const resultado = lote.nestingResult;
  if (!resultado.solucionNesting) return;
  const demandas = new Map(
    resultado.solucionNesting.problema.demandas.map((d) => [d.id, d]),
  );
  for (const participante of lote.participantes) {
    const componente = componentes.find(
      (c) => c.codigo === participante.componenteCodigo,
    );
    if (!componente) continue;
    const cortes = (componente.pasos ?? []).filter(
      (p) => corteHeredadoDe(p) === participante.rutaPasoId,
    );
    if (!cortes.length) continue;
    const placements = resultado.placements.filter((p) => {
      const propietario = demandas.get(p.pieceId)?.propietario;
      return (
        propietario?.componenteCodigo === participante.componenteCodigo &&
        propietario?.pasoClave === participante.pasoClave
      );
    });
    // Actualiza también el origen: sus poses y el layout exportable deben
    // corresponder al lote, no al acomodo individual previo a consolidar.
    const impresion = componente.pasos?.find(
      (p) => p.rutaPasoId === participante.rutaPasoId && p.configPasoId === participante.pasoClave,
    );
    if (impresion?.nestingResult) {
      const anterior = impresion.nestingResult;
      const layout = anterior.outputsCanonicos?.layout_produccion;
      impresion.nestingResult = {
        ...anterior,
        substrates: resultado.substrates,
        placements,
        piezasAcomodadas: placements.length,
        cantidadCalculada: resultado.cantidadCalculada,
        visualConfig: resultado.visualConfig,
        ...(layout && typeof layout === 'object' && !Array.isArray(layout) ? {
          outputsCanonicos: {
            ...anterior.outputsCanonicos,
            layout_produccion: {
              ...layout,
              algorithm: resultado.algorithm,
              substrates: resultado.substrates,
              placements,
              visualConfig: resultado.visualConfig,
            },
          },
        } : {}),
      };
      if (impresion.nestingResult.outputsCanonicos?.layout_produccion) {
        impresion.outputsCanonicos = {
          ...impresion.outputsCanonicos,
          layout_produccion: impresion.nestingResult.outputsCanonicos.layout_produccion,
        };
      }
    }
    for (const corte of cortes) {
      const anterior = corte.nestingResult!;
      // Conserva la operación y su costo ya calculado por perímetro. La clave
      // de registro no suprime pasos de corte como haría loteNestingCompuesto.
      corte.nestingResult = {
        ...anterior,
        layoutRegistradoLoteId: lote.id,
        substrates: resultado.substrates,
        cantidadCalculada: resultado.cantidadCalculada,
        placements: placements.map((p) => ({
          ...p,
          meta: {
            ...(p.meta as object),
            layoutHeredadoDe: participante.rutaPasoId,
          },
        })),
        piezasAcomodadas: placements.length,
        visualConfig: resultado.visualConfig,
      };
    }
  }
}
