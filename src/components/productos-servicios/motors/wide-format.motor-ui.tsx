"use client";

import type { ProductMotorUiContract, ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { WideFormatImposicionTab } from "@/components/productos-servicios/motors/wide-format-imposicion-tab";
import { WideFormatRutaBaseTab } from "@/components/productos-servicios/motors/wide-format-ruta-base-tab";
import { WideFormatSimularCostoTab } from "@/components/productos-servicios/motors/wide-format-simular-costo-tab";
import { WideFormatTecnologiasTab } from "@/components/productos-servicios/motors/wide-format-tecnologias-tab";
import { ProductoSimularCostoV2Tab } from "@/components/productos-servicios/producto-simular-costo-v2-tab";
import { ProductoStandardTabPlaceholder } from "@/components/productos-servicios/producto-standard-tab-placeholder";

function WideFormatVariantesPlaceholder(_props: ProductTabProps) {
  return (
    <ProductoStandardTabPlaceholder
      title="Variantes"
      description="Gran formato todavía administra sus variantes técnicas fuera del esquema común de variantes."
    />
  );
}

// Feature flag Etapa B.5: habilita el tab "Simular costo (v2)" sobre el motor v2.
// Convive con el tab v1; se elimina el v1 en Etapa D/E.
const ENABLE_V2 = process.env.NEXT_PUBLIC_ENABLE_WIDE_FORMAT_V2 === "true";

const baseExtraTabs = [
  {
    key: "tecnologias",
    label: "Tecnologías",
    render: WideFormatTecnologiasTab,
  },
];

const v2ExtraTab = {
  key: "simular_costo_v2",
  label: "Simular costo (v2)",
  render: ProductoSimularCostoV2Tab,
};

export const wideFormatMotorUi: ProductMotorUiContract = {
  key: "gran_formato@1",
  hiddenTabs: ["variantes"],
  tabOrder: [
    "general",
    "tecnologias",
    "ruta_base",
    "imposicion",
    "simular_costo",
    ...(ENABLE_V2 ? ["simular_costo_v2"] : []),
    "precio",
    "simular_venta",
  ],
  tabs: {
    variantes: WideFormatVariantesPlaceholder,
    ruta_base: WideFormatRutaBaseTab,
    imposicion: WideFormatImposicionTab,
    simular_costo: WideFormatSimularCostoTab,
  },
  extraTabs: ENABLE_V2 ? [...baseExtraTabs, v2ExtraTab] : baseExtraTabs,
};
