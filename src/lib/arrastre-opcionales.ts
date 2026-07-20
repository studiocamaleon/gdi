/**
 * Arrastre entre opcionales, en el COTIZADOR.
 *
 * Espejo de `apps/api/src/motor-universal/arrastre-opcionales.ts`: un paso que
 * declara `requiereRutaPasoIds` enciende esos pasos al activarse, aunque sean
 * OPCIONALES y el comercial no los haya tildado (colocar ojales necesita el
 * refuerzo perimetral).
 *
 * El motor ya lo resolvía, pero el front no: por eso un paso arrastrado no
 * mostraba su card para completar los params, y sus valores tampoco viajaban en
 * `configPasoRuntime` —el filtro miraba sólo lo que había tildado el comercial—.
 *
 * Se duplica la lógica a propósito: el front necesita saber qué está activo
 * ANTES de cotizar, para renderizar los inputs. Si cambia el algoritmo, hay que
 * tocar los dos lados; por eso ambos tienen los mismos casos en sus tests.
 *
 * Ver docs/modificaciones-fisicas-lona-diseno.md
 */

export interface PasoParaArrastre {
  /** configPasoId — la clave de `opcionalesActivados`. */
  id: string;
  rutaPasoId: string;
  modoActivacion: string | null;
  requiereRutaPasoIds?: string[] | null;
}

/**
 * `opcionalesActivados` con los arrastres aplicados, de forma TRANSITIVA
 * (si A requiere B y B requiere C, activar A enciende los tres).
 *
 * Un paso en NO_EJECUTAR no se fuerza: el modelador lo apagó a propósito para
 * esta ruta. El motor reporta ese conflicto al cotizar.
 */
export function opcionalesActivadosEfectivos(
  configPasos: PasoParaArrastre[],
  activadosPorComercial: Record<string, boolean>,
): Record<string, boolean> {
  const porRutaPasoId = new Map(configPasos.map((p) => [p.rutaPasoId, p]));
  const resultado: Record<string, boolean> = { ...activadosPorComercial };

  const estaActivo = (paso: PasoParaArrastre) => {
    const modo = paso.modoActivacion ?? "OBLIGATORIO";
    if (modo === "NO_EJECUTAR") return false;
    if (modo === "OBLIGATORIO") return true;
    if (modo === "OPCIONAL") return resultado[paso.id] === true;
    // CONDICIONAL lo evalúa el motor contra el JobContext; acá no se anticipa.
    return false;
  };

  const procesados = new Set<string>();
  const pendientes = configPasos.filter(estaActivo);

  while (pendientes.length > 0) {
    const paso = pendientes.shift()!;
    if (procesados.has(paso.rutaPasoId)) continue;
    procesados.add(paso.rutaPasoId);

    for (const requeridoId of paso.requiereRutaPasoIds ?? []) {
      const requerido = porRutaPasoId.get(requeridoId);
      if (!requerido) continue;
      const modo = requerido.modoActivacion ?? "OBLIGATORIO";
      if (modo === "NO_EJECUTAR") continue;
      if (modo === "OPCIONAL") resultado[requerido.id] = true;
      if (!procesados.has(requerido.rutaPasoId)) pendientes.push(requerido);
    }
  }

  return resultado;
}

/** configPasoIds que se encendieron por arrastre y NO por el comercial. */
export function arrastradosPorDependencia(
  configPasos: PasoParaArrastre[],
  activadosPorComercial: Record<string, boolean>,
): Set<string> {
  const efectivos = opcionalesActivadosEfectivos(
    configPasos,
    activadosPorComercial,
  );
  const arrastrados = new Set<string>();
  for (const [configPasoId, activo] of Object.entries(efectivos)) {
    if (activo && activadosPorComercial[configPasoId] !== true) {
      arrastrados.add(configPasoId);
    }
  }
  return arrastrados;
}
