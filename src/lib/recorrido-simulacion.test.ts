import { describe, expect, it } from "vitest";

import type { PuntoRecorridoCorte } from "@/lib/recorridos-vectoriales-api";
import {
  distanciasAcumuladasRecorrido,
  tramoVisibleRecorrido,
} from "@/lib/recorrido-simulacion";

const recorrido: PuntoRecorridoCorte[] = [
  { x: 0, y: 0, via: "origin" },
  { x: 10, y: 0, via: "bridge" },
  { x: 10, y: 10, via: "contour" },
  { x: 0, y: 0, via: "bridge" },
];

describe("simulación de recorridos vectoriales", () => {
  const distancias = distanciasAcumuladasRecorrido(recorrido);

  it("no dibuja ningún tramo antes de iniciar", () => {
    expect(tramoVisibleRecorrido(recorrido, distancias, 0)).toEqual([]);
  });

  it("avanza desde el origen e interpola el segmento actual", () => {
    expect(tramoVisibleRecorrido(recorrido, distancias, 5)).toEqual([
      recorrido[0],
      { x: 5, y: 0, via: "bridge" },
    ]);
  });

  it("no envuelve el final de un recorrido cerrado durante el avance", () => {
    const visible = tramoVisibleRecorrido(recorrido, distancias, 15);

    expect(visible).toEqual([
      recorrido[0],
      recorrido[1],
      { x: 10, y: 5, via: "contour" },
    ]);
    expect(visible.at(-1)).not.toEqual(recorrido.at(-1));
  });

  it("muestra el recorrido completo únicamente al finalizar", () => {
    expect(
      tramoVisibleRecorrido(recorrido, distancias, distancias.at(-1) ?? 0),
    ).toBe(recorrido);
  });
});
