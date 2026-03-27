"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronRightIcon, InfoIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { ProductoServicioChecklistCotizador } from "@/components/productos-servicios/producto-servicio-checklist";
import { formatCurrency, formatNumber } from "@/components/productos-servicios/producto-comercial.helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  cotizarProductoVariante,
  getCotizacionProductoById,
  getCotizacionesProductoVariante,
} from "@/lib/productos-servicios-api";
import type {
  CotizacionProductoSnapshotResumen,
  CotizacionProductoVariante,
  DimensionOpcionProductiva,
  ProductoVariante,
  ValorOpcionProductiva,
} from "@/lib/productos-servicios";

const dimensionBaseLabelByValue: Record<DimensionOpcionProductiva, string> = {
  tipo_impresion: "Tipo de impresión",
  caras: "Caras",
};

const valorOpcionBaseLabelByValue: Record<ValorOpcionProductiva, string> = {
  bn: "Escala de grises",
  cmyk: "CMYK",
  simple_faz: "Simple faz",
  doble_faz: "Doble faz",
};

function buildDefaultPeriodo() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getValoresOpcionesBase(variante: ProductoVariante, dimension: DimensionOpcionProductiva) {
  if (dimension === "tipo_impresion") {
    return (
      variante.opcionesProductivas?.find((item) => item.dimension === "tipo_impresion")?.valores.filter(
        (value): value is "bn" | "cmyk" => value === "bn" || value === "cmyk",
      ) ?? [variante.tipoImpresion]
    );
  }
  return (
    variante.opcionesProductivas?.find((item) => item.dimension === "caras")?.valores.filter(
      (value): value is "simple_faz" | "doble_faz" => value === "simple_faz" || value === "doble_faz",
    ) ?? [variante.caras]
  );
}

function formatOrigenProcesoLabel(origen: unknown) {
  const raw = String(origen ?? "Base").trim();
  if (!raw) return "Producto base";
  const normalized = raw.toLowerCase();
  if (normalized === "base" || normalized === "producto base") return "Producto base";
  if (normalized.startsWith("adicional")) return "Adicional";
  return raw;
}

function getMaterialTipoLabel(tipo: unknown) {
  const raw = String(tipo ?? "").trim().toUpperCase();
  if (raw === "PAPEL") return "Papel";
  if (raw === "TONER") return "Tóner";
  if (raw === "FILM") return "Film";
  if (raw === "DESGASTE") return "Desgaste";
  if (raw === "CONSUMIBLE_FILM") return "Consumibles de terminación";
  if (raw === "ADDITIONAL_MATERIAL_EFFECT") return "Material adicional";
  return raw || "-";
}

function formatDetalleTecnico(detalle: Record<string, unknown> | null | undefined) {
  if (!detalle || typeof detalle !== "object") return "";
  return Object.entries(detalle)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join("\n");
}

export function DigitalSimularCostoTab(props: ProductTabProps) {
  const dimensionesBaseConsumidas = props.producto.dimensionesBaseConsumidas ?? [];
  const variantesSelect = React.useMemo(
    () => props.variantes.filter((item) => item.activo || item.id === props.selectedVariantId),
    [props.selectedVariantId, props.variantes],
  );

  const [cotizacionCantidad, setCotizacionCantidad] = React.useState("100");
  const [cotizacionPeriodo, setCotizacionPeriodo] = React.useState(buildDefaultPeriodo());
  const [cotizacionChecklistRespuestas, setCotizacionChecklistRespuestas] = React.useState<Record<string, { respuestaId: string }>>({});
  const [cotizacionSeleccionesBase, setCotizacionSeleccionesBase] = React.useState<Partial<Record<DimensionOpcionProductiva, ValorOpcionProductiva>>>({});
  const [cotizacion, setCotizacion] = React.useState<CotizacionProductoVariante | null>(null);
  const [cotizaciones, setCotizaciones] = React.useState<CotizacionProductoSnapshotResumen[]>([]);
  const [snapshotsOpen, setSnapshotsOpen] = React.useState(false);
  const [materialesOpen, setMaterialesOpen] = React.useState<Record<string, boolean>>({});
  const [materialesMermaOpen, setMaterialesMermaOpen] = React.useState<Record<string, boolean>>({});
  const [isCotizando, startCotizando] = React.useTransition();
  const [isLoadingSnapshots, startLoadingSnapshots] = React.useTransition();

  React.useEffect(() => {
    setCotizacionChecklistRespuestas({});
  }, [props.checklist]);

  React.useEffect(() => {
    if (!props.selectedVariant) {
      setCotizacionSeleccionesBase({});
      return;
    }
    const next: Partial<Record<DimensionOpcionProductiva, ValorOpcionProductiva>> = {};
    dimensionesBaseConsumidas.forEach((dimension) => {
      const values = getValoresOpcionesBase(props.selectedVariant!, dimension);
      if (values.length === 1) {
        next[dimension] = values[0];
      }
    });
    setCotizacionSeleccionesBase(next);
  }, [dimensionesBaseConsumidas, props.selectedVariant]);

  React.useEffect(() => {
    if (!props.selectedVariantId) {
      setCotizacion(null);
      setCotizaciones([]);
      return;
    }

    startLoadingSnapshots(async () => {
      try {
        const snapshots = await getCotizacionesProductoVariante(props.selectedVariantId);
        setCotizaciones(snapshots);
        const latestSnapshot = snapshots[0];
        if (!latestSnapshot) {
          setCotizacion(null);
          return;
        }
        const detalle = await getCotizacionProductoById(latestSnapshot.id);
        setCotizacion({
          snapshotId: detalle.id,
          ...(detalle.resultado as Omit<CotizacionProductoVariante, "snapshotId" | "createdAt">),
          createdAt: detalle.createdAt,
        });
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudieron cargar cotizaciones.");
      }
    });
  }, [props.selectedVariantId]);

  const handleCotizar = () => {
    if (!props.selectedVariant) {
      toast.error("Seleccioná una variante para cotizar.");
      return;
    }

    startCotizando(async () => {
      try {
        const result = await cotizarProductoVariante(props.selectedVariant!.id, {
          cantidad: Number(cotizacionCantidad),
          periodo: cotizacionPeriodo,
          seleccionesBase: Object.entries(cotizacionSeleccionesBase)
            .filter(([, value]) => Boolean(value))
            .map(([dimension, valor]) => ({
              dimension: dimension as DimensionOpcionProductiva,
              valor: valor as ValorOpcionProductiva,
            })),
          checklistRespuestas: Object.entries(cotizacionChecklistRespuestas)
            .filter(([, value]) => Boolean(value?.respuestaId))
            .map(([preguntaId, value]) => ({
              preguntaId,
              respuestaId: value.respuestaId,
            })),
        });
        setCotizacion(result);
        const snapshots = await getCotizacionesProductoVariante(props.selectedVariant!.id);
        setCotizaciones(snapshots);
        toast.success("Cotización calculada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo cotizar.");
      }
    });
  };

  const procesosCotizados = cotizacion?.bloques?.procesos ?? [];
  const materialesCotizados = (cotizacion?.bloques?.materiales ?? []) as Array<Record<string, unknown>>;
  const materialesAgrupados = React.useMemo(() => {
    const groups = new Map<
      string,
      {
        tipo: string;
        label: string;
        items: Array<Record<string, unknown>>;
        mermaOperativa: Array<Record<string, unknown>>;
        totalMermaCantidad: number;
        totalMermaCosto: number;
        totalCantidad: number;
        totalCosto: number;
      }
    >();
    for (const item of materialesCotizados) {
      const tipo = String(item.tipo ?? "");
      const current =
        groups.get(tipo) ??
        {
          tipo,
          label: getMaterialTipoLabel(tipo),
          items: [],
          mermaOperativa: [],
          totalMermaCantidad: 0,
          totalMermaCosto: 0,
          totalCantidad: 0,
          totalCosto: 0,
        };
      const cantidad = Number(item.cantidad ?? 0) || 0;
      const costo = Number(item.costo ?? 0) || 0;
      const origen = String(item.origen ?? "Base").trim().toLowerCase();
      if (origen === "merma operativa") {
        current.mermaOperativa.push(item);
        current.totalMermaCantidad += cantidad;
        current.totalMermaCosto += costo;
      } else {
        current.items.push(item);
      }
      current.totalCantidad += cantidad;
      current.totalCosto += costo;
      groups.set(tipo, current);
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [materialesCotizados]);

  const totalCentroCostos = procesosCotizados.reduce((acc, item) => acc + (Number(item.costo ?? 0) || 0), 0);
  const totalMaterialesCosto = materialesCotizados.reduce((acc, item) => acc + (Number(item.costo ?? 0) || 0), 0);
  const totalCostoGeneral = totalCentroCostos + totalMaterialesCosto;

  if (!props.variantes.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Simular costo</CardTitle>
          <CardDescription>Ejecuta el motor de costo y guarda snapshots por variante.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Creá al menos una variante para poder cotizar este producto.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simular costo</CardTitle>
        <CardDescription>Ejecuta el motor de costo y guarda snapshots por variante.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Field>
            <FieldLabel>Variante</FieldLabel>
            <Select value={props.selectedVariantId || "__none__"} onValueChange={(value) => props.setSelectedVariantId(value === "__none__" ? "" : value ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná variante" />
              </SelectTrigger>
              <SelectContent>
                {variantesSelect.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nombre}{item.activo ? "" : " (inactiva)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Cantidad</FieldLabel>
            <Input value={cotizacionCantidad} onChange={(e) => setCotizacionCantidad(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Período tarifa (YYYY-MM)</FieldLabel>
            <Input value={cotizacionPeriodo} onChange={(e) => setCotizacionPeriodo(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="button" onClick={handleCotizar} disabled={isCotizando || !props.selectedVariant}>
              {isCotizando ? <GdiSpinner className="size-4" data-icon="inline-start" /> : null}
              Cotizar
            </Button>
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <p className="mb-2 text-sm font-medium">Opciones base del producto</p>
          <div className="grid gap-3 md:grid-cols-2">
            {props.selectedVariant
              ? dimensionesBaseConsumidas.map((dimension) => {
                  const values = getValoresOpcionesBase(props.selectedVariant!, dimension);
                  const selectedValue = cotizacionSeleccionesBase[dimension];
                  const useMiniCards = values.length > 0 && values.length <= 4;
                  return (
                    <Field key={`base-select-${dimension}`}>
                      <FieldLabel>{dimensionBaseLabelByValue[dimension]}</FieldLabel>
                      {useMiniCards ? (
                        <div className="flex flex-wrap gap-2">
                          {values.map((value) => {
                            const isSelected = selectedValue === value;
                            return (
                              <button
                                key={`${dimension}-${value}`}
                                type="button"
                                onClick={() =>
                                  setCotizacionSeleccionesBase((prev) => ({
                                    ...prev,
                                    [dimension]: isSelected ? undefined : value,
                                  }))
                                }
                                className={cn(
                                  "inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-sm transition-colors",
                                  isSelected
                                    ? "border-primary bg-primary/10 text-foreground"
                                    : "border-border bg-background hover:border-primary/40 hover:bg-muted/50",
                                )}
                              >
                                <span className="font-medium">{valorOpcionBaseLabelByValue[value]}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <Select
                          value={selectedValue ?? "__none__"}
                          onValueChange={(value) =>
                            setCotizacionSeleccionesBase((prev) => ({
                              ...prev,
                              [dimension]: value === "__none__" ? undefined : (value as ValorOpcionProductiva),
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccioná una opción">
                              {selectedValue ? valorOpcionBaseLabelByValue[selectedValue] : "Seleccioná una opción"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {values.length > 1 ? <SelectItem value="__none__">Seleccioná una opción</SelectItem> : null}
                            {values.map((value) => (
                              <SelectItem key={`${dimension}-${value}`} value={value}>
                                {valorOpcionBaseLabelByValue[value]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </Field>
                  );
                })
              : null}
            {props.selectedVariant && dimensionesBaseConsumidas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este producto no consume dimensiones base configurables.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <p className="mb-2 text-sm font-medium">Opcionales para cotizar</p>
          <ProductoServicioChecklistCotizador
            checklist={props.checklist}
            value={cotizacionChecklistRespuestas}
            onChange={setCotizacionChecklistRespuestas}
          />
        </div>

        {cotizacion?.warnings?.length ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            {cotizacion.warnings.map((warning, index) => (
              <p key={index}>{warning}</p>
            ))}
          </div>
        ) : null}

        {cotizacion ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{cotizacion.pliegos}</p>
                <p className="mt-1 text-sm text-muted-foreground">Pliegos</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{cotizacion.piezasPorPliego}</p>
                <p className="mt-1 text-sm text-muted-foreground">Piezas por pliego</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{formatCurrency(cotizacion.total)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Costo total</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{formatCurrency(cotizacion.unitario)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Costo unitario</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Centro de costos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader className="bg-muted/50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
                    <TableRow className="border-b border-border/70">
                      <TableHead>#</TableHead>
                      <TableHead>Paso</TableHead>
                      <TableHead>Centro</TableHead>
                      <TableHead className="w-[180px]">Origen</TableHead>
                      <TableHead className="w-[140px] text-right">Minutos</TableHead>
                      <TableHead className="w-[140px] text-right">Tarifa/h</TableHead>
                      <TableHead className="w-[140px] text-right">Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {procesosCotizados.map((item) => (
                      <TableRow key={`${item.codigo}-${item.orden}`}>
                        <TableCell>{item.orden}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1">
                            <span>{item.nombre}</span>
                            {item.detalleTecnico ? (
                              <Tooltip>
                                <TooltipTrigger
                                  className="inline-flex size-5 items-center justify-center rounded border border-border/60 text-muted-foreground transition-colors hover:bg-muted"
                                  aria-label="Ver detalle técnico"
                                >
                                  <InfoIcon className="size-3.5" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[360px] whitespace-pre-wrap text-xs">
                                  {formatDetalleTecnico(item.detalleTecnico)}
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell>{item.centroCostoNombre}</TableCell>
                        <TableCell>{formatOrigenProcesoLabel(item.origen)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(item.totalMin)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(item.tarifaHora)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(item.costo)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={6} className="text-right font-medium">Total</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(totalCentroCostos)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Materias primas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {materialesAgrupados.map((grupo) => (
                  <Collapsible
                    key={grupo.tipo}
                    open={materialesOpen[grupo.tipo] ?? false}
                    onOpenChange={(open) => setMaterialesOpen((prev) => ({ ...prev, [grupo.tipo]: open }))}
                  >
                    <div className="rounded-lg border">
                      <div className="flex items-center gap-2 px-3 py-3 transition-colors hover:bg-muted/60">
                        <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between text-left">
                          <div className="grid flex-1 gap-1 md:grid-cols-[minmax(0,1fr)_140px_140px] md:items-center">
                            <div>
                              <p className="font-medium">{grupo.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {grupo.items.length} componente{grupo.items.length === 1 ? "" : "s"}
                              </p>
                            </div>
                            <div className="text-left md:text-right">
                              <p className="text-xs text-muted-foreground">Cantidad total</p>
                              <p className="tabular-nums">{formatNumber(grupo.totalCantidad)}</p>
                            </div>
                            <div className="text-left md:text-right">
                              <p className="text-xs text-muted-foreground">Costo total</p>
                              <p className="font-medium tabular-nums">{formatCurrency(grupo.totalCosto)}</p>
                            </div>
                          </div>
                          <span className="ml-3 inline-flex items-center text-muted-foreground">
                            {materialesOpen[grupo.tipo] ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                          </span>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <div className="border-t">
                          <Table>
                            <TableHeader className="bg-muted/50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
                              <TableRow className="border-b border-border/70">
                                <TableHead>Componente</TableHead>
                                <TableHead className="w-[180px]">Origen</TableHead>
                                <TableHead className="w-[140px] text-right">Cantidad</TableHead>
                                <TableHead className="w-[140px] text-right">Costo unitario</TableHead>
                                <TableHead className="w-[140px] text-right">Costo</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {grupo.items.map((item, idx) => {
                                const nombre = String(item.nombre ?? "Componente");
                                const canal = item.canal ? ` (${String(item.canal).toUpperCase()})` : "";
                                const sku = item.sku ? ` · ${String(item.sku)}` : "";
                                const cantidad = Number(item.cantidad ?? 0);
                                const costoUnitario = Number(item.costoUnitario ?? 0);
                                const costo = Number(item.costo ?? 0);
                                return (
                                  <TableRow key={`${grupo.tipo}-${idx}`}>
                                    <TableCell>{`${nombre}${canal}${sku}`}</TableCell>
                                    <TableCell>{formatOrigenProcesoLabel(item.origen)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatNumber(cantidad)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatNumber(costoUnitario)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatCurrency(costo)}</TableCell>
                                  </TableRow>
                                );
                              })}
                              {grupo.mermaOperativa.length ? (
                                <>
                                  <TableRow
                                    className="cursor-pointer bg-amber-50/60 hover:bg-amber-50"
                                    onClick={() =>
                                      setMaterialesMermaOpen((prev) => ({
                                        ...prev,
                                        [grupo.tipo]: !(prev[grupo.tipo] ?? false),
                                      }))
                                    }
                                  >
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {materialesMermaOpen[grupo.tipo] ? <ChevronDownIcon className="size-4 text-muted-foreground" /> : <ChevronRightIcon className="size-4 text-muted-foreground" />}
                                        <span className="font-medium">Merma operativa</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>Producto base</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatNumber(grupo.totalMermaCantidad)}</TableCell>
                                    <TableCell className="text-right tabular-nums">-</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatCurrency(grupo.totalMermaCosto)}</TableCell>
                                  </TableRow>
                                  {materialesMermaOpen[grupo.tipo]
                                    ? grupo.mermaOperativa.map((item, idx) => {
                                        const nombre = String(item.nombre ?? "Componente");
                                        const canal = item.canal ? ` (${String(item.canal).toUpperCase()})` : "";
                                        const sku = item.sku ? ` · ${String(item.sku)}` : "";
                                        const cantidad = Number(item.cantidad ?? 0);
                                        const costoUnitario = Number(item.costoUnitario ?? 0);
                                        const costo = Number(item.costo ?? 0);
                                        return (
                                          <TableRow key={`${grupo.tipo}-merma-${idx}`} className="bg-muted/20">
                                            <TableCell className="pl-10">{`${nombre}${canal}${sku}`}</TableCell>
                                            <TableCell>Merma operativa</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatNumber(cantidad)}</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatNumber(costoUnitario)}</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatCurrency(costo)}</TableCell>
                                          </TableRow>
                                        );
                                      })
                                    : null}
                                </>
                              ) : null}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}

                <div className="rounded-lg border">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={4} className="text-right font-medium">Total materiales</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(totalMaterialesCosto)}</TableCell>
                      </TableRow>
                      <TableRow className="bg-amber-100/60">
                        <TableCell colSpan={4} className="text-right font-semibold">Total costo</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{formatCurrency(totalCostoGeneral)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Badge variant={isLoadingSnapshots ? "secondary" : "outline"}>
              {isLoadingSnapshots ? "Cargando historial" : "Sin cotización activa"}
            </Badge>
            <p className="mt-3 text-sm font-medium">Todavía no hay una cotización calculada para esta variante.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Definí cantidad, opciones base y checklist, luego ejecutá la simulación.
            </p>
          </div>
        )}

        <Collapsible open={snapshotsOpen} onOpenChange={setSnapshotsOpen}>
          <div className="rounded-lg border">
            <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/60">
              <span className="text-sm font-medium">Historial de snapshots</span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                {cotizaciones.length}
                {snapshotsOpen ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t">
                <Table>
                  <TableHeader className="bg-muted/50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
                    <TableRow className="border-b border-border/70">
                      <TableHead>Snapshot</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Unitario</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cotizaciones.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}</TableCell>
                        <TableCell>{item.cantidad}</TableCell>
                        <TableCell>{item.periodoTarifa}</TableCell>
                        <TableCell>{formatCurrency(item.total)}</TableCell>
                        <TableCell>{formatCurrency(item.unitario)}</TableCell>
                        <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
