"use client";

import type { ProductMotorUiContract } from "@/components/productos-servicios/product-detail-types";
import { TalonarioComposicionTab } from "@/components/productos-servicios/motors/talonario-composicion-tab";
import { DigitalRutaBaseTab } from "@/components/productos-servicios/motors/digital-ruta-base-tab";
import { TalonarioVariantesTab } from "@/components/productos-servicios/motors/talonario-variantes-tab";
import { DigitalImposicionTab } from "@/components/productos-servicios/motors/digital-imposicion-tab";
import { DigitalSimularCostoTab } from "@/components/productos-servicios/motors/digital-simular-costo-tab";
import { ProductoSimularCostoV2Tab } from "@/components/productos-servicios/producto-simular-costo-v2-tab";

const ENABLE_V2 = process.env.NEXT_PUBLIC_ENABLE_WIDE_FORMAT_V2 === "true";

export const talonarioMotorUi: ProductMotorUiContract = {
  key: "talonario@1",
  tabOrder: [
    "general",
    "composicion",
    "variantes",
    "ruta_base",
    "ruta_produccion",
    "imposicion",
    "simular_costo",
    ...(ENABLE_V2 ? ["simular_costo_v2"] : []),
    "precio",
    "simular_venta",
  ],
  tabs: {
    variantes: TalonarioVariantesTab,
    ruta_base: DigitalRutaBaseTab,
    imposicion: DigitalImposicionTab,
    simular_costo: DigitalSimularCostoTab,
  },
  extraTabs: [
    {
      key: "composicion",
      label: "Composición",
      render: TalonarioComposicionTab,
    },
    ...(ENABLE_V2
      ? [
          {
            key: "simular_costo_v2",
            label: "Simular costo (v2)",
            render: ProductoSimularCostoV2Tab,
          },
        ]
      : []),
  ],
};
