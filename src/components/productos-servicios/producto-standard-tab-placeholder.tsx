"use client";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ProductoStandardTabPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Este tab todavía no tiene una implementación específica para este motor.
      </CardContent>
    </Card>
  );
}

export function ProductoRutaOpcionalesPlaceholder(_props: ProductTabProps) {
  return (
    <ProductoStandardTabPlaceholder
      title="Ruta de opcionales"
      description="Acá se configurarán adicionales, efectos y reglas opcionales de la ruta."
    />
  );
}
