"use client";

/**
 * Etapa B.4 — Tab "Simular costo (v2)" genérico.
 *
 * Consume la shape canónica del modelo universal (/cotizar-v2) y la renderiza
 * de forma agnóstica del motor. Reemplazará los tabs motor-específicos en
 * Etapa D; por ahora convive con ellos como tab adicional cuando el feature
 * flag `ENABLE_WIDE_FORMAT_V2` está activo (Etapa B.5).
 *
 * Secciones:
 *   1. Inputs de cotización (cantidad, periodo, opcional laminado, medidas)
 *   2. Resumen: total, unitario, 3 buckets
 *   3. Tabla de pasos ejecutados con desglose por paso
 *   4. Trazabilidad global (JSON expandible)
 */

import * as React from "react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { formatCurrency } from "@/components/productos-servicios/producto-comercial.helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cotizarProductoVarianteV2 } from "@/lib/productos-servicios-api";
import type { CotizacionCanonica } from "@/lib/productos-servicios";

function buildDefaultPeriodo() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function ProductoSimularCostoV2Tab(props: ProductTabProps) {
  const [cantidad, setCantidad] = React.useState("1");
  const [anchoMm, setAnchoMm] = React.useState("1000");
  const [altoMm, setAltoMm] = React.useState("500");
  const [conLaminado, setConLaminado] = React.useState(false);
  const [periodo, setPeriodo] = React.useState(buildDefaultPeriodo());
  const [cotizacion, setCotizacion] = React.useState<CotizacionCanonica | null>(null);
  const [isCotizando, startCotizando] = React.useTransition();

  const selectedVariantId = props.selectedVariantId;

  const handleCotizar = React.useCallback(() => {
    if (!selectedVariantId) {
      toast.error("Seleccioná una variante antes de cotizar.");
      return;
    }
    startCotizando(async () => {
      try {
        const result = await cotizarProductoVarianteV2(selectedVariantId, {
          cantidad: Number(cantidad),
          periodo,
          parametros: {
            anchoMm: Number(anchoMm),
            altoMm: Number(altoMm),
            conLaminado,
          },
        });
        setCotizacion(result);
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo cotizar.");
      }
    });
  }, [selectedVariantId, cantidad, periodo, anchoMm, altoMm, conLaminado]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Simular costo (v2 — modelo universal)</CardTitle>
            <CardDescription>
              Cotización sobre el motor nuevo que emite la shape canónica.
              Los costos se desglosan en 3 buckets: centro de costo, materias primas, cargos flat.
            </CardDescription>
          </div>
          <Badge variant="outline">piloto Etapa B</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Inputs */}
        <div className="grid gap-3 md:grid-cols-5">
          <Field>
            <FieldLabel>Cantidad</FieldLabel>
            <Input
              type="number"
              value={cantidad}
              min="1"
              onChange={(e) => setCantidad(e.target.value)}
            />
          </Field>
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
          <Field>
            <FieldLabel>Periodo</FieldLabel>
            <Input
              type="text"
              value={periodo}
              placeholder="2026-04"
              onChange={(e) => setPeriodo(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Laminado UV</FieldLabel>
            <label className="flex items-center gap-2 pt-2">
              <Checkbox checked={conLaminado} onCheckedChange={(v) => setConLaminado(Boolean(v))} />
              <span className="text-sm text-muted-foreground">Con laminado</span>
            </label>
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={handleCotizar} disabled={isCotizando || !selectedVariantId}>
            {isCotizando ? <GdiSpinner className="size-4" data-icon="inline-start" /> : null}
            Cotizar v2
          </Button>
        </div>

        {/* Resumen */}
        {cotizacion ? (
          <>
            <div className="grid gap-3 md:grid-cols-5">
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{formatCurrency(cotizacion.total)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Total</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-2xl font-semibold">{formatCurrency(cotizacion.unitario)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Unitario</p>
              </div>
              <div className="rounded-lg border bg-blue-50 p-4 text-center">
                <p className="text-2xl font-semibold">{formatCurrency(cotizacion.subtotales.centroCosto)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Centro de costo</p>
              </div>
              <div className="rounded-lg border bg-green-50 p-4 text-center">
                <p className="text-2xl font-semibold">{formatCurrency(cotizacion.subtotales.materiasPrimas)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Materias primas</p>
              </div>
              <div className="rounded-lg border bg-amber-50 p-4 text-center">
                <p className="text-2xl font-semibold">{formatCurrency(cotizacion.subtotales.cargosFlat)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Cargos flat</p>
              </div>
            </div>

            {/* Tabla de pasos */}
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Paso</TableHead>
                    <TableHead>Familia</TableHead>
                    <TableHead className="text-right">Centro de costo</TableHead>
                    <TableHead className="text-right">Materias primas</TableHead>
                    <TableHead className="text-right">Cargos flat</TableHead>
                    <TableHead className="text-right">Subtotal paso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cotizacion.pasos.map((paso) => {
                    const subtotalPaso = paso.costoCentroCosto + paso.costoMateriasPrimas + paso.cargosFlat;
                    return (
                      <TableRow key={paso.id}>
                        <TableCell className="font-medium">{paso.nombre}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{paso.tipo}</TableCell>
                        <TableCell className="text-right">{formatCurrency(paso.costoCentroCosto)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(paso.costoMateriasPrimas)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(paso.cargosFlat)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(subtotalPaso)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {cotizacion.warnings.length > 0 ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-900">Advertencias</p>
                <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
                  {cotizacion.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <details className="rounded-lg border p-3 text-xs">
              <summary className="cursor-pointer text-sm font-medium">Trazabilidad técnica</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">
                {JSON.stringify(cotizacion.trazabilidad, null, 2)}
              </pre>
            </details>
          </>
        ) : (
          <div className="rounded-lg border bg-muted/10 p-6 text-center text-sm text-muted-foreground">
            Ingresá los parámetros y dale a &quot;Cotizar v2&quot; para ver el desglose.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
