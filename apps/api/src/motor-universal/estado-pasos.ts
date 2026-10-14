import { evaluarRegla } from './evaluador-jsonlogic';
import {
  outputsReferenciadosPorRegla,
  variablesDeRegla,
} from '../productos-servicios/pasos/validacion-pre-pasada';

export const PREFIJO_ESTADO_PASO = 'pasoActivo_';
// Sólo el motor puede producir este dato. No se acepta desde el pedido ni
// se serializa en sus snapshots; los spreads de contextos internos lo conservan.
export const ESTADOS_ACTIVACION = Symbol('estadosActivacion');

export interface PasoConEstado {
  rutaPasoId: string;
  configPasoId: string;
  nombreVisible?: string | null;
  familiaCodigo?: string;
  modoActivacion?: string | null;
  condicionActivacionJson?: unknown;
  contenedorClave?: string | null;
}
export interface EstadoActivacion {
  activado: boolean;
  razon?: string;
  error?: string;
}
export interface ContextoEstados {
  [ESTADOS_ACTIVACION]?: Map<string, EstadoActivacion>;
}

export function pasosReferenciadosPorEstado(regla: unknown): string[] {
  return [
    ...new Set(
      variablesDeRegla(regla)
        .filter((variable) => variable.startsWith(PREFIJO_ESTADO_PASO))
        .map((variable) => variable.slice(PREFIJO_ESTADO_PASO.length)),
    ),
  ];
}

/** Valida también las dependencias indirectas; no depende del orden de ruta. */
export function validarCondicionesEstadoPasos(pasos: PasoConEstado[]): void {
  const porId = new Map(pasos.map((paso) => [paso.rutaPasoId, paso]));
  const visitados = new Set<string>();
  const camino = new Set<string>();
  const visitar = (paso: PasoConEstado) => {
    const nombre = paso.nombreVisible || paso.familiaCodigo || 'Paso';
    if (camino.has(paso.rutaPasoId)) {
      throw new Error(
        `La condición de "${nombre}" genera una dependencia circular entre pasos.`,
      );
    }
    if (visitados.has(paso.rutaPasoId)) return;
    // El estado se decide antes de producir: una regla que necesita resultados
    // de producción o un contexto interno no puede anticiparse con certeza.
    if (
      paso.contenedorClave ||
      (paso.modoActivacion === 'CONDICIONAL' &&
        outputsReferenciadosPorRegla(paso.condicionActivacionJson).length)
    ) {
      throw new Error(
        `El estado de "${nombre}" depende de resultados de producción. Usá condiciones sobre datos del pedido para relacionar estos pasos.`,
      );
    }
    camino.add(paso.rutaPasoId);
    const referencias =
      paso.modoActivacion === 'CONDICIONAL'
        ? pasosReferenciadosPorEstado(paso.condicionActivacionJson)
        : [];
    for (const id of referencias) {
      const destino = porId.get(id);
      if (!destino)
        throw new Error(
          `La condición de "${nombre}" debe referirse a otro paso activo de la misma ruta y versión.`,
        );
      visitar(destino);
    }
    camino.delete(paso.rutaPasoId);
    visitados.add(paso.rutaPasoId);
  };
  for (const paso of pasos) {
    if (
      paso.modoActivacion === 'CONDICIONAL' &&
      pasosReferenciadosPorEstado(paso.condicionActivacionJson).length
    )
      visitar(paso);
  }
}

/** Se resuelve después del arrastre. Sólo fija estados del subgrafo nuevo;
 * las condiciones legacy sobre outputs siguen evaluándose durante el bucle. */
export function resolverEstadosActivacion(
  pasos: PasoConEstado[],
  contexto: Record<string, unknown> & {
    opcionalesActivados?: Record<string, boolean>;
  },
): Map<string, EstadoActivacion> {
  const estados = new Map<string, EstadoActivacion>();
  const relacionados = pasos.filter(
    (paso) =>
      paso.modoActivacion === 'CONDICIONAL' &&
      pasosReferenciadosPorEstado(paso.condicionActivacionJson).length,
  );
  if (!relacionados.length) return estados;
  try {
    validarCondicionesEstadoPasos(pasos);
  } catch (error) {
    const mensaje = (error as Error).message;
    for (const paso of relacionados)
      estados.set(paso.configPasoId, {
        activado: false,
        error: mensaje,
        razon: mensaje,
      });
    return estados;
  }
  const porId = new Map(pasos.map((paso) => [paso.rutaPasoId, paso]));
  const resolver = (paso: PasoConEstado): EstadoActivacion => {
    const previo = estados.get(paso.configPasoId);
    if (previo) return previo;
    const modo = paso.modoActivacion ?? 'OBLIGATORIO';
    let estado: EstadoActivacion;
    if (modo === 'CONDICIONAL') {
      const contextoRegla = { ...contexto };
      const motivos: string[] = [];
      for (const id of pasosReferenciadosPorEstado(
        paso.condicionActivacionJson,
      )) {
        const destino = porId.get(id)!;
        const resultado = resolver(destino);
        if (resultado.error) {
          estados.set(paso.configPasoId, resultado);
          return resultado;
        }
        contextoRegla[PREFIJO_ESTADO_PASO + id] = resultado.activado ? 1 : 0;
        motivos.push(
          `${destino.nombreVisible || destino.familiaCodigo || 'Paso'}: ${resultado.activado ? 'activo' : 'inactivo'}`,
        );
      }
      const evaluacion = evaluarRegla(
        paso.condicionActivacionJson,
        contextoRegla,
      );
      estado = {
        activado: !evaluacion.error && evaluacion.resultado,
        error: evaluacion.error,
        razon:
          evaluacion.error ??
          (evaluacion.resultado
            ? undefined
            : `No se cumple la condición${motivos.length ? ` (${motivos.join('; ')})` : ''}.`),
      };
    } else {
      const activado =
        modo === 'OBLIGATORIO' ||
        (modo === 'OPCIONAL' &&
          contexto.opcionalesActivados?.[paso.configPasoId] === true);
      estado = {
        activado,
        razon: activado
          ? undefined
          : modo === 'NO_EJECUTAR'
            ? 'Paso configurado como NO EJECUTAR'
            : 'Paso OPCIONAL no activado por el comercial',
      };
    }
    estados.set(paso.configPasoId, estado);
    return estado;
  };
  relacionados.forEach(resolver);
  return estados;
}

/** Las referencias usan rutaPasoId, estable al copiar un producto. Al cambiar
 * de versión de ruta se traducen; una referencia eliminada queda inválida,
 * nunca se convierte silenciosamente en "inactivo". */
export function remapearEstadoPasos(
  regla: unknown,
  destinos: Map<string, string>,
): unknown {
  if (Array.isArray(regla))
    return regla.map((valor) => remapearEstadoPasos(valor, destinos));
  if (!regla || typeof regla !== 'object') return regla;
  return Object.fromEntries(
    Object.entries(regla).map(([clave, valor]) => {
      const traducir = (variable: unknown) => {
        if (
          typeof variable !== 'string' ||
          !variable.startsWith(PREFIJO_ESTADO_PASO)
        )
          return variable;
        const id = variable.slice(PREFIJO_ESTADO_PASO.length);
        return PREFIJO_ESTADO_PASO + (destinos.get(id) ?? id);
      };
      return [
        clave,
        clave === 'var'
          ? Array.isArray(valor)
            ? [traducir(valor[0]), ...valor.slice(1)]
            : traducir(valor)
          : remapearEstadoPasos(valor, destinos),
      ];
    }),
  );
}
