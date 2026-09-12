import { etapaDeEstacion, type Estacion } from "./estaciones";
import type { PasoProgramado, ResultadoSimulacion, SimulacionItem } from "./flujo-produccion";
import { PROVEEDOR_KEY } from "./flujo-produccion";
import { motivoSinEstacion, resolverEstacionDePaso, SIN_ESTACION_KEY, type TableroItemData, type TableroPasoData } from "./tablero-produccion";
import { claveFechaEnZona, instanteDe, sumarDiasAClave } from "./zona";

/** Una consulta futura puede adelantar el calendario, pero nunca retroceder de ahora. */
export function periodoCalendarioPlan(desdeSolicitado: string, dias: number, ahora: Date, zona: string, hastaRecorrido?: string) {
  const hoy = claveFechaEnZona(ahora, zona);
  const desde = desdeSolicitado > hoy ? desdeSolicitado : hoy;
  const medianoche = instanteDe(desde, "00:00", zona);
  const inicio = medianoche > ahora ? medianoche : ahora;
  const hasta = hastaRecorrido && hastaRecorrido >= desde ? hastaRecorrido : sumarDiasAClave(desde, dias - 1);
  return { desde, hasta, inicio };
}

export type OperacionPlan = {
  id: string;
  item: TableroItemData;
  paso: TableroPasoData;
  agenda: PasoProgramado | null;
  estacionId: string;
  estacionNombre: string;
  maquinaNombre: string | null;
  productoId: string;
  productoNombre: string;
  predecesores: string[];
  motivo: string | null;
};

export type GrupoPlan = {
  id: string;
  nombre: string;
  detalle: string;
  tipo: "estacion" | "maquina" | "orden" | "producto" | "lote" | "operacion";
  operaciones: OperacionPlan[];
  hijos: GrupoPlan[];
  entrega: string | null;
};

export type HitoEntregaPlan = {
  id: string;
  fecha: string;
  orden: string;
  cliente: string;
  producto: string;
  lote: string | null;
  detalle: string;
};

/** Una entrega por lote o producto comercial, nunca una por componente o
 * máquina. El filtro sólo elige hitos; no cambia sus fechas comprometidas. */
export function hitosEntregasPlan(ordenes: GrupoPlan[], visibles: Set<string>): HitoEntregaPlan[] {
  return ordenes.flatMap(orden => orden.hijos.flatMap(producto => {
    const lotes = producto.hijos.filter(grupo => grupo.tipo === "lote");
    return (lotes.length ? lotes : [producto]).flatMap(grupo =>
      grupo.entrega && grupo.operaciones.some(op => visibles.has(op.id)) ? [{
        id: grupo.id, fecha: grupo.entrega.slice(0, 10), orden: orden.nombre, cliente: orden.detalle,
        producto: producto.nombre, lote: grupo.tipo === "lote" ? grupo.nombre : null, detalle: grupo.detalle,
      }] : []);
  })).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden.localeCompare(b.orden) || a.id.localeCompare(b.id));
}

/** Identidad del producto comercial, aun cuando su contenedor no integra el tablero. */
function productoRaiz(item: TableroItemData, items: Map<string, TableroItemData>) {
  let actual = item;
  const visitados = new Set([item.id]);
  while (actual.parentItemId && !visitados.has(actual.parentItemId)) {
    visitados.add(actual.parentItemId);
    const padre = items.get(actual.parentItemId);
    if (!padre) return { id: actual.parentItemId, nombre: item.loteEntrega?.productoNombre ?? actual.componenteDe?.nombre ?? actual.nombre };
    actual = padre;
  }
  return { id: actual.id, nombre: item.loteEntrega?.productoNombre ?? actual.nombre };
}

export function crearOperacionesPlan(items: TableroItemData[], estaciones: Estacion[], simulacion: ResultadoSimulacion): OperacionPlan[] {
  const porItem = new Map(items.map((item) => [item.id, item]));
  const agendas = new Map(simulacion.traza.map((paso) => [paso.pasoId, paso]));
  const porEstacion = new Map(estaciones.map((estacion) => [estacion.id, estacion]));
  const maquinas = new Map(estaciones.flatMap((estacion) => estacion.maquinas.map((maquina) => [maquina.id, maquina.nombre] as const)));
  return items.flatMap((item) => {
    const producto = productoRaiz(item, porItem);
    const pasos = [...item.pasos].sort((a, b) => a.indice - b.indice);
    return pasos.filter((paso) => paso.estado !== "hecho").map((paso) => {
      const agenda = agendas.get(paso.id) ?? null;
      const estacionId = agenda?.estacionKey ?? (paso.tipoEjecucion === "tercerizado" ? PROVEEDOR_KEY : resolverEstacionDePaso(estaciones, paso)?.id ?? SIN_ESTACION_KEY);
      const estacion = porEstacion.get(estacionId);
      const eta = simulacion.porItem.get(item.id);
      const anterior = pasos[pasos.findIndex((p) => p.id === paso.id) - 1];
      return {
        id: paso.id, item, paso, agenda, estacionId,
        estacionNombre: estacion?.nombre ?? (estacionId === PROVEEDOR_KEY ? "Proveedores externos" : "Sin estación"),
        maquinaNombre: paso.maquinaId ? maquinas.get(paso.maquinaId) ?? "Máquina sin identificar" : null,
        productoId: producto.id, productoNombre: producto.nombre,
        predecesores: agenda?.predecesorPasoIds ?? (paso.nodoClave ? paso.predecesorPasoIds ?? [] : anterior ? [anterior.id] : []),
        motivo: motivoSinEstacion(estaciones, paso) ?? (agenda ? null : eta?.motivoSinEstimar ?? (paso.duracionEstimadaMin == null ? "Falta una duración para estimar esta operación." : "No hay una ventana disponible o sus dependencias aún no tienen fecha.")),
      };
    });
  });
}

function agrupar<T>(valores: T[], clave: (valor: T) => string) {
  const grupos = new Map<string, T[]>();
  for (const valor of valores) {
    const id = clave(valor);
    if (!grupos.has(id)) grupos.set(id, []);
    grupos.get(id)!.push(valor);
  }
  return grupos;
}

/** Orden de lectura del flujo: nunca pone el armado antes del corte por venir del ítem padre. */
export function ordenarOperacionesPlan(operaciones: OperacionPlan[]): OperacionPlan[] {
  const porId = new Map(operaciones.map((op) => [op.id, op]));
  const resultado: OperacionPlan[] = [];
  const comparar = (a: OperacionPlan, b: OperacionPlan) =>
    (a.agenda?.inicio.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.agenda?.inicio.getTime() ?? Number.MAX_SAFE_INTEGER) ||
    a.paso.indice - b.paso.indice || a.id.localeCompare(b.id);
  const restantes = new Map<string, number>();
  const sucesores = new Map<string, string[]>();
  for (const op of operaciones) {
    const previos = [...new Set(op.predecesores.filter((id) => porId.has(id)))];
    restantes.set(op.id, previos.length);
    for (const id of previos) sucesores.set(id, [...(sucesores.get(id) ?? []), op.id]);
  }
  const disponibles = operaciones.filter((op) => restantes.get(op.id) === 0).sort(comparar);
  for (let indice = 0; indice < disponibles.length; indice++) {
    const op = disponibles[indice];
    resultado.push(op);
    for (const id of sucesores.get(op.id) ?? []) {
      const cantidad = restantes.get(id)! - 1;
      restantes.set(id, cantidad);
      if (cantidad) continue;
      const siguiente = porId.get(id)!;
      let desde = indice + 1, hasta = disponibles.length;
      while (desde < hasta) {
        const medio = (desde + hasta) >>> 1;
        if (comparar(disponibles[medio], siguiente) <= 0) desde = medio + 1;
        else hasta = medio;
      }
      disponibles.splice(desde, 0, siguiente);
    }
  }
  // Una inconsistencia del grafo no debe colgar la consulta ni ocultar operaciones.
  if (resultado.length < operaciones.length) {
    const emitidas = new Set(resultado.map((op) => op.id));
    resultado.push(...operaciones.filter((op) => !emitidas.has(op.id)).sort(comparar));
  }
  return resultado;
}

export function entregaFinal(items: Pick<TableroItemData, "fechaEntrega">[]): string | null {
  return items.reduce<string | null>((fin, item) => {
    const fecha = item.fechaEntrega?.slice(0, 10) ?? null;
    return fecha && (!fin || fecha > fin) ? fecha : fin;
  }, null);
}

export function gruposPorRecursos(operaciones: OperacionPlan[], estaciones: Estacion[]): GrupoPlan[] {
  const agrupadas = agrupar(operaciones, (op) => op.estacionId);
  const ordenadas = [...estaciones].sort((a, b) => etapaDeEstacion(a.etapa).order - etapaDeEstacion(b.etapa).order || a.nombre.localeCompare(b.nombre, "es"));
  const orden = new Map(ordenadas.map((estacion, indice) => [estacion.id, indice]));
  return [...agrupadas].sort(([a], [b]) => (orden.get(a) ?? Infinity) - (orden.get(b) ?? Infinity)).map(([id, ops]) => {
    const estacion = estaciones.find((e) => e.id === id);
    const porMaquina = agrupar(ops, (op) => op.paso.maquinaId ?? "manual");
    const hijos: GrupoPlan[] = [...porMaquina].map(([maquinaId, operaciones]) => ({
      id: `recurso:${id}:maquina:${maquinaId}`, nombre: operaciones[0].maquinaNombre ?? "Operaciones sin máquina",
      detalle: `${operaciones.length} operaciones`, tipo: "maquina", operaciones, hijos: [], entrega: null,
    }));
    return {
      id: `recurso:${id}`, nombre: ops[0].estacionNombre, tipo: "estacion", operaciones: ops,
      detalle: estacion?.equipoProduccion?.nombre ?? (id === PROVEEDOR_KEY ? "Plazos de proveedores" : "Equipo sin configurar"),
      hijos: ops.some((op) => op.paso.maquinaId) ? hijos : [], entrega: null,
    };
  });
}

export function gruposPorOrdenes(operaciones: OperacionPlan[], items: TableroItemData[]): GrupoPlan[] {
  const porOrden = agrupar(items, (item) => item.ordenId);
  const hoja = (op: OperacionPlan): GrupoPlan => ({
    id: `operacion:${op.id}`, nombre: op.paso.nombre,
    detalle: [op.item.loteEntrega?.esProductoDelLote || !op.item.parentItemId ? null : op.item.nombre, op.maquinaNombre ?? op.estacionNombre].filter(Boolean).join(" · "),
    tipo: "operacion", operaciones: [op], hijos: [], entrega: null,
  });
  return [...agrupar(operaciones, (op) => op.item.ordenId)].map(([id, ops]) => ({
    id: `orden:${id}`, nombre: ops[0].item.ordenNumero, detalle: ops[0].item.clienteNombre,
    tipo: "orden" as const, operaciones: ops, entrega: entregaFinal(porOrden.get(id) ?? []),
    hijos: [...agrupar(ops, (op) => op.productoId)].map(([productoId, productoOps]) => {
      const lotes = [...agrupar(productoOps.filter((op) => op.item.loteEntrega), (op) => op.item.loteEntrega!.id)].map(([loteId, loteOps]): GrupoPlan => {
        const lote = loteOps[0].item.loteEntrega!;
        return { id: `lote:${loteId}`, nombre: lote.nombre, detalle: `${lote.cantidad} ${lote.unidad}`,
          tipo: "lote", operaciones: loteOps, hijos: ordenarOperacionesPlan(loteOps).map(hoja), entrega: entregaFinal(loteOps.map((op) => op.item)) };
      });
      return { id: `producto:${id}:${productoId}`, nombre: productoOps[0].productoNombre,
        detalle: lotes.length ? `${lotes.length} lotes de entrega` : `${productoOps[0].item.cantidad} ${productoOps[0].item.cantidadUnidad}`,
        tipo: "producto" as const, operaciones: productoOps,
        hijos: [...ordenarOperacionesPlan(productoOps.filter((op) => !op.item.loteEntrega)).map(hoja), ...lotes.sort((a, b) => (a.entrega ?? "9999").localeCompare(b.entrega ?? "9999") || a.nombre.localeCompare(b.nombre, "es", { numeric: true }))],
        entrega: entregaFinal(productoOps.map((op) => op.item)),
      };
    }),
  })).sort((a, b) => (a.entrega ?? "9999").localeCompare(b.entrega ?? "9999") || a.nombre.localeCompare(b.nombre));
}

/** La búsqueda sólo recorta el árbol visible. No invoca ni modifica el ETA. */
export function filtrarGruposPlan(grupos: GrupoPlan[], consulta: string): GrupoPlan[] {
  const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const texto = normalizar(consulta.trim());
  if (!texto) return grupos;
  return grupos.flatMap((grupo) => {
    const operaciones = grupo.operaciones.filter((op) => normalizar([
      op.item.ordenNumero, op.item.clienteNombre, op.productoNombre, op.item.nombre,
      op.item.loteEntrega?.nombre, op.paso.nombre, op.estacionNombre, op.maquinaNombre,
    ].join(" ")).includes(texto));
    if (!operaciones.length) return [];
    return [{ ...grupo, operaciones, hijos: filtrarGruposPlan(grupo.hijos, consulta) }];
  });
}

export function filtrarRecorridoPlan(grupos: GrupoPlan[], ids: Set<string>): GrupoPlan[] {
  return grupos.flatMap((grupo) => {
    const operaciones = grupo.operaciones.filter((op) => ids.has(op.id));
    return operaciones.length ? [{ ...grupo, operaciones, hijos: filtrarRecorridoPlan(grupo.hijos, ids) }] : [];
  });
}

export function abrirGruposRecorridoPlan(grupos: GrupoPlan[], ids: Set<string>): Record<string, boolean> {
  const abiertos: Record<string, boolean> = {};
  for (const grupo of grupos) {
    if (grupo.hijos.length && grupo.operaciones.some((op) => ids.has(op.id))) {
      abiertos[grupo.id] = true;
      Object.assign(abiertos, abrirGruposRecorridoPlan(grupo.hijos, ids));
    }
  }
  return abiertos;
}

export function rangoRecorridoPlan(operaciones: OperacionPlan[], ids: Set<string>, zona: string) {
  const agendas = operaciones.flatMap((op) => ids.has(op.id) && op.agenda ? [op.agenda] : []);
  if (!agendas.length) return null;
  return {
    desde: claveFechaEnZona(new Date(Math.min(...agendas.map((agenda) => agenda.inicio.getTime()))), zona),
    hasta: claveFechaEnZona(new Date(Math.max(...agendas.map((agenda) => agenda.fin.getTime()))), zona),
  };
}

/** Sólo ancestros/sucesores de la selección; no incluye las rutas de otros lotes por compartir OT. */
export function dependenciasPlan(operaciones: OperacionPlan[], seleccionId: string | null): Set<string> {
  if (!seleccionId) return new Set();
  const porId = new Map(operaciones.map((op) => [op.id, op]));
  const sucesores = new Map<string, string[]>();
  for (const op of operaciones) for (const id of op.predecesores) sucesores.set(id, [...(sucesores.get(id) ?? []), op.id]);
  const resultado = new Set([seleccionId]);
  const recorrer = (id: string, vecinos: (id: string) => string[], vistos = new Set<string>()) => {
    if (vistos.has(id)) return;
    vistos.add(id);
    for (const vecino of vecinos(id)) {
      if (porId.has(vecino)) resultado.add(vecino);
      recorrer(vecino, vecinos, vistos);
    }
  };
  recorrer(seleccionId, (id) => porId.get(id)?.predecesores ?? []);
  recorrer(seleccionId, (id) => sucesores.get(id) ?? []);
  return resultado;
}

export function estadoEntregaPlan(eta: SimulacionItem | undefined, entrega: string | null, zona: string): "revision" | "riesgo" | "prevista" {
  if (!eta?.finEstimado || !Number.isFinite(eta.finEstimado.getTime()) || eta.sinEstimar || eta.parcial || eta.asumeDesbloqueo) return "revision";
  return entrega && claveFechaEnZona(eta.finEstimado, zona) > entrega.slice(0, 10) ? "riesgo" : "prevista";
}

/** La certeza del ETA y el cumplimiento del compromiso son datos distintos.
 * Una proyección orientativa no oculta una fecha que ya pasó, ni cambia la
 * promesa guardada para hacerla coincidir con el calendario productivo. */
export function plazoEntregaPlan(eta: SimulacionItem | undefined, entrega: string | null, ahora: Date, zona: string) {
  const fecha = entrega?.slice(0, 10) ?? null;
  const fin = eta?.finEstimado;
  return {
    vencida: !!fecha && fecha < claveFechaEnZona(ahora, zona),
    fueraDeFecha: !!fecha && !!fin && !eta?.sinEstimar && Number.isFinite(fin.getTime()) && claveFechaEnZona(fin, zona) > fecha,
  };
}

/** Fin del conjunto completo: el corte de un componente no equivale a tener listo el lote. */
export function etaConjuntoPlan(items: TableroItemData[], simulacion: ResultadoSimulacion): SimulacionItem {
  const estimaciones = items.map((item): SimulacionItem | undefined => {
    const pendiente = simulacion.porItem.get(item.id);
    if (pendiente) return pendiente;
    if (item.pasos.length && item.pasos.every((paso) => paso.estado === "hecho" && paso.completadoEl)) {
      return { finEstimado: new Date(Math.max(...item.pasos.map((paso) => Date.parse(paso.completadoEl!)))), sinEstimar: false, parcial: false, asumeDesbloqueo: false };
    }
    return undefined;
  });
  const incompleta = !estimaciones.length || estimaciones.some((eta) => !eta?.finEstimado || eta.sinEstimar);
  return {
    finEstimado: incompleta ? null : new Date(Math.max(...estimaciones.map((eta) => eta!.finEstimado!.getTime()))),
    sinEstimar: incompleta,
    parcial: estimaciones.some((eta) => !eta || eta.parcial),
    asumeDesbloqueo: estimaciones.some((eta) => eta?.asumeDesbloqueo),
  };
}

export function minutosPlan(operaciones: OperacionPlan[]): number {
  return operaciones.reduce((total, op) => total + (op.agenda?.duracionMin ?? 0), 0);
}
