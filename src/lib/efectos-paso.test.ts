import { describe, expect, it } from "vitest";
import {
  declaraEfectoDemasia,
  leerEfectoDemasia,
  patchEfectoDemasia,
  resumirEfectoDemasia,
  soportaDemasiaMedida,
} from "./efectos-paso";

describe("leerEfectoDemasia", () => {
  it("lee el formato nuevo y ordena los lados", () => {
    expect(
      leerEfectoDemasia({
        efectos: {
          demasiaMedida: {
            lados: ["derecho", "superior"],
            mm: 100,
            refuerza: true,
          },
        },
      }),
    ).toEqual({ lados: ["superior", "derecho"], mm: 100, refuerza: true });
  });

  it("lee las rutas guardadas antes de los efectos y deriva refuerza", () => {
    expect(
      leerEfectoDemasia({
        subTipo: "refuerzo",
        lados: ["superior", "inferior", "izquierdo", "derecho"],
        demasiaMm: 40,
      }),
    ).toEqual({
      lados: ["superior", "inferior", "izquierdo", "derecho"],
      mm: 40,
      refuerza: true,
    });

    expect(
      leerEfectoDemasia({
        subTipo: "bolsillo",
        lados: ["superior"],
        demasiaMm: 100,
      })?.refuerza,
    ).toBe(false);
  });

  it("no lee un efecto a medias", () => {
    expect(leerEfectoDemasia({ mm: 100 })).toBeNull();
    expect(leerEfectoDemasia({ lados: ["superior"] })).toBeNull();
    expect(leerEfectoDemasia({ lados: [], mm: 100 })).toBeNull();
  });
});

describe("declaraEfectoDemasia", () => {
  it("distingue no exigir nada de exigirlo a medias", () => {
    expect(declaraEfectoDemasia({ tipoTrabajo: "tensado" })).toBe(false);
    expect(declaraEfectoDemasia({ lados: ["superior"] })).toBe(true);
    expect(declaraEfectoDemasia({ efectos: { demasiaMedida: { mm: 40 } } })).toBe(
      true,
    );
  });
});

describe("patchEfectoDemasia", () => {
  it("escribe en el formato nuevo y apaga el viejo", () => {
    expect(
      patchEfectoDemasia(
        { subTipo: "bolsillo", lados: ["superior"], demasiaMm: 100 },
        { lados: ["superior", "inferior"], mm: 120, refuerza: false },
      ),
    ).toEqual({
      efectos: {
        demasiaMedida: {
          lados: ["superior", "inferior"],
          mm: 120,
          refuerza: false,
        },
      },
      lados: null,
      demasiaMm: null,
      subTipo: null,
    });
  });

  it("apagar el efecto no borra otros efectos del paso", () => {
    expect(
      patchEfectoDemasia(
        { efectos: { demasiaMedida: { lados: ["superior"], mm: 40 }, otro: 1 } },
        null,
      ),
    ).toEqual({ efectos: { otro: 1 } });
  });

  it("sin efectos ni campos viejos, el patch deja el campo en null", () => {
    expect(patchEfectoDemasia({}, null)).toEqual({ efectos: null });
  });
});

describe("resumirEfectoDemasia", () => {
  it("dice los milímetros y dónde", () => {
    expect(
      resumirEfectoDemasia({
        lados: ["superior", "inferior"],
        mm: 100,
        refuerza: false,
      }),
    ).toBe("100 mm arriba y abajo");

    expect(
      resumirEfectoDemasia({
        lados: ["superior", "inferior", "izquierdo", "derecho"],
        mm: 40,
        refuerza: true,
      }),
    ).toBe("40 mm en los 4 lados · deja banda plana");
  });
});

describe("soportaDemasiaMedida", () => {
  it("lo declara la familia, no el nombre del paso", () => {
    expect(soportaDemasiaMedida({ efectosSoportados: ["demasiaMedida"] })).toBe(
      true,
    );
    expect(soportaDemasiaMedida({ efectosSoportados: [] })).toBe(false);
    expect(soportaDemasiaMedida(null)).toBe(false);
  });
});
