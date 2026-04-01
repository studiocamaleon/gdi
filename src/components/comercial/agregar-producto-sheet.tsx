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
  TipoImpresionProductoVariante,
  CarasProductoVariante,
  DimensionOpcionProductiva,
  ValorOpcionProductiva,
} from "@/lib/productos-servicios";
import {
  getProductosServicios,
  getProductoVariantes,
  getProductoChecklist,
  cotizarProductoVariante,
} from "@/lib/productos-servicios-api";
import { ProductoServicioChecklistCotizador } from "@/components/productos-servicios/producto-servicio-checklist";
import { simularPrecioComercial } from "@/lib/productos-servicios-simulacion";
import {
  type PropuestaItem,
  LABEL_TIPO_IMPRESION,
  LABEL_CARAS,
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

// ---------------------------------------------------------------------------
// Motor config registry (extensible)
// ---------------------------------------------------------------------------

const motorConfigRegistry: Record<
  string,
  React.ComponentType<MotorProposalConfigProps> | null
> = {
  impresion_digital_laser: DigitalLaserConfig,
  gran_formato: null,
  vinilo_de_corte: null,
};

// ---------------------------------------------------------------------------
// Build item especificaciones from real data
// ---------------------------------------------------------------------------

function formatPapelLabel(variante: ProductoVariante): string {
  const attrs = variante.papelAtributos;
  const parts: string[] = [];
  if (attrs?.material) parts.push(attrs.material);
  if (attrs?.acabado) parts.push(attrs.acabado);
  if (attrs?.gramaje) parts.push(`${attrs.gramaje}g`);
  return parts.length > 0 ? parts.join(" ") : (variante.papelNombre ?? "");
}

function buildItemEspecificaciones(
  variante: ProductoVariante,
  tipoImpresion: TipoImpresionProductoVariante,
  caras: CarasProductoVariante,
): Record<string, string> {
  // Build material label from paper variant attributes (material, acabado, gramaje)
  const attrs = variante.papelAtributos;
  const parts: string[] = [];
  if (attrs?.material) parts.push(attrs.material);
  if (attrs?.acabado) parts.push(attrs.acabado);
  if (attrs?.gramaje) parts.push(`${attrs.gramaje}g`);

  const materialLabel =
    parts.length > 0 ? parts.join(" ") : (variante.papelNombre ?? "");

  return {
    Material: materialLabel,
    Medidas: `${Number(variante.anchoMm) / 10} x ${Number(variante.altoMm) / 10} cm`,
    Impresion: LABEL_TIPO_IMPRESION[tipoImpresion],
    Caras: LABEL_CARAS[caras],
  };
}

// ---------------------------------------------------------------------------
// Step types
// ---------------------------------------------------------------------------

type Step = "search" | "variant" | "configure" | "summary";

function hasMotorConfig(variante: ProductoVariante): boolean {
  const ops = variante.opcionesProductivas;
  if (!ops || ops.length === 0) return false;
  return ops.some((o) => o.valores.length > 1);
}

function buildSteps(hasMultipleVariants: boolean): Step[] {
  const steps: Step[] = ["search"];
  if (hasMultipleVariants) steps.push("variant");
  steps.push("configure", "summary");
  return steps;
}

// ---------------------------------------------------------------------------
// Adapt ProductoVariante to CatalogoVariante shape for motor config panel
// ---------------------------------------------------------------------------

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
// Step: Search (loads products from API)
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
          // Filter only active digital laser products for now
          const filtered = data.filter(
            (p) =>
              p.activo &&
              p.motorCodigo === "impresion_digital_laser",
          );
          setProductos(filtered);
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

  // "Frecuentes" = first N products (placeholder until real usage tracking)
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
          Digital
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
        /* Search results */
        <div className="flex flex-col gap-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin resultados
            </p>
          ) : (
            filtered.map((p) => <ProductRow key={p.id} producto={p} />)
          )}
        </div>
      ) : (
        /* Default view: Frecuentes + Todos */
        <div className="flex flex-col gap-4">
          {frecuentes.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 px-3 py-1">
                <StarIcon className="size-3 text-amber-500" />
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Frecuentes
                </p>
              </div>
              {frecuentes.map((p) => (
                <ProductRow key={p.id} producto={p} compact />
              ))}
            </div>
          )}

          {productos.length > frecuentes.length && (
            <div className="flex flex-col gap-1">
              <p className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Todos los productos
              </p>
              {productos.slice(frecuentes.length).map((p) => (
                <ProductRow key={p.id} producto={p} compact />
              ))}
            </div>
          )}

          {productos.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay productos de impresion digital configurados.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Variant
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
        {variantes
          .filter((v) => v.activo)
          .map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v)}
              className="flex flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
            >
              <p className="text-sm font-medium">{v.nombre}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {Number(v.anchoMm) / 10} x {Number(v.altoMm) / 10} cm
                </span>
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
// Step: Configure (motor options + quantity in one step)
// ---------------------------------------------------------------------------

function StepConfigure({
  producto,
  variante,
  config,
  onConfigChange,
  cantidad,
  onCantidadChange,
  checklist,
  checklistRespuestas,
  onChecklistRespuestasChange,
}: {
  producto: ProductoServicio;
  variante: ProductoVariante;
  config: {
    tipoImpresion: TipoImpresionProductoVariante;
    caras: CarasProductoVariante;
  };
  onConfigChange: (c: {
    tipoImpresion: TipoImpresionProductoVariante;
    caras: CarasProductoVariante;
  }) => void;
  cantidad: number;
  onCantidadChange: (c: number) => void;
  checklist: ProductoChecklist | null;
  checklistRespuestas: Record<string, { respuestaId: string }>;
  onChecklistRespuestasChange: (v: Record<string, { respuestaId: string }>) => void;
}) {
  const showMotorConfig = hasMotorConfig(variante);
  const MotorConfigPanel = motorConfigRegistry[producto.motorCodigo];
  const precio = producto.precio;
  const fija = precio ? esCantidadFija(precio.metodoCalculo) : false;
  const cantidades = precio ? getCantidadesFijas(precio) : [];
  const hasChecklist =
    checklist?.activo &&
    checklist.preguntas &&
    checklist.preguntas.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Variant info */}
      <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
        <p className="text-sm font-medium">{variante.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {Number(variante.anchoMm) / 10} x {Number(variante.altoMm) / 10} cm
          {(variante.papelAtributos?.material || variante.papelNombre) &&
            ` · ${formatPapelLabel(variante)}`}
        </p>
      </div>

      {/* Motor-specific config */}
      {showMotorConfig && MotorConfigPanel && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Opciones de impresion
          </p>
          <MotorConfigPanel
            variante={adaptVarianteForConfig(variante)}
            config={config}
            onConfigChange={onConfigChange}
          />
        </div>
      )}

      {/* Quantity */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Cantidad
        </p>

        {fija ? (
          <div className="grid grid-cols-2 gap-2">
            {cantidades.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onCantidadChange(q)}
                className={`flex items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  cantidad === q
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                {q.toLocaleString("es-AR")}{" "}
                {producto.unidadComercial === "unidad"
                  ? "u."
                  : producto.unidadComercial}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={cantidad || ""}
              onChange={(e) => onCantidadChange(Number(e.target.value))}
              placeholder="Cantidad"
              className="w-full"
            />
            <span className="shrink-0 text-sm text-muted-foreground">
              {producto.unidadComercial === "unidad"
                ? "unidades"
                : producto.unidadComercial}
            </span>
          </div>
        )}
      </div>

      {/* Separator + Checklist (opcionales) — after base config */}
      {hasChecklist && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Opcionales del producto
            </p>
            <ProductoServicioChecklistCotizador
              checklist={checklist}
              value={checklistRespuestas}
              onChange={onChecklistRespuestasChange}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Summary (uses real cotización API)
// ---------------------------------------------------------------------------

function StepSummary({
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
  config: {
    tipoImpresion: TipoImpresionProductoVariante;
    caras: CarasProductoVariante;
  };
  cantidad: number;
  checklistRespuestas: Record<string, { respuestaId: string }>;
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

    const seleccionesBase: Array<{
      dimension: DimensionOpcionProductiva;
      valor: ValorOpcionProductiva;
    }> = [
      { dimension: "tipo_impresion", valor: config.tipoImpresion },
      { dimension: "caras", valor: config.caras },
    ];

    const checklistPayload = Object.entries(checklistRespuestas)
      .filter(([, v]) => Boolean(v?.respuestaId))
      .map(([preguntaId, v]) => ({
        preguntaId,
        respuestaId: v.respuestaId,
      }));

    cotizarProductoVariante(variante.id, {
      cantidad,
      seleccionesBase,
      ...(checklistPayload.length > 0
        ? { checklistRespuestas: checklistPayload }
        : {}),
    })
      .then((cot) => {
        if (!cancelled) {
          setCostoTotal(cot.total);
          onCostoCalculated(cot.total);
          onCotizacionCompleta(cot);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Error al cotizar el producto.",
          );
          onCostoCalculated(null);
          onCotizacionCompleta(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variante.id, cantidad, config.tipoImpresion, config.caras, JSON.stringify(checklistRespuestas)]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Calculando costos...</p>
      </div>
    );
  }

  if (error || costoTotal == null) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{producto.nombre}</p>
          <p className="text-xs text-muted-foreground">
            {variante.nombre}
          </p>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          {error ?? "No se pudo calcular el costo de produccion."}
        </div>
      </div>
    );
  }

  const sim = producto.precio
    ? simularPrecioComercial({
        precio: producto.precio,
        costoTotal,
        cantidad,
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Product info */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{producto.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {variante.nombre} &middot; {Number(variante.anchoMm) / 10} x{" "}
          {Number(variante.altoMm) / 10} cm
        </p>
      </div>

      {/* Config badges */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">
          {LABEL_TIPO_IMPRESION[config.tipoImpresion]}
        </Badge>
        <Badge variant="secondary">{LABEL_CARAS[config.caras]}</Badge>
        <Badge variant="secondary">
          {cantidad.toLocaleString("es-AR")}{" "}
          {producto.unidadComercial === "unidad"
            ? "u."
            : producto.unidadComercial}
        </Badge>
      </div>

      <Separator />

      {/* Price breakdown */}
      {sim && sim.status === "disponible" && sim.precioFinal != null ? (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Costo produccion</span>
            <span className="tabular-nums">{formatCurrency(costoTotal)}</span>
          </div>
          <Separator className="my-0.5" />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Precio unitario</span>
            <span className="tabular-nums">
              {formatCurrency(
                (sim.precioFinal - (sim.impuestosMonto ?? 0)) / cantidad,
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">
              {formatCurrency(
                sim.precioFinal - (sim.impuestosMonto ?? 0),
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Impuestos ({sim.impuestosPct}%)
            </span>
            <span className="tabular-nums">
              {formatCurrency(sim.impuestosMonto ?? 0)}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">
              {formatCurrency(sim.precioFinal)}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Costo produccion</span>
            <span className="tabular-nums">{formatCurrency(costoTotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {sim?.reason ??
              "No se pudo calcular el precio de venta. Verifica la configuracion de precios del producto."}
          </p>
        </div>
      )}
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
  const [producto, setProducto] = React.useState<ProductoServicio | null>(null);
  const [variantes, setVariantes] = React.useState<ProductoVariante[]>([]);
  const [variante, setVariante] = React.useState<ProductoVariante | null>(null);
  const [config, setConfig] = React.useState<{
    tipoImpresion: TipoImpresionProductoVariante;
    caras: CarasProductoVariante;
  }>({ tipoImpresion: "cmyk", caras: "simple_faz" });
  const [cantidad, setCantidad] = React.useState(0);
  const [currentStep, setCurrentStep] = React.useState<Step>("search");
  const [loadingVariantes, setLoadingVariantes] = React.useState(false);
  const [cotizacionCosto, setCotizacionCosto] = React.useState<number | null>(null);
  const [cotizacionCompleta, setCotizacionCompleta] = React.useState<import("@/lib/productos-servicios").CotizacionProductoVariante | null>(null);
  const [checklist, setChecklist] = React.useState<ProductoChecklist | null>(null);
  const [checklistRespuestas, setChecklistRespuestas] = React.useState<
    Record<string, { respuestaId: string }>
  >({});

  const steps = React.useMemo(
    () => buildSteps(variantes.filter((v) => v.activo).length > 1),
    [variantes],
  );

  const currentStepIndex = steps.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStep === "summary";

  // Reset state when sheet closes
  React.useEffect(() => {
    if (!open) {
      setProducto(null);
      setVariantes([]);
      setVariante(null);
      setConfig({ tipoImpresion: "cmyk", caras: "simple_faz" });
      setCantidad(0);
      setCurrentStep("search");
      setLoadingVariantes(false);
      setCotizacionCosto(null);
      setCotizacionCompleta(null);
      setChecklist(null);
      setChecklistRespuestas({});
    }
  }, [open]);

  function goNext() {
    const idx = steps.indexOf(currentStep);
    if (idx < steps.length - 1) {
      setCurrentStep(steps[idx + 1]);
    }
  }

  function goBack() {
    const idx = steps.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(steps[idx - 1]);
    }
  }

  function selectVarianteAndAdvance(v: ProductoVariante) {
    setVariante(v);
    setConfig({ tipoImpresion: v.tipoImpresion, caras: v.caras });
    setCantidad(0);
    setCurrentStep("configure");
  }

  async function handleSelectProducto(p: ProductoServicio) {
    setProducto(p);
    setCantidad(0);
    setChecklistRespuestas({});
    setLoadingVariantes(true);

    try {
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
    } catch {
      setVariantes([]);
      setChecklist(null);
      setCurrentStep("search");
    } finally {
      setLoadingVariantes(false);
    }
  }

  function handleConfirm() {
    if (!producto || !variante || cantidad <= 0 || cotizacionCosto == null)
      return;

    const precio = producto.precio;
    const sim = precio
      ? simularPrecioComercial({ precio, costoTotal: cotizacionCosto, cantidad })
      : null;

    // precioFinal = precio total incluyendo impuestos y comisiones
    // subtotal para display = precioFinal - impuestos (incluye comisiones, excluye impuestos)
    const precioFinal = sim?.precioFinal ?? 0;
    const impuestosPct = sim?.impuestosPct ?? 0;
    const impuestosMonto = sim?.impuestosMonto ?? 0;
    const subtotalSinImpuestos = precioFinal - impuestosMonto;

    const item: PropuestaItem = {
      id: crypto.randomUUID(),
      productoId: producto.id,
      productoNombre: producto.nombre,
      productoCodigo: producto.codigo,
      motorCodigo: producto.motorCodigo,
      varianteId: variante.id,
      varianteNombre: variante.nombre,
      tipoImpresion: config.tipoImpresion,
      caras: config.caras,
      anchoMm: Number(variante.anchoMm),
      altoMm: Number(variante.altoMm),
      unidadMedida: producto.unidadComercial as "unidad" | "m2" | "metro_lineal",
      cantidad,
      precioUnitario: cantidad > 0 ? subtotalSinImpuestos / cantidad : 0,
      subtotal: subtotalSinImpuestos,
      impuestoPorcentaje: impuestosPct,
      impuestoMonto: impuestosMonto,
      total: precioFinal,
      especificaciones: buildItemEspecificaciones(
        variante,
        config.tipoImpresion,
        config.caras,
      ),
      cotizacion: cotizacionCompleta,
    };

    onAddItem(item);
  }

  const canContinue = currentStep === "configure" && cantidad > 0;

  const stepTitles: Record<Step, string> = {
    search: "Buscar producto",
    variant: "Elegir variante",
    configure: "Configurar",
    summary: "Resumen",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Agregar producto</SheetTitle>
          <SheetDescription>
            {producto
              ? `${producto.nombre} — ${stepTitles[currentStep]}`
              : stepTitles[currentStep]}
          </SheetDescription>
        </SheetHeader>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-4">
          {loadingVariantes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {currentStep === "search" && (
                <StepSearch onSelect={handleSelectProducto} />
              )}

              {currentStep === "variant" && producto && (
                <StepVariant
                  producto={producto}
                  variantes={variantes}
                  onSelect={selectVarianteAndAdvance}
                />
              )}

              {currentStep === "configure" && producto && variante && (
                <StepConfigure
                  producto={producto}
                  variante={variante}
                  config={config}
                  onConfigChange={setConfig}
                  cantidad={cantidad}
                  onCantidadChange={setCantidad}
                  checklist={checklist}
                  checklistRespuestas={checklistRespuestas}
                  onChecklistRespuestasChange={setChecklistRespuestas}
                />
              )}

              {currentStep === "summary" && producto && variante && (
                <StepSummary
                  producto={producto}
                  variante={variante}
                  config={config}
                  cantidad={cantidad}
                  checklistRespuestas={checklistRespuestas}
                  onCostoCalculated={setCotizacionCosto}
                  onCotizacionCompleta={setCotizacionCompleta}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="flex-row justify-between border-t pt-4">
          {!isFirstStep ? (
            <Button variant="outline" size="sm" onClick={goBack}>
              <ArrowLeftIcon />
              Volver
            </Button>
          ) : (
            <div />
          )}

          {currentStep !== "search" &&
            currentStep !== "variant" &&
            (isLastStep ? (
              <Button size="sm" onClick={handleConfirm}>
                <CheckIcon />
                Agregar
              </Button>
            ) : (
              <Button size="sm" onClick={goNext} disabled={!canContinue}>
                Continuar
              </Button>
            ))}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
