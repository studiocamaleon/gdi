import { describe, expect, it } from "vitest";
import * as web from "./zona";
import * as api from "../../apps/api/src/common/zona";

for (const [nombre, zona] of [
  ["web", web],
  ["api", api],
] as const)
  describe(nombre, () => {
    it("reutilizar fechas no comparte objetos mutables entre consumidores", () => {
      const d = zona.instanteDe("2026-09-14", "09:00", "America/Lima");
      d.setFullYear(1990);
      expect(
        zona.instanteDe("2026-09-14", "09:00", "America/Lima").toISOString(),
      ).toBe("2026-09-14T14:00:00.000Z");
      const instante = new Date("2026-09-14T14:00:00Z");
      const p = zona.partesEnZona(instante, "America/Lima");
      p.hh = 23;
      expect(zona.partesEnZona(instante, "America/Lima").hh).toBe(9);
    });
    it("alternar zonas y transiciones horarias conserva las partes de Intl", () => {
      for (const lugar of [
        "America/Santiago",
        "America/New_York",
        "Europe/Madrid",
        "Asia/Kathmandu",
        "America/Argentina/Buenos_Aires",
      ]) {
        const formato = new Intl.DateTimeFormat("en-GB", {
          timeZone: lugar,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        for (let i = 0; i < 370; i++) {
          const instante = new Date(Date.UTC(2026, 0, 1 + i, 3, 30));
          const p = Object.fromEntries(
            formato.formatToParts(instante).map((v) => [v.type, v.value]),
          );
          expect(zona.partesEnZona(instante, lugar)).toEqual({
            y: +p.year,
            m: +p.month,
            d: +p.day,
            hh: +p.hour % 24,
            mm: +p.minute,
          });
        }
      }
    });
  });
