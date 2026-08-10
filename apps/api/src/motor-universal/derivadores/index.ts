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
  return {
    magnitudes: {
      mlTotal: resultado.mlTotal,
      mlPerimetro: resultado.mlPerimetro,
      mlRefuerzos: resultado.mlRefuerzos,
      // Un corte por tramo del despiece: es como lo cuenta la herrería
      // (la sensitiva hace un corte por barra que baja, no "corta metros").
      cortes: resultado.despieceMm.length,
      puntosSoldadura: resultado.puntosSoldadura,
      cenefaM2: resultado.cenefaM2,
      pinturaM2: resultado.pinturaM2,
      fondoM2: resultado.fondoM2,
      anclajes: resultado.anclajes,
    },
    despieces: { perfil_estructural: resultado.despieceMm },
    traza: {
      refuerzosV: resultado.refuerzosV,
      refuerzosH: resultado.refuerzosH,
      profundidadM: resultado.profundidadM,
      cenefaDesarrolloCm: resultado.cenefaDesarrolloCm,
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
  return {
    magnitudes: {
      modulos: resultado.modulos,
      watts: resultado.watts,
      wattsRequeridos: resultado.wattsRequeridos,
      cableMl: resultado.cableMl,
    },
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
