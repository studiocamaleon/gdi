"use client";

import type { ProductMotorUiContract } from "@/components/productos-servicios/product-detail-types";
import { TalonarioComposicionTab } from "@/components/productos-servicios/motors/talonario-composicion-tab";
import { DigitalRutaBaseTab } from "@/components/productos-servicios/motors/digital-ruta-base-tab";
import { TalonarioVariantesTab } from "@/components/productos-servicios/motors/talonario-variantes-tab";
import { DigitalImposicionTab } from "@/components/productos-servicios/motors/digital-imposicion-tab";
import { DigitalSimularCostoTab } from "@/components/productos-servicios/motors/digital-simular-costo-tab";

export const talonarioMotorUi: ProductMotorUiContract = {
  key: "talonario@1",
  tabOrder: [
    "general",
    "composicion",
    "variantes",
    "ruta_base",
    "imposicion",
    "simular_costo",
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
  ],
};
