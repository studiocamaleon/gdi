import { evaluarJsonLogicBoolean } from "./json-logic";

type Paso = {
  id: string;
  rutaPasoId: string;
  modoActivacion?: string | null;
  condicionActivacionJson?: unknown;
};
const prefijo = "pasoActivo_";

function referencias(regla: unknown): string[] {
  if (Array.isArray(regla)) return regla.flatMap(referencias);
  if (!regla || typeof regla !== "object") return [];
  return Object.entries(regla).flatMap(([key, value]) => {
    if (key !== "var") return referencias(value);
    const variable = Array.isArray(value) ? value[0] : value;
    return typeof variable === "string" && variable.startsWith(prefijo)
      ? [variable.slice(prefijo.length)] : [];
  });
}

/** Vista previa de activación para campos condicionales. Los estados no se
 * serializan ni se guardan: el servidor vuelve a resolverlos por su cuenta. */
export function completarEstadosPasosContexto(
  pasos: Paso[],
  contexto: Record<string, unknown>,
  opcionalesEfectivos: Record<string, boolean>,
): void {
  const relacionados = pasos.filter(p => p.modoActivacion === "CONDICIONAL" && referencias(p.condicionActivacionJson).length);
  if (!relacionados.length) return;
  const porRuta = new Map(pasos.map(p => [p.rutaPasoId, p]));
  const estados = new Map<string, boolean>();
  const visitando = new Set<string>();
  const resolver = (id: string): boolean => {
    if (estados.has(id)) return estados.get(id)!;
    const paso = porRuta.get(id);
    if (!paso || visitando.has(id)) throw new Error("Relación de pasos inválida");
    visitando.add(id);
    const modo = paso.modoActivacion ?? "OBLIGATORIO";
    let activo = modo === "OBLIGATORIO" || (modo === "OPCIONAL" && opcionalesEfectivos[paso.id] === true);
    if (modo === "CONDICIONAL") {
      const ctx = { ...contexto };
      for (const ref of referencias(paso.condicionActivacionJson)) ctx[prefijo + ref] = resolver(ref) ? 1 : 0;
      activo = evaluarJsonLogicBoolean(paso.condicionActivacionJson, ctx, false);
    }
    visitando.delete(id);
    estados.set(id, activo);
    return activo;
  };
  try {
    relacionados.forEach(paso => resolver(paso.rutaPasoId));
  } catch {
    // La API informa la referencia inexistente o el ciclo; no inventar estados.
    return;
  }
  for (const [id, activo] of estados) Object.defineProperty(contexto, prefijo + id, {
    value: activo ? 1 : 0, enumerable: false, configurable: true,
  });
}
