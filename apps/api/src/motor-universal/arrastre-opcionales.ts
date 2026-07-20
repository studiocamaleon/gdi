/**
 * Arrastre entre opcionales: un paso que, al activarse, enciende otros.
 *
 * El caso que lo motivó: colocar ojales necesita el refuerzo perimetral. No
 * alcanzaba con poner el refuerzo en CONDICIONAL —los modos de activación son
 * excluyentes, así que el comercial perdía la posibilidad de pedir refuerzo
 * solo, y un producto que sólo ofrece refuerzo quedaba sin forma de expresarse.
 *
 * Lo que se declara NO es un modo de activación sino una IMPLICACIÓN: el paso
 * requerido sigue siendo OPCIONAL y se puede activar por su cuenta.
 *
 * Se resuelve en una pasada PREVIA al bucle porque la dependencia apunta hacia
 * ATRÁS en la ruta: el refuerzo (paso 1) corre antes que los ojales (paso 3),
 * así que cuando el motor llega a los ojales ya es tarde para encender el
 * refuerzo.
 *
 * Ver `docs/modificaciones-fisicas-lona-diseno.md`.
 */

export interface PasoParaArrastre {
  rutaPasoId: string;
  configPasoId: string;
  nombreVisible?: string | null;
  familiaCodigo: string;
  modoActivacion?: string | null;
  requiereRutaPasoIds?: string[];
}

export interface ArrastreAplicado {
  /** Paso que quedó encendido. */
  configPasoId: string;
  rutaPasoId: string;
  /** Paso que lo exigió, para poder explicarlo en el cotizador. */
  requeridoPorConfigPasoId: string;
  requeridoPorNombre: string;
}

export interface ResultadoArrastre {
  /** `opcionalesActivados` con los arrastres ya aplicados. */
  opcionalesActivados: Record<string, boolean>;
  arrastres: ArrastreAplicado[];
  /** Pasos exigidos que NO se pudieron encender, con el motivo. */
  conflictos: Array<{
    rutaPasoId: string;
    requeridoPorNombre: string;
    motivo: string;
  }>;
}

/**
 * Nombre para mostrarle al comercial. Sin `nombreVisible` cae al código de
 * familia, pero humanizado: `colocacion_ojales` en crudo no se le muestra a
 * nadie.
 */
function nombreDe(paso: PasoParaArrastre): string {
  const propio = paso.nombreVisible?.trim();
  if (propio) return propio;
  const humanizado = paso.familiaCodigo.replace(/_/g, ' ');
  return humanizado.charAt(0).toUpperCase() + humanizado.slice(1);
}

/**
 * Resuelve los arrastres de forma TRANSITIVA: si A requiere B y B requiere C,
 * activar A enciende los tres. Un ciclo (A↔B) no cuelga: cada paso se procesa
 * una sola vez.
 *
 * Un paso en NO_EJECUTAR no se fuerza: el modelador lo apagó explícitamente
 * para esta ruta y encenderlo por la ventana sería peor. Se reporta como
 * conflicto para que la cotización lo pueda avisar.
 */
export function resolverArrastreOpcionales(
  pasos: PasoParaArrastre[],
  opcionalesActivados: Record<string, boolean>,
): ResultadoArrastre {
  const porRutaPasoId = new Map(pasos.map((p) => [p.rutaPasoId, p]));
  const resultado: Record<string, boolean> = { ...opcionalesActivados };
  const arrastres: ArrastreAplicado[] = [];
  const conflictos: ResultadoArrastre['conflictos'] = [];

  const estaActivo = (paso: PasoParaArrastre) => {
    const modo = paso.modoActivacion ?? 'OBLIGATORIO';
    if (modo === 'NO_EJECUTAR') return false;
    if (modo === 'OBLIGATORIO') return true;
    if (modo === 'OPCIONAL') return resultado[paso.configPasoId] === true;
    // CONDICIONAL depende del JobContext y lo evalúa el motor paso a paso; no
    // podemos anticiparlo acá, así que no arrastra.
    return false;
  };

  const procesados = new Set<string>();
  // Cola con los pasos ya activos; cada uno puede encender a otros, y esos
  // otros a su vez arrastran (transitividad).
  const pendientes = pasos.filter(estaActivo);

  while (pendientes.length > 0) {
    const paso = pendientes.shift()!;
    if (procesados.has(paso.rutaPasoId)) continue;
    procesados.add(paso.rutaPasoId);

    for (const requeridoId of paso.requiereRutaPasoIds ?? []) {
      const requerido = porRutaPasoId.get(requeridoId);
      if (!requerido) {
        conflictos.push({
          rutaPasoId: requeridoId,
          requeridoPorNombre: nombreDe(paso),
          motivo: 'El paso requerido no está en esta ruta',
        });
        continue;
      }
      const modo = requerido.modoActivacion ?? 'OBLIGATORIO';
      if (modo === 'NO_EJECUTAR') {
        conflictos.push({
          rutaPasoId: requeridoId,
          requeridoPorNombre: nombreDe(paso),
          motivo: `"${nombreDe(requerido)}" está en NO EJECUTAR para esta ruta`,
        });
        continue;
      }
      if (modo === 'OPCIONAL' && resultado[requerido.configPasoId] !== true) {
        resultado[requerido.configPasoId] = true;
        arrastres.push({
          configPasoId: requerido.configPasoId,
          rutaPasoId: requerido.rutaPasoId,
          requeridoPorConfigPasoId: paso.configPasoId,
          requeridoPorNombre: nombreDe(paso),
        });
      }
      if (!procesados.has(requerido.rutaPasoId)) pendientes.push(requerido);
    }
  }

  return { opcionalesActivados: resultado, arrastres, conflictos };
}
