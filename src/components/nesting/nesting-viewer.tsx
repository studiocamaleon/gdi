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
 *   - grid-2d-multi (rígidos multi-pieza sobre placa, futuro)
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

function colorForPieceId(pieceId: string, idx: number): string {
  // Hash simple para asignar color estable según pieceId
  let h = 0;
  for (let i = 0; i < pieceId.length; i++) h = (h * 31 + pieceId.charCodeAt(i)) | 0;
  return PIECE_COLORS[Math.abs(h + idx) % PIECE_COLORS.length];
}

function formatMm(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)}m`;
  return `${Math.round(mm)}mm`;
}

export function NestingViewer({
  result,
  maxPx = 480,
  showLabels = true,
  className,
}: NestingViewerProps) {
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
      {result.substrates.map((sub, idx) => (
        <SubstrateView
          key={idx}
          substrate={sub}
          substrateIndex={idx}
          totalSubstrates={totalSubstrates}
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

// ─── Header con métricas ─────────────────────────────────────────

function NestingHeader({ result }: { result: NestingViewerInput }) {
  const algorithmLabel = {
    "shelf-rollo": "Shelf-rollo (gran formato)",
    "grid-2d-single": "Grid 2D single (digital)",
    "grid-2d-multi": "Grid 2D multi (rígidos)",
  }[result.algorithm];

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
          <span className="text-amber-700">modo: {result.talonarioGrouping.modoIncompleto}</span>
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
  placements: NestingViewerInput["placements"];
  maxPx: number;
  showLabels: boolean;
}

function SubstrateView({
  substrate,
  substrateIndex,
  totalSubstrates,
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

  const viewBoxW = wPx + padPx * 2;
  const viewBoxH = hPx + padPx * 2;

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
          const fill = colorForPieceId(p.pieceId, idx);
          const meta = p.meta as { label?: string } | undefined;
          const label = meta?.label ?? p.pieceId;
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
                  {p.rotated ? " ↻" : ""}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
