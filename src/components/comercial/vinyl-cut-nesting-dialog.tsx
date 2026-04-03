"use client";

import * as React from "react";
import dynamicImport from "next/dynamic";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Lazy-load to avoid SSR issues with Canvas/SVG heavy component
const VinylCutNestingWorkspace = dynamicImport(
  () =>
    import("@/components/vinyl-cut-nesting-workspace").then(
      (mod) => mod.VinylCutNestingWorkspace,
    ),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function buildColorNestingPreview(colorResult: Record<string, unknown> | null) {
  if (!colorResult) return null;
  const winner = asRecord(colorResult.winner ?? null);
  if (!winner || Object.keys(winner).length === 0) return null;
  const nestingPreview = asRecord(winner.nestingPreview);
  const pieces = Array.isArray(nestingPreview.pieces) ? nestingPreview.pieces : [];
  const rollWidth = Number(nestingPreview.rollWidth ?? 0);
  return {
    machineLabel: String(winner.maquinaNombre ?? "Plotter"),
    rollWidthCm: rollWidth,
    rollLengthCm: Number(nestingPreview.rollLength ?? 0),
    marginLeftCm: Number(nestingPreview.marginLeft ?? 0),
    marginRightCm: Number(nestingPreview.marginRight ?? 0),
    marginTopCm: Number(nestingPreview.marginStart ?? 0),
    marginBottomCm: Number(nestingPreview.marginEnd ?? 0),
    separacionHorizontalCm: Number(nestingPreview.separacionHorizontalCm ?? 0),
    separacionVerticalCm: Number(nestingPreview.separacionVerticalCm ?? 0),
    pieces: pieces.map((item) => {
      const row = asRecord(item);
      const w = Number(row.w ?? 0);
      const h = Number(row.h ?? 0);
      const cx = Number(row.cx ?? 0);
      const cy = Number(row.cy ?? 0);
      const originalW = Number(row.originalW ?? w);
      const originalH = Number(row.originalH ?? h);
      return {
        id: String(row.id ?? crypto.randomUUID()),
        label: String(row.label ?? ""),
        widthCm: w,
        heightCm: h,
        originalWidthCm: originalW,
        originalHeightCm: originalH,
        xCm: cx + rollWidth / 2 - w / 2,
        yCm: cy - h / 2,
        rotated: Boolean(row.rotated),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VinylCutNestingDialog({
  open,
  onOpenChange,
  productoNombre,
  costosResponse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productoNombre: string;
  costosResponse: Record<string, unknown>;
}) {
  const colorResults = (costosResponse.colorResults ?? []) as Array<Record<string, unknown>>;
  const hasMultipleColors = colorResults.length > 1;

  const [activeColor, setActiveColor] = React.useState(
    String(colorResults[0]?.colorId ?? "0"),
  );

  // Delay render until sheet animation finishes (avoids sizing glitch)
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    const timer = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(timer);
  }, [open]);

  function renderColorPreview(colorResult: Record<string, unknown>) {
    const preview = buildColorNestingPreview(colorResult);
    if (!preview || preview.pieces.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay datos de imposicion para este color.
        </p>
      );
    }

    const piecesCount = preview.pieces.length;
    const wastePct = Number((colorResult.winner as Record<string, unknown>)?.desperdicioPct ?? 0);

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {piecesCount} pieza{piecesCount !== 1 ? "s" : ""}
          {` · ${preview.machineLabel}`}
          {` · Rollo ${preview.rollWidthCm.toFixed(0)} cm`}
          {wastePct > 0 ? ` · Desperdicio ${wastePct.toFixed(1)}%` : ""}
        </p>
        {ready && (
          <VinylCutNestingWorkspace
            machineLabel={preview.machineLabel}
            rollWidthCm={preview.rollWidthCm}
            rollLengthCm={preview.rollLengthCm}
            pieces={preview.pieces}
            marginLeftCm={preview.marginLeftCm}
            marginRightCm={preview.marginRightCm}
            marginTopCm={preview.marginTopCm}
            marginBottomCm={preview.marginBottomCm}
            separacionHorizontalCm={preview.separacionHorizontalCm}
            separacionVerticalCm={preview.separacionVerticalCm}
          />
        )}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-screen max-w-none flex-col overflow-hidden data-[side=right]:!w-[72vw] data-[side=right]:sm:!max-w-[72vw] xl:data-[side=right]:!w-[62vw] xl:data-[side=right]:sm:!max-w-[62vw]">
        <SheetHeader className="px-4 pb-3 md:px-6">
          <SheetTitle>Imposicion — Vinilo de corte</SheetTitle>
          <SheetDescription>
            {productoNombre} · {colorResults.length} color{colorResults.length !== 1 ? "es" : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 md:px-6">
          {colorResults.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay resultados de imposicion.
            </p>
          ) : hasMultipleColors ? (
            <Tabs value={activeColor} onValueChange={setActiveColor}>
              <TabsList variant="line" className="mb-4">
                {colorResults.map((cr) => (
                  <TabsTrigger
                    key={String(cr.colorId)}
                    value={String(cr.colorId)}
                  >
                    {String(cr.colorLabel ?? cr.colorFiltro ?? `Color`)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {colorResults.map((cr) => (
                <TabsContent key={String(cr.colorId)} value={String(cr.colorId)}>
                  {renderColorPreview(cr)}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            renderColorPreview(colorResults[0])
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
