"use client";

import * as React from "react";
import { Cell, Pie, PieChart } from "recharts";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import type { PropuestaItem } from "@/lib/propuestas";
import { formatCurrency } from "@/lib/propuestas";
import { simularPrecioComercial } from "@/lib/productos-servicios-simulacion";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PIE_COLORS = [
  "hsl(220 70% 55%)", // procesos
  "hsl(40 90% 55%)",  // papel / sustrato
  "hsl(160 60% 45%)", // toner / tinta
  "hsl(0 65% 55%)",   // desgaste
  "hsl(280 55% 55%)", // consumibles
  "hsl(200 55% 50%)", // adicionales
];

function fmt(n: number) {
  return formatCurrency(n);
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

function minutesFmt(n: number) {
  return `${n.toFixed(1)} min`;
}

type CostBreakdownSlice = { name: string; value: number };

function buildDigitalSlices(item: PropuestaItem): CostBreakdownSlice[] {
  if (!item.cotizacion) return [];
  const s = item.cotizacion.subtotales;
  const slices: CostBreakdownSlice[] = [];
  if (s.procesos > 0) slices.push({ name: "Procesos", value: s.procesos });
  if (s.papel > 0) slices.push({ name: "Papel", value: s.papel });
  if (s.toner > 0) slices.push({ name: "Toner", value: s.toner });
  if (s.desgaste > 0) slices.push({ name: "Desgaste", value: s.desgaste });
  if ((s.consumiblesTerminacion ?? 0) > 0)
    slices.push({ name: "Consumibles", value: s.consumiblesTerminacion! });
  if ((s.adicionalesMateriales ?? 0) > 0)
    slices.push({ name: "Adicionales", value: s.adicionalesMateriales! });
  return slices;
}

function buildGfSlices(item: PropuestaItem): CostBreakdownSlice[] {
  if (!item.granFormato?.costosResponse) return [];
  const t = item.granFormato.costosResponse.totales;
  const slices: CostBreakdownSlice[] = [];
  if (t.centrosCosto > 0) slices.push({ name: "Procesos", value: t.centrosCosto });
  if (t.materiales > 0) slices.push({ name: "Materiales", value: t.materiales });
  return slices;
}

type MaterialItem = {
  nombre: string;
  origen: string;
  cantidad: string;
  costoUnitario: number;
  costo: number;
};

type MaterialGroup = {
  tipo: string;
  items: MaterialItem[];
  subtotal: number;
};

function buildDigitalMaterialGroups(item: PropuestaItem): MaterialGroup[] {
  if (!item.cotizacion) return [];
  const byKey = new Map<string, MaterialGroup>();
  for (const mat of item.cotizacion.bloques.materiales) {
    const m = mat as Record<string, unknown>;
    const tipo = String(m.tipo ?? "Otro");
    const origen = String(m.origen ?? "");
    const isMerma = origen.toLowerCase().includes("merma");
    const baseLabel =
      tipo === "PAPEL" ? "Papel"
        : tipo === "TONER" ? "Toner"
          : tipo === "FILM" || tipo === "CONSUMIBLE_FILM" ? "Consumibles"
            : tipo === "DESGASTE" ? "Desgaste"
              : tipo === "ADDITIONAL_MATERIAL_EFFECT" ? "Adicionales"
                : tipo;
    const groupKey = isMerma ? `${baseLabel} · Merma operativa` : baseLabel;
    if (!byKey.has(groupKey)) {
      byKey.set(groupKey, { tipo: groupKey, items: [], subtotal: 0 });
    }
    const group = byKey.get(groupKey)!;
    const costo = Number(m.costo ?? 0);
    group.items.push({
      nombre: String(m.nombre ?? m.sku ?? ""),
      origen,
      cantidad: String(m.cantidad ?? ""),
      costoUnitario: Number(m.costoUnitario ?? 0),
      costo,
    });
    group.subtotal += costo;
  }
  return Array.from(byKey.values());
}

function buildGfMaterialGroups(item: PropuestaItem): MaterialGroup[] {
  if (!item.granFormato?.costosResponse) return [];
  const byKey = new Map<string, MaterialGroup>();
  for (const mat of item.granFormato.costosResponse.materiasPrimas) {
    const origen = mat.origen ?? "";
    const isMerma = origen.toLowerCase().includes("merma");
    const baseLabel =
      mat.tipo === "SUSTRATO" ? "Sustrato"
        : mat.tipo === "TINTA" ? "Tinta"
          : mat.tipo === "CHECKLIST_MATERIAL" ? "Adicionales"
            : String(mat.tipo);
    const groupKey = isMerma ? `${baseLabel} · Merma operativa` : baseLabel;
    if (!byKey.has(groupKey)) {
      byKey.set(groupKey, { tipo: groupKey, items: [], subtotal: 0 });
    }
    const group = byKey.get(groupKey)!;
    const colorChip = mat.variantChips?.find((c) => c.label === "Color");
    const displayName = colorChip
      ? `${mat.nombre} · ${colorChip.value}`
      : mat.nombre;
    group.items.push({
      nombre: displayName,
      origen,
      cantidad: `${mat.cantidad}${mat.unidad ? ` ${mat.unidad}` : ""}`,
      costoUnitario: mat.costoUnitario,
      costo: mat.costo,
    });
    group.subtotal += mat.costo;
  }
  return Array.from(byKey.values());
}

// ---------------------------------------------------------------------------
// Vinyl cut helpers
// ---------------------------------------------------------------------------

function buildVcSlices(vcAgg: Record<string, unknown> | undefined): CostBreakdownSlice[] {
  if (!vcAgg) return [];
  const slices: CostBreakdownSlice[] = [];
  const centros = Number(vcAgg.totalCentrosCosto ?? 0);
  const materiales = Number(vcAgg.totalMateriales ?? 0);
  if (centros > 0) slices.push({ name: "Procesos", value: centros });
  if (materiales > 0) slices.push({ name: "Materiales", value: materiales });
  return slices;
}

function buildVcMaterialGroups(vcAgg: Record<string, unknown> | undefined): MaterialGroup[] {
  if (!vcAgg) return [];
  const mats = (vcAgg.materiasPrimas ?? []) as Array<Record<string, unknown>>;
  const byKey = new Map<string, MaterialGroup>();
  for (const mat of mats) {
    const tipo = String(mat.tipo ?? "Otro");
    const origen = String(mat.origen ?? "");
    const isMerma = origen.toLowerCase().includes("merma");
    const baseLabel = tipo === "SUSTRATO" || tipo === "VINILO" ? "Vinilo"
      : tipo === "TINTA" ? "Tinta"
        : tipo;
    const groupKey = isMerma ? `${baseLabel} · Merma operativa` : baseLabel;
    if (!byKey.has(groupKey)) {
      byKey.set(groupKey, { tipo: groupKey, items: [], subtotal: 0 });
    }
    const group = byKey.get(groupKey)!;
    const costo = Number(mat.costo ?? 0);
    const chips = (mat.variantChips ?? []) as Array<{ label: string; value: string }>;
    const colorChip = chips.find((c) => c.label === "Color");
    const nombre = String(mat.nombre ?? "");
    const displayName = colorChip ? `${nombre} · ${colorChip.value}` : nombre;
    group.items.push({
      nombre: displayName,
      origen,
      cantidad: `${mat.cantidad ?? ""}${mat.unidad ? ` ${mat.unidad}` : ""}`,
      costoUnitario: Number(mat.costoUnitario ?? 0),
      costo,
    });
    group.subtotal += costo;
  }
  return Array.from(byKey.values());
}

// ---------------------------------------------------------------------------
// Pie chart config
// ---------------------------------------------------------------------------

const pieChartConfig: ChartConfig = {
  value: { label: "Costo" },
};


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CostosProductoDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PropuestaItem;
}) {
  const isDigital = item.motorCodigo === "impresion_digital_laser";
  const isGf = item.motorCodigo === "gran_formato";
  const isVc = item.motorCodigo === "vinilo_de_corte";
  const vcAgg = item.viniloCut?.costosResponse?.aggregated as Record<string, unknown> | undefined;

  // Cost totals
  const costoTotal = isDigital
    ? item.cotizacion?.total ?? 0
    : isGf
      ? item.granFormato?.costosResponse?.totales.tecnico ?? 0
      : isVc
        ? Number(vcAgg?.totalTecnico ?? 0)
        : 0;
  const costoUnitario = isDigital
    ? item.cotizacion?.unitario ?? 0
    : item.cantidad > 0
      ? costoTotal / item.cantidad
      : 0;

  // Simulacion comercial completa (incluye impuestos + comisiones + margen)
  const sim = item.precioConfig
    ? simularPrecioComercial({ precio: item.precioConfig, costoTotal, cantidad: item.cantidad })
    : null;

  const precioVenta = sim?.precioFinal ?? item.total;
  const impuestos = sim?.impuestosMonto ?? item.impuestoMonto;
  const comisiones = sim?.comisionesMonto ?? 0;
  const margen = sim?.margenRealMonto ?? (item.subtotal - impuestos - costoTotal);
  const margenPct = sim?.margenRealPct ?? (precioVenta > 0 ? (margen / precioVenta) * 100 : 0);
  const comisionesPct = sim?.comisionesPct ?? 0;
  const impuestosPct = sim?.impuestosPct ?? item.impuestoPorcentaje;

  // Pie chart
  const pieSlices = isDigital
    ? buildDigitalSlices(item)
    : isVc
      ? buildVcSlices(vcAgg)
      : buildGfSlices(item);

  // Donut: composicion del precio
  const precioSlices: CostBreakdownSlice[] = [];
  if (costoTotal > 0) precioSlices.push({ name: "Costo", value: costoTotal });
  if (impuestos > 0) precioSlices.push({ name: "Impuestos", value: impuestos });
  if (comisiones > 0) precioSlices.push({ name: "Comisiones", value: comisiones });
  if (margen > 0) precioSlices.push({ name: "Margen", value: margen });

  const PRECIO_COLORS = [
    "hsl(220 70% 55%)", // costo
    "hsl(35 80% 55%)",  // impuestos
    "hsl(280 55% 55%)", // comisiones
    "hsl(160 60% 45%)", // margen
  ];

  // Process table
  const vcCentros = (vcAgg?.centrosCosto ?? []) as Array<Record<string, unknown>>;
  const procesos = isDigital
    ? (item.cotizacion?.bloques.procesos ?? []).map((p) => ({
        nombre: p.nombre,
        centro: p.centroCostoNombre,
        origen: p.origen ?? "",
        minutos: p.totalMin,
        tarifaHora: p.tarifaHora,
        costo: p.costo,
      }))
    : isVc
      ? vcCentros.map((c) => ({
          nombre: String(c.paso ?? c.nombre ?? ""),
          centro: String(c.centroCostoNombre ?? ""),
          origen: String(c.origen ?? ""),
          minutos: Number(c.minutos ?? 0),
          tarifaHora: Number(c.tarifaHora ?? 0),
          costo: Number(c.costo ?? 0),
        }))
      : (item.granFormato?.costosResponse?.centrosCosto ?? []).map((c) => ({
          nombre: c.paso,
          centro: c.centroCostoNombre,
          origen: c.origen,
          minutos: c.minutos,
          tarifaHora: c.tarifaHora,
          costo: c.costo,
        }));
  const totalProcesos = procesos.reduce((sum, p) => sum + p.costo, 0);

  // Material groups
  const materialGroups = isDigital
    ? buildDigitalMaterialGroups(item)
    : isVc
      ? buildVcMaterialGroups(vcAgg)
      : buildGfMaterialGroups(item);
  const totalMateriales = materialGroups.reduce((sum, g) => sum + g.subtotal, 0);

  // GF resumen tecnico
  const resumenTecnico = isGf ? item.granFormato?.costosResponse?.resumenTecnico : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-screen max-w-none flex-col overflow-hidden data-[side=right]:w-[62vw] data-[side=right]:sm:max-w-[62vw]">
        <SheetHeader className="px-4 pb-3 md:px-6">
          <SheetTitle>Desglose de costos</SheetTitle>
          <SheetDescription>
            {item.productoNombre}
            {item.varianteNombre ? ` · ${item.varianteNombre}` : ""}
            {" · "}
            {item.cantidad.toLocaleString("es-AR")}{" "}
            {item.unidadMedida === "unidad" ? "un." : item.unidadMedida}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 md:px-6">
          <div className="flex flex-col gap-6">
            {/* Resumen rentabilidad */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <MetricCard label="Costo produccion" value={fmt(costoTotal)} />
              <MetricCard label="Precio final" value={fmt(precioVenta)} />
              <MetricCard
                label="Margen real"
                value={fmt(margen)}
                subtitle={pct(margenPct)}
                accent={margen >= 0 ? "positive" : "negative"}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <MetricCard
                label="Impuestos"
                value={fmt(impuestos)}
                subtitle={`${impuestosPct}%`}
              />
              <MetricCard
                label="Comisiones"
                value={fmt(comisiones)}
                subtitle={`${comisionesPct}%`}
              />
              <MetricCard
                label="Cargos totales"
                value={fmt(impuestos + comisiones)}
                subtitle={`${pct(impuestosPct + comisionesPct)}`}
              />
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Donut: distribucion del costo */}
              {pieSlices.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Distribucion del costo
                    </p>
                    <ChartContainer config={pieChartConfig} className="mx-auto aspect-square max-h-[200px]">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent formatter={(value) => fmt(Number(value))} />} />
                        <Pie data={pieSlices} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                          {pieSlices.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="mt-2 flex flex-wrap justify-center gap-3">
                      {pieSlices.map((s, i) => (
                        <span key={s.name} className="flex items-center gap-1.5 text-xs">
                          <span
                            className="inline-block size-2.5 rounded-full"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Donut: composicion del precio */}
              {precioSlices.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Composicion del precio
                    </p>
                    <ChartContainer config={pieChartConfig} className="mx-auto aspect-square max-h-[200px]">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent formatter={(value) => fmt(Number(value))} />} />
                        <Pie data={precioSlices} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                          {precioSlices.map((_, i) => (
                            <Cell key={i} fill={PRECIO_COLORS[i % PRECIO_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="mt-2 flex flex-wrap justify-center gap-3">
                      {precioSlices.map((s, i) => (
                        <span key={s.name} className="flex items-center gap-1.5 text-xs">
                          <span
                            className="inline-block size-2.5 rounded-full"
                            style={{ backgroundColor: PRECIO_COLORS[i % PRECIO_COLORS.length] }}
                          />
                          {s.name} {fmt(s.value)}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Unit economics */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricCard label="Costo unitario" value={fmt(costoUnitario)} />
              <MetricCard label="Precio unitario" value={fmt(item.precioUnitario)} />
              {isDigital && item.cotizacion && (
                <>
                  <MetricCard label="Pliegos" value={String(item.cotizacion.pliegos)} />
                  <MetricCard label="Piezas/pliego" value={String(item.cotizacion.piezasPorPliego)} />
                </>
              )}
              {resumenTecnico && (
                <>
                  <MetricCard label="Desperdicio" value={pct(resumenTecnico.desperdicioPct)} subtitle={`${resumenTecnico.areaDesperdicioM2.toFixed(2)} m2`} />
                  <MetricCard
                    label="Area util"
                    value={`${resumenTecnico.areaUtilM2.toFixed(2)} m2`}
                  />
                </>
              )}
            </div>

            {/* Procesos table */}
            {procesos.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Centros de costo</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paso</TableHead>
                      <TableHead>Centro</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead className="w-24 text-right">Minutos</TableHead>
                      <TableHead className="w-24 text-right">Tarifa/h</TableHead>
                      <TableHead className="w-28 text-right">Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {procesos.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{p.nombre}</TableCell>
                        <TableCell>{p.centro}</TableCell>
                        <TableCell className="text-muted-foreground">{p.origen}</TableCell>
                        <TableCell className="text-right tabular-nums">{minutesFmt(p.minutos)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(p.tarifaHora)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{fmt(p.costo)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 font-medium">
                      <TableCell colSpan={5}>Total procesos</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(totalProcesos)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Materiales */}
            {materialGroups.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Materiales</h3>
                <div className="flex flex-col gap-1">
                  {materialGroups.map((group) => (
                    <Collapsible key={group.tipo}>
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50">
                        <span className="flex items-center gap-2 font-medium">
                          <ChevronRightIcon className="size-4 transition-transform [[data-open]>&]:rotate-90" />
                          {group.tipo}
                          <span className="text-xs text-muted-foreground">
                            ({group.items.length})
                          </span>
                        </span>
                        <span className="tabular-nums font-medium">{fmt(group.subtotal)}</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Componente</TableHead>
                              <TableHead className="w-24 text-right">Cantidad</TableHead>
                              <TableHead className="w-24 text-right">Costo unit.</TableHead>
                              <TableHead className="w-28 text-right">Costo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.items.map((mat, i) => (
                              <TableRow key={i}>
                                <TableCell>{mat.nombre}</TableCell>
                                <TableCell className="text-right tabular-nums">{mat.cantidad}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(mat.costoUnitario)}</TableCell>
                                <TableCell className="text-right tabular-nums font-medium">{fmt(mat.costo)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                  <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm font-medium">
                    <span>Total materiales</span>
                    <span className="tabular-nums">{fmt(totalMateriales)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Resumen tecnico GF */}
            {resumenTecnico && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Resumen tecnico</h3>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Area consumida</span>
                    <span className="font-medium tabular-nums">{resumenTecnico.areaConsumidaM2.toFixed(2)} m2</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Area util</span>
                    <span className="font-medium tabular-nums">{resumenTecnico.areaUtilM2.toFixed(2)} m2</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Desperdicio</span>
                    <span className="font-medium tabular-nums">{pct(resumenTecnico.desperdicioPct)} ({resumenTecnico.areaDesperdicioM2.toFixed(2)} m2)</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Orientacion</span>
                    <span className="font-medium capitalize">{resumenTecnico.orientacion}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Ancho rollo</span>
                    <span className="font-medium tabular-nums">{(resumenTecnico.anchoRolloMm / 10).toFixed(0)} cm</span>
                  </div>
                  {resumenTecnico.panelizado && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Layout</span>
                      <span className="font-medium tabular-nums">
                        {resumenTecnico.piezasPorFila} x {resumenTecnico.filas}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string;
  subtitle?: string;
  accent?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-lg font-semibold tabular-nums ${
            accent === "positive"
              ? "text-emerald-600"
              : accent === "negative"
                ? "text-red-600"
                : ""
          }`}
        >
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
