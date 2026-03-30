"use client";

import type { ProductMotorUiContract } from "@/components/productos-servicios/product-detail-types";
import { DigitalImposicionTab } from "@/components/productos-servicios/motors/digital-imposicion-tab";
import { DigitalRutaBaseTab } from "@/components/productos-servicios/motors/digital-ruta-base-tab";
import { DigitalRutaOpcionalesTab } from "@/components/productos-servicios/motors/digital-ruta-opcionales-tab";
import { DigitalSimularCostoTab } from "@/components/productos-servicios/motors/digital-simular-costo-tab";
import { DigitalVariantesTab } from "@/components/productos-servicios/motors/digital-variantes-tab";

export const digitalMotorUi: ProductMotorUiContract = {
  key: "impresion_digital_laser@1",
  tabOrder: [
    "general",
    "variantes",
    "ruta_base",
    "ruta_opcionales",
    "imposicion",
    "simular_costo",
    "precio",
    "simular_venta",
  ],
  tabs: {
    variantes: DigitalVariantesTab,
    ruta_base: DigitalRutaBaseTab,
    ruta_opcionales: DigitalRutaOpcionalesTab,
    imposicion: DigitalImposicionTab,
    simular_costo: DigitalSimularCostoTab,
  },
};
