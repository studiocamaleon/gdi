import { describe, expect, it } from "vitest";

import { cuilDesdeDocumento, parsearDniArgentino } from "@/lib/dni-argentino";

/**
 * Todos los documentos de acá son INVENTADOS. Un DNI real es un dato
 * personal (ley 25.326) y no tiene por qué vivir en el repo.
 */
describe("parsearDniArgentino", () => {
  it("lee el formato actual, con número de trámite y comillas", () => {
    const d = parsearDniArgentino(
      '00123456789"PEREZ"JUAN CARLOS"M"11222333"A"05-09-1988"20-03-2016"310',
    );
    expect(d).not.toBeNull();
    expect(d!.apellido).toBe("Perez");
    expect(d!.nombres).toBe("Juan Carlos");
    expect(d!.nombreCompleto).toBe("Perez, Juan Carlos");
    expect(d!.documento).toBe("11222333");
    expect(d!.sexo).toBe("M");
    expect(d!.fechaNacimiento).toBe("1988-09-05");
  });

  it("lee el formato anterior, separado por arrobas", () => {
    const d = parsearDniArgentino(
      "@GONZALEZ@MARIA LAURA@F@22333444@A@14/02/1979@01/06/2013@",
    );
    expect(d!.nombreCompleto).toBe("Gonzalez, Maria Laura");
    expect(d!.documento).toBe("22333444");
    expect(d!.sexo).toBe("F");
    expect(d!.fechaNacimiento).toBe("1979-02-14");
  });

  it("respeta las preposiciones al capitalizar", () => {
    const d = parsearDniArgentino(
      '00123456789"DE LA TORRE"ANA"F"12345678"A"01-01-1990"01-01-2015"000',
    );
    expect(d!.apellido).toBe("De la Torre");
  });

  it("descarta lo que no es un documento", () => {
    for (const basura of [
      "",
      "OT-2026-0009",
      "SORTEO2026",
      'algo"corto"3',
      '00123"PEREZ"JUAN"M"123"A"01-01-1990"01-01-2015', // documento muy corto
    ]) {
      expect(parsearDniArgentino(basura)).toBeNull();
    }
  });

  it("tolera un sexo que no reconoce sin perder el resto", () => {
    const d = parsearDniArgentino(
      '00123456789"LOPEZ"SOL"?"33444555"A"01-01-1990"01-01-2015"000',
    );
    expect(d!.documento).toBe("33444555");
    expect(d!.sexo).toBeNull();
  });

  it("una fecha inválida no rompe el parseo", () => {
    const d = parsearDniArgentino(
      '00123456789"RUIZ"PABLO"M"12345678"A"99-99-9999"01-01-2015"000',
    );
    expect(d!.documento).toBe("12345678");
    expect(d!.fechaNacimiento).toBeNull();
  });
});

describe("cuilDesdeDocumento", () => {
  it("calcula el verificador de un CUIL masculino y uno femenino", () => {
    // Verificados a mano con el módulo 11 de ARCA.
    expect(cuilDesdeDocumento("12345678", "M")).toBe("20123456786");
    expect(cuilDesdeDocumento("22333444", "F")).toBe("27223334445");
    expect(cuilDesdeDocumento("30111222", "F")).toBe("27301112225");
  });

  it("usa el prefijo 23 cuando el verificador daría 10", () => {
    // 20-11222333 da resto 1 → verificador 10, que no es un dígito: ARCA
    // reasigna estos casos al 23 y recalcula.
    expect(cuilDesdeDocumento("11222333", "M")).toBe("23112223339");
  });

  it("el CUIL siempre tiene 11 dígitos y arranca con un prefijo válido", () => {
    for (const dni of ["7654321", "12345678", "40111222", "33444555"]) {
      for (const sexo of ["M", "F"] as const) {
        const cuil = cuilDesdeDocumento(dni, sexo);
        expect(cuil).toMatch(/^(20|23|27)\d{9}$/);
      }
    }
  });

  it("sin sexo no inventa un número: en un comprobante sería peor", () => {
    expect(cuilDesdeDocumento("12345678", null)).toBeNull();
    expect(cuilDesdeDocumento("12345678", "X")).toBeNull();
  });

  it("descarta documentos de largo imposible", () => {
    expect(cuilDesdeDocumento("123", "M")).toBeNull();
    expect(cuilDesdeDocumento("1234567890", "M")).toBeNull();
  });
});
