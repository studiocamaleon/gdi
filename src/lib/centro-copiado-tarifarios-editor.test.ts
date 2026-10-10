import { describe, expect, it } from "vitest";
import { configTarifarios as config } from "./__fixtures__/tarifarios";
import {
  ajustarPrecio,
  cadInicial,
  cambiarCobertura,
  contenidoInicial,
  decimalEditor,
  fechaProgramada,
  filasCad,
  filasOferta,
  leerRangos,
  normalizarContenido,
  pegarPrecios,
  preciosConRangos,
  resumenCeldas,
  sumarFilas,
} from "./centro-copiado-tarifarios-editor";
import type { PerfilCadCopiado } from "./centro-copiado-cad";
import { todasLasPaginas } from "./centro-copiado-tarifarios-api";

it("usa la oferta por papel y gramaje, la intersección de formatos y las dos caras", () => {
  const c = structuredClone(config);
  c.papeles = [
    {
      materiaPrimaId: c.disponibles.papeles[0].materiaPrimaId,
      formatosPorGramaje: [
        { gramaje: 80, tamanos: ["A3"] },
        { gramaje: 150, tamanos: ["A4", "A3"] },
      ],
    },
  ];
  const filas = filasOferta(c, contenidoInicial("ARS").hojas!);
  expect(filas).toHaveLength(8);
  expect(
    filas
      .filter((f) => f.combinacion.gramaje === 150)
      .every((f) => f.combinacion.tamano === "A4"),
  ).toBe(true);
  expect(new Set(filas.map((f) => f.combinacion.faz))).toEqual(new Set([1, 2]));
  c.papeles[0].formatosPorGramaje = [];
  expect(filasOferta(c, contenidoInicial("ARS").hojas!)).toEqual([]);
  c.papeles = null;
  c.tamanos = [];
  expect(filasOferta(c, contenidoInicial("ARS").hojas!)).toEqual([]);
});
it("agrega combinaciones sin pisar precios, ni rangos propios, ni mezclar coberturas", () => {
  const c = contenidoInicial("ARS");
  c.hojas!.reglas.cobertura = "DIFERENCIADA";
  const filas = filasOferta(config, c.hojas!);
  expect(filas).toHaveLength(36);
  filas[0].precios[0].precioUnitario = "0";
  filas[0].rangosPropios = [1, 20];
  const combinadas = sumarFilas(
    filas.slice(0, 1),
    filasOferta(config, c.hojas!),
  );
  expect(combinadas[0]).toEqual(filas[0]);
  expect(combinadas).toHaveLength(36);
});
it("CAD deduplica perfiles equivalentes y conserva anchos y modos productivos", () => {
  const perfil = {
    papelMateriaPrimaId: "papel",
    gramaje: 80,
    color: "BN",
    rollo: { anchoRolloMm: 914, margenMm: 10 },
  } as PerfilCadCopiado;
  const filas = filasCad(
    [
      perfil,
      { ...perfil },
      { ...perfil, color: "COLOR" },
      { ...perfil, rollo: { anchoRolloMm: 610, margenMm: 10 } },
    ],
    cadInicial("UNICA"),
  );
  expect(filas).toHaveLength(3);
  expect(
    filas.every((f) => f.precios.every((p) => p.precioUnitario === null)),
  ).toBe(true);
});
it("cambiar cobertura reinicia precios y excepciones en ambas matrices", () => {
  const c = contenidoInicial("ARS");
  c.hojas!.filas = filasOferta(config, c.hojas!).slice(0, 1);
  c.hojas!.filas[0].precios[0].precioUnitario = "100";
  c.hojas!.filas[0].rangosPropios = [1, 20];
  c.cad = cadInicial("UNICA");
  const n = cambiarCobertura(c, "DIFERENCIADA");
  expect(n.hojas!.filas).toHaveLength(3);
  expect(
    n.hojas!.filas.every(
      (f) =>
        !f.rangosPropios && f.precios.every((p) => p.precioUnitario === null),
    ),
  ).toBe(true);
  expect(n.cad!.reglas.cobertura).toBe("DIFERENCIADA");
  expect(c.hojas!.filas[0].precios[0].precioUnitario).toBe("100");
  expect(cambiarCobertura(n, "UNICA").hojas!.filas).toHaveLength(1);
});
describe("decimales y tramos exactos", () => {
  it.each([
    ["", null],
    ["  ", null],
    ["0", "0"],
    ["00100,50", "100.5"],
    ["999999999999999999.12345678", "999999999999999999.12345678"],
  ])("normaliza %s sin coma flotante", (entrada, salida) =>
    expect(decimalEditor(entrada!)).toBe(salida),
  );
  it.each(["1.000,5", "1e3", "-1", "NaN", "2,3,4", "2.123456789"])(
    "rechaza %s",
    (v) => expect(() => decimalEditor(v)).toThrow(),
  );
  it("interpreta cantidades enteras o ML exactos", () => {
    expect(leerRangos("1;100;500", false)).toEqual([1, 100, 500]);
    expect(leerRangos("0;0,000000000001;12.5", true)).toEqual([
      "0",
      "0.000000000001",
      "12.5",
    ]);
  });
  it.each(["0;100", "1;1", "1;1,5", "1;", "1;9007199254740992"])(
    "rechaza rangos hojas %s",
    (v) => expect(() => leerRangos(v, false)).toThrow(),
  );
  it("preserva precios de tramos retenidos y distingue pendiente de cero", () => {
    const f = filasOferta(config, contenidoInicial("ARS").hojas!)[0];
    f.precios[0].precioUnitario = "0";
    f.precios[1].precioUnitario = "100.50";
    expect(preciosConRangos(f, [1, 50, 100])).toEqual([
      { desdeCantidad: 1, precioUnitario: "0" },
      { desdeCantidad: 50, precioUnitario: null },
      { desdeCantidad: 100, precioUnitario: "100.50" },
    ]);
  });
  it("no pierde un precio CAD al recibir otra escritura decimal del mismo inicio", () => {
    const m = cadInicial("UNICA");
    m.filas = [
      {
        combinacion: {
          papelMateriaPrimaId: "p",
          gramaje: null,
          color: "BN",
          cobertura: null,
          anchoRolloMm: 914,
        },
        precios: [{ desdeCantidad: "0.00", precioUnitario: "0" }],
      },
    ];
    expect(preciosConRangos(m.filas[0], ["0"])[0].precioUnitario).toBe("0");
  });
});
it("normaliza importes antes de guardar sin mutar y rechaza cargos vacíos", () => {
  const c = contenidoInicial("ARS");
  c.hojas!.filas = filasOferta(config, c.hojas!).slice(0, 1);
  c.hojas!.filas[0].precios[0].precioUnitario = "999999999999999999,12345678";
  const n = normalizarContenido(c);
  expect(n.hojas!.filas[0].precios[0].precioUnitario).toBe(
    "999999999999999999.12345678",
  );
  expect(resumenCeldas(n)).toEqual({ total: 3, pendientes: 2 });
  c.composicion.preparacion = { modalidad: "FIJA_PEDIDO", importe: "" };
  expect(() => normalizarContenido(c)).toThrow("Completá");
});
it("pega un rectángulo atómicamente y rechaza desbordes o importes inválidos", () => {
  const c = contenidoInicial("ARS");
  const f = filasOferta(config, c.hojas!);
  const p = pegarPrecios("100,5\t0\n\t250\n", f, [0, 1], 0, 0, [1, 100, 500]);
  expect(p.map((x) => x.despues)).toEqual(["100.5", "0", null, "250"]);
  expect(() => pegarPrecios("100\tmal", f, [0], 0, 0, [1, 100, 500])).toThrow();
  expect(() => pegarPrecios("1\n2", f, [0], 0, 0, [1])).toThrow();
  expect(f[0].precios[0].precioUnitario).toBeNull();
});
it("ajusta porcentajes e importes exactamente con redondeo opcional", () => {
  expect(ajustarPrecio("100.50", "PORCENTAJE", "10", "")).toBe("110.55");
  expect(ajustarPrecio("0.1", "IMPORTE", "0.2", "")).toBe("0.3");
  expect(ajustarPrecio("100", "PORCENTAJE", "-10", "5")).toBe("90");
  expect(ajustarPrecio("100.50", "PORCENTAJE", "10", "10")).toBe("120");
  expect(ajustarPrecio("0.00000001", "PORCENTAJE", "50", "")).toBe(
    "0.00000002",
  );
  expect(() => ajustarPrecio("1", "IMPORTE", "-2", "")).toThrow("negativo");
  expect(() => ajustarPrecio("1", "IMPORTE", "1", "0")).toThrow();
});
it("programa en la zona del tenant, rechazando horas pasadas, inexistentes y ambiguas", () => {
  const ahora = new Date("2026-01-01Z");
  expect(
    fechaProgramada(
      "2026-12-10T10:30",
      "America/Argentina/Buenos_Aires",
      ahora,
    ),
  ).toBe("2026-12-10T13:30:00.000Z");
  expect(() =>
    fechaProgramada("2026-03-08T02:30", "America/New_York", ahora),
  ).toThrow("no existe");
  expect(() =>
    fechaProgramada("2026-11-01T01:30", "America/New_York", ahora),
  ).toThrow("se repite");
  expect(() => fechaProgramada("2025-12-01T10:00", "UTC", ahora)).toThrow(
    "futuro",
  );
  expect(() => fechaProgramada("2026-02-30T10:00", "UTC", ahora)).toThrow(
    "válidas",
  );
});
it("recorre todas las páginas del catálogo y detecta cursores inválidos", async () => {
  expect(
    await todasLasPaginas(async (d) =>
      d === 0
        ? { items: ["primero"], siguiente: 50 }
        : { items: ["último"], siguiente: null },
    ),
  ).toEqual(["primero", "último"]);
  await expect(
    todasLasPaginas(async () => ({ items: [], siguiente: 0 })),
  ).rejects.toThrow("listado");
});
