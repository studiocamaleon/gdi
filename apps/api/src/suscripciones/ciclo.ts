import { estadoDePrueba } from './trial';

const DIA_MS = 86_400_000;

/**
 * Lo que la card del sidebar necesita saber del período en curso.
 *
 * Mismo principio que `trial.ts`: los días se CALCULAN contra las fechas, nunca
 * se guardan. Un contador persistido se desactualiza sin que nadie lo note —
 * ese fue exactamente el bug del sidebar, que le mostraba "14 / 30 días" a
 * todos los tenants por igual.
 */
export type EstadoCiclo = {
  /** Días completos que faltan para el vencimiento. Null si no se sabe cuándo. */
  diasRestantes: number | null;
  /**
   * Largo del período en días. Null cuando NO se conoce su inicio: sin ese
   * dato la fracción sería inventada, y asumir 30 mentiría en los anuales.
   * La vista muestra sólo los días restantes cuando esto viene null.
   */
  diasTotales: number | null;
  venceEl: string | null;
  enPrueba: boolean;
};

const VACIO: EstadoCiclo = {
  diasRestantes: null,
  diasTotales: null,
  venceEl: null,
  enPrueba: false,
};

/**
 * La prueba gratuita tiene prioridad sobre el ciclo de cobro: mientras dura, lo
 * que al tenant le importa es cuánto le queda de prueba, no cuándo renovaría.
 */
export function estadoDeCiclo(
  suscripcion: {
    trialHasta: Date | null;
    periodoDesde: Date | null;
    proximoCobro: Date | null;
  } | null,
  trialDias: number | null = null,
  ahora = new Date(),
): EstadoCiclo {
  if (!suscripcion) return VACIO;

  const prueba = estadoDePrueba(suscripcion.trialHasta, ahora);
  if (prueba.enPrueba) {
    return {
      diasRestantes: prueba.diasRestantes,
      diasTotales: trialDias && trialDias > 0 ? trialDias : null,
      venceEl: prueba.hasta,
      enPrueba: true,
    };
  }

  const { proximoCobro, periodoDesde } = suscripcion;
  if (!proximoCobro) return VACIO;

  const restanteMs = proximoCobro.getTime() - ahora.getTime();
  // Se redondea hacia arriba igual que el trial: a quien todavía le quedan
  // horas de servicio decirle "0 días" sería confuso.
  const diasRestantes = restanteMs <= 0 ? 0 : Math.ceil(restanteMs / DIA_MS);

  const largoMs = periodoDesde
    ? proximoCobro.getTime() - periodoDesde.getTime()
    : 0;
  const diasTotales = largoMs > 0 ? Math.round(largoMs / DIA_MS) : null;

  return {
    diasRestantes,
    // Un período ya vencido puede dar restantes > totales por reintentos de
    // cobro; se acota para que la barra nunca se pase de largo.
    diasTotales:
      diasTotales !== null ? Math.max(diasTotales, diasRestantes) : null,
    venceEl: proximoCobro.toISOString(),
    enPrueba: false,
  };
}
