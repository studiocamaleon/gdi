"use client";

import type { ProductMotorUiContract } from "@/components/productos-servicios/product-detail-types";

// P3.b.3 — Tabs estándar para todos los productos: General, Variantes,
// Ruta de producción, Imposición, Simular costo, Precio, Simular venta.
// Los tabs motor-específicos (variantes digital, imposición digital, simular
// costo v1) fueron eliminados con los motores v1/v2 en P3.b.1/2.
export const digitalMotorUi: ProductMotorUiContract = {
  key: "impresion_digital_laser@1",
  tabs: {},
};
