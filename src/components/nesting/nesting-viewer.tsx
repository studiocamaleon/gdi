"use client";

/**
 * <NestingViewer /> — visualizador SVG único reusable por todos los algoritmos.
 *
 * Reemplaza cualquier visualización 3D (Three.js / WebGL) del modelo viejo.
 * El backend (G-M1) emite todos los algoritmos con el mismo shape
 * `NestingViewerInput`, así que un solo componente sirve para todos:
 *
 *   - shelf-rollo (gran formato sobre rollo)
 *   - grid-2d-single (digital sobre pliego)
 *   - grid-2d-multi / packingsolver-rectangle (rígidos sobre placa)
 *
 * Diseño:
 *   - SVG declarativo (sin canvas, sin libs externas).
 *   - El sustrato es el "lienzo" (rollo vertical o pliego rectangular).
 *   - Cada placement se dibuja como rect con label opcional.
 *   - Color codificado por `pieceId` para distinguir piezas.
 *   - Flechas de medidas y labels arriba/al costado.
 *
 * Props:
 *   - `result`: el `NestingViewerInput` que devuelve el motor.
 *   - `maxPx?`: tamaño máximo de la cara más larga (default 480).
 *   - `showLabels?`: dibujar etiquetas dentro de cada pieza (default true).
 */

import * as React from "react";
import type { NestingViewerInput } from "@/lib/productos-servicios-api";

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
  "#60a5fa", // blue-400
  "#34d399", // emerald-400
  "#fbbf24", // amber-400
  "#f472b6", // pink-400
  "#a78bfa", // violet-400
  "#fb923c", // orange-400
  "#22d3ee", // cyan-400
  "#a3e635", // lime-400
];

function colorForPieceId(pieceId: string): string {
  // Hash simple para asignar color estable según pieceId
  let h = 0;
  for (let i = 0; i < pieceId.length; i++) h = (h * 31 + pieceId.charCodeAt(i)) | 0;
  return PIECE_COLORS[Math.abs(h) % PIECE_COLORS.length];
}

function formatMm(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)}m`;
  return `${Math.round(mm)}mm`;
}

export function NestingViewer({
  result,
  costingDetails = [],
  maxPx = 480,
  showLabels = true,
  className,
}: NestingViewerProps) {
  // Leyenda: color → label (basado en pieceId únicos en placements)
  const piezasUnicas = React.useMemo(() => {
    const map = new Map<string, { color: string; label: string }>();
    result.placements.forEach((p) => {
      if (map.has(p.pieceId)) return;
      const meta = p.meta as { label?: string } | undefined;
      map.set(p.pieceId, {
        color: colorForPieceId(p.pieceId),
        label: meta?.label ?? p.pieceId,
      });
    });
    return Array.from(map.entries()).map(([id, info]) => ({ id, ...info }));
  }, [result.placements]);

  if (!result.substrates.length) {
    return (
      <div className="text-sm text-muted-foreground italic p-4 border rounded">
        Sin sustratos para visualizar.
      </div>
    );
  }

  // Por ahora dibujamos sólo el primer sustrato (el más común). Para multi-bin
  // (rígidos), iteramos todos.
  const totalSubstrates = result.substrates.length;

  return (
    <div className={className ?? "space-y-3"}>
      <NestingHeader result={result} />
      <NestingCostingSummary costingDetails={costingDetails} />
      <NestingLeyenda
        piezas={piezasUnicas}
        visualConfig={result.visualConfig}
        costingPreview={result.costingPreview}
      />
      {result.substrates.map((sub, idx) => (
        <SubstrateView
          key={idx}
          substrate={sub}
          substrateIndex={idx}
          totalSubstrates={totalSubstrates}
          visualConfig={result.visualConfig}
          costingPreview={result.costingPreview}
          placements={result.placements.filter(
            (p) => (p.substrateIndex ?? 0) === idx,
          )}
          maxPx={maxPx}
          showLabels={showLabels}
        />
      ))}
    </div>
  );
}

function formatARS(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function costingLabel(strategy: string) {
  const labels: Record<string, string> = {
    "m2-exact": "m² exactos",
    "consumed-length": "largo consumido",
    "plate-segments": "segmentos de placa",
  };
  return labels[strategy] ?? strategy;
}

function NestingCostingSummary({
  costingDetails,
}: {
  costingDetails: NonNullable<NestingViewerProps["costingDetails"]>;
}) {
  const items = costingDetails.filter((item) => item.detalleCosteoNesting);
  if (items.length === 0) return null;

  return (
    <div className="rounded border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs text-orange-950">
      {items.map((item) => {
        const detalle = item.detalleCosteoNesting!;
        return (
          <div key={`${item.materialNombre}-${detalle.strategy}`} className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="font-medium">Costeo del sustrato:</span>
            <span>{costingLabel(detalle.strategy)}</span>
            <span>{item.materialNombre}</span>
            <span>Total: {formatARS(detalle.totalCost)}</span>
            {detalle.lastUnit ? (
              <span>
                Última placa: {detalle.lastUnit.occupationPct.toFixed(1)}%
                {detalle.lastUnit.segmentApplied != null
                  ? ` → escalón ${detalle.lastUnit.segmentApplied}%`
                  : ""}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ─── Leyenda de colores por pieza ────────────────────────────────

function NestingLeyenda({
  piezas,
  visualConfig,
  costingPreview,
}: {
  piezas: Array<{ id: string; color: string; label: string }>;
  visualConfig?: NestingViewerInput["visualConfig"];
  costingPreview?: NestingViewerInput["costingPreview"];
}) {
  const hasMargins =
    visualConfig &&
    Object.values(visualConfig.margins).some((value) => value > 0);
  const hasSpacing =
    visualConfig &&
    (visualConfig.spacing.horizontalMm > 0 ||
      visualConfig.spacing.verticalMm > 0);
  const showCosting =
    costingPreview && costingPreview.strategy !== "simple";
  const hasPanelizado = visualConfig?.panelizado?.enabled === true;

  if (piezas.length <= 1 && !hasMargins && !hasSpacing && !showCosting && !hasPanelizado) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="text-muted-foreground font-medium">Referencia:</span>
      <LegendChip color="#ffffff" border="#86efac" label="Área útil" />
      {hasMargins ? (
        <LegendChip color="#fed7aa" border="#fb923c" label="Márgenes" />
      ) : null}
      {showCosting ? (
        <LegendChip color="#fde68a" border="#f59e0b" label="Área costeada" />
      ) : null}
      {costingPreview?.wasteAreaMm2 ? (
        <LegendChip color="#fecaca" border="#ef4444" label="Desperdicio costeado" />
      ) : null}
      {hasSpacing ? (
        <LegendChip color="#d1d5db" border="#9ca3af" label="Separación" />
      ) : null}
      {hasPanelizado ? (
        <LegendChip color="#fef3c7" border="#d97706" label="Solape de panel" />
      ) : null}
      {piezas.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1" title={p.id}>
          <span
            className="inline-block size-3 shrink-0 rounded-sm border border-foreground/30"
            style={{ backgroundColor: p.color, opacity: 0.65 }}
            aria-hidden
          />
          <span>{p.label}</span>
        </span>
      ))}
    </div>
  );
}

function LegendChip({
  color,
  border,
  label,
}: {
  color: string;
  border: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block size-3 shrink-0 rounded-sm border"
        style={{ backgroundColor: color, borderColor: border }}
        aria-hidden
      />
      <span>{label}</span>
    </span>
  );
}

// ─── Header con métricas ─────────────────────────────────────────

function NestingHeader({ result }: { result: NestingViewerInput }) {
  const algorithmLabel = {
    "shelf-rollo": "Acomodo en rollo (gran formato)",
    "grid-2d-single": "Grilla simple",
    "grid-2d-multi": "Grilla multi-pliego (rígidos)",
    "packingsolver-rectangle": "PackingSolver Rectangle (rígidos)",
  }[result.algorithm];

  const modoIncompletoLabel: Record<string, string> = {
    PERMITIR: "permite incompletos",
    DESCARTAR: "descarta incompletos",
    REDONDEAR_ARRIBA: "redondea hacia arriba",
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="px-2 py-0.5 rounded bg-muted font-medium">{algorithmLabel}</span>
        <span>
          <strong>{result.cantidadCalculada.toFixed(2)}</strong> {labelUnidad(result.unidad)}
        </span>
        <span>
          Aprovech: <strong>{result.aprovechamientoPct.toFixed(1)}%</strong>
        </span>
        <span>{result.piezasAcomodadas} piezas acomodadas</span>
        {result.piezasPorPliego != null ? (
          <span>{result.piezasPorPliego}/pliego</span>
        ) : null}
        {result.consumedLengthMm != null ? (
          <span>Largo rollo: {formatMm(result.consumedLengthMm)}</span>
        ) : null}
        {result.visualConfig ? (
          <>
            <span>
              Área útil: {formatMm(result.visualConfig.usableArea.widthMm)} ×{" "}
              {formatMm(result.visualConfig.usableArea.heightMm)}
            </span>
            <span>
              Márgenes: I {formatMm(result.visualConfig.margins.leftMm)} · D{" "}
              {formatMm(result.visualConfig.margins.rightMm)} · S{" "}
              {formatMm(result.visualConfig.margins.topMm)} · Inf{" "}
              {formatMm(result.visualConfig.margins.bottomMm)}
            </span>
            <span>
              Separación: H {formatMm(result.visualConfig.spacing.horizontalMm)} · V{" "}
              {formatMm(result.visualConfig.spacing.verticalMm)}
            </span>
            <span>
              Rotación: {result.visualConfig.allowRotation ? "permitida" : "bloqueada"}
            </span>
          </>
        ) : null}
        {result.costingPreview ? (
          <span>
            Costeo: {result.costingPreview.label}
            {result.costingPreview.segmentAppliedPct != null
              ? ` (${result.costingPreview.segmentAppliedPct}%)`
              : ""}
          </span>
        ) : null}
        {result.costingPreview?.wasteAreaMm2 ? (
          <span>
            Desperdicio costeado:{" "}
            {(result.costingPreview.wasteAreaMm2 / 1_000_000).toFixed(2)} m²
          </span>
        ) : null}
        {result.visualConfig?.panelizado?.enabled ? (
          <span>
            Panelizado: {result.visualConfig.panelizado.panelCount} paneles máx. ·{" "}
            eje {result.visualConfig.panelizado.axis === "horizontal" ? "horizontal" : "vertical"} ·{" "}
            solape {formatMm(result.visualConfig.panelizado.overlapMm ?? 0)}
          </span>
        ) : null}
      </div>
      {result.talonarioGrouping ? (
        <div className="flex flex-wrap gap-3 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
          <span className="font-medium">Talonario:</span>
          <span>
            {result.talonarioGrouping.talonariosEfectivos}/{result.talonarioGrouping.talonariosPedidos} efectivos
          </span>
          <span>
            {result.talonarioGrouping.gruposCompletos} grupo(s) + {result.talonarioGrouping.talonariosResiduo} residuo
          </span>
          <span>{result.talonarioGrouping.pliegosXCapa} pliegos × capa</span>
          {result.talonarioGrouping.pliegosDesperdicio > 0 && (
            <span>⚠ {result.talonarioGrouping.pliegosDesperdicio} pliegos desperdicio</span>
          )}
          <span
            className="text-amber-700"
            title={`código: ${result.talonarioGrouping.modoIncompleto}`}
          >
            modo: {modoIncompletoLabel[result.talonarioGrouping.modoIncompleto] ?? result.talonarioGrouping.modoIncompleto}
          </span>
        </div>
      ) : null}
    </div>
  );
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

// ─── Vista de un sustrato (rollo o pliego) ────────────────────────

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
  const heightMm =
    substrate.kind === "sheet" ? substrate.heightMm : substrate.lengthMm;

  // Calcular escala manteniendo proporción y respetando maxPx en el lado más largo.
  const longestMm = Math.max(widthMm, heightMm);
  const scale = maxPx / longestMm;
  const wPx = widthMm * scale;
  const hPx = heightMm * scale;
  const padPx = 28; // espacio para labels de medida
  const effectiveVisualConfig = getEffectiveVisualConfig(
    visualConfig,
    widthMm,
    heightMm,
  );

  const viewBoxW = wPx + padPx * 2;
  const viewBoxH = hPx + padPx * 2;
  const hasMargins = Object.values(effectiveVisualConfig.margins).some(
    (value) => value > 0,
  );

  return (
    <div className="border rounded p-2 bg-muted/30">
      {totalSubstrates > 1 ? (
        <div className="text-xs text-muted-foreground mb-1">
          Sustrato {substrateIndex + 1} / {totalSubstrates}
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
        width="100%"
        style={{ maxWidth: viewBoxW, maxHeight: viewBoxH }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern
            id={`margin-pattern-${substrateIndex}`}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="#fb923c" strokeWidth="1" opacity="0.35" />
          </pattern>
        </defs>
        {/* Borde del sustrato */}
        <rect
          x={padPx}
          y={padPx}
          width={wPx}
          height={hPx}
          fill={substrate.kind === "roll" ? "#fef3c7" : "#f3f4f6"}
          stroke="#9ca3af"
          strokeWidth={1.5}
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
          fillOpacity={0.55}
          stroke="#86efac"
          strokeWidth={0.8}
          strokeDasharray="3 2"
        />
        <SpacingLayer
          visualConfig={effectiveVisualConfig}
          placements={placements}
          padPx={padPx}
          scale={scale}
        />
        {/* Etiquetas de medida */}
        <text
          x={padPx + wPx / 2}
          y={padPx - 8}
          textAnchor="middle"
          fontSize={10}
          fill="#374151"
        >
          {formatMm(widthMm)} {substrate.kind === "roll" ? "(ancho rollo)" : ""}
        </text>
        <text
          x={padPx - 8}
          y={padPx + hPx / 2}
          textAnchor="middle"
          fontSize={10}
          fill="#374151"
          transform={`rotate(-90, ${padPx - 8}, ${padPx + hPx / 2})`}
        >
          {formatMm(heightMm)} {substrate.kind === "roll" ? "(largo consumido)" : ""}
        </text>

        {/* Placements */}
        {placements.map((p, idx) => {
          const x = padPx + p.xMm * scale;
          const y = padPx + p.yMm * scale;
          const w = p.widthMm * scale;
          const h = p.heightMm * scale;
          const fill = colorForPieceId(p.pieceId);
          const meta = p.meta as { label?: string } | undefined;
          const baseLabel = meta?.label ?? p.pieceId;
          const label =
            p.panelIndex && p.panelCount
              ? `${baseLabel} · panel ${p.panelIndex}/${p.panelCount}`
              : baseLabel;
          const overlapStartPx = Math.max(0, p.overlapStartMm ?? 0) * scale;
          const overlapEndPx = Math.max(0, p.overlapEndMm ?? 0) * scale;
          return (
            <g key={`${p.pieceId}-${idx}`}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={fill}
                fillOpacity={0.65}
                stroke="#374151"
                strokeWidth={0.6}
              />
              {p.panelAxis === "vertical" && overlapStartPx > 0 ? (
                <rect
                  x={x}
                  y={y}
                  width={Math.min(overlapStartPx, w)}
                  height={h}
                  fill="#fef3c7"
                  fillOpacity={0.55}
                  stroke="#d97706"
                  strokeWidth={0.35}
                />
              ) : null}
              {p.panelAxis === "vertical" && overlapEndPx > 0 ? (
                <rect
                  x={x + Math.max(0, w - overlapEndPx)}
                  y={y}
                  width={Math.min(overlapEndPx, w)}
                  height={h}
                  fill="#fef3c7"
                  fillOpacity={0.55}
                  stroke="#d97706"
                  strokeWidth={0.35}
                />
              ) : null}
              {p.panelAxis === "horizontal" && overlapStartPx > 0 ? (
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={Math.min(overlapStartPx, h)}
                  fill="#fef3c7"
                  fillOpacity={0.55}
                  stroke="#d97706"
                  strokeWidth={0.35}
                />
              ) : null}
              {p.panelAxis === "horizontal" && overlapEndPx > 0 ? (
                <rect
                  x={x}
                  y={y + Math.max(0, h - overlapEndPx)}
                  width={w}
                  height={Math.min(overlapEndPx, h)}
                  fill="#fef3c7"
                  fillOpacity={0.55}
                  stroke="#d97706"
                  strokeWidth={0.35}
                />
              ) : null}
              {p.rotated ? (
                <line
                  x1={x}
                  y1={y}
                  x2={x + w}
                  y2={y + h}
                  stroke="#374151"
                  strokeWidth={0.4}
                  strokeDasharray="2 2"
                  opacity={0.5}
                />
              ) : null}
              {showLabels && w > 24 && h > 14 ? (
                <text
                  x={x + w / 2}
                  y={y + h / 2 + 3}
                  textAnchor="middle"
                  fontSize={Math.min(9, Math.max(6, w / 8))}
                  fill="#1f2937"
                  pointerEvents="none"
                >
                  {label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
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
  if (
    !costingPreview ||
    costingPreview.strategy !== "plate-segments" ||
    totalSubstrates <= 1
  ) {
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
): NonNullable<NestingViewerInput["visualConfig"]> {
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
  visualConfig: NonNullable<NestingViewerInput["visualConfig"]>;
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
      {topMm > 0 ? (
        <rect x={padPx} y={padPx} width={substrateWidthMm * scale} height={topMm * scale} fill={fill} />
      ) : null}
      {bottomMm > 0 ? (
        <rect
          x={padPx}
          y={padPx + (substrateHeightMm - bottomMm) * scale}
          width={substrateWidthMm * scale}
          height={bottomMm * scale}
          fill={fill}
        />
      ) : null}
      {leftMm > 0 ? (
        <rect x={padPx} y={padPx} width={leftMm * scale} height={substrateHeightMm * scale} fill={fill} />
      ) : null}
      {rightMm > 0 ? (
        <rect
          x={padPx + (substrateWidthMm - rightMm) * scale}
          y={padPx}
          width={rightMm * scale}
          height={substrateHeightMm * scale}
          fill={fill}
        />
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
            fill="#fde68a"
            fillOpacity={0.32}
            stroke="#f59e0b"
            strokeWidth={0.4}
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
  const x = padPx + bounds.xMm * scale;
  const y = padPx + bounds.yMm * scale;
  const width = bounds.widthMm * scale;
  const height = bounds.heightMm * scale;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#fde68a"
        fillOpacity={0.38}
        stroke="#f59e0b"
        strokeWidth={0.8}
      />
      {costingPreview.wasteAreaMm2 && costingPreview.wasteAreaMm2 > 0 ? (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="#fecaca"
          fillOpacity={0.16}
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
  visualConfig: NonNullable<NestingViewerInput["visualConfig"]>;
  placements: NestingViewerInput["placements"];
  padPx: number;
  scale: number;
}) {
  const sepH = visualConfig.spacing.horizontalMm;
  const sepV = visualConfig.spacing.verticalMm;
  if (sepH <= 0 && sepV <= 0) return null;

  return (
    <g opacity={0.38}>
      {placements.map((placement, idx) => {
        const rightGapX = placement.xMm + placement.widthMm;
        const bottomGapY = placement.yMm + placement.heightMm;
        const hasRightNeighbor =
          sepH > 0 && hasAdjacentPlacement(placement, placements, "right", sepH);
        const hasBottomNeighbor =
          sepV > 0 && hasAdjacentPlacement(placement, placements, "bottom", sepV);
        return (
          <React.Fragment key={`spacing-${placement.pieceId}-${idx}`}>
            {hasRightNeighbor ? (
              <rect
                x={padPx + rightGapX * scale}
                y={padPx + placement.yMm * scale}
                width={Math.max(1, sepH * scale)}
                height={placement.heightMm * scale}
                fill="#9ca3af"
              />
            ) : null}
            {hasBottomNeighbor ? (
              <rect
                x={padPx + placement.xMm * scale}
                y={padPx + bottomGapY * scale}
                width={placement.widthMm * scale}
                height={Math.max(1, sepV * scale)}
                fill="#9ca3af"
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </g>
  );
}

function hasAdjacentPlacement(
  placement: NestingViewerInput["placements"][number],
  placements: NestingViewerInput["placements"],
  direction: "right" | "bottom",
  separationMm: number,
) {
  const expectedX =
    direction === "right"
      ? placement.xMm + placement.widthMm + separationMm
      : placement.xMm;
  const expectedY =
    direction === "bottom"
      ? placement.yMm + placement.heightMm + separationMm
      : placement.yMm;
  const toleranceMm = 0.01;

  return placements.some((other) => {
    if (other === placement) return false;
    if ((other.substrateIndex ?? 0) !== (placement.substrateIndex ?? 0)) {
      return false;
    }
    if (direction === "right") {
      return (
        nearlyEqual(other.xMm, expectedX, toleranceMm) &&
        rangesOverlap(
          placement.yMm,
          placement.yMm + placement.heightMm,
          other.yMm,
          other.yMm + other.heightMm,
          toleranceMm,
        )
      );
    }
    return (
      nearlyEqual(other.yMm, expectedY, toleranceMm) &&
      rangesOverlap(
        placement.xMm,
        placement.xMm + placement.widthMm,
        other.xMm,
        other.xMm + other.widthMm,
        toleranceMm,
      )
    );
  });
}

function nearlyEqual(a: number, b: number, tolerance: number) {
  return Math.abs(a - b) <= tolerance;
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  tolerance: number,
) {
  return aStart < bEnd - tolerance && bStart < aEnd - tolerance;
}
