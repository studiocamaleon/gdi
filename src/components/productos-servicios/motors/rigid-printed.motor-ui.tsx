"use client";

import type {
  ProductMotorUiContract,
  ProductTabProps,
} from "@/components/productos-servicios/product-detail-types";
import { RigidPrintedTecnologiasTab } from "@/components/productos-servicios/motors/rigid-printed-tecnologias-tab";
import { RigidPrintedImposicionTab } from "@/components/productos-servicios/motors/rigid-printed-imposicion-tab";
import { RigidPrintedSimularCostoTab } from "@/components/productos-servicios/motors/rigid-printed-simular-costo-tab";

export const rigidPrintedMotorUi: ProductMotorUiContract = {
  key: "rigidos_impresos@1",
  tabOrder: [
    "general",
    "tecnologias",
    "variantes",
    "ruta_base",
    "ruta_opcionales",
    "imposicion",
    "simular_costo",
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
  ],
};
