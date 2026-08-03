/**
 * Pliego de impresión del TPV Centro de copiado.
 *
 * El tamaño es un input POR COTIZACIÓN con sus medidas reales (las manda el
 * front desde el catálogo de formatos del sistema, SUSTRATO_HOJA_FORMATOS_PRESET).
 * El motor lo lee de `jobContext.configPasoRuntime[configPasoId].nestingConfig
 * .pliegoImpresion` (nesting-config.ts:315, con precedencia sobre el estático);
 * de ahí sale el `factorA4` (motor.service.ts:5428) y los clicks.
 */

export interface PliegoDim {
  /** Nombre del formato (para etiqueta/especificaciones), ej. "A4", "SRA3". */
  preset: string;
  anchoMm: number;
  altoMm: number;
}

/**
 * Fragmento de jobContext que fija el pliego de impresión de un paso para esta
 * cotización. Se mergea en el jobContext del segmento.
 */
export function runtimePliegoImpresion(
  configPasoId: string,
  pliego: PliegoDim,
): Record<string, unknown> {
  return {
    configPasoRuntime: {
      [configPasoId]: {
        nestingConfig: {
          pliegoImpresion: {
            preset: pliego.preset,
            anchoMm: pliego.anchoMm,
            altoMm: pliego.altoMm,
          },
        },
      },
    },
  };
}

const MARGEN_PIEZA_MM = 10;

/**
 * Pieza "documento": ~el tamaño del pliego menos un margen, de modo que entre
 * exactamente 1 pose por pliego. Con `cantidad = hojas` ⇒ pliegos = hojas.
 * (El costo del papel sale del formato de compra; los clicks, del pliego.)
 */
export function piezaDocumento(
  pliego: PliegoDim,
  hojas: number,
): { cantidad: number; anchoMm: number; altoMm: number } {
  return {
    cantidad: hojas,
    anchoMm: Math.max(1, pliego.anchoMm - MARGEN_PIEZA_MM),
    altoMm: Math.max(1, pliego.altoMm - MARGEN_PIEZA_MM),
  };
}
