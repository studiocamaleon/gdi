"use client";

import * as React from "react";

import {
  MIN_MANUAL_PANEL_USEFUL_MM,
  cloneWideFormatManualLayout,
  recalculateManualLayoutItem,
  validateManualLayoutItem,
} from "@/components/productos-servicios/motors/wide-format-nesting.helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  GranFormatoPanelManualLayout,
  GranFormatoPanelizadoDistribucion,
  GranFormatoPanelizadoInterpretacionAnchoMaximo,
  GranFormatoPanelizadoModo,
} from "@/lib/productos-servicios";

function formatMmAsCm(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return String(Number((value / 10).toFixed(2)));
}

function getPieceLetterLabel(index: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return `Pieza ${alphabet[index]}`;
  return `Pieza ${index + 1}`;
}

function getPanelizadoModoLabel(value: GranFormatoPanelizadoModo | null | undefined) {
  if (value === "manual") return "Manual";
  return "Automático";
}

function getPanelizadoInterpretacionLabel(value: GranFormatoPanelizadoInterpretacionAnchoMaximo | null | undefined) {
  if (value === "util") return "Solo ancho útil";
  return "Ancho total del panel";
}

export function WideFormatPanelEditorSheet({
  open,
  onOpenChange,
  context,
  initialLayout,
  currentMode,
  printableWidthMm,
  panelizadoSolapeMm,
  panelizadoDistribucion,
  panelizadoAnchoMaxPanelMm,
  panelizadoInterpretacionAnchoMaximo,
  onApply,
  onRestoreAutomatic,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: "imposicion" | "costos";
  initialLayout: GranFormatoPanelManualLayout | null;
  currentMode: GranFormatoPanelizadoModo | null | undefined;
  printableWidthMm: number;
  panelizadoSolapeMm: number | null | undefined;
  panelizadoDistribucion: GranFormatoPanelizadoDistribucion | null | undefined;
  panelizadoAnchoMaxPanelMm: number | null | undefined;
  panelizadoInterpretacionAnchoMaximo: GranFormatoPanelizadoInterpretacionAnchoMaximo | null | undefined;
  onApply: (layout: GranFormatoPanelManualLayout) => void;
  onRestoreAutomatic: () => void;
}) {
  const [draft, setDraft] = React.useState<GranFormatoPanelManualLayout | null>(null);
  const [selectedPieceId, setSelectedPieceId] = React.useState("");
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const next = cloneWideFormatManualLayout(initialLayout);
    setDraft(next);
    setSelectedPieceId(next?.items[0]?.sourcePieceId ?? "");
    setDragIndex(null);
  }, [initialLayout, open]);

  const pieces = React.useMemo(() => draft?.items ?? [], [draft]);

  React.useEffect(() => {
    if (!pieces.length) {
      if (selectedPieceId) setSelectedPieceId("");
      return;
    }
    if (!selectedPieceId || !pieces.some((item) => item.sourcePieceId === selectedPieceId)) {
      setSelectedPieceId(pieces[0]?.sourcePieceId ?? "");
    }
  }, [pieces, selectedPieceId]);

  const selectedPiece = React.useMemo(
    () => pieces.find((item) => item.sourcePieceId === selectedPieceId) ?? pieces[0] ?? null,
    [pieces, selectedPieceId],
  );

  const updateBoundary = React.useCallback(
    (deltaMm: number) => {
      if (!selectedPiece || dragIndex == null) return;
      setDraft((current) => {
        if (!current) return current;
        return {
          items: current.items.map((item) => {
            if (item.sourcePieceId !== selectedPiece.sourcePieceId) return item;
            const panels = [...item.panels];
            const left = panels[dragIndex];
            const right = panels[dragIndex + 1];
            if (!left || !right) return item;
            if (item.axis === "vertical") {
              const nextLeft = Math.max(MIN_MANUAL_PANEL_USEFUL_MM, left.usefulWidthMm + deltaMm);
              const appliedDelta = nextLeft - left.usefulWidthMm;
              if (Math.abs(appliedDelta) < 0.1) return item;
              left.usefulWidthMm = nextLeft;
              right.usefulWidthMm = Math.max(
                MIN_MANUAL_PANEL_USEFUL_MM,
                right.usefulWidthMm - appliedDelta,
              );
            } else {
              const nextTop = Math.max(MIN_MANUAL_PANEL_USEFUL_MM, left.usefulHeightMm + deltaMm);
              const appliedDelta = nextTop - left.usefulHeightMm;
              if (Math.abs(appliedDelta) < 0.1) return item;
              left.usefulHeightMm = nextTop;
              right.usefulHeightMm = Math.max(
                MIN_MANUAL_PANEL_USEFUL_MM,
                right.usefulHeightMm - appliedDelta,
              );
            }
            return recalculateManualLayoutItem({ ...item, panels });
          }),
        };
      });
    },
    [dragIndex, selectedPiece],
  );

  React.useEffect(() => {
    if (dragIndex == null) return;
    const handleMouseMove = (event: MouseEvent) => {
      if (!selectedPiece || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const axisLengthPx = selectedPiece.axis === "vertical" ? rect.width : rect.height;
      const axisLengthMm =
        selectedPiece.axis === "vertical" ? selectedPiece.pieceWidthMm : selectedPiece.pieceHeightMm;
      if (axisLengthPx <= 0 || axisLengthMm <= 0) return;
      const deltaPx = selectedPiece.axis === "vertical" ? event.movementX : -event.movementY;
      const deltaMm = (deltaPx / axisLengthPx) * axisLengthMm;
      if (Math.abs(deltaMm) > 0) updateBoundary(deltaMm);
    };
    const handleMouseUp = () => setDragIndex(null);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragIndex, selectedPiece, updateBoundary]);

  const allValid = React.useMemo(() => {
    if (!draft) return true;
    return draft.items.every((item) =>
      validateManualLayoutItem({
        item,
        printableWidthMm,
        maxPanelWidthMm: panelizadoAnchoMaxPanelMm ?? null,
        widthInterpretation: panelizadoInterpretacionAnchoMaximo ?? "total",
      }),
    );
  }, [draft, panelizadoAnchoMaxPanelMm, panelizadoInterpretacionAnchoMaximo, printableWidthMm]);

  const selectedPieceValid = React.useMemo(() => {
    if (!selectedPiece) return true;
    return validateManualLayoutItem({
      item: selectedPiece,
      printableWidthMm,
      maxPanelWidthMm: panelizadoAnchoMaxPanelMm ?? null,
      widthInterpretation: panelizadoInterpretacionAnchoMaximo ?? "total",
    });
  }, [panelizadoAnchoMaxPanelMm, panelizadoInterpretacionAnchoMaximo, printableWidthMm, selectedPiece]);

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setDragIndex(null);
      }}
    >
      <SheetContent side="right" className="!w-[78vw] !max-w-none md:!w-[72vw] xl:!w-[68vw] sm:!max-w-none">
        <SheetHeader>
          <SheetTitle>Editor visual de paneles</SheetTitle>
          <SheetDescription>
            {context === "costos"
              ? "Ajustá manualmente las divisiones para esta simulación puntual. Los cambios afectarán material, desperdicio y costo cuando vuelvas a simular."
              : "Ajustá manualmente las divisiones del panelizado y aplicá este layout como base manual para el flujo siguiente del producto."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex h-full flex-col gap-4 overflow-hidden px-4 pb-4">
          {!selectedPiece ? (
            <div className="flex h-full items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
              No hay paneles disponibles para editar.
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border bg-muted/10 p-3">
                  <p className="text-xs text-muted-foreground">Modo actual</p>
                  <p className="mt-1 text-sm font-semibold">{getPanelizadoModoLabel(currentMode)}</p>
                </div>
                <div className="rounded-xl border bg-muted/10 p-3">
                  <p className="text-xs text-muted-foreground">Dirección</p>
                  <p className="mt-1 text-sm font-semibold">
                    {selectedPiece.axis === "vertical" ? "Vertical" : "Horizontal"}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/10 p-3">
                  <p className="text-xs text-muted-foreground">Solape</p>
                  <p className="mt-1 text-sm font-semibold">{formatMmAsCm(panelizadoSolapeMm)} cm</p>
                </div>
                <div className="rounded-xl border bg-muted/10 p-3">
                  <p className="text-xs text-muted-foreground">Ancho máximo</p>
                  <p className="mt-1 text-sm font-semibold">
                    {panelizadoAnchoMaxPanelMm != null
                      ? `${formatMmAsCm(panelizadoAnchoMaxPanelMm)} cm`
                      : "Sin dato"}
                  </p>
                </div>
              </div>

              {pieces.length > 1 ? (
                <div className="rounded-xl border bg-muted/10 p-3">
                  <p className="mb-3 text-sm font-medium">Pieza a editar</p>
                  <div className="flex flex-wrap gap-2">
                    {pieces.map((item, index) => (
                      <Button
                        key={item.sourcePieceId}
                        type="button"
                        size="sm"
                        variant={item.sourcePieceId === selectedPiece.sourcePieceId ? "default" : "outline"}
                        onClick={() => setSelectedPieceId(item.sourcePieceId)}
                      >
                        {getPieceLetterLabel(index)}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_320px]">
                <div className="flex min-h-0 flex-col rounded-xl border bg-muted/10 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {getPieceLetterLabel(
                          Math.max(0, pieces.findIndex((item) => item.sourcePieceId === selectedPiece.sourcePieceId)),
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Pieza real: {formatMmAsCm(selectedPiece.pieceWidthMm)} ×{" "}
                        {formatMmAsCm(selectedPiece.pieceHeightMm)} cm
                      </p>
                    </div>
                    <Badge variant={selectedPieceValid ? "outline" : "destructive"}>
                      {selectedPieceValid ? "Layout válido" : "Layout inválido"}
                    </Badge>
                  </div>

                  <div className="mb-3 rounded-lg border border-dashed bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                    Arrastrá los divisores para cambiar el tamaño útil de los paneles. El solape se mantiene fijo según la configuración técnica del producto.
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto">
                    <div className="mx-auto flex h-full min-h-[340px] max-h-[540px] w-full max-w-[840px] items-center justify-center">
                      <div
                        ref={canvasRef}
                        className={cn(
                          "relative flex w-full max-w-[820px] select-none overflow-visible border-2 border-dashed border-orange-200 bg-white p-2 shadow-sm",
                          selectedPiece.axis === "vertical"
                            ? "min-h-[260px] flex-row items-stretch"
                            : "min-h-[420px] max-w-[420px] flex-col items-stretch",
                        )}
                        style={{
                          aspectRatio: `${Math.max(selectedPiece.pieceWidthMm, 1)} / ${Math.max(selectedPiece.pieceHeightMm, 1)}`,
                        }}
                      >
                        {selectedPiece.panels.map((panel, index) => {
                          const usefulDimension =
                            selectedPiece.axis === "vertical" ? panel.usefulWidthMm : panel.usefulHeightMm;
                          const finalDimension =
                            selectedPiece.axis === "vertical" ? panel.finalWidthMm : panel.finalHeightMm;
                          const withinConfiguredLimit =
                            panelizadoAnchoMaxPanelMm == null
                              ? true
                              : (panelizadoInterpretacionAnchoMaximo ?? "total") === "total"
                                ? finalDimension <= panelizadoAnchoMaxPanelMm
                                : usefulDimension <= panelizadoAnchoMaxPanelMm;
                          const withinPrintableWidth = finalDimension <= printableWidthMm;
                          const panelValid =
                            usefulDimension >= MIN_MANUAL_PANEL_USEFUL_MM &&
                            withinConfiguredLimit &&
                            withinPrintableWidth;
                          const totalForFlex =
                            selectedPiece.axis === "vertical" ? panel.finalWidthMm : panel.finalHeightMm;
                          const overlapStartPct =
                            totalForFlex > 0 ? (panel.overlapStartMm / totalForFlex) * 100 : 0;
                          const overlapEndPct =
                            totalForFlex > 0 ? (panel.overlapEndMm / totalForFlex) * 100 : 0;

                          return (
                            <React.Fragment key={`${selectedPiece.sourcePieceId}-${panel.panelIndex}`}>
                              <div
                                className="relative flex min-h-0 min-w-0"
                                style={{ flexGrow: Math.max(totalForFlex, 1), flexBasis: 0 }}
                              >
                                <div
                                  className={cn(
                                    "relative flex min-h-0 min-w-0 flex-1 overflow-hidden border",
                                    panelValid ? "border-zinc-200 bg-zinc-50" : "border-red-300 bg-red-50",
                                  )}
                                >
                                  {selectedPiece.axis === "vertical" ? (
                                    <>
                                      {panel.overlapStartMm > 0 ? (
                                        <div className="absolute inset-y-0 left-0 bg-orange-200/80" style={{ width: `${overlapStartPct}%` }} />
                                      ) : null}
                                      {panel.overlapEndMm > 0 ? (
                                        <div className="absolute inset-y-0 right-0 bg-orange-200/80" style={{ width: `${overlapEndPct}%` }} />
                                      ) : null}
                                      <div className="absolute inset-y-0 border border-cyan-300/50 bg-cyan-200/35" style={{ left: `${overlapStartPct}%`, right: `${overlapEndPct}%` }} />
                                    </>
                                  ) : (
                                    <>
                                      {panel.overlapStartMm > 0 ? (
                                        <div className="absolute inset-x-0 top-0 bg-orange-200/80" style={{ height: `${overlapStartPct}%` }} />
                                      ) : null}
                                      {panel.overlapEndMm > 0 ? (
                                        <div className="absolute inset-x-0 bottom-0 bg-orange-200/80" style={{ height: `${overlapEndPct}%` }} />
                                      ) : null}
                                      <div className="absolute inset-x-0 border border-cyan-300/50 bg-cyan-200/35" style={{ top: `${overlapStartPct}%`, bottom: `${overlapEndPct}%` }} />
                                    </>
                                  )}

                                  <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-2 p-3 text-center">
                                    <Badge variant="outline" className="bg-white/80">{`Panel ${panel.panelIndex}`}</Badge>
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold">
                                        Útil: {formatMmAsCm(panel.usefulWidthMm)} × {formatMmAsCm(panel.usefulHeightMm)} cm
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Final: {formatMmAsCm(panel.finalWidthMm)} × {formatMmAsCm(panel.finalHeightMm)} cm
                                      </p>
                                    </div>
                                    {!panelValid ? (
                                      <p className="text-xs font-medium text-red-600">
                                        {withinConfiguredLimit
                                          ? withinPrintableWidth
                                            ? "No entra en el ancho imprimible"
                                            : "Panel menor al mínimo técnico"
                                          : "Supera el ancho máximo configurado"}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                {index < selectedPiece.panels.length - 1 ? (
                                  <button
                                    type="button"
                                    aria-label={`Mover divisor entre panel ${panel.panelIndex} y panel ${panel.panelIndex + 1}`}
                                    className={cn(
                                      "absolute z-20 border-0 bg-transparent transition",
                                      selectedPiece.axis === "vertical"
                                        ? "-right-2 top-0 h-full w-4 cursor-col-resize"
                                        : "-bottom-2 left-0 h-4 w-full cursor-row-resize",
                                    )}
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      setDragIndex(index);
                                    }}
                                  >
                                    <span
                                      className={cn(
                                        "absolute bg-orange-500 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]",
                                        selectedPiece.axis === "vertical"
                                          ? "left-1/2 top-1/2 h-16 w-[3px] -translate-x-1/2 -translate-y-1/2"
                                          : "left-1/2 top-1/2 h-[3px] w-16 -translate-x-1/2 -translate-y-1/2",
                                      )}
                                    />
                                  </button>
                                ) : null}
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col gap-4">
                  <div className="rounded-xl border bg-muted/10 p-4">
                    <p className="text-sm font-semibold">Configuración usada</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground">Distribución</span>
                        <span className="font-medium">{panelizadoDistribucion === "libre" ? "Libre" : "Equilibrada"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground">Interpretación</span>
                        <span className="text-right font-medium">
                          {getPanelizadoInterpretacionLabel(panelizadoInterpretacionAnchoMaximo)}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground">Ancho imprimible</span>
                        <span className="font-medium">
                          {printableWidthMm > 0 ? `${formatMmAsCm(printableWidthMm)} cm` : "Sin dato"}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground">Estado general</span>
                        <span className={cn("font-medium", allValid ? "text-emerald-600" : "text-red-600")}>
                          {allValid ? "Válido" : "Revisar paneles"}
                        </span>
                      </div>
                      {context === "costos" ? (
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-muted-foreground">Destino</span>
                          <span className="text-right font-medium">Sólo esta simulación</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-muted/10 p-4">
                    <p className="text-sm font-semibold">Detalle de paneles</p>
                    <div className="mt-3 space-y-2">
                      {selectedPiece.panels.map((panel) => {
                        const usefulDimension =
                          selectedPiece.axis === "vertical" ? panel.usefulWidthMm : panel.usefulHeightMm;
                        const finalDimension =
                          selectedPiece.axis === "vertical" ? panel.finalWidthMm : panel.finalHeightMm;
                        const withinConfiguredLimit =
                          panelizadoAnchoMaxPanelMm == null
                            ? true
                            : (panelizadoInterpretacionAnchoMaximo ?? "total") === "total"
                              ? finalDimension <= panelizadoAnchoMaxPanelMm
                              : usefulDimension <= panelizadoAnchoMaxPanelMm;
                        const withinPrintableWidth = finalDimension <= printableWidthMm;
                        const panelValid =
                          usefulDimension >= MIN_MANUAL_PANEL_USEFUL_MM &&
                          withinConfiguredLimit &&
                          withinPrintableWidth;
                        return (
                          <div
                            key={`detail-${selectedPiece.sourcePieceId}-${panel.panelIndex}`}
                            className={cn("rounded-lg border p-3", panelValid ? "bg-background" : "border-red-300 bg-red-50")}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium">{`Panel ${panel.panelIndex}`}</p>
                              <Badge variant={panelValid ? "outline" : "destructive"}>
                                {panelValid ? "OK" : "Inválido"}
                              </Badge>
                            </div>
                            <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                              <p>Útil: {formatMmAsCm(panel.usefulWidthMm)} × {formatMmAsCm(panel.usefulHeightMm)} cm</p>
                              <p>Final: {formatMmAsCm(panel.finalWidthMm)} × {formatMmAsCm(panel.finalHeightMm)} cm</p>
                              <p>Solape inicio/fin: {formatMmAsCm(panel.overlapStartMm)} / {formatMmAsCm(panel.overlapEndMm)} cm</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onRestoreAutomatic();
                    onOpenChange(false);
                  }}
                >
                  {context === "costos" ? "Quitar edición manual" : "Restablecer automático"}
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDragIndex(null);
                      onOpenChange(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="bg-orange-500 text-white hover:bg-orange-500/90"
                    disabled={!allValid || !draft}
                    onClick={() => {
                      if (!draft) return;
                      onApply(draft);
                      onOpenChange(false);
                    }}
                  >
                    {context === "costos" ? "Aplicar a esta simulación" : "Aplicar panelizado manual"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
