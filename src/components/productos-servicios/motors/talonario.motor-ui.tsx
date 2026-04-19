"use client";

import type { ProductMotorUiContract } from "@/components/productos-servicios/product-detail-types";

// P3.b.3 — Tabs estándar para todos los productos. El tab "Composición"
// que era específico de talonario se migra a pasos de la ruta de producción:
// el concepto (número de hojas, tipo de copia, numeración) se declara como
// parámetros de paso en el modelo universal.
export const talonarioMotorUi: ProductMotorUiContract = {
  key: "talonario@1",
  tabs: {},
};
