"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";

import {
  getProductoMotorConfig,
  previewImposicionProductoVariante,
} from "@/lib/productos-servicios-api";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImposicionPreview = {
  hojaW: number;
  hojaH: number;
  piezaW: number;
  piezaH: number;
  effectiveW: number;
  effectiveH: number;
  printableW: number;
  printableH: number;
  utilW: number;
  utilH: number;
  orientacion: "normal" | "rotada";
  cols: number;
  rows: number;
  piezasPorPliego: number;
  margins: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;
  };
  demasiaMm: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readObj(val: unknown): Record<string, unknown> {
  return val && typeof val === "object" && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

function num(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// Build preview (mirrors digital-imposicion-tab.tsx logic)
// ---------------------------------------------------------------------------

function buildPreview(
  piezaAnchoMm: number,
  piezaAltoMm: number,
  motorParams: Record<string, unknown>,
  apiResponse: Record<string, unknown>,
): ImposicionPreview | null {
  const tipoCorte = String(motorParams.tipoCorte ?? "sin_demasia");
  const demasiaMm =
    tipoCorte === "con_demasia" ? num(motorParams.demasiaCorteMm) : 0;
  const lineaCorteMm = num(motorParams.lineaCorteMm, 3);

  // Pliego: prefer server response, fallback to motor config
  const serverPliego = readObj(apiResponse.pliegoImpresion);
  const configPliego = readObj(motorParams.tamanoPliegoImpresion);
  const hojaW = Math.max(1, num(serverPliego.anchoMm ?? configPliego.anchoMm, 210));
  const hojaH = Math.max(1, num(serverPliego.altoMm ?? configPliego.altoMm, 297));

  // Margins from server
  const sm = readObj(apiResponse.machineMargins);
  const margins = {
    leftMm: Math.max(0, num(sm.leftMm)),
    rightMm: Math.max(0, num(sm.rightMm)),
    topMm: Math.max(0, num(sm.topMm)),
    bottomMm: Math.max(0, num(sm.bottomMm)),
  };

  const printableW = Math.max(0, hojaW - margins.leftMm - margins.rightMm);
  const printableH = Math.max(0, hojaH - margins.topMm - margins.bottomMm);
  const utilW = Math.max(0, printableW - lineaCorteMm * 2);
  const utilH = Math.max(0, printableH - lineaCorteMm * 2);

  const pW = Math.max(1, piezaAnchoMm);
  const pH = Math.max(1, piezaAltoMm);
  const effW = pW + demasiaMm * 2;
  const effH = pH + demasiaMm * 2;

  // Calculate both orientations
  const normalCols = Math.max(0, Math.floor(utilW / effW));
  const normalRows = Math.max(0, Math.floor(utilH / effH));
  const normalTotal = normalCols * normalRows;

  const rotCols = Math.max(0, Math.floor(utilW / effH));
  const rotRows = Math.max(0, Math.floor(utilH / effW));
  const rotTotal = rotCols * rotRows;

  // Use server imposicion if available
  const si = readObj(apiResponse.imposicion);
  const serverOrientacion = String(si.orientacion ?? "");

  let orientacion: "normal" | "rotada";
  let cols: number;
  let rows: number;

  if (serverOrientacion === "rotada" || serverOrientacion === "normal") {
    orientacion = serverOrientacion;
    cols = Math.max(0, num(si.cols, orientacion === "rotada" ? rotCols : normalCols));
    rows = Math.max(0, num(si.rows, orientacion === "rotada" ? rotRows : normalRows));
  } else {
    // Auto-detect best orientation
    if (rotTotal > normalTotal) {
      orientacion = "rotada";
      cols = rotCols;
      rows = rotRows;
    } else {
      orientacion = "normal";
      cols = normalCols;
      rows = normalRows;
    }
  }

  // For rotated orientation, swap effective piece dimensions for rendering
  const renderEffW = orientacion === "rotada" ? effH : effW;
  const renderEffH = orientacion === "rotada" ? effW : effH;
  const renderPW = orientacion === "rotada" ? pH : pW;
  const renderPH = orientacion === "rotada" ? pW : pH;

  return {
    hojaW,
    hojaH,
    piezaW: renderPW,
    piezaH: renderPH,
    effectiveW: renderEffW,
    effectiveH: renderEffH,
    printableW,
    printableH,
    utilW,
    utilH,
    orientacion,
    cols,
    rows,
    piezasPorPliego: Math.max(normalTotal, rotTotal),
    margins,
    demasiaMm,
  };
}

// ---------------------------------------------------------------------------
// SVG Rendering
// ---------------------------------------------------------------------------

function ImposicionSvg({ preview }: { preview: ImposicionPreview }) {
  const {
    hojaW,
    hojaH,
    effectiveW,
    effectiveH,
    piezaW,
    piezaH,
    margins,
    cols,
    rows,
    demasiaMm,
  } = preview;

  const canvasW = 520;
  const canvasH = 380;
  const pad = 24;
  const scale = Math.min(
    (canvasW - pad * 2) / hojaW,
    (canvasH - pad * 2) / hojaH,
  );

  const sheetW = hojaW * scale;
  const sheetH = hojaH * scale;
  const ox = (canvasW - sheetW) / 2;
  const oy = (canvasH - sheetH) / 2;

  const printableX = ox + margins.leftMm * scale;
  const printableY = oy + margins.topMm * scale;
  const printableW = preview.printableW * scale;
  const printableH = preview.printableH * scale;

  const lineaCorteMm = 3;
  const utilX = printableX + lineaCorteMm * scale;
  const utilY = printableY + lineaCorteMm * scale;
  const utilW = preview.utilW * scale;
  const utilH = preview.utilH * scale;

  const gridW = cols * effectiveW * scale;
  const gridH = rows * effectiveH * scale;
  const gridX = utilX + (utilW - gridW) / 2;
  const gridY = utilY + (utilH - gridH) / 2;

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = gridX + c * effectiveW * scale;
      const y = gridY + r * effectiveH * scale;
      const trimX = x + demasiaMm * scale;
      const trimY = y + demasiaMm * scale;
      cells.push(
        <g key={`${r}-${c}`}>
          {demasiaMm > 0 && (
            <rect
              x={x}
              y={y}
              width={effectiveW * scale}
              height={effectiveH * scale}
              fill="#e5e7eb"
              stroke="#9ca3af"
              strokeWidth="0.6"
            />
          )}
          <rect
            x={trimX}
            y={trimY}
            width={piezaW * scale}
            height={piezaH * scale}
            fill="#22c55e"
            fillOpacity="0.65"
            stroke="#16a34a"
            strokeWidth="0.7"
          />
        </g>,
      );
    }
  }

  return (
    <svg
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      className="w-full rounded-lg border bg-white"
    >
      {/* Sheet */}
      <rect
        x={ox}
        y={oy}
        width={sheetW}
        height={sheetH}
        fill="#fef2f2"
        stroke="#7f1d1d"
        strokeWidth="1.4"
        rx="1"
      />
      {/* Printable area */}
      <rect
        x={printableX}
        y={printableY}
        width={printableW}
        height={printableH}
        fill="#fff"
        stroke="#b91c1c"
        strokeWidth="0.7"
        strokeDasharray="4 2"
      />
      {/* Usable area */}
      <rect
        x={utilX}
        y={utilY}
        width={utilW}
        height={utilH}
        fill="#ecfccb"
        fillOpacity="0.3"
      />
      {/* Pieces */}
      {cells}
      {/* Dimension labels */}
      <text
        x={ox + sheetW / 2}
        y={oy - 6}
        textAnchor="middle"
        fontSize="10"
        fill="#6b7280"
      >
        {hojaW} mm
      </text>
      <text
        x={ox - 6}
        y={oy + sheetH / 2}
        textAnchor="middle"
        fontSize="10"
        fill="#6b7280"
        transform={`rotate(-90 ${ox - 6} ${oy + sheetH / 2})`}
      >
        {hojaH} mm
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Dialog component
// ---------------------------------------------------------------------------

export function ImposicionPreviewDialog({
  open,
  onOpenChange,
  productoId,
  varianteId,
  varianteNombre,
  anchoMm,
  altoMm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productoId: string;
  varianteId: string;
  varianteNombre: string;
  anchoMm: number;
  altoMm: number;
}) {
  const [loading, setLoading] = React.useState(true);
  const [preview, setPreview] = React.useState<ImposicionPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreview(null);

    (async () => {
      try {
        const motorConfig = await getProductoMotorConfig(productoId);
        const params = (motorConfig.parametros ?? {}) as Record<
          string,
          unknown
        >;

        const apiRes = await previewImposicionProductoVariante(
          varianteId,
          params,
        );

        if (!cancelled) {
          const result = buildPreview(anchoMm, altoMm, params, apiRes);
          setPreview(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar la imposicion.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, productoId, varianteId, anchoMm, altoMm]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Imposicion</AlertDialogTitle>
          <AlertDialogDescription>
            {varianteNombre} &mdash; {anchoMm / 10} x {altoMm / 10} cm
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="mt-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          {preview && !loading && (
            <div className="flex flex-col gap-3">
              <ImposicionSvg preview={preview} />
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg border px-2 py-1.5">
                  <p className="text-lg font-semibold">
                    {preview.piezasPorPliego}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    piezas/pliego
                  </p>
                </div>
                <div className="rounded-lg border px-2 py-1.5">
                  <p className="text-lg font-semibold">
                    {preview.cols}x{preview.rows}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {preview.orientacion === "rotada"
                      ? "rotada"
                      : "disposicion"}
                  </p>
                </div>
                <div className="rounded-lg border px-2 py-1.5">
                  <p className="text-lg font-semibold">
                    {preview.hojaW / 10}x{preview.hojaH / 10}
                  </p>
                  <p className="text-xs text-muted-foreground">pliego (cm)</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cerrar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
