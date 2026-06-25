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
type DisplayTransform = {
  rotated: boolean;
  substrateWidthMm: number;
  substrateHeightMm: number;
  scale: number;
  padPx: number;
  offsetXMm?: number;
  offsetYMm?: number;
};

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

function formatMeasurePair(widthMm: number, heightMm: number): string {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return "-";
  if (widthMm >= 100 && heightMm >= 100) {
    return `${formatNumber(widthMm / 10, 1)}×${formatNumber(heightMm / 10, 1)} cm`;
  }
  return `${formatMm(widthMm)}×${formatMm(heightMm)}`;
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
    case "pouches":
      return "pouches";
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
  if (placement.panelIndex && placement.panelCount) {
    return formatMeasurePair(placement.widthMm, placement.heightMm);
  }
  const meta = placement.meta as { label?: string } | undefined;
  if (meta?.label) return meta.label;
  return formatMeasurePair(
    placement.usefulWidthMm ?? placement.widthMm,
    placement.usefulHeightMm ?? placement.heightMm,
  );
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
    <section className={cn("nesting-viewer", className)}>
      <div className="nesting-strat-row">
        <div className="nesting-strat on">
          <span className="ix">
            01
          </span>
          <span>{algorithmLabel(result.algorithm)}</span>
          <span className="yield">
            {formatNumber(result.aprovechamientoPct, 1)}%
          </span>
        </div>
        {result.costingPreview ? (
          <div className="right">
            Costeo: <strong className="font-semibold text-foreground">{result.costingPreview.label}</strong>
          </div>
        ) : null}
      </div>

      <div className="nesting-stats">
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

      <div className="nesting-canvas-list">
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
      <NestingOutputsSummary outputs={result.outputsCanonicos} />
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
    <div className={cn("nesting-stat", featured && "featured")}>
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
      {hint ? <div className="sub" title={hint}>{hint}</div> : null}
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
          "Demasía",
          `${formatMm(getPieceBleedMm(visualConfig))} por lado`,
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
    <div className="nesting-config">
      {configItems.map(([key, value]) => (
        <div key={key} className="grp">
          <span className="k">{key}</span>
          <span className="v">{value}</span>
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
    <div className="nesting-costing">
      {items.map((item) => {
        const detalle = item.detalleCosteoNesting!;
        return (
          <div key={`${item.materialNombre}-${detalle.strategy}`}>
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

function NestingOutputsSummary({
  outputs,
}: {
  outputs?: NestingViewerInput["outputsCanonicos"];
}) {
  const items = getDisplayableOutputs(outputs);
  if (items.length === 0) return null;

  return (
    <div className="nesting-outputs">
      <div className="lbl">
        Outputs del nesting
      </div>
      <div className="items">
        {items.map(([key, value]) => (
          <div key={key} className="out">
            <span className="k" title={key}>
              {humanOutputLabel(key)}
            </span>
            <span className="v" title={value}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDisplayableOutputs(outputs?: NestingViewerInput["outputsCanonicos"]) {
  if (!outputs) return [];
  const preferred = [
    "pliegos_calculados",
    "poses_por_pliego",
    "cortes_calculados",
    "pliego_impresion_ancho_mm",
    "pliego_impresion_alto_mm",
    "pliego_impresion_area_m2",
  ];
  return preferred
    .filter((key) => outputs[key] != null)
    .map((key) => [key, formatOutputValue(key, outputs[key])] as [string, string])
    .filter(([, value]) => value.length > 0);
}

function formatOutputValue(key: string, value: unknown) {
  if (typeof value === "number") {
    if (key.endsWith("_mm")) return formatMm(value);
    if (key.endsWith("_m2")) return formatM2(value * 1_000_000);
    return formatNumber(value, 2);
  }
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && key === "cortes_calculados") {
    const cuts = value as {
      cortesTotales?: unknown;
      columnas?: unknown;
      filas?: unknown;
      demasiaMm?: unknown;
      formula?: unknown;
    };
    const total = Number(cuts.cortesTotales ?? 0);
    const columnas = Number(cuts.columnas ?? 0);
    const filas = Number(cuts.filas ?? 0);
    const demasia = Number(cuts.demasiaMm ?? 0);
    const base = `${formatNumber(total, 0)} cortes`;
    const grid = columnas > 0 && filas > 0 ? ` · ${columnas} col × ${filas} filas` : "";
    const bleed = demasia > 0 ? ` · demasía ${formatMm(demasia)}` : " · sin demasía";
    return `${base}${grid}${bleed}`;
  }
  return "";
}

function humanOutputLabel(key: string) {
  const labels: Record<string, string> = {
    pliegos_calculados: "Pliegos",
    poses_por_pliego: "Poses por pliego",
    cortes_calculados: "Cortes",
    pliego_impresion_ancho_mm: "Ancho pliego",
    pliego_impresion_alto_mm: "Alto pliego",
    pliego_impresion_area_m2: "Área pliego",
  };
  return labels[key] ?? key.replaceAll("_", " ");
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
  const hasBleed = visualConfig && getPieceBleedMm(visualConfig) > 0;
  const showCosting = costingPreview && costingPreview.strategy !== "simple";
  const hasPanelizado = visualConfig?.panelizado?.enabled === true;

  if (pieceGroups.length === 0 && !hasMargins && !hasBleed && !showCosting && !hasPanelizado) return null;

  return (
    <div className="nesting-legend">
      <span className="lbl">Referencias</span>
      <LegendChip color="#ffffff" border="#b8d8c2" label="Área útil" dashed />
      {hasMargins ? <LegendChip color="#fff4df" border="#e9b978" label="Márgenes" /> : null}
      {showCosting ? <LegendChip color="#fff1c8" border="#e7be58" label="Área costeada" /> : null}
      {costingPreview?.wasteAreaMm2 ? <LegendChip color="#fef3ed" border="#f4b9a0" label="Desperdicio" dashed /> : null}
      {hasBleed ? <LegendChip color="#e7e5e4" border="#bdb9b4" label="Demasía" /> : null}
      {hasPanelizado ? <LegendChip color="#fef3c7" border="#d97706" label="Solape" /> : null}
      {pieceGroups.map((piece) => (
        <span key={piece.key} className="lg-item">
          <span
            className="sw"
            style={{ backgroundColor: piece.style.fill, borderColor: piece.style.stroke }}
            aria-hidden
          />
          <span className="nm">{piece.label}</span>
          <span className="ct">{piece.count}</span>
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
    <span className="lg-item">
      <span
        className={cn("sw", dashed && "dashed")}
        style={{ backgroundColor: color, borderColor: border }}
        aria-hidden
      />
      <span className="nm">{label}</span>
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
  const displayLandscape = shouldDisplaySheetLandscape(substrate.kind, widthMm, heightMm);
  const displayWidthMm = displayLandscape ? heightMm : widthMm;
  const displayHeightMm = displayLandscape ? widthMm : heightMm;
  const longestMm = Math.max(displayWidthMm, displayHeightMm);
  const scale = maxPx / longestMm;
  const wPx = displayWidthMm * scale;
  const hPx = displayHeightMm * scale;
  const padPx = 34;
  const effectiveVisualConfig = getEffectiveVisualConfig(visualConfig, widthMm, heightMm);
  const displayTransform: DisplayTransform = {
    rotated: displayLandscape,
    substrateWidthMm: widthMm,
    substrateHeightMm: heightMm,
    scale,
    padPx,
  };
  const placementTransform = getCenteredPlacementTransform(
    displayTransform,
    placements,
    effectiveVisualConfig,
    substrate.kind,
  );
  const viewBoxW = wPx + padPx * 2;
  const viewBoxH = hPx + padPx * 2;
  const hasMargins = Object.values(effectiveVisualConfig.margins).some((value) => value > 0);
  const largeSheet = substrate.kind === "sheet" && Math.max(widthMm, heightMm) >= 1000;
  const canvasMaxWidth = Math.min(
    Math.max(viewBoxW, substrate.kind === "sheet" ? (largeSheet ? 820 : 520) : 680),
    substrate.kind === "sheet" ? (largeSheet ? 1180 : 760) : 980,
  );
  const substrateRect = mapDisplayRect(displayTransform, 0, 0, widthMm, heightMm);
  const printableArea = getPrintableArea(effectiveVisualConfig, widthMm, heightMm);
  const printableClipRect = mapDisplayRect(
    displayTransform,
    printableArea.xMm,
    printableArea.yMm,
    printableArea.widthMm,
    printableArea.heightMm,
  );

  return (
    <div className="nesting-substrate">
      {totalSubstrates > 1 ? (
        <div className="substrate-head">
          Sustrato {substrateIndex + 1} / {totalSubstrates}
        </div>
      ) : null}
      <div className="nesting-canvas-wrap">
        <svg
          className="nesting-canvas-svg"
          viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
          width="100%"
          style={{ maxWidth: `${canvasMaxWidth}px` }}
          preserveAspectRatio="xMidYMin meet"
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
            <clipPath id={`printable-clip-${substrateIndex}`}>
              <rect
                x={printableClipRect.x}
                y={printableClipRect.y}
                width={printableClipRect.width}
                height={printableClipRect.height}
              />
            </clipPath>
          </defs>
          <rect
            x={substrateRect.x}
            y={substrateRect.y}
            width={substrateRect.width}
            height={substrateRect.height}
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
            displayTransform={displayTransform}
            placementTransform={placementTransform}
          />
          {hasMargins ? (
            <MarginsLayer
              visualConfig={effectiveVisualConfig}
              padPx={padPx}
              scale={scale}
              substrateWidthMm={widthMm}
              substrateHeightMm={heightMm}
              patternId={`margin-pattern-${substrateIndex}`}
              displayTransform={displayTransform}
            />
          ) : null}
          <PrintableAreaLayer
            visualConfig={effectiveVisualConfig}
            padPx={padPx}
            scale={scale}
            substrateWidthMm={widthMm}
            substrateHeightMm={heightMm}
            displayTransform={displayTransform}
          />
          <SpacingLayer
            visualConfig={effectiveVisualConfig}
            placements={placements}
            padPx={padPx}
            scale={scale}
            clipPathId={`printable-clip-${substrateIndex}`}
            displayTransform={placementTransform}
          />
          <DimensionLabels
            padPx={padPx}
            widthPx={wPx}
            heightPx={hPx}
            widthMm={displayWidthMm}
            heightMm={displayHeightMm}
            kind={substrate.kind}
          />
          <g clipPath={substrate.kind === "roll" ? `url(#printable-clip-${substrateIndex})` : undefined}>
            {placements.map((placement, idx) => (
              <PlacementRect
                key={`${placement.pieceId}-${idx}`}
                placement={placement}
                index={idx}
                showLabels={showLabels}
                displayTransform={placementTransform}
              />
            ))}
          </g>
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
  showLabels,
  displayTransform,
}: {
  placement: Placement;
  index: number;
  showLabels: boolean;
  displayTransform: DisplayTransform;
}) {
  const rect = mapDisplayRect(displayTransform, placement.xMm, placement.yMm, placement.widthMm, placement.heightMm);
  const { x, y, width: w, height: h } = rect;
  const style = colorForKey(placementGroupKey(placement));
  const baseLabel = placementLabel(placement);
  const label =
    placement.panelIndex && placement.panelCount
      ? `${baseLabel} · ${placement.panelIndex}/${placement.panelCount}`
      : baseLabel;
  const labelFontSize = Math.min(
    12,
    Math.max(0, (w - 8) / Math.max(1, label.length * 0.62)),
    Math.max(0, h * 0.22),
  );
  const showMainLabel = showLabels && w > 24 && h > 14 && labelFontSize >= 5;
  const overlapStartMm = Math.max(0, placement.overlapStartMm ?? 0);
  const overlapEndMm = Math.max(0, placement.overlapEndMm ?? 0);
  const verticalStart = overlapStartMm > 0
    ? mapDisplayRect(displayTransform, placement.xMm, placement.yMm, Math.min(overlapStartMm, placement.widthMm), placement.heightMm)
    : null;
  const verticalEnd = overlapEndMm > 0
    ? mapDisplayRect(
      displayTransform,
      placement.xMm + Math.max(0, placement.widthMm - overlapEndMm),
      placement.yMm,
      Math.min(overlapEndMm, placement.widthMm),
      placement.heightMm,
    )
    : null;
  const horizontalStart = overlapStartMm > 0
    ? mapDisplayRect(displayTransform, placement.xMm, placement.yMm, placement.widthMm, Math.min(overlapStartMm, placement.heightMm))
    : null;
  const horizontalEnd = overlapEndMm > 0
    ? mapDisplayRect(
      displayTransform,
      placement.xMm,
      placement.yMm + Math.max(0, placement.heightMm - overlapEndMm),
      placement.widthMm,
      Math.min(overlapEndMm, placement.heightMm),
    )
    : null;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={style.fill} stroke={style.stroke} strokeWidth={0.8} />
      {placement.panelAxis === "vertical" && verticalStart ? (
        <rect x={verticalStart.x} y={verticalStart.y} width={verticalStart.width} height={verticalStart.height} fill="#fef3c7" fillOpacity={0.58} stroke="#d97706" strokeWidth={0.35} />
      ) : null}
      {placement.panelAxis === "vertical" && verticalEnd ? (
        <rect x={verticalEnd.x} y={verticalEnd.y} width={verticalEnd.width} height={verticalEnd.height} fill="#fef3c7" fillOpacity={0.58} stroke="#d97706" strokeWidth={0.35} />
      ) : null}
      {placement.panelAxis === "horizontal" && horizontalStart ? (
        <rect x={horizontalStart.x} y={horizontalStart.y} width={horizontalStart.width} height={horizontalStart.height} fill="#fef3c7" fillOpacity={0.58} stroke="#d97706" strokeWidth={0.35} />
      ) : null}
      {placement.panelAxis === "horizontal" && horizontalEnd ? (
        <rect x={horizontalEnd.x} y={horizontalEnd.y} width={horizontalEnd.width} height={horizontalEnd.height} fill="#fef3c7" fillOpacity={0.58} stroke="#d97706" strokeWidth={0.35} />
      ) : null}
      {placement.rotated ? (
        <line x1={x} y1={y} x2={x + w} y2={y + h} stroke={style.text} strokeWidth={0.45} strokeDasharray="3 3" opacity={0.35} />
      ) : null}
      {showMainLabel ? (
        <>
          <text
            x={x + w / 2}
            y={y + h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={labelFontSize}
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
    <div className="nesting-footer">
      <span className="grow" />
      <span>
        <span className="k">Área piezas</span>
        <strong className="v">{formatM2(placedAreaMm2)}</strong>
      </span>
      {chargedArea ? (
        <span>
          <span className="k">Área costeada</span>
          <strong className="v">{formatM2(chargedArea)}</strong>
        </span>
      ) : null}
      {chargedLength ? (
        <span>
          <span className="k">Largo costeado</span>
          <strong className="v">{formatMm(chargedLength)}</strong>
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
      pieceBleedMm: 0,
      allowRotation: true,
      usableArea: { xMm: 0, yMm: 0, widthMm, heightMm },
      printableArea: { xMm: 0, yMm: 0, widthMm, heightMm },
    }
  );
}

function getPrintableArea(visualConfig: VisualConfig, widthMm: number, heightMm: number) {
  return visualConfig.printableArea ?? {
    xMm: visualConfig.margins.leftMm,
    yMm: visualConfig.margins.topMm,
    widthMm: Math.max(0, widthMm - visualConfig.margins.leftMm - visualConfig.margins.rightMm),
    heightMm: Math.max(0, heightMm - visualConfig.margins.topMm - visualConfig.margins.bottomMm),
  };
}

function shouldDisplaySheetLandscape(kind: "sheet" | "roll", widthMm: number, heightMm: number) {
  return kind === "sheet" && heightMm > widthMm * 1.12 && Math.max(widthMm, heightMm) >= 1000;
}

function getCenteredPlacementTransform(
  transform: DisplayTransform,
  placements: NestingViewerInput["placements"],
  visualConfig: VisualConfig,
  substrateKind: "sheet" | "roll",
): DisplayTransform {
  if (substrateKind !== "sheet" || placements.length === 0) return transform;

  const bounds = placements.reduce(
    (acc, placement) => ({
      minX: Math.min(acc.minX, placement.xMm),
      minY: Math.min(acc.minY, placement.yMm),
      maxX: Math.max(acc.maxX, placement.xMm + placement.widthMm),
      maxY: Math.max(acc.maxY, placement.yMm + placement.heightMm),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );

  const usableArea = visualConfig.usableArea;
  const contentWidthMm = bounds.maxX - bounds.minX;
  const contentHeightMm = bounds.maxY - bounds.minY;
  const extraXMm = usableArea.widthMm - contentWidthMm;
  const extraYMm = usableArea.heightMm - contentHeightMm;

  return {
    ...transform,
    offsetXMm: extraXMm > 0.01 ? usableArea.xMm + extraXMm / 2 - bounds.minX : 0,
    offsetYMm: extraYMm > 0.01 ? usableArea.yMm + extraYMm / 2 - bounds.minY : 0,
  };
}

function mapDisplayRect(
  transform: DisplayTransform,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
) {
  const { padPx, scale } = transform;
  const displayXMm = xMm + (transform.offsetXMm ?? 0);
  const displayYMm = yMm + (transform.offsetYMm ?? 0);
  if (!transform.rotated) {
    return {
      x: padPx + displayXMm * scale,
      y: padPx + displayYMm * scale,
      width: widthMm * scale,
      height: heightMm * scale,
    };
  }

  return {
    x: padPx + (transform.substrateHeightMm - displayYMm - heightMm) * scale,
    y: padPx + displayXMm * scale,
    width: heightMm * scale,
    height: widthMm * scale,
  };
}

function getPieceBleedMm(visualConfig: VisualConfig) {
  const explicit = visualConfig.pieceBleedMm;
  if (Number.isFinite(explicit) && explicit != null) {
    return Math.max(0, explicit);
  }
  return Math.max(visualConfig.spacing.horizontalMm, visualConfig.spacing.verticalMm) / 2;
}

function PrintableAreaLayer({
  visualConfig,
  substrateWidthMm,
  substrateHeightMm,
  displayTransform,
}: {
  visualConfig: VisualConfig;
  padPx: number;
  scale: number;
  substrateWidthMm: number;
  substrateHeightMm: number;
  displayTransform: DisplayTransform;
}) {
  const printableArea = getPrintableArea(visualConfig, substrateWidthMm, substrateHeightMm);
  const rect = mapDisplayRect(displayTransform, printableArea.xMm, printableArea.yMm, printableArea.widthMm, printableArea.heightMm);
  return (
    <rect
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      fill="#ffffff"
      fillOpacity={0.18}
      stroke="#9fd6b1"
      strokeWidth={0.9}
      strokeDasharray="4 3"
    />
  );
}

function MarginsLayer({
  visualConfig,
  substrateWidthMm,
  substrateHeightMm,
  patternId,
  displayTransform,
}: {
  visualConfig: VisualConfig;
  padPx: number;
  scale: number;
  substrateWidthMm: number;
  substrateHeightMm: number;
  patternId: string;
  displayTransform: DisplayTransform;
}) {
  const { leftMm, rightMm, topMm, bottomMm } = visualConfig.margins;
  const fill = `url(#${patternId})`;
  const top = mapDisplayRect(displayTransform, 0, 0, substrateWidthMm, topMm);
  const bottom = mapDisplayRect(displayTransform, 0, substrateHeightMm - bottomMm, substrateWidthMm, bottomMm);
  const left = mapDisplayRect(displayTransform, 0, 0, leftMm, substrateHeightMm);
  const right = mapDisplayRect(displayTransform, substrateWidthMm - rightMm, 0, rightMm, substrateHeightMm);
  return (
    <g opacity={0.95}>
      {topMm > 0 ? <rect x={top.x} y={top.y} width={top.width} height={top.height} fill={fill} /> : null}
      {bottomMm > 0 ? (
        <rect x={bottom.x} y={bottom.y} width={bottom.width} height={bottom.height} fill={fill} />
      ) : null}
      {leftMm > 0 ? <rect x={left.x} y={left.y} width={left.width} height={left.height} fill={fill} /> : null}
      {rightMm > 0 ? (
        <rect x={right.x} y={right.y} width={right.width} height={right.height} fill={fill} />
      ) : null}
    </g>
  );
}

function CostingOverlay({
  costingPreview,
  substrateWidthMm,
  substrateHeightMm,
  placements,
  displayTransform,
  placementTransform,
}: {
  costingPreview?: NestingViewerInput["costingPreview"];
  padPx: number;
  scale: number;
  substrateWidthMm: number;
  substrateHeightMm: number;
  placements: NestingViewerInput["placements"];
  displayTransform: DisplayTransform;
  placementTransform: DisplayTransform;
}) {
  if (!costingPreview || costingPreview.strategy === "simple") return null;

  if (costingPreview.strategy === "m2-exact") {
    return (
      <g>
        {placements.map((placement, idx) => (
          <CostingRect key={`cost-${placement.pieceId}-${idx}`} rect={mapDisplayRect(placementTransform, placement.xMm, placement.yMm, placement.widthMm, placement.heightMm)} />
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
        {...svgRect(mapDisplayRect(displayTransform, bounds.xMm, bounds.yMm, bounds.widthMm, bounds.heightMm))}
        fill="#fff1c8"
        fillOpacity={0.62}
        stroke="#e7be58"
        strokeWidth={0.8}
      />
      {costingPreview.wasteAreaMm2 && costingPreview.wasteAreaMm2 > 0 ? (
        <rect
          {...svgRect(mapDisplayRect(displayTransform, bounds.xMm, bounds.yMm, bounds.widthMm, bounds.heightMm))}
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

function CostingRect({ rect }: { rect: ReturnType<typeof mapDisplayRect> }) {
  return (
    <rect
      {...svgRect(rect)}
      fill="#fff1c8"
      fillOpacity={0.4}
      stroke="#e7be58"
      strokeWidth={0.5}
    />
  );
}

function svgRect(rect: ReturnType<typeof mapDisplayRect>) {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function SpacingLayer({
  visualConfig,
  placements,
  clipPathId,
  displayTransform,
}: {
  visualConfig: VisualConfig;
  placements: NestingViewerInput["placements"];
  padPx: number;
  scale: number;
  clipPathId: string;
  displayTransform: DisplayTransform;
}) {
  const sepH = visualConfig.spacing.horizontalMm;
  const sepV = visualConfig.spacing.verticalMm;
  const pieceBleedMm = getPieceBleedMm(visualConfig);
  if (sepH <= 0 && sepV <= 0 && pieceBleedMm <= 0) return null;

  return (
    <g opacity={0.34} clipPath={`url(#${clipPathId})`}>
      {placements.map((placement, idx) => {
        const leftGapX = placement.xMm - pieceBleedMm;
        const topGapY = placement.yMm - pieceBleedMm;
        const rightGapX = placement.xMm + placement.widthMm;
        const bottomGapY = placement.yMm + placement.heightMm;
        const hasLeftNeighbor = sepH > 0 && hasAdjacentPlacement(placement, placements, "left", sepH);
        const hasRightNeighbor = sepH > 0 && hasAdjacentPlacement(placement, placements, "right", sepH);
        const hasTopNeighbor = sepV > 0 && hasAdjacentPlacement(placement, placements, "top", sepV);
        const hasBottomNeighbor = sepV > 0 && hasAdjacentPlacement(placement, placements, "bottom", sepV);
        const leftBleed = mapDisplayRect(displayTransform, leftGapX, placement.yMm, pieceBleedMm, placement.heightMm);
        const rightBleed = mapDisplayRect(displayTransform, rightGapX, placement.yMm, hasRightNeighbor ? sepH : pieceBleedMm, placement.heightMm);
        const topBleed = mapDisplayRect(displayTransform, placement.xMm, topGapY, placement.widthMm, pieceBleedMm);
        const bottomBleed = mapDisplayRect(displayTransform, placement.xMm, bottomGapY, placement.widthMm, hasBottomNeighbor ? sepV : pieceBleedMm);
        return (
          <React.Fragment key={`spacing-${placement.pieceId}-${idx}`}>
            {pieceBleedMm > 0 && !hasLeftNeighbor ? (
              <rect {...svgRectWithMinimum(leftBleed)} fill="#a8a29e" />
            ) : null}
            {hasRightNeighbor ? (
              <rect {...svgRectWithMinimum(rightBleed)} fill="#a8a29e" />
            ) : pieceBleedMm > 0 ? (
              <rect {...svgRectWithMinimum(rightBleed)} fill="#a8a29e" />
            ) : null}
            {pieceBleedMm > 0 && !hasTopNeighbor ? (
              <rect {...svgRectWithMinimum(topBleed)} fill="#a8a29e" />
            ) : null}
            {hasBottomNeighbor ? (
              <rect {...svgRectWithMinimum(bottomBleed)} fill="#a8a29e" />
            ) : pieceBleedMm > 0 ? (
              <rect {...svgRectWithMinimum(bottomBleed)} fill="#a8a29e" />
            ) : null}
          </React.Fragment>
        );
      })}
    </g>
  );
}

function svgRectWithMinimum(rect: ReturnType<typeof mapDisplayRect>) {
  return {
    x: rect.x,
    y: rect.y,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
  };
}

function hasAdjacentPlacement(
  placement: Placement,
  placements: NestingViewerInput["placements"],
  direction: "left" | "right" | "top" | "bottom",
  separationMm: number,
) {
  const expectedX =
    direction === "right"
      ? placement.xMm + placement.widthMm + separationMm
      : direction === "left"
        ? placement.xMm - separationMm
        : placement.xMm;
  const expectedY =
    direction === "bottom"
      ? placement.yMm + placement.heightMm + separationMm
      : direction === "top"
        ? placement.yMm - separationMm
        : placement.yMm;
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
    if (direction === "left") {
      return (
        nearlyEqual(other.xMm + other.widthMm, expectedX, toleranceMm) &&
        rangesOverlap(placement.yMm, placement.yMm + placement.heightMm, other.yMm, other.yMm + other.heightMm, toleranceMm)
      );
    }
    if (direction === "top") {
      return (
        nearlyEqual(other.yMm + other.heightMm, expectedY, toleranceMm) &&
        rangesOverlap(placement.xMm, placement.xMm + placement.widthMm, other.xMm, other.xMm + other.widthMm, toleranceMm)
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
