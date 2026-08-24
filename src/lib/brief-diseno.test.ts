import { describe, expect, it } from "vitest";

import {
  BRIEF_DISENO_VACIO,
  briefDisenoEstaCompleto,
  errorBriefDiseno,
  leerBriefDiseno,
  prepararBriefDiseno,
} from "./brief-diseno";

describe("brief de diseño", () => {
  it("tolera snapshots inexistentes o incompletos", () => {
    expect(leerBriefDiseno(null)).toEqual(BRIEF_DISENO_VACIO);
    expect(
      leerBriefDiseno({
        frente: "Teléfono 123",
        archivos: [null, { nombre: "logo.png", requiereVectorizacion: true }],
      }),
    ).toMatchObject({
      frente: "Teléfono 123",
      dorso: "",
      archivos: [{ nombre: "logo.png", requiereVectorizacion: true }],
    });
  });

  it("permite un diseño basado sólo en un adjunto", () => {
    const brief = {
      ...BRIEF_DISENO_VACIO,
      archivos: [{ nombre: "arte.pdf", requiereVectorizacion: false }],
    };
    expect(errorBriefDiseno(brief)).toBeNull();
    expect(briefDisenoEstaCompleto(brief, 1)).toBe(true);
  });

  it("marca doble faz sin dorso como incompleto sin bloquear el guardado", () => {
    const brief = { ...BRIEF_DISENO_VACIO, frente: "Frente" };
    expect(errorBriefDiseno(brief)).toBeNull();
    expect(briefDisenoEstaCompleto(brief, 2)).toBe(false);
  });

  it("normaliza textos y reemplaza metadata del archivo pendiente", () => {
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    const brief = prepararBriefDiseno(
      {
        ...BRIEF_DISENO_VACIO,
        frente: "  Frente  ",
        archivos: [{ nombre: "logo.png", requiereVectorizacion: false }],
      },
      [{ file, requiereVectorizacion: true }],
    );
    expect(brief.frente).toBe("Frente");
    expect(brief.archivos).toEqual([
      { nombre: "logo.png", requiereVectorizacion: true },
    ]);
  });
});
