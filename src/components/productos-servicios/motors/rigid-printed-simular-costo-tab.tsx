"use client";

import * as React from "react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import {
  getProductoMotorConfig,
} from "@/lib/productos-servicios-api";

export function RigidPrintedSimularCostoTab(props: ProductTabProps) {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getProductoMotorConfig(props.producto.id)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [props.producto.id]);

  if (loading) {
    return <GdiSpinner />;
  }

  return (
    <ProductoTabSection
      title="Simular costo"
      description="Simulación de costo para productos rígidos impresos."
    >
      <p className="text-sm text-muted-foreground italic">
        El simulador de costos estará disponible cuando se complete la implementación del motor de cotización.
      </p>
    </ProductoTabSection>
  );
}
