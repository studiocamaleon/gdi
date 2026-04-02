"use client";

import * as React from "react";

import type { GranFormatoCostosResponse } from "@/lib/productos-servicios";
import { buildWideFormatSimulatorDataFromPreview } from "@/components/productos-servicios/motors/wide-format-nesting.helpers";
import { WideFormatNestingCard } from "@/components/productos-servicios/motors/wide-format-nesting-card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GranFormatoNestingDialog({
  open,
  onOpenChange,
  productoNombre,
  costosResponse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productoNombre: string;
  costosResponse: GranFormatoCostosResponse;
}) {
  const mainPreview = costosResponse.nestingPreview;
  const grupos = costosResponse.gruposTrabajo ?? [];
  const hasMultipleGroups = grupos.length > 1;

  const [activeGroup, setActiveGroup] = React.useState(
    hasMultipleGroups ? grupos[0]?.grupoId ?? "main" : "main",
  );

  // Delay 3D render until sheet open animation finishes (avoids Canvas sizing glitch)
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      const timeout = setTimeout(() => setReady(true), 250);
      return () => clearTimeout(timeout);
    }
    setReady(false);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!w-[72vw] !max-w-none sm:!max-w-none md:!w-[68vw] lg:!w-[64vw] xl:!w-[62vw]"
      >
        <SheetHeader>
          <SheetTitle>Imposicion — {productoNombre}</SheetTitle>
          <SheetDescription>
            Representacion visual del nesting sobre el rollo y el area
            imprimible.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          {!ready ? (
            <div className="flex h-[720px] items-center justify-center text-sm text-muted-foreground">
              Cargando vista 3D...
            </div>
          ) : hasMultipleGroups ? (
            <Tabs value={activeGroup} onValueChange={setActiveGroup}>
              <TabsList variant="line" className="mb-3">
                {grupos.map((g, i) => (
                  <TabsTrigger key={g.grupoId} value={g.grupoId}>
                    Corrida {i + 1}
                  </TabsTrigger>
                ))}
              </TabsList>
              {grupos.map((g, i) => (
                <TabsContent key={g.grupoId} value={g.grupoId}>
                  {g.nestingPreview ? (
                    <WideFormatNestingCard
                      title={`Corrida ${i + 1}`}
                      description={`${g.piecesCount} piezas · ${(g.largoConsumidoMm / 10).toFixed(1)} cm consumidos · ${g.desperdicioPct.toFixed(1)}% desperdicio`}
                      simulator={buildWideFormatSimulatorDataFromPreview(
                        g.nestingPreview,
                      )}
                    />
                  ) : (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      Sin preview de nesting para este grupo.
                    </p>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          ) : mainPreview ? (
            <WideFormatNestingCard
              title="Nesting"
              description={`${costosResponse.cantidadTotal} piezas · ${costosResponse.resumenTecnico?.largoConsumidoMm != null ? `${(costosResponse.resumenTecnico.largoConsumidoMm / 10).toFixed(1)} cm consumidos` : ""} · ${costosResponse.resumenTecnico?.desperdicioPct != null ? `${costosResponse.resumenTecnico.desperdicioPct.toFixed(1)}% desperdicio` : ""}`}
              simulator={buildWideFormatSimulatorDataFromPreview(mainPreview)}
            />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No hay preview de nesting disponible.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
