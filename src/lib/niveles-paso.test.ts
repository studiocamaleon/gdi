/**
 * Los lectores del EDITOR alimentan inputs controlados en cada tecla, así que
 * no pueden normalizar: normalizar mientras se escribe se siente como un bug
 * del teclado. Estos tests fijan esa frontera —el lector es fiel, quien
 * muestra hace el fallback— porque es un error que vuelve solo.
 */
import { describe, expect, it } from "vitest";

import {
  describirNivel,
  leerNivelesPaso,
  nivelEfectivo,
  nombreNivel,
} from "./niveles-paso";
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

describe("describirNivel — el resumen cuenta lo que se va a trabajar", () => {
  const base = {
    bloques: [
      { id: "prep", minutos: 30 },
      { id: "traslado", minutos: 90 },
    ],
  };

  it("suma el efectivo: el override donde lo hay, la base donde no", () => {
    const nivel = {
      codigo: "zona_1",
      nombre: "Zona 1",
      esDefault: false,
      overrides: { tiemposExtraMin: { traslado: 150 } },
    };
    // 30 (prep, sin override) + 150 (traslado) = 180 min = 3 h.
    expect(describirNivel(nivel, base)).toContain("+3 h de tiempo extra");
  });

  it("IGNORA overrides de bloques borrados, como hace el motor", () => {
    const nivel = {
      codigo: "zona_2",
      nombre: "Zona 2",
      esDefault: false,
      // `fantasma` ya no existe entre los bloques del paso.
      overrides: { tiemposExtraMin: { traslado: 60, fantasma: 240 } },
    };
    // 30 + 60 = 90 min (1,5 h). NO 330 (5,5 h): al bloque fantasma no lo
    // trabaja nadie — es el caso que mostraba "+5 h" en el cotizador.
    const resumen = describirNivel(nivel, base);
    expect(resumen).toContain("+1.5 h de tiempo extra");
    expect(resumen).not.toContain("5.5");
  });

  it("un nivel que no pisa nada igual dice cuánto vale", () => {
    const nivel = {
      codigo: "base",
      nombre: "Base",
      esDefault: true,
      overrides: {},
    };
    expect(describirNivel(nivel, base)).toContain("+2 h de tiempo extra");
  });
});

describe("patchTiemposExtra — borrar un bloque limpia los niveles", () => {
  const params = {
    tiemposExtra: [
      { id: "prep", etiqueta: "Preparar", minutos: 30 },
      { id: "traslado", etiqueta: "Traslado", minutos: 90 },
    ],
    niveles: {
      etiqueta: "¿Dónde?",
      opciones: [
        {
          codigo: "a",
          nombre: "A",
          esDefault: true,
          overrides: { dotacion: 2, tiemposExtraMin: { prep: 10, traslado: 0 } },
        },
        {
          codigo: "b",
          nombre: "B",
          esDefault: false,
          overrides: { tiemposExtraMin: { traslado: 240 } },
        },
      ],
    },
  };

  it("poda los overrides del bloque que ya no está", () => {
    const quedan = leerTiemposExtra(params).filter((b) => b.id === "prep");
    const patch = patchTiemposExtra(quedan, params) as {
      niveles: { opciones: Array<Record<string, never>> };
    };
    const opciones = patch.niveles.opciones as unknown as Array<{
      overrides: { tiemposExtraMin?: Record<string, number>; dotacion?: number };
    }>;
    expect(opciones[0].overrides.tiemposExtraMin).toEqual({ prep: 10 });
    // Sin bloques que pisar, la clave se va entera; el resto del nivel queda.
    expect(opciones[1].overrides.tiemposExtraMin).toBeUndefined();
    expect(opciones[0].overrides.dotacion).toBe(2);
  });

  it("no toca los niveles cuando no hay nada huérfano", () => {
    const patch = patchTiemposExtra(leerTiemposExtra(params), params);
    expect("niveles" in patch).toBe(false);
  });

  it("sin niveles declarados no inventa la clave", () => {
    const patch = patchTiemposExtra([], { tiemposExtra: [] });
    expect("niveles" in patch).toBe(false);
  });
});
