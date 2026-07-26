import { describe, expect, it } from "vitest";

import {
  esHoy,
  fechaCorta,
  fechaHora,
  fechaHoraCorta,
  fechaNumerica,
  hora,
} from "@/lib/fecha";

/**
 * Lo que estos tests defienden es que el string sea SIEMPRE el mismo.
 *
 * El bug original no se veía: `toLocaleString` mete un espacio angosto
 * (U+202F) antes de "p. m." en algunas versiones de ICU y uno normal en otras.
 * Node y el navegador traen versiones distintas, así que el servidor y el
 * cliente rendereaban dos textos idénticos a la vista y distintos para React,
 * que tiraba un error de hidratación imposible de leer.
 *
 * De ahí que se compare carácter por carácter y se chequee explícitamente que
 * no haya espacios raros.
 */

// 2026-07-25 18:38 en Argentina (UTC-3) = 21:38 UTC.
const TARDE = "2026-07-25T21:38:00.000Z";

describe("fechaHora", () => {
  it("arma el mismo string que se mostraba", () => {
    expect(fechaHora(TARDE)).toBe("25-jul, 06:38 p. m.");
  });

  /** El corazón del bug: nada de espacios que no sean el 0x20 de siempre. */
  it("usa sólo espacios normales", () => {
    expect(fechaHora(TARDE)).not.toMatch(/[   ]/);
  });

  it("convierte a la hora de Argentina, no a la del servidor", () => {
    // 03:00 UTC del 26 son las 00:00 del 26 en Argentina.
    expect(fechaHora("2026-07-26T03:00:00.000Z")).toBe("26-jul, 12:00 a. m.");
  });

  /** Medianoche y mediodía son donde el 12 h se rompe si uno hace hora % 12. */
  it("medianoche es 12 a. m.", () => {
    expect(fechaHora("2026-07-26T03:00:00.000Z")).toContain("12:00 a. m.");
  });

  it("mediodía es 12 p. m.", () => {
    expect(fechaHora("2026-07-25T15:00:00.000Z")).toContain("12:00 p. m.");
  });

  it("la una de la tarde es 01 p. m.", () => {
    expect(fechaHora("2026-07-25T16:00:00.000Z")).toContain("01:00 p. m.");
  });

  it("una fecha inválida no rompe la pantalla", () => {
    expect(fechaHora("no es una fecha")).toBe("");
    expect(fechaHora(null)).toBe("");
    expect(fechaHora(undefined)).toBe("");
  });
});

describe("fechaCorta", () => {
  it("día-mes-año", () => {
    expect(fechaCorta(TARDE)).toBe("25-jul-2026");
  });

  /** Con la zona del servidor en UTC, esto caería en el día siguiente. */
  it("respeta el día argentino en el cruce de medianoche", () => {
    expect(fechaCorta("2026-07-26T02:00:00.000Z")).toBe("25-jul-2026");
  });

  it("vacío si no hay fecha", () => {
    expect(fechaCorta(null)).toBe("");
  });
});

describe("hora", () => {
  it("24 h", () => {
    expect(hora(TARDE)).toBe("18:38");
  });

  it("medianoche es 00 y no 24", () => {
    expect(hora("2026-07-26T03:00:00.000Z")).toBe("00:00");
  });
});

describe("fechaNumerica", () => {
  it("dd/mm/aaaa", () => {
    expect(fechaNumerica(TARDE)).toBe("25/07/2026");
  });

  /** A las 23 de Argentina, un servidor en UTC ya está en el día siguiente. */
  it("usa el día argentino, no el del servidor", () => {
    expect(fechaNumerica("2026-07-26T02:00:00.000Z")).toBe("25/07/2026");
  });
});

describe("fechaHoraCorta", () => {
  it("dd/mm hh:mm sin año", () => {
    expect(fechaHoraCorta(TARDE)).toBe("25/07 18:38");
  });

  it("vacío si no hay fecha", () => {
    expect(fechaHoraCorta(null)).toBe("");
  });
});

describe("esHoy", () => {
  const ahora = new Date("2026-07-25T21:38:00.000Z"); // 18:38 en Argentina

  it("sí para el mismo día argentino", () => {
    expect(esHoy("2026-07-25T12:00:00.000Z", ahora)).toBe(true);
  });

  it("no para el día anterior", () => {
    expect(esHoy("2026-07-24T21:38:00.000Z", ahora)).toBe(false);
  });

  /**
   * El caso que rompía: a las 23 de Argentina son las 02 UTC del día siguiente.
   * Comparando con la zona del proceso, el servidor decía "no es hoy" y el
   * navegador "sí" — el mismo evento con dos textos distintos.
   */
  it("después de las 21 hora argentina sigue siendo el mismo día", () => {
    const casiMedianoche = new Date("2026-07-26T02:00:00.000Z"); // 23:00 del 25
    expect(esHoy("2026-07-25T14:00:00.000Z", casiMedianoche)).toBe(true);
  });

  it("no explota sin fecha", () => {
    expect(esHoy(null)).toBe(false);
  });
});
