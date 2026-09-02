import type {
  TableroItemData,
  TableroPasoData,
  TableroPasoEstado,
} from "@/lib/tablero-produccion";

export type TipoNodoWorkflowOrden = "PASO" | "ETAPA" | "COMPONENTE";

export type NodoWorkflowOrden = {
  id: string;
  tipo: TipoNodoWorkflowOrden;
  item: TableroItemData;
  paso: TableroPasoData | null;
  nombre: string;
  estado: TableroPasoEstado;
  duracionEstimadaMin: number | null;
  progreso: {
    completos: number;
    total: number;
  } | null;
  predecesorIds: string[];
  nivel: number;
};

export type MomentoWorkflowOrden = {
  nivel: number;
  nodos: NodoWorkflowOrden[];
};

function estadoComponente(pasos: TableroPasoData[]): TableroPasoEstado {
  if (pasos.some((paso) => paso.estado === "bloqueado")) return "bloqueado";
  if (pasos.some((paso) => paso.estado === "en_curso")) return "en_curso";
  if (pasos.some((paso) => paso.estado === "pausado")) return "pausado";
  if (pasos.length > 0 && pasos.every((paso) => paso.estado === "hecho")) {
    return "hecho";
  }
  return "pendiente";
}

function idsSubarbol(items: TableroItemData[], raizId: string): Set<string> {
  const ids = new Set([raizId]);
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const item of items) {
      if (
        item.parentItemId &&
        ids.has(item.parentItemId) &&
        !ids.has(item.id)
      ) {
        ids.add(item.id);
        cambio = true;
      }
    }
  }
  return ids;
}

function ordenarEnMomentos(nodos: NodoWorkflowOrden[]): MomentoWorkflowOrden[] {
  const porId = new Map(nodos.map((nodo) => [nodo.id, nodo]));
  const pendientes = new Set(nodos.map((nodo) => nodo.id));
  const procesados = new Set<string>();

  while (pendientes.size > 0) {
    const listos = nodos.filter(
      (nodo) =>
        pendientes.has(nodo.id) &&
        nodo.predecesorIds
          .filter((id) => porId.has(id))
          .every((id) => procesados.has(id)),
    );

    // Una OT histórica puede traer una referencia que ya no existe. La vista
    // debe seguir siendo utilizable: preservamos el orden materializado para
    // lo que reste, sin inventar aristas nuevas.
    if (listos.length === 0) {
      const nivelFallback =
        Math.max(
          -1,
          ...nodos.filter((n) => procesados.has(n.id)).map((n) => n.nivel),
        ) + 1;
      nodos
        .filter((nodo) => pendientes.has(nodo.id))
        .sort(
          (a, b) =>
            a.item.itemIndice - b.item.itemIndice ||
            (a.paso?.indice ?? 0) - (b.paso?.indice ?? 0),
        )
        .forEach((nodo) => {
          nodo.nivel = nivelFallback;
          procesados.add(nodo.id);
          pendientes.delete(nodo.id);
        });
      break;
    }

    for (const nodo of listos) {
      const nivelesPredecesores = nodo.predecesorIds
        .map((id) => porId.get(id)?.nivel)
        .filter((nivel): nivel is number => nivel != null);
      nodo.nivel =
        nivelesPredecesores.length > 0
          ? Math.max(...nivelesPredecesores) + 1
          : 0;
      procesados.add(nodo.id);
      pendientes.delete(nodo.id);
    }
  }

  const porNivel = new Map<number, NodoWorkflowOrden[]>();
  for (const nodo of nodos) {
    const grupo = porNivel.get(nodo.nivel) ?? [];
    grupo.push(nodo);
    porNivel.set(nodo.nivel, grupo);
  }

  return [...porNivel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([nivel, grupo]) => ({
      nivel,
      nodos: grupo.sort(
        (a, b) =>
          a.item.itemIndice - b.item.itemIndice ||
          (a.paso?.indice ?? 0) - (b.paso?.indice ?? 0),
      ),
    }));
}

/**
 * Proyecta el Workflow de UN producto vendido de la OT.
 *
 * Un componente fabricado no se aplana como si sus pasos pertenecieran a la
 * ruta del padre: ocupa un único nodo en ese nivel y conserva su subruta en
 * su propio `OrdenTrabajoItem`. Las dependencias persistidas entre items se
 * contraen hacia ese nodo agregado, por lo que el DAG sigue siendo fiel.
 */
export function construirMomentosWorkflowOrden(
  items: TableroItemData[],
  raizId?: string,
): MomentoWorkflowOrden[] {
  const raices = items.filter((item) => !item.parentItemId);
  const raiz = raizId
    ? items.find((item) => item.id === raizId)
    : raices.length === 1
      ? raices[0]
      : null;
  if (!raiz) return [];

  const hijosDirectos = items.filter((item) => item.parentItemId === raiz.id);
  const pasoAComponente = new Map<string, string>();
  const pasosPorComponente = new Map<string, TableroPasoData[]>();

  for (const hijo of hijosDirectos) {
    const subarbol = idsSubarbol(items, hijo.id);
    const pasos = items
      .filter((item) => subarbol.has(item.id))
      .flatMap((item) => item.pasos);
    pasosPorComponente.set(hijo.id, pasos);
    for (const paso of pasos) pasoAComponente.set(paso.id, hijo.id);
  }

  const pasosRaiz = new Set(raiz.pasos.map((paso) => paso.id));
  const grafoExplicito = raiz.pasos.some(
    (paso) =>
      Boolean(paso.nodoClave) ||
      (paso.predecesorPasoIds?.length ?? 0) > 0 ||
      (paso.sucesorPasoIds?.length ?? 0) > 0,
  );

  const nodosPasos: NodoWorkflowOrden[] = raiz.pasos.map((paso, index) => {
    const predecesoresCrudos = grafoExplicito
      ? (paso.predecesorPasoIds ?? [])
      : index > 0
        ? [raiz.pasos[index - 1].id]
        : [];
    const predecesores = new Set<string>();
    for (const id of predecesoresCrudos) {
      const componenteId = pasoAComponente.get(id);
      predecesores.add(componenteId ? `componente:${componenteId}` : id);
    }
    const esEtapa =
      (paso.operacionesIncorporacionSnapshotJson?.length ?? 0) > 0;
    return {
      id: paso.id,
      tipo: esEtapa ? "ETAPA" : "PASO",
      item: raiz,
      paso,
      nombre: paso.nombre,
      estado: paso.estado,
      duracionEstimadaMin: paso.duracionEstimadaMin,
      progreso: null,
      predecesorIds: [...predecesores],
      nivel: 0,
    };
  });

  const nodosComponentes: NodoWorkflowOrden[] = hijosDirectos.map((hijo) => {
    const pasos = pasosPorComponente.get(hijo.id) ?? [];
    const idsPasos = new Set(pasos.map((paso) => paso.id));
    const predecesores = new Set<string>();

    // Sólo las aristas que entran desde fuera de la subruta definen la
    // ubicación del componente en la ruta padre. Las internas quedan dentro.
    for (const paso of pasos) {
      for (const predecesorId of paso.predecesorPasoIds ?? []) {
        if (idsPasos.has(predecesorId)) continue;
        const otroComponenteId = pasoAComponente.get(predecesorId);
        if (otroComponenteId && otroComponenteId !== hijo.id) {
          predecesores.add(`componente:${otroComponenteId}`);
        } else if (pasosRaiz.has(predecesorId)) {
          predecesores.add(predecesorId);
        }
      }
    }

    const duraciones = pasos
      .map((paso) => paso.duracionEstimadaMin)
      .filter((valor): valor is number => valor != null);
    return {
      id: `componente:${hijo.id}`,
      tipo: "COMPONENTE",
      item: hijo,
      paso: null,
      nombre: hijo.nombre,
      estado: estadoComponente(pasos),
      duracionEstimadaMin:
        duraciones.length > 0
          ? duraciones.reduce((total, valor) => total + valor, 0)
          : null,
      progreso: {
        completos: pasos.filter((paso) => paso.estado === "hecho").length,
        total: pasos.length,
      },
      predecesorIds: [...predecesores],
      nivel: 0,
    };
  });

  return ordenarEnMomentos([...nodosPasos, ...nodosComponentes]);
}
