"use client";

import type {
  ProductMotorUiContract,
  ProductTabKey,
} from "@/components/productos-servicios/product-detail-types";
import type { ProductoMotorConfig } from "@/lib/productos-servicios";
import { RigidPrintedTecnologiasTab } from "@/components/productos-servicios/motors/rigid-printed-tecnologias-tab";
import { RigidPrintedImposicionTab } from "@/components/productos-servicios/motors/rigid-printed-imposicion-tab";
import { RigidPrintedSimularCostoTab } from "@/components/productos-servicios/motors/rigid-printed-simular-costo-tab";
import { ProductoSimularCostoV2Tab } from "@/components/productos-servicios/producto-simular-costo-v2-tab";

const ENABLE_V2 = process.env.NEXT_PUBLIC_ENABLE_WIDE_FORMAT_V2 === "true";

export const rigidPrintedMotorUi: ProductMotorUiContract = {
  key: "rigidos_impresos@1",
  hiddenTabs: (motorConfig: ProductoMotorConfig | null): ProductTabKey[] => {
    const params = (motorConfig?.parametros ?? {}) as Record<string, unknown>;
    const modoMedidas = params.modoMedidas as string | undefined;
    // Si modo es "libres", ocultar variantes (no se necesitan medidas estándar)
    if (modoMedidas === "libres") return ["variantes"];
    return [];
  },
  tabOrder: [
    "general",
    "tecnologias",
    "variantes",
    "ruta_produccion",
    "imposicion",
    "simular_costo",
    ...(ENABLE_V2 ? ["simular_costo_v2"] : []),
    "precio",
    "simular_venta",
  ],
  tabs: {
    imposicion: RigidPrintedImposicionTab,
    simular_costo: RigidPrintedSimularCostoTab,
  },
  extraTabs: [
    {
      key: "tecnologias",
      label: "Tecnologías",
      render: RigidPrintedTecnologiasTab,
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
