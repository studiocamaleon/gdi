"use client";

import { NestingPreview, type NestingPlacement } from "@/components/nesting-preview";

// Ejemplos de placements que emulan lo que devuelven los 3 nestings v2.
// (El shape es exactamente el mismo que genera `apps/api/src/productos-servicios/nesting/*`.)

const ROLLO_PLACEMENTS: NestingPlacement[] = [
  { x: 0, y: 0, anchoMm: 500, altoMm: 300, rotada: false, colorKey: "A" },
  { x: 510, y: 0, anchoMm: 500, altoMm: 300, rotada: false, colorKey: "A" },
  { x: 0, y: 310, anchoMm: 500, altoMm: 300, rotada: false, colorKey: "A" },
  { x: 510, y: 310, anchoMm: 500, altoMm: 300, rotada: false, colorKey: "A" },
  { x: 0, y: 620, anchoMm: 800, altoMm: 400, rotada: false, colorKey: "B" },
  { x: 0, y: 1030, anchoMm: 800, altoMm: 400, rotada: false, colorKey: "B" },
];

const PLIEGO_PLACEMENTS: NestingPlacement[] = [];
// Tarjetas 90×50mm en un A4 (210×297mm), grid 2×5.
// Máquina láser con pinza superior 5mm y bordes laterales/inferior 3mm.
// Posiciones relativas al pliego total (x=0, y=0 es la esquina física del papel).
for (let col = 0; col < 2; col++) {
  for (let row = 0; row < 5; row++) {
    PLIEGO_PLACEMENTS.push({
      x: 6 + col * 100, // 3mm margen máquina izq + 3mm safety
      y: 9 + row * 55,  // 5mm pinza + 3mm safety + 1mm buffer
      anchoMm: 95,
      altoMm: 53,
    });
  }
}

const PLACA_PLACEMENTS: NestingPlacement[] = [];
// Piezas 400×600mm en placa MDF 1220×2440, grid 3 columnas × 4 filas
for (let col = 0; col < 3; col++) {
  for (let row = 0; row < 4; row++) {
    PLACA_PLACEMENTS.push({
      x: 10 + col * 405,
      y: 10 + row * 605,
      anchoMm: 400,
      altoMm: 600,
    });
  }
}

export default function NestingPreviewShowcase() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">NestingPreview — showcase</h1>
        <p className="text-sm text-muted-foreground">
          Componente 2D SVG reutilizable para los 3 tipos de nesting del modelo universal
          (rollo / pliego / placa). Inputs canónicos: <code>container</code> +{" "}
          <code>placements[]</code>.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">1. Nesting-rollo (gran formato / vinilo)</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Rollo 1370mm × 1480mm consumido. Márgenes no imprimibles (hatch): 10mm
          laterales (borde físico del material), 20mm al inicio (pinza de
          arrastre) y 10mm al final (salida de corrida). 6 piezas: 4 de 500×300mm
          y 2 de 800×400mm. Flecha "avance" indica la dirección de salida del rollo.
        </p>
        <NestingPreview
          container={{
            type: "rollo",
            printableWidthMm: 1350,
            rolloAnchoTotalMm: 1370,
            consumedLengthMm: 1480,
            marginLeftMm: 10,
            marginStartMm: 20,
            marginEndMm: 10,
          }}
          placements={ROLLO_PLACEMENTS.map((p) => ({ ...p, y: p.y + 20 }))}
          maxHeightPx={500}
        />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">2. Nesting-hoja (digital láser / talonario)</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Pliego A4 (210×297mm), 10 tarjetas 95×53mm. Zonas sombreadas (hatch) =
          márgenes mecánicos no imprimibles: pinza superior 5mm, bordes 3mm. Línea
          punteada interna = margen de seguridad adicional (3mm).
        </p>
        <NestingPreview
          container={{
            type: "pliego",
            anchoMm: 210,
            altoMm: 297,
            machineMargins: { leftMm: 3, rightMm: 3, topMm: 5, bottomMm: 3 },
            margenMm: 3,
          }}
          placements={PLIEGO_PLACEMENTS}
          maxHeightPx={500}
        />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">3. Nesting-placa-rigida (rígidos impresos)</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Placa MDF 1220×2440mm × 3mm espesor. 12 piezas 400×600mm en grid 3×4.
          Mesa UV con pinza/detección de borde de 15mm en todos los lados (zonas
          sombreadas). Margen de seguridad 5mm interno.
        </p>
        <NestingPreview
          container={{
            type: "placa",
            anchoMm: 1220,
            altoMm: 2440,
            machineMargins: { leftMm: 15, rightMm: 15, topMm: 15, bottomMm: 15 },
            margenMm: 5,
            materialLabel: "MDF 3mm",
          }}
          placements={PLACA_PLACEMENTS}
          maxHeightPx={600}
        />
      </section>
    </div>
  );
}
