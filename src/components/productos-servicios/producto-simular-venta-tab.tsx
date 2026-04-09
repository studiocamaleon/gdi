"use client";

import * as React from "react";
import { InfoIcon, RefreshCcwIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import {
  formatCurrency,
  formatNumber,
  getUnidadComercialProductoLabel,
} from "@/components/productos-servicios/producto-comercial.helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getCotizacionProductoById,
  getCotizacionesProductoServicio,
  getCotizacionesProductoVariante,
} from "@/lib/productos-servicios-api";
import { simularPrecioComercial } from "@/lib/productos-servicios-simulacion";

type LastQuoteState = {
  snapshotId: string;
  cantidad: number | null;
  costoTotal: number | null;
  periodo: string | null;
  createdAt: string | null;
};

function resolveQuoteState(result: Record<string, unknown>, fallback: { snapshotId: string; cantidad: number; periodoTarifa: string; total: number; createdAt: string }): LastQuoteState {
  const total = Number(result.total ?? fallback.total ?? 0);
  const cantidad = Number(result.cantidad ?? fallback.cantidad ?? 0);
  const periodo = typeof result.periodo === "string" ? result.periodo : fallback.periodoTarifa;
  return {
    snapshotId: fallback.snapshotId,
    cantidad: Number.isFinite(cantidad) ? cantidad : null,
    costoTotal: Number.isFinite(total) ? total : null,
    periodo: periodo || null,
    createdAt: fallback.createdAt ?? null,
  };
}

export function ProductoSimularVentaTab(props: ProductTabProps) {
  const [quoteState, setQuoteState] = React.useState<LastQuoteState | null>(null);
  const [isLoading, startLoading] = React.useTransition();

  const loadLatestQuote = React.useCallback(() => {
    startLoading(async () => {
      try {
        if (props.selectedVariantId) {
          const snapshots = await getCotizacionesProductoVariante(props.selectedVariantId);
          const latest = snapshots[0];
          if (!latest) {
            setQuoteState(null);
            return;
          }
          const detail = await getCotizacionProductoById(latest.id);
          setQuoteState(
            resolveQuoteState(detail.resultado, {
              snapshotId: detail.id,
              cantidad: detail.cantidad,
              periodoTarifa: detail.periodoTarifa,
              total: detail.total,
              createdAt: detail.createdAt,
            }),
          );
          return;
        }

        const snapshots = await getCotizacionesProductoServicio(props.producto.id);
        const latest = snapshots[0];
        if (!latest) {
          setQuoteState(null);
          return;
        }
        const detail = await getCotizacionProductoById(latest.id);
        setQuoteState(
          resolveQuoteState(detail.resultado, {
            snapshotId: detail.id,
            cantidad: detail.cantidad,
            periodoTarifa: detail.periodoTarifa,
            total: detail.total,
            createdAt: detail.createdAt,
          }),
        );
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo cargar la última cotización.");
      }
    });
  }, [props.producto.id, props.selectedVariantId]);

  React.useEffect(() => {
    void loadLatestQuote();
  }, [loadLatestQuote]);

  const simulacionComercial = React.useMemo(
    () =>
      simularPrecioComercial({
        precio: props.producto.precio,
        costoTotal: quoteState?.costoTotal ?? null,
        cantidad: quoteState?.cantidad ?? null,
      }),
    [props.producto.precio, quoteState?.cantidad, quoteState?.costoTotal],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Simular venta</CardTitle>
            <CardDescription>
              Calcula el precio final comercial a partir de la última cotización persistida y la configuración del tab Precio.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={loadLatestQuote} disabled={isLoading}>
            {isLoading ? <GdiSpinner className="size-4" data-icon="inline-start" /> : <RefreshCcwIcon className="size-4" data-icon="inline-start" />}
            Refrescar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Estado de simulación</p>
              <p className="text-xs text-muted-foreground">
                Usa la última cotización guardada para este producto
                {props.selectedVariant ? ` y la variante ${props.selectedVariant.nombre}` : ""}.
              </p>
            </div>
            <Badge
              variant={
                simulacionComercial.status === "disponible"
                  ? "default"
                  : simulacionComercial.status === "no_calculable"
                    ? "secondary"
                    : "outline"
              }
            >
              {simulacionComercial.status === "disponible"
                ? "Simulación disponible"
                : simulacionComercial.status === "no_calculable"
                  ? "No calculable"
                  : "Sin cotización"}
            </Badge>
          </div>
          <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            {simulacionComercial.reason ?? simulacionComercial.descripcion ?? "La simulación comercial está lista."}
          </div>
        </div>

        {simulacionComercial.status === "disponible" ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{simulacionComercial.valorComercial != null ? formatCurrency(simulacionComercial.valorComercial) : "-"}</p>
                <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  <span>Valor comercial</span>
                  <Tooltip>
                    <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                      <InfoIcon className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Es el precio final que vería el cliente.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{simulacionComercial.vmcMonto != null ? formatCurrency(simulacionComercial.vmcMonto) : "-"}</p>
                <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  <span>VMC</span>
                  <Tooltip>
                    <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                      <InfoIcon className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Valor monetario que queda disponible después de cubrir el costo productivo.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{simulacionComercial.icmPct != null ? `${formatNumber(simulacionComercial.icmPct)}%` : "-"}</p>
                <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  <span>ICM</span>
                  <Tooltip>
                    <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                      <InfoIcon className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Qué parte de la venta sigue disponible después de cubrir el costo de producción.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{simulacionComercial.beneficioMonto != null ? formatCurrency(simulacionComercial.beneficioMonto) : "-"}</p>
                <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  <span>Beneficio</span>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{simulacionComercial.beneficioPct != null ? `${formatNumber(simulacionComercial.beneficioPct)}%` : "-"}</p>
                <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  <span>Beneficio (%)</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Resumen comercial</TableHead>
                      <TableHead className="w-[220px] text-right">Valor</TableHead>
                      <TableHead className="w-[140px] text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-muted-foreground">Costo total</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(simulacionComercial.costoTotal)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {simulacionComercial.precioFinal ? `${formatNumber((simulacionComercial.costoTotal / simulacionComercial.precioFinal) * 100)}%` : "-"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">Impuestos</TableCell>
                      <TableCell className="text-right font-medium">{simulacionComercial.impuestosMonto != null ? formatCurrency(simulacionComercial.impuestosMonto) : "-"}</TableCell>
                      <TableCell className="text-right font-medium">{simulacionComercial.impuestosMonto != null ? `${formatNumber(simulacionComercial.impuestosPct)}%` : "-"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">Comisiones</TableCell>
                      <TableCell className="text-right font-medium">{simulacionComercial.comisionesMonto != null ? formatCurrency(simulacionComercial.comisionesMonto) : "-"}</TableCell>
                      <TableCell className="text-right font-medium">{simulacionComercial.comisionesMonto != null ? `${formatNumber(simulacionComercial.comisionesPct)}%` : "-"}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/20">
                      <TableCell className="font-medium">Precio final al cliente</TableCell>
                      <TableCell className="text-right font-semibold">{simulacionComercial.precioFinal != null ? formatCurrency(simulacionComercial.precioFinal) : "-"}</TableCell>
                      <TableCell className="text-right font-semibold">{simulacionComercial.precioFinal != null ? "100%" : "-"}</TableCell>
                    </TableRow>
                    <TableRow className="bg-emerald-50/60">
                      <TableCell className="font-medium">Margen real</TableCell>
                      <TableCell className="text-right font-semibold">{simulacionComercial.margenRealMonto != null ? formatCurrency(simulacionComercial.margenRealMonto) : "-"}</TableCell>
                      <TableCell className="text-right font-semibold">{simulacionComercial.margenRealPct != null ? `${formatNumber(simulacionComercial.margenRealPct)}%` : "-"}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Lectura rápida</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {simulacionComercial.descripcion}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Configuración usada</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Unidad comercial</span>
                      <span>{getUnidadComercialProductoLabel(props.producto.precio?.measurementUnit ?? props.producto.unidadComercial)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Esquema impositivo</span>
                      <span>{props.producto.precio?.impuestos.esquemaNombre || "Sin impuestos"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Comisiones activas</span>
                      <span>{props.producto.precio?.comisiones.esquemaNombre || "Sin comisiones"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Comisiones (%)</span>
                      <span>
                        {(() => {
                          const c = props.producto.precio?.comisiones;
                          if (!c) return "-";
                          const ids = c.esquemaIds ?? (c.esquemaId ? [c.esquemaId] : []);
                          if (ids.length === 0) return "-";
                          return `${formatNumber(c.porcentajeTotal ?? 0)}%`;
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Cantidad cotizada</span>
                      <span>{quoteState?.cantidad != null ? formatNumber(quoteState.cantidad) : "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Período</span>
                      <span>{quoteState?.periodo || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm font-medium">
              {simulacionComercial.status === "sin_cotizacion" ? "Todavía no hay una cotización disponible." : "No se pudo calcular la simulación comercial."}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {simulacionComercial.reason ?? "Generá o refrescá una cotización en el tab Simular costo y volvé a intentar."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
