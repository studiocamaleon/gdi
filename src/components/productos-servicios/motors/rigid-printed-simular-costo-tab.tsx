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
  getCotizacionesProductoServicio,
} from "@/lib/productos-servicios-api";
import type { CotizacionProductoSnapshotResumen } from "@/lib/productos-servicios";
import { HistoryIcon } from "lucide-react";
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
  const [snapshots, setSnapshots] = React.useState<CotizacionProductoSnapshotResumen[]>([]);
  const [snapshotsOpen, setSnapshotsOpen] = React.useState(false);

  type MedidaRow = { anchoMm: number | null; altoMm: number | null; cantidad: number };
  const [medidas, setMedidas] = React.useState<MedidaRow[]>([{ anchoMm: null, altoMm: null, cantidad: 1 }]);
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
        // Cargar historial de snapshots
        getCotizacionesProductoServicio(props.producto.id).then(setSnapshots).catch(() => {});
      } catch { toast.error("Error al cargar configuración."); }
      finally { setLoading(false); }
    })();
  }, [props.producto.id]);

  // Pre-fill from variant
  React.useEffect(() => {
    const v = props.selectedVariant;
    if (v && Number(v.anchoMm) > 0 && Number(v.altoMm) > 0 && medidas.length === 1 && !medidas[0].anchoMm) {
      setMedidas([{ anchoMm: Number(v.anchoMm), altoMm: Number(v.altoMm), cantidad: 1 }]);
    }
  }, [props.selectedVariant]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helpers
  const fmtMmAsCm = (v: number | null) => (v != null && Number.isFinite(v) ? String(Number((v / 10).toFixed(2))) : "");
  const totalCantidad = medidas.reduce((sum, m) => sum + m.cantidad, 0);

  // ── Cotizar ─────────────────────────────────────────────────────

  const handleCotizar = React.useCallback(async () => {
    const validMedidas = medidas.filter((m) => m.anchoMm && m.anchoMm > 0 && m.altoMm && m.altoMm > 0);
    if (validMedidas.length === 0) { toast.error("Ingresá al menos una medida válida."); return; }
    const cantidadTotal = validMedidas.reduce((s, m) => s + m.cantidad, 0);
    try {
      setQuoting(true);
      const r = await cotizarRigidPrintedByProducto(props.producto.id, {
        cantidad: cantidadTotal,
        parametros: {
          medidas: validMedidas.map((m) => ({ anchoMm: m.anchoMm, altoMm: m.altoMm, cantidad: m.cantidad })),
          tipoImpresion, caras,
          ...(placaVarianteId ? { placaVarianteId } : {}),
        },
      });
      setQuoteResult(r as unknown as QuoteResult);
      getCotizacionesProductoServicio(props.producto.id).then(setSnapshots).catch(() => {});
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error al cotizar.");
      setQuoteResult(null);
    } finally { setQuoting(false); }
  }, [props.producto.id, medidas, tipoImpresion, caras, placaVarianteId]);

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

        {/* ── Contexto de cotización (layout 2 columnas como gran formato) ── */}
        <ProductoTabSection
          title="Contexto de cotización"
          description="Definí la tecnología, el perfil operativo y las medidas del trabajo."
          icon={InfoIcon}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            {/* ── Columna izquierda: Medidas del trabajo ── */}
            <div className="rounded-lg border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Medidas del trabajo</p>
              </div>
              <div className="space-y-2">
                <div className="hidden gap-2 px-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_40px_40px]">
                  <span>Ancho (cm)</span>
                  <span>Alto (cm)</span>
                  <span>Cantidad</span>
                  <span />
                  <span />
                </div>
                {medidas.map((medida, index) => (
                  <div key={`medida-${index}`} className="grid gap-2 rounded-lg border p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_40px_40px]">
                    <Field>
                      <Input
                        aria-label={`Ancho (cm) fila ${index + 1}`}
                        placeholder="30"
                        value={fmtMmAsCm(medida.anchoMm)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMedidas((prev) => prev.map((item, i) =>
                            i === index ? { ...item, anchoMm: v.trim() ? Math.round(Number(v) * 10) : null } : item));
                          clear();
                        }}
                      />
                    </Field>
                    <Field>
                      <Input
                        aria-label={`Alto (cm) fila ${index + 1}`}
                        placeholder="40"
                        value={fmtMmAsCm(medida.altoMm)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMedidas((prev) => prev.map((item, i) =>
                            i === index ? { ...item, altoMm: v.trim() ? Math.round(Number(v) * 10) : null } : item));
                          clear();
                        }}
                      />
                    </Field>
                    <Field>
                      <Input
                        aria-label={`Cantidad fila ${index + 1}`}
                        type="number"
                        min={1}
                        value={medida.cantidad}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMedidas((prev) => prev.map((item, i) =>
                            i === index ? { ...item, cantidad: Number.isFinite(v) && v > 0 ? v : 1 } : item));
                          clear();
                        }}
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button type="button" variant="ghost" size="icon" aria-label="Agregar medida"
                        onClick={() => { setMedidas((prev) => [...prev, { anchoMm: null, altoMm: null, cantidad: 1 }]); clear(); }}>
                        <PlusIcon className="size-4" />
                      </Button>
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="ghost" size="icon" disabled={medidas.length === 1}
                        onClick={() => { setMedidas((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== index)); clear(); }}>
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Columna derecha: Opciones ── */}
            <div className="rounded-lg border p-3">
              <div className="space-y-3">
                {/* Tipo de impresión */}
                {tiposDisponibles.length > 1 && (
                  <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                    <FieldLabel className="sm:mb-0">Tipo impresión</FieldLabel>
                    <Select value={tipoImpresion} onValueChange={(v) => { if (v) setTipoImpresion(v); clear(); }}>
                      <SelectTrigger><SelectValue>{TIPO_LABELS[tipoImpresion] ?? tipoImpresion}</SelectValue></SelectTrigger>
                      <SelectContent>{tiposDisponibles.map((t) => (<SelectItem key={t} value={t}>{TIPO_LABELS[t] ?? t}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                )}
                {tiposDisponibles.length === 1 && (
                  <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                    <FieldLabel className="sm:mb-0">Tipo impresión</FieldLabel>
                    <Select value={tiposDisponibles[0]} disabled>
                      <SelectTrigger><SelectValue>{TIPO_LABELS[tiposDisponibles[0]] ?? tiposDisponibles[0]}</SelectValue></SelectTrigger>
                      <SelectContent><SelectItem value={tiposDisponibles[0]}>{TIPO_LABELS[tiposDisponibles[0]] ?? tiposDisponibles[0]}</SelectItem></SelectContent>
                    </Select>
                  </div>
                )}

                {/* Perfil operativo */}
                {perfilesDisponibles.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                    <FieldLabel className="sm:mb-0">Perfil operativo</FieldLabel>
                    <Select defaultValue="__default__">
                      <SelectTrigger><SelectValue>Usar perfil default del producto</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Usar perfil default del producto</SelectItem>
                        {perfilesDisponibles.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nombre} ({p.maquinaNombre})</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Placa */}
                {placasCompatibles.length > 1 && (
                  <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                    <FieldLabel className="sm:mb-0">Placa</FieldLabel>
                    <Select value={placaVarianteId} onValueChange={(v) => { if (v) setPlacaVarianteId(v); clear(); }}>
                      <SelectTrigger><SelectValue>{selectedPlaca ? `${selectedPlaca.label}` : "Seleccionar"}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {placasCompatibles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.label}{p.precio > 0 ? ` · ${formatCurrency(p.precio)}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {placasCompatibles.length === 1 && (
                  <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                    <FieldLabel className="sm:mb-0">Placa</FieldLabel>
                    <Select value={placasCompatibles[0].id} disabled>
                      <SelectTrigger><SelectValue>{placasCompatibles[0].label}{placasCompatibles[0].precio > 0 ? ` · ${formatCurrency(placasCompatibles[0].precio)}` : ""}</SelectValue></SelectTrigger>
                      <SelectContent><SelectItem value={placasCompatibles[0].id}>{placasCompatibles[0].label}</SelectItem></SelectContent>
                    </Select>
                  </div>
                )}

                {/* Caras */}
                {carasDisponibles.length > 1 && (
                  <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                    <FieldLabel className="sm:mb-0">Caras</FieldLabel>
                    <Select value={caras} onValueChange={(v) => { if (v) setCaras(v); clear(); }}>
                      <SelectTrigger><SelectValue>{CARAS_LABELS[caras] ?? caras}</SelectValue></SelectTrigger>
                      <SelectContent>{carasDisponibles.map((c) => (<SelectItem key={c} value={c}>{CARAS_LABELS[c] ?? c}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                )}
                {carasDisponibles.length === 1 && (
                  <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                    <FieldLabel className="sm:mb-0">Caras</FieldLabel>
                    <Select value={carasDisponibles[0]} disabled>
                      <SelectTrigger><SelectValue>{CARAS_LABELS[carasDisponibles[0]] ?? carasDisponibles[0]}</SelectValue></SelectTrigger>
                      <SelectContent><SelectItem value={carasDisponibles[0]}>{CARAS_LABELS[carasDisponibles[0]] ?? carasDisponibles[0]}</SelectItem></SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botón simular */}
          <div className="flex items-center gap-3 mt-4">
            <Button onClick={handleCotizar} disabled={quoting || medidas.every((m) => !m.anchoMm || !m.altoMm)}>
              {quoting ? <><GdiSpinner className="size-4" /> Calculando...</> : "Simular costo"}
            </Button>
            {quoteResult && <span className="text-xs text-muted-foreground">Resultado calculado</span>}
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

        {/* ── Historial de simulaciones ── */}
        <ProductoTabSection
          title="Historial de simulaciones"
          description="Snapshots de cotizaciones anteriores de este producto."
          icon={HistoryIcon}
        >
          <Collapsible open={snapshotsOpen} onOpenChange={setSnapshotsOpen}>
            <div className="rounded-lg border bg-background">
              <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/60">
                <span className="text-sm font-medium">Snapshots disponibles</span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  {snapshots.length}
                  {snapshotsOpen ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t">
                  {snapshots.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">No hay simulaciones anteriores.</p>
                  ) : (
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Snapshot</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Período</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Unitario</TableHead>
                          <TableHead>Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {snapshots.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-xs">{s.id.slice(0, 8)}</TableCell>
                            <TableCell>{s.cantidad}</TableCell>
                            <TableCell>{s.periodoTarifa}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(s.total)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(s.unitario)}</TableCell>
                            <TableCell className="text-xs">{new Date(s.createdAt).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </ProductoTabSection>

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
