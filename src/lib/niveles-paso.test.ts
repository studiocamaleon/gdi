/**
 * Los lectores del EDITOR alimentan inputs controlados en cada tecla, así que
 * no pueden normalizar: normalizar mientras se escribe se siente como un bug
 * del teclado. Estos tests fijan esa frontera —el lector es fiel, quien
 * muestra hace el fallback— porque es un error que vuelve solo.
 */
import { describe, expect, it } from "vitest";

import { leerNivelesPaso, nivelEfectivo, nombreNivel } from "./niveles-paso";
import { leerTiemposExtra, patchTiemposExtra } from "./tiempos-extra-paso";

const dosNiveles = (nombre: string, etiqueta = "¿Dónde se coloca?") => ({
  niveles: {
    etiqueta,
    opciones: [
      { codigo: "nivel_1", nombre, esDefault: true },
      { codigo: "nivel_2", nombre: "Zona 1", esDefault: false },
    ],
  },
});

describe("leerNivelesPaso — fidelidad para el editor", () => {
  it("conserva el espacio final mientras se escribe", () => {
    // "Profesional " + "a" tiene que dar "Profesional a", no "Profesionala".
    const config = leerNivelesPaso(dosNiveles("Profesional "));
    expect(config?.opciones[0].nombre).toBe("Profesional ");
  });

  it("deja el nombre vacío en vez de repoblarlo con el código", () => {
    const config = leerNivelesPaso(dosNiveles(""));
    expect(config?.opciones[0].nombre).toBe("");
  });

  it("conserva el espacio final de la pregunta al comercial", () => {
    const config = leerNivelesPaso(dosNiveles("Zona 2", "¿Dónde se "));
    expect(config?.etiqueta).toBe("¿Dónde se ");
  });

  it("cae al código sólo cuando el nombre no es texto", () => {
    const config = leerNivelesPaso({
      niveles: {
        opciones: [
          { codigo: "nivel_1" },
          { codigo: "nivel_2", nombre: "Zona 1" },
        ],
      },
    });
    expect(config?.opciones[0].nombre).toBe("nivel_1");
  });

  it("null con menos de dos opciones: un solo nivel no es una decisión", () => {
    expect(
      leerNivelesPaso({ niveles: { opciones: [{ codigo: "a", nombre: "A" }] } }),
    ).toBeNull();
  });
});

describe("nombreNivel — el fallback vive en quien muestra", () => {
  it("usa el código cuando el nombre quedó vacío", () => {
    const config = leerNivelesPaso(dosNiveles("   "));
    expect(nombreNivel(config!.opciones[0])).toBe("nivel_1");
  });

  it("respeta el nombre escrito", () => {
    const config = leerNivelesPaso(dosNiveles("En taller"));
    expect(nombreNivel(config!.opciones[0])).toBe("En taller");
  });
});

describe("nivelEfectivo", () => {
  it("gana el elegido por el comercial", () => {
    const config = leerNivelesPaso(dosNiveles("En taller"))!;
    expect(nivelEfectivo(config, "nivel_2").codigo).toBe("nivel_2");
  });

  it("sin elección, el marcado por defecto", () => {
    const config = leerNivelesPaso(dosNiveles("En taller"))!;
    expect(nivelEfectivo(config, null).codigo).toBe("nivel_1");
  });

  it("un código que ya no existe cae al default, no rompe", () => {
    const config = leerNivelesPaso(dosNiveles("En taller"))!;
    expect(nivelEfectivo(config, "nivel_borrado").codigo).toBe("nivel_1");
  });
});

describe("patchTiemposExtra — vaciar el campo no borra el bloque", () => {
  it("conserva un bloque en 0 mientras se reescriben los minutos", () => {
    const bloques = leerTiemposExtra({
      tiemposExtra: [
        { id: "extra_1", etiqueta: "Traslado", minutos: 90, dotacion: 2 },
      ],
    });
    const enCero = bloques.map((bloque) => ({ ...bloque, minutos: 0 }));
    const patch = patchTiemposExtra(enCero) as { tiemposExtra: unknown[] };
    expect(patch.tiemposExtra).toHaveLength(1);
  });

  it("borra la clave sólo cuando no queda ningún bloque", () => {
    expect(patchTiemposExtra([])).toEqual({ tiemposExtra: null });
  });
});
