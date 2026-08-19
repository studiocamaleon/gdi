import { describe, expect, it } from "vitest";

import { buildLaserBatches } from "@/components/produccion/simulador-laser";
import type { LaserJob } from "@/lib/simulador-laser-api";

function job(
  pasoId: string,
  varianteId: string | null,
  compatibilidadKey: string | null,
  faltantesCompatibilidad: string[] = [],
): LaserJob {
  return {
    pasoId,
    itemId: `item-${pasoId}`,
    ordenId: `orden-${pasoId}`,
    codigo: `OT-2026-${pasoId} · A`,
    cliente: null,
    producto: "Impresión por hoja",
    fechaEntrega: "2026-08-18",
    estado: "pendiente",
    iniciadoEl: null,
    duracionEstimadaMin: 2,
    centroCostoId: "laser",
    centroCostoNombre: "Impresión láser",
    configPasoId: "config",
    maquinaId: "ricoh",
    maquinaNombre: "Ricoh 9003",
    papel: {
      materiaPrimaId: "papel-obra",
      varianteId,
      nombre: "Papel obra",
      gramaje: 75,
    },
    pliego: { preset: "A4", anchoMm: 210, altoMm: 297 },
    hojas: 10,
    clics: 10,
    caras: 1,
    modoColor: "BN",
    acabados: [],
    compatibilidadKey,
    faltantesCompatibilidad,
  };
}

describe("tandas del simulador láser", () => {
  it("agrupa únicamente cuando el servidor confirma la misma compatibilidad", () => {
    const batches = buildLaserBatches([
      job("a", "obra-75-a4", "clave-segura"),
      job("b", "obra-75-a4", "clave-segura"),
    ]);

    expect(batches).toHaveLength(1);
    expect(batches[0].jobs).toHaveLength(2);
    expect(batches[0].puedeCompletar).toBe(true);
  });

  it("no mezcla variantes distintas aunque compartan nombre y gramaje", () => {
    const batches = buildLaserBatches([
      job("a", "obra-mate", "clave-mate"),
      job("b", "obra-satinado", "clave-satinado"),
    ]);

    expect(batches).toHaveLength(2);
  });

  it("aísla cada trabajo incompleto y bloquea su acción masiva", () => {
    const batches = buildLaserBatches([
      job("a", null, null, ["variante de papel"]),
      job("b", null, null, ["variante de papel"]),
    ]);

    expect(batches).toHaveLength(2);
    expect(batches.every((batch) => !batch.puedeCompletar)).toBe(true);
    expect(batches.every((batch) => batch.jobs.length === 1)).toBe(true);
  });
});
