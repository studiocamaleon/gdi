import { describe, expect, it } from "vitest";
import { calendarioDefault, type Estacion } from "./estaciones";
import type { ResultadoSimulacion, SimulacionItem } from "./flujo-produccion";
import { simularFlujo } from "./flujo-produccion";
import { construirEje } from "./eje-laboral";
import { partesEnZona } from "./zona";
import type { TableroItemData, TableroPasoData } from "./tablero-produccion";
import { abrirGruposRecorridoPlan, crearOperacionesPlan, dependenciasPlan, entregaFinal, estadoEntregaPlan, etaConjuntoPlan, filtrarGruposPlan, filtrarRecorridoPlan, gruposPorOrdenes, gruposPorRecursos, hitosEntregasPlan, minutosPlan, ordenarOperacionesPlan, periodoCalendarioPlan, plazoEntregaPlan, rangoRecorridoPlan } from "./planificacion-vista";

const zona = "America/Argentina/Buenos_Aires";
const ahora = new Date("2026-09-10T12:00:00Z");
const estacion: Estacion = {
  id: "impresion", nombre: "Impresión", descripcion: "", activo: true, etapa: "impresion", icono: null,
  capacidadConcurrente: 1, tiempoPreparacionMin: 0, calendario: calendarioDefault(), familias: ["imprimir"],
  empleados: [], maquinas: [{ id: "uv", codigo: "UV", nombre: "Impresora UV", centroCostoId: null }], createdAt: "", updatedAt: "",
};
function paso(id: string, otros: Partial<TableroPasoData> = {}): TableroPasoData {
  return { id, nodoClave: id, nombre: "Imprimir", indice: 0, familiaCodigo: "imprimir", categoriaFamilia: "", rutaPasoId: null,
    centroCostoId: null, centroCostoNombre: null, maquinaId: "uv", duracionEstimadaMin: 60, estado: "pendiente", motivoBloqueo: null,
    iniciadoEl: null, completadoEl: null, modoRegistro: "cronometro", tiempoRealMin: null, tiempoFuente: null,
    iniciadoPorNombre: null, completadoPorNombre: null, tramoAbierto: null, motivoPausa: null, tiempoAcumuladoMin: 0,
    mesaEsMia: false, mesaUsuarioNombre: null, tipoEjecucion: "interno", proveedorNombre: null, plazoProveedorDias: null, estadoCompra: null,
    predecesorPasoIds: [], ...otros };
}
function item(id: string, otros: Partial<TableroItemData> = {}): TableroItemData {
  return { id, ordenId: "ot1", ordenNumero: "OT-2026-0054", ordenEstado: "produccion", itemIndice: 1, codigo: "E", nombre: "Exhibidor",
    clienteNombre: "Gráfica", vendedorNombre: "", cantidad: 50, cantidadUnidad: "u.", fechaEntrega: "2026-09-17", specs: [], archivosCount: 0,
    sinRuta: false, pasos: [paso(`paso-${id}`)], ...otros };
}
function lote(id: string, esProductoDelLote: boolean) {
  return { id, nombre: `Lote ${id}`, cantidad: 50, unidad: "u.", productoNombre: "Exhibidor", esProductoDelLote };
}
function escenario(items: TableroItemData[], instante = ahora) {
  const simulacion = simularFlujo({ items, estaciones: [estacion], medianas: new Map(), noLaborables: new Set(), ahora: instante, zona });
  return { simulacion, operaciones: crearOperacionesPlan(items, [estacion], simulacion) };
}
const eta = (fecha: string, otros: Partial<SimulacionItem> = {}): SimulacionItem => ({ finEstimado: new Date(fecha), sinEstimar: false, parcial: false, asumeDesbloqueo: false, ...otros });

describe("modelo de consulta de Planificación", () => {
  it("muestra una entrega por lote, aunque pase por varias máquinas y componentes", () => {
    const items = ["A", "B"].flatMap((id, indice) => [
      item(`producto-${id}`, { parentItemId: "contenedor", loteEntrega: lote(id, true), fechaEntrega: `2026-09-${17 + indice}` }),
      item(`piezas-${id}`, { parentItemId: `producto-${id}`, loteEntrega: lote(id, false), fechaEntrega: `2026-09-${17 + indice}` }),
    ]);
    const { operaciones } = escenario(items);
    const ordenes = gruposPorOrdenes(operaciones, items);
    const hitos = hitosEntregasPlan(ordenes, new Set(operaciones.map(op => op.id)));
    expect(hitos.map(hito => [hito.lote, hito.fecha])).toEqual([["Lote A", "2026-09-17"], ["Lote B", "2026-09-18"]]);
    expect(hitos[0]).toMatchObject({ orden: "OT-2026-0054", cliente: "Gráfica", producto: "Exhibidor", detalle: "50 u." });
    expect(hitosEntregasPlan(ordenes, new Set(["paso-piezas-B"]))).toEqual([hitos[1]]);
  });

  it("conserva el compromiso del producto al filtrar un componente y omite fechas ausentes", () => {
    const items = [item("padre", { fechaEntrega: "2026-09-20" }),
      item("componente", { parentItemId: "padre", fechaEntrega: "2026-09-17" }),
      item("sin-fecha", { fechaEntrega: null })];
    const { operaciones } = escenario(items);
    const ordenes = gruposPorOrdenes(operaciones, items);
    const hitos = hitosEntregasPlan(ordenes, new Set(operaciones.map(op => op.id)));
    expect(hitos).toHaveLength(1);
    expect(hitos[0]).toMatchObject({ fecha: "2026-09-20", lote: null });
    expect(hitosEntregasPlan(ordenes, new Set(["paso-componente"]))).toEqual(hitos);
  });

  it("recorta el día actual a ahora aunque se solicite una fecha anterior", () => {
    const instante = new Date("2026-09-10T16:37:00Z");
    const periodo = periodoCalendarioPlan("2026-09-01", 7, instante, zona);
    expect(periodo).toEqual({ desde: "2026-09-10", hasta: "2026-09-16", inicio: instante });
    const eje = construirEje({ estaciones: [estacion], ahora: periodo.inicio, hasta: new Date("2026-09-16T21:00:00Z"), zona });
    expect(eje.dias[0].desdeMin).toBe(13 * 60 + 37);
    expect(eje.aX(instante)).toBe(0);
    expect(eje.aX(new Date("2026-09-10T16:52:00Z"))).toBe(15);
  });

  it("mantiene consultas futuras y usa el día local al pasar medianoche UTC", () => {
    const noche = new Date("2026-09-11T01:30:00Z");
    expect(periodoCalendarioPlan("2026-09-10", 7, noche, zona).desde).toBe("2026-09-10");
    const futura = periodoCalendarioPlan("2026-09-14", 7, noche, zona, "2026-09-23");
    expect(futura.hasta).toBe("2026-09-23");
    expect(partesEnZona(futura.inicio, zona).hh).toBe(0);
    expect(futura.inicio > noche).toBe(true);
    expect(periodoCalendarioPlan("2026-09-10", 7, new Date("2026-09-11T03:01:00Z"), zona).desde).toBe("2026-09-11");
  });

  it("después del cierre comienza en la próxima jornada y respeta feriados", () => {
    const instante = new Date("2026-09-11T22:00:00Z");
    const periodo = periodoCalendarioPlan("2026-09-11", 7, instante, zona);
    const eje = construirEje({ estaciones: [estacion], ahora: periodo.inicio, hasta: new Date("2026-09-17T21:00:00Z"), zona, noLaborables: new Set(["2026-09-14"]) });
    expect(eje.dias[0].fecha).toBe("2026-09-15");
    expect(eje.dias[0].desdeMin).toBe(9 * 60);
  });

  it("vuelve a proyectar pendientes vencidos desde ahora sin reducir la duración ni cambiar compromisos", () => {
    const instante = new Date("2026-09-10T16:30:00Z");
    const items = [item("vencido", { fechaEntrega: "2026-09-09", pasos: [paso("imprimir", { planificadoDesde: "2026-09-09T12:00:00Z" })] }),
      item("futuro", { pasos: [paso("reservado", { planificadoDesde: "2026-09-14T12:00:00Z" })] })];
    const original = JSON.stringify(items);
    for (const ahoraConsulta of [instante, new Date("2026-09-10T17:30:00Z")]) {
      const { operaciones } = escenario(items, ahoraConsulta);
      expect(operaciones[0].agenda!.inicio).toEqual(ahoraConsulta);
      expect(operaciones[0].agenda!.duracionMin).toBe(60);
      expect(operaciones[1].agenda!.inicio.getTime()).toBeGreaterThanOrEqual(Date.parse("2026-09-14T12:00:00Z"));
      expect(operaciones.every((op) => op.agenda!.inicio >= ahoraConsulta)).toBe(true);
    }
    expect(JSON.stringify(items)).toBe(original);
  });

  it("muestra desde ahora el restante de una tarea en curso y luego su dependiente, omitiendo las hechas", () => {
    const instante = new Date("2026-09-10T16:30:00Z");
    const items = [item("en-produccion", { pasos: [
      paso("hecho", { estado: "hecho", completadoEl: "2026-09-10T15:00:00Z" }),
      paso("curso", { indice: 1, estado: "en_curso", iniciadoEl: "2026-09-10T16:00:00Z", predecesorPasoIds: ["hecho"] }),
      paso("siguiente", { indice: 2, predecesorPasoIds: ["curso"] }),
    ] })];
    const { operaciones } = escenario(items, instante);
    expect(operaciones.map((op) => op.id)).toEqual(["curso", "siguiente"]);
    expect(operaciones[0].agenda).toMatchObject({ inicio: instante, duracionMin: 30, enCurso: true });
    expect(operaciones[1].agenda!.inicio >= operaciones[0].agenda!.fin).toBe(true);
  });

  it("agrupa cuatro lotes bajo un producto y conserva sus componentes sin duplicar tareas", () => {
    const items = ["A", "B", "C", "D"].flatMap((id, indice) => [
      item(`producto-${id}`, { parentItemId: "contenedor-no-visible", loteEntrega: lote(id, true), fechaEntrega: `2026-09-${17 + indice}` }),
      item(`piezas-${id}`, { parentItemId: `producto-${id}`, nombre: "Piezas de corrugado", loteEntrega: lote(id, false), fechaEntrega: `2026-09-${17 + indice}` }),
    ]);
    const { operaciones } = escenario(items);
    const grupos = gruposPorOrdenes(operaciones, items);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].hijos).toHaveLength(1);
    const lotes = grupos[0].hijos[0].hijos;
    expect(lotes.map((grupo) => grupo.nombre)).toEqual(["Lote A", "Lote B", "Lote C", "Lote D"]);
    expect(lotes.every((grupo) => grupo.hijos.length === 2)).toBe(true);
    expect(new Set(lotes.flatMap((grupo) => grupo.hijos.map((hijo) => hijo.operaciones[0].id))).size).toBe(8);
    expect(grupos[0].entrega).toBe("2026-09-20");
    const idsA = new Set(operaciones.filter((op) => op.item.loteEntrega?.id === "A").map((op) => op.id));
    const filtrados = filtrarRecorridoPlan(grupos, idsA);
    expect(filtrados[0].hijos[0].hijos.map((lote) => lote.nombre)).toEqual(["Lote A"]);
    expect(filtrados[0].operaciones[0].agenda).toBe(operaciones[0].agenda);
    const abiertos = abrirGruposRecorridoPlan(grupos, idsA);
    expect(abiertos["lote:A"]).toBe(true);
    expect(abiertos["lote:B"]).toBeUndefined();
  });

  it("no confunde productos de la misma OT ni inventa un lote para productos sin distribución", () => {
    const items = [item("uno"), item("dos", { itemIndice: 2 })];
    const { operaciones } = escenario(items);
    const grupos = gruposPorOrdenes(operaciones, items);
    expect(grupos[0].hijos).toHaveLength(2);
    expect(grupos[0].hijos.flatMap((grupo) => grupo.hijos).every((grupo) => grupo.tipo === "operacion")).toBe(true);
  });

  it("muestra preparación, impresión, corte y armado aunque el armado venga primero en el ítem padre", () => {
    const items = [item("padre", { pasos: [paso("preparar"), paso("armar", { indice: 1, predecesorPasoIds: ["cortar"] })] }),
      item("componente", { parentItemId: "padre", pasos: [paso("imprimir", { predecesorPasoIds: ["preparar"] }), paso("cortar", { indice: 1, predecesorPasoIds: ["imprimir"] })] })];
    const { operaciones } = escenario(items);
    expect(ordenarOperacionesPlan(operaciones).map((op) => op.id)).toEqual(["preparar", "imprimir", "cortar", "armar"]);
    expect(gruposPorOrdenes(operaciones, items)[0].hijos[0].hijos.map((fila) => fila.operaciones[0].id)).toEqual(["preparar", "imprimir", "cortar", "armar"]);
  });

  it("los dos modos comparten los mismos objetos de agenda y la búsqueda no libera capacidad", () => {
    const items = [item("primero", { ordenId: "primera", ordenNumero: "OT-primera" }), item("segundo", { ordenId: "segunda", ordenNumero: "OT-segunda" })];
    const { operaciones, simulacion } = escenario(items);
    const original = JSON.stringify(simulacion.traza);
    const recursos = gruposPorRecursos(operaciones, [estacion]);
    const ordenes = gruposPorOrdenes(operaciones, items);
    const filtrados = filtrarGruposPlan(recursos, "OT-segunda");
    expect(filtrados[0].operaciones).toEqual([operaciones[1]]);
    expect(filtrados[0].operaciones[0].agenda).toBe(ordenes[1].operaciones[0].agenda);
    expect(filtrados[0].operaciones[0].agenda!.inicio.getTime()).toBeGreaterThanOrEqual(operaciones[0].agenda!.fin.getTime());
    expect(JSON.stringify(simulacion.traza)).toBe(original);
    expect(minutosPlan(recursos[0].operaciones)).toBe(120);
    expect(filtrarGruposPlan(recursos, "grafica")[0].operaciones).toHaveLength(2);
  });

  it("la agrupación por máquina usa identidades reales sin convertir subfilas en puestos", () => {
    const { operaciones } = escenario([item("a"), item("b", { pasos: [paso("manual", { maquinaId: null })] })]);
    const grupos = gruposPorRecursos(operaciones, [estacion]);
    expect(grupos[0].hijos.map((hijo) => hijo.nombre)).toEqual(["Impresora UV", "Operaciones sin máquina"]);
    expect(grupos[0].hijos.flatMap((hijo) => hijo.operaciones)).toHaveLength(2);
  });

  it("conserva operaciones sin fecha con un motivo visible y omite las completadas", () => {
    const items = [item("sin-fecha", { pasos: [paso("pendiente"), paso("hecho", { estado: "hecho" })] })];
    const simulacion: ResultadoSimulacion = { traza: [], llegadasPorEstacion: new Map(), porItem: new Map([[items[0].id, { ...eta("2026-09-10T16:00Z"), sinEstimar: true, motivoSinEstimar: "No hay ventana disponible" }]]) };
    const operaciones = crearOperacionesPlan(items, [estacion], simulacion);
    expect(operaciones).toHaveLength(1);
    expect(operaciones[0]).toMatchObject({ agenda: null, motivo: "No hay ventana disponible", estacionId: estacion.id });
  });

  it("resalta sólo la cadena seleccionada; una dependencia compartida no arrastra otro lote", () => {
    const items = [item("a", { pasos: [paso("compartida"), paso("a", { indice: 1, predecesorPasoIds: ["compartida"] })] }),
      item("b", { pasos: [paso("b", { predecesorPasoIds: ["compartida"] })] })];
    const { operaciones } = escenario(items);
    expect([...dependenciasPlan(operaciones, "a")].sort()).toEqual(["a", "compartida"]);
    expect([...dependenciasPlan(operaciones, "compartida")].sort()).toEqual(["a", "b", "compartida"]);
  });

  it("no marca atraso por la medianoche UTC cuando la fecha local sigue siendo la prometida", () => {
    expect(estadoEntregaPlan(eta("2026-09-11T01:00:00Z"), "2026-09-10", zona)).toBe("prevista");
    expect(estadoEntregaPlan(eta("2026-09-11T12:00:00Z"), "2026-09-10", zona)).toBe("riesgo");
  });

  it("encuadra únicamente el recorrido seleccionado, respetando los días de la empresa", () => {
    const { operaciones } = escenario([item("a"), item("b"), item("otra-ot")]);
    const fechas = [
      ["2026-09-11T01:00:00Z", "2026-09-11T01:15:00Z"],
      ["2026-09-14T12:00:00Z", "2026-09-14T13:00:00Z"],
      ["2026-10-01T12:00:00Z", "2026-10-01T13:00:00Z"],
    ];
    const proyectadas = operaciones.map((op, indice) => ({ ...op, agenda: { ...op.agenda!, inicio: new Date(fechas[indice][0]), fin: new Date(fechas[indice][1]) } }));
    expect(rangoRecorridoPlan(proyectadas, new Set([operaciones[0].id, operaciones[1].id]), zona)).toEqual({ desde: "2026-09-10", hasta: "2026-09-14" });
    expect(rangoRecorridoPlan(proyectadas, new Set(), zona)).toBeNull();
  });

  it("una ETA parcial o desbloqueo supuesto se presenta como revisión y no como atraso confirmado", () => {
    expect(estadoEntregaPlan(eta("2026-09-18T12:00:00Z", { parcial: true }), "2026-09-10", zona)).toBe("revision");
    expect(estadoEntregaPlan(eta("2026-09-18T12:00:00Z", { asumeDesbloqueo: true }), "2026-09-10", zona)).toBe("revision");
  });

  it("una estimación orientativa no oculta una entrega vencida ni modifica la promesa", () => {
    const estimacion = eta("2026-09-14T13:31:00Z", { parcial: true });
    const compromiso = "2026-09-08";
    expect(estadoEntregaPlan(estimacion, compromiso, zona)).toBe("revision");
    expect(plazoEntregaPlan(estimacion, compromiso, new Date("2026-09-11T14:02:16Z"), zona)).toEqual({ vencida: true, fueraDeFecha: true });
    expect(plazoEntregaPlan(undefined, compromiso, ahora, zona)).toEqual({ vencida: true, fueraDeFecha: false });
    expect(estimacion.finEstimado?.toISOString()).toBe("2026-09-14T13:31:00.000Z");
  });

  it("distingue una fecha futura en riesgo de un compromiso ya vencido", () => {
    expect(plazoEntregaPlan(eta("2026-09-18T12:00:00Z", { parcial: true }), "2026-09-17", ahora, zona)).toEqual({ vencida: false, fueraDeFecha: true });
    expect(plazoEntregaPlan(eta("2026-09-17T22:00:00Z"), "2026-09-17", ahora, zona)).toEqual({ vencida: false, fueraDeFecha: false });
    expect(plazoEntregaPlan(eta("2026-09-17T22:00:00Z"), null, ahora, zona)).toEqual({ vencida: false, fueraDeFecha: false });
  });

  it("el vencimiento cambia al día siguiente en la zona del taller, no a medianoche UTC", () => {
    expect(plazoEntregaPlan(undefined, "2026-09-10", new Date("2026-09-11T01:30:00Z"), zona).vencida).toBe(false);
    expect(plazoEntregaPlan(undefined, "2026-09-10", new Date("2026-09-11T03:01:00Z"), zona).vencida).toBe(true);
  });

  it("el fin del lote incluye armado y la entrega final es la más lejana", () => {
    const items = [item("corte"), item("armado", { fechaEntrega: "2026-09-19" })];
    const simulacion: ResultadoSimulacion = { traza: [], llegadasPorEstacion: new Map(), porItem: new Map([
      ["corte", eta("2026-09-10T14:00:00Z")], ["armado", eta("2026-09-11T17:00:00Z")],
    ]) };
    expect(etaConjuntoPlan(items, simulacion).finEstimado?.toISOString()).toBe("2026-09-11T17:00:00.000Z");
    expect(entregaFinal(items)).toBe("2026-09-19");
    simulacion.porItem.set("armado", { ...eta("2026-09-11T17:00:00Z"), sinEstimar: true });
    expect(etaConjuntoPlan(items, simulacion)).toMatchObject({ finEstimado: null, sinEstimar: true });
  });
});
