import { describe, expect, it } from "vitest";
import { simularFlujo } from "./flujo-produccion";
import { demandaDesdeTiempo as demandaApi } from "../../apps/api/src/eta/motor/demanda-humana";
import { simularFlujo as simularApi } from "../../apps/api/src/eta/motor/flujo-produccion";
import {
  demandaDesdeTiempo,
  leerDemandaHumana,
  combinarDemandas,
} from "./demanda-humana";
import {
  calendarioDefault,
  type Estacion,
  type EquipoProduccion,
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

// Ambos motores ejecutan el mismo caso; no alcanza probar sólo el navegador.
describe.each([
  ["comercial / Gantt", simularFlujo],
  ["API / entregas", simularApi],
] as const)("Capacidad compartida: %s", (_, simular) => {
  const correr = (
    items: TableroItemData[],
    estaciones: Estacion[],
    ahora = fecha(14),
    noLaborables = new Set<string>(),
  ) =>
    simular({
      items,
      estaciones,
      ahora,
      noLaborables,
      zona: "America/Argentina/Rio_Gallegos",
      medianas: new Map(),
    });
  it.each(['con_operario', 'autonoma'] as const)('una máquina %s respeta el equipo compartido con otra máquina', (modo) => {
    const demanda = demandaDesdeTiempo({ maquinaId: 'guillotina', operacionMaquina: modo,
      totalMin: 70, setupMin: 5, runMin: 60, cleanupMin: 5, tiempoFijoMin: 0, dotacionOperarios: 1 });
    const team = equipo(1);
    const r = correr([item('a', 'guillotina', 70, 1, { demandaHumana: demanda }), item('b', 'otra', 10)],
      [estacion('guillotina', team), estacion('otra', team)]);
    expect(r.traza.find(t => t.pasoId === 'b')?.inicio).toEqual(modo === 'con_operario' ? fecha(14, 10, 10) : fecha(14, 9, 5));
    expect(r.traza.find(t => t.pasoId === 'a')?.tramosOperacion?.map(t => t.tipo)).toEqual(['operario', modo === 'con_operario' ? 'maquina_atendida' : 'maquina', 'operario']);
  });
  it('una guillotina atendida deja disponible la segunda persona del taller', () => {
    const team = equipo(2);
    const demanda = demandaDesdeTiempo({ maquinaId: 'guillotina', operacionMaquina: 'con_operario', totalMin: 12,
      setupMin: 0, runMin: 12, cleanupMin: 0, tiempoFijoMin: 0, dotacionOperarios: 1 });
    const r = correr([item('a', 'guillotina', 12, 1, { demandaHumana: demanda }), item('b', 'otra', 10)],
      [estacion('guillotina', team), estacion('otra', team)]);
    expect(r.traza.map(t => t.inicio)).toEqual([fecha(14), fecha(14)]);
  });
  it('reproyecta una OT con la configuración vigente aunque se cotizara autónoma', () => {
    const team = equipo(1);
    const d = demandaDesdeTiempo({ maquinaId: 'a', operacionMaquina: 'autonoma', totalMin: 70,
      setupMin: 5, runMin: 60, cleanupMin: 5, tiempoFijoMin: 0, dotacionOperarios: 1 });
    const rows = [item('a', 'a', 70, 1, { demandaHumana: d }), item('b', 'b', 10)];
    const before = JSON.stringify(rows);
    const r = correr(rows, [estacion('a', team, { maquinas: [{ id: 'a', codigo: 'a', nombre: 'a', centroCostoId: null, operacionMaquina: 'con_operario' }] }), estacion('b', team)]);
    expect(r.traza.find(t => t.pasoId === 'b')?.inicio).toEqual(fecha(14, 10, 10));
    expect(JSON.stringify(rows)).toBe(before);
  });
  it("dos diseñadores pueden atender dos trabajos; la tercera máquina espera", () => {
    const team = equipo(2, "diseño"),
      r = correr(
        [item("a", "diseño", 60), item("b", "bn", 60), item("c", "color", 60)],
        [
          estacion("diseño", team),
          estacion("bn", team),
          estacion("color", team),
        ],
      );
    expect(r.traza.map((t) => t.inicio)).toEqual([
      fecha(14),
      fecha(14),
      fecha(14, 10),
    ]);
    expect(r.porItem.get("c")?.parcial).toBe(false);
  });
  it("un impresor compartido serializa UV, ecosolvente y DTF UV atendidos", () => {
    const team = equipo(1),
      r = correr(
        [item("a", "uv", 60), item("b", "eco", 60), item("c", "dtf", 60)],
        [estacion("uv", team), estacion("eco", team), estacion("dtf", team)],
      );
    expect(r.traza.map((t) => t.inicio)).toEqual([
      fecha(14),
      fecha(14, 10),
      fecha(14, 11),
    ]);
  });
  it.each([1, 2])(
    "una colocación de %i personas deja sólo la capacidad restante en Taller",
    (personas) => {
      const team = equipo(2),
        r = correr(
          [
            item("a", "instalacion", 120, personas),
            item("b", "laser", 60),
            item("c", "laminadora", 60),
          ],
          [
            estacion("instalacion", team),
            estacion("laser", team),
            estacion("laminadora", team),
          ],
        );
      expect(r.traza.find((t) => t.pasoId === "b")?.inicio).toEqual(
        fecha(14, personas === 1 ? 9 : 11),
      );
      expect(r.traza.find((t) => t.pasoId === "c")?.inicio).toEqual(
        fecha(14, personas === 1 ? 10 : 11),
      );
    },
  );
  it("UV y eco de la misma estación con un puesto comparten una persona sólo en atención", () => {
    const e = estacion("gran-formato", equipo(1), {
      maquinas: ["uv", "eco"].map(id => ({id, nombre:id, codigo:id, centroCostoId:null})),
    });
    const uv = item("a", "uv", 80, 1, {demandaHumana: demandaDesdeTiempo({
      maquinaId:"uv", totalMin:80, setupMin:10, runMin:60, cleanupMin:10, tiempoFijoMin:0,
    })});
    const r = correr([uv, item("b", "eco", 30)], [e]);
    expect(r.traza.find(t => t.pasoId === "b")?.inicio).toEqual(fecha(14,9,10));
    expect(r.traza[0].tramosOperacion?.map(t=>[t.tipo,(t.fin-t.inicio)/60000])).toEqual([
      ["operario",10], ["maquina",60], ["operario",10],
    ]);
  });
  it("una misma máquina sigue siendo única aunque sobren puestos manuales", () => {
    const e = estacion("uv", equipo(2), {capacidadConcurrente:4});
    const r = correr([item("a","uv",60,0),item("b","uv",60,0)], [e]);
    expect(r.traza.map(t=>t.inicio)).toEqual([fecha(14),fecha(14,10)]);
  });
  it("dos Ricoh y dos diseñadores pueden arrancar a la vez en una misma estación", () => {
    const e = estacion("digital", equipo(2), {
      maquinas:["color","bn"].map(id=>({id,nombre:id,codigo:id,centroCostoId:null})),
    });
    expect(correr([item("a","color",60),item("b","bn",60)], [e]).traza.map(t=>t.inicio))
      .toEqual([fecha(14),fecha(14)]);
  });
  it("los puestos manuales no se ocupan por el RUN de las máquinas", () => {
    const e=estacion("taller",equipo(2),{familias:["manual"],
      maquinas:[{id:"laser",nombre:"laser",codigo:"laser",centroCostoId:"cc"}]});
    const manual=(id:string)=>item(id,"manual",30,1,{maquinaId:null,centroCostoId:"cc"});
    const r=correr([item("a","laser",120,0),manual("b"),manual("c")],[e]);
    expect(r.traza.map(t=>t.inicio)).toEqual([fecha(14),fecha(14),fecha(14,9,30)]);
  });
  it("una reserva futura de otra máquina no consume los puestos manuales", () => {
    const e=estacion("taller",equipo(2),{familias:["manual"],
      maquinas:[{id:"laser",nombre:"laser",codigo:"laser",centroCostoId:null}]});
    const r=correr([item("a","manual",180,1,{maquinaId:null}),
      item("b","laser",60,0,{planificadoDesde:fecha(14,10).toISOString(),planificadoHasta:fecha(14,11).toISOString()})],[e]);
    expect(r.traza.find(t=>t.pasoId==="a")?.inicio).toEqual(fecha(14));
    expect(r.traza.find(t=>t.pasoId==="b")?.inicio).toEqual(fecha(14,10));
  });
  it("una impresión en curso conserva el RUN autónomo y libera al operario", () => {
    const d=demandaDesdeTiempo({maquinaId:"uv",totalMin:80,setupMin:10,runMin:60,cleanupMin:10,tiempoFijoMin:0});
    const r=correr([item("a","uv",80,1,{demandaHumana:d,estado:"en_curso",iniciadoEl:fecha(14).toISOString()}),item("b","eco",30)],
      [estacion("uv",equipo(1)),estacion("eco",equipo(1))],fecha(14,9,20));
    expect(r.traza.find(t=>t.pasoId==="a")?.duracionMin).toBe(60);
    expect(r.traza.find(t=>t.pasoId==="b")?.inicio).toEqual(fecha(14,9,20));
    expect(r.traza[0].tramosOperacion?.[0].tipo).toBe("maquina");
  });
  it("una noche no se resta como trabajo realizado", () => {
    const r=correr([item("a","uv",120,1,{estado:"en_curso",iniciadoEl:fecha(14,17).toISOString()})],
      [estacion("uv",equipo(1))],fecha(15,9,30));
    expect(r.traza[0].duracionMin).toBe(30);
    expect(r.traza[0].fin).toEqual(fecha(15,10));
  });
  it("las pausas registradas no consumen fases y reanudar no repite la preparación", () => {
    const d=demandaDesdeTiempo({maquinaId:"uv",totalMin:80,setupMin:10,runMin:60,cleanupMin:10,tiempoFijoMin:0});
    const r=correr([item("a","uv",80,1,{demandaHumana:d,estado:"en_curso",iniciadoEl:fecha(14).toISOString(),
      tramosEjecucion:[{inicio:fecha(14).toISOString(),fin:fecha(14,9,20).toISOString()},
        {inicio:fecha(14,11).toISOString(),fin:null}]})],[estacion("uv",equipo(1))],fecha(14,11,10));
    expect(r.traza[0].duracionMin).toBe(50);
    expect(r.traza[0].tramosOperacion?.map(t=>t.tipo)).toEqual(["maquina","operario"]);
  });
  it("un ciclo autónomo libera la persona y espera para descargar si sigue ocupada", () => {
    const team = equipo(1),
      demanda = demandaDesdeTiempo({
        maquinaId: "uv",
        totalMin: 80,
        setupMin: 10,
        runMin: 60,
        cleanupMin: 10,
        tiempoFijoMin: 0,
        dotacionOperarios: 1,
      });
    const r = correr(
      [
        item("a", "uv", 80, 1, { demandaHumana: demanda }),
        item("b", "eco", 120),
      ],
      [estacion("uv", team), estacion("eco", team)],
    );
    // Se reserva el cierre de UV a las 10:10. El trabajo largo no cabe antes.
    expect(r.traza.find((t) => t.pasoId === "b")?.inicio).toEqual(
      fecha(14, 10, 20),
    );
    expect(r.traza[0].duracionMin).toBe(80);
    const corto = correr(
      [
        item("a", "uv", 80, 1, { demandaHumana: demanda }),
        item("b", "eco", 30),
      ],
      [estacion("uv", team), estacion("eco", team)],
    );
    expect(corto.traza.find((t) => t.pasoId === "b")?.inicio).toEqual(
      fecha(14, 9, 10),
    );
  });
  it("combina los jueves de DTF con las colocaciones del equipo", () => {
    const team = equipo(2),
      jueves = {
        dias: {
          ...Object.fromEntries(
            Object.keys(calendario.dias).map((k) => [k, null]),
          ),
          jue: [{ desde: "09:00", hasta: "18:00" }],
        },
      } as typeof calendario;
    const r = correr(
      [item("a", "instalacion", 120, 2), item("b", "dtf", 60)],
      [
        estacion("instalacion", team),
        estacion("dtf", team, { calendario: jueves }),
      ],
      fecha(17),
    );
    expect(r.traza.find((t) => t.pasoId === "b")?.inicio).toEqual(
      fecha(17, 11),
    );
    expect(
      correr(
        [item("b", "dtf", 60)],
        [estacion("dtf", team, { calendario: jueves })],
        fecha(18),
      ).traza[0].inicio,
    ).toEqual(fecha(24));
    expect(
      correr(
        [item("b", "dtf", 60)],
        [estacion("dtf", team, { calendario: jueves })],
        fecha(17),
        new Set(["2026-09-17"]),
      ).traza[0].inicio,
    ).toEqual(fecha(24));
  });
  it("espera al operario para finalizar un ciclo, conservando ocupada la máquina", () => {
    const team = equipo(1),
      demanda = {
        version: 1,
        verificada: true,
        fases: [
          { minutos: 10, personas: 1 },
          { minutos: 60, personas: 0 },
          { minutos: 10, personas: 1 },
        ],
      };
    const r = correr(
      [
        item("a", "uv", 80, 1, { demandaHumana: demanda }),
        item("z", "instalacion", 60, 1, {
          planificadoDesde: fecha(14, 10).toISOString(),
          planificadoHasta: fecha(14, 11).toISOString(),
        }),
      ],
      [estacion("uv", team), estacion("instalacion", team)],
    );
    expect(r.traza.find((t) => t.pasoId === "a")).toMatchObject({
      inicio: fecha(14),
      fin: fecha(14, 11, 10),
      duracionMin: 80,
    });
    expect(r.traza.find((t) => t.pasoId === "z")?.inicio).toEqual(
      fecha(14, 10),
    );
  });
  it("respeta una reserva futura en otra estación del mismo equipo", () => {
    const team = equipo(1),
      reservada = item("z", "laser", 60, 1, {
        planificadoDesde: fecha(14, 10).toISOString(),
        planificadoHasta: fecha(14, 11).toISOString(),
      });
    const r = correr(
      [item("a", "uv", 120), reservada],
      [estacion("uv", team), estacion("laser", team)],
    );
    expect(r.traza.find((t) => t.pasoId === "z")?.inicio).toEqual(
      fecha(14, 10),
    );
    expect(r.traza.find((t) => t.pasoId === "a")?.inicio).toEqual(
      fecha(14, 11),
    );
  });
  it("no inventa fechas cuando hacen falta más personas que las disponibles", () => {
    const r = correr(
      [item("a", "instalacion", 60, 3)],
      [estacion("instalacion", equipo(2))],
    );
    expect(r.porItem.get("a")?.finEstimado).toBeNull();
    expect(r.porItem.get("a")?.motivoSinEstimar).toContain("equipo");
    expect(r.traza).toHaveLength(0);
  });
  it("equipo inactivo o calendarios sin intersección impiden prometer una fecha", () => {
    const e = equipo(1);
    e.activo = false;
    expect(
      correr([item("a", "uv", 60)], [estacion("uv", e)]).porItem.get("a")
        ?.finEstimado,
    ).toBeNull();
    e.activo = true;
    e.calendario = {
      dias: {
        lun: null,
        mar: null,
        mie: null,
        jue: null,
        vie: null,
        sab: [{ desde: "09:00", hasta: "18:00" }],
        dom: null,
      },
    };
    expect(
      correr([item("a", "uv", 60)], [estacion("uv", e)]).porItem.get("a")
        ?.finEstimado,
    ).toBeNull();
  });
  it("los cierres no reservan personas y equipos distintos pueden trabajar a la vez", () => {
    const a = equipo(1, "a"),
      b = equipo(1, "b");
    const r = correr(
      [item("a", "uv", 120), item("b", "laser", 120)],
      [estacion("uv", a), estacion("laser", b)],
      fecha(14, 17),
    );
    expect(r.traza.map((t) => t.fin)).toEqual([fecha(15, 10), fecha(15, 10)]);
    expect(
      r.traza[0].reservasHumanas?.map((t) => (t.fin - t.inicio) / 60000),
    ).toEqual([60, 60]);
  });
  it("los históricos conservan ETA pero identifican atención y equipo sin validar", () => {
    const r = correr(
      [item("a", "uv", 60, 1, { demandaHumana: null })],
      [estacion("uv")],
    );
    expect(r.porItem.get("a")?.finEstimado).toEqual(fecha(14, 10));
    expect(r.porItem.get("a")?.parcial).toBe(true);
  });
});

it("congela atención y dotación conservando exactamente los minutos cotizados", () => {
  const t = {
    totalMin: 80,
    setupMin: 10,
    runMin: 60,
    cleanupMin: 10,
    tiempoFijoMin: 0,
    maquinaId: "uv",
    dotacionOperarios: 1,
  };
  expect(demandaDesdeTiempo(t)?.fases).toEqual([
    { minutos: 10, personas: 1 },
    { minutos: 60, personas: 0 },
    { minutos: 10, personas: 1 },
  ]);
  expect(
    demandaDesdeTiempo({ ...t, maquinaId: null, dotacionOperarios: 2 })?.fases,
  ).toEqual([{ minutos: 80, personas: 2 }]);
  expect(leerDemandaHumana(demandaDesdeTiempo(t), 90)).toBeNull();
});
it("conserva dotaciones de extras, redondeos y etapas consolidadas", () => {
  const t = {
    totalMin: 81,
    setupMin: 10,
    runMin: 50.4,
    cleanupMin: 10,
    tiempoFijoMin: 0,
    maquinaId: "m",
    dotacionOperarios: 1,
    tiemposExtra: [{ minutos: 10, dotacionOperarios: 2 }],
  };
  const d = demandaDesdeTiempo(t)!;
  expect(d.verificada).toBe(true);
  expect(d.fases.at(-1)).toEqual({ minutos: 10, personas: 2 });
  expect(d.fases.reduce((s, f) => s + f.minutos, 0)).toBeCloseTo(81);
  const dos = {
    version: 1 as const,
    verificada: true,
    fases: [{ minutos: 20, personas: 2 }],
  };
  expect(combinarDemandas([d, dos], 101).fases.at(-1)).toEqual({
    minutos: 20,
    personas: 2,
  });
  expect(combinarDemandas([d, dos], 110)).toMatchObject({
    verificada: false,
    fases: [{ minutos: 110, personas: 2 }],
  });
});

it.each([demandaDesdeTiempo, demandaApi])(
  "reserva las recargas internas y deriva atención sin preferencias",
  (derivar) => {
    const t = {
      maquinaId: "m",
      totalMin: 28,
      setupMin: 2,
      cleanupMin: 2,
      tiempoFijoMin: 0,
      runMin: 24,
      dotacionOperarios: 2,
      fasesRun: [
        { minutos: 10, operario: false },
        { minutos: 4, operario: true },
        { minutos: 10, operario: false },
      ],
    };
    expect(derivar(t)).toEqual({
      version: 1,
      verificada: true,
      fases: [
        { minutos: 2, personas: 2 },
        { minutos: 10, personas: 0 },
        { minutos: 4, personas: 2 },
        { minutos: 10, personas: 0 },
        { minutos: 2, personas: 2 },
      ],
    });
    expect(derivar({ ...t, runMin: 25, totalMin: 29 })?.verificada).toBe(false);
    expect(
      derivar({ ...t, procesamientoCorte: { runMin: 24 } })?.verificada,
    ).toBe(false);
  },
);
