"use client";

/**
 * Tab "Imposición" — workspace Grafo (P3.b.4 + Grafo re-skin).
 *
 * Layout:
 *   - Editorial header (chip + serif title) + tool strip (cantidad + previsualizar)
 *   - KPI strip (Aprovechamiento hero + 4 métricas)
 *   - Step bar (chip de paso N/M + título + meta + nav-mini)
 *   - Workspace 2-col: <NestingPreview variant="full"> + panel derecho
 *     · Pliego (read-only)
 *     · Piezas (agrupadas por dimensión)
 *     · Variantes (selector — cambia selectedVariantId)
 *     · Resultado (breakdown invoice-style)
 *     · Alert (success si aprovechamiento ≥ 70%)
 */

import * as React from "react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { NestingPreview } from "@/components/nesting-preview";
import {
  extractNestingPreview,
  type EvaluacionMultiMaterial,
} from "@/components/productos-servicios/nesting-extract";
import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cotizarProductoVarianteV2 } from "@/lib/productos-servicios-api";
import type { CotizacionCanonica } from "@/lib/productos-servicios";
import { cn } from "@/lib/utils";

function buildDefaultPeriodo() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function asNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (decimals === 0) return Math.round(n).toString();
  return n.toFixed(decimals);
}

export function ProductoImposicionTab(props: ProductTabProps) {
  const [cantidad, setCantidad] = React.useState("500");
  const [anchoMm, setAnchoMm] = React.useState("1000");
  const [altoMm, setAltoMm] = React.useState("500");
  const [periodo] = React.useState(buildDefaultPeriodo());
  const [cotizacion, setCotizacion] = React.useState<CotizacionCanonica | null>(
    null,
  );
  const [isCotizando, startCotizando] = React.useTransition();
  const [stepIdx, setStepIdx] = React.useState(0);

  const { selectedVariantId, setSelectedVariantId, variantes, producto } = props;
  const modoMedidas = producto.modoMedidas;
  const needsMedidas = modoMedidas === "LIBRE";

  // Cambiar variante → limpiar cotización (forzar re-preview con la nueva)
  React.useEffect(() => {
    setCotizacion(null);
    setStepIdx(0);
  }, [selectedVariantId]);

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
        if (!selectedVariantId) {
          toast.error(
            "Este producto no tiene variante por defecto. Previsualización por-producto aún no soportada.",
          );
          return;
        }
        const result = await cotizarProductoVarianteV2(
          selectedVariantId,
          { cantidad: Number(cantidad), periodo, parametros },
          {},
        );
        setCotizacion(result);
        setStepIdx(0);
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "No se pudo previsualizar.",
        );
      }
    });
  }, [
    selectedVariantId,
    cantidad,
    anchoMm,
    altoMm,
    periodo,
    needsMedidas,
    modoMedidas,
  ]);

  const previewsPorPaso = React.useMemo(() => {
    if (!cotizacion) return [];
    return cotizacion.pasos
      .map((paso) => ({ paso, data: extractNestingPreview(paso) }))
      .filter(
        (x): x is { paso: typeof x.paso; data: NonNullable<typeof x.data> } =>
          x.data !== null,
      )
      // SM.1.d — Solo mostramos pasos que PRODUCEN nesting. Los pasos
      // `consume` (corte, laminado, embalaje, etc.) heredan el layout del
      // paso `produce` aguas arriba — mostrarlos como pasos separados con
      // el mismo canvas es confuso y redundante.
      .filter((x) => {
        const traza = (x.paso.trazabilidad ?? {}) as Record<string, unknown>;
        const nesting = traza.nesting as Record<string, unknown> | undefined;
        return nesting ? !nesting.heredado : true;
      });
  }, [cotizacion]);

  const totalSteps = previewsPorPaso.length;
  const safeStepIdx = Math.min(stepIdx, Math.max(0, totalSteps - 1));
  const current = previewsPorPaso[safeStepIdx] ?? null;

  const kpis = React.useMemo(() => {
    if (!current) return null;
    const stats = current.data.stats;
    const aprov = asNumber(stats.porcentajeAprovechamiento);
    const piezasPliego = asNumber(
      stats.piezasPorPliego ?? stats.piezasPorPlaca,
    );
    const pliegos = asNumber(
      stats.pliegosNecesarios ?? stats.placasNecesarias,
    );
    const areaUtil = asNumber(stats.areaUtilizadaM2);
    const merma = aprov != null ? 100 - aprov : null;
    const c = current.data.container;
    const widthMm =
      c.type === "rollo"
        ? c.rolloAnchoTotalMm ?? c.printableWidthMm
        : c.anchoMm;
    const heightMm = c.type === "rollo" ? c.consumedLengthMm : c.altoMm;
    const containerAreaM2 = (widthMm * heightMm) / 1_000_000;
    return {
      aprov,
      piezasPliego,
      pliegos,
      areaUtil,
      merma,
      containerAreaM2,
    };
  }, [current]);

  const piecesGrouped = React.useMemo(() => {
    if (!current) return [];
    const map = new Map<
      string,
      { w: number; h: number; count: number; label?: string }
    >();
    for (const p of current.data.placements) {
      const key = `${Math.round(p.anchoMm)}×${Math.round(p.altoMm)}`;
      const existing = map.get(key);
      if (existing) existing.count++;
      else
        map.set(key, {
          w: p.anchoMm,
          h: p.altoMm,
          count: 1,
          label: p.label,
        });
    }
    return Array.from(map.values());
  }, [current]);

  const containerDisplay = React.useMemo(() => {
    if (!current) return null;
    const c = current.data.container;
    if (c.type === "rollo") {
      return {
        title: "Rollo",
        primary: `${Math.round(c.rolloAnchoTotalMm ?? c.printableWidthMm)} × ${Math.round(c.consumedLengthMm)} mm`,
        secondary: `Imprimible ${Math.round(c.printableWidthMm)} mm`,
        rows: [
          {
            k: "Ancho rollo",
            v: `${Math.round(c.rolloAnchoTotalMm ?? c.printableWidthMm)} mm`,
          },
          { k: "Imprimible", v: `${Math.round(c.printableWidthMm)} mm` },
          {
            k: "Largo consumido",
            v: `${(c.consumedLengthMm / 1000).toFixed(2)} m`,
          },
        ],
      };
    }
    if (c.type === "pliego") {
      return {
        title: "Pliego",
        primary: `${Math.round(c.anchoMm)} × ${Math.round(c.altoMm)} mm`,
        secondary: undefined as string | undefined,
        rows: [
          { k: "Ancho", v: `${Math.round(c.anchoMm)} mm` },
          { k: "Alto", v: `${Math.round(c.altoMm)} mm` },
          { k: "Margen seguridad", v: c.margenMm ? `${c.margenMm} mm` : "—" },
        ],
      };
    }
    return {
      title: "Placa",
      primary: `${Math.round(c.anchoMm)} × ${Math.round(c.altoMm)} mm`,
      secondary: c.materialLabel,
      rows: [
        { k: "Ancho", v: `${Math.round(c.anchoMm)} mm` },
        { k: "Alto", v: `${Math.round(c.altoMm)} mm` },
        { k: "Material", v: c.materialLabel ?? "—" },
      ],
    };
  }, [current]);

  const breakdown = React.useMemo(() => {
    if (!current || !kpis) return null;
    const cantidadNum = Number(cantidad) || 0;
    const piezasPliego = kpis.piezasPliego ?? 0;
    const pliegos = kpis.pliegos ?? 0;
    const enteros =
      piezasPliego > 0 ? Math.floor(cantidadNum / piezasPliego) : 0;
    const piezasParcial =
      piezasPliego > 0 ? cantidadNum - enteros * piezasPliego : 0;
    return {
      piezasPliego,
      enteros,
      piezasParcial,
      pliegos,
      tieneParcial: piezasParcial > 0,
    };
  }, [current, kpis, cantidad]);

  return (
    <div className="flex flex-col gap-4">
      {/* HEADER */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-block rounded-full border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            Imposición · Nesting
          </span>
          <h2 className="mt-2.5 font-serif text-4xl font-normal leading-none tracking-[-0.02em] text-ink-0">
            Nesting del <em className="italic text-ink-2">pliego</em>
          </h2>
          <p className="mt-2 max-w-[620px] text-sm leading-[1.6] text-ink-2">
            Previsualizá cómo se distribuyen las piezas en cada paso con nesting.
            Sin totales monetarios — para eso usá el tab{" "}
            <b className="font-medium text-ink-0">Simular costo</b>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-[10px] border border-line bg-bg-1 p-1.5">
          <ToolField label="Cant.">
            <Input
              type="number"
              value={cantidad}
              min="1"
              onChange={(e) => setCantidad(e.target.value)}
              className="w-20 border-0 bg-transparent p-0 text-right text-sm font-medium text-ink-0 shadow-none focus-visible:ring-0"
            />
          </ToolField>
          {needsMedidas && (
            <>
              <ToolDivider />
              <ToolField label="W">
                <Input
                  type="number"
                  value={anchoMm}
                  min="1"
                  onChange={(e) => setAnchoMm(e.target.value)}
                  className="w-16 border-0 bg-transparent p-0 text-right text-sm font-medium text-ink-0 shadow-none focus-visible:ring-0"
                />
              </ToolField>
              <ToolDivider />
              <ToolField label="H">
                <Input
                  type="number"
                  value={altoMm}
                  min="1"
                  onChange={(e) => setAltoMm(e.target.value)}
                  className="w-16 border-0 bg-transparent p-0 text-right text-sm font-medium text-ink-0 shadow-none focus-visible:ring-0"
                />
              </ToolField>
            </>
          )}
          <ToolDivider />
          <Button
            type="button"
            size="sm"
            onClick={handlePreview}
            disabled={
              isCotizando ||
              (!selectedVariantId && modoMedidas === "ESTANDAR")
            }
          >
            {isCotizando ? (
              <GdiSpinner className="size-3.5" data-icon="inline-start" />
            ) : null}
            Previsualizar
          </Button>
        </div>
      </div>

      {!cotizacion && (
        <div className="rounded-[10px] border border-line bg-bg-1 px-6 py-12 text-center text-sm text-ink-2">
          Ingresá la cantidad y hacé click en{" "}
          <b className="font-medium text-ink-0">Previsualizar</b> para ver el
          nesting.
        </div>
      )}

      {cotizacion && totalSteps === 0 && (
        <div className="rounded-[10px] border border-line bg-bg-1 px-6 py-12 text-center text-sm text-ink-2">
          Ningún paso de la ruta de este producto produce nesting visualizable.
        </div>
      )}

      {current && kpis && containerDisplay && (
        <>
          {/* KPI STRIP */}
          <div className="grid grid-cols-1 overflow-hidden rounded-[12px] border border-line bg-bg-1 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCell
              hero
              label="Aprovechamiento"
              value={fmt(kpis.aprov, 1)}
              unit="%"
              progress={kpis.aprov ?? 0}
              footer={
                kpis.aprov != null
                  ? `${kpis.aprov.toFixed(1)}% del pliego útil`
                  : "—"
              }
            />
            <KpiCell
              label="Piezas por pliego"
              value={fmt(kpis.piezasPliego)}
              unit="/ pliego"
              footer="según el motor del paso"
            />
            <KpiCell
              label="Pliegos necesarios"
              value={fmt(kpis.pliegos)}
              footer={`para ${cantidad} piezas`}
            />
            <KpiCell
              label="M² útiles / pliego"
              value={fmt(kpis.areaUtil, 3)}
              unit="m²"
              footer={
                kpis.containerAreaM2
                  ? `de ${kpis.containerAreaM2.toFixed(3)} m² totales`
                  : "—"
              }
            />
            <KpiCell
              isLast
              label="Merma"
              value={fmt(kpis.merma, 1)}
              unit="%"
              footer={
                kpis.merma != null && kpis.containerAreaM2
                  ? `${((kpis.merma / 100) * kpis.containerAreaM2).toFixed(3)} m²/pliego`
                  : "—"
              }
            />
          </div>

          {/* STEP BAR */}
          <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-bg-1 px-3.5 py-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-line-hi px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-2">
              <span className="size-1.5 rounded-full bg-lime shadow-[0_0_8px_var(--lime)]" />
              Paso {safeStepIdx + 1} de {totalSteps}
            </span>
            <span className="font-serif text-xl italic leading-none tracking-[-0.01em] text-ink-0">
              {current.paso.nombre}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
              <span>
                Tipo: <span className="text-ink-1">{current.paso.tipo}</span>
              </span>
              <span className="text-line-hi">·</span>
              <span>
                {containerDisplay.title}:{" "}
                <span className="text-ink-1">{containerDisplay.primary}</span>
              </span>
            </div>
            {totalSteps > 1 && (
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={safeStepIdx === 0}
                  onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                  className="flex size-[26px] items-center justify-center rounded-md border border-line-hi font-mono text-xs text-ink-2 transition-colors hover:border-ink-3 hover:text-ink-0 disabled:opacity-40 disabled:hover:border-line-hi disabled:hover:text-ink-2"
                  aria-label="Paso anterior"
                >
                  ‹
                </button>
                <button
                  type="button"
                  disabled={safeStepIdx === totalSteps - 1}
                  onClick={() =>
                    setStepIdx((i) => Math.min(totalSteps - 1, i + 1))
                  }
                  className="flex size-[26px] items-center justify-center rounded-md border border-line-hi font-mono text-xs text-ink-2 transition-colors hover:border-ink-3 hover:text-ink-0 disabled:opacity-40 disabled:hover:border-line-hi disabled:hover:text-ink-2"
                  aria-label="Paso siguiente"
                >
                  ›
                </button>
              </div>
            )}
          </div>

          {/* WORKSPACE 2-col */}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_320px]">
            <NestingPreview
              container={current.data.container}
              placements={current.data.placements}
              variant="full"
              showDimensions={false}
            />

            <div className="flex flex-col gap-3">
              {/* Pliego (read-only) */}
              <PanelCard
                title={containerDisplay.title}
                meta={containerDisplay.secondary ?? containerDisplay.primary}
              >
                <div className="space-y-0">
                  {containerDisplay.rows.map((row) => (
                    <div
                      key={row.k}
                      className="flex items-baseline justify-between border-b border-dashed border-line py-1.5 last:border-b-0"
                    >
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                        {row.k}
                      </span>
                      <span className="font-mono text-xs text-ink-1">
                        {row.v}
                      </span>
                    </div>
                  ))}
                </div>
              </PanelCard>

              {/* Piezas */}
              <PanelCard
                title="Piezas"
                meta={`${current.data.placements.length} en pliego`}
                metaTone="lime"
              >
                <div className="flex flex-col gap-1">
                  {piecesGrouped.map((g, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-md px-2.5 py-2 hover:bg-bg-2"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="relative h-[22px] w-[22px] flex-shrink-0 rounded-sm bg-lime">
                          <span className="absolute inset-[3px] rounded-[1px] bg-[rgba(11,11,15,0.35)]" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium leading-tight tracking-[-0.01em] text-ink-0">
                            {g.label ?? "Pieza"}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] tracking-[0.04em] text-ink-3">
                            {Math.round(g.w)} × {Math.round(g.h)} mm
                          </div>
                        </div>
                      </div>
                      <div className="font-mono text-xs text-lime">
                        ×{g.count}
                      </div>
                    </div>
                  ))}
                </div>
              </PanelCard>

              {/* Variantes selector */}
              {variantes.length > 1 && (
                <PanelCard
                  title="Variantes"
                  meta={`${variantes.length} disponibles`}
                >
                  <div className="grid grid-cols-3 gap-2">
                    {variantes.map((v) => {
                      const isSelected = v.id === selectedVariantId;
                      const maxDim = Math.max(v.anchoMm, v.altoMm);
                      const thumbW = Math.max(
                        10,
                        Math.min(36, (v.anchoMm / maxDim) * 36),
                      );
                      const thumbH = Math.max(
                        10,
                        Math.min(36, (v.altoMm / maxDim) * 36),
                      );
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariantId(v.id)}
                          className={`flex flex-col gap-1.5 rounded-md border p-2 text-left transition-colors ${
                            isSelected
                              ? "border-lime bg-[rgba(232,255,92,0.03)]"
                              : "border-line bg-bg-2 hover:border-ink-4"
                          }`}
                        >
                          <div
                            className="relative flex h-12 items-center justify-center rounded-sm"
                            style={{
                              backgroundImage:
                                "linear-gradient(180deg,rgba(36,36,45,0.5),rgba(36,36,45,0.2))",
                            }}
                          >
                            <div
                              className="rounded-[1px] bg-[#D9D9D2]"
                              style={{ width: thumbW, height: thumbH }}
                            />
                          </div>
                          <div className="flex items-baseline justify-between gap-1 font-mono text-[9px] uppercase tracking-[0.06em]">
                            <span className="truncate text-ink-3">
                              {v.nombre}
                            </span>
                            <span
                              className={
                                isSelected ? "text-lime" : "text-ink-0"
                              }
                            >
                              {Math.round(v.anchoMm)}×{Math.round(v.altoMm)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-4">
                    Tocá una variante para re-previsualizar
                  </p>
                </PanelCard>
              )}

              {/* SM.1.d — Materiales evaluados (solo si el paso tiene
                  multi-variant). Lista las alternativas con aprovechamiento,
                  ganador en lime, descartados con motivo. */}
              {current.data.evaluacion && (
                <MaterialesEvaluadosPanel
                  evaluacion={current.data.evaluacion}
                />
              )}

              {/* Resultado */}
              {breakdown && (
                <PanelCard title="Resultado" meta={`para ${cantidad} piezas`}>
                  <div className="flex flex-col gap-2">
                    <BreakdownRow
                      k="Piezas por pliego"
                      v={fmt(breakdown.piezasPliego)}
                      bold
                    />
                    <BreakdownRow
                      k="Pliegos enteros"
                      v={fmt(breakdown.enteros)}
                    />
                    <BreakdownRow
                      k="Pliego parcial"
                      v={
                        breakdown.tieneParcial
                          ? `1 · ${breakdown.piezasParcial} piezas`
                          : "—"
                      }
                    />
                    <BreakdownRow
                      k="Pliegos totales"
                      v={fmt(breakdown.pliegos)}
                      total
                    />
                  </div>
                </PanelCard>
              )}

              {/* Alert (success cuando aprovechamiento ≥ 70%) */}
              {kpis.aprov != null && kpis.aprov >= 70 && (
                <div className="flex items-start gap-2.5 rounded-lg border border-[rgba(111,227,154,0.3)] bg-[rgba(111,227,154,0.05)] px-3 py-2.5">
                  <span className="mt-0.5 font-mono text-sm text-ok">✓</span>
                  <div className="text-xs leading-[1.55] text-ink-1">
                    <b className="font-medium text-ok">
                      Buen aprovechamiento.
                    </b>{" "}
                    El layout actual usa{" "}
                    <b className="font-medium text-ok">
                      {kpis.aprov.toFixed(1)}%
                    </b>{" "}
                    del pliego.
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────── Subcomponentes locales ────────────────

function ToolField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-1.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
        {label}
      </div>
      {children}
    </div>
  );
}

function ToolDivider() {
  return <div className="h-[22px] w-px bg-line" />;
}

function KpiCell({
  label,
  value,
  unit,
  footer,
  hero,
  isLast,
  progress,
}: {
  label: string;
  value: string;
  unit?: string;
  footer?: string;
  hero?: boolean;
  isLast?: boolean;
  progress?: number;
}) {
  return (
    <div
      className={`relative flex min-h-[110px] flex-col justify-between border-b border-line p-5 lg:border-b-0 lg:border-r ${
        isLast ? "lg:border-r-0" : ""
      } ${hero ? "bg-gradient-to-br from-bg-1 to-bg-2" : ""}`}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
        {label}
      </div>
      <div
        className={`mt-2.5 font-serif text-[42px] italic leading-none tracking-[-0.02em] ${
          hero ? "text-lime" : "text-ink-0"
        }`}
      >
        {value}
        {unit && (
          <span className="ml-1 font-mono text-sm font-normal not-italic tracking-normal text-ink-3">
            {unit}
          </span>
        )}
      </div>
      {hero && progress != null && (
        <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-bg-3">
          <div
            className="h-full bg-lime shadow-[0_0_10px_var(--lime)]"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      {footer && (
        <div className="mt-2 font-mono text-[10px] tracking-[0.04em] text-ink-3">
          {footer}
        </div>
      )}
    </div>
  );
}

function PanelCard({
  title,
  meta,
  metaTone,
  children,
}: {
  title: string;
  meta?: string;
  metaTone?: "lime";
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-bg-1">
      <header className="flex items-center justify-between border-b border-line px-3.5 py-3">
        <div className="font-serif text-[17px] italic leading-tight tracking-[-0.01em] text-ink-0">
          {title}
        </div>
        {meta && (
          <div
            className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
              metaTone === "lime" ? "text-lime" : "text-ink-3"
            }`}
          >
            {meta}
          </div>
        )}
      </header>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  );
}

function BreakdownRow({
  k,
  v,
  bold,
  total,
}: {
  k: string;
  v: string;
  bold?: boolean;
  total?: boolean;
}) {
  if (total) {
    return (
      <div className="mt-1.5 flex items-baseline justify-between border-t border-line-hi pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
          {k}
        </span>
        <span className="font-serif text-[22px] italic leading-none tracking-[-0.01em] text-lime">
          {v}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between border-b border-dashed border-line py-1.5 last:border-b-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
        {k}
      </span>
      <span
        className={`font-mono text-xs ${bold ? "font-medium text-ink-0" : "text-ink-1"}`}
      >
        {v}
      </span>
    </div>
  );
}

// ──────────────── Materiales evaluados (SM.1.d) ────────────────

function MaterialesEvaluadosPanel({
  evaluacion,
}: {
  evaluacion: EvaluacionMultiMaterial;
}) {
  const evaluados = evaluacion.materialesEvaluados;
  const descartados = evaluacion.materialesDescartados;
  const criterioLabel = (() => {
    switch (evaluacion.criterio) {
      case "menor_costo_total":
        return "Menor costo total";
      case "menor_largo_consumido":
        return "Menor largo consumido";
      default:
        return "Mayor aprovechamiento";
    }
  })();
  return (
    <PanelCard
      title="Materiales evaluados"
      meta={`${evaluados.length} eval${evaluados.length === 1 ? "" : "s"}`}
      metaTone="lime"
    >
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
        Criterio: <span className="text-ink-1">{criterioLabel}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {evaluados
          .slice()
          .sort((a, b) => Number(b.esGanador) - Number(a.esGanador))
          .map((e) => (
            <div
              key={e.materialVarianteId}
              className={cn(
                "rounded-md border p-2.5 transition-colors",
                e.esGanador
                  ? "border-lime bg-[rgba(232,255,92,0.04)]"
                  : "border-line bg-bg-2",
              )}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                {/* Título: ancho del rollo en cm, lo más prominente. */}
                <span
                  className={cn(
                    "text-sm font-medium",
                    e.esGanador ? "text-lime" : "text-ink-0",
                  )}
                >
                  {e.rolloAnchoMm != null
                    ? `${(e.rolloAnchoMm / 10).toLocaleString("es-AR", {
                        maximumFractionDigits: 1,
                      })} cm`
                    : "—"}
                </span>
                {e.esGanador && (
                  <span className="rounded-sm bg-lime px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-lime-ink">
                    elegido
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[10px] tracking-[0.04em] text-ink-3">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.1em] text-ink-4">
                    Aprov.
                  </div>
                  <div className={e.esGanador ? "text-lime" : "text-ink-1"}>
                    {e.aprovechamientoPct.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.1em] text-ink-4">
                    Largo
                  </div>
                  <div className={e.esGanador ? "text-lime" : "text-ink-1"}>
                    {e.largoConsumidoMm > 0
                      ? `${(e.largoConsumidoMm / 1000).toFixed(2)} m`
                      : "—"}
                  </div>
                </div>
                {e.sustratoCosto != null && (
                  <div className="col-span-2 mt-1 border-t border-dashed border-line pt-1">
                    <span className="text-[9px] uppercase tracking-[0.1em] text-ink-4">
                      Sustrato
                    </span>{" "}
                    <span className={e.esGanador ? "text-lime" : "text-ink-1"}>
                      $ {new Intl.NumberFormat("es-AR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(e.sustratoCosto)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
      {descartados.length > 0 && (
        <div className="mt-3 border-t border-dashed border-line pt-3">
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            Descartadas ({descartados.length})
          </div>
          <ul className="space-y-1">
            {descartados.map((d, idx) => {
              const titulo =
                d.rolloAnchoMm != null
                  ? `${(d.rolloAnchoMm / 10).toLocaleString("es-AR", {
                      maximumFractionDigits: 1,
                    })} cm`
                  : d.nombre || d.sku;
              return (
                <li
                  key={`${d.sku}-${idx}`}
                  className="text-[11px] leading-snug text-ink-4"
                >
                  <span className="text-ink-2">{titulo}</span> · {d.motivo}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </PanelCard>
  );
}
