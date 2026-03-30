"use client";

import * as React from "react";

type NestingPiece = {
  id: string;
  label: string;
  xCm: number;
  yCm: number;
  widthCm: number;
  heightCm: number;
  rotated?: boolean;
};

type VinylCutNestingWorkspaceProps = {
  machineLabel: string;
  rollWidthCm: number;
  rollLengthCm: number;
  pieces: NestingPiece[];
};

function PlotterMachine({ machineLabel, rollWidthCm }: { machineLabel: string; rollWidthCm: number }) {
  return (
    <div className="relative mx-auto w-full max-w-[900px] select-none">
      <div className="absolute -top-10 left-0 w-full text-center font-mono text-lg tracking-wide text-gray-700">
        {machineLabel} · Width: {rollWidthCm.toLocaleString("es-AR", { maximumFractionDigits: 2 })} cm
      </div>

      <div className="relative flex h-48 drop-shadow-2xl">
        <div className="z-10 h-full w-28 rounded-l-[40px] border-r border-gray-600 bg-gradient-to-br from-gray-200 via-gray-400 to-gray-500 shadow-[inset_-5px_0_15px_rgba(0,0,0,0.2)]" />

        <div className="relative z-0 flex flex-1 flex-col bg-gray-800">
          <div className="h-16 border-b-2 border-black bg-gradient-to-b from-gray-700 to-gray-900 shadow-inner" />
          <div className="relative flex-1 overflow-hidden bg-black shadow-[inset_0_10px_20px_rgba(0,0,0,0.8)]">
            <div className="absolute top-3 h-1.5 w-full bg-blue-500 shadow-[0_0_15px_3px_rgba(59,130,246,0.8)]" />
            <div className="absolute top-0 flex h-10 w-full justify-around px-16">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="relative h-full w-5 rounded-b-sm border-x border-b border-black bg-gradient-to-b from-gray-600 to-gray-800 shadow-lg"
                >
                  <div className="absolute bottom-0 h-2 w-full bg-gray-900" />
                </div>
              ))}
            </div>
          </div>
          <div className="h-8 border-t-2 border-black bg-gradient-to-b from-gray-800 to-gray-950 shadow-[0_-2px_10px_rgba(0,0,0,0.5)]" />
        </div>

        <div className="relative z-10 h-full w-36 rounded-r-[40px] border-l border-gray-600 bg-gradient-to-bl from-gray-200 via-gray-400 to-gray-500 shadow-[inset_5px_0_15px_rgba(0,0,0,0.2)]">
          <div className="absolute left-1/2 top-1/2 flex h-28 w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-md border-4 border-gray-300 bg-blue-950 p-2 shadow-[inset_0_0_10px_rgba(0,0,0,0.8),_0_5px_10px_rgba(0,0,0,0.3)]">
            <div className="mb-3 flex h-10 w-full items-center justify-center rounded-sm border border-blue-400 bg-blue-200 shadow-inner">
              <div className="h-6 w-8 rounded-sm bg-blue-300/50" />
            </div>
            <div className="grid w-full grid-cols-3 gap-1.5 px-1">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full border shadow-sm ${
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
}: VinylCutNestingWorkspaceProps) {
  const canvasWidthPx = 644;
  const canvasHeightPx = 700;
  const scale = React.useMemo(() => {
    const widthScale = canvasWidthPx / Math.max(rollWidthCm, 1);
    const heightScale = canvasHeightPx / Math.max(rollLengthCm, 1);
    return Math.min(widthScale, heightScale);
  }, [rollLengthCm, rollWidthCm]);

  return (
    <div className="relative z-10 flex w-full flex-col items-center py-10">
      <PlotterMachine machineLabel={machineLabel} rollWidthCm={rollWidthCm} />

      <div
        className="relative h-[700px] w-[644px] border-x border-b border-gray-300 bg-white shadow-[0_15px_40px_rgba(0,0,0,0.15)]"
        style={{ marginTop: "-8px", zIndex: -1 }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-12 bg-gradient-to-b from-black/20 to-transparent" />

        {pieces.map((piece) => {
          const width = piece.widthCm * scale;
          const height = piece.heightCm * scale;
          const left = piece.xCm * scale;
          const top = piece.yCm * scale;
          return (
            <div
              key={piece.id}
              className="group absolute z-10 overflow-hidden rounded-sm border border-orange-500/60 bg-orange-100/70 shadow-sm"
              style={{ left, top, width, height }}
            >
              <div className="flex h-full w-full items-center justify-center px-1 text-center">
                <span className="text-[10px] font-semibold leading-tight text-orange-950">
                  {piece.label}
                  {piece.rotated ? " ↻" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
