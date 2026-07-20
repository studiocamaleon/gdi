import { describe, expect, it } from "vitest";

import type { DemasiaPorLado, PosicionOjalView } from "@/lib/modificaciones-fisicas";
import {
  demasiaDibujada,
  marcoDemasia,
  overlayAplicable,
  puntosOjales,
} from "@/lib/nesting-overlay";

const SIN_DEMASIA: DemasiaPorLado = {
  superior: 0,
  inferior: 0,
  izquierdo: 0,
  derecho: 0,
};

/** Caso A: bolsillo de 100mm arriba y abajo. Material 1500 × 1200. */
const BOLSILLO: DemasiaPorLado = { ...SIN_DEMASIA, superior: 100, inferior: 100 };

/** Caso B: refuerzo de 40mm en los 4 lados. Material 1580 × 1080. */
const REFUERZO: DemasiaPorLado = {
  superior: 40,
  inferior: 40,
  izquierdo: 40,
  derecho: 40,
};

const sinRotar = { xMm: 0, yMm: 0, widthMm: 1500, heightMm: 1200, rotated: false };
// La misma pieza rotada 90°: el nesting la gira para que entre en el rollo.
const rotada = { xMm: 0, yMm: 0, widthMm: 1200, heightMm: 1500, rotated: true };

describe("demasiaDibujada", () => {
  it("sin rotar deja los lados como están", () => {
    expect(demasiaDibujada(BOLSILLO, false)).toEqual(BOLSILLO);
  });

  it("rotada, el bolsillo de arriba/abajo pasa a los laterales", () => {
    expect(demasiaDibujada(BOLSILLO, true)).toEqual({
      superior: 0,
      inferior: 0,
      izquierdo: 100,
      derecho: 100,
    });
  });

  it("el refuerzo en los 4 lados es indiferente a la rotación", () => {
    expect(demasiaDibujada(REFUERZO, true)).toEqual(REFUERZO);
  });
});

describe("marcoDemasia", () => {
  it("caso A: el área visible queda 100mm adentro arriba y abajo", () => {
    expect(marcoDemasia(sinRotar, BOLSILLO)).toEqual({
      outer: { xMm: 0, yMm: 0, widthMm: 1500, heightMm: 1200 },
      inner: { xMm: 0, yMm: 100, widthMm: 1500, heightMm: 1000 },
    });
  });

  it("caso A rotado: la franja pasa a los laterales", () => {
    expect(marcoDemasia(rotada, BOLSILLO)).toEqual({
      outer: { xMm: 0, yMm: 0, widthMm: 1200, heightMm: 1500 },
      inner: { xMm: 100, yMm: 0, widthMm: 1000, heightMm: 1500 },
    });
  });

  it("caso B: refuerzo perimetral de 40mm", () => {
    expect(
      marcoDemasia({ ...sinRotar, widthMm: 1580, heightMm: 1080 }, REFUERZO),
    ).toEqual({
      outer: { xMm: 0, yMm: 0, widthMm: 1580, heightMm: 1080 },
      inner: { xMm: 40, yMm: 40, widthMm: 1500, heightMm: 1000 },
    });
  });

  it("respeta el desplazamiento del placement en el sustrato", () => {
    const marco = marcoDemasia({ ...sinRotar, xMm: 300, yMm: 50 }, BOLSILLO);
    expect(marco?.inner).toEqual({
      xMm: 300,
      yMm: 150,
      widthMm: 1500,
      heightMm: 1000,
    });
  });

  it("sin demasía no hay marco", () => {
    expect(marcoDemasia(sinRotar, SIN_DEMASIA)).toBeNull();
  });

  it("no dibuja si la demasía se comería toda la pieza", () => {
    expect(
      marcoDemasia({ ...sinRotar, heightMm: 150 }, BOLSILLO),
    ).toBeNull();
  });
});

describe("puntosOjales", () => {
  /** Las 4 esquinas del área visible de una lona 1500×1000. */
  const ESQUINAS: PosicionOjalView[] = [
    { xMm: 0, yMm: 0, lado: "superior" },
    { xMm: 1500, yMm: 0, lado: "superior" },
    { xMm: 0, yMm: 1000, lado: "inferior" },
    { xMm: 1500, yMm: 1000, lado: "inferior" },
  ];

  it("corre las posiciones por la demasía", () => {
    const material = { ...sinRotar, widthMm: 1580, heightMm: 1080 };
    expect(puntosOjales(material, REFUERZO, ESQUINAS)).toEqual([
      { xMm: 40, yMm: 40 },
      { xMm: 1540, yMm: 40 },
      { xMm: 40, yMm: 1040 },
      { xMm: 1540, yMm: 1040 },
    ]);
  });

  it("los puntos caen sobre el borde del área visible, no del material", () => {
    const material = { ...sinRotar, widthMm: 1580, heightMm: 1080 };
    const marco = marcoDemasia(material, REFUERZO)!;
    for (const p of puntosOjales(material, REFUERZO, ESQUINAS)) {
      expect(p.xMm).toBeGreaterThanOrEqual(marco.inner.xMm);
      expect(p.xMm).toBeLessThanOrEqual(marco.inner.xMm + marco.inner.widthMm);
      expect(p.yMm).toBeGreaterThanOrEqual(marco.inner.yMm);
      expect(p.yMm).toBeLessThanOrEqual(marco.inner.yMm + marco.inner.heightMm);
    }
  });

  it("rota los puntos junto con la pieza", () => {
    // Pieza lógica 1500×1000 sin demasía, dibujada rotada como 1000×1500.
    const material = {
      xMm: 0,
      yMm: 0,
      widthMm: 1000,
      heightMm: 1500,
      rotated: true,
    };
    // Esquina superior izquierda lógica (0,0) → arriba a la derecha.
    expect(puntosOjales(material, SIN_DEMASIA, [ESQUINAS[0]])).toEqual([
      { xMm: 1000, yMm: 0 },
    ]);
    // Esquina superior derecha lógica (1500,0) → abajo a la derecha.
    expect(puntosOjales(material, SIN_DEMASIA, [ESQUINAS[1]])).toEqual([
      { xMm: 1000, yMm: 1500 },
    ]);
  });

  it("rotada, los puntos siguen dentro de la pieza dibujada", () => {
    const material = {
      xMm: 0,
      yMm: 0,
      widthMm: 1080,
      heightMm: 1580,
      rotated: true,
    };
    for (const p of puntosOjales(material, REFUERZO, ESQUINAS)) {
      expect(p.xMm).toBeGreaterThanOrEqual(0);
      expect(p.xMm).toBeLessThanOrEqual(1080);
      expect(p.yMm).toBeGreaterThanOrEqual(0);
      expect(p.yMm).toBeLessThanOrEqual(1580);
    }
  });

  it("sin posiciones no devuelve nada", () => {
    expect(puntosOjales(sinRotar, REFUERZO, [])).toEqual([]);
  });
});

describe("overlayAplicable", () => {
  it("una pieza entera acepta overlay", () => {
    expect(overlayAplicable(sinRotar)).toBe(true);
    expect(overlayAplicable({ ...sinRotar, panelCount: 1 })).toBe(true);
  });

  it("una pieza paneleada NO: las franjas caerían sobre las uniones", () => {
    expect(overlayAplicable({ ...sinRotar, panelCount: 2 })).toBe(false);
  });
});
