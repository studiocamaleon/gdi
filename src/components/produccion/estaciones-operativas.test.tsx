import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EstacionesOperativas } from "./estaciones-operativas";
import { StationDetail } from "./estacion-tareas";
import { buildItemView } from "@/lib/produccion-item-view";
import { calendarioDefault, type Estacion } from "@/lib/estaciones";
import type { TableroItemData } from "@/lib/tablero-produccion";
const estacion: Estacion = {
  id: "manual",
  nombre: "Estación vacía QA",
  descripcion: "",
  activo: true,
  etapa: "preprensa",
  icono: "Tool",
  capacidadConcurrente: 1,
  tiempoPreparacionMin: null,
  calendario: calendarioDefault(),
  familias: ["manual"],
  empleados: [],
  maquinas: [],
  createdAt: "",
  updatedAt: "",
};
const base = {
  items: [],
  estaciones: [estacion],
  medianas: new Map<string, number>(),
  noLaborables: new Set<string>(),
  llegadasHoyMin: new Map<string, number>(),
  canManage: false,
  estacionIdsEjecutables: [],
  onMesa: () => {},
  onOpen: () => {},
};
const tarea = buildItemView(
  {
    id: "item",
    ordenId: "ot",
    ordenNumero: "OT-2026-0001",
    ordenEstado: "PENDIENTE",
    archivosCount: 0,
    itemIndice: 0,
    nombre: "Trabajo manual",
    codigo: "P1",
    clienteNombre: "Cliente QA",
    vendedorNombre: "Vendedor QA",
    cantidad: 1,
    cantidadUnidad: "u.",
    fechaEntrega: null,
    specs: [],
    pasos: [
      {
        id: "paso",
        indice: 0,
        nombre: "Embalaje",
        familiaCodigo: "manual",
        estado: "pendiente",
        tipoEjecucion: "interno",
        duracionEstimadaMin: 10,
        mesaEsMia: false,
        rutaPasoId: null,
        categoriaFamilia: "preprensa",
        centroCostoId: null,
        centroCostoNombre: null,
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
        mesaUsuarioNombre: null,
        proveedorNombre: null,
        plazoProveedorDias: null,
        estadoCompra: null,
      },
    ],
    sinRuta: false,
  } as TableroItemData,
  [estacion],
);
describe("presentación operativa de Estaciones", () => {
  it("permite abrir una estación aun cuando no hay órdenes en producción", () => {
    expect(renderToStaticMarkup(<EstacionesOperativas {...base} />)).toContain(
      "Ver tareas de Estación vacía QA",
    );
  });
  it("reserva la configuración a quien recibe la acción autorizada", () => {
    expect(
      renderToStaticMarkup(<EstacionesOperativas {...base} />),
    ).not.toContain("Configurar Estación vacía QA");
    expect(
      renderToStaticMarkup(
        <EstacionesOperativas {...base} onConfigure={() => {}} />,
      ),
    ).toContain("Configurar Estación vacía QA");
  });
  it("mantiene tareas consultables sin permitir moverlas en modo lectura", () => {
    const html = renderToStaticMarkup(
      <StationDetail
        {...base}
        items={[tarea]}
        stationKey="manual"
        onBack={() => {}}
      />,
    );
    expect(html).toContain("Embalaje");
    expect(html).toContain("Ver detalles");
    expect(html).not.toContain("Mover a mi mesa");
    expect(html).not.toContain('draggable="true"');
  });
  it("conserva movimiento por botón y arrastre para estaciones habilitadas", () => {
    const html = renderToStaticMarkup(
      <StationDetail
        {...base}
        items={[tarea]}
        stationKey="manual"
        onBack={() => {}}
        canManage
      />,
    );
    expect(html).toContain("Mover a mi mesa");
    expect(html).toContain('draggable="true"');
  });
});
