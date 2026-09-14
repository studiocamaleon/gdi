import { describe, expect, it } from "vitest";
import { simularFlujo } from "./flujo-produccion";
import { simularFlujo as simularApi } from "../../apps/api/src/eta/motor/flujo-produccion";
import {
  calendarioDefault,
  type Estacion,
  type EquipoProduccion,
  type CalendarioEstacion,
} from "./estaciones";
import type { TableroItemData, TableroPasoData } from "./tablero-produccion";
const calendario = calendarioDefault();
const fecha = (dia: number, hora = 9, minuto = 0) =>
  new Date(
    `2026-09-${String(dia).padStart(2, "0")}T${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}:00-03:00`,
  );
const equipo = (personas: number, id = "taller"): EquipoProduccion => ({
  id,
  nombre: id,
  personas,
  activo: true,
  calendario,
});
const estacion = (
  id: string,
  team?: EquipoProduccion,
  override: Partial<Estacion> = {},
): Estacion => ({
  id,
  nombre: id,
  descripcion: "",
  activo: true,
  etapa: "impresion",
  icono: null,
  capacidadConcurrente: 1,
  tiempoPreparacionMin: 0,
  calendario,
  familias: [id],
  maquinas: [{ id, codigo: id, nombre: id, centroCostoId: null }],
  empleados: [],
  equipoProduccion: team,
  equipoProduccionId: team?.id,
  createdAt: "",
  updatedAt: "",
  ...override,
});
function item(
  id: string,
  recurso: string,
  minutos: number,
  personas = 1,
  override: Partial<TableroPasoData> = {},
): TableroItemData {
  return {
    id,
    ordenId: id,
    ordenNumero: id,
    ordenEstado: "produccion",
    itemIndice: 1,
    codigo: id,
    nombre: id,
    clienteNombre: "",
    vendedorNombre: "",
    cantidad: 1,
    cantidadUnidad: "u",
    specs: [],
    archivosCount: 0,
    fechaEntrega: null,
    sinRuta: false,
    pasos: [
      {
        id,
        indice: 0,
        nombre: id,
        familiaCodigo: recurso,
        maquinaId: recurso,
        rutaPasoId: null,
        categoriaFamilia: "",
        centroCostoId: null,
        centroCostoNombre: null,
        duracionEstimadaMin: minutos,
        demandaHumana: {
          version: 1,
          verificada: true,
          fases: [{ minutos, personas }],
        },
        estado: "pendiente",
        iniciadoEl: null,
        completadoEl: null,
        modoRegistro: "cronometro",
        motivoBloqueo: null,
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
        ...override,
      },
    ],
  };
}

const persona = (id: string, cal: CalendarioEstacion | null = calendario) => ({
  id,
  nombreCompleto: id,
  sector: "Taller",
  activo: true,
  calendario: cal,
});
const personal = (id: string, empleados = [persona("ana"), persona("bruno")]) =>
  estacion(id, undefined, {
    planificacionPorEmpleados: true,
    empleados,
    capacidadConcurrente: 1,
  });
const manual = (id: string, recurso: string, minutos = 60, personas = 1) =>
  item(id, recurso, minutos, personas, { maquinaId: null });
const lunes = (desde: string, hasta: string): CalendarioEstacion => ({
  dias: {
    lun: [{ desde, hasta }],
    mar: null,
    mie: null,
    jue: null,
    vie: null,
    sab: null,
    dom: null,
  },
});

describe.each([
  ["navegador", simularFlujo],
  ["API", simularApi],
] as const)("Planificación personal: %s", (_, simular) => {
  const correr = (
    items: TableroItemData[],
    estaciones: Estacion[],
    noLaborables = new Set<string>(),
  ) =>
    simular({
      items,
      estaciones,
      medianas: new Map(),
      ahora: fecha(14),
      zona: "America/Argentina/Rio_Gallegos",
      noLaborables,
    });
  it("dos trabajos manuales de un operario son simultáneos aunque el puesto legado sea uno", () => {
    const r = correr(
      [manual("a", "taller"), manual("b", "taller")],
      [personal("taller")],
    );
    expect(r.traza.map((p) => p.inicio)).toEqual([fecha(14), fecha(14)]);
    expect(r.traza.map((p) => p.fin)).toEqual([fecha(14, 10), fecha(14, 10)]);
    expect(r.traza.map((p) => p.reservasHumanas![0].empleadoIds)).toEqual([
      ["ana"],
      ["bruno"],
    ]);
  });
  it("un trabajo de dos operarios ocupa ambas personas y el siguiente espera", () => {
    const r = correr(
      [manual("a", "taller", 60, 2), manual("b", "taller")],
      [personal("taller")],
    );
    expect(r.traza.map((p) => p.inicio)).toEqual([fecha(14), fecha(14, 10)]);
    expect(r.traza[0].reservasHumanas![0].empleadoIds).toEqual([
      "ana",
      "bruno",
    ]);
  });
  it("comparte una persona entre estaciones sin duplicarla", () => {
    const p = [persona("ana")];
    const r = correr(
      [manual("a", "diseño"), manual("b", "armado")],
      [personal("diseño", p), personal("armado", p)],
    );
    expect(r.traza.map((p) => p.inicio)).toEqual([fecha(14), fecha(14, 10)]);
  });
  it("respeta horarios individuales y exige coincidencia cuando hacen falta dos", () => {
    const p = [
      persona("ana", lunes("09:00", "13:00")),
      persona("bruno", lunes("11:00", "18:00")),
    ];
    const r = correr([manual("a", "taller", 60, 2)], [personal("taller", p)]);
    expect(r.traza[0].inicio).toEqual(fecha(14, 11));
    expect(r.traza[0].fin).toEqual(fecha(14, 12));
  });
  it("no suma dos turnos sin superposición para un paso de dos personas", () => {
    const p = [
      persona("ana", lunes("09:00", "13:00")),
      persona("bruno", lunes("13:00", "18:00")),
    ];
    const r = correr([manual("a", "taller", 60, 2)], [personal("taller", p)]);
    expect(r.traza).toHaveLength(0);
    expect(r.porItem.get("a")?.finEstimado).toBeNull();
    expect(r.porItem.get("a")?.motivoSinEstimar).toContain("dotación");
  });
  it("permite relevo y conserva los minutos al cambiar el turno", () => {
    const p = [
      persona("ana", lunes("09:00", "10:00")),
      persona("bruno", lunes("10:00", "18:00")),
    ];
    const r = correr([manual("a", "taller", 120)], [personal("taller", p)]);
    expect(r.traza[0].fin).toEqual(fecha(14, 11));
    expect(r.traza[0].reservasHumanas?.map((r) => r.empleadoIds)).toEqual([
      ["ana"],
      ["bruno"],
    ]);
  });
  it("no inventa capacidad sin empleados, con horario pendiente o con empleados inactivos", () => {
    for (const p of [
      [],
      [persona("ana", null)],
      [{ ...persona("ana"), activo: false }],
    ]) {
      const r = correr([manual("a", "taller")], [personal("taller", p)]);
      expect(r.traza).toHaveLength(0);
    }
  });
  it("deduplica IDs de empleados aunque el input los repita", () => {
    const p = [persona("ana"), persona("ana")];
    expect(
      correr([manual("a", "taller", 60, 2)], [personal("taller", p)]).traza,
    ).toHaveLength(0);
  });
  it("intersecta horario personal, estación y feriados", () => {
    const s = personal("taller");
    s.calendario = {
      dias: {
        lun: null,
        mar: null,
        mie: null,
        jue: [{ desde: "13:00", hasta: "18:00" }],
        vie: null,
        sab: null,
        dom: null,
      },
    };
    const r = correr([manual("a", "taller")], [s], new Set(["2026-09-17"]));
    expect(r.traza[0].inicio).toEqual(fecha(24, 13));
  });
  it("libera empleados durante una fase autónoma, pero conserva la máquina", () => {
    const demanda = {
      version: 1,
      verificada: true,
      fases: [
        { minutos: 5, personas: 1 },
        { minutos: 60, personas: 0 },
        { minutos: 5, personas: 1 },
      ],
    };
    const r = correr(
      [
        item("a", "maquina", 70, 1, { demandaHumana: demanda }),
        manual("b", "taller", 10),
      ],
      [
        personal("maquina", [persona("ana")]),
        personal("taller", [persona("ana")]),
      ],
    );
    expect(r.traza.find((p) => p.pasoId === "b")?.inicio).toEqual(
      fecha(14, 9, 5),
    );
  });
  it("una agenda aceptada reserva al empleado también en otra estación", () => {
    const estaciones = [
      personal("diseño", [persona("ana")]),
      personal("armado", [persona("ana")]),
    ];
    const a = manual("a", "diseño");
    const base = correr([a], estaciones).traza[0];
    a.pasos[0] = {
      ...a.pasos[0],
      planificadoDesde: base.inicio.toISOString(),
      planificadoHasta: base.fin.toISOString(),
      atencionPlanificada: base.atencionPlanificada,
    };
    expect(base.atencionPlanificada?.reservas[0].empleadoIds).toEqual(["ana"]);
    const r = correr([manual("0", "armado"), a], estaciones);
    expect(r.traza.find((p) => p.pasoId === "0")?.inicio).toEqual(
      fecha(14, 10),
    );
  });
  it.each([true, false])(
    "no duplica personas durante la transición de un equipo (personal primero: %s)",
    (personalPrimero) => {
      const antiguo = equipo(1);
      const nuevo = {
        ...personal("diseño", [persona("ana")]),
        equipoProduccionId: antiguo.id,
      };
      const anterior = estacion("armado", antiguo);
      const r = correr(
        personalPrimero
          ? [manual("a", "diseño"), manual("b", "armado")]
          : [manual("a", "armado"), manual("b", "diseño")],
        [nuevo, anterior],
      );
      expect(r.traza.map((p) => p.inicio)).toEqual([fecha(14), fecha(14, 10)]);
    },
  );
  it("conserva el modo anterior hasta configurar empleados, sin reescribir la capacidad", () => {
    const s = estacion("taller", equipo(2), { capacidadConcurrente: 2 });
    const r = correr([manual("a", "taller"), manual("b", "taller")], [s]);
    expect(r.traza.map((p) => p.inicio)).toEqual([fecha(14), fecha(14)]);
  });
});
