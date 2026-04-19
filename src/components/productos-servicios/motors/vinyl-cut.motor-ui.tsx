"use client";

import type { ProductMotorUiContract } from "@/components/productos-servicios/product-detail-types";

// P3.b.3 — Tabs estándar. "Equipos y materiales" subsumido por materiales
// declarativos (P1.4) en cada paso de la ruta. modoMedidas=LIBRE oculta
// "variantes" (P3.a.2).
export const vinylCutMotorUi: ProductMotorUiContract = {
  key: "vinilo_de_corte@1",
  tabs: {},
};
