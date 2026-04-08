"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  Loader2Icon,
  PackageIcon,
  SearchIcon,
  StarIcon,
} from "lucide-react";

import type {
  ProductoServicio,
  ProductoVariante,
  ProductoChecklist,
  GranFormatoConfig,
  GranFormatoVariante,
  GranFormatoChecklistConfig,
  GranFormatoCostosResponse,
  TipoImpresionProductoVariante,
  CarasProductoVariante,
  DimensionOpcionProductiva,
  ValorOpcionProductiva,
  ChecklistCotizadorValue,
} from "@/lib/productos-servicios";
import {
  getProductosServicios,
  getProductoVariantes,
  getProductoChecklist,
  getProductoMotorConfig,
  getGranFormatoConfig,
  getGranFormatoRutaBase,
  getGranFormatoVariantes,
  getGranFormatoChecklist,
  cotizarProductoVariante,
  cotizarRigidPrintedByProducto,
  previewGranFormatoCostos,
  previewVinylCutImposicionByProducto,
  getRigidPrintedChecklist,
} from "@/lib/productos-servicios-api";
import { getMateriasPrimas } from "@/lib/materias-primas-api";
import { getMaquinas } from "@/lib/maquinaria-api";
import { tecnologiaMaquinaItems, type Maquina, type MaquinaPerfilOperativo } from "@/lib/maquinaria";
import { ProductoServicioChecklistCotizador } from "@/components/productos-servicios/producto-servicio-checklist";
import { simularPrecioComercial } from "@/lib/productos-servicios-simulacion";
import {
  type PropuestaItem,
  LABEL_TIPO_IMPRESION,
  LABEL_CARAS,
  LABEL_TIPO_COPIA,
  esCantidadFija,
  getCantidadesFijas,
  formatCurrency,
} from "@/lib/propuestas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DigitalLaserConfig,
  type MotorProposalConfigProps,
} from "@/components/comercial/motors/digital-laser-config";
import {
  TalonarioProposalConfigPanel,
  type TalonarioProposalConfig,
} from "@/components/comercial/motors/talonario-proposal-config";
import {
  GranFormatoProposalConfig,
  type GranFormatoMedida,
} from "@/components/comercial/motors/gran-formato-config";
import { RigidPrintedProposalConfig } from "@/components/comercial/motors/rigid-printed-config";
import {
  VinylCutProposalConfig,
  buildDefaultColor,
  type VinylCutColorDraft,
} from "@/components/comercial/motors/vinyl-cut-config";
import type { VinylCutConfig } from "@/lib/productos-servicios";

// ---------------------------------------------------------------------------
// Supported motors
// ---------------------------------------------------------------------------

const SUPPORTED_MOTORS = ["impresion_digital_laser", "gran_formato", "vinilo_de_corte", "talonario", "rigidos_impresos"];

const MOTOR_LABELS: Record<string, string> = {
  impresion_digital_laser: "Digital",
  talonario: "Talonario",
  gran_formato: "Gran Formato",
  vinilo_de_corte: "Vinilo de corte",
  rigidos_impresos: "Rígidos impresos",
};

const motorConfigRegistry: Record<
  string,
  React.ComponentType<MotorProposalConfigProps> | null
> = {
  impresion_digital_laser: DigitalLaserConfig,
  talonario: null,
  gran_formato: null,
  vinilo_de_corte: null,
  rigidos_impresos: null, // TODO: crear panel de propuesta específico
};

// ---------------------------------------------------------------------------
// Helpers: digital laser
// ---------------------------------------------------------------------------

function formatPapelLabel(variante: ProductoVariante): string {
  const attrs = variante.papelAtributos;
  const parts: string[] = [];
  if (attrs?.material) parts.push(attrs.material);
  if (attrs?.acabado) parts.push(attrs.acabado);
  if (attrs?.gramaje) parts.push(`${attrs.gramaje}g`);
  return parts.length > 0 ? parts.join(" ") : (variante.papelNombre ?? "");
}

function buildDigitalEspecificaciones(
  variante: ProductoVariante,
  tipoImpresion: TipoImpresionProductoVariante,
  caras: CarasProductoVariante,
): Record<string, string> {
  const attrs = variante.papelAtributos;
  const parts: string[] = [];
  if (attrs?.material) parts.push(attrs.material);
  if (attrs?.acabado) parts.push(attrs.acabado);
  if (attrs?.gramaje) parts.push(`${attrs.gramaje}g`);
  return {
    Material: parts.length > 0 ? parts.join(" ") : (variante.papelNombre ?? ""),
    Medidas: `${Number(variante.anchoMm) / 10} x ${Number(variante.altoMm) / 10} cm`,
    Impresion: LABEL_TIPO_IMPRESION[tipoImpresion],
    Caras: LABEL_CARAS[caras],
  };
}

// ---------------------------------------------------------------------------
// Helpers: gran formato
// ---------------------------------------------------------------------------

function getTecnologiaLabel(value: string): string {
  return tecnologiaMaquinaItems.find((t) => t.value === value)?.label ?? value;
}

function formatMedidas(medidas: GranFormatoMedida[]): string {
  return medidas
    .filter((m) => m.anchoMm && m.altoMm && m.cantidad > 0)
    .map((m) => `${(m.anchoMm ?? 0) / 10}x${(m.altoMm ?? 0) / 10} cm x${m.cantidad}`)
    .join(", ");
}

function calcGranFormatoCantidad(
  medidas: GranFormatoMedida[],
  unidadComercial: string,
): number {
  let total = 0;
  for (const m of medidas) {
    if (!m.anchoMm || !m.altoMm || m.cantidad <= 0) continue;
    if (unidadComercial === "m2") {
      total += (m.anchoMm * m.altoMm * m.cantidad) / 1_000_000;
    } else if (unidadComercial === "metro_lineal") {
      total += (m.altoMm * m.cantidad) / 1_000;
    } else {
      total += m.cantidad;
    }
  }
  return Math.round(total * 100) / 100;
}

function hasValidMedidas(medidas: GranFormatoMedida[]): boolean {
  return medidas.some(
    (m) =>
      m.anchoMm != null &&
      m.anchoMm > 0 &&
      m.altoMm != null &&
      m.altoMm > 0 &&
      m.cantidad >= 1,
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

type Step = "search" | "variant" | "configure" | "summary";

function hasMotorConfig(variante: ProductoVariante): boolean {
  const ops = variante.opcionesProductivas;
  if (!ops || ops.length === 0) return false;
  return ops.some((o) => o.valores.length > 1);
}

function buildSteps(motorCodigo: string, hasMultipleVariants: boolean): Step[] {
  const steps: Step[] = ["search"];
  if (motorCodigo !== "gran_formato" && motorCodigo !== "vinilo_de_corte" && hasMultipleVariants) {
    steps.push("variant");
  }
  steps.push("configure", "summary");
  return steps;
}

function adaptVarianteForConfig(v: ProductoVariante) {
  return {
    id: v.id,
    nombre: v.nombre,
    anchoMm: Number(v.anchoMm),
    altoMm: Number(v.altoMm),
    papelNombre: v.papelNombre ?? "",
    tipoImpresion: v.tipoImpresion,
    caras: v.caras,
    opcionesProductivas: v.opcionesProductivas ?? null,
  };
}

// ---------------------------------------------------------------------------
// Step: Search
// ---------------------------------------------------------------------------

function StepSearch({
  onSelect,
}: {
  onSelect: (producto: ProductoServicio) => void;
}) {
  const [search, setSearch] = React.useState("");
  const [productos, setProductos] = React.useState<ProductoServicio[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProductosServicios()
      .then((data) => {
        if (!cancelled) {
          setProductos(
            data.filter(
              (p) => p.activo && SUPPORTED_MOTORS.includes(p.motorCodigo),
            ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setProductos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isSearching = search.trim().length > 0;
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q),
    );
  }, [search, productos]);
  const frecuentes = React.useMemo(
    () => productos.slice(0, Math.min(3, productos.length)),
    [productos],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function ProductRow({
    producto,
    compact,
  }: {
    producto: ProductoServicio;
    compact?: boolean;
  }) {
    return (
      <button
        type="button"
        onClick={() => onSelect(producto)}
        className={`flex items-center gap-3 rounded-lg px-3 text-left transition-colors hover:bg-muted ${compact ? "py-2" : "py-2.5"}`}
      >
        <PackageIcon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{producto.nombre}</p>
          <p className="text-xs text-muted-foreground">{producto.codigo}</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-xs">
          {MOTOR_LABELS[producto.motorCodigo] ?? producto.motorCodigo}
        </Badge>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg border border-input px-2.5 py-2">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o codigo..."
          className="h-auto w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoFocus
        />
      </div>
      {isSearching ? (
        <div className="flex flex-col gap-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin resultados</p>
          ) : (
            filtered.map((p) => <ProductRow key={p.id} producto={p} />)
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {frecuentes.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 px-3 py-1">
                <StarIcon className="size-3 text-amber-500" />
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Frecuentes</p>
              </div>
              {frecuentes.map((p) => <ProductRow key={p.id} producto={p} compact />)}
            </div>
          )}
          {productos.length > frecuentes.length && (
            <div className="flex flex-col gap-1">
              <p className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Todos los productos</p>
              {productos.slice(frecuentes.length).map((p) => <ProductRow key={p.id} producto={p} compact />)}
            </div>
          )}
          {productos.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay productos configurados.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Variant (digital only)
// ---------------------------------------------------------------------------

function StepVariant({
  producto,
  variantes,
  onSelect,
}: {
  producto: ProductoServicio;
  variantes: ProductoVariante[];
  onSelect: (variante: ProductoVariante) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Selecciona una variante de{" "}
        <span className="font-medium text-foreground">{producto.nombre}</span>
      </p>
      <div className="flex flex-col gap-2">
        {variantes.filter((v) => v.activo).map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v)}
            className="flex flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <p className="text-sm font-medium">{v.nombre}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{Number(v.anchoMm) / 10} x {Number(v.altoMm) / 10} cm</span>
              {(v.papelAtributos?.material || v.papelNombre) && (
                <>
                  <span>&middot;</span>
                  <span>{formatPapelLabel(v)}</span>
                </>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Configure Digital
// ---------------------------------------------------------------------------

function StepConfigureDigital({
  producto,
  variante,
  config,
  onConfigChange,
  cantidad,
  onCantidadChange,
  checklist,
  checklistRespuestas,
  onChecklistRespuestasChange,
  motorConfigOverride,
}: {
  producto: ProductoServicio;
  variante: ProductoVariante;
  config: { tipoImpresion: TipoImpresionProductoVariante; caras: CarasProductoVariante };
  onConfigChange: (c: { tipoImpresion: TipoImpresionProductoVariante; caras: CarasProductoVariante }) => void;
  cantidad: number;
  onCantidadChange: (c: number) => void;
  checklist: ProductoChecklist | null;
  checklistRespuestas: ChecklistCotizadorValue;
  onChecklistRespuestasChange: (v: ChecklistCotizadorValue) => void;
  motorConfigOverride?: React.ReactNode;
}) {
  const showMotorConfig = hasMotorConfig(variante);
  const MotorConfigPanel = motorConfigRegistry[producto.motorCodigo];
  const precio = producto.precio;
  const fija = precio ? esCantidadFija(precio.metodoCalculo) : false;
  const cantidades = precio ? getCantidadesFijas(precio) : [];
  const hasChecklistQ = checklist?.activo && checklist.preguntas?.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
        <p className="text-sm font-medium">{variante.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {Number(variante.anchoMm) / 10} x {Number(variante.altoMm) / 10} cm
          {(variante.papelAtributos?.material || variante.papelNombre) && ` · ${formatPapelLabel(variante)}`}
        </p>
      </div>

      {motorConfigOverride ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Opciones de produccion</p>
          {motorConfigOverride}
        </div>
      ) : showMotorConfig && MotorConfigPanel ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Opciones de impresion</p>
          <MotorConfigPanel variante={adaptVarianteForConfig(variante)} config={config} onConfigChange={onConfigChange} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cantidad</p>
        {fija ? (
          <div className="grid grid-cols-2 gap-2">
            {cantidades.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onCantidadChange(q)}
                className={`flex items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${cantidad === q ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50 hover:bg-muted/50"}`}
              >
                {q.toLocaleString("es-AR")} {producto.unidadComercial === "unidad" ? "u." : producto.unidadComercial}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input type="number" min={1} value={cantidad || ""} onChange={(e) => onCantidadChange(Number(e.target.value))} placeholder="Cantidad" className="w-full" />
            <span className="shrink-0 text-sm text-muted-foreground">{producto.unidadComercial === "unidad" ? "unidades" : producto.unidadComercial}</span>
          </div>
        )}
      </div>

      {hasChecklistQ && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Opcionales del producto</p>
            <ProductoServicioChecklistCotizador checklist={checklist!} value={checklistRespuestas} onChange={onChecklistRespuestasChange} />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Summary — shared price display
// ---------------------------------------------------------------------------

function PriceBreakdown({
  producto,
  costoTotal,
  cantidad,
  error,
}: {
  producto: ProductoServicio;
  costoTotal: number | null;
  cantidad: number;
  error: string | null;
}) {
  if (error || costoTotal == null) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
        {error ?? "No se pudo calcular el costo de produccion."}
      </div>
    );
  }

  const sim = producto.precio
    ? simularPrecioComercial({ precio: producto.precio, costoTotal, cantidad })
    : null;

  if (sim && sim.status === "disponible" && sim.precioFinal != null) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Costo produccion</span>
          <span className="tabular-nums">{formatCurrency(costoTotal)}</span>
        </div>
        <Separator className="my-0.5" />
        <div className="flex justify-between">
          <span className="text-muted-foreground">Precio unitario</span>
          <span className="tabular-nums">{formatCurrency((sim.precioFinal - (sim.impuestosMonto ?? 0)) / cantidad)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatCurrency(sim.precioFinal - (sim.impuestosMonto ?? 0))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Impuestos ({sim.impuestosPct}%)</span>
          <span className="tabular-nums">{formatCurrency(sim.impuestosMonto ?? 0)}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrency(sim.precioFinal)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Costo produccion</span>
        <span className="tabular-nums">{formatCurrency(costoTotal)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {sim?.reason ?? "No se pudo calcular el precio de venta. Verifica la configuracion de precios del producto."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Summary Digital
// ---------------------------------------------------------------------------

function StepSummaryDigital({
  producto,
  variante,
  config,
  cantidad,
  checklistRespuestas,
  onCostoCalculated,
  onCotizacionCompleta,
}: {
  producto: ProductoServicio;
  variante: ProductoVariante;
  config: { tipoImpresion: TipoImpresionProductoVariante; caras: CarasProductoVariante; tipoCopia?: ValorOpcionProductiva; overrides?: Record<string, unknown> };
  cantidad: number;
  checklistRespuestas: ChecklistCotizadorValue;
  onCostoCalculated: (costo: number | null) => void;
  onCotizacionCompleta: (cot: import("@/lib/productos-servicios").CotizacionProductoVariante | null) => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [costoTotal, setCostoTotal] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const seleccionesBase: Array<{ dimension: DimensionOpcionProductiva; valor: ValorOpcionProductiva }> = [
      { dimension: "tipo_impresion", valor: config.tipoImpresion },
      { dimension: "caras", valor: config.caras },
    ];
    if (config.tipoCopia) {
      seleccionesBase.push({ dimension: "tipo_copia", valor: config.tipoCopia });
    }
    const clPayload = Object.entries(checklistRespuestas)
      .filter(([, v]) => Boolean(v?.respuestaId))
      .map(([preguntaId, v]) => ({
        preguntaId,
        respuestaId: v.respuestaId,
        ...(v.terminacionParams && Object.keys(v.terminacionParams).length > 0
          ? { terminacionParams: v.terminacionParams }
          : {}),
      }));

    // Build parametros with per-order overrides if present
    const parametros = config.overrides && Object.keys(config.overrides).length > 0
      ? config.overrides
      : undefined;

    cotizarProductoVariante(variante.id, {
      cantidad,
      seleccionesBase,
      ...(clPayload.length > 0 ? { checklistRespuestas: clPayload } : {}),
      ...(parametros ? { parametros } : {}),
    })
      .then((cot) => { if (!cancelled) { setCostoTotal(cot.total); onCostoCalculated(cot.total); onCotizacionCompleta(cot); } })
      .catch((err) => { if (!cancelled) { setError(err instanceof Error ? err.message : "Error al cotizar."); onCostoCalculated(null); onCotizacionCompleta(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variante.id, cantidad, config.tipoImpresion, config.caras, config.tipoCopia, JSON.stringify(config.overrides), JSON.stringify(checklistRespuestas)]);

  if (loading) return <div className="flex flex-col items-center justify-center gap-2 py-12"><Loader2Icon className="size-5 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Calculando costos...</p></div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{producto.nombre}</p>
        <p className="text-xs text-muted-foreground">{variante.nombre} &middot; {Number(variante.anchoMm) / 10} x {Number(variante.altoMm) / 10} cm</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{LABEL_TIPO_IMPRESION[config.tipoImpresion]}</Badge>
        <Badge variant="secondary">{LABEL_CARAS[config.caras]}</Badge>
        <Badge variant="secondary">{cantidad.toLocaleString("es-AR")} {producto.unidadComercial === "unidad" ? "u." : producto.unidadComercial}</Badge>
      </div>
      <Separator />
      <PriceBreakdown producto={producto} costoTotal={costoTotal} cantidad={cantidad} error={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Summary Gran Formato
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers: vinyl cut
// ---------------------------------------------------------------------------

function calcVinylCutCantidad(
  colores: VinylCutColorDraft[],
  unidadComercial: string,
): number {
  let total = 0;
  for (const color of colores) {
    for (const m of color.medidas) {
      if (!m.anchoMm || !m.altoMm || m.cantidad <= 0) continue;
      if (unidadComercial === "m2") {
        total += (m.anchoMm * m.altoMm * m.cantidad) / 1_000_000;
      } else if (unidadComercial === "metro_lineal") {
        total += (m.altoMm * m.cantidad) / 1_000;
      } else {
        total += m.cantidad;
      }
    }
  }
  return Math.round(total * 100) / 100;
}

function buildVinylCutEspecificaciones(
  colores: VinylCutColorDraft[],
): Record<string, string> {
  // Medidas por color se muestran en el desglose expandido, no aqui
  return {
    Motor: "Vinilo de corte",
    Colores: String(colores.length),
  };
}

// ---------------------------------------------------------------------------
// Step: Summary Vinyl Cut
// ---------------------------------------------------------------------------

function StepSummaryVinylCut({
  producto,
  config,
  colores,
  onCostoCalculated,
  onCostosResponse,
}: {
  producto: ProductoServicio;
  config: VinylCutConfig;
  colores: VinylCutColorDraft[];
  onCostoCalculated: (costo: number | null) => void;
  onCostosResponse: (res: Record<string, unknown> | null) => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [costoTotal, setCostoTotal] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  const validColores = React.useMemo(
    () =>
      colores
        .filter((c) => c.medidas.some((m) => m.anchoMm && m.altoMm && m.cantidad > 0))
        .map((c) => ({
          id: c.id,
          label: c.label,
          materialVarianteId: null,
          colorFiltro: c.colorFiltro,
          medidas: c.medidas
            .filter((m) => m.anchoMm && m.altoMm && m.cantidad > 0)
            .map((m) => ({
              anchoMm: m.anchoMm!,
              altoMm: m.altoMm!,
              cantidad: m.cantidad,
              rotacionPermitida: config.permitirRotacion,
            })),
        })),
    [colores, config.permitirRotacion],
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const payload = {
      ...config,
      colores: validColores,
    };

    previewVinylCutImposicionByProducto(producto.id, payload)
      .then((res) => {
        if (cancelled) return;
        const aggregated = res.aggregated as Record<string, unknown> | undefined;
        const cost = Number(aggregated?.totalTecnico ?? 0);
        setCostoTotal(cost);
        setWarnings((res.warnings as string[]) ?? []);
        onCostoCalculated(cost);
        onCostosResponse(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error al calcular costos.");
        onCostoCalculated(null);
        onCostosResponse(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto.id, JSON.stringify(validColores)]);

  const cantidadPricing = calcVinylCutCantidad(colores, producto.unidadComercial);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Calculando costos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{producto.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {colores.length} color{colores.length !== 1 ? "es" : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {colores.map((c) => (
          <Badge key={c.id} variant="secondary">
            {c.colorFiltro || c.label}
          </Badge>
        ))}
      </div>
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {warnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      )}
      <Separator />
      <PriceBreakdown producto={producto} costoTotal={costoTotal} cantidad={cantidadPricing} error={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Summary Gran Formato
// ---------------------------------------------------------------------------

function StepSummaryRigidPrinted({
  producto,
  medidas,
  tipoImpresion,
  caras,
  placaVarianteId,
  checklistRespuestas,
  onCostoCalculated,
  onCostosResult,
}: {
  producto: ProductoServicio;
  medidas: Array<{ anchoMm: number | null; altoMm: number | null; cantidad: number }>;
  tipoImpresion: string;
  caras: string;
  placaVarianteId: string;
  checklistRespuestas: ChecklistCotizadorValue;
  onCostoCalculated: (costo: number | null) => void;
  onCostosResult: (res: Record<string, unknown> | null) => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [costoTotal, setCostoTotal] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const validMedidas = React.useMemo(
    () => medidas.filter((m) => m.anchoMm && m.altoMm && m.cantidad > 0)
      .map((m) => ({ anchoMm: m.anchoMm!, altoMm: m.altoMm!, cantidad: m.cantidad })),
    [medidas],
  );

  const cantidadTotal = validMedidas.reduce((s, m) => s + m.cantidad, 0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    cotizarRigidPrintedByProducto(producto.id, {
      cantidad: cantidadTotal,
      parametros: {
        medidas: validMedidas,
        tipoImpresion,
        caras,
        ...(placaVarianteId ? { placaVarianteId } : {}),
      },
    })
      .then((res) => {
        if (!cancelled) {
          const cost = (res as any).total ?? 0;
          setCostoTotal(cost);
          onCostoCalculated(cost);
          onCostosResult(res as unknown as Record<string, unknown>);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al calcular costos.");
          onCostoCalculated(null);
          onCostosResult(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto.id, tipoImpresion, caras, placaVarianteId, JSON.stringify(validMedidas)]);

  const cantidadPricing = calcGranFormatoCantidad(medidas as GranFormatoMedida[], producto.unidadComercial);

  const TIPO_LABELS: Record<string, string> = { directa: "Impresion directa", flexible_montado: "Sustrato flexible montado" };
  const CARAS_LABELS: Record<string, string> = { simple_faz: "Simple faz", doble_faz: "Doble faz" };

  if (loading) return <div className="flex flex-col items-center justify-center gap-2 py-12"><Loader2Icon className="size-5 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Calculando costos...</p></div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{producto.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {TIPO_LABELS[tipoImpresion] ?? tipoImpresion} · {CARAS_LABELS[caras] ?? caras}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{TIPO_LABELS[tipoImpresion] ?? tipoImpresion}</Badge>
        <Badge variant="secondary">{CARAS_LABELS[caras] ?? caras}</Badge>
        <Badge variant="secondary">{formatMedidas(medidas as GranFormatoMedida[])}</Badge>
      </div>
      <Separator />
      <PriceBreakdown producto={producto} costoTotal={costoTotal} cantidad={cantidadPricing} error={error} />
    </div>
  );
}

function StepSummaryGranFormato({
  producto,
  medidas,
  tecnologia,
  selectedPerfilId,
  checklistRespuestas,
  onCostoCalculated,
  onCostosResponse,
}: {
  producto: ProductoServicio;
  medidas: GranFormatoMedida[];
  tecnologia: string;
  selectedPerfilId: string;
  checklistRespuestas: ChecklistCotizadorValue;
  onCostoCalculated: (costo: number | null) => void;
  onCostosResponse: (res: GranFormatoCostosResponse | null) => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [costoTotal, setCostoTotal] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [response, setResponse] = React.useState<GranFormatoCostosResponse | null>(null);

  const validMedidas = React.useMemo(
    () =>
      medidas
        .filter((m) => m.anchoMm && m.altoMm && m.cantidad > 0)
        .map((m) => ({ anchoMm: m.anchoMm!, altoMm: m.altoMm!, cantidad: m.cantidad })),
    [medidas],
  );

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const clPayload = Object.entries(checklistRespuestas)
      .filter(([, v]) => Boolean(v?.respuestaId))
      .map(([preguntaId, v]) => ({
        preguntaId,
        respuestaId: v.respuestaId,
        ...(v.terminacionParams && Object.keys(v.terminacionParams).length > 0
          ? { terminacionParams: v.terminacionParams }
          : {}),
      }));

    previewGranFormatoCostos(producto.id, {
      tecnologia,
      perfilOverrideId: selectedPerfilId || undefined,
      medidas: validMedidas,
      ...(clPayload.length > 0 ? { checklistRespuestas: clPayload } : {}),
    })
      .then((res) => {
        if (!cancelled) {
          const cost = res.totales.tecnico;
          setCostoTotal(cost);
          setResponse(res);
          onCostoCalculated(cost);
          onCostosResponse(res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al calcular costos.");
          onCostoCalculated(null);
          onCostosResponse(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto.id, tecnologia, selectedPerfilId, JSON.stringify(validMedidas), JSON.stringify(checklistRespuestas)]);

  const cantidadPricing = calcGranFormatoCantidad(medidas, producto.unidadComercial);

  if (loading) return <div className="flex flex-col items-center justify-center gap-2 py-12"><Loader2Icon className="size-5 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Calculando costos...</p></div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{producto.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {getTecnologiaLabel(tecnologia)}
          {response?.maquinaNombre && ` · ${response.maquinaNombre}`}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{getTecnologiaLabel(tecnologia)}</Badge>
        <Badge variant="secondary">{formatMedidas(medidas)}</Badge>
      </div>
      {response?.warnings && response.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {response.warnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      )}
      <Separator />
      <PriceBreakdown producto={producto} costoTotal={costoTotal} cantidad={cantidadPricing} error={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Sheet component
// ---------------------------------------------------------------------------

export function AgregarProductoSheet({
  open,
  onOpenChange,
  onAddItem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (item: PropuestaItem) => void;
}) {
  // Shared state
  const [producto, setProducto] = React.useState<ProductoServicio | null>(null);
  const [currentStep, setCurrentStep] = React.useState<Step>("search");
  const [loadingProduct, setLoadingProduct] = React.useState(false);
  const [cotizacionCosto, setCotizacionCosto] = React.useState<number | null>(null);
  const [checklistRespuestas, setChecklistRespuestas] = React.useState<ChecklistCotizadorValue>({});

  // Digital state
  const [variantes, setVariantes] = React.useState<ProductoVariante[]>([]);
  const [variante, setVariante] = React.useState<ProductoVariante | null>(null);
  const [digitalConfig, setDigitalConfig] = React.useState<{ tipoImpresion: TipoImpresionProductoVariante; caras: CarasProductoVariante }>({ tipoImpresion: "cmyk", caras: "simple_faz" });
  const [talonarioConfig, setTalonarioConfig] = React.useState<TalonarioProposalConfig>({ tipoImpresion: "cmyk", caras: "simple_faz", tipoCopia: "duplicado" as ValorOpcionProductiva });
  const [cantidad, setCantidad] = React.useState(0);
  const [checklist, setChecklist] = React.useState<ProductoChecklist | null>(null);
  const [cotizacionCompleta, setCotizacionCompleta] = React.useState<import("@/lib/productos-servicios").CotizacionProductoVariante | null>(null);

  // Gran formato state
  const [gfConfig, setGfConfig] = React.useState<GranFormatoConfig | null>(null);
  const [gfVariantes, setGfVariantes] = React.useState<GranFormatoVariante[]>([]);
  const [gfChecklist, setGfChecklist] = React.useState<GranFormatoChecklistConfig | null>(null);
  const [gfMedidas, setGfMedidas] = React.useState<GranFormatoMedida[]>([{ anchoMm: null, altoMm: null, cantidad: 1 }]);
  const [gfTecnologia, setGfTecnologia] = React.useState("");
  const [gfVarianteId, setGfVarianteId] = React.useState("");
  const [gfPerfilesCompatibles, setGfPerfilesCompatibles] = React.useState<Array<MaquinaPerfilOperativo & { maquinaNombre: string }>>([]);
  const [gfRutaBase, setGfRutaBase] = React.useState<import("@/lib/productos-servicios").GranFormatoRutaBase | null>(null);
  const [gfCostosResponse, setGfCostosResponse] = React.useState<GranFormatoCostosResponse | null>(null);

  // Vinyl cut state
  const [vcConfig, setVcConfig] = React.useState<VinylCutConfig | null>(null);
  const [vcColorOptions, setVcColorOptions] = React.useState<string[]>([]);
  const [vcColores, setVcColores] = React.useState<VinylCutColorDraft[]>([buildDefaultColor(0)]);
  const [vcCostosResponse, setVcCostosResponse] = React.useState<Record<string, unknown> | null>(null);

  // ── Rígidos Impresos state ──
  const [rpConfig, setRpConfig] = React.useState<Record<string, unknown> | null>(null);
  const [rpMedidas, setRpMedidas] = React.useState<Array<{ anchoMm: number | null; altoMm: number | null; cantidad: number }>>([{ anchoMm: null, altoMm: null, cantidad: 1 }]);
  const [rpTipoImpresion, setRpTipoImpresion] = React.useState("");
  const [rpPlacaVarianteId, setRpPlacaVarianteId] = React.useState("");
  const [rpCaras, setRpCaras] = React.useState("simple_faz");
  const [rpChecklist, setRpChecklist] = React.useState<import("@/lib/productos-servicios").RigidPrintedChecklistConfig | null>(null);
  const [rpPlacasCompatibles, setRpPlacasCompatibles] = React.useState<Array<{ id: string; anchoMm: number; altoMm: number; precio: number; label: string; espesor: string | null; color: string | null }>>([]);
  const [rpCostosResult, setRpCostosResult] = React.useState<Record<string, unknown> | null>(null);

  const motorCodigo = producto?.motorCodigo ?? "";
  const isGranFormato = motorCodigo === "gran_formato";
  const isViniloCut = motorCodigo === "vinilo_de_corte";
  const isTalonario = motorCodigo === "talonario";
  const isRigidosPrinted = motorCodigo === "rigidos_impresos";

  const steps = React.useMemo(
    () => buildSteps(motorCodigo, variantes.filter((v) => v.activo).length > 1),
    [motorCodigo, variantes],
  );

  const isFirstStep = steps.indexOf(currentStep) === 0;
  const isLastStep = currentStep === "summary";

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      setProducto(null);
      setCurrentStep("search");
      setLoadingProduct(false);
      setCotizacionCosto(null);
      setChecklistRespuestas({});
      // Digital
      setVariantes([]);
      setVariante(null);
      setDigitalConfig({ tipoImpresion: "cmyk", caras: "simple_faz" });
      setCantidad(0);
      setChecklist(null);
      setCotizacionCompleta(null);
      // Gran formato
      setGfConfig(null);
      setGfVariantes([]);
      setGfChecklist(null);
      setGfMedidas([{ anchoMm: null, altoMm: null, cantidad: 1 }]);
      setGfTecnologia("");
      setGfVarianteId("");
      setGfPerfilesCompatibles([]);
      setGfRutaBase(null);
      setGfCostosResponse(null);
    }
  }, [open]);

  function goNext() {
    const idx = steps.indexOf(currentStep);
    if (idx < steps.length - 1) setCurrentStep(steps[idx + 1]);
  }
  function goBack() {
    const idx = steps.indexOf(currentStep);
    if (idx > 0) setCurrentStep(steps[idx - 1]);
  }

  function selectVarianteAndAdvance(v: ProductoVariante) {
    setVariante(v);
    setDigitalConfig({ tipoImpresion: v.tipoImpresion, caras: v.caras });
    setCantidad(0);
    setCurrentStep("configure");
  }

  async function handleSelectProducto(p: ProductoServicio) {
    setProducto(p);
    setCotizacionCosto(null);
    setChecklistRespuestas({});
    setLoadingProduct(true);

    try {
      if (p.motorCodigo === "vinilo_de_corte") {
        const [motorConfig, materiasPrimas] = await Promise.all([
          getProductoMotorConfig(p.id),
          getMateriasPrimas(),
        ]);
        const config = motorConfig.parametros as unknown as VinylCutConfig;
        setVcConfig(config);

        // Extract color options from compatible material variants
        const compatibleIds = new Set(config.materialesCompatibles ?? []);
        const colorSet = new Set<string>();
        for (const mp of materiasPrimas) {
          if (!mp.activo || !compatibleIds.has(mp.id)) continue;
          for (const v of mp.variantes) {
            if (!v.activo) continue;
            const color = typeof v.atributosVariante?.color === "string"
              ? v.atributosVariante.color.trim()
              : "";
            if (color) colorSet.add(color);
          }
        }
        const colors = Array.from(colorSet).sort();
        setVcColorOptions(colors);

        // Initialize with one default color
        setVcColores([buildDefaultColor(0)]);
        setVcCostosResponse(null);
        setCurrentStep("configure");
      } else if (p.motorCodigo === "gran_formato") {
        const [cfg, vars, cl, maquinas, rutaBase] = await Promise.all([
          getGranFormatoConfig(p.id),
          getGranFormatoVariantes(p.id).catch(() => [] as GranFormatoVariante[]),
          getGranFormatoChecklist(p.id).catch(() => null),
          getMaquinas().catch(() => [] as Maquina[]),
          getGranFormatoRutaBase(p.id).catch(() => null),
        ]);
        setGfConfig(cfg);
        setGfVariantes(vars);
        setGfChecklist(cl);
        setGfRutaBase(rutaBase);

        // Build perfiles from compatible machines + profiles
        const perfilesSet = new Set(cfg.perfilesCompatibles);
        const perfiles: Array<MaquinaPerfilOperativo & { maquinaNombre: string }> = [];
        for (const maq of maquinas) {
          if (!cfg.maquinasCompatibles.includes(maq.id)) continue;
          for (const perfil of maq.perfilesOperativos) {
            if (perfilesSet.has(perfil.id) && perfil.activo) {
              perfiles.push({ ...perfil, maquinaNombre: maq.nombre });
            }
          }
        }
        setGfPerfilesCompatibles(perfiles);
        setGfMedidas([{ anchoMm: null, altoMm: null, cantidad: 1 }]);

        // Resolve default technology + profile from ruta base
        const defaultTec = cfg.imposicion?.tecnologiaDefault
          ?? (cfg.tecnologiasCompatibles.length === 1 ? cfg.tecnologiasCompatibles[0] : "");
        setGfTecnologia(defaultTec);

        // Find default profile from ruta base's regla for this technology
        const reglaDefault = defaultTec && rutaBase
          ? rutaBase.reglasImpresion.find((r) => r.tecnologia === defaultTec)
          : null;
        const defaultPerfilId = reglaDefault?.perfilOperativoDefaultId ?? "";
        // Only set if the profile is in the compatible list
        setGfVarianteId(
          defaultPerfilId && perfiles.some((p) => p.id === defaultPerfilId)
            ? defaultPerfilId
            : "",
        );
        setCurrentStep("configure");
      } else if (p.motorCodigo === "rigidos_impresos") {
        const [cfgResult, cl, rpMateriasPrimas] = await Promise.all([
          getProductoMotorConfig(p.id).catch(() => null),
          getRigidPrintedChecklist(p.id).catch(() => null),
          getMateriasPrimas().catch(() => []),
        ]);
        const params = (cfgResult?.parametros ?? {}) as Record<string, unknown>;
        setRpConfig(params);
        setRpChecklist(cl);
        setRpMedidas([{ anchoMm: null, altoMm: null, cantidad: 1 }]);
        setRpCostosResult(null);

        // Resolve placas compatibles
        const matId = params.materialRigidoId ? String(params.materialRigidoId) : null;
        const varIds = new Set(Array.isArray(params.variantesCompatibles) ? params.variantesCompatibles as string[] : []);
        const mat = matId ? rpMateriasPrimas.find((m: any) => m.id === matId) : null;
        const placas: Array<{ id: string; anchoMm: number; altoMm: number; precio: number; label: string; espesor: string | null; color: string | null }> = [];
        if (mat && (mat as any).variantes) {
          for (const v of (mat as any).variantes) {
            if (!varIds.has(v.id)) continue;
            const attrs = (v.atributosVariante ?? {}) as Record<string, unknown>;
            const anchoRaw = Number(attrs.ancho ?? 0);
            const altoRaw = Number(attrs.alto ?? 0);
            const anchoMm = anchoRaw < 10 ? Math.round(anchoRaw * 1000) : anchoRaw;
            const altoMm = altoRaw < 10 ? Math.round(altoRaw * 1000) : altoRaw;
            placas.push({
              id: v.id,
              anchoMm, altoMm,
              precio: Number(v.precioReferencia ?? 0),
              label: `${anchoMm} x ${altoMm} mm`,
              espesor: attrs.espesor ? `${attrs.espesor}mm` : null,
              color: typeof attrs.color === "string" ? attrs.color : null,
            });
          }
        }
        setRpPlacasCompatibles(placas);
        setRpPlacaVarianteId(String(params.placaVarianteIdDefault ?? placas[0]?.id ?? ""));

        // Defaults
        const tipos = Array.isArray(params.tiposImpresion) ? params.tiposImpresion as string[] : [];
        setRpTipoImpresion(tipos[0] ?? "directa");
        const firstTipoCfg = (tipos[0] === "flexible_montado" ? params.flexibleMontado : params.impresionDirecta) as Record<string, unknown> | undefined;
        setRpCaras(String(firstTipoCfg?.carasDefault ?? params.carasDefault ?? "simple_faz"));

        setCurrentStep("configure");
      } else {
        // Digital laser
        const [vars, cl] = await Promise.all([
          getProductoVariantes(p.id),
          getProductoChecklist(p.id).catch(() => null),
        ]);
        const activeVars = vars.filter((v) => v.activo);
        setVariantes(vars);
        setChecklist(cl);
        if (activeVars.length === 1) {
          selectVarianteAndAdvance(activeVars[0]);
        } else if (activeVars.length === 0) {
          setCurrentStep("search");
        } else {
          setVariante(null);
          setCurrentStep("variant");
        }
      }
    } catch {
      setCurrentStep("search");
    } finally {
      setLoadingProduct(false);
    }
  }

  function handleConfirm() {
    if (!producto || cotizacionCosto == null) return;

    const precio = producto.precio;
    const isGF = producto.motorCodigo === "gran_formato";
    const isVC = producto.motorCodigo === "vinilo_de_corte";
    const isTalonario = producto.motorCodigo === "talonario";
    const isRP = producto.motorCodigo === "rigidos_impresos";

    const cantidadFinal = isGF
      ? calcGranFormatoCantidad(gfMedidas, producto.unidadComercial)
      : isVC
        ? calcVinylCutCantidad(vcColores, producto.unidadComercial)
        : isRP
          ? calcGranFormatoCantidad(rpMedidas as GranFormatoMedida[], producto.unidadComercial)
          : cantidad;

    if (cantidadFinal <= 0) return;

    const sim = precio
      ? simularPrecioComercial({ precio, costoTotal: cotizacionCosto, cantidad: cantidadFinal })
      : null;

    const precioFinal = sim?.precioFinal ?? 0;
    const impuestosPct = sim?.impuestosPct ?? 0;
    const impuestosMonto = sim?.impuestosMonto ?? 0;
    const subtotalSinImpuestos = precioFinal - impuestosMonto;

    const selectedGfPerfil = gfPerfilesCompatibles.find((p) => p.id === gfVarianteId) ?? null;
    const perfilDetalle = selectedGfPerfil?.detalle as Record<string, unknown> | null;
    const confTintas = typeof perfilDetalle?.configuracionTintas === "string" ? perfilDetalle.configuracionTintas : "";

    const item: PropuestaItem = {
      id: crypto.randomUUID(),
      productoId: producto.id,
      productoNombre: producto.nombre,
      productoCodigo: producto.codigo,
      motorCodigo: producto.motorCodigo,
      unidadMedida: producto.unidadComercial as "unidad" | "m2" | "metro_lineal",
      cantidad: cantidadFinal,
      precioUnitario: cantidadFinal > 0 ? subtotalSinImpuestos / cantidadFinal : 0,
      subtotal: subtotalSinImpuestos,
      impuestoPorcentaje: impuestosPct,
      impuestoMonto: impuestosMonto,
      total: precioFinal,
      precioConfig: precio ?? undefined,
      cotizacion: (isGF || isVC || isRP) ? null : cotizacionCompleta,
      especificaciones: isRP
        ? {
            "Tipo impresion": { directa: "Impresion directa", flexible_montado: "Sustrato flexible montado" }[rpTipoImpresion] ?? rpTipoImpresion,
            Caras: { simple_faz: "Simple faz", doble_faz: "Doble faz" }[rpCaras] ?? rpCaras,
            ...(rpPlacasCompatibles.find((p) => p.id === rpPlacaVarianteId)
              ? { Placa: rpPlacasCompatibles.find((p) => p.id === rpPlacaVarianteId)!.label }
              : {}),
            Medidas: formatMedidas(rpMedidas as GranFormatoMedida[]),
          }
        : isGF
        ? {
            Tecnologia: getTecnologiaLabel(gfTecnologia),
            ...(confTintas
              ? { "Modo impresion": confTintas }
              : {}),
            ...(selectedGfPerfil
              ? { Perfil: selectedGfPerfil.nombre }
              : {}),
            Medidas: formatMedidas(gfMedidas),
            ...(gfCostosResponse?.maquinaNombre
              ? { Maquina: gfCostosResponse.maquinaNombre }
              : {}),
          }
        : isVC
          ? buildVinylCutEspecificaciones(vcColores)
          : isTalonario && variante
            ? {
                Medidas: talonarioConfig.overrides?.anchoMm && talonarioConfig.overrides?.altoMm
                  ? `${talonarioConfig.overrides.anchoMm / 10} x ${talonarioConfig.overrides.altoMm / 10} cm *`
                  : `${Number(variante.anchoMm) / 10} x ${Number(variante.altoMm) / 10} cm`,
                Impresion: LABEL_TIPO_IMPRESION[talonarioConfig.tipoImpresion],
                Caras: LABEL_CARAS[talonarioConfig.caras],
                "Tipo de copia": LABEL_TIPO_COPIA[talonarioConfig.tipoCopia] ?? talonarioConfig.tipoCopia,
                ...(talonarioConfig.overrides ? { "Ajustes": "Personalizado" } : {}),
              }
          : variante
            ? buildDigitalEspecificaciones(variante, digitalConfig.tipoImpresion, digitalConfig.caras)
            : {},
      // Digital / Talonario specific
      ...(!isGF && !isVC
        ? {
            varianteId: variante?.id,
            varianteNombre: variante?.nombre,
            tipoImpresion: isTalonario ? talonarioConfig.tipoImpresion : digitalConfig.tipoImpresion,
            caras: isTalonario ? talonarioConfig.caras : digitalConfig.caras,
            ...(isTalonario ? { tipoCopia: talonarioConfig.tipoCopia } : {}),
            ...(isTalonario && talonarioConfig.overrides ? { talonarioOverrides: talonarioConfig.overrides as Record<string, unknown> } : {}),
            anchoMm: isTalonario && talonarioConfig.overrides?.anchoMm
              ? talonarioConfig.overrides.anchoMm
              : variante ? Number(variante.anchoMm) : undefined,
            altoMm: isTalonario && talonarioConfig.overrides?.altoMm
              ? talonarioConfig.overrides.altoMm
              : variante ? Number(variante.altoMm) : undefined,
          }
        : {}),
      // Gran formato-specific
      ...(isGF && gfCostosResponse
        ? {
            granFormato: {
              tecnologia: gfTecnologia,
              medidas: gfMedidas
                .filter((m) => m.anchoMm && m.altoMm && m.cantidad > 0)
                .map((m) => ({ anchoMm: m.anchoMm!, altoMm: m.altoMm!, cantidad: m.cantidad })),
              costosResponse: gfCostosResponse,
            },
          }
        : {}),
      // Vinyl cut-specific
      ...(isVC && vcCostosResponse
        ? {
            viniloCut: {
              colores: vcColores
                .filter((c) => c.medidas.some((m) => m.anchoMm && m.altoMm && m.cantidad > 0))
                .map((c) => ({
                  id: c.id,
                  label: c.label,
                  colorFiltro: c.colorFiltro,
                  medidas: c.medidas
                    .filter((m) => m.anchoMm && m.altoMm && m.cantidad > 0)
                    .map((m) => ({ anchoMm: m.anchoMm!, altoMm: m.altoMm!, cantidad: m.cantidad })),
                })),
              costosResponse: vcCostosResponse,
            },
          }
        : {}),
      // Rigidos impresos-specific
      ...(isRP && rpCostosResult
        ? {
            rigidosPrinted: {
              tipoImpresion: rpTipoImpresion,
              caras: rpCaras,
              placaVarianteId: rpPlacaVarianteId,
              medidas: rpMedidas
                .filter((m) => m.anchoMm && m.altoMm && m.cantidad > 0)
                .map((m) => ({ anchoMm: m.anchoMm!, altoMm: m.altoMm!, cantidad: m.cantidad })),
              cotizacionResult: rpCostosResult,
            },
          }
        : {}),
    };

    onAddItem(item);
  }

  // canContinue
  const canContinue = (() => {
    if (currentStep !== "configure") return false;
    if (isGranFormato) {
      return hasValidMedidas(gfMedidas) && gfTecnologia !== "";
    }
    if (isViniloCut) {
      return vcColores.length > 0 && vcColores.every(
        (c) => c.colorFiltro && c.medidas.some((m) => m.anchoMm && m.anchoMm > 0 && m.altoMm && m.altoMm > 0 && m.cantidad > 0),
      );
    }
    if (isRigidosPrinted) {
      return hasValidMedidas(rpMedidas as GranFormatoMedida[]) && rpTipoImpresion !== "";
    }
    return cantidad > 0;
  })();

  const stepTitles: Record<Step, string> = {
    search: "Buscar producto",
    variant: "Elegir variante",
    configure: "Configurar",
    summary: "Resumen",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:!max-w-xl">
        <SheetHeader>
          <SheetTitle>Agregar producto</SheetTitle>
          <SheetDescription>
            {producto ? `${producto.nombre} — ${stepTitles[currentStep]}` : stepTitles[currentStep]}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {loadingProduct ? (
            <div className="flex items-center justify-center py-12">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {currentStep === "search" && <StepSearch onSelect={handleSelectProducto} />}

              {currentStep === "variant" && producto && (
                <StepVariant producto={producto} variantes={variantes} onSelect={selectVarianteAndAdvance} />
              )}

              {currentStep === "configure" && producto && isGranFormato && gfConfig && (
                <GranFormatoProposalConfig
                  producto={producto}
                  config={gfConfig}
                  perfilesCompatibles={gfPerfilesCompatibles}
                  checklistConfig={gfChecklist}
                  medidas={gfMedidas}
                  onMedidasChange={setGfMedidas}
                  tecnologia={gfTecnologia}
                  onTecnologiaChange={(t) => {
                    setGfTecnologia(t);
                    setChecklistRespuestas({});
                    // Auto-select default profile for this technology from ruta base
                    const regla = gfRutaBase?.reglasImpresion.find((r) => r.tecnologia === t);
                    const defaultId = regla?.perfilOperativoDefaultId ?? "";
                    setGfVarianteId(
                      defaultId && gfPerfilesCompatibles.some((p) => p.id === defaultId)
                        ? defaultId
                        : "",
                    );
                  }}
                  selectedPerfilId={gfVarianteId}
                  onSelectedPerfilIdChange={setGfVarianteId}
                  checklistRespuestas={checklistRespuestas}
                  onChecklistRespuestasChange={setChecklistRespuestas}
                />
              )}

              {currentStep === "configure" && producto && isViniloCut && vcConfig && (
                <VinylCutProposalConfig
                  config={vcConfig}
                  colorOptions={vcColorOptions}
                  colores={vcColores}
                  onColoresChange={setVcColores}
                />
              )}

              {currentStep === "configure" && producto && isRigidosPrinted && rpConfig && (
                <RigidPrintedProposalConfig
                  producto={producto}
                  config={rpConfig as any}
                  placasCompatibles={rpPlacasCompatibles}
                  checklistConfig={rpChecklist}
                  medidas={rpMedidas}
                  onMedidasChange={setRpMedidas}
                  tipoImpresion={rpTipoImpresion}
                  onTipoImpresionChange={setRpTipoImpresion}
                  placaVarianteId={rpPlacaVarianteId}
                  onPlacaVarianteIdChange={setRpPlacaVarianteId}
                  caras={rpCaras}
                  onCarasChange={setRpCaras}
                  checklistRespuestas={checklistRespuestas}
                  onChecklistRespuestasChange={setChecklistRespuestas}
                />
              )}

              {currentStep === "configure" && producto && !isGranFormato && !isViniloCut && !isTalonario && !isRigidosPrinted && variante && (
                <StepConfigureDigital
                  producto={producto}
                  variante={variante}
                  config={digitalConfig}
                  onConfigChange={setDigitalConfig}
                  cantidad={cantidad}
                  onCantidadChange={setCantidad}
                  checklist={checklist}
                  checklistRespuestas={checklistRespuestas}
                  onChecklistRespuestasChange={setChecklistRespuestas}
                />
              )}

              {currentStep === "configure" && producto && isTalonario && variante && (
                <StepConfigureDigital
                  producto={producto}
                  variante={variante}
                  config={talonarioConfig}
                  onConfigChange={(c) => setTalonarioConfig((prev) => ({ ...prev, ...c }))}
                  cantidad={cantidad}
                  onCantidadChange={setCantidad}
                  checklist={checklist}
                  checklistRespuestas={checklistRespuestas}
                  onChecklistRespuestasChange={setChecklistRespuestas}
                  motorConfigOverride={
                    <TalonarioProposalConfigPanel
                      variante={variante}
                      config={talonarioConfig}
                      onConfigChange={setTalonarioConfig}
                    />
                  }
                />
              )}

              {currentStep === "summary" && producto && isViniloCut && vcConfig && (
                <StepSummaryVinylCut
                  producto={producto}
                  config={vcConfig}
                  colores={vcColores}
                  onCostoCalculated={setCotizacionCosto}
                  onCostosResponse={setVcCostosResponse}
                />
              )}

              {currentStep === "summary" && producto && !isGranFormato && !isViniloCut && !isTalonario && !isRigidosPrinted && variante && (
                <StepSummaryDigital
                  producto={producto}
                  variante={variante}
                  config={digitalConfig}
                  cantidad={cantidad}
                  checklistRespuestas={checklistRespuestas}
                  onCostoCalculated={setCotizacionCosto}
                  onCotizacionCompleta={setCotizacionCompleta}
                />
              )}

              {currentStep === "summary" && producto && isTalonario && variante && (
                <StepSummaryDigital
                  producto={producto}
                  variante={variante}
                  config={talonarioConfig}
                  cantidad={cantidad}
                  checklistRespuestas={checklistRespuestas}
                  onCostoCalculated={setCotizacionCosto}
                  onCotizacionCompleta={setCotizacionCompleta}
                />
              )}

              {currentStep === "summary" && producto && isGranFormato && (
                <StepSummaryGranFormato
                  producto={producto}
                  medidas={gfMedidas}
                  tecnologia={gfTecnologia}
                  selectedPerfilId={gfVarianteId}
                  checklistRespuestas={checklistRespuestas}
                  onCostoCalculated={setCotizacionCosto}
                  onCostosResponse={setGfCostosResponse}
                />
              )}

              {currentStep === "summary" && producto && isRigidosPrinted && (
                <StepSummaryRigidPrinted
                  producto={producto}
                  medidas={rpMedidas}
                  tipoImpresion={rpTipoImpresion}
                  caras={rpCaras}
                  placaVarianteId={rpPlacaVarianteId}
                  checklistRespuestas={checklistRespuestas}
                  onCostoCalculated={setCotizacionCosto}
                  onCostosResult={setRpCostosResult}
                />
              )}
            </>
          )}
        </div>

        <SheetFooter className="flex-row justify-between border-t pt-4">
          {!isFirstStep ? (
            <Button variant="outline" size="sm" onClick={goBack}>
              <ArrowLeftIcon />
              Volver
            </Button>
          ) : <div />}

          {currentStep !== "search" && currentStep !== "variant" && (
            isLastStep ? (
              <Button size="sm" onClick={handleConfirm}>
                <CheckIcon />
                Agregar
              </Button>
            ) : (
              <Button size="sm" onClick={goNext} disabled={!canContinue}>
                Continuar
              </Button>
            )
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
