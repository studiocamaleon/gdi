import { demandaDesdeTiempo, combinarDemandas, leerDemandaHumana } from "./demanda-humana";
import type { ItemHipotetico, PasoHipotetico } from "./flujo-produccion";

type Registro = Record<string, unknown>;
const registro = (v: unknown): Registro =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Registro) : {};
const lista = (v: unknown): Registro[] =>
  Array.isArray(v) ? v.map(registro) : [];
const texto = (v: unknown): string | null =>
  typeof v === "string" && v.length ? v : null;
const minutos = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
class ProyeccionIncompleta extends Error {}
function exigir(ok: unknown, mensaje: string): asserts ok {
  if (!ok) throw new ProyeccionIncompleta(mensaje);
}

/** Proyección ligera de la receta cotizada a la misma topología de la OT.
 * No copia geometría ni recalcula tiempos/costos. Las operaciones internas ya
 * están incluidas en totalMin del nodo que las ejecuta, como en la OT.
 */
export function itemHipoteticoDesdeCotizacion(
  id: string,
  cotizacion: unknown,
): ItemHipotetico {
  const nodos = new Map<string, Set<string>>();
  const activos = new Map<string, PasoHipotetico>();
  const fusiones: Array<{
    claves: string[];
    operativa: string;
    minutos: number;
  }> = [];
  function arista(desde: string, hasta: string) {
    exigir(
      nodos.has(desde) && nodos.has(hasta),
      "Falta un nodo de la receta para proyectar sus dependencias.",
    );
    nodos.get(hasta)!.add(desde);
  }
  function visitar(
    a: Registro,
    ambito: string,
    profundidad: number,
  ): { raices: string[]; terminales: string[]; porRuta: Map<string, string> } {
    exigir(
      profundidad < 10,
      "La composición supera la profundidad admitida para estimar fechas.",
    );
    const pasos = lista(a.pasos),
      hijos = lista(a.componentesFabricados ?? a.componentes);
    const grafo = registro(a.grafoProduccion),
      publicados = lista(grafo.nodos);
    exigir(
      !hijos.length || publicados.length,
      "Falta la receta completa de los componentes para estimar la entrega.",
    );
    const locales = publicados.length
      ? publicados.map((n) => texto(n.clave))
      : pasos.map((p, i) =>
          texto(p.rutaPasoId) ? `ruta:${p.rutaPasoId}` : `paso:${i}`,
        );
    exigir(
      locales.every(Boolean) && new Set(locales).size === locales.length,
      "Hay nodos sin identidad o repetidos en la receta.",
    );
    const clave = (k: string) => `${ambito}/${k}`;
    const ids = (locales as string[]).map(clave);
    ids.forEach((k) => nodos.set(k, new Set()));
    const edges = publicados.length
      ? lista(grafo.aristas)
      : ids
          .slice(1)
          .map((_, i) => ({
            desdeClave: locales[i],
            haciaClave: locales[i + 1],
          }));
    edges.forEach((e) =>
      arista(clave(String(e.desdeClave)), clave(String(e.haciaClave))),
    );
    const salientes = new Set(edges.map((e) => clave(String(e.desdeClave))));
    const raices = ids.filter((k) => nodos.get(k)!.size === 0);
    const terminales = ids.filter((k) => !salientes.has(k));
    const porRuta = new Map<string, string>();
    pasos.forEach((p, i) => {
      if (p.activado !== true) return;
      const opciones = publicados.length
        ? [`ruta:${p.rutaPasoId}`, `extra:${p.rutaPasoId}`].filter((k) =>
            locales.includes(k),
          )
        : [locales[i]!];
      exigir(
        opciones.length === 1,
        "Una operación no tiene un nodo inequívoco en la receta.",
      );
      const k = clave(opciones[0]),
        t = registro(p.tiempo);
      exigir(!activos.has(k), "Hay operaciones duplicadas en la receta.");
      const familia = texto(p.familiaCodigo) ?? "trabajo_manual";
      activos.set(k, {
        clave: k,
        predecesoras: [],
        familiaCodigo: familia,
        plantillaCodigo: texto(p.plantillaCodigo),
        tecnologia: texto(registro(p.nestingResult).tecnologia),
        maquinaId: texto(t.maquinaId),
        requiereMaquina: p.requiereMaquina === true,
        centroCostoId: texto(t.centroCostoId),
        duracionMin: minutos(t.totalMin),
        demandaHumana: demandaDesdeTiempo(t),
        nombre: texto(p.nombreVisible) ?? familia,
        tercerizado: p.tercerizado === true,
        plazoProveedorDias: minutos(p.plazoProveedorDias),
      });
      if (texto(p.rutaPasoId)) porRuta.set(String(p.rutaPasoId), k);
    });
    const ramas = new Map<string, ReturnType<typeof visitar>>();
    hijos.forEach((h, i) => {
      const codigo = texto(h.codigo);
      exigir(
        codigo && !ramas.has(codigo),
        "Hay componentes sin identidad o repetidos en la receta.",
      );
      const rama = visitar(h, `${ambito}/${i}:${codigo}`, profundidad + 1);
      ramas.set(codigo, rama);
      for (const previa of Array.isArray(h.nodosPredecesoresClaves)
        ? h.nodosPredecesoresClaves
        : []) {
        rama.raices.forEach((raiz) => arista(clave(String(previa)), raiz));
      }
      const incorporacion = texto(h.nodoIncorporacionClave);
      exigir(
        incorporacion && nodos.has(clave(incorporacion)),
        "Falta la incorporación de un componente a su producto.",
      );
      rama.terminales.forEach((terminal) =>
        arista(terminal, clave(incorporacion)),
      );
    });
    for (const g of lista(registro(a.analisisNestingCompuesto).grupos)) {
      if (registro(g.aplicacion).aplicado !== true) continue;
      const lote = registro(g.lote),
        participantes = lista(lote.participantes);
      const claves = participantes.map((p) =>
        ramas
          .get(String(p.componenteCodigo))
          ?.porRuta.get(String(p.rutaPasoId)),
      );
      const duracion = minutos(lote.duracionEstimadaMin);
      exigir(
        claves.length >= 2 && claves.every(Boolean) && duracion !== null,
        "Faltan datos del trabajo compartido para estimar su duración.",
      );
      const indice = participantes.findIndex((p) => p.esPasoOperativo === true);
      fusiones.push({
        claves: claves as string[],
        operativa: claves[Math.max(0, indice)]!,
        minutos: duracion,
      });
    }
    return { raices, terminales, porRuta };
  }
  try {
    exigir(cotizacion, "Falta la cotización para estimar la fecha.");
    visitar(registro(cotizacion), "producto", 0);
    // Primero deriva dependencias a través de opcionales omitidos. Un nodo
    // omitido puede habilitar componentes o recibirlos antes de otro nodo activo.
    const mem = new Map<string, Set<string>>(),
      visitando = new Set<string>();
    function anteriores(k: string): Set<string> {
      exigir(!visitando.has(k), "La receta tiene dependencias circulares.");
      if (mem.has(k)) return mem.get(k)!;
      visitando.add(k);
      const resultado = new Set<string>();
      for (const p of nodos.get(k)!) {
        const ancestros = anteriores(p); // También valida ciclos a través de nodos activos.
        if (activos.has(p)) resultado.add(p);
        else ancestros.forEach((a) => resultado.add(a));
      }
      visitando.delete(k);
      mem.set(k, resultado);
      return resultado;
    }
    nodos.forEach((_, k) => anteriores(k));
    const alias = new Map<string, string>();
    for (const f of fusiones) {
      f.claves.forEach((k) => {
        exigir(
          !alias.has(k),
          "Una operación pertenece a varios trabajos compartidos.",
        );
        alias.set(k, f.operativa);
      });
      activos.get(f.operativa)!.demandaHumana = combinarDemandas(f.claves.map(k => {
        const paso = activos.get(k)!;
        return leerDemandaHumana(paso.demandaHumana, paso.duracionMin ?? 0);
      }), f.minutos);
      activos.get(f.operativa)!.duracionMin = f.minutos;
    }
    const pendientes = new Map<string, Set<string>>();
    activos.forEach((_, k) => pendientes.set(alias.get(k) ?? k, new Set()));
    activos.forEach((_, k) => {
      const destino = alias.get(k) ?? k;
      for (const p of anteriores(k)) {
        const origen = alias.get(p) ?? p;
        exigir(
          origen !== destino,
          "El trabajo compartido tiene dependencias incompatibles.",
        );
        pendientes.get(destino)!.add(origen);
      }
    });
    const pasos: PasoHipotetico[] = [],
      resueltos = new Set<string>();
    while (pendientes.size) {
      const siguiente = [...pendientes].find(([, previas]) =>
        [...previas].every((k) => resueltos.has(k)),
      );
      exigir(siguiente, "La receta consolidada tiene dependencias circulares.");
      const [k, previas] = siguiente;
      pasos.push({ ...activos.get(k)!, predecesoras: [...previas] });
      resueltos.add(k);
      pendientes.delete(k);
    }
    return { id, pasos };
  } catch (error) {
    if (!(error instanceof ProyeccionIncompleta)) throw error;
    return { id, pasos: [], motivoSinEstimar: error.message };
  }
}
