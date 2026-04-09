"use client";

import * as React from "react";

import type { PropuestaItem } from "@/lib/propuestas";
import {
  nestMultiMedida,
  type MultiMedidaNestingResult,
  MEDIDA_COLORS,
} from "@/components/productos-servicios/motors/rigid-printed-nesting.helpers";
import { MultiMedidaPlacaSvg } from "@/components/productos-servicios/motors/rigid-printed-imposicion-tab";
import { WideFormatNestingCard } from "@/components/productos-servicios/motors/wide-format-nesting-card";
import { buildWideFormatSimulatorDataFromPreview } from "@/components/productos-servicios/motors/wide-format-nesting.helpers";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// ── Component ────────────────────────────────────────────────────

export function RigidPrintedNestingDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PropuestaItem;
}) {
  const rp = item.rigidosPrinted;
  const result = rp?.cotizacionResult as Record<string, unknown> | undefined;
  const trazabilidad = result?.trazabilidad as Record<string, unknown> | undefined;
  const resumen = trazabilidad?.resumenTecnico as Record<string, unknown> | undefined;
  const flexPreview = trazabilidad?.flexibleNestingPreview as Record<string, unknown> | null | undefined;
  const medidasDetalle = (trazabilidad?.medidasDetalle ?? []) as Array<{ anchoMm: number; altoMm: number; cantidad: number }>;

  const hasFlexible = !!flexPreview;

  // Recalcular nesting client-side para el SVG de placa
  const placaAnchoMm = Number(resumen?.placaAnchoMm ?? 0);
  const placaAltoMm = Number(resumen?.placaAltoMm ?? 0);
  const imposicion = (trazabilidad?.config as Record<string, unknown>)?.imposicion as Record<string, unknown> | undefined;

  const nesting = React.useMemo<MultiMedidaNestingResult | null>(() => {
    if (!placaAnchoMm || !placaAltoMm || medidasDetalle.length === 0) return null;
    const sepH = Number(imposicion?.separacionHorizontalMm ?? 3);
    const sepV = Number(imposicion?.separacionVerticalMm ?? 3);
    const mg = (imposicion?.margenMaquina ?? {}) as Record<string, number>;
    const areaW = placaAnchoMm - (mg.izquierda ?? 0) - (mg.derecha ?? 0);
    const areaH = placaAltoMm - (mg.arriba ?? 0) - (mg.abajo ?? 0);
    const result = nestMultiMedida(
      medidasDetalle,
      areaW, areaH, sepH, sepV, 0,
      imposicion?.permitirRotacion !== false,
    );
    // Offset por márgenes
    return {
      ...result,
      placaLayouts: result.placaLayouts.map((pl) => ({
        ...pl,
        posiciones: pl.posiciones.map((p) => ({
          ...p,
          x: p.x + (mg.izquierda ?? 0),
          y: p.y + (mg.arriba ?? 0),
        })),
        largoConsumidoMm: pl.largoConsumidoMm + (mg.arriba ?? 0),
      })),
    };
  }, [placaAnchoMm, placaAltoMm, medidasDetalle, imposicion]);

  const mg = (imposicion?.margenMaquina ?? { arriba: 0, abajo: 0, izquierda: 0, derecha: 0 }) as { arriba: number; abajo: number; izquierda: number; derecha: number };

  const PlateContent = () => (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        {nesting && (
          <>
            <Badge variant="secondary">{nesting.placas} placa{nesting.placas !== 1 ? "s" : ""}</Badge>
            <Badge variant="secondary">{nesting.totalPiezas} piezas</Badge>
            <Badge variant="secondary">Aprovechamiento: {nesting.aprovechamientoPct}%</Badge>
          </>
        )}
      </div>
      {/* Leyenda medidas */}
      {medidasDetalle.length > 1 && (
        <div className="flex gap-3 flex-wrap text-xs">
          {medidasDetalle.map((m, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: MEDIDA_COLORS[i % MEDIDA_COLORS.length], opacity: 0.85 }} />
              <span>{m.anchoMm / 10} × {m.altoMm / 10} cm ×{m.cantidad}</span>
            </div>
          ))}
        </div>
      )}
      {/* SVG por placa */}
      {nesting?.placaLayouts.map((layout, pi) => (
        <div key={pi}>
          {nesting.placas > 1 && <p className="text-xs text-muted-foreground mb-1">Placa {pi + 1}</p>}
          <MultiMedidaPlacaSvg
            placaAnchoMm={placaAnchoMm}
            placaAltoMm={placaAltoMm}
            posiciones={layout.posiciones}
            largoConsumidoMm={layout.largoConsumidoMm}
            estrategia={String(imposicion?.estrategiaCosteo ?? "segmentos_placa")}
            segmentoAplicadoPct={null}
            segmentosPlaca={(imposicion?.segmentosPlaca ?? []) as number[]}
            margenMaquina={mg}
          />
        </div>
      ))}
      {(!nesting || nesting.totalPiezas === 0) && (
        <p className="text-sm text-muted-foreground">No se pudo calcular el nesting de placa.</p>
      )}
    </div>
  );

  const FlexibleContent = () => (
    <div>
      {flexPreview ? (
        <WideFormatNestingCard
          title="Nesting sustrato flexible"
          description="Distribución de piezas en el rollo."
          simulator={buildWideFormatSimulatorDataFromPreview(flexPreview as any)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Sin datos de nesting flexible.</p>
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="!w-[72vw] !max-w-none md:!w-[68vw] lg:!w-[64vw] xl:!w-[60vw] sm:!max-w-none flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle>Nesting — {item.productoNombre}</SheetTitle>
          <SheetDescription>
            Visualización de la imposición de piezas en placa{hasFlexible ? " y rollo flexible" : ""}.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {hasFlexible ? (
            <Tabs defaultValue="placa">
              <TabsList>
                <TabsTrigger value="placa">Placa rígida</TabsTrigger>
                <TabsTrigger value="flexible">Sustrato flexible</TabsTrigger>
              </TabsList>
              <TabsContent value="placa" className="mt-4"><PlateContent /></TabsContent>
              <TabsContent value="flexible" className="mt-4"><FlexibleContent /></TabsContent>
            </Tabs>
          ) : (
            <PlateContent />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
