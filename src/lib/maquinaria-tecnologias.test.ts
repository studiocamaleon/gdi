import { describe, expect, it } from "vitest";

import {
  getMachineTechnology,
  machineTechnologyLabel,
  normalizeMachineTechnology,
  technologyCodeLabel,
} from "@/lib/maquinaria-tecnologias";

describe("tecnología de fotoduplicación", () => {
  it("la deriva de la plantilla de duplicadora digital", () => {
    const machine = { plantilla: "DUPLICADORA_DIGITAL" };

    expect(getMachineTechnology(machine)).toBe("fotoduplicacion");
    expect(machineTechnologyLabel(machine)).toBe("Fotoduplicación");
  });

  it("normaliza alias y presenta el código canónico en reportes", () => {
    expect(normalizeMachineTechnology("Fotoduplicación")).toBe(
      "fotoduplicacion",
    );
    expect(normalizeMachineTechnology("duplicadora digital")).toBe(
      "fotoduplicacion",
    );
    expect(technologyCodeLabel("fotoduplicacion")).toBe("Fotoduplicación");
  });
});
