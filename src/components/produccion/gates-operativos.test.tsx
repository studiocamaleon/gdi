import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { TableroPasoData } from "@/lib/tablero-produccion";

vi.mock("@/lib/fuentes-simulacion", () => ({ fuentesSimulacion: "" }));

import { GatesOperativos } from "./tablero-produccion";

const paso = {
  id: "paso",
  gatesOperativos: [
    {
      id: "gate-material",
      tipo: "MATERIAL",
      estado: "PENDIENTE",
      detalle: null,
      resueltoEl: null,
      resueltoPorNombre: null,
    },
    {
      id: "gate-calidad",
      tipo: "CALIDAD",
      estado: "CUMPLIDO",
      detalle: null,
      resueltoEl: "2026-08-30T18:00:00.000Z",
      resueltoPorNombre: "Supervisora",
    },
  ],
} as TableroPasoData;

describe("gates operativos en el tablero", () => {
  it("distingue la condición bloqueante de la ya confirmada", () => {
    const html = renderToStaticMarkup(
      <GatesOperativos
        paso={paso}
        busy={false}
        canSupervise
        onGate={vi.fn()}
      />,
    );

    expect(html).toContain("Material");
    expect(html).toContain("Pendiente: bloquea la ejecución");
    expect(html).toContain("Calidad");
    expect(html).toContain("Confirmado por Supervisora");
    expect(html).toContain("Confirmar");
    expect(html).toContain("Revocar");
  });
});
