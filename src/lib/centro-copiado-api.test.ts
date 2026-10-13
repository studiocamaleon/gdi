import { describe, expect, it } from "vitest";
import {
  cantidadLibrosCentroCopiado,
  itemConstruidoAPropuestaItem,
  type ItemConstruido,
  tamanosProducibles,
  type PapelOpcion,
} from "./centro-copiado-api";

describe("formatos ofrecidos por papel y gramaje", () => {
  const papel: PapelOpcion = {
    materiaPrimaId: "papel-ficticio",
    nombre: "Obra",
    gramajes: [80, 150],
    variantes: [80, 150].map((gramajeGr) => ({
      formatoComercial: "A3",
      anchoMm: 297,
      altoMm: 420,
      gramajeGr,
    })),
    formatosPorGramaje: [
      { gramaje: 80, tamanos: ["A4", "A3"] },
      { gramaje: 150, tamanos: ["A4"] },
    ],
  };
  it("cruza formato comercial, gramaje y selección general", () => {
    expect(tamanosProducibles(papel, 150).map((f) => f.nombre)).toEqual(["A4"]);
    expect(tamanosProducibles(papel, 80, ["A3"]).map((f) => f.nombre)).toEqual([
      "A3",
    ]);
    expect(tamanosProducibles(papel, 150, ["A3"])).toEqual([]);
  });
  it("no ofrece tamaños con listas vacías, gramaje inexistente o selección ambigua", () => {
    expect(tamanosProducibles(papel, 80, [])).toEqual([]);
    expect(
      tamanosProducibles({ ...papel, formatosPorGramaje: [] }, 80),
    ).toEqual([]);
    expect(tamanosProducibles(papel, 300)).toEqual([]);
    expect(tamanosProducibles(papel, null)).toEqual([]);
  });
  it("mantiene el catálogo producible cuando no hay configuración nueva", () => {
    expect(
      tamanosProducibles({ ...papel, formatosPorGramaje: null }, 150).map(
        (f) => f.nombre,
      ),
    ).toEqual(expect.arrayContaining(["A4", "A3"]));
  });
});

it("conserva el producto CAD, la ruta y la selección al agregarlo a una OT", () => {
  const jobContext = {
    _centroCopiado: {
      modo: "CAD",
      productoNombre: "Plano CAD impreso",
      productoCodigo: "PLANO-CAD",
      paginas: 2,
      paginasOriginales: 3,
      rangoPaginas: "1-2",
      copias: 2,
      cad: { perfilId: "perfil-color", versionPerfil: 2, versionDestino: 3 },
    },
  };
  const item = itemConstruidoAPropuestaItem({
    documentoId: "doc",
    grupoTomoId: null,
    nombre: "Planos.pdf",
    productoId: "producto-cad",
    jobContext,
    especificaciones: { Escala: "100%" },
    cantidad: 4,
    unidad: "unidad",
    precioUnitario: 100,
    subtotal: 400,
    impuestoPorcentaje: 21,
    impuestoMonto: 84,
    total: 484,
    error: null,
    cotizacion: {
      rutaAlternativaId: "ruta-cad",
    } as ItemConstruido["cotizacion"],
  });
  expect(item).toMatchObject({
    productoNombre: "Plano CAD impreso",
    productoCodigo: "PLANO-CAD",
    motorCodigo: "producto-cad",
    rutaAlternativaId: "ruta-cad",
    cantidad: 4,
    unidadMedida: "unidad",
    precioUnitario: 100,
    total: 484,
    jobContext,
  });
});

describe("cantidadLibrosCentroCopiado", () => {
  it("usa copias para un documento suelto anillado, no sus hojas físicas", () => {
    expect(
      cantidadLibrosCentroCopiado({
        cantidad: 56,
        _centroCopiado: {
          version: 1,
          esTomo: false,
          terminaciones: ["Anillado"],
          copias: 1,
          paginas: 112,
          hojas: 56,
        },
      }),
    ).toBe(1);
  });

  it("usa juegos para un tomo anillado", () => {
    expect(
      cantidadLibrosCentroCopiado({
        _centroCopiado: {
          version: 1,
          esTomo: true,
          terminaciones: ["Anillado"],
          juegos: 3,
          hojas: 168,
        },
      }),
    ).toBe(3);
  });

  it("no interviene en impresiones sin anillado", () => {
    expect(
      cantidadLibrosCentroCopiado({
        _centroCopiado: {
          version: 1,
          esTomo: false,
          terminaciones: [],
          copias: 1,
          hojas: 56,
        },
      }),
    ).toBeNull();
  });
});
