import { describe, expect, it } from "vitest";

import { buildViewModel } from "@/components/produccion/simulador-impresion";
import type {
  SimuladorData,
  SimuladorJob,
} from "@/lib/simulador-impresion-api";

function job(
  pasoId: string,
  varianteId: string,
  compatibilidadClave: string,
): SimuladorJob {
  return {
    pasoId,
    itemId: `item-${pasoId}`,
    ordenId: `orden-${pasoId}`,
    codigo: `OT-${pasoId}`,
    cliente: null,
    producto: "Trabajo",
    fechaEntrega: "2020-01-01",
    tecnologia: "uv",
    materiaPrimaId: "material",
    materiaPrimaNombre: "Vinilo",
    varianteCotizada: {
      id: varianteId,
      sku: varianteId,
      anchoMm: 600,
      precioMl: null,
      compatibilidadClave,
    },
    consumoCotizadoMm: 1000,
    piezas: [{ anchoMm: 100, altoMm: 100, cantidad: 1 }],
    duracionEstimadaMin: 5,
  };
}

describe("view-model del simulador gran formato", () => {
  it("separa colores incompatibles aunque compartan materia prima y ancho", () => {
    const data: SimuladorData = {
      puedeVerImportes: false,
      jobs: [job("a", "blanco-60", "blanco"), job("b", "negro-60", "negro")],
      materiales: [
        {
          materiaPrimaId: "material",
          nombre: "Vinilo",
          anchos: [
            {
              varianteId: "blanco-60",
              sku: "B60",
              anchoMm: 600,
              precioMl: null,
              stockMl: 5,
              compatibilidadClave: "blanco",
            },
            {
              varianteId: "negro-60",
              sku: "N60",
              anchoMm: 600,
              precioMl: null,
              stockMl: 5,
              compatibilidadClave: "negro",
            },
          ],
        },
      ],
    };

    const result = buildViewModel(data);
    expect(result.materials).toHaveLength(2);
    expect(result.materials.map((item) => item.varianteId[60]).sort()).toEqual([
      "blanco-60",
      "negro-60",
    ]);
    expect([...result.jobs.values()].flat()[0].urgencyLabel).toBe("ATRASADA");
  });

  it("elige un único SKU por ancho y no suma stocks", () => {
    const data: SimuladorData = {
      puedeVerImportes: true,
      jobs: [job("a", "rollo-a", "compatible")],
      materiales: [
        {
          materiaPrimaId: "material",
          nombre: "Vinilo",
          anchos: [
            {
              varianteId: "rollo-a",
              sku: "A",
              anchoMm: 600,
              precioMl: 100,
              stockMl: 5,
              compatibilidadClave: "compatible",
            },
            {
              varianteId: "rollo-b",
              sku: "B",
              anchoMm: 600,
              precioMl: 120,
              stockMl: 12,
              compatibilidadClave: "compatible",
            },
          ],
        },
      ],
    };

    const material = buildViewModel(data).materials[0];
    expect(material.rolls).toEqual([60]);
    expect(material.stockMl[60]).toBe(12);
    expect(material.varianteId[60]).toBe("rollo-b");
  });
});
