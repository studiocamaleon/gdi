import type { PlanGeometricoF6 } from './adaptador-cotizacion';

type LoteGeometrico = PlanGeometricoF6 & {
  loteId: string;
  desde: number;
  hasta: number;
};

/** Compara copias físicas enteras o el acomodo completo de cada lote rectangular.
 * Igual cantidad de placas no prueba que
 * los layouts sean iguales; la huella incluye posiciones, capas y proceso.
 * Si el nuevo cálculo eligió otra disposición, requiere aceptación explícita.
 */
export function evaluarLayoutsEntregas(
  originales: PlanGeometricoF6[] | null,
  lotes: LoteGeometrico[],
) {
  const raices = lotes.filter((l) => !l.origenOperacion);
  const usadas = new Map<string, number>();
  let conserva = originales !== null;
  const detalle = raices.map((lote) => {
    const origen = originales?.find((p) => p.operacion === lote.operacion);
    const layouts = lote.layouts.map((layout) => {
      const indice =
        origen?.layouts.findIndex((p) => p.huella === layout.huella) ?? -1;
      const original = indice >= 0 ? origen!.layouts[indice] : null;
      const key = `${lote.operacion}:${layout.huella}`;
      const consumidas = usadas.get(key) ?? 0;
      const copias = layout.placasIndices.length;
      usadas.set(key, consumidas + copias);
      const indicesOriginales =
        original?.placasIndices.slice(consumidas, consumidas + copias) ?? [];
      if (indicesOriginales.length !== copias) conserva = false;
      return {
        huella: layout.huella,
        copias,
        indicesOriginales,
        layoutOriginal: indice >= 0 ? indice + 1 : null,
      };
    });
    // El corte que hereda una impresión debe seguir el mismo lote físico.
    for (const hijo of lotes.filter(
      (l) =>
        l.origenOperacion === lote.operacion &&
        l.desde === lote.desde &&
        l.hasta === lote.hasta,
    )) {
      const originalHijo = originales?.find(
        (p) => p.operacion === hijo.operacion,
      );
      for (const layout of hijo.layouts) {
        const key = `${hijo.operacion}:${layout.huella}`;
        const acumuladas = (usadas.get(key) ?? 0) + layout.placasIndices.length;
        usadas.set(key, acumuladas);
        if (
          acumuladas >
          (originalHijo?.layouts.find((l) => l.huella === layout.huella)
            ?.placasIndices.length ?? 0)
        )
          conserva = false;
      }
    }
    return {
      loteId: lote.loteId,
      operacion: lote.operacion,
      desde: lote.desde,
      hasta: lote.hasta,
      cantidad: lote.cantidadProductos,
      modo: lote.modo,
      placas: lote.placas,
      layouts,
    };
  });
  // Ninguna copia original debe desaparecer, duplicarse ni fabricarse de más.
  for (const original of originales ?? [])
    for (const layout of original.layouts)
      if (
        usadas.get(`${original.operacion}:${layout.huella}`) !==
        layout.placasIndices.length
      )
        conserva = false;
  const estado =
    !lotes.length && !originales?.length
      ? ('SIN_NESTING' as const)
      : conserva
        ? ('CONSERVADO' as const)
        : ('REQUIERE_AJUSTE' as const);
  return {
    estado,
    motivo:
      estado === 'SIN_NESTING'
        ? 'Este producto no tiene layouts que repartir.'
        : estado === 'CONSERVADO'
          ? raices.some((l) => l.modo === 'LOTE_COMPLETO')
            ? 'Se conserva el acomodo completo cotizado, con sus sustratos y cantidades.'
            : 'Cada tanda utiliza copias enteras de los layouts originales, con todas sus piezas y capas.'
          : originales === null
            ? 'No se pudo verificar el nesting original. La propuesta utiliza el nesting calculado para cada tanda.'
            : raices.some((l) => l.modo === 'LOTE_COMPLETO')
              ? 'Se recalculó el acomodo completo para cada entrega. Los formatos, consumos y costos pueden cambiar respecto del pedido completo.'
              : 'El nesting calculado para estas tandas cambia la distribución o las copias de los layouts originales.',
    placasOriginales:
      originales === null
        ? null
        : originales
            .filter((p) => !p.origenOperacion)
            .reduce((s, p) => s + p.placas, 0),
    placasPlan: raices.reduce((s, l) => s + l.placas, 0),
    lotes: detalle,
  };
}

export type RevisionLayoutsEntregas = ReturnType<typeof evaluarLayoutsEntregas>;
