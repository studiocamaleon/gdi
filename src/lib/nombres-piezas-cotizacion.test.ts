import { describe, expect, it } from "vitest";
import {
  actualizarNombresPiezasCotizadas,
  claveCalculoPiezas,
  completarNombresPiezas,
} from "./nombres-piezas-cotizacion";
import type { PiezaVectorialCotizacion } from "./piezas-vectoriales-cotizacion";

const pieza: PiezaVectorialCotizacion = {
  id: "letras-1",
  nombre: "Letras 1",
  cantidadPorUnidad: 2,
  fuente: {
    schemaVersion: 1,
    nombreArchivo: "letras.svg",
    anchoFinalMm: 100,
    altoFinalMm: 200,
    svg: '<svg viewBox="0 0 100 200"><path d="M0 0H100V200H0Z"/></svg>',
  },
};
const configuracion = {
  cantidad: 3,
  seleccionMaterial: { corte: "acrilico" },
  disenosVectoriales: [pieza],
  coleccionesVectoriales: { frente: [pieza] },
};

describe("renombrar piezas sin volver a cotizar", () => {
  it("mantiene la clave al escribir o vaciar nombres, en simples y heredados", () => {
    for (const nombre of ["S", "Texto nuevo", ""]) {
      const renombrada = { ...pieza, nombre };
      expect(
        claveCalculoPiezas({
          ...configuracion,
          disenosVectoriales: [renombrada],
          coleccionesVectoriales: { frente: [renombrada] },
        }),
      ).toBe(claveCalculoPiezas(configuracion));
    }
  });

  it("invalida por archivo, escala, capas, cantidad, material y piezas agregadas", () => {
    const cambios = [
      { ...pieza, cantidadPorUnidad: 3 },
      { ...pieza, fuente: { ...pieza.fuente, svg: "otro SVG" } },
      { ...pieza, fuente: { ...pieza.fuente, anchoFinalMm: 101 } },
      { ...pieza, fuente: { ...pieza.fuente, operaciones: [] } },
    ];
    for (const cambio of cambios) {
      expect(
        claveCalculoPiezas({ ...configuracion, disenosVectoriales: [cambio] }),
      ).not.toBe(claveCalculoPiezas(configuracion));
      expect(
        claveCalculoPiezas({
          ...configuracion,
          coleccionesVectoriales: { frente: [cambio] },
        }),
      ).not.toBe(claveCalculoPiezas(configuracion));
    }
    for (const cambio of [
      { ...configuracion, cantidad: 4 },
      { ...configuracion, seleccionMaterial: { corte: "polyfan" } },
      {
        ...configuracion,
        disenosVectoriales: [pieza, { ...pieza, id: "otra" }],
      },
      { ...configuracion, disenosVectoriales: [] },
    ])
      expect(claveCalculoPiezas(cambio)).not.toBe(
        claveCalculoPiezas(configuracion),
      );
  });

  it("usa una etiqueta temporal al calcular mientras se escribe, sin alterar el formulario", () => {
    const vacia = { ...pieza, nombre: "" };
    const config = {
      ...configuracion,
      disenosVectoriales: [vacia],
      coleccionesVectoriales: { frente: [vacia] },
    };
    const calculable = completarNombresPiezas(config);
    expect(calculable.disenosVectoriales[0].nombre).toBe(pieza.id);
    expect(calculable.coleccionesVectoriales.frente[0].nombre).toBe(pieza.id);
    expect(vacia.nombre).toBe("");
  });

  it("actualiza el nombre del ítem y ambos materiales sin cambiar posiciones, costos ni la solución", () => {
    const contornos = [
      {
        puntos: [
          { x: 0, y: 0 },
          { x: 100, y: 200 },
        ],
      },
    ];
    const solucionNesting = {
      problemaHash: "original",
      problema: {
        demandas: [
          { id: "letras-1__0", propietario: { piezaNombre: pieza.nombre } },
        ],
      },
    };
    const nestingResult = {
      solucionNesting,
      placements: [
        {
          pieceId: "letras-1__0",
          xMm: 42,
          yMm: 18,
          rotated: true,
          meta: {
            label: pieza.nombre,
            propietario: { piezaNombre: pieza.nombre },
            contornos,
          },
        },
      ],
    };
    const costo = { total: 150 };
    const resultado = {
      cotizacion: {
        costo,
        componentesFabricados: ["Polyfan", "Acrílico"].map((nombre) => ({
          nombre,
          jobContext: { disenosVectoriales: [pieza] },
          pasos: [{ nestingResult }],
        })),
      },
    };
    const renombrada = { ...pieza, nombre: "Logo S" };
    // También cubre una respuesta que llegó después de editar el nombre.
    const nuevo = actualizarNombresPiezasCotizadas(resultado, {
      disenosVectoriales: null,
      coleccionesVectoriales: { frente: [renombrada] },
    });
    expect(nuevo.cotizacion.costo).toBe(costo);
    for (const c of nuevo.cotizacion.componentesFabricados) {
      expect(c.jobContext.disenosVectoriales[0].nombre).toBe("Logo S");
      const n = c.pasos[0].nestingResult;
      expect(n.solucionNesting).toBe(solucionNesting);
      expect(n.placements[0]).toMatchObject({
        xMm: 42,
        yMm: 18,
        rotated: true,
        meta: { label: "Logo S", propietario: { piezaNombre: "Logo S" } },
      });
      expect(n.placements[0].meta.contornos).toBe(contornos);
    }
    expect(
      resultado.cotizacion.componentesFabricados[0].jobContext
        .disenosVectoriales[0].nombre,
    ).toBe("Letras 1");
  });

  it("no renombra otra pieza ni una identidad ambigua de otro componente", () => {
    const resultado = {
      placements: [
        { pieceId: "otra__0", meta: { label: "Otra" } },
        { pieceId: "letras-1__0", meta: { label: "Letras 1" } },
      ],
    };
    expect(
      actualizarNombresPiezasCotizadas(resultado, {
        disenosVectoriales: [{ ...pieza, nombre: "Uno" }],
        coleccionesVectoriales: { frente: [{ ...pieza, nombre: "Dos" }] },
      }),
    ).toBe(resultado);
  });
});
