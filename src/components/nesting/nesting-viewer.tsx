"use client";

import * as React from "react";
import type { NestingViewerInput } from "@/lib/productos-servicios-api";
import { cn } from "@/lib/utils";

export interface NestingViewerProps {
  result: NestingViewerInput;
  costingDetails?: Array<{
    materialNombre: string;
    cantidad: number;
    costoTotal: number;
    detalleCosteoNesting?: {
      strategy: string;
      totalCost: number;
      unitPrice: number;
      pricePerM2: number;
      fullUnits: number;
      fullUnitsCost: number;
      lastUnit: {
        occupationPct: number;
        segmentApplied: number | null;
        cost: number;
      } | null;
    };
  }>;
  maxPx?: number;
  showLabels?: boolean;
  className?: string;
}

const PIECE_COLORS = [
  { fill: "#18181b", text: "#ffffff", stroke: "#111113" },
  { fill: "#ece8de", text: "#2c2c33", stroke: "#cfc9bb" },
  { fill: "#d9edf0", text: "#263238", stroke: "#9bc7d0" },
  { fill: "#dff0b3", text: "#263238", stroke: "#a9c76a" },
  { fill: "#e7d8f5", text: "#2c2c33", stroke: "#b89bdd" },
  { fill: "#f5c693", text: "#2c2c33", stroke: "#d99a5d" },
  { fill: "#f3d48a", text: "#2c2c33", stroke: "#d2aa46" },
  { fill: "#eaa8c9", text: "#2c2c33", stroke: "#c46b9b" },
];

type PieceStyle = (typeof PIECE_COLORS)[number];
type Placement = NestingViewerInput["placements"][number];
type VisualConfig = NonNullable<NestingViewerInput["visualConfig"]>;

function colorForKey(key: string): PieceStyle {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return PIECE_COLORS[Math.abs(h) % PIECE_COLORS.length];
}

function formatMm(mm: number): string {
  if (!Number.isFinite(mm)) return "-";
  if (mm >= 1000) return `${formatNumber(mm / 1000, 2)}m`;
  return `${Math.round(mm)}mm`;
}

function formatM2(mm2: number): string {
  return `${formatNumber(mm2 / 1_000_000, 2)} m²`;
}

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: value % 1 === 0 ? 0 : Math.min(digits, 2),
  }).format(value);
}

function formatARS(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function labelUnidad(u: NestingViewerInput["unidad"]): string {
  switch (u) {
    case "m_lineales":
      return "m lineales";
    case "pliegos":
      return "pliegos";
    case "m2":
      return "m²";
    case "piezas":
      return "piezas";
  }
}

function algorithmLabel(algorithm: NestingViewerInput["algorithm"]): string {
  const labels: Record<NestingViewerInput["algorithm"], string> = {
    "shelf-rollo": "Acomodo en rollo",
    "maxrects-rollo": "Acomodo optimizado en rollo",
    "grid-2d-single": "Acomodo en pliego",
    "grid-2d-multi": "Acomodo multi-placa",
    "packingsolver-rectangle": "Acomodo optimizado en placa",
  };
  return labels[algorithm];
}

function costingLabel(strategy: string) {
  const labels: Record<string, string> = {
    simple: "simple",
    "m2-exact": "m² exactos",
    "consumed-length": "largo consumido",
    "plate-segments": "segmentos de placa",
  };
  return labels[strategy] ?? strategy;
}

function placementLabel(placement: Placement): string {
  const meta = placement.meta as { label?: string } | undefined;
  if (meta?.label) return meta.label;
  return `${formatMm(placement.usefulWidthMm ?? placement.widthMm)}×${formatMm(
    placement.usefulHeightMm ?? placement.heightMm,
  )}`;
}

function placementGroupKey(placement: Placement): string {
  return [
    placementLabel(placement),
    Math.round(placement.usefulWidthMm ?? placement.widthMm),
    Math.round(placement.usefulHeightMm ?? placement.heightMm),
    placement.panelCount ?? 0,
  ].join("|");
}

function usePieceGroups(placements: NestingViewerInput["placements"]) {
  return React.useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        count: number;
        style: PieceStyle;
        widthMm: number;
        heightMm: number;
      }
    >();

    placements.forEach((placement) => {
      const key = placementGroupKey(placement);
      const current = map.get(key);
      if (current) {
        current.count += 1;
        return;
      }
      map.set(key, {
        key,
        label: placementLabel(placement),
        count: 1,
        style: colorForKey(key),
        widthMm: placement.usefulWidthMm ?? placement.widthMm,
        heightMm: placement.usefulHeightMm ?? placement.heightMm,
      });
    });

    return Array.from(map.values());
  }, [placements]);
}

export function NestingViewer({
  result,
  costingDetails = [],
  maxPx = 560,
  showLabels = true,
  className,
}: NestingViewerProps) {
  const pieceGroups = usePieceGroups(result.placements);
  const firstSubstrate = result.substrates[0];
  const firstHeight =
    firstSubstrate?.kind === "sheet" ? firstSubstrate.heightMm : firstSubstrate?.lengthMm;
  const firstVisualConfig = firstSubstrate
    ? getEffectiveVisualConfig(result.visualConfig, firstSubstrate.widthMm, firstHeight ?? 0)
    : null;
  const areaUtilMm2 = firstVisualConfig
    ? firstVisualConfig.usableArea.widthMm * firstVisualConfig.usableArea.heightMm
    : 0;
  const substrateLabel =
    result.visualConfig?.substrateLabel ??
    (firstSubstrate
      ? firstSubstrate.kind === "roll"
        ? `Rollo ${formatMm(firstSubstrate.widthMm)}`
        : `${firstSubstrate.count} pliego${firstSubstrate.count === 1 ? "" : "s"} ${formatMm(firstSubstrate.widthMm)} × ${formatMm(firstSubstrate.heightMm)}`
      : "Sustrato");

  if (!result.substrates.length) {
    return (
      <div className={cn("rounded-xl border border-dashed p-6 text-sm text-muted-foreground", className)}>
        Sin sustratos para visualizar.
      </div>
    );
  }

  return (
    <section className={cn("overflow-hidden rounded-xl border border-[#e7e5e2] bg-white shadow-sm", className)}>
      <div className="flex flex-wrap items-center gap-3 border-b border-[#efece8] px-4 py-3">
        <div className="inline-flex items-center gap-2 border-b-2 border-foreground pb-3 pt-2 -mb-3">
          <span className="rounded bg-foreground px-1.5 py-0.5 font-mono text-[10px] font-medium text-background">
            01
          </span>
          <span className="text-sm font-semibold">{algorithmLabel(result.algorithm)}</span>
          <span className="font-mono text-xs font-semibold text-emerald-700">
            {formatNumber(result.aprovechamientoPct, 1)}%
          </span>
        </div>
        {result.costingPreview ? (
          <div className="ml-auto text-xs text-muted-foreground">
            Costeo: <strong className="font-semibold text-foreground">{result.costingPreview.label}</strong>
          </div>
        ) : null}
      </div>

      <div className="grid border-b border-[#efece8] sm:grid-cols-2 xl:grid-cols-5">
        <StatBlock
          featured
          label="Aprovechamiento"
          value={`${formatNumber(result.aprovechamientoPct, 1)}%`}
          hint="resultado elegido"
        />
        <StatBlock
          label="Piezas acomodadas"
          value={String(result.piezasAcomodadas)}
          hint={pieceGroups
            .slice(0, 2)
            .map((p) => `${p.count} × ${p.label}`)
            .join(" · ")}
        />
        <StatBlock
          label={result.unidad === "m_lineales" ? "Largo consumido" : "Cantidad calculada"}
          value={`${formatNumber(result.cantidadCalculada, 2)} ${labelUnidad(result.unidad)}`}
          hint={result.consumedLengthMm ? `Rollo: ${formatMm(result.consumedLengthMm)}` : undefined}
        />
        <StatBlock
          label="Área útil"
          value={areaUtilMm2 > 0 ? formatM2(areaUtilMm2) : "-"}
          hint={
            firstVisualConfig
              ? `${formatMm(firstVisualConfig.usableArea.widthMm)} × ${formatMm(firstVisualConfig.usableArea.heightMm)}`
              : undefined
          }
        />
        <StatBlock
          label="Desperdicio costeado"
          value={result.costingPreview?.wasteAreaMm2 ? formatM2(result.costingPreview.wasteAreaMm2) : "-"}
          hint={result.costingPreview?.segmentAppliedPct ? `Escalón ${result.costingPreview.segmentAppliedPct}%` : undefined}
        />
      </div>

      <NestingConfigStrip result={result} substrateLabel={substrateLabel} />
      <NestingCostingSummary costingDetails={costingDetails} />
      <NestingLegend
        pieceGroups={pieceGroups}
        visualConfig={result.visualConfig}
        costingPreview={result.costingPreview}
      />

      <div className="space-y-4 bg-[#fafaf9] p-4">
        {result.substrates.map((sub, idx) => (
          <SubstrateView
            key={idx}
            substrate={sub}
            substrateIndex={idx}
            totalSubstrates={result.substrates.length}
            visualConfig={result.visualConfig}
            costingPreview={result.costingPreview}
            placements={result.placements.filter((p) => (p.substrateIndex ?? 0) === idx)}
            maxPx={maxPx}
            showLabels={showLabels}
          />
        ))}
      </div>

      <NestingFooter result={result} />
      <TalonarioGrouping grouping={result.talonarioGrouping} />
    </section>
  );
}

function StatBlock({
  label,
  value,
  hint,
  featured,
}: {
  label: string;
  value: string;
  hint?: string;
  featured?: boolean;
}) {
  return (
    <div className={cn("min-w-0 border-r border-[#efece8] px-4 py-3 last:border-r-0", featured && "bg-[#fafaf9]")}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", featured && "text-emerald-700")}>{value}</div>
      {hint ? <div className="mt-1 truncate text-xs text-muted-foreground" title={hint}>{hint}</div> : null}
    </div>
  );
}

function NestingConfigStrip({
  result,
  substrateLabel,
}: {
  result: NestingViewerInput;
  substrateLabel: string;
}) {
  const sub = result.substrates[0];
  const height = sub?.kind === "sheet" ? sub.heightMm : sub?.lengthMm;
  const visualConfig = sub ? getEffectiveVisualConfig(result.visualConfig, sub.widthMm, height ?? 0) : null;
  const panelizado = visualConfig?.panelizado;
  const configItems = [
    ["Sustrato", substrateLabel],
    visualConfig
      ? [
          "Márgenes",
          `I ${formatMm(visualConfig.margins.leftMm)} · D ${formatMm(visualConfig.margins.rightMm)} · S ${formatMm(visualConfig.margins.topMm)} · Inf ${formatMm(visualConfig.margins.bottomMm)}`,
        ]
      : null,
    visualConfig
      ? [
          "Separación",
          `H ${formatMm(visualConfig.spacing.horizontalMm)} · V ${formatMm(visualConfig.spacing.verticalMm)}`,
        ]
      : null,
    visualConfig ? ["Rotación", visualConfig.allowRotation ? "permitida" : "bloqueada"] : null,
    result.costingPreview ? ["Costeo", costingLabel(result.costingPreview.strategy)] : null,
    panelizado?.enabled
      ? [
          "Panelizado",
          `${panelizado.panelCount} paneles · ${panelizado.axis ?? "auto"} · solape ${formatMm(panelizado.overlapMm ?? 0)}`,
        ]
      : null,
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-[#efece8] bg-[#fafaf9] px-4 py-3">
      {configItems.map(([key, value]) => (
        <div key={key} className="inline-flex items-center gap-2 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{key}</span>
          <span className="font-mono text-[11px] font-medium text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}

function NestingCostingSummary({
  costingDetails,
}: {
  costingDetails: NonNullable<NestingViewerProps["costingDetails"]>;
}) {
  const items = costingDetails.filter((item) => item.detalleCosteoNesting);
  if (items.length === 0) return null;

  return (
    <div className="border-b border-[#efece8] bg-orange-50/70 px-4 py-2 text-xs text-orange-950">
      {items.map((item) => {
        const detalle = item.detalleCosteoNesting!;
        return (
          <div key={`${item.materialNombre}-${detalle.strategy}`} className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold">Costeo del sustrato</span>
            <span>{item.materialNombre}</span>
            <span>{costingLabel(detalle.strategy)}</span>
            <span>Total {formatARS(detalle.totalCost)}</span>
            {detalle.lastUnit ? (
              <span>Última placa {formatNumber(detalle.lastUnit.occupationPct, 1)}%</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function NestingLegend({
  pieceGroups,
  visualConfig,
  costingPreview,
}: {
  pieceGroups: ReturnType<typeof usePieceGroups>;
  visualConfig?: NestingViewerInput["visualConfig"];
  costingPreview?: NestingViewerInput["costingPreview"];
}) {
  const hasMargins = visualConfig && Object.values(visualConfig.margins).some((value) => value > 0);
  const hasSpacing =
    visualConfig && (visualConfig.spacing.horizontalMm > 0 || visualConfig.spacing.verticalMm > 0);
  const showCosting = costingPreview && costingPreview.strategy !== "simple";
  const hasPanelizado = visualConfig?.panelizado?.enabled === true;

  if (pieceGroups.length === 0 && !hasMargins && !hasSpacing && !showCosting && !hasPanelizado) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#efece8] px-4 py-3 text-xs">
      <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Referencia</span>
      <LegendChip color="#ffffff" border="#b8d8c2" label="Área útil" dashed />
      {hasMargins ? <LegendChip color="#fff4df" border="#e9b978" label="Márgenes" /> : null}
      {showCosting ? <LegendChip color="#fff1c8" border="#e7be58" label="Área costeada" /> : null}
      {costingPreview?.wasteAreaMm2 ? <LegendChip color="#fef3ed" border="#f4b9a0" label="Desperdicio" dashed /> : null}
      {hasSpacing ? <LegendChip color="#e7e5e4" border="#bdb9b4" label="Separación" /> : null}
      {hasPanelizado ? <LegendChip color="#fef3c7" border="#d97706" label="Solape" /> : null}
      {pieceGroups.map((piece) => (
        <span key={piece.key} className="inline-flex items-center gap-2 rounded px-1 py-0.5 text-foreground">
          <span
            className="size-3.5 rounded-sm border"
            style={{ backgroundColor: piece.style.fill, borderColor: piece.style.stroke }}
            aria-hidden
          />
          <span className="font-medium">{piece.label}</span>
          <span className="rounded border bg-[#fafaf9] px-1.5 font-mono text-[10px] text-muted-foreground">
            ×{piece.count}
          </span>
        </span>
      ))}
    </div>
  );
}

function LegendChip({
  color,
  border,
  label,
  dashed,
}: {
  color: string;
  border: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("size-3.5 rounded-sm border", dashed && "border-dashed")}
        style={{ backgroundColor: color, borderColor: border }}
        aria-hidden
      />
      <span>{label}</span>
    </span>
  );
}

interface SubstrateViewProps {
  substrate: NestingViewerInput["substrates"][number];
  substrateIndex: number;
  totalSubstrates: number;
  visualConfig?: NestingViewerInput["visualConfig"];
  costingPreview?: NestingViewerInput["costingPreview"];
  placements: NestingViewerInput["placements"];
  maxPx: number;
  showLabels: boolean;
}

function SubstrateView({
  substrate,
  substrateIndex,
  totalSubstrates,
  visualConfig,
  costingPreview,
  placements,
  maxPx,
  showLabels,
}: SubstrateViewProps) {
  const widthMm = substrate.widthMm;
  const heightMm = substrate.kind === "sheet" ? substrate.heightMm : substrate.lengthMm;
  const longestMm = Math.max(widthMm, heightMm);
  const scale = maxPx / longestMm;
  const wPx = widthMm * scale;
  const hPx = heightMm * scale;
  const padPx = 34;
  const effectiveVisualConfig = getEffectiveVisualConfig(visualConfig, widthMm, heightMm);
  const viewBoxW = wPx + padPx * 2;
  const viewBoxH = hPx + padPx * 2;
  const hasMargins = Object.values(effectiveVisualConfig.margins).some((value) => value > 0);

  return (
    <div className="overflow-hidden rounded-lg border border-[#e7e5e2] bg-white shadow-sm">
      {totalSubstrates > 1 ? (
        <div className="border-b border-[#efece8] px-3 py-2 text-xs font-medium text-muted-foreground">
          Sustrato {substrateIndex + 1} / {totalSubstrates}
        </div>
      ) : null}
      <div
        className="relative overflow-auto bg-[#d7d7d9] p-5"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(20,20,26,.035) 19px, rgba(20,20,26,.035) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(20,20,26,.035) 19px, rgba(20,20,26,.035) 20px)",
        }}
      >
        <svg
          className="relative block"
          viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
          width="100%"
          style={{ maxWidth: Math.max(viewBoxW, 760), minWidth: Math.min(viewBoxW, 760) }}
          preserveAspectRatio="xMinYMin meet"
        >
          <defs>
            <pattern
              id={`margin-pattern-${substrateIndex}`}
              patternUnits="userSpaceOnUse"
              width="7"
              height="7"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="7" stroke="#8b8277" strokeWidth="1" opacity="0.2" />
            </pattern>
          </defs>
          <rect
            x={padPx}
            y={padPx}
            width={wPx}
            height={hPx}
            fill="#fbf6e7"
            stroke="#d9a85b"
            strokeWidth={1.2}
            strokeDasharray={substrate.kind === "roll" ? "4 2" : undefined}
          />
          <CostingOverlay
            costingPreview={getCostingPreviewForSubstrate(
              costingPreview,
              substrateIndex,
              totalSubstrates,
              widthMm,
              heightMm,
            )}
            padPx={padPx}
            scale={scale}
            substrateWidthMm={widthMm}
            substrateHeightMm={heightMm}
            placements={placements}
          />
          {hasMargins ? (
            <MarginsLayer
              visualConfig={effectiveVisualConfig}
              padPx={padPx}
              scale={scale}
              substrateWidthMm={widthMm}
              substrateHeightMm={heightMm}
              patternId={`margin-pattern-${substrateIndex}`}
            />
          ) : null}
          <rect
            x={padPx + effectiveVisualConfig.usableArea.xMm * scale}
            y={padPx + effectiveVisualConfig.usableArea.yMm * scale}
            width={effectiveVisualConfig.usableArea.widthMm * scale}
            height={effectiveVisualConfig.usableArea.heightMm * scale}
            fill="#ffffff"
            fillOpacity={0.18}
            stroke="#9fd6b1"
            strokeWidth={0.9}
            strokeDasharray="4 3"
          />
          <SpacingLayer visualConfig={effectiveVisualConfig} placements={placements} padPx={padPx} scale={scale} />
          <DimensionLabels
            padPx={padPx}
            widthPx={wPx}
            heightPx={hPx}
            widthMm={widthMm}
            heightMm={heightMm}
            kind={substrate.kind}
          />
          {placements.map((placement, idx) => (
            <PlacementRect
              key={`${placement.pieceId}-${idx}`}
              placement={placement}
              index={idx}
              padPx={padPx}
              scale={scale}
              showLabels={showLabels}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

function DimensionLabels({
  padPx,
  widthPx,
  heightPx,
  widthMm,
  heightMm,
  kind,
}: {
  padPx: number;
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
  kind: "sheet" | "roll";
}) {
  return (
    <>
      <text x={padPx + widthPx / 2} y={padPx - 10} textAnchor="middle" fontSize={11} fill="#4b5563" fontFamily="monospace">
        {formatMm(widthMm)} {kind === "roll" ? "(ancho rollo)" : ""}
      </text>
      <text
        x={padPx - 12}
        y={padPx + heightPx / 2}
        textAnchor="middle"
        fontSize={11}
        fill="#4b5563"
        fontFamily="monospace"
        transform={`rotate(-90, ${padPx - 12}, ${padPx + heightPx / 2})`}
      >
        {formatMm(heightMm)} {kind === "roll" ? "(largo consumido)" : ""}
      </text>
    </>
  );
}

function PlacementRect({
  placement,
  index,
  padPx,
  scale,
  showLabels,
}: {
  placement: Placement;
  index: number;
  padPx: number;
  scale: number;
  showLabels: boolean;
}) {
  const x = padPx + placement.xMm * scale;
  const y = padPx + placement.yMm * scale;
  const w = placement.widthMm * scale;
  const h = placement.heightMm * scale;
  const style = colorForKey(placementGroupKey(placement));
  const baseLabel = placementLabel(placement);
  const label =
    placement.panelIndex && placement.panelCount
      ? `${baseLabel} · ${placement.panelIndex}/${placement.panelCount}`
      : baseLabel;
  const overlapStartPx = Math.max(0, placement.overlapStartMm ?? 0) * scale;
  const overlapEndPx = Math.max(0, placement.overlapEndMm ?? 0) * scale;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={style.fill} stroke={style.stroke} strokeWidth={0.8} />
      {placement.panelAxis === "vertical" && overlapStartPx > 0 ? (
        <rect x={x} y={y} width={Math.min(overlapStartPx, w)} height={h} fill="#fef3c7" fillOpacity={0.58} stroke="#d97706" strokeWidth={0.35} />
      ) : null}
      {placement.panelAxis === "vertical" && overlapEndPx > 0 ? (
        <rect x={x + Math.max(0, w - overlapEndPx)} y={y} width={Math.min(overlapEndPx, w)} height={h} fill="#fef3c7" fillOpacity={0.58} stroke="#d97706" strokeWidth={0.35} />
      ) : null}
      {placement.panelAxis === "horizontal" && overlapStartPx > 0 ? (
        <rect x={x} y={y} width={w} height={Math.min(overlapStartPx, h)} fill="#fef3c7" fillOpacity={0.58} stroke="#d97706" strokeWidth={0.35} />
      ) : null}
      {placement.panelAxis === "horizontal" && overlapEndPx > 0 ? (
        <rect x={x} y={y + Math.max(0, h - overlapEndPx)} width={w} height={Math.min(overlapEndPx, h)} fill="#fef3c7" fillOpacity={0.58} stroke="#d97706" strokeWidth={0.35} />
      ) : null}
      {placement.rotated ? (
        <line x1={x} y1={y} x2={x + w} y2={y + h} stroke={style.text} strokeWidth={0.45} strokeDasharray="3 3" opacity={0.35} />
      ) : null}
      {showLabels && w > 24 && h > 14 ? (
        <>
          <text
            x={x + w / 2}
            y={y + h / 2 + 3}
            textAnchor="middle"
            fontSize={Math.min(12, Math.max(7, Math.min(w, h) / 7))}
            fontFamily="monospace"
            fontWeight={600}
            fill={style.text}
            pointerEvents="none"
          >
            {label}
          </text>
          {w > 54 && h > 30 ? (
            <text x={x + 6} y={y + 12} fontSize={7.5} fontFamily="monospace" fill={style.text} fillOpacity={0.55} pointerEvents="none">
              P-{String(index + 1).padStart(2, "0")}
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

function NestingFooter({ result }: { result: NestingViewerInput }) {
  const placedAreaMm2 = result.placements.reduce((acc, p) => acc + p.widthMm * p.heightMm, 0);
  const chargedArea = result.costingPreview?.chargedAreaMm2;
  const chargedLength = result.costingPreview?.chargedLengthMm;

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 border-t border-[#efece8] px-4 py-3 text-xs text-muted-foreground">
      <span>
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.07em]">Área piezas</span>
        <strong className="font-mono font-semibold text-foreground">{formatM2(placedAreaMm2)}</strong>
      </span>
      {chargedArea ? (
        <span>
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.07em]">Área costeada</span>
          <strong className="font-mono font-semibold text-foreground">{formatM2(chargedArea)}</strong>
        </span>
      ) : null}
      {chargedLength ? (
        <span>
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.07em]">Largo costeado</span>
          <strong className="font-mono font-semibold text-foreground">{formatMm(chargedLength)}</strong>
        </span>
      ) : null}
    </div>
  );
}

function TalonarioGrouping({
  grouping,
}: {
  grouping?: NestingViewerInput["talonarioGrouping"];
}) {
  if (!grouping) return null;
  const modoIncompletoLabel: Record<string, string> = {
    PERMITIR: "permite incompletos",
    DESCARTAR: "descarta incompletos",
    REDONDEAR_ARRIBA: "redondea hacia arriba",
  };

  return (
    <div className="flex flex-wrap gap-3 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
      <span className="font-semibold">Talonario</span>
      <span>{grouping.talonariosEfectivos}/{grouping.talonariosPedidos} efectivos</span>
      <span>{grouping.gruposCompletos} grupo(s) + {grouping.talonariosResiduo} residuo</span>
      <span>{grouping.pliegosXCapa} pliegos × capa</span>
      {grouping.pliegosDesperdicio > 0 ? <span>{grouping.pliegosDesperdicio} pliegos desperdicio</span> : null}
      <span>modo: {modoIncompletoLabel[grouping.modoIncompleto] ?? grouping.modoIncompleto}</span>
    </div>
  );
}

function getCostingPreviewForSubstrate(
  costingPreview: NestingViewerInput["costingPreview"] | undefined,
  substrateIndex: number,
  totalSubstrates: number,
  widthMm: number,
  heightMm: number,
): NestingViewerInput["costingPreview"] | undefined {
  if (!costingPreview || costingPreview.strategy !== "plate-segments" || totalSubstrates <= 1) {
    return costingPreview;
  }

  if (substrateIndex < totalSubstrates - 1) {
    return {
      ...costingPreview,
      chargedRatio: 1,
      chargedBounds: { xMm: 0, yMm: 0, widthMm, heightMm },
      segmentAppliedPct: 100,
    };
  }

  return costingPreview;
}

function getEffectiveVisualConfig(
  visualConfig: NestingViewerInput["visualConfig"] | undefined,
  widthMm: number,
  heightMm: number,
): VisualConfig {
  return (
    visualConfig ?? {
      margins: { leftMm: 0, rightMm: 0, topMm: 0, bottomMm: 0 },
      spacing: { horizontalMm: 0, verticalMm: 0 },
      allowRotation: true,
      usableArea: { xMm: 0, yMm: 0, widthMm, heightMm },
    }
  );
}

function MarginsLayer({
  visualConfig,
  padPx,
  scale,
  substrateWidthMm,
  substrateHeightMm,
  patternId,
}: {
  visualConfig: VisualConfig;
  padPx: number;
  scale: number;
  substrateWidthMm: number;
  substrateHeightMm: number;
  patternId: string;
}) {
  const { leftMm, rightMm, topMm, bottomMm } = visualConfig.margins;
  const fill = `url(#${patternId})`;
  return (
    <g opacity={0.95}>
      {topMm > 0 ? <rect x={padPx} y={padPx} width={substrateWidthMm * scale} height={topMm * scale} fill={fill} /> : null}
      {bottomMm > 0 ? (
        <rect x={padPx} y={padPx + (substrateHeightMm - bottomMm) * scale} width={substrateWidthMm * scale} height={bottomMm * scale} fill={fill} />
      ) : null}
      {leftMm > 0 ? <rect x={padPx} y={padPx} width={leftMm * scale} height={substrateHeightMm * scale} fill={fill} /> : null}
      {rightMm > 0 ? (
        <rect x={padPx + (substrateWidthMm - rightMm) * scale} y={padPx} width={rightMm * scale} height={substrateHeightMm * scale} fill={fill} />
      ) : null}
    </g>
  );
}

function CostingOverlay({
  costingPreview,
  padPx,
  scale,
  substrateWidthMm,
  substrateHeightMm,
  placements,
}: {
  costingPreview?: NestingViewerInput["costingPreview"];
  padPx: number;
  scale: number;
  substrateWidthMm: number;
  substrateHeightMm: number;
  placements: NestingViewerInput["placements"];
}) {
  if (!costingPreview || costingPreview.strategy === "simple") return null;

  if (costingPreview.strategy === "m2-exact") {
    return (
      <g>
        {placements.map((placement, idx) => (
          <rect
            key={`cost-${placement.pieceId}-${idx}`}
            x={padPx + placement.xMm * scale}
            y={padPx + placement.yMm * scale}
            width={placement.widthMm * scale}
            height={placement.heightMm * scale}
            fill="#fff1c8"
            fillOpacity={0.4}
            stroke="#e7be58"
            strokeWidth={0.5}
          />
        ))}
      </g>
    );
  }

  const bounds = costingPreview.chargedBounds ?? {
    xMm: 0,
    yMm: 0,
    widthMm: substrateWidthMm,
    heightMm: substrateHeightMm * (costingPreview.chargedRatio ?? 1),
  };

  return (
    <g>
      <rect
        x={padPx + bounds.xMm * scale}
        y={padPx + bounds.yMm * scale}
        width={bounds.widthMm * scale}
        height={bounds.heightMm * scale}
        fill="#fff1c8"
        fillOpacity={0.62}
        stroke="#e7be58"
        strokeWidth={0.8}
      />
      {costingPreview.wasteAreaMm2 && costingPreview.wasteAreaMm2 > 0 ? (
        <rect
          x={padPx + bounds.xMm * scale}
          y={padPx + bounds.yMm * scale}
          width={bounds.widthMm * scale}
          height={bounds.heightMm * scale}
          fill="#fef3ed"
          fillOpacity={0.3}
          stroke="#f4b9a0"
          strokeWidth={0.5}
          strokeDasharray="3 3"
        />
      ) : null}
    </g>
  );
}

function SpacingLayer({
  visualConfig,
  placements,
  padPx,
  scale,
}: {
  visualConfig: VisualConfig;
  placements: NestingViewerInput["placements"];
  padPx: number;
  scale: number;
}) {
  const sepH = visualConfig.spacing.horizontalMm;
  const sepV = visualConfig.spacing.verticalMm;
  if (sepH <= 0 && sepV <= 0) return null;

  return (
    <g opacity={0.34}>
      {placements.map((placement, idx) => {
        const rightGapX = placement.xMm + placement.widthMm;
        const bottomGapY = placement.yMm + placement.heightMm;
        const hasRightNeighbor = sepH > 0 && hasAdjacentPlacement(placement, placements, "right", sepH);
        const hasBottomNeighbor = sepV > 0 && hasAdjacentPlacement(placement, placements, "bottom", sepV);
        return (
          <React.Fragment key={`spacing-${placement.pieceId}-${idx}`}>
            {hasRightNeighbor ? (
              <rect x={padPx + rightGapX * scale} y={padPx + placement.yMm * scale} width={Math.max(1, sepH * scale)} height={placement.heightMm * scale} fill="#a8a29e" />
            ) : null}
            {hasBottomNeighbor ? (
              <rect x={padPx + placement.xMm * scale} y={padPx + bottomGapY * scale} width={placement.widthMm * scale} height={Math.max(1, sepV * scale)} fill="#a8a29e" />
            ) : null}
          </React.Fragment>
        );
      })}
    </g>
  );
}

function hasAdjacentPlacement(
  placement: Placement,
  placements: NestingViewerInput["placements"],
  direction: "right" | "bottom",
  separationMm: number,
) {
  const expectedX = direction === "right" ? placement.xMm + placement.widthMm + separationMm : placement.xMm;
  const expectedY = direction === "bottom" ? placement.yMm + placement.heightMm + separationMm : placement.yMm;
  const toleranceMm = 0.01;

  return placements.some((other) => {
    if (other === placement) return false;
    if ((other.substrateIndex ?? 0) !== (placement.substrateIndex ?? 0)) return false;
    if (direction === "right") {
      return (
        nearlyEqual(other.xMm, expectedX, toleranceMm) &&
        rangesOverlap(placement.yMm, placement.yMm + placement.heightMm, other.yMm, other.yMm + other.heightMm, toleranceMm)
      );
    }
    return (
      nearlyEqual(other.yMm, expectedY, toleranceMm) &&
      rangesOverlap(placement.xMm, placement.xMm + placement.widthMm, other.xMm, other.xMm + other.widthMm, toleranceMm)
    );
  });
}

function nearlyEqual(a: number, b: number, tolerance: number) {
  return Math.abs(a - b) <= tolerance;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number, tolerance: number) {
  return aStart < bEnd - tolerance && bStart < aEnd - tolerance;
}
