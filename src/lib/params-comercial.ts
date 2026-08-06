/**
 * Params del paso que el COMERCIAL puede cambiar al cotizar.
 *
 * El modelador declara los campos abiertos en
 * `paramsPasoJson.camposEditablesComercial`; lo que él configuró queda como
 * SUGERENCIA. El valor elegido viaja al motor en
 * `jobContext.configPasoRuntime[configPasoId]` y queda en el snapshot del
 * ítem, así que llega a la OT.
 *
 * Mismo patrón que `tiempoManual` (docs/tiempo-manual-por-paso-diseno.md).
 * Ver `docs/modificaciones-fisicas-lona-diseno.md`.
 */
import { camposEditablesComercial } from "@/lib/params-familia";
import type { FamiliaListItem } from "@/lib/productos-servicios";

/**
 * Nombre del paso para el comercial. Sin `nombreVisible` cae al código de
 * familia humanizado: `colocacion_ojales` en crudo no se muestra.
 */
function nombrePaso(
  nombreVisible: string | null | undefined,
  familiaCodigo: string,
): string {
  const propio = nombreVisible?.trim();
  if (propio) return propio;
  const humanizado = familiaCodigo.replace(/_/g, " ");
  return humanizado.charAt(0).toUpperCase() + humanizado.slice(1);
}

export interface CampoEditableComercial {
  campo: string;
  etiqueta: string;
  tipo: string;
  valoresPermitidos: string[];
  descripcion?: string;
  /** Lo que configuró el modelador: se muestra precargado. */
  sugerido: unknown;
}

export interface PasoConParamsComercial {
  configPasoId: string;
  familiaCodigo: string;
  nombre: string;
  modoActivacion: string | null;
  campos: CampoEditableComercial[];
}

/**
 * Pasos de la ruta con campos abiertos al comercial. Sólo devuelve los que
 * el schema de la familia declara: un campo abierto que la familia no conoce
 * no tiene cómo renderizarse.
 */
export function getParamsComercialDeRuta(
  configPasos: Array<{
    id: string;
    nombreVisible?: string | null;
    modoActivacion: string | null;
    paramsPasoJson?: unknown;
    rutaPaso: { familiaCodigo: string };
  }>,
  familias: Map<string, FamiliaListItem>,
): PasoConParamsComercial[] {
  const resultado: PasoConParamsComercial[] = [];

  for (const config of configPasos) {
    const params = (config.paramsPasoJson ?? {}) as Record<string, unknown>;
    const familia = familias.get(config.rutaPaso.familiaCodigo);
    const schema = familia?.paramsPasoSchema ?? [];

    // Abiertos por el modelador (paramsPasoJson) ∪ expuestos POR DISEÑO de
    // la familia (`expuestoAlComercial` en el schema — densidad LED,
    // refuerzos del bastidor). El motor acepta ambos en configPasoRuntime.
    const abiertos = new Set([
      ...camposEditablesComercial(params),
      ...schema.filter((p) => p.expuestoAlComercial).map((p) => p.campo),
    ]);
    if (abiertos.size === 0) continue;

    const campos = schema
      .filter((p) => abiertos.has(p.campo))
      .map((p) => ({
        campo: p.campo,
        etiqueta: p.etiqueta,
        tipo: p.tipo,
        valoresPermitidos: p.valoresPermitidos ?? [],
        descripcion: p.descripcion,
        sugerido: params[p.campo] ?? p.default,
      }));

    if (campos.length === 0) continue;

    resultado.push({
      configPasoId: config.id,
      familiaCodigo: config.rutaPaso.familiaCodigo,
      nombre: nombrePaso(config.nombreVisible, config.rutaPaso.familiaCodigo),
      modoActivacion: config.modoActivacion,
      campos,
    });
  }

  return resultado;
}

/**
 * Valor efectivo de un campo: lo que eligió el comercial, o la sugerencia del
 * modelador si no tocó nada.
 */
export function valorEfectivoCampo(
  campo: CampoEditableComercial,
  elegido: Record<string, unknown> | undefined,
): unknown {
  if (elegido && campo.campo in elegido) {
    const valor = elegido[campo.campo];
    if (valor !== undefined && valor !== null) return valor;
  }
  return campo.sugerido;
}

/**
 * `configPasoRuntime` para el JobContext: sólo los pasos ACTIVOS y sólo los
 * campos que el comercial efectivamente cambió. Mandar la sugerencia sin
 * cambios sería ruido — el motor ya la tiene.
 *
 * SIN filtro de campos del lado del cliente: la ÚNICA autoridad sobre qué se
 * puede pisar es `paramsEfectivos` del motor (camposEditablesComercial del
 * paso ∪ expuestoAlComercial de la familia). La UI solo ofrece controles
 * para esos campos, y un campo de más que viaje se ignora server-side.
 * [Etapa 3 derivadores: el filtro espejo acá hacía que los campos expuestos
 * por la familia viajaran "como si el comercial no los hubiera tocado" — el
 * bug de la chapa trasera en 0 m² que parchó mergeCarteleria.]
 */
export function buildConfigPasoRuntime(
  configPasos: Array<{
    id: string;
    modoActivacion: string | null;
    paramsPasoJson?: unknown;
  }>,
  elecciones: Record<string, Record<string, unknown>>,
  estaActivo: (configPasoId: string, modoActivacion: string | null) => boolean,
): Record<string, Record<string, unknown>> {
  const runtime: Record<string, Record<string, unknown>> = {};

  for (const config of configPasos) {
    if (!estaActivo(config.id, config.modoActivacion)) continue;
    const elegido = elecciones[config.id];
    if (!elegido) continue;

    const delPaso: Record<string, unknown> = {};
    for (const [campo, valor] of Object.entries(elegido)) {
      if (valor === undefined || valor === null) continue;
      delPaso[campo] = valor;
    }
    if (Object.keys(delPaso).length > 0) runtime[config.id] = delPaso;
  }

  return runtime;
}
