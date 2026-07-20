import { describe, expect, it } from "vitest";

import {
  type PasoParaArrastre,
  arrastradosPorDependencia,
  opcionalesActivadosEfectivos,
} from "@/lib/arrastre-opcionales";

/** Ruta de lona: impresión → refuerzo → ojales (orden real de producción). */
function ruta(over: Record<string, Partial<PasoParaArrastre>> = {}) {
  const base: Record<string, PasoParaArrastre> = {
    impresion: {
      id: "cfg-impresion",
      rutaPasoId: "rp-impresion",
      modoActivacion: "OBLIGATORIO",
      requiereRutaPasoIds: [],
    },
    refuerzo: {
      id: "cfg-refuerzo",
      rutaPasoId: "rp-refuerzo",
      modoActivacion: "OPCIONAL",
      requiereRutaPasoIds: [],
    },
    ojales: {
      id: "cfg-ojales",
      rutaPasoId: "rp-ojales",
      modoActivacion: "OPCIONAL",
      requiereRutaPasoIds: ["rp-refuerzo"],
    },
  };
  for (const [clave, cambios] of Object.entries(over)) {
    base[clave] = { ...base[clave], ...cambios };
  }
  return Object.values(base);
}

describe("opcionalesActivadosEfectivos", () => {
  /** El caso que reportó el usuario: la card del refuerzo no aparecía. */
  it("activar ojales enciende el refuerzo", () => {
    const r = opcionalesActivadosEfectivos(ruta(), { "cfg-ojales": true });
    expect(r["cfg-refuerzo"]).toBe(true);
  });

  it("el refuerzo solo sigue funcionando", () => {
    const r = opcionalesActivadosEfectivos(ruta(), { "cfg-refuerzo": true });
    expect(r["cfg-refuerzo"]).toBe(true);
    expect(r["cfg-ojales"]).toBeUndefined();
  });

  it("sin nada activado no enciende nada", () => {
    expect(opcionalesActivadosEfectivos(ruta(), {})).toEqual({});
  });

  it("un OBLIGATORIO también arrastra", () => {
    const r = opcionalesActivadosEfectivos(
      ruta({ impresion: { requiereRutaPasoIds: ["rp-refuerzo"] } }),
      {},
    );
    expect(r["cfg-refuerzo"]).toBe(true);
  });

  it("es transitivo", () => {
    const r = opcionalesActivadosEfectivos(
      ruta({
        refuerzo: { requiereRutaPasoIds: ["rp-impresion"] },
        impresion: { modoActivacion: "OPCIONAL" },
      }),
      { "cfg-ojales": true },
    );
    expect(r["cfg-refuerzo"]).toBe(true);
    expect(r["cfg-impresion"]).toBe(true);
  });

  it("un ciclo no cuelga", () => {
    const r = opcionalesActivadosEfectivos(
      ruta({ refuerzo: { requiereRutaPasoIds: ["rp-ojales"] } }),
      { "cfg-ojales": true },
    );
    expect(r["cfg-refuerzo"]).toBe(true);
  });

  it("no fuerza un paso en NO EJECUTAR", () => {
    const r = opcionalesActivadosEfectivos(
      ruta({ refuerzo: { modoActivacion: "NO_EJECUTAR" } }),
      { "cfg-ojales": true },
    );
    expect(r["cfg-refuerzo"]).toBeUndefined();
  });

  it("ignora una dependencia que no está en la ruta", () => {
    const r = opcionalesActivadosEfectivos(
      ruta({ ojales: { requiereRutaPasoIds: ["rp-fantasma"] } }),
      { "cfg-ojales": true },
    );
    expect(r["cfg-ojales"]).toBe(true);
  });

  it("no muta el objeto que recibe", () => {
    const original = { "cfg-ojales": true };
    opcionalesActivadosEfectivos(ruta(), original);
    expect(original).toEqual({ "cfg-ojales": true });
  });
});

describe("arrastradosPorDependencia", () => {
  it("marca sólo los que encendió el arrastre", () => {
    const r = arrastradosPorDependencia(ruta(), { "cfg-ojales": true });
    expect(Array.from(r)).toEqual(["cfg-refuerzo"]);
  });

  it("si el comercial lo tildó, no cuenta como arrastrado", () => {
    const r = arrastradosPorDependencia(ruta(), {
      "cfg-ojales": true,
      "cfg-refuerzo": true,
    });
    expect(r.size).toBe(0);
  });
});
