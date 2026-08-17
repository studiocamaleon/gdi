import { describe, expect, it } from "vitest";

import { getPeriodoEnZona } from "@/lib/costos";

describe("getPeriodoEnZona", () => {
  it("respeta el mes del tenant alrededor del cambio de mes UTC", () => {
    const instante = new Date("2026-09-01T01:00:00.000Z");

    expect(getPeriodoEnZona("America/Argentina/Buenos_Aires", instante)).toBe(
      "2026-08",
    );
    expect(getPeriodoEnZona("Asia/Tokyo", instante)).toBe("2026-09");
  });
});
