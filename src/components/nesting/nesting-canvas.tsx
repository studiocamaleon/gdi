"use client";
import * as React from "react";
import type { NestingViewerInput } from "@/lib/productos-servicios-api";
import type {
  DemasiaPorLado,
  PosicionOjalView,
} from "@/lib/modificaciones-fisicas";
import {
  marcoDemasia,
  overlayAplicable,
  puntosOjales,
} from "@/lib/nesting-overlay";
import { CapasFabricacionPlacement } from "./capas-fabricacion-nesting";
import s from "./nesting-canvas.module.css";

export interface ModificacionesOverlay {
  demasia: DemasiaPorLado;
  /** Posiciones en coordenadas de la medida VISIBLE de la pieza. */
  ojales: PosicionOjalView[];
}

const PIECE_COLORS = [
  { fill: "#d9edf0", text: "#263238", stroke: "#6595a0" },
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
type VectorContour = {
  esHueco: boolean;
  puntos: Array<{ x: number; y: number }>;
};
type DisplayTransform = {
  rotated: boolean;
  substrateWidthMm: number;
  substrateHeightMm: number;
  scale: number;
  padPx: number;
  padXPx?: number;
  padYPx?: number;
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
  return `${formatNumber(mm, 2)}mm`;
}

function formatMeasurePair(widthMm: number, heightMm: number): string {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return "-";
  if (widthMm >= 100 && heightMm >= 100) {
    return `${formatNumber(widthMm / 10, 2)}×${formatNumber(heightMm / 10, 2)} cm`;
  }
  return `${formatMm(widthMm)}×${formatMm(heightMm)}`;
}

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: value % 1 === 0 ? 0 : Math.min(digits, 2),
  }).format(value);
}

function placementLabel(placement: Placement): string {
  const meta = placement.meta as { label?: string } | undefined;
  if (meta?.label) return meta.label;
  if (placement.panelIndex && placement.panelCount) {
    return formatMeasurePair(placement.widthMm, placement.heightMm);
  }
  return formatMeasurePair(
    placement.usefulWidthMm ?? placement.widthMm,
    placement.usefulHeightMm ?? placement.heightMm,
  );
}

function placementGroupKey(placement: Placement): string {
  // El giro de una copia no crea otra pieza ni cambia su color en la leyenda.
  const medidas = [
    placement.usefulWidthMm ?? placement.widthMm,
    placement.usefulHeightMm ?? placement.heightMm,
  ].sort((a, b) => a - b);
  return [
    placement.pieceId,
    ...medidas.map(Math.round),
    placement.panelCount ?? 0,
  ].join("|");
}

// ─── Plan de imposición de cuadernillo (caballete) ────────────────
// El motor publica `plan_imposicion` con el mapa página→posición por hoja.
// Esta tabla ES la instrucción del operario: se muestra acá (cotizador) y en
// la ficha/OT rehidratada. Ver docs/imposicion-cuadernillos-diseno.md.

type PlanImposicionOutput = {
  paginasSolicitadas: number;
  paginasEfectivas: number;
  paginasBlancas: number;
  hojasPorLibro: number;
  /** Hojas que imprime ESTE paso (tapa e interior son pasos distintos). */
  hojasDelPaso?: number;
  seleccionHojas?: { modo: string; desde?: number; hasta?: number };
  paginasDelPaso?: number[];
  librosPorJuego: number;
  juegos: number;
  plan: Array<{
    hoja: number;
    frente: [number, number];
    dorso: [number, number];
  }>;
};

function getPlanImposicion(
  outputs?: NestingViewerInput["outputsCanonicos"],
): PlanImposicionOutput | null {
  const raw = outputs?.plan_imposicion;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const plan = (raw as PlanImposicionOutput).plan;
  if (!Array.isArray(plan) || plan.length === 0) return null;
  return raw as PlanImposicionOutput;
}

/**
 * Sobre cada PAR acomodado dibuja lo que el sistema realmente pensó: las dos
 * páginas con su número (frente de la hoja 1, como pliego tipo) y la línea de
 * plegado al medio. Cada juego repite este acomodo con las páginas de su hoja
 * — eso lo dice la tabla del plan, abajo.
 */
function ImposicionOverlay({
  placements,
  displayTransform,
  plan,
}: {
  placements: NestingViewerInput["placements"];
  displayTransform: DisplayTransform;
  plan: PlanImposicionOutput;
}) {
  const hoja1 = plan.plan[0];
  if (!hoja1) return null;
  return (
    <g pointerEvents="none">
      {placements.map((placement, idx) => {
        const r = mapDisplayRect(
          displayTransform,
          placement.xMm,
          placement.yMm,
          placement.widthMm,
          placement.heightMm,
        );
        const rotated = Boolean(placement.rotated);
        // Sin rotar: páginas lado a lado (plegado vertical). Rotado 90°:
        // páginas apiladas (plegado horizontal).
        const fold = rotated
          ? {
              x1: r.x + 3,
              y1: r.y + r.height / 2,
              x2: r.x + r.width - 3,
              y2: r.y + r.height / 2,
            }
          : {
              x1: r.x + r.width / 2,
              y1: r.y + 3,
              x2: r.x + r.width / 2,
              y2: r.y + r.height - 3,
            };
        const centro1 = rotated
          ? { x: r.x + r.width / 2, y: r.y + r.height * 0.28 }
          : { x: r.x + r.width * 0.25, y: r.y + r.height * 0.52 };
        const centro2 = rotated
          ? { x: r.x + r.width / 2, y: r.y + r.height * 0.78 }
          : { x: r.x + r.width * 0.75, y: r.y + r.height * 0.52 };
        const fs = Math.max(
          9,
          Math.min(15, Math.min(r.width, r.height) * 0.12),
        );
        const caption = Math.max(6.5, fs * 0.6);
        return (
          <g key={`${placement.pieceId}-imp-${idx}`}>
            <line
              x1={fold.x1}
              y1={fold.y1}
              x2={fold.x2}
              y2={fold.y2}
              stroke="#7d7768"
              strokeWidth={1}
              strokeDasharray="7 5"
            />
            <text
              x={centro1.x}
              y={centro1.y}
              textAnchor="middle"
              fontSize={fs}
              fontFamily="monospace"
              fill="#3f3b31"
            >
              pág {hoja1.frente[0]}
            </text>
            <text
              x={centro2.x}
              y={centro2.y}
              textAnchor="middle"
              fontSize={fs}
              fontFamily="monospace"
              fill="#3f3b31"
            >
              pág {hoja1.frente[1]}
            </text>
            <text
              x={r.x + 5}
              y={r.y + caption + 4}
              fontSize={caption}
              fontFamily="monospace"
              fill="#8a8577"
            >
              hoja {hoja1.hoja} · frente (dorso: {hoja1.dorso[0]} |{" "}
              {hoja1.dorso[1]})
            </text>
          </g>
        );
      })}
    </g>
  );
}

type MaquinaVisual = NonNullable<
  NonNullable<NestingViewerInput["visualConfig"]>["maquina"]
>;

interface SubstrateViewProps {
  definitionIdPrefix: string;
  substrate: NestingViewerInput["substrates"][number];
  substrateIndex: number;
  totalSubstrates: number;
  visualConfig?: NestingViewerInput["visualConfig"];
  costingPreview?: NestingViewerInput["costingPreview"];
  placements: NestingViewerInput["placements"];
  maxPx: number;
  showLabels: boolean;
  modificaciones?: ModificacionesOverlay;
  /** Máquina a ilustrar como boca de impresora sobre el rollo (solo rollo). */
  printer?: MaquinaVisual | null;
  printerVisible?: boolean;
  /** Plan de imposición de cuadernillo: dibuja páginas y plegado en cada par. */
  planImposicion?: PlanImposicionOutput | null;
  commonLine?: NestingViewerInput["commonLine"];
  compact?: boolean;
  selectedPieceId?: string | null;
  svgRef?: React.Ref<SVGSVGElement>;
  accessibleLabel?: string;
}

function SubstrateView({
  definitionIdPrefix,
  substrate,
  substrateIndex,
  totalSubstrates,
  visualConfig,
  costingPreview,
  placements,
  maxPx,
  showLabels,
  modificaciones,
  printer,
  printerVisible,
  planImposicion,
  commonLine,
  compact = false,
  selectedPieceId,
  svgRef,
  accessibleLabel,
}: SubstrateViewProps) {
  const widthMm = substrate.widthMm;
  const heightMm =
    substrate.kind === "sheet" ? substrate.heightMm : substrate.lengthMm;
  const displayLandscape = shouldDisplaySheetLandscape(
    substrate.kind,
    widthMm,
    heightMm,
  );
  const displayWidthMm = displayLandscape ? heightMm : widthMm;
  const displayHeightMm = displayLandscape ? widthMm : heightMm;
  const longestMm = Math.max(displayWidthMm, displayHeightMm);
  const isRoll = substrate.kind === "roll";
  // Un rollo largo escala por el LARGO al lado más largo → el ancho queda
  // diminuto. Para rollos escalamos por el ANCHO (a un ancho legible fijo) y el
  // largo se muestra a escala real, con scroll vertical cuando no entra.
  // Con boca de impresora el canvas se agranda (presentación tipo diseño) y la
  // escala respeta la PROPORCIÓN máquina/material: la boca mide el ancho útil
  // de la máquina en los mismos px/mm que el rollo.
  const printerAnchoMm =
    printer?.anchoUtilMm && printer.anchoUtilMm > 0
      ? printer.anchoUtilMm
      : null;
  const ROLL_WIDTH_PX = printer != null ? 520 : 360;
  let scale = isRoll ? ROLL_WIDTH_PX / displayWidthMm : maxPx / longestMm;
  if (isRoll && printerAnchoMm && printerAnchoMm > displayWidthMm) {
    // Máquina mucho más ancha que el material: acotar el canvas escalando
    // todo hacia abajo (la proporción se conserva, que es lo que importa).
    scale = Math.min(scale, 900 / printerAnchoMm);
  }
  const wPx = displayWidthMm * scale;
  const hPx = displayHeightMm * scale;
  const padPx = 34;
  // La boca (ancho útil de la máquina) necesita aire a los costados del rollo.
  const mouthWPx = printerAnchoMm ? printerAnchoMm * scale : wPx + 12;
  const padXPx =
    isRoll && printer != null
      ? Math.max(padPx, (mouthWPx + 96 - wPx) / 2)
      : Math.max(padPx, (360 - wPx) / 2);
  const padYPx = padPx;
  const effectiveVisualConfig = getEffectiveVisualConfig(
    visualConfig,
    widthMm,
    heightMm,
  );
  const displayTransform: DisplayTransform = {
    rotated: displayLandscape,
    substrateWidthMm: widthMm,
    substrateHeightMm: heightMm,
    scale,
    padPx,
    padXPx,
    padYPx,
  };
  const placementTransform = getCenteredPlacementTransform(
    displayTransform,
    placements,
    effectiveVisualConfig,
    substrate.kind,
  );
  const viewBoxW = wPx + padXPx * 2;
  // Boca de impresora sobre el rollo: el chasis ocupa una banda propia arriba
  // y TODO el contenido existente se corre con un <g translate> (así ninguna
  // capa cambia su matemática). El rollo asoma a 6px de la boca. La altura del
  // chasis escala con el ancho de la boca (proporción del diseño original).
  const showPrinter = isRoll && printer != null && printerVisible !== false;
  const printerChassisH = showPrinter
    ? Math.max(64, Math.min(120, Math.round(mouthWPx * 0.14)))
    : 64;
  const contentOffsetY = showPrinter
    ? Math.max(0, printerChassisH + 6 - padYPx)
    : 0;
  const viewBoxH = hPx + padYPx * 2 + contentOffsetY;
  const hasMargins = Object.values(effectiveVisualConfig.margins).some(
    (value) => value > 0,
  );
  const largeSheet =
    substrate.kind === "sheet" && Math.max(widthMm, heightMm) >= 1000;
  // Rollo: ancho natural (no estirar el rollo angosto a lo ancho del canvas).
  // El scroll vertical se hace cargo del largo. Alto máximo del contenedor
  // (más generoso con la boca de impresora, que agranda la presentación).
  const ROLL_MAX_CANVAS_HEIGHT_PX = printer != null ? 760 : 520;
  const rollScrolls = isRoll && viewBoxH > ROLL_MAX_CANVAS_HEIGHT_PX;
  const canvasMaxWidth = isRoll
    ? viewBoxW
    : Math.min(
        Math.max(
          viewBoxW,
          substrate.kind === "sheet" ? (largeSheet ? 820 : 520) : 680,
        ),
        substrate.kind === "sheet" ? (largeSheet ? 1180 : 760) : 980,
      );
  const substrateRect = mapDisplayRect(
    displayTransform,
    0,
    0,
    widthMm,
    heightMm,
  );
  const printableArea = getPrintableArea(
    effectiveVisualConfig,
    widthMm,
    heightMm,
  );
  const printableClipRect = mapDisplayRect(
    displayTransform,
    printableArea.xMm,
    printableArea.yMm,
    printableArea.widthMm,
    printableArea.heightMm,
  );
  const svgIdBase = `${definitionIdPrefix}-${substrateIndex}`;
  const marginPatternId = `${svgIdBase}-margin`;
  const printableClipId = `${svgIdBase}-printable-clip`;
  const printerBodyId = `${svgIdBase}-printer-body`;
  const printerSlotId = `${svgIdBase}-printer-slot`;
  const printerShadeId = `${svgIdBase}-printer-shade`;

  return (
    <div className={s.substrate} data-compact={compact || undefined}>
      <div
        className={s.canvasWrap}
        style={
          rollScrolls
            ? { maxHeight: `${ROLL_MAX_CANVAS_HEIGHT_PX}px`, overflowY: "auto" }
            : undefined
        }
      >
        <svg
          ref={svgRef}
          role="img"
          aria-label={
            accessibleLabel ??
            `Distribución en ${substrate.kind === "roll" ? "rollo" : "placa o pliego"} · ${formatMeasurePair(widthMm, heightMm)}`
          }
          xmlns="http://www.w3.org/2000/svg"
          className={s.canvasSvg}
          viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
          width="100%"
          style={{ maxWidth: `${canvasMaxWidth}px` }}
          preserveAspectRatio="xMidYMin meet"
        >
          <title>
            {accessibleLabel ??
              `Acomodo de ${formatMeasurePair(widthMm, heightMm)}`}
          </title>
          <defs>
            <pattern
              id={marginPatternId}
              patternUnits="userSpaceOnUse"
              width="7"
              height="7"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="7"
                stroke="#8b8277"
                strokeWidth="1"
                opacity="0.2"
              />
            </pattern>
            <clipPath id={printableClipId}>
              <rect
                x={printableClipRect.x}
                y={printableClipRect.y}
                width={printableClipRect.width}
                height={printableClipRect.height}
              />
            </clipPath>
            {showPrinter ? (
              <>
                <linearGradient id={printerBodyId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f1efec" />
                  <stop offset="0.55" stopColor="#e4e1dc" />
                  <stop offset="1" stopColor="#d5d2cc" />
                </linearGradient>
                <linearGradient id={printerSlotId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#2c2c33" />
                  <stop offset="1" stopColor="#5b5b64" />
                </linearGradient>
                <linearGradient id={printerShadeId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="rgba(20,20,26,.16)" />
                  <stop offset="1" stopColor="rgba(20,20,26,0)" />
                </linearGradient>
              </>
            ) : null}
          </defs>
          {showPrinter && printer ? (
            <PrinterMouth
              maquina={printer}
              printerBodyId={printerBodyId}
              printerSlotId={printerSlotId}
              viewBoxW={viewBoxW}
              chassisH={printerChassisH}
              mouthX={padXPx + wPx / 2 - mouthWPx / 2}
              mouthW={mouthWPx}
            />
          ) : null}
          <g
            transform={
              contentOffsetY > 0 ? `translate(0 ${contentOffsetY})` : undefined
            }
          >
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
            <SheetOverhangLayer
              visualConfig={effectiveVisualConfig}
              substrateWidthMm={widthMm}
              substrateHeightMm={heightMm}
              displayTransform={displayTransform}
            />
            {hasMargins ? (
              <MarginsLayer
                visualConfig={effectiveVisualConfig}
                padPx={padPx}
                scale={scale}
                substrateWidthMm={widthMm}
                substrateHeightMm={heightMm}
                patternId={marginPatternId}
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
              clipPathId={printableClipId}
              displayTransform={placementTransform}
            />
            <DimensionLabels
              padPx={padPx}
              padXPx={padXPx}
              padYPx={padYPx}
              widthPx={wPx}
              heightPx={hPx}
              widthMm={displayWidthMm}
              heightMm={displayHeightMm}
              hideWidthLabel={showPrinter}
            />
            <g
              clipPath={
                substrate.kind === "roll"
                  ? `url(#${printableClipId})`
                  : undefined
              }
            >
              {placements.map((placement, idx) => (
                <PlacementRect
                  key={`${placement.pieceId}-${idx}`}
                  placement={placement}
                  index={idx}
                  showLabels={showLabels && !planImposicion}
                  muted={
                    !!selectedPieceId && selectedPieceId !== placement.pieceId
                  }
                  displayTransform={placementTransform}
                  modificaciones={modificaciones}
                />
              ))}
              <CommonLineLayer
                commonLine={commonLine}
                substrateIndex={substrateIndex}
                displayTransform={placementTransform}
              />
              {planImposicion ? (
                <ImposicionOverlay
                  placements={placements}
                  displayTransform={placementTransform}
                  plan={planImposicion}
                />
              ) : null}
            </g>
            {isRoll && printer ? (
              <PrintStartMarker
                substrateRect={substrateRect}
                printableTopY={printableClipRect.y}
              />
            ) : null}
            {showPrinter ? (
              <rect
                x={substrateRect.x}
                y={substrateRect.y}
                width={substrateRect.width}
                height={Math.min(26, 16 * (printerChassisH / 64))}
                fill={`url(#${printerShadeId})`}
                pointerEvents="none"
              />
            ) : null}
          </g>
        </svg>
      </div>
    </div>
  );
}

/**
 * Boca de impresora de gran formato sobre el rollo (diseño "Nesting con boca
 * de impresora"): chasis con placa identificatoria, riel con carro, panel de
 * control y la ranura por donde "sale" el material. Puro SVG presentacional,
 * escalado al viewBox del canvas (~360 uds de ancho).
 */
function PrinterMouth({
  maquina,
  printerBodyId,
  printerSlotId,
  viewBoxW,
  chassisH,
  mouthX,
  mouthW,
}: {
  maquina: MaquinaVisual;
  printerBodyId: string;
  printerSlotId: string;
  viewBoxW: number;
  chassisH: number;
  mouthX: number;
  mouthW: number;
}) {
  const chassisX = 2;
  const chassisW = viewBoxW - 4;
  // Factor de escala: el dibujo base está pensado a 64 de alto; con canvas
  // grandes el chasis crece y todo escala con él.
  const f = chassisH / 64;
  const anchoM =
    maquina.anchoUtilMm && maquina.anchoUtilMm > 0
      ? formatNumber(maquina.anchoUtilMm / 1000, 2)
      : null;
  const plateSub = [
    anchoM ? `ancho útil ${anchoM} m` : null,
    maquina.tecnologia,
  ]
    .filter(Boolean)
    .join(" · ");
  const mouthClampedX = Math.max(chassisX + 6 * f, mouthX);
  const mouthClampedW = Math.min(
    mouthW,
    chassisX + chassisW - 6 * f - mouthClampedX,
  );
  const mouthCenterX = mouthClampedX + mouthClampedW / 2;
  const carriageW = 56 * f;
  const panelW = 50 * f;
  const panelX = chassisX + chassisW - panelW - 8 * f;
  const railY = chassisH * 0.63;
  return (
    <g aria-hidden pointerEvents="none">
      <rect
        x={chassisX}
        y={2}
        width={chassisW}
        height={chassisH - 2}
        rx={7 * f}
        fill={`url(#${printerBodyId})`}
      />
      <rect
        x={chassisX + 7 * f}
        y={2}
        width={chassisW - 14 * f}
        height={2 * f}
        fill="#cbc7c1"
      />
      {/* riel + carro */}
      <rect
        x={chassisX + 22 * f}
        y={railY}
        width={chassisW - 44 * f}
        height={1.6 * f}
        fill="#b6b2ab"
      />
      <rect
        x={chassisX + 22 * f}
        y={railY + 2.6 * f}
        width={chassisW - 44 * f}
        height={0.8 * f}
        fill="#efedea"
      />
      <rect
        x={mouthCenterX - carriageW / 2}
        y={railY - 7 * f}
        width={carriageW}
        height={14 * f}
        rx={2.5 * f}
        fill="#23232a"
      />
      <rect
        x={mouthCenterX - carriageW / 2 + 4 * f}
        y={railY - 4 * f}
        width={carriageW - 8 * f}
        height={4 * f}
        rx={1.2 * f}
        fill="#3d3d45"
      />
      <rect
        x={mouthCenterX - 13 * f}
        y={railY + 5 * f}
        width={26 * f}
        height={2.2 * f}
        rx={f}
        fill="#0891b2"
        opacity={0.85}
      />
      {/* placa identificatoria */}
      <text
        x={chassisX + 10 * f}
        y={16 * f}
        fontSize={9 * f}
        fontFamily="var(--font-mono, monospace)"
        letterSpacing={0.4 * f}
        fill="#5f5f68"
      >
        {maquina.nombre.toUpperCase()}
      </text>
      {plateSub ? (
        <text
          x={chassisX + 10 * f}
          y={27 * f}
          fontSize={7.5 * f}
          fontFamily="var(--font-mono, monospace)"
          fill="#9c998f"
        >
          {plateSub}
        </text>
      ) : null}
      {/* panel de control */}
      <rect
        x={panelX}
        y={9 * f}
        width={panelW}
        height={19 * f}
        rx={2.5 * f}
        fill="#f6f5f3"
        stroke="#c9c5be"
        strokeWidth={0.8 * f}
      />
      <rect
        x={panelX + 4 * f}
        y={13 * f}
        width={24 * f}
        height={2.4 * f}
        rx={1.2 * f}
        fill="#d3cfc8"
      />
      <rect
        x={panelX + 4 * f}
        y={18 * f}
        width={15 * f}
        height={2.4 * f}
        rx={1.2 * f}
        fill="#d3cfc8"
      />
      <circle
        cx={panelX + panelW - 6 * f}
        cy={23 * f}
        r={2.2 * f}
        fill="#0891b2"
      />
      {/* ventilaciones */}
      <g stroke="#c9c5be" strokeWidth={f} strokeLinecap="round">
        <line
          x1={panelX - 84 * f}
          y1={13 * f}
          x2={panelX - 14 * f}
          y2={13 * f}
        />
        <line
          x1={panelX - 84 * f}
          y1={17.5 * f}
          x2={panelX - 14 * f}
          y2={17.5 * f}
        />
        <line
          x1={panelX - 84 * f}
          y1={22 * f}
          x2={panelX - 14 * f}
          y2={22 * f}
        />
      </g>
      {/* boca: mide el ancho útil de la MÁQUINA a escala (el rollo, más angosto,
          queda centrado debajo — se lee la proporción máquina/material) */}
      <rect
        x={mouthClampedX - 4 * f}
        y={chassisH - 13 * f}
        width={mouthClampedW + 8 * f}
        height={13 * f}
        fill="#cdc9c3"
      />
      <rect
        x={mouthClampedX}
        y={chassisH - 9 * f}
        width={mouthClampedW}
        height={9 * f}
        fill={`url(#${printerSlotId})`}
      />
      {anchoM ? (
        <text
          x={mouthCenterX}
          y={chassisH - 2.5 * f}
          textAnchor="middle"
          fontSize={6.5 * f}
          fontFamily="var(--font-mono, monospace)"
          letterSpacing={0.6 * f}
          fill="#c4c0b9"
        >
          {`${anchoM} M ÚTIL`}
        </text>
      ) : null}
      <rect
        x={chassisX}
        y={2}
        width={chassisW}
        height={chassisH - 2}
        rx={7 * f}
        fill="none"
        stroke="#c4c0b9"
        strokeWidth={1}
      />
    </g>
  );
}

/**
 * Marcador "inicio de impresión": dónde arranca el área imprimible después
 * del margen superior del rollo. La etiqueta solo entra si el margen da lugar.
 */
function PrintStartMarker({
  substrateRect,
  printableTopY,
}: {
  substrateRect: { x: number; y: number; width: number; height: number };
  printableTopY: number;
}) {
  const centerX = substrateRect.x + substrateRect.width / 2;
  const topMarginPx = printableTopY - substrateRect.y;
  const showLabel = topMarginPx >= 12;
  return (
    <g aria-hidden pointerEvents="none">
      <line
        x1={centerX}
        y1={substrateRect.y}
        x2={centerX}
        y2={printableTopY}
        stroke="#0891b2"
        strokeWidth={1.2}
        strokeDasharray="4 3"
      />
      <line
        x1={substrateRect.x}
        y1={printableTopY}
        x2={substrateRect.x + substrateRect.width}
        y2={printableTopY}
        stroke="#0891b2"
        strokeWidth={1}
        opacity={0.65}
      />
      <circle cx={centerX} cy={printableTopY} r={3.5} fill="#0891b2" />
      {showLabel ? (
        <text
          x={substrateRect.x + substrateRect.width - 5}
          y={printableTopY - 5}
          textAnchor="end"
          fontSize={9.5}
          fontFamily="var(--font-mono, monospace)"
          fill="#0891b2"
        >
          inicio de impresión
        </text>
      ) : null}
    </g>
  );
}

function DimensionLabels({
  padPx,
  padXPx = padPx,
  padYPx = padPx,
  widthPx,
  heightPx,
  widthMm,
  heightMm,
  hideWidthLabel,
}: {
  padPx: number;
  padXPx?: number;
  padYPx?: number;
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
  /** Con la boca de impresora visible, el ancho ya lo dice la ranura. */
  hideWidthLabel?: boolean;
}) {
  return (
    <>
      {!hideWidthLabel ? (
        <text
          x={padXPx + widthPx / 2}
          y={Math.max(13, padYPx - 12)}
          textAnchor="middle"
          fontSize={11}
          fill="#4b5563"
          fontFamily="monospace"
        >
          {formatMm(widthMm)}
        </text>
      ) : null}
      <text
        x={Math.max(13, padXPx - 14)}
        y={padYPx + heightPx / 2}
        textAnchor="middle"
        fontSize={11}
        fill="#4b5563"
        fontFamily="monospace"
        transform={`rotate(-90, ${Math.max(13, padXPx - 14)}, ${padYPx + heightPx / 2})`}
      >
        {formatMm(heightMm)}
      </text>
    </>
  );
}

/** Convierte los contornos finales del solver desde metadata no confiable. */
function getVectorContours(placement: Placement): VectorContour[] {
  const meta = placement.meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];
  const raw = (meta as { contornos?: unknown }).contornos;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      return [];
    const contour = candidate as { esHueco?: unknown; puntos?: unknown };
    if (!Array.isArray(contour.puntos) || contour.puntos.length < 3) return [];
    const puntos = contour.puntos.flatMap((point) => {
      if (!point || typeof point !== "object" || Array.isArray(point))
        return [];
      const { x, y } = point as { x?: unknown; y?: unknown };
      return typeof x === "number" &&
        Number.isFinite(x) &&
        typeof y === "number" &&
        Number.isFinite(y)
        ? [{ x, y }]
        : [];
    });
    return puntos.length === contour.puntos.length
      ? [{ esHueco: contour.esHueco === true, puntos }]
      : [];
  });
}

function mapDisplayPoint(
  transform: DisplayTransform,
  point: { x: number; y: number },
) {
  const { padPx, scale } = transform;
  const padXPx = transform.padXPx ?? padPx;
  const padYPx = transform.padYPx ?? padPx;
  const displayX = point.x + (transform.offsetXMm ?? 0);
  const displayY = point.y + (transform.offsetYMm ?? 0);
  if (!transform.rotated) {
    return {
      x: padXPx + displayX * scale,
      y: padYPx + displayY * scale,
    };
  }
  return {
    x: padXPx + (transform.substrateHeightMm - displayY) * scale,
    y: padYPx + displayX * scale,
  };
}

function vectorPathData(
  contours: VectorContour[],
  displayTransform: DisplayTransform,
) {
  return contours
    .map(
      (contour) =>
        contour.puntos
          .map((point, index) => {
            const mapped = mapDisplayPoint(displayTransform, point);
            return `${index === 0 ? "M" : "L"}${mapped.x} ${mapped.y}`;
          })
          .join(" ") + " Z",
    )
    .join(" ");
}

function contourAreaMm2(contour: VectorContour) {
  let doubleArea = 0;
  for (let index = 0; index < contour.puntos.length; index++) {
    const current = contour.puntos[index];
    const next = contour.puntos[(index + 1) % contour.puntos.length];
    doubleArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(doubleArea) / 2;
}

function placementAreaMm2(placement: Placement) {
  const contours = getVectorContours(placement);
  if (contours.length === 0) return placement.widthMm * placement.heightMm;
  return Math.max(
    0,
    contours.reduce(
      (area, contour) =>
        area + (contour.esHueco ? -1 : 1) * contourAreaMm2(contour),
      0,
    ),
  );
}

function PlacementRect({
  placement,
  index,
  showLabels,
  muted,
  displayTransform,
  modificaciones,
}: {
  placement: Placement;
  muted?: boolean;
  index: number;
  showLabels: boolean;
  displayTransform: DisplayTransform;
  modificaciones?: ModificacionesOverlay;
}) {
  const rect = mapDisplayRect(
    displayTransform,
    placement.xMm,
    placement.yMm,
    placement.widthMm,
    placement.heightMm,
  );
  const { x, y, width: w, height: h } = rect;
  const style = colorForKey(placementGroupKey(placement));
  const vectorContours = getVectorContours(placement);
  const vectorPath =
    vectorContours.length > 0
      ? vectorPathData(vectorContours, displayTransform)
      : null;
  const origen = mapDisplayPoint(displayTransform, { x: 0, y: 0 });
  const ejeX = mapDisplayPoint(displayTransform, { x: 1, y: 0 });
  const ejeY = mapDisplayPoint(displayTransform, { x: 0, y: 1 });
  const transformCapas = `matrix(${ejeX.x - origen.x} ${ejeX.y - origen.y} ${ejeY.x - origen.x} ${ejeY.y - origen.y} ${origen.x} ${origen.y})`;
  const baseLabel = placementLabel(placement);
  const label =
    placement.panelIndex && placement.panelCount
      ? `${baseLabel} · P${placement.panelIndex}/${placement.panelCount}`
      : baseLabel;
  const labelFontSize = Math.min(
    12,
    Math.max(0, (w - 8) / Math.max(1, label.length * 0.62)),
    Math.max(0, h * 0.22),
  );
  const showMainLabel = showLabels && w > 24 && h > 14 && labelFontSize >= 5;
  const overlapStartMm = Math.max(0, placement.overlapStartMm ?? 0);
  const overlapEndMm = Math.max(0, placement.overlapEndMm ?? 0);
  const verticalStart =
    overlapStartMm > 0
      ? mapDisplayRect(
          displayTransform,
          placement.xMm,
          placement.yMm,
          Math.min(overlapStartMm, placement.widthMm),
          placement.heightMm,
        )
      : null;
  const verticalEnd =
    overlapEndMm > 0
      ? mapDisplayRect(
          displayTransform,
          placement.xMm + Math.max(0, placement.widthMm - overlapEndMm),
          placement.yMm,
          Math.min(overlapEndMm, placement.widthMm),
          placement.heightMm,
        )
      : null;
  const horizontalStart =
    overlapStartMm > 0
      ? mapDisplayRect(
          displayTransform,
          placement.xMm,
          placement.yMm,
          placement.widthMm,
          Math.min(overlapStartMm, placement.heightMm),
        )
      : null;
  const horizontalEnd =
    overlapEndMm > 0
      ? mapDisplayRect(
          displayTransform,
          placement.xMm,
          placement.yMm + Math.max(0, placement.heightMm - overlapEndMm),
          placement.widthMm,
          Math.min(overlapEndMm, placement.heightMm),
        )
      : null;

  return (
    <g data-piece-id={placement.pieceId} opacity={muted ? 0.18 : 1}>
      <title>{`${(placement.meta as { title?: string } | undefined)?.title ?? label} · ${formatMeasurePair(placement.widthMm, placement.heightMm)}${placement.rotated ? " · Girada 90°" : ""}`}</title>
      {vectorPath ? (
        <path
          d={vectorPath}
          fill={style.fill}
          fillOpacity={0.15}
          fillRule="evenodd"
          clipRule="evenodd"
          stroke={style.stroke}
          strokeWidth={0.8}
          strokeLinejoin="miter"
          strokeLinecap="square"
        />
      ) : (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth={0.8}
        />
      )}
      <CapasFabricacionPlacement
        placement={placement}
        transform={transformCapas}
      />
      {placement.panelAxis === "vertical" && verticalStart ? (
        <rect
          x={verticalStart.x}
          y={verticalStart.y}
          width={verticalStart.width}
          height={verticalStart.height}
          fill="#fef3c7"
          fillOpacity={0.58}
          stroke="#d97706"
          strokeWidth={0.35}
        />
      ) : null}
      {placement.panelAxis === "vertical" && verticalEnd ? (
        <rect
          x={verticalEnd.x}
          y={verticalEnd.y}
          width={verticalEnd.width}
          height={verticalEnd.height}
          fill="#fef3c7"
          fillOpacity={0.58}
          stroke="#d97706"
          strokeWidth={0.35}
        />
      ) : null}
      {placement.panelAxis === "horizontal" && horizontalStart ? (
        <rect
          x={horizontalStart.x}
          y={horizontalStart.y}
          width={horizontalStart.width}
          height={horizontalStart.height}
          fill="#fef3c7"
          fillOpacity={0.58}
          stroke="#d97706"
          strokeWidth={0.35}
        />
      ) : null}
      {placement.panelAxis === "horizontal" && horizontalEnd ? (
        <rect
          x={horizontalEnd.x}
          y={horizontalEnd.y}
          width={horizontalEnd.width}
          height={horizontalEnd.height}
          fill="#fef3c7"
          fillOpacity={0.58}
          stroke="#d97706"
          strokeWidth={0.35}
        />
      ) : null}
      {placement.rotated && !vectorPath ? (
        <line
          x1={x}
          y1={y}
          x2={x + w}
          y2={y + h}
          stroke={style.text}
          strokeWidth={0.45}
          strokeDasharray="3 3"
          opacity={0.35}
        />
      ) : null}
      <ModificacionesFisicasOverlay
        placement={placement}
        displayTransform={displayTransform}
        modificaciones={modificaciones}
      />
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
            fill={vectorPath ? "#202327" : style.text}
            pointerEvents="none"
          >
            {label}
          </text>
          {w > 54 && h > 30 ? (
            <text
              x={x + 6}
              y={y + 12}
              fontSize={7.5}
              fontFamily="monospace"
              fill={style.text}
              fillOpacity={0.55}
              pointerEvents="none"
            >
              P-{String(index + 1).padStart(2, "0")}
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

function CommonLineLayer({
  commonLine,
  substrateIndex,
  displayTransform,
}: {
  commonLine?: NestingViewerInput["commonLine"];
  compact?: boolean;
  selectedPieceId?: string | null;
  svgRef?: React.Ref<SVGSVGElement>;
  accessibleLabel?: string;
  substrateIndex: number;
  displayTransform: DisplayTransform;
}) {
  if (!commonLine?.aplicado) return null;
  return (
    <g aria-label="Líneas de corte compartidas" pointerEvents="none">
      {commonLine.tramos
        .filter((tramo) => tramo.placa === substrateIndex)
        .map((tramo) => {
          const inicio = mapDisplayPoint(displayTransform, tramo.inicio);
          const fin = mapDisplayPoint(displayTransform, tramo.fin);
          return (
            <line
              key={tramo.id}
              x1={inicio.x}
              y1={inicio.y}
              x2={fin.x}
              y2={fin.y}
              stroke="#ff6b2c"
              strokeWidth={2.2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            >
              <title>
                Common Line · {formatMm(tramo.longitudMm)} compartidos
              </title>
            </line>
          );
        })}
    </g>
  );
}

function getCostingPreviewForSubstrate(
  costingPreview: NestingViewerInput["costingPreview"] | undefined,
  substrateIndex: number,
  totalSubstrates: number,
  widthMm: number,
  heightMm: number,
): NestingViewerInput["costingPreview"] | undefined {
  const substratePreview = costingPreview?.perSubstrate?.find(
    (item) => item.index === substrateIndex,
  );
  if (costingPreview && substratePreview) {
    return {
      ...costingPreview,
      ...substratePreview,
      perSubstrate: undefined,
    };
  }

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

function getPrintableArea(
  visualConfig: VisualConfig,
  widthMm: number,
  heightMm: number,
) {
  return (
    visualConfig.printableArea ?? {
      xMm: visualConfig.margins.leftMm,
      yMm: visualConfig.margins.topMm,
      widthMm: Math.max(
        0,
        widthMm - visualConfig.margins.leftMm - visualConfig.margins.rightMm,
      ),
      heightMm: Math.max(
        0,
        heightMm - visualConfig.margins.topMm - visualConfig.margins.bottomMm,
      ),
    }
  );
}

function shouldDisplaySheetLandscape(
  kind: "sheet" | "roll",
  widthMm: number,
  heightMm: number,
) {
  return (
    kind === "sheet" &&
    heightMm > widthMm * 1.12 &&
    Math.max(widthMm, heightMm) >= 1000
  );
}

function getCenteredPlacementTransform(
  transform: DisplayTransform,
  placements: NestingViewerInput["placements"],
  visualConfig: VisualConfig,
  substrateKind: "sheet" | "roll",
): DisplayTransform {
  if (
    substrateKind !== "sheet" ||
    placements.length === 0 ||
    visualConfig.centerPlacements !== true
  ) {
    return transform;
  }

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
    offsetXMm:
      extraXMm > 0.01 ? usableArea.xMm + extraXMm / 2 - bounds.minX : 0,
    offsetYMm:
      extraYMm > 0.01 ? usableArea.yMm + extraYMm / 2 - bounds.minY : 0,
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
  const padXPx = transform.padXPx ?? padPx;
  const padYPx = transform.padYPx ?? padPx;
  const displayXMm = xMm + (transform.offsetXMm ?? 0);
  const displayYMm = yMm + (transform.offsetYMm ?? 0);
  if (!transform.rotated) {
    return {
      x: padXPx + displayXMm * scale,
      y: padYPx + displayYMm * scale,
      width: widthMm * scale,
      height: heightMm * scale,
    };
  }

  return {
    x: padXPx + (transform.substrateHeightMm - displayYMm - heightMm) * scale,
    y: padYPx + displayXMm * scale,
    width: heightMm * scale,
    height: widthMm * scale,
  };
}

function getPieceBleedMm(visualConfig: VisualConfig) {
  const explicit = visualConfig.pieceBleedMm;
  if (Number.isFinite(explicit) && explicit != null) {
    return Math.max(0, explicit);
  }
  return (
    Math.max(
      visualConfig.spacing.horizontalMm,
      visualConfig.spacing.verticalMm,
    ) / 2
  );
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
  const printableArea = getPrintableArea(
    visualConfig,
    substrateWidthMm,
    substrateHeightMm,
  );
  const rect = mapDisplayRect(
    displayTransform,
    printableArea.xMm,
    printableArea.yMm,
    printableArea.widthMm,
    printableArea.heightMm,
  );
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

function SheetOverhangLayer({
  visualConfig,
  substrateWidthMm,
  substrateHeightMm,
  displayTransform,
}: {
  visualConfig: VisualConfig;
  substrateWidthMm: number;
  substrateHeightMm: number;
  displayTransform: DisplayTransform;
}) {
  const manejo = visualConfig.manejoPlaca;
  if (!manejo || manejo.excedenteMm <= 0) return null;

  const workEndX = manejo.workArea.xMm + manejo.workArea.widthMm;
  const workEndY = manejo.workArea.yMm + manejo.workArea.heightMm;
  const excedeEnY = workEndY < substrateHeightMm - 0.01;
  const zona = excedeEnY
    ? {
        xMm: 0,
        yMm: workEndY,
        widthMm: substrateWidthMm,
        heightMm: Math.max(0, substrateHeightMm - workEndY),
      }
    : {
        xMm: workEndX,
        yMm: 0,
        widthMm: Math.max(0, substrateWidthMm - workEndX),
        heightMm: substrateHeightMm,
      };
  if (zona.widthMm <= 0 || zona.heightMm <= 0) return null;

  const rect = mapDisplayRect(
    displayTransform,
    zona.xMm,
    zona.yMm,
    zona.widthMm,
    zona.heightMm,
  );
  const labelFits = rect.width >= 95 && rect.height >= 22;

  return (
    <g pointerEvents="none">
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="#fff1e8"
        fillOpacity={0.9}
        stroke="#ff642d"
        strokeWidth={1}
        strokeDasharray="6 4"
      />
      {labelFits ? (
        <text
          x={rect.x + rect.width / 2}
          y={rect.y + rect.height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#a63d18"
          fontSize={11}
          fontWeight={600}
        >
          Fuera de alcance · {formatMm(manejo.excedenteMm)}
        </text>
      ) : null}
    </g>
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
  const bottom = mapDisplayRect(
    displayTransform,
    0,
    substrateHeightMm - bottomMm,
    substrateWidthMm,
    bottomMm,
  );
  const left = mapDisplayRect(
    displayTransform,
    0,
    0,
    leftMm,
    substrateHeightMm,
  );
  const right = mapDisplayRect(
    displayTransform,
    substrateWidthMm - rightMm,
    0,
    rightMm,
    substrateHeightMm,
  );
  return (
    <g opacity={0.95}>
      {topMm > 0 ? (
        <rect
          x={top.x}
          y={top.y}
          width={top.width}
          height={top.height}
          fill={fill}
        />
      ) : null}
      {bottomMm > 0 ? (
        <rect
          x={bottom.x}
          y={bottom.y}
          width={bottom.width}
          height={bottom.height}
          fill={fill}
        />
      ) : null}
      {leftMm > 0 ? (
        <rect
          x={left.x}
          y={left.y}
          width={left.width}
          height={left.height}
          fill={fill}
        />
      ) : null}
      {rightMm > 0 ? (
        <rect
          x={right.x}
          y={right.y}
          width={right.width}
          height={right.height}
          fill={fill}
        />
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
          <CostingRect
            key={`cost-${placement.pieceId}-${idx}`}
            rect={mapDisplayRect(
              placementTransform,
              placement.xMm,
              placement.yMm,
              placement.widthMm,
              placement.heightMm,
            )}
          />
        ))}
      </g>
    );
  }

  const chargedRatio = costingPreview.chargedRatio ?? 1;
  const bounds =
    costingPreview.chargedBounds ??
    (substrateWidthMm > substrateHeightMm
      ? {
          xMm: 0,
          yMm: 0,
          widthMm: substrateWidthMm * chargedRatio,
          heightMm: substrateHeightMm,
        }
      : {
          xMm: 0,
          yMm: 0,
          widthMm: substrateWidthMm,
          heightMm: substrateHeightMm * chargedRatio,
        });

  return (
    <g>
      <rect
        {...svgRect(
          mapDisplayRect(
            displayTransform,
            bounds.xMm,
            bounds.yMm,
            bounds.widthMm,
            bounds.heightMm,
          ),
        )}
        fill="#fff1c8"
        fillOpacity={0.62}
        stroke="#e7be58"
        strokeWidth={0.8}
      />
      {costingPreview.wasteAreaMm2 && costingPreview.wasteAreaMm2 > 0 ? (
        <rect
          {...svgRect(
            mapDisplayRect(
              displayTransform,
              bounds.xMm,
              bounds.yMm,
              bounds.widthMm,
              bounds.heightMm,
            ),
          )}
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
        const hasLeftNeighbor =
          sepH > 0 && hasAdjacentPlacement(placement, placements, "left", sepH);
        const hasRightNeighbor =
          sepH > 0 &&
          hasAdjacentPlacement(placement, placements, "right", sepH);
        const hasTopNeighbor =
          sepV > 0 && hasAdjacentPlacement(placement, placements, "top", sepV);
        const hasBottomNeighbor =
          sepV > 0 &&
          hasAdjacentPlacement(placement, placements, "bottom", sepV);
        const leftBleed = mapDisplayRect(
          displayTransform,
          leftGapX,
          placement.yMm,
          pieceBleedMm,
          placement.heightMm,
        );
        const rightBleed = mapDisplayRect(
          displayTransform,
          rightGapX,
          placement.yMm,
          hasRightNeighbor ? sepH : pieceBleedMm,
          placement.heightMm,
        );
        const topBleed = mapDisplayRect(
          displayTransform,
          placement.xMm,
          topGapY,
          placement.widthMm,
          pieceBleedMm,
        );
        const bottomBleed = mapDisplayRect(
          displayTransform,
          placement.xMm,
          bottomGapY,
          placement.widthMm,
          hasBottomNeighbor ? sepV : pieceBleedMm,
        );
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

/**
 * Franja de demasía + ubicación de los ojales sobre una pieza.
 *
 * La demasía se pinta como UN path con `fillRule="evenodd"` (marco exterior
 * menos área visible) para que las esquinas no se superpongan y queden más
 * oscuras que el resto de la franja.
 *
 * No se dibuja sobre piezas paneleadas: ahí cada placement es una tajada y las
 * franjas caerían sobre las líneas de unión interiores.
 */
function ModificacionesFisicasOverlay({
  placement,
  displayTransform,
  modificaciones,
}: {
  placement: Placement;
  displayTransform: DisplayTransform;
  modificaciones?: ModificacionesOverlay;
}) {
  if (!modificaciones) return null;
  if (!overlayAplicable(placement)) return null;

  const marco = marcoDemasia(placement, modificaciones.demasia);
  const puntos = puntosOjales(
    placement,
    modificaciones.demasia,
    modificaciones.ojales,
  );
  if (!marco && puntos.length === 0) return null;

  const toRect = (r: {
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
  }) => mapDisplayRect(displayTransform, r.xMm, r.yMm, r.widthMm, r.heightMm);

  let pathDemasia: string | null = null;
  let innerRect: ReturnType<typeof mapDisplayRect> | null = null;
  if (marco) {
    const outer = toRect(marco.outer);
    innerRect = toRect(marco.inner);
    pathDemasia = [
      `M ${outer.x} ${outer.y} h ${outer.width} v ${outer.height} h ${-outer.width} Z`,
      `M ${innerRect.x} ${innerRect.y} h ${innerRect.width} v ${innerRect.height} h ${-innerRect.width} Z`,
    ].join(" ");
  }

  // Radio del ojal proporcional a la escala, con topes para que se vea igual
  // en una lona chica que en una grande.
  const radio = Math.min(3.2, Math.max(1.3, displayTransform.scale * 12));

  return (
    <g pointerEvents="none">
      {pathDemasia ? (
        <path
          d={pathDemasia}
          fillRule="evenodd"
          fill="#f97316"
          fillOpacity={0.32}
          stroke="#c2410c"
          strokeWidth={0.5}
          strokeDasharray="2.5 2"
        />
      ) : null}
      {innerRect ? (
        <rect
          x={innerRect.x}
          y={innerRect.y}
          width={innerRect.width}
          height={innerRect.height}
          fill="none"
          stroke="#c2410c"
          strokeWidth={0.6}
        />
      ) : null}
      {puntos.map((punto, i) => {
        const p = mapDisplayRect(displayTransform, punto.xMm, punto.yMm, 0, 0);
        return (
          <circle
            key={`ojal-${i}`}
            cx={p.x}
            cy={p.y}
            r={radio}
            fill="#ffffff"
            stroke="#0f766e"
            strokeWidth={0.9}
          />
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
    if ((other.substrateIndex ?? 0) !== (placement.substrateIndex ?? 0))
      return false;
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
    if (direction === "left") {
      return (
        nearlyEqual(other.xMm + other.widthMm, expectedX, toleranceMm) &&
        rangesOverlap(
          placement.yMm,
          placement.yMm + placement.heightMm,
          other.yMm,
          other.yMm + other.heightMm,
          toleranceMm,
        )
      );
    }
    if (direction === "top") {
      return (
        nearlyEqual(other.yMm + other.heightMm, expectedY, toleranceMm) &&
        rangesOverlap(
          placement.xMm,
          placement.xMm + placement.widthMm,
          other.xMm,
          other.xMm + other.widthMm,
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
export {
  type PlanImposicionOutput,
  getEffectiveVisualConfig,
  formatNumber,
  formatMm,
  getPieceBleedMm,
  colorForKey,
  type PieceStyle,
  placementGroupKey,
  placementLabel,
  getPlanImposicion,
  placementAreaMm2,
};

/** Dibujo común: sólo transforma la presentación, nunca vuelve a acomodar piezas. */
export function NestingCanvas({
  result,
  substrateIndex = 0,
  maxPx = 560,
  compact = false,
  showLabels = true,
  modificaciones,
  selectedPieceId,
  showPrinter = false,
  svgRef,
  accessibleLabel,
}: {
  result: Pick<
    NestingViewerInput,
    | "substrates"
    | "placements"
    | "visualConfig"
    | "costingPreview"
    | "commonLine"
    | "outputsCanonicos"
  >;
  substrateIndex?: number;
  maxPx?: number;
  compact?: boolean;
  showLabels?: boolean;
  modificaciones?: ModificacionesOverlay;
  selectedPieceId?: string | null;
  showPrinter?: boolean;
  svgRef?: React.Ref<SVGSVGElement>;
  accessibleLabel?: string;
}) {
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const substrate = result.substrates[substrateIndex];
  if (!substrate) return null;
  return (
    <SubstrateView
      definitionIdPrefix={`nesting-${id}`}
      substrate={substrate}
      substrateIndex={substrateIndex}
      totalSubstrates={result.substrates.length}
      visualConfig={result.visualConfig}
      costingPreview={result.costingPreview}
      placements={result.placements.filter(
        (p) => (p.substrateIndex ?? 0) === substrateIndex,
      )}
      maxPx={maxPx}
      showLabels={showLabels}
      modificaciones={modificaciones}
      printer={showPrinter ? result.visualConfig?.maquina : undefined}
      printerVisible={showPrinter}
      planImposicion={getPlanImposicion(result.outputsCanonicos)}
      commonLine={result.commonLine}
      compact={compact}
      selectedPieceId={selectedPieceId}
      svgRef={svgRef}
      accessibleLabel={accessibleLabel}
    />
  );
}
