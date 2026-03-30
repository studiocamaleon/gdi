"use client";

import PlotterSimulator from "@/components/plotter-simulator";
import type { WideFormatSimulatorData } from "@/components/productos-servicios/motors/wide-format-nesting.helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function WideFormatNestingCard({
  title,
  description,
  simulator,
}: {
  title: string;
  description: string;
  simulator: WideFormatSimulatorData;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[720px] overflow-hidden rounded-xl border">
          <PlotterSimulator
            pieces={simulator.pieces}
            rollWidth={simulator.rollWidth}
            rollLength={simulator.rollLength}
            marginLeft={simulator.marginLeft}
            marginRight={simulator.marginRight}
            marginStart={simulator.marginStart}
            marginEnd={simulator.marginEnd}
            panelizado={simulator.panelizado}
            panelAxis={simulator.panelAxis}
            panelCount={simulator.panelCount}
            panelOverlap={simulator.panelOverlap}
            panelMaxWidth={simulator.panelMaxWidth}
            panelDistribution={simulator.panelDistribution}
            panelWidthInterpretation={simulator.panelWidthInterpretation}
            panelMode={simulator.panelMode}
          />
        </div>
      </CardContent>
    </Card>
  );
}
