import { describe, expect, it } from "vitest";

import {
  claveFechaEnZona,
  diaSemanaDeClave,
  instanteDe,
  partesEnZona,
  sumarDiasAClave,
} from "./zona";

const AR = "America/Argentina/Buenos_Aires"; // UTC-3, sin DST
const CL = "America/Santiago"; // UTC-4 / UTC-3 con DST
const HN = "America/Tegucigalpa"; // UTC-6, sin DST

describe("partesEnZona / claveFechaEnZona", () => {
  it("un instante nocturno UTC sigue siendo 'hoy' en América", () => {
    // 2026-07-27 01:30 UTC = 26 de julio 22:30 en AR, 19:30 en HN.
    const t = new Date("2026-07-27T01:30:00.000Z");
    expect(claveFechaEnZona(t, AR)).toBe("2026-07-26");
    expect(claveFechaEnZona(t, HN)).toBe("2026-07-26");
    expect(partesEnZona(t, AR)).toEqual({ y: 2026, m: 7, d: 26, hh: 22, mm: 30 });
    expect(partesEnZona(t, HN).hh).toBe(19);
  });
});

describe("instanteDe (la inversa)", () => {
  it("las 08:00 del taller argentino son las 11:00 UTC", () => {
    expect(instanteDe("2026-07-27", "08:00", AR).toISOString()).toBe(
      "2026-07-27T11:00:00.000Z",
    );
  });

  it("es exactamente la inversa de partesEnZona, en cualquier zona", () => {
    for (const zona of [AR, CL, HN]) {
      const t = instanteDe("2026-11-15", "14:30", zona);
      expect(claveFechaEnZona(t, zona)).toBe("2026-11-15");
      const p = partesEnZona(t, zona);
      expect([p.hh, p.mm]).toEqual([14, 30]);
    }
  });

  it("DST de Chile: la misma hora de pared cambia de offset entre invierno y verano", () => {
    // Julio (invierno austral): Chile está en UTC-4. Diciembre (verano): UTC-3.
    expect(instanteDe("2026-07-15", "08:00", CL).toISOString()).toBe(
      "2026-07-15T12:00:00.000Z",
    );
    expect(instanteDe("2026-12-15", "08:00", CL).toISOString()).toBe(
      "2026-12-15T11:00:00.000Z",
    );
  });

  it("DST de Chile: el día del salto, una hora inexistente no revienta ni pierde el día", () => {
    // En el salto de primavera chileno la medianoche 00:00 puede no existir
    // (el reloj salta de 23:59 a 01:00). Sea cual sea el año/fecha exacta del
    // decreto, lo que se fija acá es el CONTRATO: nunca tirar, y devolver un
    // instante cuyo día de pared sea el pedido o el borde inmediato.
    const t = instanteDe("2026-09-06", "00:30", CL);
    expect(Number.isNaN(t.getTime())).toBe(false);
    const clave = claveFechaEnZona(t, CL);
    expect(["2026-09-05", "2026-09-06"]).toContain(clave);
  });
});

describe("aritmética de claves", () => {
  it("suma días cruzando fin de mes y de año", () => {
    expect(sumarDiasAClave("2026-07-27", 5)).toBe("2026-08-01");
    expect(sumarDiasAClave("2026-12-30", 3)).toBe("2027-01-02");
    expect(sumarDiasAClave("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("día de la semana de una fecha calendario", () => {
    expect(diaSemanaDeClave("2026-07-26")).toBe("dom");
    expect(diaSemanaDeClave("2026-07-27")).toBe("lun");
    expect(diaSemanaDeClave("2026-08-01")).toBe("sab");
  });
});
