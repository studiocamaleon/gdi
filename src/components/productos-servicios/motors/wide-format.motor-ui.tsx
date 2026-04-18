"use client";

import type { ProductMotorUiContract, ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { WideFormatImposicionTab } from "@/components/productos-servicios/motors/wide-format-imposicion-tab";
import { WideFormatRutaBaseTab } from "@/components/productos-servicios/motors/wide-format-ruta-base-tab";
import { WideFormatSimularCostoTab } from "@/components/productos-servicios/motors/wide-format-simular-costo-tab";
import { WideFormatTecnologiasTab } from "@/components/productos-servicios/motors/wide-format-tecnologias-tab";
import { ProductoStandardTabPlaceholder } from "@/components/productos-servicios/producto-standard-tab-placeholder";

function WideFormatVariantesPlaceholder(_props: ProductTabProps) {
  return (
    <ProductoStandardTabPlaceholder
      title="Variantes"
      description="Gran formato todavía administra sus variantes técnicas fuera del esquema común de variantes."
    />
  );
}

export const wideFormatMotorUi: ProductMotorUiContract = {
  key: "gran_formato@1",
  hiddenTabs: ["variantes"],
  tabOrder: [
    "general",
    "tecnologias",
    "ruta_base",
    "imposicion",
    "simular_costo",
    "precio",
    "simular_venta",
  ],
  tabs: {
    variantes: WideFormatVariantesPlaceholder,
    ruta_base: WideFormatRutaBaseTab,
    imposicion: WideFormatImposicionTab,
    simular_costo: WideFormatSimularCostoTab,
  },
  extraTabs: [
    {
      key: "tecnologias",
      label: "Tecnologías",
      render: WideFormatTecnologiasTab,
    },
  ],
};
