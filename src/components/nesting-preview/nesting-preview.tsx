"use client";

import * as React from "react";

// ──────────────── Tipos públicos ────────────────

/** Márgenes mecánicos no-imprimibles de la máquina (pinza superior, bordes, etc). */
export type MachineMargins = {
  leftMm?: number;
  rightMm?: number;
  topMm?: number;
  bottomMm?: number;
};

export type NestingContainer =
  | {
      type: "rollo";
      printableWidthMm: number;
      consumedLengthMm: number;
      rolloAnchoTotalMm?: number;
      marginLeftMm?: number;
      marginStartMm?: number;
      marginEndMm?: number;
    }
  | {
      type: "pliego";
      anchoMm: number;
      altoMm: number;
      machineMargins?: MachineMargins;
      margenMm?: number;
    }
  | {
      type: "placa";
      anchoMm: number;
      altoMm: number;
      machineMargins?: MachineMargins;
      margenMm?: number;
      materialLabel?: string;
    };

export type NestingPlacement = {
  x: number;
  y: number;
  anchoMm: number;
  altoMm: number;
  rotada?: boolean;
  label?: string;
  colorKey?: string;
};

export type NestingPreviewProps = {
  container: NestingContainer;
  placements: NestingPlacement[];
  /** Default 560 in "full", 400 in "compact". */
  maxHeightPx?: number;
  /** Stats row above the canvas. */
  showDimensions?: boolean;
  /** CAD grid behind sheet. */
  showGrid?: boolean;
  /** Custom palette by `colorKey`. Falls back to lime ramp. */
  colorPalette?: Record<string, string>;
  /** "full" = rulers + legend + zoom pill. "compact" = bare canvas (inline use). */
  variant?: "full" | "compact";
  className?: string;
};

// ──────────────── Paleta canónica (Grafo) ────────────────

const LIME_FILL_TOP = "rgba(232,255,92,0.92)";
const LIME_FILL_BOT = "rgba(184,204,73,0.95)";
const LIME_BORDER = "rgba(11,11,15,0.32)";
const LIME_LABEL = "rgba(11,11,15,0.65)";
const LIME_INDEX = "rgba(11,11,15,0.45)";

/** Si el caller pasa colores por colorKey los respetamos; si no, todo en lime. */
function pickColor(
  placement: NestingPlacement,
  palette: Record<string, string>,
): string | null {
  const key = placement.colorKey ?? `${placement.anchoMm}×${placement.altoMm}`;
  return palette[key] ?? null;
}

// ──────────────── Dimensiones del contenedor ────────────────

function getContainerDims(container: NestingContainer): {
  widthMm: number;
  heightMm: number;
  containerLabel: string;
} {
  if (container.type === "rollo") {
    return {
      widthMm: container.rolloAnchoTotalMm ?? container.printableWidthMm,
      heightMm: container.consumedLengthMm,
      containerLabel: `Rollo ${container.rolloAnchoTotalMm ?? container.printableWidthMm}mm × ${(container.consumedLengthMm / 1000).toFixed(2)}m`,
    };
  }
  if (container.type === "pliego") {
    return {
      widthMm: container.anchoMm,
      heightMm: container.altoMm,
      containerLabel: `Pliego ${container.anchoMm}×${container.altoMm}mm`,
    };
  }
  return {
    widthMm: container.anchoMm,
    heightMm: container.altoMm,
    containerLabel: container.materialLabel
      ? `${container.materialLabel} — ${container.anchoMm}×${container.altoMm}mm`
      : `Placa ${container.anchoMm}×${container.altoMm}mm`,
  };
}

function pickGridStepMm(widthMm: number): number {
  if (widthMm <= 200) return 10;
  if (widthMm <= 500) return 25;
  if (widthMm <= 1500) return 100;
  return 250;
}

function buildRulerTicks(maxMm: number, count = 5): { mm: number; label: string }[] {
  const step = maxMm / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const mm = i * step;
    const isLast = i === count - 1;
    return {
      mm,
      label: isLast ? `${Math.round(maxMm)} mm` : String(Math.round(mm)),
    };
  });
}

// ──────────────── Componente principal ────────────────

export function NestingPreview({
  container,
  placements,
  maxHeightPx,
  showDimensions = true,
  showGrid = true,
  colorPalette = {},
  variant = "full",
  className,
}: NestingPreviewProps) {
  const isFull = variant === "full";
  const effectiveMaxHeight = maxHeightPx ?? (isFull ? 560 : 400);

  const dims = getContainerDims(container);
  const { widthMm, heightMm, containerLabel } = dims;

  if (widthMm <= 0 || heightMm <= 0) {
    return (
      <div className={className}>
        <div className="rounded-md border border-dashed border-line p-4 text-center text-sm text-ink-3">
          Sin placements para mostrar ({containerLabel}).
        </div>
      </div>
    );
  }

  const padding = Math.max(widthMm * 0.04, heightMm * 0.04, 12);
  const viewBoxWidth = widthMm + padding * 2;
  const viewBoxHeight = heightMm + padding * 2;
  const aspectRatio = viewBoxWidth / viewBoxHeight;

  const gridStep = pickGridStepMm(Math.max(widthMm, heightMm));

  const totalPiezas = placements.length;
  const areaUtilM2 = placements.reduce(
    (acc, p) => acc + (p.anchoMm * p.altoMm) / 1_000_000,
    0,
  );
  const areaContenedorM2 = (widthMm * heightMm) / 1_000_000;
  const aprovechamiento =
    areaContenedorM2 > 0 ? (areaUtilM2 / areaContenedorM2) * 100 : 0;

  const machineMargins: MachineMargins =
    container.type === "rollo"
      ? {
          leftMm: container.marginLeftMm ?? 0,
          rightMm:
            (container.rolloAnchoTotalMm ?? container.printableWidthMm) -
            container.printableWidthMm -
            (container.marginLeftMm ?? 0),
          topMm: container.marginStartMm ?? 0,
          bottomMm: container.marginEndMm ?? 0,
        }
      : container.machineMargins ?? {};

  const marginLeft = Math.max(0, machineMargins.leftMm ?? 0);
  const marginRight = Math.max(0, machineMargins.rightMm ?? 0);
  const marginTop = Math.max(0, machineMargins.topMm ?? 0);
  const marginBottom = Math.max(0, machineMargins.bottomMm ?? 0);

  const perimeterMargin =
    container.type === "pliego" || container.type === "placa"
      ? container.margenMm ?? 0
      : 0;

  const sheetFillId = `sheet-fill-${container.type}`;
  const pieceFillId = `piece-fill-grafo`;
  const shadowId = `sheet-shadow-grafo`;

  const xTicks = isFull ? buildRulerTicks(widthMm) : [];
  const yTicks = isFull ? buildRulerTicks(heightMm) : [];

  // Header (stats row)
  const header = showDimensions ? (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
      <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-2">
        <span className="text-ink-0">{containerLabel}</span>
      </div>
      <div className="flex gap-4 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
        <span>
          <span className="text-ink-0">{totalPiezas}</span> piezas
        </span>
        <span>
          <span className="text-lime">{aprovechamiento.toFixed(1)}%</span>{" "}
          aprovechamiento
        </span>
        <span>
          <span className="text-ink-0">{areaUtilM2.toFixed(3)}</span> m² útiles
        </span>
      </div>
    </div>
  ) : null;

  return (
    <div className={className}>
      {header}

      <div
        className="relative w-full overflow-hidden rounded-[10px] border border-line bg-bg-1"
        style={{
          backgroundImage: isFull
            ? "linear-gradient(rgba(36,36,45,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(36,36,45,0.5) 1px,transparent 1px),linear-gradient(rgba(36,36,45,0.2) 1px,transparent 1px),linear-gradient(90deg,rgba(36,36,45,0.2) 1px,transparent 1px),radial-gradient(ellipse at center,#0E0E14,#08080B)"
            : undefined,
          backgroundSize: isFull
            ? "80px 80px, 80px 80px, 16px 16px, 16px 16px, 100% 100%"
            : undefined,
        }}
      >
        {/* Top ruler */}
        {isFull && (
          <div
            className="absolute right-0 top-0 z-[3] flex h-[22px] items-center border-b border-line bg-bg-2 pl-[6px] font-mono text-[9px] tracking-[0.04em] text-ink-3"
            style={{ left: 36 }}
          >
            {xTicks.map((t, i) => (
              <div
                key={`xtk-${i}`}
                className="flex-1 border-l border-line py-1 pl-1 first:border-l-0"
                style={{ minWidth: 60 }}
              >
                {t.label}
              </div>
            ))}
          </div>
        )}

        {/* Left ruler */}
        {isFull && (
          <div
            className="absolute left-0 z-[3] flex w-[36px] flex-col border-r border-line bg-bg-2 font-mono text-[9px] tracking-[0.04em] text-ink-3"
            style={{ top: 22, bottom: 0 }}
          >
            {yTicks.map((t, i) => (
              <div
                key={`ytk-${i}`}
                className="flex-1 border-t border-line px-[2px] pt-[6px] text-center first:border-t-0"
                style={{ writingMode: "vertical-rl", minHeight: 60 }}
              >
                {t.label}
              </div>
            ))}
          </div>
        )}

        {/* Legend overlay */}
        {isFull && (
          <div className="absolute z-[3] flex flex-col gap-1.5 rounded-md border border-line bg-[rgba(21,21,28,0.7)] px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-2 backdrop-blur-md"
               style={{ top: 36, left: 52 }}>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-sm bg-lime" />
              Pieza útil
            </div>
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-sm border border-dashed"
                style={{ borderColor: "var(--err)" }}
              />
              Sangrado
            </div>
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-sm"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg,transparent 0 3px,var(--ink-4) 3px 4px)",
                }}
              />
              Merma
            </div>
          </div>
        )}

        {/* SVG canvas (sheet + pieces + dimension callouts) */}
        <div
          className="relative h-full w-full"
          style={{
            paddingTop: isFull ? 22 : 0,
            paddingLeft: isFull ? 36 : 0,
          }}
        >
          <svg
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-full w-full"
            style={{ maxHeight: effectiveMaxHeight, aspectRatio }}
          >
            <defs>
              <linearGradient id={sheetFillId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={container.type === "placa" ? "#E8E2D5" : "#F4F4F0"}
                />
                <stop
                  offset="100%"
                  stopColor={container.type === "placa" ? "#D4CDBF" : "#E5E5DD"}
                />
              </linearGradient>
              <linearGradient id={pieceFillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LIME_FILL_TOP} />
                <stop offset="100%" stopColor={LIME_FILL_BOT} />
              </linearGradient>
              <filter
                id={shadowId}
                x="-10%"
                y="-10%"
                width="120%"
                height="120%"
              >
                <feDropShadow
                  dx="0"
                  dy={Math.max(widthMm, heightMm) * 0.025}
                  stdDeviation={Math.max(widthMm, heightMm) * 0.02}
                  floodColor="#000"
                  floodOpacity="0.5"
                />
              </filter>
              <pattern
                id="nonPrintableHatch"
                patternUnits="userSpaceOnUse"
                width={Math.max(widthMm, heightMm) * 0.015}
                height={Math.max(widthMm, heightMm) * 0.015}
                patternTransform="rotate(45)"
              >
                <line
                  x1={0}
                  y1={0}
                  x2={0}
                  y2={Math.max(widthMm, heightMm) * 0.015}
                  stroke="rgba(11,11,15,0.4)"
                  strokeWidth={Math.max(widthMm, heightMm) * 0.0025}
                />
              </pattern>
            </defs>

            {/* Grid de fondo (compact mode) */}
            {!isFull && showGrid && (
              <g opacity={0.3}>
                {Array.from(
                  { length: Math.ceil(widthMm / gridStep) + 1 },
                  (_, i) => (
                    <line
                      key={`v-${i}`}
                      x1={padding + i * gridStep}
                      y1={padding}
                      x2={padding + i * gridStep}
                      y2={padding + heightMm}
                      stroke="var(--line-hi)"
                      strokeWidth={0.3}
                    />
                  ),
                )}
                {Array.from(
                  { length: Math.ceil(heightMm / gridStep) + 1 },
                  (_, i) => (
                    <line
                      key={`h-${i}`}
                      x1={padding}
                      y1={padding + i * gridStep}
                      x2={padding + widthMm}
                      y2={padding + i * gridStep}
                      stroke="var(--line-hi)"
                      strokeWidth={0.3}
                    />
                  ),
                )}
              </g>
            )}

            {/* Pliego con sombra */}
            <rect
              x={padding}
              y={padding}
              width={widthMm}
              height={heightMm}
              rx={Math.max(widthMm, heightMm) * 0.003}
              fill={`url(#${sheetFillId})`}
              filter={`url(#${shadowId})`}
            />

            {/* Zonas no-imprimibles */}
            {marginLeft > 0 && (
              <rect
                x={padding}
                y={padding}
                width={marginLeft}
                height={heightMm}
                fill="url(#nonPrintableHatch)"
              />
            )}
            {marginRight > 0 && (
              <rect
                x={padding + widthMm - marginRight}
                y={padding}
                width={marginRight}
                height={heightMm}
                fill="url(#nonPrintableHatch)"
              />
            )}
            {marginTop > 0 && (
              <rect
                x={padding + marginLeft}
                y={padding}
                width={widthMm - marginLeft - marginRight}
                height={marginTop}
                fill="url(#nonPrintableHatch)"
              />
            )}
            {marginBottom > 0 && (
              <rect
                x={padding + marginLeft}
                y={padding + heightMm - marginBottom}
                width={widthMm - marginLeft - marginRight}
                height={marginBottom}
                fill="url(#nonPrintableHatch)"
              />
            )}

            {/* Margen perimetral de seguridad */}
            {perimeterMargin > 0 && (
              <rect
                x={padding + marginLeft + perimeterMargin}
                y={padding + marginTop + perimeterMargin}
                width={widthMm - marginLeft - marginRight - perimeterMargin * 2}
                height={heightMm - marginTop - marginBottom - perimeterMargin * 2}
                fill="none"
                stroke="rgba(11,11,15,0.18)"
                strokeWidth={0.6}
                strokeDasharray="2,2"
              />
            )}

            {/* Placements (piezas) */}
            {placements.map((p, idx) => {
              const customFill = pickColor(p, colorPalette);
              const fill = customFill ?? `url(#${pieceFillId})`;
              const stroke = customFill ?? LIME_BORDER;
              const cx = padding + p.x + p.anchoMm / 2;
              const cy = padding + p.y + p.altoMm / 2;
              const minDim = Math.min(p.anchoMm, p.altoMm);
              // Construimos la etiqueta primero para poder dimensionar el texto
              // según el LARGO real de la cadena (no solo el alto disponible).
              // Sin esto, etiquetas largas como "1000×500 ↻" se desbordan.
              const labelText =
                p.label ?? `${Math.round(p.anchoMm)}×${Math.round(p.altoMm)}`;
              const showRotated = Boolean(p.rotada);
              const fullLabel = showRotated ? `${labelText} ↻` : labelText;
              // Estimación de ancho: ~0.6× height por carácter en Mono.
              // Limitamos por: 30% del alto, 80% del ancho dividido por (chars × 0.6).
              const maxByHeight = p.altoMm * 0.3;
              const maxByWidth =
                fullLabel.length > 0
                  ? (p.anchoMm * 0.85) / (fullLabel.length * 0.6)
                  : maxByHeight;
              const textSize = Math.max(
                4,
                Math.min(maxByHeight, maxByWidth, minDim * 0.18),
              );
              return (
                <g key={`p-${idx}`}>
                  <rect
                    x={padding + p.x}
                    y={padding + p.y}
                    width={p.anchoMm}
                    height={p.altoMm}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={Math.max(widthMm, heightMm) * 0.0015}
                  />
                  {minDim > 30 && (
                    <>
                      <text
                        x={padding + p.x + minDim * 0.06}
                        y={padding + p.y + minDim * 0.14}
                        fontSize={Math.min(textSize * 0.7, minDim * 0.1)}
                        fontFamily="var(--font-mono)"
                        fontWeight={600}
                        fill={LIME_INDEX}
                      >
                        #{idx + 1}
                      </text>
                      <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={textSize}
                        fontFamily="var(--font-mono)"
                        fontWeight={500}
                        fill={LIME_LABEL}
                      >
                        {fullLabel}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {/* Borde nítido del pliego (encima de piezas) */}
            <rect
              x={padding}
              y={padding}
              width={widthMm}
              height={heightMm}
              fill="none"
              stroke="rgba(11,11,15,0.45)"
              strokeWidth={Math.max(widthMm, heightMm) * 0.001}
            />

            {/* Dimension callouts W/H */}
            {isFull && (
              <g
                fontFamily="var(--font-mono)"
                fontSize={Math.max(widthMm, heightMm) * 0.022}
                fill="var(--ink-2)"
                style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
              >
                {/* W (top) */}
                <line
                  x1={padding}
                  y1={padding * 0.5}
                  x2={padding + widthMm * 0.35}
                  y2={padding * 0.5}
                  stroke="var(--ink-3)"
                  strokeWidth={Math.max(widthMm, heightMm) * 0.001}
                />
                <text
                  x={padding + widthMm / 2}
                  y={padding * 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  W ·{" "}
                  <tspan fill="var(--ink-0)">{Math.round(widthMm)} mm</tspan>
                </text>
                <line
                  x1={padding + widthMm * 0.65}
                  y1={padding * 0.5}
                  x2={padding + widthMm}
                  y2={padding * 0.5}
                  stroke="var(--ink-3)"
                  strokeWidth={Math.max(widthMm, heightMm) * 0.001}
                />
                {/* H (right) */}
                <g
                  transform={`translate(${padding + widthMm + padding * 0.5}, ${padding + heightMm / 2}) rotate(90)`}
                >
                  <line
                    x1={-(heightMm * 0.5)}
                    y1={0}
                    x2={-(heightMm * 0.15)}
                    y2={0}
                    stroke="var(--ink-3)"
                    strokeWidth={Math.max(widthMm, heightMm) * 0.001}
                  />
                  <text textAnchor="middle" dominantBaseline="middle">
                    H ·{" "}
                    <tspan fill="var(--ink-0)">
                      {Math.round(heightMm)} mm
                    </tspan>
                  </text>
                  <line
                    x1={heightMm * 0.15}
                    y1={0}
                    x2={heightMm * 0.5}
                    y2={0}
                    stroke="var(--ink-3)"
                    strokeWidth={Math.max(widthMm, heightMm) * 0.001}
                  />
                </g>
              </g>
            )}

            {/* Indicador rollo (compact) */}
            {!isFull && container.type === "rollo" && heightMm > 50 && (
              <g
                transform={`translate(${padding + widthMm + padding * 0.3}, ${padding + heightMm / 2})`}
                opacity={0.5}
              >
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.max(widthMm * 0.02, 8)}
                  fill="var(--ink-3)"
                  style={{ writingMode: "vertical-rl" as const }}
                >
                  avance →
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Zoom pill (decorativo, indica escala) */}
        {isFull && (
          <div className="absolute bottom-3.5 right-3.5 z-[3] flex items-center gap-1 rounded-full border border-line-hi bg-[rgba(21,21,28,0.9)] py-1 pl-3 pr-1 font-mono text-[10px] tracking-[0.08em] text-ink-2 backdrop-blur-md">
            <span>100%</span>
            <button
              type="button"
              className="size-[22px] rounded-full font-mono text-sm text-ink-2 transition-colors hover:text-lime"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              className="size-[22px] rounded-full font-mono text-sm text-ink-2 transition-colors hover:text-lime"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="size-[22px] rounded-full font-mono text-sm text-ink-2 transition-colors hover:text-lime"
              aria-label="Reset zoom"
            >
              ⎌
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
