import { describe, expect, it } from "vitest";

import {
  buildEmpleadosImportTemplateCsv,
  parseEmpleadosImportCsv,
} from "@/lib/empleados-importacion";

describe("importación de empleados", () => {
  it("la plantilla descargada vuelve a importarse sin desalinear columnas", () => {
    const parsed = parseEmpleadosImportCsv(buildEmpleadosImportTemplateCsv());

    expect(parsed.fatalError).toBeUndefined();
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].errors).toEqual([]);
    expect(parsed.rows[0].payload?.direcciones[0]).toMatchObject({
      descripcion: "Principal",
      pais: "AR",
      codigoPostal: "1406",
      direccion: "Av. Rivadavia",
      numero: "1234",
      ciudad: "CABA",
    });
  });

  it("rechaza una comisión incompleta antes de escribir", () => {
    const csv = buildEmpleadosImportTemplateCsv().replace(
      '"","",""',
      '"Venta","porcentaje",""',
    );
    const parsed = parseEmpleadosImportCsv(csv);

    expect(parsed.rows[0].errors.join(" ")).toContain(
      "completá descripción, tipo y valor",
    );
  });
});
