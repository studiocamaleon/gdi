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
      /** Ancho imprimible (después de descontar márgenes laterales no-imprimibles). */
      printableWidthMm: number;
      /** Longitud efectivamente consumida del rollo. */
      consumedLengthMm: number;
      /** Ancho total del rollo (incluye zonas no-imprimibles). Si no se pasa, = printableWidthMm. */
      rolloAnchoTotalMm?: number;
      /** Margen no-imprimible lateral izquierdo del rollo (zona física que no imprime). */
      marginLeftMm?: number;
      /** Margen no-imprimible al inicio del rollo (top del dibujo). */
      marginStartMm?: number;
      /** Margen no-imprimible al final del rollo (bottom del dibujo). */
      marginEndMm?: number;
    }
  | {
      type: "pliego";
      anchoMm: number;
      altoMm: number;
      /** Márgenes mecánicos no-imprimibles de la máquina (pinza, bordes). */
      machineMargins?: MachineMargins;
      /** Margen perimetral de seguridad interno (safety margin). */
      margenMm?: number;
    }
  | {
      type: "placa";
      anchoMm: number;
      altoMm: number;
      /** Márgenes no-imprimibles de la máquina UV/mesa (pinza, detección de borde). */
      machineMargins?: MachineMargins;
      /** Margen perimetral de seguridad interno. */
      margenMm?: number;
      /** Etiqueta del material (ej. "MDF 3mm") para mostrar dentro de la placa. */
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
  maxHeightPx?: number;
  showDimensions?: boolean;
  showGrid?: boolean;
  colorPalette?: Record<string, string>;
  className?: string;
};

// ──────────────── Paleta canónica ────────────────

const DEFAULT_PALETTE = [
  "#2563eb", // azul
  "#f59e0b", // ámbar
  "#10b981", // esmeralda
  "#ec4899", // rosa
  "#8b5cf6", // violeta
  "#14b8a6", // teal
  "#f43f5e", // rosa oscuro
  "#84cc16", // lima
];

function pickColor(
  placement: NestingPlacement,
  palette: Record<string, string>,
  assignedKeys: string[],
): string {
  const key = placement.colorKey ?? `${placement.anchoMm}×${placement.altoMm}`;
  if (palette[key]) return palette[key];
  let idx = assignedKeys.indexOf(key);
  if (idx < 0) {
    assignedKeys.push(key);
    idx = assignedKeys.length - 1;
  }
  return DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
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
      containerLabel: `Rollo ${container.rolloAnchoTotalMm ?? container.printableWidthMm}mm × ${(container.consumedLengthMm / 1000).toFixed(2)}m consumido`,
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

// ──────────────── Grid / escalas ────────────────

function pickGridStepMm(widthMm: number): number {
  if (widthMm <= 200) return 10;
  if (widthMm <= 500) return 25;
  if (widthMm <= 1500) return 100;
  return 250;
}

// ──────────────── Componente principal ────────────────

export function NestingPreview({
  container,
  placements,
  maxHeightPx = 400,
  showDimensions = true,
  showGrid = true,
  colorPalette = {},
  className,
}: NestingPreviewProps) {
  const dims = getContainerDims(container);
  const { widthMm, heightMm, containerLabel } = dims;

  if (widthMm <= 0 || heightMm <= 0) {
    return (
      <div className={className}>
        <div className="rounded border border-dashed border-muted-foreground/30 p-4 text-center text-sm text-muted-foreground">
          Sin placements para mostrar ({containerLabel}).
        </div>
      </div>
    );
  }

  // viewBox con un padding para labels
  const padding = Math.max(widthMm * 0.03, heightMm * 0.03, 10);
  const viewBoxWidth = widthMm + padding * 2;
  const viewBoxHeight = heightMm + padding * 2;
  const aspectRatio = viewBoxWidth / viewBoxHeight;

  const gridStep = pickGridStepMm(Math.max(widthMm, heightMm));
  const assignedKeys: string[] = [];

  // Estadísticas
  const totalPiezas = placements.length;
  const areaUtilM2 = placements.reduce(
    (acc, p) => acc + (p.anchoMm * p.altoMm) / 1_000_000,
    0,
  );
  const areaContenedorM2 = (widthMm * heightMm) / 1_000_000;
  const aprovechamiento = areaContenedorM2 > 0 ? (areaUtilM2 / areaContenedorM2) * 100 : 0;

  // Márgenes no-imprimibles de la máquina: cada lado como franja sombreada.
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

  return (
    <div className={className}>
      {showDimensions && (
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-medium">{containerLabel}</div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{totalPiezas}</span> piezas
            </span>
            <span>
              <span className="font-medium text-foreground">{aprovechamiento.toFixed(1)}%</span>{" "}
              aprovechamiento
            </span>
            <span>
              <span className="font-medium text-foreground">{areaUtilM2.toFixed(3)}</span> m²
              útiles
            </span>
          </div>
        </div>
      )}

      <div
        className="relative w-full overflow-hidden rounded border bg-background"
        style={{ maxHeight: maxHeightPx, aspectRatio }}
      >
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
        >
          <defs>
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
                stroke="currentColor"
                strokeWidth={Math.max(widthMm, heightMm) * 0.0025}
                className="text-muted-foreground"
              />
            </pattern>
          </defs>

          {/* Grid de fondo tipo CAD */}
          {showGrid && (
            <g opacity={0.35}>
              {Array.from({ length: Math.ceil(widthMm / gridStep) + 1 }, (_, i) => (
                <line
                  key={`v-${i}`}
                  x1={padding + i * gridStep}
                  y1={padding}
                  x2={padding + i * gridStep}
                  y2={padding + heightMm}
                  stroke="currentColor"
                  strokeWidth={0.3}
                  className="text-muted-foreground"
                />
              ))}
              {Array.from({ length: Math.ceil(heightMm / gridStep) + 1 }, (_, i) => (
                <line
                  key={`h-${i}`}
                  x1={padding}
                  y1={padding + i * gridStep}
                  x2={padding + widthMm}
                  y2={padding + i * gridStep}
                  stroke="currentColor"
                  strokeWidth={0.3}
                  className="text-muted-foreground"
                />
              ))}
            </g>
          )}

          {/* Contenedor — fondo */}
          <rect
            x={padding}
            y={padding}
            width={widthMm}
            height={heightMm}
            fill={container.type === "placa" ? "hsl(30 25% 92%)" : "hsl(0 0% 98%)"}
            stroke="currentColor"
            strokeWidth={container.type === "placa" ? 1.5 : 1}
            className="text-foreground"
          />

          {/* Zonas no-imprimibles de la máquina — una por lado si corresponde */}
          {marginLeft > 0 && (
            <rect
              x={padding}
              y={padding}
              width={marginLeft}
              height={heightMm}
              fill="url(#nonPrintableHatch)"
              opacity={0.6}
            />
          )}
          {marginRight > 0 && (
            <rect
              x={padding + widthMm - marginRight}
              y={padding}
              width={marginRight}
              height={heightMm}
              fill="url(#nonPrintableHatch)"
              opacity={0.6}
            />
          )}
          {marginTop > 0 && (
            <rect
              x={padding + marginLeft}
              y={padding}
              width={widthMm - marginLeft - marginRight}
              height={marginTop}
              fill="url(#nonPrintableHatch)"
              opacity={0.6}
            />
          )}
          {marginBottom > 0 && (
            <rect
              x={padding + marginLeft}
              y={padding + heightMm - marginBottom}
              width={widthMm - marginLeft - marginRight}
              height={marginBottom}
              fill="url(#nonPrintableHatch)"
              opacity={0.6}
            />
          )}

          {/* Borde de la zona imprimible (línea continua fina) */}
          {(marginLeft + marginRight + marginTop + marginBottom) > 0 && (
            <rect
              x={padding + marginLeft}
              y={padding + marginTop}
              width={widthMm - marginLeft - marginRight}
              height={heightMm - marginTop - marginBottom}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.6}
              className="text-muted-foreground"
              opacity={0.9}
            />
          )}

          {/* Margen perimetral de seguridad (línea punteada interna) */}
          {perimeterMargin > 0 && (
            <rect
              x={padding + marginLeft + perimeterMargin}
              y={padding + marginTop + perimeterMargin}
              width={widthMm - marginLeft - marginRight - perimeterMargin * 2}
              height={heightMm - marginTop - marginBottom - perimeterMargin * 2}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.5}
              strokeDasharray="2,2"
              className="text-muted-foreground"
              opacity={0.7}
            />
          )}

          {/* Placements (piezas) */}
          {placements.map((p, idx) => {
            const fill = pickColor(p, colorPalette, assignedKeys);
            const cx = padding + p.x + p.anchoMm / 2;
            const cy = padding + p.y + p.altoMm / 2;
            const textSize = Math.min(p.anchoMm, p.altoMm) * 0.15;
            const minDim = Math.min(p.anchoMm, p.altoMm);
            return (
              <g key={`p-${idx}`}>
                <rect
                  x={padding + p.x}
                  y={padding + p.y}
                  width={p.anchoMm}
                  height={p.altoMm}
                  fill={fill}
                  fillOpacity={0.3}
                  stroke={fill}
                  strokeWidth={0.8}
                />
                {minDim > 30 && (
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={textSize}
                    fill={fill}
                    style={{ fontWeight: 600 }}
                  >
                    {p.label ?? `${Math.round(p.anchoMm)}×${Math.round(p.altoMm)}`}
                    {p.rotada ? " ↻" : ""}
                  </text>
                )}
              </g>
            );
          })}

          {/* Borde del contenedor (encima de todo, para rollo sugiere dirección) */}
          <rect
            x={padding}
            y={padding}
            width={widthMm}
            height={heightMm}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            className="text-foreground"
          />

          {/* Indicador de dirección del rollo (flecha sutil al lado derecho) */}
          {container.type === "rollo" && heightMm > 50 && (
            <g
              transform={`translate(${padding + widthMm + padding * 0.3}, ${padding + heightMm / 2})`}
              opacity={0.5}
            >
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(widthMm * 0.02, 8)}
                fill="currentColor"
                className="text-muted-foreground"
                style={{ writingMode: "vertical-rl" as const }}
              >
                avance →
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
