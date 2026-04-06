"use client";

import type {
  ProductMotorUiContract,
  ProductTabKey,
} from "@/components/productos-servicios/product-detail-types";
import type { ProductoMotorConfig } from "@/lib/productos-servicios";
import { RigidPrintedRutaBaseTab } from "@/components/productos-servicios/motors/rigid-printed-ruta-base-tab";
import { RigidPrintedTecnologiasTab } from "@/components/productos-servicios/motors/rigid-printed-tecnologias-tab";
import { RigidPrintedImposicionTab } from "@/components/productos-servicios/motors/rigid-printed-imposicion-tab";
import { RigidPrintedSimularCostoTab } from "@/components/productos-servicios/motors/rigid-printed-simular-costo-tab";

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
    "ruta_base",
    "ruta_opcionales",
    "imposicion",
    "simular_costo",
    "precio",
    "simular_venta",
  ],
  tabs: {
    ruta_base: RigidPrintedRutaBaseTab,
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
