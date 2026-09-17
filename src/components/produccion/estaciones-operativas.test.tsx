import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EstacionesOperativas } from "./estaciones-operativas";
import { TableroLista } from "./tablero-lista";
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
    const html = renderToStaticMarkup(<EstacionesOperativas {...base} />);
    expect(html).toContain("Ver tareas de Estación vacía QA");
    expect(html).toContain('href="/produccion/tablero?estacion=manual&amp;vista=lista"');
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
  it.each([
    ["tercerizado", "proveedor-tercerizado"],
    ["interno", "sin-estacion"],
  ] as const)("enlaza el grupo %s a su filtro de Lista", (tipoEjecucion, key) => {
    const item = buildItemView({ ...tarea.data, pasos: tarea.data.pasos.map(p => ({ ...p, tipoEjecucion })) }, []);
    const html = renderToStaticMarkup(<EstacionesOperativas {...base} estaciones={[]} items={[item]} />);
    expect(html).toContain(`href="/produccion/tablero?estacion=${key}&amp;vista=lista"`);
  });
  it("traslada Asignarme a Personal asignado, respetando el modo de lectura", () => {
    const render = (canManage: boolean) => renderToStaticMarkup(
      <TableroLista items={[tarea]} estaciones={[estacion]} zona="UTC" onOpen={() => {}}
        asignacionManual={{ puedeReasignar: false, onConfirmar: async () => {}, canManage, estacionIdsEjecutables: [estacion.id], busy: false, onMesa: async () => {} }} />,
    );
    expect(render(true)).toContain('aria-label="Asignarme: Embalaje"');
    expect(render(false)).not.toContain('aria-label="Asignarme: Embalaje"');
  });

  it("muestra el icono de asignación sólo al supervisor para pasos internos sin iniciar", () => {
    const est = { ...estacion, planificacionPorEmpleados: true };
    const render = (supervisor: boolean, overrides: Partial<TableroItemData['pasos'][number]> = {}) => {
      const item = buildItemView({ ...tarea.data, pasos: tarea.data.pasos.map(p => ({ ...p, ...overrides })) }, [est]);
      return renderToStaticMarkup(<TableroLista items={[item]} estaciones={[est]} zona="UTC" onOpen={() => {}}
        asignacionManual={{ puedeReasignar: supervisor, onConfirmar: async () => {}, canManage: false, estacionIdsEjecutables: [], busy: false, onMesa: async () => {} }} />);
    };
    expect(render(true)).toContain('aria-label="Asignar personal: Embalaje"');
    expect(render(false)).not.toContain('aria-label="Asignar personal:');
    expect(render(true, { iniciadoEl: '2026-09-14T12:00:00Z' })).not.toContain('aria-label="Asignar personal:');
    expect(render(true, { tipoEjecucion: 'tercerizado' })).not.toContain('aria-label="Asignar personal:');
    expect(render(true, { asignacionPersonal: { origen: 'automatica', personas: [{ empleadoId: 'persona', nombre: 'Ana' }], franjas: [], conflicto: null, esMia: false } })).toContain('aria-label="Reasignar personal: Embalaje"');
  });
});
