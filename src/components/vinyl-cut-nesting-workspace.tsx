"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

type NestingPiece = {
  id: string;
  label: string;
  xCm: number;
  yCm: number;
  widthCm: number;
  heightCm: number;
  originalWidthCm?: number;
  originalHeightCm?: number;
  rotated?: boolean;
};

type VinylCutNestingWorkspaceProps = {
  machineLabel: string;
  rollWidthCm: number;
  rollLengthCm: number;
  pieces: NestingPiece[];
  marginLeftCm?: number;
  marginRightCm?: number;
  marginTopCm?: number;
  marginBottomCm?: number;
  separacionHorizontalCm?: number;
  separacionVerticalCm?: number;
};

// ── Layout constants ──────────────────────────────────────────────────────────
// Total machine width in px (outer container)
const MACHINE_WIDTH_PX = 640;
// Lateral arm widths — must match the inline styles in PlotterMachine below
const LEFT_ARM_PX = 96;    // same as w-24 (6rem @ 16px)
const RIGHT_PANEL_PX = 128; // same as w-32 (8rem @ 16px)
// The "mouth" = dark center zone. The roll canvas aligns to this exactly.
const MOUTH_WIDTH_PX = MACHINE_WIDTH_PX - LEFT_ARM_PX - RIGHT_PANEL_PX; // 416px
const MAX_CANVAS_HEIGHT_PX = 900;

function PlotterMachine({ machineLabel, rollWidthCm }: { machineLabel: string; rollWidthCm: number }) {
  return (
    <div className="relative select-none" style={{ width: MACHINE_WIDTH_PX }}>
      <div className="absolute -top-9 left-0 w-full text-center font-mono text-base tracking-wide text-gray-700">
        {machineLabel} · {rollWidthCm.toLocaleString("es-AR", { maximumFractionDigits: 1 })} cm
      </div>

      <div className="relative flex h-40 drop-shadow-2xl">
        {/* Left arm — explicit px width so canvas can align precisely */}
        <div
          className="z-10 h-full rounded-l-[36px] border-r border-gray-600 bg-gradient-to-br from-gray-200 via-gray-400 to-gray-500 shadow-[inset_-5px_0_15px_rgba(0,0,0,0.2)] shrink-0"
          style={{ width: LEFT_ARM_PX }}
        />

        {/* Center body — the "mouth" — width matches MOUTH_WIDTH_PX */}
        <div className="relative z-0 flex flex-col bg-gray-800" style={{ width: MOUTH_WIDTH_PX }}>
          <div className="h-14 border-b-2 border-black bg-gradient-to-b from-gray-700 to-gray-900 shadow-inner" />
          <div className="relative flex-1 overflow-hidden bg-black shadow-[inset_0_10px_20px_rgba(0,0,0,0.8)]">
            <div className="absolute top-3 h-1.5 w-full bg-blue-500 shadow-[0_0_15px_3px_rgba(59,130,246,0.8)]" />
            <div className="absolute top-0 flex h-9 w-full justify-around px-12">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="relative h-full w-4 rounded-b-sm border-x border-b border-black bg-gradient-to-b from-gray-600 to-gray-800 shadow-lg"
                >
                  <div className="absolute bottom-0 h-1.5 w-full bg-gray-900" />
                </div>
              ))}
            </div>
          </div>
          <div className="h-7 border-t-2 border-black bg-gradient-to-b from-gray-800 to-gray-950 shadow-[0_-2px_10px_rgba(0,0,0,0.5)]" />
        </div>

        {/* Right panel — explicit px width */}
        <div
          className="relative z-10 h-full rounded-r-[36px] border-l border-gray-600 bg-gradient-to-bl from-gray-200 via-gray-400 to-gray-500 shadow-[inset_5px_0_15px_rgba(0,0,0,0.2)] shrink-0"
          style={{ width: RIGHT_PANEL_PX }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-24 w-18 -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-md border-4 border-gray-300 bg-blue-950 p-2 shadow-[inset_0_0_10px_rgba(0,0,0,0.8),_0_5px_10px_rgba(0,0,0,0.3)]">
            <div className="mb-2 flex h-9 w-full items-center justify-center rounded-sm border border-blue-400 bg-blue-200 shadow-inner">
              <div className="h-5 w-7 rounded-sm bg-blue-300/50" />
            </div>
            <div className="grid w-full grid-cols-3 gap-1.5 px-1">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full border shadow-sm ${
                    i === 0 ? "border-red-700 bg-red-500" : "border-black bg-gray-800"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VinylCutNestingWorkspace({
  machineLabel,
  rollWidthCm,
  rollLengthCm,
  pieces,
  marginLeftCm = 0,
  marginRightCm = 0,
  marginTopCm = 0,
  marginBottomCm = 0,
  separacionHorizontalCm = 0,
  separacionVerticalCm = 0,
}: VinylCutNestingWorkspaceProps) {
  // Scale is derived from the MOUTH width so the roll fills exactly the dark center zone.
  const scale = MOUTH_WIDTH_PX / Math.max(rollWidthCm, 1);
  const totalHeightPx = Math.ceil(rollLengthCm * scale);
  const canvasHeightPx = Math.min(totalHeightPx, MAX_CANVAS_HEIGHT_PX);
  const needsScroll = totalHeightPx > MAX_CANVAS_HEIGHT_PX;

  const hasMargins = marginLeftCm > 0 || marginRightCm > 0 || marginTopCm > 0 || marginBottomCm > 0;
  const hasSep = separacionHorizontalCm > 0 || separacionVerticalCm > 0;
  const sepHHalf = separacionHorizontalCm / 2;
  const sepVHalf = separacionVerticalCm / 2;

  return (
    <div className="relative z-10 flex w-full flex-col items-center py-10">
      {/* Outer container — machine width */}
      <div style={{ width: MACHINE_WIDTH_PX }}>
        <PlotterMachine machineLabel={machineLabel} rollWidthCm={rollWidthCm} />

        {/* Roll canvas — offset by left arm, width = mouth width, sits under the dark zone */}
        <div
          className="relative border-x border-b border-gray-300 bg-[#fdf6e3] shadow-[0_15px_40px_rgba(0,0,0,0.15)]"
          style={{
            marginLeft: LEFT_ARM_PX,
            width: MOUTH_WIDTH_PX,
            height: canvasHeightPx,
            marginTop: "-4px",
            overflowY: needsScroll ? "auto" : "hidden",
          }}
        >
          {/* Scrollable inner content at full roll height */}
          <div className="relative" style={{ width: MOUTH_WIDTH_PX, height: totalHeightPx }}>
            {/* Background grid */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                backgroundSize: "10px 10px",
              }}
            />

            {/* Top shadow from machine */}
            <div className="pointer-events-none absolute left-0 right-0 top-0 h-8 bg-gradient-to-b from-black/15 to-transparent" />

            {/* ── Margin zones ── */}
            {hasMargins && (
              <>
                {marginTopCm > 0 && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 top-0 z-20 bg-red-400/20 border-b border-dashed border-red-400/60"
                    style={{ height: marginTopCm * scale }}
                  >
                    <span className="absolute left-1 top-0.5 text-[9px] font-semibold text-red-500/80 leading-none">
                      ↕ {marginTopCm.toFixed(1)} cm
                    </span>
                  </div>
                )}
                {marginBottomCm > 0 && (
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 bg-red-400/20 border-t border-dashed border-red-400/60"
                    style={{ height: marginBottomCm * scale }}
                  >
                    <span className="absolute left-1 bottom-0.5 text-[9px] font-semibold text-red-500/80 leading-none">
                      ↕ {marginBottomCm.toFixed(1)} cm
                    </span>
                  </div>
                )}
                {marginLeftCm > 0 && (
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 top-0 z-20 bg-red-400/20 border-r border-dashed border-red-400/60"
                    style={{ width: marginLeftCm * scale }}
                  >
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[9px] font-semibold text-red-500/80 leading-none">
                      {marginLeftCm.toFixed(1)} cm
                    </span>
                  </div>
                )}
                {marginRightCm > 0 && (
                  <div
                    className="pointer-events-none absolute bottom-0 right-0 top-0 z-20 bg-red-400/20 border-l border-dashed border-red-400/60"
                    style={{ width: marginRightCm * scale }}
                  >
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 rotate-90 whitespace-nowrap text-[9px] font-semibold text-red-500/80 leading-none">
                      {marginRightCm.toFixed(1)} cm
                    </span>
                  </div>
                )}
              </>
            )}

            {/* ── Pieces ── */}
            {pieces.map((piece) => {
              const pxW = piece.widthCm * scale;
              const pxH = piece.heightCm * scale;
              const pxLeft = piece.xCm * scale;
              const pxTop = piece.yCm * scale;

              const allocLeft = hasSep ? (piece.xCm - sepHHalf) * scale : pxLeft;
              const allocTop = hasSep ? (piece.yCm - sepVHalf) * scale : pxTop;
              const allocW = hasSep ? (piece.widthCm + separacionHorizontalCm) * scale : pxW;
              const allocH = hasSep ? (piece.heightCm + separacionVerticalCm) * scale : pxH;
              const innerOffsetX = hasSep ? sepHHalf * scale : 0;
              const innerOffsetY = hasSep ? sepVHalf * scale : 0;

              const origW = piece.originalWidthCm ?? piece.widthCm;
              const origH = piece.originalHeightCm ?? piece.heightCm;
              const dimsLabel = `${Number(origW.toFixed(0))}×${Number(origH.toFixed(0))} cm`;
              const letterLabel = piece.label || "";
              const rotLabel = piece.rotated ? " ↻" : "";

              return (
                <div
                  key={piece.id}
                  className="absolute z-10"
                  style={{ left: allocLeft, top: allocTop, width: allocW, height: allocH }}
                >
                  {hasSep && (
                    <div className="absolute inset-0 rounded-sm border border-dashed border-blue-300/70 bg-blue-50/30" />
                  )}
                  <div
                    className="absolute overflow-hidden rounded-sm border border-orange-500/60 bg-orange-100/80 shadow-sm"
                    style={{ left: innerOffsetX, top: innerOffsetY, width: pxW, height: pxH }}
                  >
                    <div className="flex h-full w-full flex-col items-center justify-center px-1 text-center gap-0.5">
                      {letterLabel && (
                        <span className="text-[11px] font-bold leading-none text-orange-900">
                          {letterLabel}{rotLabel}
                        </span>
                      )}
                      <span className="text-[9px] font-medium leading-none text-orange-800/80">
                        {dimsLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scroll indicator — sticky at bottom of the visible scroll area */}
          {needsScroll && (
            <div className="sticky bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-1.5 bg-gradient-to-t from-white/90 to-transparent py-2 pointer-events-none">
              <ChevronDownIcon className="size-3.5 animate-bounce text-gray-500" />
              <span className="text-[11px] font-medium text-gray-500">Deslizá para ver más piezas</span>
              <ChevronDownIcon className="size-3.5 animate-bounce text-gray-500" />
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      {hasSep && (
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground" style={{ marginLeft: LEFT_ARM_PX }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm border border-orange-500/60 bg-orange-100/80" />
            Área de corte
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-blue-300/70 bg-blue-50/30" />
            Separación ({separacionHorizontalCm.toFixed(1)} × {separacionVerticalCm.toFixed(1)} cm)
          </span>
        </div>
      )}
    </div>
  );
}
