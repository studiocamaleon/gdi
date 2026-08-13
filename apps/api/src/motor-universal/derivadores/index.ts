/**
 * Catálogo de derivadores geométricos (docs/derivadores-geometricos-diseno.md §3.2).
 *
 * Espejo del dispatcher de nesting: registrar acá es TODO lo que hace falta
 * para que una familia nueva derive geometría — la familia lo referencia por
 * `derivadorCodigo` y el motor no gana ni un if. Los helpers matemáticos
 * viven en sus módulos (con sus specs); acá sólo se adaptan al contrato.
 */
import {
  calcularEstructuraBastidor,
  parsearParamsEstructuraBastidor,
  parsearPerfilEstructural,
} from '../estructura-bastidor';
import {
  calcularIluminacionLed,
  parsearAtributosModuloLed,
  parsearParamsIluminacionLed,
} from '../iluminacion-led';
import {
  calcularLayoutOjales,
  parsearParamsColocacionOjales,
} from '../colocacion-ojales';
import type { Derivador, ResultadoDerivador } from './tipos';

/**
 * Unidades IDÉNTICAS del trabajo (dos carteles backlight iguales): la
 * geometría se deriva POR CARTEL — la traza y el visor 3D dibujan uno —
 * pero los consumos (ml de perfil, soldaduras, módulos, cenefa…) se
 * multiplican por las unidades. Sin esto, cotizar 2 carteles cobraba UNA
 * estructura y UNA iluminación.
 */
function unidadesDelTrabajo(jobContext: Parameters<Derivador>[0]): number {
  const ctx = jobContext as Record<string, unknown>;
  const cantidad = Number(
    ctx.cantidad ??
      (Array.isArray(ctx.piezas)
        ? (ctx.piezas[0] as Record<string, unknown> | undefined)?.cantidad
        : undefined) ??
      1,
  );
  return Number.isFinite(cantidad) && cantidad >= 1 ? Math.round(cantidad) : 1;
}

/**
 * Bastidor rectangular de herrería (backlight/frontlight/marquesina): de
 * W×H×D + separación de refuerzos salen los metros de perfil (con despiece
 * para comprar barras enteras), los puntos de soldadura y los m² de
 * cenefa/pintura/fondo que los pasos siguientes heredan como drivers.
 */
const bastidor_rectangular: Derivador = (jobContext, params, materialPrincipal) => {
  const parametros = parsearParamsEstructuraBastidor(params);
  // El lado del caño sale de la variante elegida en `perfil_estructural`
  // (seccion "20×20 mm"): las barras interiores se cortan descontándolo.
  const perfil = parsearPerfilEstructural(materialPrincipal);
  const resultado = calcularEstructuraBastidor(jobContext, parametros, perfil);
  if (!resultado) return null;
  // La geometría es de UN bastidor; los consumos escalan por unidades y el
  // despiece se repite (la herrería corta todas las barras juntas: el
  // packing 1D aprovecha sobrantes entre carteles).
  const unidades = unidadesDelTrabajo(jobContext);
  const despieceTotalMm = Array.from({ length: unidades }, () =>
    resultado.despieceMm,
  ).flat();
  return {
    magnitudes: {
      mlTotal: resultado.mlTotal * unidades,
      mlPerimetro: resultado.mlPerimetro * unidades,
      mlRefuerzos: resultado.mlRefuerzos * unidades,
      // Un corte por tramo del despiece: es como lo cuenta la herrería
      // (la sensitiva hace un corte por barra que baja, no "corta metros").
      cortes: despieceTotalMm.length,
      puntosSoldadura: resultado.puntosSoldadura * unidades,
      cenefaM2: resultado.cenefaM2 * unidades,
      pinturaM2: resultado.pinturaM2 * unidades,
      fondoM2: resultado.fondoM2 * unidades,
      anclajes: resultado.anclajes * unidades,
    },
    despieces: { perfil_estructural: despieceTotalMm },
    traza: {
      unidades,
      refuerzosV: resultado.refuerzosV,
      refuerzosH: resultado.refuerzosH,
      profundidadM: resultado.profundidadM,
      cenefaDesarrolloCm: resultado.cenefaDesarrolloCm,
      // Geometría derivada para los pasos siguientes (Ola #1, docs §6). POR
      // CARTEL, en mm. Aditivo: hoy nadie la consume — la conexión a LED/lona/
      // chapa es la Ola #2. No toca magnitudes ni despieces → no mueve precios.
      interior: {
        anchoMm: Math.round(resultado.interiorAnchoM * 1000),
        altoMm: Math.round(resultado.interiorAltoM * 1000),
      },
      fondo: {
        anchoMm: Math.round(resultado.fondoAnchoM * 1000),
        altoMm: Math.round(resultado.fondoAltoM * 1000),
      },
      cenefaTiras: resultado.cenefaTiras.map((t) => ({
        largoMm: Math.round(t.largoM * 1000),
        anchoMm: Math.round(t.anchoM * 1000),
      })),
      lonaBruta: {
        anchoMm: Math.round(resultado.lonaBrutaAnchoM * 1000),
        altoMm: Math.round(resultado.lonaBrutaAltoM * 1000),
      },
      // Estructura autosuficiente para el visor 3D de Producción. Se arma con
      // los params EFECTIVOS (`paramsEfectivos` ya trae los overrides del
      // sheet), así el dibujo es el bastidor cotizado y no el default de la
      // ruta. El motor la persiste en la trazabilidad del paso.
      estructura: {
        tipoBastidor: parametros.tipoBastidor,
        anchoM: resultado.anchoM,
        altoM: resultado.altoM,
        profundidadM: resultado.profundidadM,
        perfilLadoM: resultado.perfilLadoM,
        sepRefuerzoVcm: parametros.sepRefuerzoVcm,
        sepRefuerzoHcm: parametros.sepRefuerzoHcm,
        refuerzosV: resultado.refuerzosV,
        refuerzosH: resultado.refuerzosH,
        despieceMm: resultado.despieceMm,
        puntosSoldadura: resultado.puntosSoldadura,
      },
    },
  };
};

/**
 * Sembrado de módulos LED: por área (grilla sobre la cara) o por recorrido
 * (siguiendo el trazo). Necesita los atributos del módulo del slot
 * (`coberturaM2`/`pasoMm`/`wattsModulo` — por eso la familia declara
 * `derivadorMaterialSlot: 'modulos_led'`). Publica watts para que el slot
 * `fuente` se elija solo por MENOR_CAPACIDAD_QUE_CUMPLA.
 */
const sembrado_led: Derivador = (jobContext, params, materialPrincipal) => {
  const modulo = parsearAtributosModuloLed(materialPrincipal);
  if (!modulo) return null;
  const resultado = calcularIluminacionLed(
    jobContext,
    parsearParamsIluminacionLed(params),
    modulo,
  );
  if (!resultado) return null;
  // El sembrado es de UN cartel: módulos/watts/cable escalan por unidades.
  // `wattsRequeridos` queda POR CARTEL a propósito — cada cartel lleva SU
  // fuente (el slot fuente consume cantidadFija × unidades), no una fuente
  // gigante para todos.
  const unidades = unidadesDelTrabajo(jobContext);
  return {
    magnitudes: {
      modulos: resultado.modulos * unidades,
      watts: resultado.watts * unidades,
      wattsRequeridos: resultado.wattsRequeridos,
      cableMl: resultado.cableMl * unidades,
    },
    traza: { unidades, modulosPorCartel: resultado.modulos },
  };
};

/**
 * Layout de ojales sobre la medida VISIBLE (regla de oro de modificaciones
 * físicas): la cantidad se deriva del reparto por lado, y la traza lleva las
 * posiciones para que el visor de nesting dibuje lo que el motor pensó.
 */
const layout_ojales: Derivador = (jobContext, params) => {
  const parseados = parsearParamsColocacionOjales(params);
  if (!parseados) return null;
  const layout = calcularLayoutOjales(jobContext, parseados);
  const ojales = layout.reduce(
    (acc, pieza) => acc + pieza.posiciones.length * pieza.cantidad,
    0,
  );
  return {
    magnitudes: { ojales },
    traza: {
      ojalesLayout: layout,
      ojalesConfig: {
        separacionMaxMm: parseados.separacionMaxMm,
        lados: parseados.lados,
        esquinasSiempre: parseados.esquinasSiempre,
      },
    },
  };
};

const DERIVADORES: Record<string, Derivador> = {
  bastidor_rectangular,
  sembrado_led,
  layout_ojales,
};

export function runDerivador(
  codigo: string,
  ...args: Parameters<Derivador>
): ResultadoDerivador | null {
  const derivador = DERIVADORES[codigo];
  if (!derivador) return null;
  return derivador(...args);
}

export function existeDerivador(codigo: string): boolean {
  return Boolean(DERIVADORES[codigo]);
}
