/** Corte láser siempre es productividad de máquina por recorrido. El fallback
 * evita que configuraciones históricas con `modoTiempo=null` caigan a T-1 y
 * cobren solamente el setup. */
export function modoTiempoEfectivo(
  familiaCodigo: string,
  modoConfigurado: string | null | undefined,
): string {
  if (familiaCodigo === 'corte_laser') return 'T-3';
  return modoConfigurado ?? 'T-1';
}

/**
 * Convierte una cantidad + productividad de perfil en minutos de run, según la
 * UNIDAD de la productividad. Función pura (testeable sin el pipeline del motor).
 *
 * Convención de unidades de la MAGNITUD (`cantidadEfectiva`) según la unidad de
 * productividad:
 *  - PPM: cantidad = páginas (× factorA4-equivalente); productividad = ppm.
 *  - CORTES_MIN / GOLPES_MIN / PLIEGOS_MIN: cantidad = golpes/cortes/pliegos.
 *  - M_MIN: cantidad = METROS de recorrido; productividad = m/min.
 *  - MM_S / MM_MIN: cantidad = METROS de recorrido (perímetro). Se pasa a mm
 *    (×1000) porque la velocidad nativa del láser (mm/s) y del CNC (mm/min) está
 *    en milímetros.
 *  - G_H: cantidad = GRAMOS de material (impresión 3D); productividad = g/h.
 *    Cae en la rama por hora, que ya da la fórmula correcta.
 *  - resto (HORA, PIEZAS_H, PIEZA, M2_H, HOJA, COPIA, CICLO…): productividad por
 *    HORA → minutos = cantidad/productividad × 60.
 */
export function runMinPorProductividad(
  cantidadEfectiva: number,
  productividad: number,
  productivityUnit: string | null | undefined,
  factorA4 = 1,
): number {
  if (
    !Number.isFinite(cantidadEfectiva) ||
    cantidadEfectiva <= 0 ||
    !Number.isFinite(productividad) ||
    productividad <= 0
  ) {
    return 0;
  }

  const unidad = String(productivityUnit ?? '').toUpperCase();

  if (unidad === 'PPM') {
    return (cantidadEfectiva * factorA4) / productividad;
  }

  if (
    unidad === 'CORTES_MIN' ||
    unidad === 'GOLPES_MIN' ||
    unidad === 'PLIEGOS_MIN' ||
    unidad === 'M_MIN'
  ) {
    return cantidadEfectiva / productividad;
  }

  // Láser/CNC por recorrido: la magnitud (perímetro) llega en METROS; las
  // velocidades nativas están en mm (láser mm/s, CNC mm/min), así que pasamos el
  // recorrido a mm antes de dividir.
  if (unidad === 'MM_S') {
    return (cantidadEfectiva * 1000) / productividad / 60;
  }
  if (unidad === 'MM_MIN') {
    return (cantidadEfectiva * 1000) / productividad;
  }

  return (cantidadEfectiva / productividad) * 60;
}
