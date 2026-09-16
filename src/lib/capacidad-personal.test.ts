import { describe, expect, it } from "vitest";
import { programarFasePersonal } from "./capacidad-personal";
import { programarFasePersonal as programarApi } from "../../apps/api/src/eta/motor/capacidad-personal";
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
  it.each([
    ["lona", [5, 21.98571428571429, 1.014285714285709]],
    ["láser", [15, 16.91933166666667, 0.08066833333332823]],
    ["hilo caliente", [5, 17.61168177018927, 0.3883182298107286]],
    ["DTF", [3, 2.931428571428571, 1.068571428571429]],
    ["documento", [3, 0.1111111111111111, 5.551115123125783e-17]],
  ])(
    "planifica %s con fases decimales y también su paso dependiente",
    (_, minutos) => {
      const total = minutos.reduce((s, m) => s + m, 0);
      const a = item("a", "taller", total, 1, {
        nodoClave: "impresion",
        demandaHumana: {
          version: 1,
          verificada: true,
          fases: minutos.map((m, i) => ({
            minutos: m,
            personas: i === 1 ? 0 : 1,
          })),
        },
      });
      const b = manual("b", "taller", 5);
      b.pasos[0] = {
        ...b.pasos[0],
        nodoClave: "acabado",
        predecesorPasoIds: ["a"],
      };
      const trabajos = [a, b];
      const original = JSON.stringify(trabajos);
      const r = correr(trabajos, [personal("taller", [persona("ana")])]);
      expect(r.traza).toHaveLength(2);
      expect(r.porItem.get("b")?.finEstimado).toBeInstanceOf(Date);
      const [primero, siguiente] = r.traza;
      expect(
        primero.fin.getTime() - primero.inicio.getTime(),
      ).toBeGreaterThanOrEqual(total * 60000);
      expect(
        primero.fin.getTime() - primero.inicio.getTime(),
      ).toBeLessThanOrEqual(total * 60000 + 3);
      expect(siguiente.inicio.getTime()).toBeGreaterThanOrEqual(
        primero.fin.getTime(),
      );
      for (const paso of r.traza)
        for (const reserva of paso.reservasHumanas ?? []) {
          expect(reserva.empleadoIds).toEqual(["ana"]);
          expect(Number.isInteger(reserva.inicio)).toBe(true);
          expect(Number.isInteger(reserva.fin)).toBe(true);
          expect(reserva.fin).toBeGreaterThan(reserva.inicio);
        }
      expect(JSON.stringify(trabajos)).toBe(original);
    },
  );
  it("las fases decimales que completan el viernes no derraman milisegundos al lunes", () => {
    const turno: CalendarioEstacion = {
      dias: {
        lun: [{ desde: "09:00", hasta: "10:00" }],
        mar: null,
        mie: null,
        jue: null,
        vie: [{ desde: "09:00", hasta: "10:00" }],
        sab: null,
        dom: null,
      },
    };
    const trabajo = item("decimal", "taller", 60, 1, {
      demandaHumana: {
        version: 1,
        verificada: true,
        fases: [
          { minutos: 5, personas: 1 },
          { minutos: 54.14285714285714, personas: 0 },
          { minutos: 0.8571428571428612, personas: 1 },
        ],
      },
    });
    const r = simular({
      items: [trabajo],
      estaciones: [personal("taller", [persona("ana", turno)])],
      medianas: new Map(),
      ahora: fecha(18),
      zona: "America/Argentina/Rio_Gallegos",
    });
    expect(r.porItem.get("decimal")?.finEstimado).toEqual(fecha(18, 10));
    expect(
      r.traza[0].tramosOperacion?.reduce((s, t) => s + t.fin - t.inicio, 0),
    ).toBe(60 * 60000);
  });

  it("equilibra minutos entre personas también en trabajos secuenciales de una máquina", () => {
    const trabajos = [
      item("a", "taller", 90),
      item("b", "taller", 30),
      item("c", "taller", 30),
    ];
    const r = correr(trabajos, [personal("taller")]);
    expect(r.traza.map((p) => p.reservasHumanas![0].empleadoIds)).toEqual([
      ["ana"],
      ["bruno"],
      ["bruno"],
    ]);
    expect(r.traza[1].inicio.getTime()).toBeGreaterThanOrEqual(
      r.traza[0].fin.getTime(),
    );
  });
  it("mantiene una asignación manual y completa el segundo operario", () => {
    const p = item("a", "taller", 60, 2, {
      maquinaId: null,
      personalFijo: { obligatorioId: "bruno" },
    });
    const r = correr(
      [p],
      [
        personal("taller", [
          persona("ana"),
          persona("bruno"),
          persona("carla"),
        ]),
      ],
    );
    expect(r.traza[0].reservasHumanas![0].empleadoIds).toEqual([
      "ana",
      "bruno",
    ]);
  });
  it("no sustituye silenciosamente al personal manual sin horario", () => {
    const p = item("a", "taller", 60, 1, {
      personalFijo: { obligatorioId: "bruno" },
    });
    const r = correr(
      [p],
      [personal("taller", [persona("ana"), persona("bruno", null)])],
    );
    expect(r.traza).toHaveLength(0);
    expect(r.porItem.get("a")?.motivoSinEstimar).toContain("horarios");
  });
  it("conserva el personal del paso iniciado aunque otro tenga menos carga", () => {
    const p = item("a", "taller", 60, 1, {
      estado: "en_curso",
      iniciadoEl: fecha(14).toISOString(),
      personalFijo: { empleadoIds: ["bruno"] },
    });
    const r = correr([p], [personal("taller")]);
    expect(r.traza[0].reservasHumanas![0].empleadoIds).toEqual(["bruno"]);
  });
  it("conserva a quien está ejecutando y espera su siguiente horario", () => {
    const p = item("a", "taller", 120, 1, {
      estado: "en_curso",
      iniciadoEl: fecha(14).toISOString(),
      personalFijo: { empleadoIds: ["ana", "bruno"], preferidoId: "bruno" },
    });
    const r = correr(
      [p],
      [
        personal("taller", [
          persona("ana"),
          persona("bruno", lunes("09:00", "10:00")),
        ]),
      ],
    );
    expect(r.traza[0].reservasHumanas!.map((r) => r.empleadoIds)).toEqual([
      ["bruno"],
      ["bruno"],
    ]);
    expect(r.traza[0].fin).toEqual(fecha(21, 10));
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
  it("distingue la falta de ventana del paso de la dependencia sin fecha de su sucesor", () => {
    const a = manual("a", "taller", 60, 2);
    a.pasos[0].nodoClave = "previo";
    const b = manual("b", "taller", 5);
    b.pasos[0] = {
      ...b.pasos[0],
      nodoClave: "siguiente",
      predecesorPasoIds: ["a"],
    };
    const r = correr([a, b], [personal("taller", [persona("ana")])]);
    expect(r.porItem.get("a")?.motivoSinEstimar).toContain("«a»");
    expect(r.porItem.get("b")?.motivoSinEstimar).toContain("pasos previos");
  });
  it("divide atención decimal entre jornadas sin solapar al personal compartido", () => {
    const turno = lunes("09:00", "10:00");
    const a = manual("a", "taller", 60.08066833333333);
    const b = manual("b", "otra", 10);
    const r = correr(
      [a, b],
      [
        personal("taller", [persona("ana", turno)]),
        personal("otra", [persona("ana", turno)]),
      ],
    );
    expect(r.traza).toHaveLength(2);
    const reservas = r.traza
      .flatMap((p) => p.reservasHumanas ?? [])
      .sort((a, b) => a.inicio - b.inicio);
    for (let i = 1; i < reservas.length; i++)
      expect(reservas[i].inicio).toBeGreaterThanOrEqual(reservas[i - 1].fin);
    for (const paso of r.traza)
      expect(
        paso.reservasHumanas?.reduce((n, r) => n + r.fin - r.inicio, 0),
      ).toBe(Math.ceil(paso.duracionMin! * 60000));
  });
  it("conserva la persona y los minutos al retomar en su siguiente turno", () => {
    const p = [
      persona("ana", lunes("09:00", "10:00")),
      persona("bruno", lunes("10:00", "18:00")),
    ];
    const r = correr([manual("a", "taller", 120)], [personal("taller", p)]);
    expect(r.traza[0].fin).toEqual(fecha(21, 10));
    expect(r.traza[0].reservasHumanas?.map((r) => r.empleadoIds)).toEqual([
      ["ana"],
      ["ana"],
    ]);
    expect(
      r.traza[0].reservasHumanas?.reduce((n, r) => n + r.fin - r.inicio, 0),
    ).toBe(120 * 60000);
  });
  it.each([false, true])(
    "mantiene preparación, cierre y separación en la misma persona (corte de horario: %s)",
    (corteHorario) => {
      const s = personal("maquina", [
        persona("ana", corteHorario ? lunes("09:00", "10:00") : calendario),
        persona("bruno"),
      ]);
      s.tiempoPreparacionMin = 5;
      const p = item("a", "maquina", 80, 1, {
        demandaHumana: {
          version: 1,
          verificada: true,
          fases: [
            { minutos: 15, personas: 1 },
            { minutos: 60, personas: 0 },
            { minutos: 5, personas: 1 },
          ],
        },
      });
      const r = correr([p], [s]).traza[0];
      expect(r.reservasHumanas?.map((r) => r.empleadoIds)).toEqual([
        ["ana"],
        ["ana"],
        ["ana"],
      ]);
      expect(r.fin).toEqual(corteHorario ? fecha(21, 9, 5) : fecha(14, 10, 20));
      expect(r.reservasHumanas?.at(-1)?.fin).toBe(
        (corteHorario ? fecha(21, 9, 10) : fecha(14, 10, 25)).getTime(),
      );
      expect(r.duracionMin).toBe(80);
    },
  );
  it("conserva la dotación de dos personas entre jornadas y el mismo núcleo en fases de una persona", () => {
    const p = manual("a", "taller", 150);
    p.pasos[0].demandaHumana = {
      version: 1,
      verificada: true,
      fases: [
        { minutos: 15, personas: 1 },
        { minutos: 120, personas: 2 },
        { minutos: 15, personas: 1 },
      ],
    };
    const r = correr(
      [p],
      [
        personal("taller", [
          persona("ana", lunes("09:00", "10:00")),
          persona("bruno"),
          persona("carla"),
        ]),
      ],
    ).traza[0];
    const reservas = r.reservasHumanas!;
    expect(
      reservas
        .filter((r) => r.personas === 2)
        .every((r) => r.empleadoIds?.join() === "ana,bruno"),
    ).toBe(true);
    expect(
      reservas
        .filter((r) => r.personas === 1)
        .every((r) => r.empleadoIds?.join() === "ana"),
    ).toBe(true);
    expect(
      reservas.reduce((n, r) => n + (r.fin - r.inicio) * r.personas, 0),
    ).toBe(270 * 60000);
    expect(new Set(reservas.flatMap((r) => r.empleadoIds ?? []))).toEqual(
      new Set(["ana", "bruno"]),
    );
  });
  it("planifica una fase mínima de dos personas aunque sus horarios comiencen a distinta hora", () => {
    const r = correr(
      [manual("a", "taller", 0.000001, 2)],
      [
        personal("taller", [
          persona("ana", lunes("09:00", "13:00")),
          persona("bruno", lunes("11:00", "18:00")),
        ]),
      ],
    ).traza[0];
    expect(r.inicio).toEqual(fecha(14, 11));
    expect(r.fin.getTime() - r.inicio.getTime()).toBe(1);
    expect(r.reservasHumanas![0].empleadoIds).toEqual(["ana", "bruno"]);
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
  it("reasignar una agenda aceptada libera al personal anterior y reserva al nuevo en todas las estaciones", () => {
    const estaciones = [personal("diseño"), personal("armado")];
    const a = manual("a", "diseño");
    a.pasos[0].personalFijo = { empleadoIds: ["ana"] };
    const original = correr([a], estaciones).traza[0];
    a.pasos[0] = {
      ...a.pasos[0],
      personalFijo: { empleadoIds: ["bruno"] },
      planificadoDesde: original.inicio.toISOString(),
      planificadoHasta: original.fin.toISOString(),
      atencionPlanificada: original.atencionPlanificada,
    };
    const b = manual("0", "armado");
    b.pasos[0].personalFijo = { empleadoIds: ["ana"] };
    const c = manual("1", "armado");
    c.pasos[0].personalFijo = { empleadoIds: ["bruno"] };
    const resultado = correr([b, c, a], estaciones);
    expect(
      resultado.traza
        .find((p) => p.pasoId === "a")
        ?.reservasHumanas?.every((r) => r.empleadoIds?.includes("bruno")),
    ).toBe(true);
    expect(resultado.traza.find((p) => p.pasoId === "0")?.inicio).toEqual(
      fecha(14, 9),
    );
    expect(resultado.traza.find((p) => p.pasoId === "1")?.inicio).toEqual(
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

describe.each([
  ["navegador", programarFasePersonal],
  ["API", programarApi],
] as const)("Continuidad del personal: %s", (_, programar) => {
  it("no cambia a otro operario por una frontera de reservas que no impide continuar", () => {
    const inicio = fecha(14).getTime();
    const r = programar({
      desde: fecha(14),
      minutos: 20,
      personas: 1,
      empleados: [persona("ana"), persona("bruno")],
      reservas: [
        {
          inicio,
          fin: inicio + 5 * 60000,
          personas: 1,
          empleadoIds: ["otra-persona"],
        },
      ],
      proyectar: (_, desde, minutos) => [
        { inicio: desde.getTime(), fin: desde.getTime() + minutos * 60000 },
      ],
    });
    expect(r).toEqual([
      { inicio, fin: inicio + 20 * 60000, empleadoIds: ["ana"] },
    ]);
  });
});
