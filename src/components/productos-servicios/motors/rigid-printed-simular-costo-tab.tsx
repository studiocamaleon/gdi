"use client";

import * as React from "react";
import { toast } from "sonner";
import { ActivityIcon, ChevronDownIcon, ChevronRightIcon, InfoIcon, Layers3Icon, PlusIcon, SigmaIcon, Trash2Icon } from "lucide-react";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { formatCurrency, formatNumber } from "@/components/productos-servicios/producto-comercial.helpers";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getProductoMotorConfig,
  cotizarRigidPrintedByProducto,
} from "@/lib/productos-servicios-api";
import type { MateriaPrima } from "@/lib/materias-primas";
import type { Maquina } from "@/lib/maquinaria";

// ── Tipos ─────────────────────────────────────────────────────────

type ImpresionTipoConfig = {
  maquinasCompatibles: string[];
  perfilesCompatibles: string[];
  maquinaDefaultId: string | null;
  perfilDefaultId: string | null;
};

type RigidPrintedConfig = {
  tiposImpresion: string[];
  impresionDirecta: ImpresionTipoConfig;
  flexibleMontado: ImpresionTipoConfig;
  materialRigidoId: string | null;
  variantesCompatibles: string[];
  placaVarianteIdDefault: string | null;
  carasDisponibles: string[];
  carasDefault: string;
  [key: string]: unknown;
};

type ProcesoBloque = {
  orden: number;
  nombre: string;
  centroCostoNombre: string;
  setupMin: number;
  runMin: number;
  totalMin: number;
  tarifaHora: number;
  costo: number;
};

type MateriaPrimaBloque = {
  tipo: string;
  nombre: string;
  origen: string;
  unidad: string;
  cantidad: number;
  costoUnitario: number;
  costo: number;
  variantChips?: Array<{ label: string; value: string }>;
};

type QuoteResult = {
  total: number;
  unitario: number;
  subtotales: { procesos: number; material: number; tinta?: number };
  bloques: {
    procesos: ProcesoBloque[];
    materiales: MateriaPrimaBloque[];
  };
  trazabilidad: {
    tipoImpresion: string;
    caras: string;
    multiplicadorCaras: number;
    estrategiaCosteo: string;
    costeoDetalle: {
      precioPlaca: number;
      precioM2: number;
      placasCompletas: number;
      costoPlacasCompletas: number;
      ultimaPlaca: { ocupacionPct: number; segmentoAplicado: number | null; costo: number } | null;
    };
    resumenTecnico: {
      anchoMm?: number;
      altoMm?: number;
      placaAnchoMm?: number;
      placaAltoMm?: number;
      piezasPorPlaca: number;
      placasNecesarias: number;
      aprovechamientoPct: number;
      rotada: boolean;
      sobrantes: number;
    };
  };
};

type PlacaOption = { id: string; label: string; espesor: number | null; precio: number };
type PerfilOption = { id: string; nombre: string; maquinaNombre: string };

const TIPO_LABELS: Record<string, string> = { directa: "Impresión directa", flexible_montado: "Sustrato flexible montado" };
const CARAS_LABELS: Record<string, string> = { simple_faz: "Simple faz", doble_faz: "Doble faz" };
const ESTRATEGIA_LABELS: Record<string, string> = { m2_exacto: "M² exacto", largo_consumido: "Largo consumido", segmentos_placa: "Segmentos de placa" };

// ── Componente principal ──────────────────────────────────────────

export function RigidPrintedSimularCostoTab(props: ProductTabProps) {
  const [loading, setLoading] = React.useState(true);
  const [quoting, setQuoting] = React.useState(false);
  const [config, setConfig] = React.useState<RigidPrintedConfig | null>(null);
  const [quoteResult, setQuoteResult] = React.useState<QuoteResult | null>(null);

  const [anchoMm, setAnchoMm] = React.useState<number>(0);
  const [altoMm, setAltoMm] = React.useState<number>(0);
  const [cantidad, setCantidad] = React.useState<number>(10);
  const [placaVarianteId, setPlacaVarianteId] = React.useState<string>("");
  const [tipoImpresion, setTipoImpresion] = React.useState<string>("directa");
  const [caras, setCaras] = React.useState<string>("simple_faz");

  const materiasPrimas = (props.materiasPrimas ?? []) as MateriaPrima[];
  const maquinas = (props.maquinas ?? []) as Maquina[];

  const placasCompatibles = React.useMemo<PlacaOption[]>(() => {
    if (!config?.materialRigidoId) return [];
    const mat = materiasPrimas.find((m) => m.id === config.materialRigidoId);
    if (!mat) return [];
    const ids = new Set(config.variantesCompatibles ?? []);
    return (mat.variantes ?? []).filter((v) => ids.has(v.id)).map((v) => {
      const a = (v.atributosVariante ?? {}) as Record<string, unknown>;
      const aR = Number(a.ancho ?? 0); const hR = Number(a.alto ?? 0);
      const aMm = aR < 10 ? Math.round(aR * 1000) : aR;
      const hMm = hR < 10 ? Math.round(hR * 1000) : hR;
      return { id: v.id, label: `${aMm} × ${hMm} mm${a.espesor != null ? ` · ${a.espesor}mm` : ""}`, espesor: a.espesor != null ? Number(a.espesor) : null, precio: Number(v.precioReferencia ?? 0) };
    });
  }, [config, materiasPrimas]);

  const tiposDisponibles = config?.tiposImpresion ?? [];
  const carasDisponibles = config?.carasDisponibles ?? ["simple_faz"];

  const perfilesDisponibles = React.useMemo<PerfilOption[]>(() => {
    if (!config) return [];
    const tc = tipoImpresion === "flexible_montado" ? config.flexibleMontado : config.impresionDirecta;
    if (!tc) return [];
    const mIds = new Set(tc.maquinasCompatibles ?? []); const pIds = new Set(tc.perfilesCompatibles ?? []);
    const r: PerfilOption[] = [];
    for (const m of maquinas) { if (!mIds.has(m.id)) continue; for (const p of m.perfilesOperativos ?? []) { if (pIds.has(p.id) && p.activo) r.push({ id: p.id, nombre: p.nombre, maquinaNombre: m.nombre }); } }
    return r;
  }, [config, tipoImpresion, maquinas]);

  const selectedPlaca = placasCompatibles.find((p) => p.id === placaVarianteId);

  // ── Load ────────────────────────────────────────────────────────

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const result = await getProductoMotorConfig(props.producto.id);
        const p = (result?.parametros ?? {}) as RigidPrintedConfig;
        setConfig(p);
        setCaras(p.carasDefault ?? "simple_faz");
        if ((p.tiposImpresion ?? []).length > 0) setTipoImpresion(p.tiposImpresion[0]);
        setPlacaVarianteId(p.placaVarianteIdDefault ?? (p.variantesCompatibles ?? [])[0] ?? "");
      } catch { toast.error("Error al cargar configuración."); }
      finally { setLoading(false); }
    })();
  }, [props.producto.id]);

  // Pre-fill from variant
  React.useEffect(() => {
    const v = props.selectedVariant;
    if (v && Number(v.anchoMm) > 0 && Number(v.altoMm) > 0 && anchoMm === 0) {
      setAnchoMm(Number(v.anchoMm)); setAltoMm(Number(v.altoMm));
    }
  }, [props.selectedVariant]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cotizar ─────────────────────────────────────────────────────

  const handleCotizar = React.useCallback(async () => {
    if (anchoMm <= 0 || altoMm <= 0) { toast.error("Ingresá ancho y alto de pieza."); return; }
    try {
      setQuoting(true);
      const r = await cotizarRigidPrintedByProducto(props.producto.id, {
        cantidad,
        parametros: { anchoMm, altoMm, tipoImpresion, caras, ...(placaVarianteId ? { placaVarianteId } : {}) },
      });
      setQuoteResult(r as unknown as QuoteResult);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error al cotizar.");
      setQuoteResult(null);
    } finally { setQuoting(false); }
  }, [props.producto.id, anchoMm, altoMm, cantidad, tipoImpresion, caras, placaVarianteId]);

  const clear = () => setQuoteResult(null);

  if (loading) return <GdiSpinner />;

  // ── Render ──────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simular costo</CardTitle>
        <CardDescription>Ejecuta el motor de costo para este producto rígido impreso.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Resumen rápido ── */}
        <ProductoTabSection
          title="Resumen de simulación"
          description="Lectura rápida del escenario actual y el último resultado calculado."
          icon={InfoIcon}
          contentClassName="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Costo total</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{quoteResult ? formatCurrency(quoteResult.total) : "—"}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Costo unitario</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{quoteResult ? formatCurrency(quoteResult.unitario) : "—"}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Placas necesarias</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{quoteResult ? quoteResult.trazabilidad.resumenTecnico.placasNecesarias : "—"}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Aprovechamiento</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{quoteResult ? `${formatNumber(quoteResult.trazabilidad.resumenTecnico.aprovechamientoPct)}%` : "—"}</p>
          </div>
        </ProductoTabSection>

        {/* ── Configuración ── */}
        <ProductoTabSection
          title="Configuración"
          description="Definí las medidas, material y tipo de impresión."
          icon={Layers3Icon}
        >
          <div className="space-y-4">
            {/* Medidas + Cantidad */}
            <div className="grid gap-3 md:grid-cols-3 max-w-lg">
              <Field>
                <FieldLabel>Ancho pieza (cm)</FieldLabel>
                <Input type="number" placeholder="30"
                  value={anchoMm ? anchoMm / 10 : ""}
                  onChange={(e) => { setAnchoMm(Math.round((Number(e.target.value) || 0) * 10)); clear(); }} />
              </Field>
              <Field>
                <FieldLabel>Alto pieza (cm)</FieldLabel>
                <Input type="number" placeholder="40"
                  value={altoMm ? altoMm / 10 : ""}
                  onChange={(e) => { setAltoMm(Math.round((Number(e.target.value) || 0) * 10)); clear(); }} />
              </Field>
              <Field>
                <FieldLabel>Cantidad</FieldLabel>
                <Input type="number" min={1} value={cantidad}
                  onChange={(e) => { setCantidad(Math.max(1, Number(e.target.value) || 1)); clear(); }} />
              </Field>
            </div>

            {/* Placa */}
            {placasCompatibles.length > 0 && (
              <div className="max-w-lg">
                <Field>
                  <FieldLabel>Placa de material</FieldLabel>
                  {placasCompatibles.length === 1 ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{placasCompatibles[0].label}</Badge>
                      {placasCompatibles[0].precio > 0 && <span className="text-sm text-muted-foreground">{formatCurrency(placasCompatibles[0].precio)}</span>}
                    </div>
                  ) : (
                    <Select value={placaVarianteId} onValueChange={(v) => { if (v) setPlacaVarianteId(v); clear(); }}>
                      <SelectTrigger><SelectValue>{selectedPlaca ? `${selectedPlaca.label} · ${formatCurrency(selectedPlaca.precio)}` : "Seleccionar placa"}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {placasCompatibles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.label}{p.precio > 0 ? ` · ${formatCurrency(p.precio)}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </div>
            )}

            {/* Impresión */}
            <div className="grid gap-3 md:grid-cols-3 max-w-2xl">
              {tiposDisponibles.length > 1 ? (
                <Field>
                  <FieldLabel>Tipo de impresión</FieldLabel>
                  <Select value={tipoImpresion} onValueChange={(v) => { if (v) setTipoImpresion(v); clear(); }}>
                    <SelectTrigger><SelectValue>{TIPO_LABELS[tipoImpresion] ?? tipoImpresion}</SelectValue></SelectTrigger>
                    <SelectContent>{tiposDisponibles.map((t) => (<SelectItem key={t} value={t}>{TIPO_LABELS[t] ?? t}</SelectItem>))}</SelectContent>
                  </Select>
                </Field>
              ) : tiposDisponibles.length === 1 ? (
                <Field>
                  <FieldLabel>Tipo de impresión</FieldLabel>
                  <Badge variant="outline" className="mt-1">{TIPO_LABELS[tiposDisponibles[0]] ?? tiposDisponibles[0]}</Badge>
                </Field>
              ) : null}

              {perfilesDisponibles.length > 0 && (
                <Field>
                  <FieldLabel>Perfil de impresión</FieldLabel>
                  <Select defaultValue="">
                    <SelectTrigger><SelectValue placeholder="Default del producto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Default del producto</SelectItem>
                      {perfilesDisponibles.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nombre} ({p.maquinaNombre})</SelectItem>))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {carasDisponibles.length > 1 ? (
                <Field>
                  <FieldLabel>Caras</FieldLabel>
                  <Select value={caras} onValueChange={(v) => { if (v) setCaras(v); clear(); }}>
                    <SelectTrigger><SelectValue>{CARAS_LABELS[caras] ?? caras}</SelectValue></SelectTrigger>
                    <SelectContent>{carasDisponibles.map((c) => (<SelectItem key={c} value={c}>{CARAS_LABELS[c] ?? c}</SelectItem>))}</SelectContent>
                  </Select>
                </Field>
              ) : carasDisponibles.length === 1 ? (
                <Field>
                  <FieldLabel>Caras</FieldLabel>
                  <Badge variant="outline" className="mt-1">{CARAS_LABELS[carasDisponibles[0]] ?? carasDisponibles[0]}</Badge>
                </Field>
              ) : null}
            </div>

            {/* Botón */}
            <div className="flex items-center gap-3">
              <Button onClick={handleCotizar} disabled={quoting || anchoMm <= 0 || altoMm <= 0}>
                {quoting ? <><GdiSpinner className="size-4" /> Calculando...</> : "Simular costo"}
              </Button>
              {quoteResult && <span className="text-xs text-muted-foreground">Resultado calculado</span>}
            </div>
          </div>
        </ProductoTabSection>

        {/* ── Desglose: Centros de costo ── */}
        {quoteResult && (
          <ProductoTabSection
            title="Centros de costo"
            description="Desglose de costos de producción por operación."
            icon={ActivityIcon}
          >
            {quoteResult.bloques.procesos.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Paso</TableHead>
                      <TableHead>Centro de costo</TableHead>
                      <TableHead className="text-right w-24">Minutos</TableHead>
                      <TableHead className="text-right w-28">Tarifa/h</TableHead>
                      <TableHead className="text-right w-28">Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quoteResult.bloques.procesos.map((p) => (
                      <TableRow key={p.orden}>
                        <TableCell className="tabular-nums text-muted-foreground">{p.orden}</TableCell>
                        <TableCell className="font-medium">{p.nombre}</TableCell>
                        <TableCell className="text-muted-foreground">{p.centroCostoNombre}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(p.totalMin)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(p.tarifaHora)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatCurrency(p.costo)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={5} className="text-right">Total centros de costo</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(quoteResult.subtotales.procesos)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                {quoteResult.trazabilidad.multiplicadorCaras > 1 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Doble faz: multiplicador ×{quoteResult.trazabilidad.multiplicadorCaras} aplicado sobre tiempos de impresión.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No hay ruta de producción configurada para {TIPO_LABELS[quoteResult.trazabilidad.tipoImpresion] ?? "este tipo de impresión"}.</p>
            )}
          </ProductoTabSection>
        )}

        {/* ── Desglose: Materias primas ── */}
        {quoteResult && (
          <ProductoTabSection
            title="Materias primas"
            description="Desglose de sustrato rígido, tintas y consumibles."
            icon={SigmaIcon}
          >
            <MateriasPrimasBreakdown result={quoteResult} />
          </ProductoTabSection>
        )}

        {/* ── Trazabilidad ── */}
        {quoteResult && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-2">
              <ChevronRightIcon className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-90" />
              Trazabilidad técnica
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="rounded-lg border bg-muted/20 p-4 text-xs grid grid-cols-2 gap-x-6 gap-y-1 max-w-md">
                <span className="text-muted-foreground">Tipo de impresión</span>
                <span>{TIPO_LABELS[quoteResult.trazabilidad.tipoImpresion] ?? quoteResult.trazabilidad.tipoImpresion}</span>
                <span className="text-muted-foreground">Caras</span>
                <span>{CARAS_LABELS[quoteResult.trazabilidad.caras] ?? quoteResult.trazabilidad.caras}</span>
                <span className="text-muted-foreground">Estrategia de costeo</span>
                <span>{ESTRATEGIA_LABELS[quoteResult.trazabilidad.estrategiaCosteo] ?? quoteResult.trazabilidad.estrategiaCosteo}</span>
                <span className="text-muted-foreground">Precio placa</span>
                <span>{formatCurrency(quoteResult.trazabilidad.costeoDetalle.precioPlaca)}</span>
                <span className="text-muted-foreground">Precio M²</span>
                <span>{formatCurrency(quoteResult.trazabilidad.costeoDetalle.precioM2)}</span>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

// ── Desglose de materias primas (tabla agrupada) ──────────────────

function MateriasPrimasBreakdown({ result }: { result: QuoteResult }) {
  const materiales = result.bloques.materiales as MateriaPrimaBloque[];

  // Agrupar por tipo
  const grupos = React.useMemo(() => {
    const map = new Map<string, { items: MateriaPrimaBloque[]; total: number }>();
    for (const m of materiales) {
      const key = m.tipo || "Otro";
      if (!map.has(key)) map.set(key, { items: [], total: 0 });
      const g = map.get(key)!;
      g.items.push(m);
      g.total += m.costo;
    }
    return Array.from(map.entries()).map(([tipo, data]) => ({
      tipo,
      items: data.items,
      total: data.total,
      count: data.items.length,
    }));
  }, [materiales]);

  return (
    <div className="space-y-4">
      {grupos.map((grupo) => (
        <div key={grupo.tipo} className="rounded-lg border">
          {/* Header del grupo */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b">
            <div>
              <span className="text-sm font-semibold">{grupo.tipo}</span>
              <span className="text-xs text-muted-foreground ml-2">{grupo.count} componente{grupo.count !== 1 ? "s" : ""}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground">Costo total</span>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(grupo.total)}</p>
            </div>
          </div>

          {/* Tabla de componentes */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Componente</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo unitario</TableHead>
                <TableHead className="text-right">Costo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupo.items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm">{item.nombre}</span>
                      {item.variantChips && item.variantChips.length > 0 && (
                        <div className="flex gap-1">
                          {item.variantChips.map((chip, ci) => (
                            <Badge key={ci} variant="outline" className="text-[10px] px-1.5 py-0">
                              {chip.label}: {chip.value}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.origen}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(item.cantidad)} {item.unidad}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(item.costoUnitario)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCurrency(item.costo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Total del grupo */}
          <div className="flex justify-end px-4 py-2 border-t bg-muted/20">
            <span className="text-sm font-semibold tabular-nums">
              Total {grupo.tipo}: {formatCurrency(grupo.total)}
            </span>
          </div>
        </div>
      ))}

      {/* Total general */}
      <div className="rounded-lg border border-primary bg-primary/5 p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-muted-foreground">Costo total (materiales + procesos)</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{formatCurrency(result.total)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Unitario</p>
            <p className="text-lg font-semibold tabular-nums mt-1">{formatCurrency(result.unitario)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
