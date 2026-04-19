"use client";

import type { ProductMotorUiContract } from "@/components/productos-servicios/product-detail-types";

// P3.b.3 — Tabs estándar. El tab "Tecnologías" (gestionaba qué tecnologías
// soportaba este producto) quedó subsumido por alternativas de máquina+perfil
// por paso (P1.3). modoMedidas=LIBRE sigue ocultando variantes (P3.a.2).
export const rigidPrintedMotorUi: ProductMotorUiContract = {
  key: "rigidos_impresos@1",
  tabs: {},
};
