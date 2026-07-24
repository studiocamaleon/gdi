/**
 * La prueba gratuita, en un solo lugar.
 *
 * Regla central: los días restantes NUNCA se guardan, se CALCULAN contra
 * `trialHasta`. Un contador persistido se desactualiza solo y termina
 * mostrándole "14 días" a todo el mundo — que es exactamente el bug que tenía
 * el sidebar antes. Si se calcula, no puede mentir.
 * Ver docs/suscripciones-cobro-diseno.md
 */

const DIA_MS = 86_400_000;

export type EstadoPrueba = {
  enPrueba: boolean;
  /** Días completos que faltan; 0 el último día. Null si no hay prueba. */
  diasRestantes: number | null;
  hasta: string | null;
  vencida: boolean;
};

export function estadoDePrueba(
  trialHasta: Date | null | undefined,
  ahora = new Date(),
): EstadoPrueba {
  if (!trialHasta) {
    return {
      enPrueba: false,
      diasRestantes: null,
      hasta: null,
      vencida: false,
    };
  }
  const restanteMs = trialHasta.getTime() - ahora.getTime();
  const vencida = restanteMs <= 0;
  return {
    enPrueba: !vencida,
    // Se redondea hacia arriba para que "faltan 2 horas" muestre 1 día y no 0:
    // decirle "0 días" a alguien que todavía puede trabajar hoy es confuso.
    diasRestantes: vencida ? 0 : Math.ceil(restanteMs / DIA_MS),
    hasta: trialHasta.toISOString(),
    vencida,
  };
}

/** Cuándo termina una prueba que empieza ahora, según los días del plan. */
export function finDePrueba(
  trialDias: number | null | undefined,
  desde = new Date(),
): Date | null {
  if (!trialDias || trialDias <= 0) return null;
  return new Date(desde.getTime() + trialDias * DIA_MS);
}
