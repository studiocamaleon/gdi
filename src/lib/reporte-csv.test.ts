import { describe, expect, it } from "vitest";

import { nombreArchivoReporte, serializarCsv } from "./reporte-csv";

describe("exportación CSV de Reportes", () => {
  it("usa punto y coma y escapa texto, comillas y saltos", () => {
    expect(serializarCsv([
      ["Indicador", "Valor"],
      ["Ventas; netas", '10 "mil"'],
      ["Detalle", "línea 1\nlínea 2"],
    ])).toBe(
      'Indicador;Valor\r\n"Ventas; netas";"10 ""mil"""\r\nDetalle;"línea 1\nlínea 2"',
    );
  });

  it("genera un nombre portable y predecible", () => {
    expect(nombreArchivoReporte("Salud del ETA", new Date("2026-08-18T12:00:00Z"))).toBe(
      "reporte-salud-del-eta-2026-08-18.csv",
    );
  });
});
