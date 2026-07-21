/**
 * Smoke test de la vista de simulación: que arme los carriles, los bloques
 * y las etiquetas correctas a partir de una traza real del motor.
 *
 * Renderiza a markup estático (sin DOM): alcanza para verificar el armado
 * y para que un crash en el render rompa el build, que es lo que importa.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// next/font es una transformación del compilador de Next: en vitest no existe.
vi.mock("@/lib/fuentes-simulacion", () => ({ fuentesSimulacion: "" }));

import { SimulacionView } from "@/components/produccion/simulacion-view";
import { simularFlujo } from "@/lib/flujo-produccion";
import type { CalendarioEstacion, Estacion } from "@/lib/estaciones";
import type { TableroItemData, TableroPasoData } from "@/lib/tablero-produccion";

const CAL: CalendarioEstacion = {
  dias: {
    lun: { desde: "08:00", hasta: "18:00" },
    mar: { desde: "08:00", hasta: "18:00" },
    mie: { desde: "08:00", hasta: "18:00" },
    jue: { desde: "08:00", hasta: "18:00" },
    vie: { desde: "08:00", hasta: "18:00" },
    sab: null,
    dom: null,
  },
};

const estacion = (id: string, familias: string[], cap = 1): Estacion => ({
  id,
  nombre: id,
  descripcion: "",
  activo: true,
  etapa: "impresion",
  icono: null,
  capacidadConcurrente: cap,
  calendario: CAL,
  familias,
  empleados: [],
  maquinas: [],
  createdAt: "",
  updatedAt: "",
});

const paso = (
  indice: number,
  nombre: string,
  familiaCodigo: string,
  duracionEstimadaMin: number | null,
  extra: Partial<TableroPasoData> = {},
): TableroPasoData => ({
  id: `p${indice}-${nombre}`,
  indice,
  nombre,
  familiaCodigo,
  categoriaFamilia: "",
  centroCostoId: null,
  centroCostoNombre: null,
  duracionEstimadaMin,
  estado: "pendiente",
  motivoBloqueo: null,
  iniciadoEl: null,
  completadoEl: null,
  modoRegistro: "cronometro",
  tiempoRealMin: null,
  tiempoFuente: null,
  iniciadoPorNombre: null,
  completadoPorNombre: null,
  tramoAbierto: null,
  motivoPausa: null,
  tiempoAcumuladoMin: 0,
  mesaEsMia: false,
  mesaUsuarioNombre: null,
  tipoEjecucion: "interno",
  proveedorNombre: null,
  plazoProveedorDias: null,
  estadoCompra: null,
  ...extra,
});

const item = (
  id: string,
  ordenNumero: string,
  nombre: string,
  pasos: TableroPasoData[],
  fechaEntrega: string | null = null,
): TableroItemData => ({
  id,
  ordenId: `o-${id}`,
  ordenNumero,
  ordenEstado: "produccion",
  itemIndice: 0,
  codigo: id,
  nombre,
  clienteNombre: "Imprenta Imagen",
  vendedorNombre: "",
  cantidad: 1,
  cantidadUnidad: "u",
  specs: [],
  fechaEntrega,
  sinRuta: false,
  pasos,
});

function montar(vistaInicial: "mesa" | "proj" = "mesa") {
  const estaciones = [
    estacion("Impresión digital", ["impresion"]),
    estacion("Corte", ["corte"], 2),
  ];
  const items = [
    item("A", "OT-2026-0001", "Tarjetas", [
      paso(0, "Impresion", "impresion", 60),
      paso(1, "Corte", "corte", 30),
    ]),
    item("B", "OT-2026-0002", "Folletos", [
      paso(0, "Impresion", "impresion", 45),
      // Familia sin estación: cae al carril de capacidad infinita.
      paso(1, "Pegado", "trabajo_manual", 20),
    ]),
    item("C", "OT-2026-0003", "Lona", [
      paso(0, "Offset", "impresion", null, {
        tipoEjecucion: "tercerizado",
        plazoProveedorDias: 5,
      }),
    ], "2026-07-21T00:00:00.000Z"),
  ];
  const sim = simularFlujo({
    items,
    estaciones,
    medianas: new Map(),
    ahora: new Date(2026, 6, 20, 8, 0),
    noLaborables: new Set(),
  });
  return {
    sim,
    html: renderToStaticMarkup(
      <SimulacionView
        items={items}
        estaciones={estaciones}
        sim={sim}
        noLaborables={new Set()}
        onOpen={() => {}}
        vistaInicial={vistaInicial}
      />,
    ),
  };
}

describe("SimulacionView", () => {
  it("dibuja un carril por estación con trabajo, incluidos los sintéticos", () => {
    const { html } = montar();

    expect(html).toContain("Impresión digital");
    expect(html).toContain("Corte");
    expect(html).toContain("Sin estación asignada");
    expect(html).toContain("Proveedor externo");
  });

  it("pinta un bloque por cada decisión de la traza", () => {
    const { html, sim } = montar();
    const bloques = html.match(/class="simu-blk/g) ?? [];

    expect(sim.traza.length).toBe(5);
    expect(bloques).toHaveLength(sim.traza.length);
  });

  it("marca el carril sin estación como supuesto", () => {
    const { html } = montar();
    expect(html).toContain("simu-lane-lbl warn");
    expect(html).toContain("sin límite");
  });

  it("declara los puestos reales de cada estación", () => {
    const { html } = montar();
    expect(html).toContain("2 puestos");
    expect(html).toContain("1 puesto ");
  });

  it("resume el plan en el readout", () => {
    const { html } = montar();
    expect(html).toContain("Plan completo");
    expect(html).toContain("5 pasos");
  });

  it("cuenta los items que no llegan a la fecha", () => {
    const { html } = montar();
    // C es tercerizada a 5 días hábiles contra una entrega al día siguiente.
    expect(html).toContain("no llegan");
    expect(html).toMatch(/simu-stat hot[\s\S]*?<div class="k">1<\/div>/);
  });

  it("la proyección por estación agrupa por día y muestra horarios", () => {
    const { html } = montar("proj");

    expect(html).toContain("simu-proj");
    // Separador de día + horario de arranque de un paso concreto.
    expect(html).toContain("simu-dsep");
    expect(html).toMatch(/simu-ptime[\s\S]*?\d{2}:\d{2}/);
    // Los puestos simultáneos se marcan sólo si la estación tiene más de uno.
    expect(html).toContain("simu-otchip");
  });

  it("no rompe cuando no hay nada que simular", () => {
    const sim = simularFlujo({
      items: [],
      estaciones: [],
      medianas: new Map(),
      ahora: new Date(2026, 6, 20, 8, 0),
    });
    const html = renderToStaticMarkup(
      <SimulacionView
        items={[]}
        estaciones={[]}
        sim={sim}
        noLaborables={new Set()}
        onOpen={() => {}}
      />,
    );
    expect(html).toContain("No hay nada que simular");
  });
});
