"use client";

import type { ProductMotorUiContract } from "@/components/productos-servicios/product-detail-types";
import { DigitalImposicionTab } from "@/components/productos-servicios/motors/digital-imposicion-tab";
import { DigitalRutaBaseTab } from "@/components/productos-servicios/motors/digital-ruta-base-tab";
import { DigitalSimularCostoTab } from "@/components/productos-servicios/motors/digital-simular-costo-tab";
import { DigitalVariantesTab } from "@/components/productos-servicios/motors/digital-variantes-tab";
import { ProductoSimularCostoV2Tab } from "@/components/productos-servicios/producto-simular-costo-v2-tab";

const ENABLE_V2 = process.env.NEXT_PUBLIC_ENABLE_WIDE_FORMAT_V2 === "true";

const v2ExtraTab = {
  key: "simular_costo_v2",
  label: "Simular costo (v2)",
  render: ProductoSimularCostoV2Tab,
};

export const digitalMotorUi: ProductMotorUiContract = {
  key: "impresion_digital_laser@1",
  tabOrder: [
    "general",
    "variantes",
    "ruta_base",
    "imposicion",
    "simular_costo",
    ...(ENABLE_V2 ? ["simular_costo_v2"] : []),
    "precio",
    "simular_venta",
  ],
  tabs: {
    variantes: DigitalVariantesTab,
    ruta_base: DigitalRutaBaseTab,
    imposicion: DigitalImposicionTab,
    simular_costo: DigitalSimularCostoTab,
  },
  extraTabs: ENABLE_V2 ? [v2ExtraTab] : [],
};
