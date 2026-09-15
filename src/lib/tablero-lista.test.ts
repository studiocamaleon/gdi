import { describe, expect, it } from "vitest";
import { revisionCeldasEnVivo, celdasQueCambian } from "./tablero-lista-en-vivo";
import type { Estacion } from "./estaciones";
import { buildItemView } from "./produccion-item-view";
import type { TableroItemData, TableroPasoData } from "./tablero-produccion";
import {
  agruparTrabajos,
  accionAsignacionManual,
  opcionesEstacionesTablero,
  grupoDelTrabajo,
  estacionDelPasoVisible,
  operadoresDelTrabajo,
  trabajoAsignadoAMi,
  filtrarTrabajos,
  metricasTrabajos,
  responsablesDeEspera,
  type FiltrosTrabajo,
} from "./tablero-lista";

const ahora = new Date("2026-09-14T14:00:00Z");
const zona = "America/Argentina/Buenos_Aires";

function paso(overrides: Partial<TableroPasoData> = {}): TableroPasoData {
  return {
    id: "paso",
    indice: 0,
    rutaPasoId: null,
    nombre: "Revisión de archivo",
    familiaCodigo: "pre_prensa",
    categoriaFamilia: "preprensa",
    centroCostoId: null,
    centroCostoNombre: null,
    duracionEstimadaMin: 15,
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
    planificadoHasta: "2026-09-16T15:00:00Z",
    ...overrides,
  };
}
function trabajo(overrides: Partial<TableroItemData> = {}, pasos = [paso()]) {
  return buildItemView(
    {
      id: "trabajo",
      ordenId: "ot",
      ordenNumero: "OT-2026-0001",
      ordenEstado: "pendiente",
      itemIndice: 0,
      codigo: "cartel",
      nombre: "Cartel",
      clienteNombre: "Cliente",
      vendedorNombre: "Vendedora",
      cantidad: 1,
      cantidadUnidad: "u.",
      specs: [],
      fechaEntrega: "2026-09-16",
      archivosCount: 0,
      sinRuta: false,
      pasos,
      ...overrides,
    },
    [estacion()],
    zona,
    ahora,
  );
}
function estacion(overrides: Partial<Estacion> = {}): Estacion {
  return {
    id: "preprensa",
    nombre: "Pre-impresión",
    descripcion: "",
    activo: true,
    etapa: "preprensa",
    icono: null,
    capacidadConcurrente: 1,
    tiempoPreparacionMin: null,
    calendario: null,
    familias: ["pre_prensa"],
    empleados: [],
    maquinas: [],
    createdAt: ahora.toISOString(),
    updatedAt: ahora.toISOString(),
    ...overrides,
  };
}

describe("lista operativa compartida con Kanban", () => {
  it("cada trabajo aparece una vez, prioriza bloqueos y ordena por fin previsto del paso", () => {
    const grupos = agruparTrabajos([
      trabajo({ id: "tardio" }, [
        paso({ planificadoHasta: "2026-09-13T15:00:00Z" }),
      ]),
      trabajo({ id: "sin-fecha", fechaEntrega: null }, [
        paso({ planificadoHasta: null }),
      ]),
      trabajo({ id: "bloqueado", fechaEntrega: "2026-09-10" }, [
        paso({ estado: "bloqueado" }),
      ]),
      trabajo({ id: "hoy" }, [
        paso({ planificadoHasta: "2026-09-14T15:00:00Z" }),
      ]),
      trabajo({ id: "futuro" }),
      trabajo({ id: "curso" }, [paso({ estado: "en_curso" })]),
      trabajo({ id: "terminado", fechaEntrega: "2026-09-01" }, [
        paso({ estado: "hecho" }),
      ]),
    ]);
    expect(grupos.map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ["blocked", ["bloqueado"]],
      ["waiting", []],
      ["delayed", ["tardio"]],
      ["today", ["hoy"]],
      ["active", ["curso"]],
      ["paused", []],
      ["not-started", ["futuro", "sin-fecha"]],
    ]);
  });

  it("muestra la estación manual aunque el próximo paso espere a un componente", () => {
    const item = trabajo({}, [
      paso({
        nodoClave: "revision",
        predecesorPasoIds: ["componente"],
        predecesoresSatisfechos: false,
      }),
    ]);
    expect(item.blocked).toBe(false);
    expect(item.state).toBe("waiting");
    expect(grupoDelTrabajo(item)).toBe("waiting");
    expect(item.currentStep).toBeUndefined();
    expect(estacionDelPasoVisible(item, [estacion()])).toBe("Pre-impresión");
  });

  it("al terminar el paso anterior conserva la fila y muestra el siguiente listo", () => {
    const antes = trabajo({}, [
      paso({ id: "primero", estado: "en_curso" }),
      paso({ id: "segundo", indice: 1 }),
    ]);
    const despues = trabajo({}, [
      paso({ id: "primero", estado: "hecho" }),
      paso({ id: "segundo", indice: 1 }),
    ]);
    expect(antes.state).toBe("active");
    expect(despues.id).toBe(antes.id);
    expect(despues.visibleStep?.paso.id).toBe("segundo");
    expect(despues.started).toBe(true);
    expect(despues.state).toBe("ready");
    expect(grupoDelTrabajo(despues)).toBe("not-started");
  });

  it.each(["2026-09-13", "2026-09-14"])(
    "mantiene Listo para iniciar dentro de la urgencia del paso %s",
    (fechaEntrega) => {
      const item = trabajo({}, [
        paso({ planificadoHasta: `${fechaEntrega}T15:00:00Z` }),
      ]);
      expect(item.state).toBe("ready");
      expect(grupoDelTrabajo(item)).toBe(
        fechaEntrega === "2026-09-14" ? "today" : "delayed",
      );
    },
  );

  it("distingue espera automática, bloqueo explícito y pausa, aun con una entrega vencida", () => {
    const espera = trabajo({ fechaEntrega: "2026-09-01" }, [
      paso({ nodoClave: "corte", predecesoresSatisfechos: false }),
    ]);
    const bloqueo = trabajo({}, [
      paso({ estado: "bloqueado", motivoBloqueo: "Máquina averiada" }),
    ]);
    const pausa = trabajo({}, [
      paso({ estado: "pausado", motivoPausa: "Fin de turno" }),
    ]);
    expect(grupoDelTrabajo(espera)).toBe("waiting");
    expect(espera.blockedReason).toBeNull();
    expect(espera.waitingReason).toContain("pasos anteriores");
    expect(grupoDelTrabajo(bloqueo)).toBe("blocked");
    expect(bloqueo.blockedReason).toBe("Máquina averiada");
    expect(bloqueo.waitingReason).toBeNull();
    expect(grupoDelTrabajo(pausa)).toBe("paused");
    expect(pausa.state).toBe("paused");
  });

  it("deja de esperar al cumplirse dependencias y requisitos, sin cambiar el pendiente persistido", () => {
    const gate = {
      id: "material",
      tipo: "MATERIAL" as const,
      estado: "PENDIENTE" as const,
      detalle: null,
      resueltoEl: null,
      resueltoPorNombre: null,
    };
    const pendiente = paso({
      nodoClave: "corte",
      predecesoresSatisfechos: false,
      gatesOperativos: [gate],
    });
    expect(trabajo({}, [pendiente]).state).toBe("waiting");
    pendiente.predecesoresSatisfechos = true;
    expect(trabajo({}, [pendiente]).waitingReason).toContain("material");
    pendiente.gatesOperativos = [{ ...gate, estado: "CUMPLIDO" }];
    pendiente.aprobacionesPendientes = ["Arte final"];
    expect(trabajo({}, [pendiente]).waitingReason).toContain(
      "Falta aprobación: Arte final",
    );
    pendiente.aprobacionesPendientes = [];
    expect(trabajo({}, [pendiente]).state).toBe("ready");
    expect(pendiente.estado).toBe("pendiente");
  });

  it("no anuncia listo un trabajo sin ruta o con una máquina sin estación", () => {
    expect(trabajo({ sinRuta: true }, []).state).toBe("waiting");
    const item = trabajo({}, [
      paso({ maquinaId: "maquina-no-asignada", requiereMaquina: true }),
    ]);
    expect(item.state).toBe("waiting");
    expect(item.waitingReason).toContain("estación activa");
    expect(item.blocked).toBe(false);
  });

  it("muestra el mismo paso que explica el bloqueo y prioriza una rama lista sobre otra en espera", () => {
    const first = paso({
      id: "primero",
      nodoClave: "a",
      predecesoresSatisfechos: true,
      aprobacionesPendientes: ["Arte"],
    });
    const second = paso({
      id: "segundo",
      indice: 1,
      nodoClave: "b",
      predecesoresSatisfechos: true,
    });
    expect(trabajo({}, [first, second]).visibleStep?.paso.id).toBe("segundo");
    const bloqueado = trabajo({}, [
      first,
      { ...second, estado: "bloqueado", motivoBloqueo: "Avería" },
    ]);
    expect(bloqueado.state).toBe("blocked");
    expect(bloqueado.visibleStep?.paso.id).toBe("segundo");
    const ejecutando = trabajo({}, [
      first,
      { ...second, estado: "en_curso", nombre: "Corte en ejecución" },
    ]);
    expect(ejecutando.state).toBe("active");
    expect(ejecutando.statusLine).toBe("Corte en ejecución · en curso");
  });

  it("un tercerizado pedido al proveedor no vuelve a Listos para iniciar", () => {
    expect(
      trabajo({}, [
        paso({ tipoEjecucion: "tercerizado", estadoCompra: "pedido" }),
      ]).state,
    ).toBe("active");
  });

  it("resuelve la máquina del paso bloqueado y no la estación de la familia", () => {
    const item = trabajo({}, [
      paso({ estado: "bloqueado", maquinaId: "laser", requiereMaquina: true }),
    ]);
    const laser = estacion({
      id: "taller",
      nombre: "Producción & Taller",
      familias: [],
      maquinas: [
        {
          id: "laser",
          codigo: "LASER",
          nombre: "Láser",
          activo: true,
          centroCostoId: null,
        },
      ],
    });
    expect(estacionDelPasoVisible(item, [estacion(), laser])).toBe(
      "Producción & Taller",
    );
    expect(estacionDelPasoVisible(item, [estacion()])).toBe("Sin estación");
  });

  it("distingue un proveedor externo de una estación sin configurar", () => {
    expect(
      estacionDelPasoVisible(
        trabajo({}, [paso({ tipoEjecucion: "tercerizado" })]),
        [estacion()],
      ),
    ).toBe("Proveedor tercerizado");
    expect(estacionDelPasoVisible(trabajo(), [])).toBe("Sin estación");
  });

  it("sin reparto automático muestra al operador real del paso visible, no de otras ramas", () => {
    const item = trabajo({}, [
      paso({
        id: "previo",
        estado: "hecho",
        mesaUsuarioNombre: "Operador anterior",
      }),
      paso({
        id: "uno",
        indice: 1,
        nodoClave: "a",
        predecesoresSatisfechos: true,
        estado: "en_curso",
        tramoAbierto: {
          usuarioNombre: "Ana",
          inicioEl: ahora.toISOString(),
          esMio: false,
        },
        mesaUsuarioNombre: "Otro usuario",
      }),
      paso({
        id: "dos",
        indice: 2,
        nodoClave: "b",
        predecesoresSatisfechos: true,
        mesaUsuarioNombre: "Ana",
      }),
      paso({
        id: "tres",
        indice: 3,
        nodoClave: "c",
        predecesoresSatisfechos: true,
        mesaUsuarioNombre: "Luis",
      }),
    ]);
    expect(operadoresDelTrabajo(item)).toEqual(["Ana"]);
    expect(operadoresDelTrabajo(trabajo())).toEqual([]);
  });
  it("muestra todas las personas asignadas sin confundirlas con quien ejecuta", () => {
    const item = trabajo({}, [
      paso({
        asignacionPersonal: {
          origen: "automatica",
          personas: [
            { empleadoId: "a", nombre: "Ana" },
            { empleadoId: "b", nombre: "Luis" },
          ],
          franjas: [],
          conflicto: null,
          esMia: true,
        },
        tramoAbierto: {
          usuarioNombre: "Reemplazo",
          inicioEl: ahora.toISOString(),
          esMio: false,
        },
      }),
    ]);
    expect(operadoresDelTrabajo(item)).toEqual(["Ana", "Luis"]);
    expect(trabajoAsignadoAMi(item)).toBe(true);
    expect(trabajoAsignadoAMi(trabajo())).toBe(false);
  });
});

describe("Personal de los pasos previos pendientes", () => {
  const asignacion = (...nombres: string[]) => ({
    origen: "automatica" as const,
    personas: nombres.map((nombre) => ({ empleadoId: nombre, nombre })),
    franjas: [],
    conflicto: null,
    esMia: false,
  });
  const esperando = (ids: string[]) =>
    trabajo({}, [
      paso({
        id: "esperando",
        nodoClave: "ensamble",
        predecesoresSatisfechos: false,
        predecesorPasoIds: ids,
        dependenciasPendientes: ids.map((id) => ({
          pasoId: id,
          pasoNombre: "Impresión",
          itemId: `componente-${id}`,
          itemNombre: `Componente ${id}`,
          loteNombre: "Lote A",
        })),
        asignacionPersonal: asignacion("Persona del paso que espera"),
      }),
    ]);
  const indice = (...pasos: TableroPasoData[]) =>
    new Map(pasos.map((p) => [p.id, p]));

  it("resuelve por ID los predecesores de otros trabajos, aunque no estén en las filas filtradas", () => {
    const item = esperando(["uno", "dos", "uno"]);
    const resultado = responsablesDeEspera(
      item,
      indice(
        paso({ id: "uno", asignacionPersonal: asignacion("Ana", "Luis") }),
        paso({ id: "dos", asignacionPersonal: asignacion("Carla") }),
      ),
    );
    expect(resultado.map((r) => [r.pasoId, r.texto])).toEqual([
      ["uno", "Ana · Luis"],
      ["dos", "Carla"],
    ]);
    expect(resultado[0].detalle).toContain("Componente uno");
    expect(resultado[0].detalle).toContain("Lote A");
  });

  it("separa cada dependencia en su propia línea y conserva otros requisitos pendientes", () => {
    const base = esperando(["uno", "dos"]);
    const pendiente = {
      ...base.visibleStep!.paso,
      gatesOperativos: [
        {
          id: "material",
          tipo: "MATERIAL" as const,
          estado: "PENDIENTE" as const,
          detalle: "Revisar stock; confirmar retiro",
          resueltoEl: null,
          resueltoPorNombre: null,
        },
      ],
      aprobacionesPendientes: ["Arte final"],
    };
    const vista = trabajo({}, [pendiente]);
    expect(vista.waitingReasons).toEqual([
      "Espera: Impresión · Componente uno · Lote A",
      "Espera: Impresión · Componente dos · Lote A",
      "Revisar stock; confirmar retiro",
      "Falta aprobación: Arte final",
    ]);
    expect(vista.waitingReason).toContain(
      "Componente uno · Lote A; Impresión · Componente dos",
    );
    expect(trabajo({}, [paso()]).waitingReasons).toEqual([]);
  });

  it("retira predecesores completados y diferencia falta de asignación de datos no disponibles", () => {
    const resultado = responsablesDeEspera(
      esperando(["hecho", "libre", "ausente"]),
      indice(
        paso({
          id: "hecho",
          estado: "hecho",
          asignacionPersonal: asignacion("Ana"),
        }),
        paso({ id: "libre" }),
      ),
    );
    expect(resultado.map((r) => r.texto)).toEqual([
      "Sin asignar",
      "Asignación no disponible",
    ]);
  });

  it("distingue un proveedor y conserva el respaldo de mesa en pasos históricos", () => {
    const resultado = responsablesDeEspera(
      esperando(["externo", "mesa"]),
      indice(
        paso({
          id: "externo",
          tipoEjecucion: "tercerizado",
          proveedorNombre: "Taller externo",
        }),
        paso({ id: "mesa", mesaUsuarioNombre: "Luis" }),
      ),
    );
    expect(resultado.map((r) => [r.texto, r.tercerizado])).toEqual([
      ["Proveedor: Taller externo", true],
      ["Luis", false],
    ]);
  });

  it("no atribuye una espera por requisitos al personal del propio paso", () => {
    const item = trabajo({}, [
      paso({
        nodoClave: "impresion",
        predecesoresSatisfechos: true,
        aprobacionesPendientes: ["Arte final"],
        asignacionPersonal: asignacion("Ana"),
      }),
    ]);
    expect(item.state).toBe("waiting");
    expect(responsablesDeEspera(item, indice(...item.data.pasos))).toEqual([]);
    expect(responsablesDeEspera(trabajo(), new Map())).toEqual([]);
  });

  it("al filtrar un paso futuro de una ruta lineal toma su predecesor inmediato", () => {
    const item = trabajo({}, [
      paso({ id: "primero", indice: 0, asignacionPersonal: asignacion("Ana") }),
      paso({
        id: "segundo",
        indice: 1,
        asignacionPersonal: asignacion("Luis"),
      }),
      paso({
        id: "tercero",
        indice: 2,
        asignacionPersonal: asignacion("Carla"),
      }),
    ]);
    const filtrado = buildItemView(
      item.data,
      [estacion()],
      zona,
      ahora,
      (p) => p.id === "tercero",
    );
    expect(
      responsablesDeEspera(filtrado, indice(...item.data.pasos)).map(
        (r) => r.texto,
      ),
    ).toEqual(["Luis"]);
  });
});

describe("Filtros de estación y personal", () => {
  const estaciones = [
    estacion(),
    estacion({
      id: "taller",
      nombre: "Taller",
      familias: ["corte_manual", "embalaje"],
    }),
  ];
  const filtros: FiltrosTrabajo = {
    query: "",
    estacionId: "",
    empleadoId: "",
    asignadasAMi: false,
  };
  const filtrar = (item: ItemViewFixture, cambios: Partial<FiltrosTrabajo>) =>
    filtrarTrabajos(
      [item],
      estaciones,
      { ...filtros, ...cambios },
      zona,
      ahora,
    );
  type ItemViewFixture = ReturnType<typeof trabajo>;
  const asignacion = (
    id: string,
    esMia = false,
  ): NonNullable<TableroPasoData["asignacionPersonal"]> => ({
    origen: "automatica",
    conflicto: null,
    esMia,
    personas: [{ empleadoId: id, nombre: "Mismo nombre" }],
    franjas: [],
  });
  const ruta = () =>
    trabajo({}, [
      paso({
        id: "diseno",
        nodoClave: "diseno",
        predecesorPasoIds: [],
        asignacionPersonal: asignacion("ana"),
      }),
      paso({
        id: "corte",
        indice: 1,
        nombre: "Corte manual",
        familiaCodigo: "corte_manual",
        nodoClave: "corte",
        predecesorPasoIds: ["diseno"],
        asignacionPersonal: asignacion("bruno", true),
      }),
      paso({
        id: "embalaje",
        indice: 2,
        nombre: "Embalaje",
        familiaCodigo: "embalaje",
        nodoClave: "embalaje",
        predecesorPasoIds: ["corte"],
        asignacionPersonal: asignacion("bruno", true),
      }),
    ]);
  it("muestra el paso de la estación en espera conservando las dependencias externas", () => {
    const item = ruta();
    const original = JSON.stringify(item.data);
    const [vista] = filtrar(item, { estacionId: "taller" });
    expect(vista.visibleStep?.paso.id).toBe("corte");
    expect(vista.state).toBe("waiting");
    expect(estacionDelPasoVisible(vista, estaciones)).toBe("Taller");
    expect(vista.steps).toHaveLength(3);
    expect(JSON.stringify(item.data)).toBe(original);
  });
  it("avanza de corte a embalaje sin duplicar la fila y la retira al terminar la estación", () => {
    const item = ruta();
    item.data.pasos[0].estado = "hecho";
    expect(filtrar(item, { estacionId: "taller" })[0].state).toBe("ready");
    item.data.pasos[1].estado = "hecho";
    const siguiente = filtrar(item, { estacionId: "taller" });
    expect(siguiente).toHaveLength(1);
    expect(siguiente[0].visibleStep?.paso.id).toBe("embalaje");
    expect(siguiente[0].state).toBe("ready");
    item.data.pasos[2].estado = "hecho";
    expect(filtrar(item, { estacionId: "taller" })).toEqual([]);
  });
  it("no atribuye a la estación el bloqueo explícito de un paso de otra estación", () => {
    const item = ruta();
    item.data.pasos[0].estado = "bloqueado";
    const [vista] = filtrar(item, { estacionId: "taller" });
    expect(vista.blocked).toBe(false);
    expect(vista.state).toBe("waiting");
  });
  it("prioriza una rama lista sobre otra pendiente de la misma estación", () => {
    const item = ruta();
    item.data.pasos[2].predecesorPasoIds = [];
    const [vista] = filtrar(item, { estacionId: "taller" });
    expect(vista.visibleStep?.paso.id).toBe("embalaje");
    expect(vista.state).toBe("ready");
  });
  it("busca por identidad de empleado, incluye pasos futuros y combina estación y asignadas a mí", () => {
    const item = ruta();
    const [vista] = filtrar(item, { empleadoId: "bruno", asignadasAMi: true });
    expect(vista.visibleStep?.paso.id).toBe("corte");
    expect(vista.state).toBe("waiting");
    expect(
      filtrar(item, { estacionId: "preprensa", empleadoId: "bruno" }),
    ).toEqual([]);
    expect(filtrar(item, { empleadoId: "ana", asignadasAMi: true })).toEqual(
      [],
    );
    expect(
      filtrar(item, {
        estacionId: "taller",
        empleadoId: "bruno",
        asignadasAMi: true,
      }),
    ).toHaveLength(1);
  });
  it("incluye a cualquiera de los operarios de una asignación compartida", () => {
    const item = ruta();
    item.data.pasos[1].asignacionPersonal!.personas.push({
      empleadoId: "carla",
      nombre: "Carla",
    });
    expect(filtrar(item, { empleadoId: "carla" })[0].visibleStep?.paso.id).toBe(
      "corte",
    );
  });
  it("conserva la búsqueda y calcula métricas sobre las filas visibles", () => {
    const item = ruta();
    expect(filtrar(item, { query: "no existe" })).toEqual([]);
    const resultado = filtrar(item, {
      query: " OT-2026-0001 ",
      estacionId: "taller",
    });
    expect(metricasTrabajos(resultado)).toMatchObject({
      all: 1,
      waiting: 1,
      ready: 0,
      blocked: 0,
    });
    expect(filtrar(item, {})).toEqual([item]);
  });
});

describe("Fechas operativas del paso visible", () => {
  it("clasifica por fin del paso aunque la entrega comercial sea en 15 días", () => {
    const item = trabajo({ fechaEntrega: "2026-09-29" }, [
      paso({ planificadoHasta: "2026-09-14T13:59:00Z" }),
    ]);
    expect(item.delayed).toBe(false);
    expect(item.stepDelayed).toBe(true);
    expect(grupoDelTrabajo(item)).toBe("delayed");
    expect(metricasTrabajos([item]).delayed).toBe(1);
    const futuro = trabajo({ fechaEntrega: "2026-09-01" });
    expect(futuro.delayed).toBe(true);
    expect(grupoDelTrabajo(futuro)).toBe("not-started");
  });
  it("distingue una hora vencida de una hora futura del mismo día", () => {
    const vencido = trabajo({}, [
      paso({ planificadoHasta: "2026-09-14T13:00:00Z" }),
    ]);
    const hoy = trabajo({}, [
      paso({ planificadoHasta: "2026-09-14T18:00:00Z" }),
    ]);
    expect(grupoDelTrabajo(vencido)).toBe("delayed");
    expect(grupoDelTrabajo(hoy)).toBe("today");
    expect(
      agruparTrabajos([hoy, vencido]).flatMap((g) => g.items),
    ).toHaveLength(2);
  });
  it("usa el día de la empresa y no la fecha UTC", () => {
    const item = trabajo({}, [
      paso({ planificadoHasta: "2026-09-15T01:00:00Z" }),
    ]);
    expect(item.stepDueDays).toBe(0);
    expect(grupoDelTrabajo(item)).toBe("today");
  });
  it("no inventa una referencia con la entrega comercial y conserva las esperas", () => {
    const sinReferencia = trabajo({ fechaEntrega: "2026-09-01" }, [
      paso({ planificadoHasta: null }),
    ]);
    expect(sinReferencia.stepPlannedEnd).toBeNull();
    expect(grupoDelTrabajo(sinReferencia)).toBe("not-started");
    const espera = trabajo({}, [
      paso({
        nodoClave: "corte",
        predecesoresSatisfechos: false,
        planificadoHasta: "2026-09-13T15:00:00Z",
      }),
    ]);
    expect(espera.stepDelayed).toBe(true);
    expect(grupoDelTrabajo(espera)).toBe("waiting");
  });
  it("al filtrar la estación toma la referencia del paso mostrado y no la del primero", () => {
    const item = trabajo({}, [
      paso({
        id: "diseno",
        nodoClave: "diseno",
        predecesorPasoIds: [],
        planificadoHasta: "2026-09-13T15:00:00Z",
      }),
      paso({
        id: "corte",
        indice: 1,
        nodoClave: "corte",
        predecesorPasoIds: [],
        familiaCodigo: "corte_manual",
        planificadoHasta: "2026-09-15T15:00:00Z",
      }),
    ]);
    const [vista] = filtrarTrabajos(
      [item],
      [estacion(), estacion({ id: "corte", familias: ["corte_manual"] })],
      { query: "", estacionId: "corte", empleadoId: "", asignadasAMi: false },
      zona,
      ahora,
    );
    expect(grupoDelTrabajo(item)).toBe("delayed");
    expect(vista.visibleStep?.paso.id).toBe("corte");
    expect(vista.stepPlannedEnd).toBe("2026-09-15T15:00:00.000Z");
    expect(grupoDelTrabajo(vista)).toBe("not-started");
  });
  it("en terminados usa el último cierre real, incluso en rutas con ramas paralelas", () => {
    const item = trabajo({}, [
      paso({
        id: "ultimo",
        indice: 0,
        estado: "hecho",
        completadoEl: "2026-09-14T13:00:00Z",
      }),
      paso({
        id: "primero",
        indice: 1,
        estado: "hecho",
        completadoEl: "2026-09-14T12:00:00Z",
      }),
    ]);
    expect(item.visibleStep?.paso.id).toBe("ultimo");
    expect(item.stepDelayed).toBe(false);
    expect(grupoDelTrabajo(item)).toBeNull();
  });
});


describe("acceso a Lista desde Estaciones", () => {
  const filtrar = (item: ReturnType<typeof trabajo>, estacionId: string, estaciones = [estacion()]) =>
    filtrarTrabajos([item], estaciones, { query: "", asignadasAMi: false, empleadoId: "", estacionId }, zona, ahora);

  it("separa tercerizados y pasos sin estación aun cuando coincida su familia", () => {
    const interno = trabajo({}, [paso()]);
    const externo = trabajo({}, [paso({ tipoEjecucion: "tercerizado" })]);
    const sinEstacion = trabajo({}, [paso({ maquinaId: "sin-configurar" })]);
    expect(filtrar(externo, "proveedor-tercerizado")).toHaveLength(1);
    expect(filtrar(externo, "preprensa")).toHaveLength(0);
    expect(filtrar(externo, "sin-estacion")).toHaveLength(0);
    expect(filtrar(interno, "proveedor-tercerizado")).toHaveLength(0);
    expect(filtrar(sinEstacion, "sin-estacion")).toHaveLength(1);
    expect(filtrar(interno, "sin-estacion", [estacion({ activo: false })])).toHaveLength(1);
  });

  it("muestra carga futura en espera y avanza la misma fila dentro del grupo externo", () => {
    const primero = paso({ id: "previo" });
    const externo = paso({ id: "externo", indice: 1, tipoEjecucion: "tercerizado" });
    const siguiente = paso({ id: "siguiente", indice: 2, tipoEjecucion: "tercerizado" });
    const antes = filtrar(trabajo({}, [primero, externo, siguiente]), "proveedor-tercerizado");
    expect(antes).toHaveLength(1);
    expect(antes[0].visibleStep?.paso.id).toBe("externo");
    expect(antes[0].state).toBe("waiting");
    const despues = filtrar(trabajo({}, [{ ...primero, estado: "hecho" }, { ...externo, estado: "hecho" }, siguiente]), "proveedor-tercerizado");
    expect(despues).toHaveLength(1);
    expect(despues[0].id).toBe(antes[0].id);
    expect(despues[0].visibleStep?.paso.id).toBe("siguiente");
  });

  it("no convierte una estación eliminada o inactiva en Todas las estaciones", () => {
    expect(filtrar(trabajo(), "eliminada")).toEqual([]);
    const inactiva = estacion({ activo: false });
    expect(filtrar(trabajo(), inactiva.id, [inactiva])).toEqual([]);
    expect(opcionesEstacionesTablero([inactiva], inactiva.id)).toContainEqual({ id: inactiva.id, nombre: "Pre-impresión · Inactiva" });
    expect(opcionesEstacionesTablero([], "eliminada")).toContainEqual({ id: "eliminada", nombre: "Estación no disponible" });
  });
});

describe("asignación voluntaria en Lista", () => {
  const asignacion = {
    origen: "automatica" as const,
    personas: [{ empleadoId: "ana", nombre: "Ana" }],
    franjas: [], conflicto: null, esMia: false,
  };
  it("permite tomar sólo pasos internos libres en estaciones habilitadas", () => {
    const libre = trabajo();
    expect(accionAsignacionManual(libre, [estacion()], true, ["preprensa"])).toBe("asignarme");
    expect(accionAsignacionManual(libre, [estacion()], false, null)).toBeNull();
    expect(accionAsignacionManual(libre, [estacion()], true, [])).toBeNull();
    expect(accionAsignacionManual(libre, [], true, [])).toBeNull();
    expect(accionAsignacionManual(libre, [], true, null)).toBe("asignarme");
  });
  it.each([
    { asignacionPersonal: asignacion },
    { mesaUsuarioNombre: "Otra persona" },
    { tipoEjecucion: "tercerizado" as const },
    { estado: "hecho" as const },
    { nodoClave: "futuro", predecesoresSatisfechos: false },
  ])("no reemplaza personal ni toma pasos no disponibles: %j", (datos) => {
    expect(accionAsignacionManual(trabajo({}, [paso(datos)]), [estacion()], true, null)).toBeNull();
  });
  it("permite devolver lo tomado por uno mismo después de proyectar su asignación manual", () => {
    const propia = trabajo({}, [paso({ mesaEsMia: true, mesaUsuarioNombre: "Ana", asignacionPersonal: { ...asignacion, origen: "manual", esMia: true } })]);
    expect(accionAsignacionManual(propia, [estacion()], true, [])).toBe("devolver");
    expect(accionAsignacionManual(propia, [estacion()], false, null)).toBeNull();
    expect(accionAsignacionManual(trabajo({}, [paso({ asignacionPersonal: { ...asignacion, esMia: true } })]), [estacion()], true, null)).toBeNull();
  });
});


describe("actualizaciones visibles de la Lista", () => {
  const version = (item = trabajo(), fecha = "2026-09-14T15:00:00Z") => revisionCeldasEnVivo(item, [estacion()], { fin: new Date(fecha), parcial: false }, []);
  const campos = (antes: ReturnType<typeof version>, despues: ReturnType<typeof version>) =>
    [...(celdasQueCambian(new Map([["trabajo", antes]]), new Map([["trabajo", despues]])).get("trabajo") ?? [])];

  it("ignora segundos dentro del minuto mostrado y anima sólo Real y Cumplimiento si avanzó la estimación", () => {
    expect(campos(version(trabajo(), "2026-09-14T15:00:05Z"), version(trabajo(), "2026-09-14T15:00:55Z"))).toEqual([]);
    expect(campos(version(), version(trabajo(), "2026-09-14T15:01:00Z"))).toEqual(["real", "cumplimiento"]);
  });
  it("incluye Estado únicamente cuando cambia el color de Listo para iniciar por la demora", () => {
    const item = trabajo({}, [paso({ planificadoHasta: "2026-09-14T15:00:00Z" })]);
    expect(campos(version(item), version(item, "2026-09-14T15:01:00Z"))).toEqual(["estado", "real", "cumplimiento"]);
    expect(campos(version(item, "2026-09-14T15:01:00Z"), version(item, "2026-09-14T15:02:00Z"))).toEqual(["real", "cumplimiento"]);
  });
  it("aísla los cambios de personal, nombre del paso, cantidad y progreso en sus celdas", () => {
    const actual = trabajo();
    expect(campos(version(actual), version(trabajo({}, [paso({ nombre: "Nuevo paso" })])))).toEqual(["paso"]);
    expect(campos(version(actual), version(trabajo({}, [paso({ mesaEsMia: true, mesaUsuarioNombre: "Ana" })])))).toEqual(["personal"]);
    expect(campos(version(actual), version({ ...actual, qtyLabel: "2 unidades" }))).toEqual(["cantidad"]);
    expect(campos(version(actual), version({ ...actual, progressPct: 25 }))).toEqual(["avance"]);
  });
  it("un cambio del responsable de una dependencia sólo anima la celda En espera", () => {
    const item = trabajo();
    const espera = { pasoId: "previo", detalle: "Corte", texto: "Ana", tercerizado: false };
    expect(campos(
      revisionCeldasEnVivo(item, [estacion()], undefined, [espera]),
      revisionCeldasEnVivo(item, [estacion()], undefined, [{ ...espera, texto: "Luis" }]),
    )).toEqual(["estado"]);
  });
  it("cambiar sólo de sección no hace parpadear campos que siguen iguales", () => {
    const item = trabajo();
    expect(campos(version(item), version({ ...item, stepDelayed: !item.stepDelayed, stepDueDays: 0 }))).toEqual([]);
  });
  it("mantiene Previsto quieto aunque cambie el contexto de la proyección", () => {
    const item = trabajo();
    const antes = revisionCeldasEnVivo(item, [estacion()], { fin: new Date("2026-09-14T15:00:00Z"), parcial: false }, []);
    const despues = revisionCeldasEnVivo(item, [estacion()], { fin: new Date("2026-09-14T15:00:30Z"), parcial: true }, []);
    expect(campos(antes, despues)).toEqual([]);
  });
  it("no anima altas, bajas ni otras filas al modificar un campo", () => {
    const base = version();
    const distinto = { ...base, personal: "otro personal" };
    const cambios = celdasQueCambian(new Map([["igual", base], ["cambia", base], ["sale", base]]), new Map([["igual", base], ["cambia", distinto], ["nueva", base]]));
    expect([...cambios].map(([id, celdas]) => [id, [...celdas]])).toEqual([["cambia", ["personal"]]]);
  });
});
