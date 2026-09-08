import { describe, expect, it } from "vitest";

import type { TableroItemData } from "@/lib/tablero-produccion";
import { construirMomentosWorkflowOrden } from "@/lib/workflow-orden";

function item(
  id: string,
  itemIndice: number,
  pasos: Array<{
    id: string;
    predecesorPasoIds?: string[];
    indice?: number;
    estado?: "pendiente" | "en_curso" | "pausado" | "hecho" | "bloqueado";
  }>,
  parentItemId: string | null = null,
): TableroItemData {
  return {
    id,
    parentItemId,
    ordenId: "ot",
    ordenNumero: "OT-1",
    ordenEstado: "PRODUCCION",
    itemIndice,
    codigo: id,
    nombre: id,
    clienteNombre: "Cliente",
    vendedorNombre: "Vendedor",
    cantidad: 1,
    cantidadUnidad: "u.",
    specs: [],
    fechaEntrega: null,
    archivosCount: 0,
    sinRuta: false,
    pasos: pasos.map((paso, index) => ({
      id: paso.id,
      indice: paso.indice ?? index,
      predecesorPasoIds: paso.predecesorPasoIds ?? [],
      rutaPasoId: paso.id,
      nombre: paso.id,
      familiaCodigo: "manual",
      categoriaFamilia: "manual",
      centroCostoId: null,
      centroCostoNombre: null,
      duracionEstimadaMin: 1,
      estado: paso.estado ?? "pendiente",
      motivoBloqueo: null,
      iniciadoEl: null,
      completadoEl: null,
      modoRegistro: "solo_completar",
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
    })),
  };
}

describe("construirMomentosWorkflowOrden", () => {
  it("mantiene cada componente como una subruta agregada del DAG padre", () => {
    const items = [
      item("padre", 0, [
        { id: "ensamble", predecesorPasoIds: ["lona", "bastidor"] },
        { id: "control", predecesorPasoIds: ["ensamble"] },
      ]),
      item("hijo-lona", 1, [{ id: "lona" }], "padre"),
      item("hijo-bastidor", 2, [{ id: "bastidor" }], "padre"),
    ];

    const momentos = construirMomentosWorkflowOrden(items, "padre");

    expect(
      momentos.map((momento) => momento.nodos.map((nodo) => nodo.id)),
    ).toEqual([
      ["componente:hijo-lona", "componente:hijo-bastidor"],
      ["ensamble"],
      ["control"],
    ]);
    expect(momentos[0].nodos.map((nodo) => nodo.tipo)).toEqual([
      "COMPONENTE",
      "COMPONENTE",
    ]);
  });

  it("conserva la secuencia por índice en snapshots anteriores al DAG", () => {
    const momentos = construirMomentosWorkflowOrden(
      [item("producto-a", 0, [{ id: "a1" }, { id: "a2" }])],
      "producto-a",
    );

    expect(
      momentos.map((momento) => momento.nodos.map((nodo) => nodo.id)),
    ).toEqual([["a1"], ["a2"]]);
  });

  it("no promueve los pasos internos de un componente a la ruta padre", () => {
    const items = [
      item("padre", 0, [{ id: "ensamble", predecesorPasoIds: ["corte"] }]),
      item(
        "hijo",
        1,
        [
          { id: "impresion" },
          { id: "corte", predecesorPasoIds: ["impresion"] },
        ],
        "padre",
      ),
    ];

    const momentos = construirMomentosWorkflowOrden(items, "padre");
    expect(
      momentos.flatMap((momento) => momento.nodos).map((nodo) => nodo.id),
    ).toEqual(["componente:hijo", "ensamble"]);
  });

  it("permite abrir la subruta real del componente sin mezclarla con el padre", () => {
    const items = [
      item("padre", 0, [{ id: "ensamble", predecesorPasoIds: ["corte"] }]),
      item(
        "hijo",
        1,
        [
          { id: "impresion" },
          { id: "corte", predecesorPasoIds: ["impresion"] },
        ],
        "padre",
      ),
    ];

    const subruta = construirMomentosWorkflowOrden(items, "hijo");

    expect(
      subruta.map((momento) => momento.nodos.map((nodo) => nodo.id)),
    ).toEqual([["impresion"], ["corte"]]);
  });

  it("calcula el avance agregado que debe mostrar cada rama", () => {
    const items = [
      item("padre", 0, [{ id: "ensamble", predecesorPasoIds: ["corte"] }]),
      item(
        "hijo",
        1,
        [
          { id: "impresion", estado: "hecho" },
          {
            id: "corte",
            estado: "pendiente",
            predecesorPasoIds: ["impresion"],
          },
        ],
        "padre",
      ),
    ];

    const componente = construirMomentosWorkflowOrden(items, "padre")
      .flatMap((momento) => momento.nodos)
      .find((nodo) => nodo.tipo === "COMPONENTE");

    expect(componente?.progreso).toEqual({ completos: 1, total: 2 });
  });
});
