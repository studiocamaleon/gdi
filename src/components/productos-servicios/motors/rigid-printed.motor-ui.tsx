"use client";

import type {
  ProductMotorUiContract,
} from "@/components/productos-servicios/product-detail-types";
import { RigidPrintedTecnologiasTab } from "@/components/productos-servicios/motors/rigid-printed-tecnologias-tab";
import { RigidPrintedImposicionTab } from "@/components/productos-servicios/motors/rigid-printed-imposicion-tab";
import { RigidPrintedSimularCostoTab } from "@/components/productos-servicios/motors/rigid-printed-simular-costo-tab";
import { ProductoSimularCostoV2Tab } from "@/components/productos-servicios/producto-simular-costo-v2-tab";

const ENABLE_V2 = process.env.NEXT_PUBLIC_ENABLE_WIDE_FORMAT_V2 === "true";

export const rigidPrintedMotorUi: ProductMotorUiContract = {
  key: "rigidos_impresos@1",
  // modoMedidas=LIBRE en el producto oculta automáticamente "variantes" (P3.a.2).
  // Antes vivía como motorConfig.parametros.modoMedidas === 'libres' — migrado
  // al campo first-class del producto.
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
