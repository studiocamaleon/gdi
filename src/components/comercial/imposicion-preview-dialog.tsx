"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";

import {
  getProductoMotorConfig,
  getVarianteMotorOverride,
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
  // Talonario-specific
  puntillado?: {
    habilitado: boolean;
    distanciaBordeMm: number;
    borde: string;
  };
  encuadernacion?: {
    tipo: string;
    cantidadGrapas: number;
  };
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

  // Detect talonario motor
  const esTalonario = Boolean(motorParams.puntillado || motorParams.encuadernacion);

  // Pliego: prefer server response, fallback to motor config
  const serverPliego = readObj(apiResponse.pliegoImpresion);
  const configPliego = readObj(motorParams.tamanoPliegoImpresion);
  const hojaWRaw = Math.max(1, num(serverPliego.anchoMm ?? configPliego.anchoMm, 210));
  const hojaHRaw = Math.max(1, num(serverPliego.altoMm ?? configPliego.altoMm, 297));

  // Margins from server
  const sm = readObj(apiResponse.machineMargins);
  const marginsRaw = {
    leftMm: Math.max(0, num(sm.leftMm)),
    rightMm: Math.max(0, num(sm.rightMm)),
    topMm: Math.max(0, num(sm.topMm)),
    bottomMm: Math.max(0, num(sm.bottomMm)),
  };

  const printableWRaw = Math.max(0, hojaWRaw - marginsRaw.leftMm - marginsRaw.rightMm);
  const printableHRaw = Math.max(0, hojaHRaw - marginsRaw.topMm - marginsRaw.bottomMm);
  const utilWRaw = Math.max(0, printableWRaw - lineaCorteMm * 2);
  const utilHRaw = Math.max(0, printableHRaw - lineaCorteMm * 2);

  const pW = Math.max(1, piezaAnchoMm);
  const pH = Math.max(1, piezaAltoMm);
  const effW = pW + demasiaMm * 2;
  const effH = pH + demasiaMm * 2;

  // Calculate both orientations
  const normalCols = Math.max(0, Math.floor(utilWRaw / effW));
  const normalRows = Math.max(0, Math.floor(utilHRaw / effH));
  const normalTotal = normalCols * normalRows;

  const rotCols = Math.max(0, Math.floor(utilWRaw / effH));
  const rotRows = Math.max(0, Math.floor(utilHRaw / effW));
  const rotTotal = rotCols * rotRows;

  // Use server imposicion if available
  const si = readObj(apiResponse.imposicion);
  const serverOrientacion = String(si.orientacion ?? "");

  const orientacionReal: "normal" | "rotada" =
    serverOrientacion === "rotada" || serverOrientacion === "normal"
      ? serverOrientacion
      : rotTotal > normalTotal ? "rotada" : "normal";

  // For talonario: rotate the sheet instead of the piece
  const hojaRotada = esTalonario && orientacionReal === "rotada";
  const hojaW = hojaRotada ? hojaHRaw : hojaWRaw;
  const hojaH = hojaRotada ? hojaWRaw : hojaHRaw;
  const margins = hojaRotada
    ? { leftMm: marginsRaw.topMm, rightMm: marginsRaw.bottomMm, topMm: marginsRaw.rightMm, bottomMm: marginsRaw.leftMm }
    : marginsRaw;
  const printableW = Math.max(0, hojaW - margins.leftMm - margins.rightMm);
  const printableH = Math.max(0, hojaH - margins.topMm - margins.bottomMm);
  const utilW = Math.max(0, printableW - lineaCorteMm * 2);
  const utilH = Math.max(0, printableH - lineaCorteMm * 2);

  const orientacion: "normal" | "rotada" = hojaRotada ? "normal" : orientacionReal;
  const cols = Math.max(0, hojaRotada
    ? num(si.rows ?? rotRows)
    : num(si.cols ?? (orientacionReal === "rotada" ? rotCols : normalCols)));
  const rows = Math.max(0, hojaRotada
    ? num(si.cols ?? rotCols)
    : num(si.rows ?? (orientacionReal === "rotada" ? rotRows : normalRows)));

  // For non-talonario rotated, swap piece dimensions
  const renderEffW = (!esTalonario && orientacion === "rotada") ? effH : effW;
  const renderEffH = (!esTalonario && orientacion === "rotada") ? effW : effH;
  const renderPW = (!esTalonario && orientacion === "rotada") ? pH : pW;
  const renderPH = (!esTalonario && orientacion === "rotada") ? pW : pH;

  // Talonario puntillado/encuadernacion
  const puntilladoCfg = readObj(motorParams.puntillado);
  const encCfg = readObj(motorParams.encuadernacion);

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
    puntillado: puntilladoCfg.habilitado
      ? {
          habilitado: true,
          distanciaBordeMm: num(puntilladoCfg.distanciaBordeMm),
          borde: String(puntilladoCfg.borde ?? "superior"),
        }
      : undefined,
    encuadernacion: encCfg.tipo === "abrochado"
      ? {
          tipo: "abrochado",
          cantidadGrapas: num(encCfg.cantidadGrapas, 2),
        }
      : undefined,
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

  // Puntillado config
  const punt = preview.puntillado;
  const puntBorde = punt?.borde ?? "superior";

  // Encuadernacion (broches)
  const enc = preview.encuadernacion;
  const cantGrapas = enc?.cantidadGrapas ?? 0;

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = gridX + c * effectiveW * scale;
      const y = gridY + r * effectiveH * scale;
      const trimX = x + demasiaMm * scale;
      const trimY = y + demasiaMm * scale;
      const pw = piezaW * scale;
      const ph = piezaH * scale;

      // Puntillado line
      let puntLine: React.ReactNode = null;
      let puntLinePx: { isH: boolean; pos: number; start: number; end: number } | null = null;
      if (punt?.habilitado && punt.distanciaBordeMm > 0) {
        const distPx = punt.distanciaBordeMm * scale;
        if (puntBorde === "superior" || puntBorde === "inferior") {
          const ly = puntBorde === "superior" ? trimY + distPx : trimY + ph - distPx;
          puntLinePx = { isH: true, pos: ly, start: trimX, end: trimX + pw };
          puntLine = <line x1={trimX} y1={ly} x2={trimX + pw} y2={ly} stroke="#d97706" strokeWidth="1" strokeDasharray="3 2" />;
        } else {
          const lx = puntBorde === "izquierdo" ? trimX + distPx : trimX + pw - distPx;
          puntLinePx = { isH: false, pos: lx, start: trimY, end: trimY + ph };
          puntLine = <line x1={lx} y1={trimY} x2={lx} y2={trimY + ph} stroke="#d97706" strokeWidth="1" strokeDasharray="3 2" />;
        }
      }

      // Broches
      const brochesNodes: React.ReactNode[] = [];
      if (enc?.tipo === "abrochado" && cantGrapas > 0 && puntLinePx) {
        const br = 1.5;
        for (let gi = 0; gi < cantGrapas; gi++) {
          const t = cantGrapas === 1 ? 0.5 : (gi + 1) / (cantGrapas + 1);
          if (puntLinePx.isH) {
            const bx = puntLinePx.start + (puntLinePx.end - puntLinePx.start) * t;
            const byEdge = puntBorde === "superior" ? trimY : trimY + ph;
            const by = (puntLinePx.pos + byEdge) / 2;
            brochesNodes.push(<circle key={`b${gi}`} cx={bx} cy={by} r={br} fill="#7c3aed" fillOpacity="0.85" />);
          } else {
            const by = puntLinePx.start + (puntLinePx.end - puntLinePx.start) * t;
            const bxEdge = puntBorde === "izquierdo" ? trimX : trimX + pw;
            const bx = (puntLinePx.pos + bxEdge) / 2;
            brochesNodes.push(<circle key={`b${gi}`} cx={bx} cy={by} r={br} fill="#7c3aed" fillOpacity="0.85" />);
          }
        }
      }

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
            width={pw}
            height={ph}
            fill="#22c55e"
            fillOpacity="0.65"
            stroke="#16a34a"
            strokeWidth="0.7"
          />
          {puntLine}
          {brochesNodes}
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
        const [motorConfig, variantOverride] = await Promise.all([
          getProductoMotorConfig(productoId),
          getVarianteMotorOverride(varianteId).catch(() => null),
        ]);
        const baseParams = (motorConfig.parametros ?? {}) as Record<string, unknown>;
        const overrideParams = (variantOverride?.parametros ?? {}) as Record<string, unknown>;
        // Merge: base + override, pero preservar campos de composición del producto
        const mergedParams = { ...baseParams, ...overrideParams };
        // Composición siempre del producto (no del override)
        for (const field of ['tipoCopiaDefiniciones', 'encuadernacion', 'puntillado',
          'materialesExtra', 'numeracion', 'numerosXTalonarioDefault', 'modoTalonarioIncompleto']) {
          if (baseParams[field] !== undefined) {
            mergedParams[field] = baseParams[field];
          }
        }

        const apiRes = await previewImposicionProductoVariante(
          varianteId,
          mergedParams,
        );

        if (!cancelled) {
          const result = buildPreview(anchoMm, altoMm, mergedParams, apiRes);
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
