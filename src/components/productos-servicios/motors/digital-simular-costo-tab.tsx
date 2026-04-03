"use client";

import * as React from "react";
import { ActivityIcon, ChevronDownIcon, ChevronRightIcon, HistoryIcon, InfoIcon, Layers3Icon, SigmaIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { ProductoServicioChecklistCotizador } from "@/components/productos-servicios/producto-servicio-checklist";
import { formatCurrency, formatNumber } from "@/components/productos-servicios/producto-comercial.helpers";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getMateriaPrimaVarianteLabel } from "@/lib/materias-primas-variantes-display";
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
  tipo_copia: "Tipo de copia",
};

const valorOpcionBaseLabelByValue: Record<ValorOpcionProductiva, string> = {
  bn: "Escala de grises",
  cmyk: "CMYK",
  simple_faz: "Simple faz",
  doble_faz: "Doble faz",
  copia_simple: "Simple",
  duplicado: "Duplicado",
  triplicado: "Triplicado",
  cuadruplicado: "Cuadruplicado",
};

const uuidLikePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildDefaultPeriodo() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getValoresOpcionesBase(variante: ProductoVariante, dimension: DimensionOpcionProductiva): ValorOpcionProductiva[] {
  if (dimension === "tipo_impresion") {
    return (
      variante.opcionesProductivas?.find((item) => item.dimension === "tipo_impresion")?.valores.filter(
        (value): value is "bn" | "cmyk" => value === "bn" || value === "cmyk",
      ) ?? [variante.tipoImpresion]
    );
  }
  if (dimension === "tipo_copia") {
    return (
      variante.opcionesProductivas?.find((item) => item.dimension === "tipo_copia")?.valores.filter(
        (value): value is ValorOpcionProductiva =>
          value === "copia_simple" || value === "duplicado" || value === "triplicado" || value === "cuadruplicado",
      ) ?? []
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
  if (raw === "PAPEL_CAPA") return "Papel por capa";
  if (raw === "MATERIAL_EXTRA") return "Material extra";
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

function getDigitalVariantDisplayLabel(
  variante: ProductTabProps["variantes"][number],
  papelLabelById: Map<string, string>,
) {
  const rawName = variante.nombre?.trim() ?? "";
  if (rawName && !uuidLikePattern.test(rawName)) return rawName;

  const parts: string[] = [`${variante.anchoMm} × ${variante.altoMm} mm`];
  const printModeLabel =
    valorOpcionBaseLabelByValue[variante.tipoImpresion] ?? null;
  const carasLabel =
    valorOpcionBaseLabelByValue[variante.caras] ?? null;
  const papelLabel = variante.papelVarianteId ? papelLabelById.get(variante.papelVarianteId) ?? null : null;

  if (printModeLabel) parts.push(printModeLabel);
  if (carasLabel) parts.push(carasLabel);
  if (papelLabel) parts.push(papelLabel);

  return parts.join(" · ");
}

export function DigitalSimularCostoTab(props: ProductTabProps) {
  const dimensionesBaseConsumidasRaw = props.producto.dimensionesBaseConsumidas ?? [];
  // Para talonarios: incluir tipo_copia si la variante lo tiene configurado
  const dimensionesBaseConsumidas = React.useMemo(() => {
    const dims = [...dimensionesBaseConsumidasRaw];
    if (!dims.includes("tipo_copia") && props.selectedVariant?.opcionesProductivas?.some(
      (op) => op.dimension === "tipo_copia" && op.valores.length > 0,
    )) {
      dims.push("tipo_copia");
    }
    return dims;
  }, [dimensionesBaseConsumidasRaw, props.selectedVariant]);
  const papelLabelById = React.useMemo(() => {
    const entries = props.materiasPrimas
      .filter((mp) => mp.subfamilia === "sustrato_hoja")
      .flatMap((mp) => mp.variantes.map((variante) => [variante.id, getMateriaPrimaVarianteLabel(mp, variante, { maxDimensiones: 6 })] as const));
    return new Map(entries);
  }, [props.materiasPrimas]);
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
      } else if (values.length > 1) {
        // Pre-select the variant's own base value so the user always has a default
        const baseValue =
          dimension === "caras"
            ? props.selectedVariant!.caras
            : dimension === "tipo_impresion"
              ? props.selectedVariant!.tipoImpresion
              : null; // tipo_copia y otras dimensiones: no hay valor base en la variante
        if (baseValue && (values as string[]).includes(baseValue)) {
          next[dimension] = baseValue as ValorOpcionProductiva;
        } else {
          // Fallback to the first available value
          next[dimension] = values[0];
        }
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
  const selectedVariantLabel = props.selectedVariant
    ? getDigitalVariantDisplayLabel(props.selectedVariant, papelLabelById)
    : "Sin variante seleccionada";

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
        <ProductoTabSection
          title="Resumen de simulación"
          description="Lectura rápida de la variante, el escenario actual y el último resultado calculado."
          icon={InfoIcon}
          contentClassName="grid gap-3 md:grid-cols-2 xl:grid-cols-6"
        >
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Variante activa</p>
            <p className="mt-1 text-sm font-medium">{selectedVariantLabel}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Cantidad</p>
            <p className="mt-1 text-sm font-medium">{cotizacionCantidad || "-"}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Período de costos</p>
            <p className="mt-1 text-sm font-medium">{cotizacionPeriodo || "-"}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className="mt-1 text-sm font-medium">{cotizacion ? "Simulación calculada" : isLoadingSnapshots ? "Cargando historial" : "Sin simulación calculada"}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Costo total</p>
            <p className="mt-1 text-sm font-medium">{cotizacion ? formatCurrency(cotizacion.total) : "-"}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Costo unitario</p>
            <p className="mt-1 text-sm font-medium">{cotizacion ? formatCurrency(cotizacion.unitario) : "-"}</p>
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Contexto de cotización"
          description="Definí la variante, la cantidad y el período de costos antes de ejecutar la simulación."
          icon={Layers3Icon}
          actions={
            <Button type="button" onClick={handleCotizar} disabled={isCotizando || !props.selectedVariant}>
              {isCotizando ? <GdiSpinner className="size-4" data-icon="inline-start" /> : null}
              Simular costo
            </Button>
          }
        >
          <div className="grid gap-3 md:grid-cols-4">
            <Field>
              <FieldLabel>Variante</FieldLabel>
              <Select value={props.selectedVariantId || "__none__"} onValueChange={(value) => props.setSelectedVariantId(value === "__none__" ? "" : value ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná variante">
                    {props.selectedVariant ? selectedVariantLabel : "Seleccioná variante"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {variantesSelect.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {getDigitalVariantDisplayLabel(item, papelLabelById)}{item.activo ? "" : " (inactiva)"}
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
              <FieldLabel>Período de costos</FieldLabel>
              <Input value={cotizacionPeriodo} onChange={(e) => setCotizacionPeriodo(e.target.value)} />
              <p className="text-xs text-muted-foreground">Formato esperado: YYYY-MM</p>
            </Field>
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Parámetros de simulación"
          description="Definí opciones técnicas y respuestas opcionales que impactan el costo del trabajo."
          icon={ActivityIcon}
        >
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/10 p-4">
              <div className="mb-3">
                <h4 className="text-sm font-semibold">Configuración técnica de la variante</h4>
                <p className="text-sm text-muted-foreground">
                  Estas opciones consumen dimensiones base del producto y modifican la simulación actual.
                </p>
              </div>
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

            <div className="rounded-xl border bg-muted/10 p-4">
              <div className="mb-3">
                <h4 className="text-sm font-semibold">Opcionales para cotizar</h4>
                <p className="text-sm text-muted-foreground">
                  Estas respuestas pueden agregar procesos, materiales o costos al trabajo actual.
                </p>
              </div>
              <ProductoServicioChecklistCotizador
                checklist={props.checklist}
                value={cotizacionChecklistRespuestas}
                onChange={setCotizacionChecklistRespuestas}
              />
            </div>
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Resultado y desglose"
          description="Mostramos la última simulación calculada, sus advertencias y el desglose completo de procesos y materiales."
          icon={SigmaIcon}
        >
          <div className="space-y-4">
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

                <div className="rounded-xl border bg-muted/10 p-4">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold">Centro de costos</h4>
                  </div>
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
                </div>

                <div className="rounded-xl border bg-muted/10 p-4">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold">Materias primas</h4>
                  </div>
                  <div className="space-y-3">
                    {materialesAgrupados.map((grupo) => (
                      <Collapsible
                        key={grupo.tipo}
                        open={materialesOpen[grupo.tipo] ?? false}
                        onOpenChange={(open) => setMaterialesOpen((prev) => ({ ...prev, [grupo.tipo]: open }))}
                      >
                        <div className="rounded-lg border bg-background">
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

                    <div className="rounded-lg border bg-background">
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
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Badge variant={isLoadingSnapshots ? "secondary" : "outline"}>
                  {isLoadingSnapshots ? "Cargando historial" : "Sin simulación activa"}
                </Badge>
                <p className="mt-3 text-sm font-medium">Todavía no hay una simulación calculada para esta variante.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Definí cantidad, opciones técnicas y checklist, luego ejecutá la simulación.
                </p>
              </div>
            )}
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Historial de simulaciones"
          description="Consultá snapshots anteriores calculados para esta misma variante."
          icon={HistoryIcon}
        >
          <Collapsible open={snapshotsOpen} onOpenChange={setSnapshotsOpen}>
            <div className="rounded-lg border bg-background">
              <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/60">
                <span className="text-sm font-medium">Snapshots disponibles</span>
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
        </ProductoTabSection>
      </CardContent>
    </Card>
  );
}
