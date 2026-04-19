"use client";

/**
 * Tab "Imposición" — único para todos los productos (P3.b.4).
 *
 * Focalizado en la DISTRIBUCIÓN FÍSICA: cómo quedan las piezas en el
 * pliego / placa / rollo según el algoritmo del paso. No muestra totales
 * monetarios (eso es Simular costo) — acá se ve solo el nesting.
 *
 * Para cada paso con `familia.modoNesting === "produce"` que el super motor
 * emite en su trazabilidad, renderiza:
 *   - Preview visual con <NestingPreview>.
 *   - Stats clave (piezas por pliego/placa, consumo rollo, aprovechamiento).
 *
 * Reemplaza a los tabs motor-específicos (digital-imposicion-tab,
 * wide-format-imposicion-tab, rigid-printed-imposicion-tab, etc.)
 * eliminados en P3.b.3.
 */

import * as React from "react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { NestingPreview } from "@/components/nesting-preview";
import { extractNestingPreview } from "@/components/productos-servicios/nesting-extract";
import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cotizarProductoVarianteV2 } from "@/lib/productos-servicios-api";
import type { CotizacionCanonica } from "@/lib/productos-servicios";

function buildDefaultPeriodo() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatStatKey(key: string): string {
  const map: Record<string, string> = {
    piezasPorPliego: "Piezas por pliego",
    piezasPorPlaca: "Piezas por placa",
    pliegosNecesarios: "Pliegos necesarios",
    placasNecesarias: "Placas necesarias",
    largoConsumidoMm: "Largo consumido (mm)",
    areaUtilizadaM2: "Área utilizada (m²)",
    porcentajeAprovechamiento: "Aprovechamiento (%)",
    desperdicio: "Desperdicio",
  };
  return map[key] ?? key;
}

function formatStatValue(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    if (Math.abs(value) < 1) return value.toFixed(3);
    if (Math.abs(value) < 100) return value.toFixed(2);
    return Math.round(value).toString();
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function ProductoImposicionTab(props: ProductTabProps) {
  const [cantidad, setCantidad] = React.useState("500");
  const [anchoMm, setAnchoMm] = React.useState("1000");
  const [altoMm, setAltoMm] = React.useState("500");
  const [periodo] = React.useState(buildDefaultPeriodo());
  const [cotizacion, setCotizacion] = React.useState<CotizacionCanonica | null>(null);
  const [isCotizando, startCotizando] = React.useTransition();

  const selectedVariantId = props.selectedVariantId;
  const modoMedidas = props.producto.modoMedidas;
  const needsMedidas = modoMedidas === "LIBRE";

  const handlePreview = React.useCallback(() => {
    if (!selectedVariantId && modoMedidas === "ESTANDAR") {
      toast.error("Seleccioná una variante antes de previsualizar.");
      return;
    }
    startCotizando(async () => {
      try {
        const parametros: Record<string, unknown> = {};
        if (needsMedidas) {
          parametros.anchoMm = Number(anchoMm);
          parametros.altoMm = Number(altoMm);
        }
        // Para productos LIBRE sin variantes, usamos una variante fallback
        // (se resuelve server-side). El dispatcher `cotizarVarianteV2` soporta
        // sólo por variante en este stub — P3.b.5 podría agregar un endpoint
        // por-producto si hace falta.
        if (!selectedVariantId) {
          toast.error(
            "Este producto no tiene variante por defecto. Previsualización por-producto aún no soportada.",
          );
          return;
        }
        const result = await cotizarProductoVarianteV2(
          selectedVariantId,
          {
            cantidad: Number(cantidad),
            periodo,
            parametros,
          },
          {},
        );
        setCotizacion(result);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "No se pudo previsualizar.");
      }
    });
  }, [selectedVariantId, cantidad, anchoMm, altoMm, periodo, needsMedidas, modoMedidas]);

  const previewsPorPaso = React.useMemo(() => {
    if (!cotizacion) return [];
    return cotizacion.pasos
      .map((paso) => ({ paso, data: extractNestingPreview(paso) }))
      .filter((x): x is { paso: typeof x.paso; data: NonNullable<typeof x.data> } => x.data !== null);
  }, [cotizacion]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Imposición</CardTitle>
              <CardDescription>
                Previsualiza cómo se distribuyen las piezas en cada paso con nesting.
                Sin totales monetarios — para eso usá el tab <strong>Simular costo</strong>.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Field>
              <FieldLabel>Cantidad</FieldLabel>
              <Input
                type="number"
                value={cantidad}
                min="1"
                onChange={(e) => setCantidad(e.target.value)}
              />
            </Field>
            {needsMedidas && (
              <>
                <Field>
                  <FieldLabel>Ancho (mm)</FieldLabel>
                  <Input
                    type="number"
                    value={anchoMm}
                    min="1"
                    onChange={(e) => setAnchoMm(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>Alto (mm)</FieldLabel>
                  <Input
                    type="number"
                    value={altoMm}
                    min="1"
                    onChange={(e) => setAltoMm(e.target.value)}
                  />
                </Field>
              </>
            )}
          </div>

          <div className="flex items-center justify-end">
            <Button
              type="button"
              onClick={handlePreview}
              disabled={isCotizando || (!selectedVariantId && modoMedidas === "ESTANDAR")}
            >
              {isCotizando ? <GdiSpinner className="size-4" data-icon="inline-start" /> : null}
              Previsualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {cotizacion && previewsPorPaso.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Ninguno de los pasos de la ruta de este producto produce nesting visualizable.
          </CardContent>
        </Card>
      ) : null}

      {previewsPorPaso.map(({ paso, data }) => (
        <Card key={paso.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{paso.nombre}</CardTitle>
                <CardDescription>
                  <Badge variant="outline" className="mr-2">
                    {paso.tipo}
                  </Badge>
                  {data.container.type === "rollo"
                    ? `Rollo ${Math.round(data.container.rolloAnchoTotalMm ?? 0)}mm`
                    : data.container.type === "pliego"
                      ? `Pliego ${Math.round(data.container.anchoMm)}×${Math.round(data.container.altoMm)}mm`
                      : `Placa ${Math.round(data.container.anchoMm)}×${Math.round(data.container.altoMm)}mm`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <NestingPreview
              container={data.container}
              placements={data.placements}
              maxHeightPx={450}
            />
            {Object.keys(data.stats).length > 0 && (
              <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/20 p-3 md:grid-cols-4">
                {Object.entries(data.stats).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-muted-foreground">{formatStatKey(k)}</p>
                    <p className="text-sm font-semibold">{formatStatValue(v)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {!cotizacion && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Ingresá los parámetros y hacé click en <strong>Previsualizar</strong> para ver
            el nesting de cada paso.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
