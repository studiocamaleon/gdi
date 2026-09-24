import type { CotizarResponse } from "./productos-servicios-api";

export type DecisionMaterialStock = {
  configPasoId: string;
  slotCodigo: string;
  recomendadoVarianteId: string | null;
  alternativas: { id: string }[];
};

/** El motor identifica el paso y el slot: sus nombres visibles pueden repetirse. */
export function decisionesMaterialStock(resultado: CotizarResponse | null): DecisionMaterialStock[] {
  return (resultado?.errores ?? []).flatMap((error) => {
    if (!["material_auto_sin_stock_suficiente", "material_auto_requiere_reposicion"].includes(error.codigo)) return [];
    const c = error.contexto;
    if (typeof c?.configPasoId !== "string" || typeof c.slotCodigo !== "string") return [];
    return [{
      configPasoId: c.configPasoId,
      slotCodigo: c.slotCodigo,
      recomendadoVarianteId: typeof c.recomendadoVarianteId === "string" ? c.recomendadoVarianteId : null,
      alternativas: Array.isArray(c.alternativas) ? c.alternativas.filter((a): a is { id: string } => !!a && typeof a.id === "string") : [],
    }];
  });
}

export function hayDecisionMaterialStockPendiente(resultado: CotizarResponse | null, seleccion: Record<string, string>): boolean {
  return decisionesMaterialStock(resultado).some((d) => !seleccion[`${d.configPasoId}_${d.slotCodigo}`]);
}
