"use client";

import type { DigitalProductDetailProps } from "@/components/productos-servicios/motors/digital-product-detail";
import { ProductoServicioFichaTabs as DigitalProductDetail } from "@/components/productos-servicios/motors/digital-product-detail";
import { WideFormatProductDetail } from "@/components/productos-servicios/motors/wide-format-product-detail";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ProductoServicioDetailShell(props: DigitalProductDetailProps) {
  const motorKey = `${props.producto.motorCodigo}@${props.producto.motorVersion}`;

  if (motorKey === "impresion_digital_laser@1") {
    return <DigitalProductDetail {...props} />;
  }

  if (motorKey === "gran_formato@1") {
    return <WideFormatProductDetail {...props} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Motor no disponible en la UI</CardTitle>
        <CardDescription>
          El producto tiene asignado un motor que todavía no cuenta con una vista de detalle específica.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Motor detectado: {motorKey}
      </CardContent>
    </Card>
  );
}
