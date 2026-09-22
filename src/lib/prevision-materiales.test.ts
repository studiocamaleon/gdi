import { describe, expect, it } from "vitest";
import {
  condicionarPorMateriales,
  solicitudPrevisionMateriales,
  type PrevisionMateriales,
} from "./prevision-materiales";
import { estimarDemoraNuevos, type ItemHipotetico } from "./flujo-produccion";
import { fechaRecomendadaEta } from "./eta-fechas";
import type { Estacion } from "./estaciones";
const nuevo: ItemHipotetico = {
  id: "nuevo",
  pasos: [
    {
      clave: "imprimir",
      familiaCodigo: "impresion",
      centroCostoId: null,
      duracionMin: 60,
      predecesoras: [],
    },
  ],
};
const data = (
  extra: Partial<PrevisionMateriales> = {},
): PrevisionMateriales => ({
  estado: "requiere_compra",
  modoReserva: "AL_EMITIR",
  calculadoEl: "",
  fechaPedidoSupuesto: "2026-09-18",
  zona: "America/Argentina/Buenos_Aires",
  disponibleDesde: "2026-09-18",
  pendientes: 0,
  materiales: [],
  ...extra,
});
const estacion: Estacion = {
  id: "laser",
  nombre: "Láser",
  descripcion: "",
  activo: true,
  etapa: "impresion",
  icono: null,
  capacidadConcurrente: 1,
  tiempoPreparacionMin: null,
  familias: ["impresion"],
  empleados: [],
  maquinas: [],
  createdAt: "",
  updatedAt: "",
  calendario: {
    dias: {
      lun: [{ desde: "08:00", hasta: "17:00" }],
      mar: [{ desde: "08:00", hasta: "17:00" }],
      mie: [{ desde: "08:00", hasta: "17:00" }],
      jue: [{ desde: "08:00", hasta: "17:00" }],
      vie: [{ desde: "08:00", hasta: "17:00" }],
      sab: null,
      dom: null,
    },
  },
};
const simular = (n: ItemHipotetico) =>
  estimarDemoraNuevos({
    nuevos: [n],
    enCola: [],
    estaciones: [estacion],
    medianas: new Map(),
    ahora: new Date("2026-09-18T11:00:00Z"),
  }).get("nuevo");
describe("Entrega prevista durante la cotización", () => {
  it("espera los materiales y luego respeta el calendario de producción", () => {
    expect(fechaRecomendadaEta(simular(nuevo))).toBe("2026-09-18");
    // Recibir un viernes no promete producir sábado: empieza el lunes a las 8 del taller.
    const eta = simular(condicionarPorMateriales(nuevo, data()));
    expect(eta?.finEstimado?.toISOString()).toBe("2026-09-21T12:00:00.000Z");
    expect(fechaRecomendadaEta(eta, { margenDias: 1 })).toBe("2026-09-22");
  });
  it("no conserva una ETA inventada al consultar, fallar o carecer de plazo", () => {
    for (const p of [
      null,
      data({ estado: "por_confirmar", disponibleDesde: null }),
    ]) {
      expect(
        fechaRecomendadaEta(simular(condicionarPorMateriales(nuevo, p))),
      ).toBeNull();
    }
    expect(
      condicionarPorMateriales(nuevo, null, "Sin conexión").motivoSinEstimar,
    ).toBe("Sin conexión");
  });
  it("stock suficiente o control desactivado conserva la estimación de producción", () => {
    for (const estado of ["disponible", "sin_control", "no_incluido"] as const)
      expect(condicionarPorMateriales(nuevo, data({ estado }))).toBe(nuevo);
  });
  it("envía sólo cantidades físicas agregadas, sin la traza ni los precios", () => {
    const material = {
      materialVarianteId: "papel",
      materialDisplayName: "Obra",
      tipoLineaCosto: "MATERIAL",
      cantidad: 5,
      unidad: "hoja",
      precio: 100,
      contextoUnidadesSnapshot: { unidadStock: "HOJA", unidadCompra: "HOJA" },
    };
    const items = [1, 2].map((n) => ({
      id: String(n),
      productoNombre: "Trabajo",
      cotizacion: {
        pasos: [{ rutaPasoId: "imprimir", materiales: [material] }],
      },
    }));
    expect(solicitudPrevisionMateriales(items as never)).toEqual({
      materiales: [
        {
          varianteId: "papel",
          cantidad: 10,
          unidad: "hoja",
          consumible: false,
        },
      ],
      pendientes: 0,
    });
  });
});
