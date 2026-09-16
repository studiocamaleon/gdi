/** Contrato puro compartido con la web. Mide trabajo completado, nunca tiempo
 * transcurrido, cantidades buenas ni entregas físicas. */
export type PasoProgreso = {
  estado: string;
  duracionEstimadaMin?: number | string | { toString(): string } | null;
  nestingLoteRol?: string | null;
};

export type ProgresoProduccion = {
  porcentaje: number | null;
  base: 'tiempo_estimado' | 'operaciones' | 'sin_operaciones' | 'excluida';
  operacionesTotal: number;
  operacionesCompletadas: number;
  minutosTotal: number | null;
  minutosCompletados: number | null;
  operacionesSinTiempo: number;
  explicacion: string;
};

const formatoNumero = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 2,
});
const numero = (n: number) => formatoNumero.format(n);
const porcentaje = (hecho: number, total: number, completo: boolean) =>
  completo
    ? 100
    : Math.min(99, Math.round(total > 0 ? (hecho / total) * 100 : 0));

export function calcularProgreso(
  pasos: readonly PasoProgreso[],
  estado?: string,
): ProgresoProduccion {
  const trabajo = pasos.filter((p) => p.nestingLoteRol !== 'PARTICIPANTE');
  const duracion = (p: PasoProgreso) =>
    p.duracionEstimadaMin == null ? NaN : Number(p.duracionEstimadaMin);
  const conocidas = trabajo
    .map(duracion)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const hechos = trabajo.filter((p) => p.estado === 'hecho');
  const resumen = {
    operacionesTotal: trabajo.length,
    operacionesCompletadas: hechos.length,
    operacionesSinTiempo: trabajo.length - conocidas.length,
    minutosTotal: null,
    minutosCompletados: null,
  };
  if (estado === 'borrador' || estado === 'cancelada') {
    return {
      ...resumen,
      porcentaje: null,
      base: 'excluida',
      explicacion:
        estado === 'borrador'
          ? 'OT en borrador: no participa del avance productivo.'
          : 'OT cancelada: no participa del avance productivo.',
    };
  }
  if (!trabajo.length)
    return {
      ...resumen,
      porcentaje: null,
      base: 'sin_operaciones',
      explicacion: 'Sin operaciones registradas para calcular el avance.',
    };
  if (!conocidas.length)
    return {
      ...resumen,
      base: 'operaciones',
      porcentaje: porcentaje(
        hechos.length,
        trabajo.length,
        hechos.length === trabajo.length,
      ),
      explicacion: `${hechos.length} de ${trabajo.length} operaciones completadas. Sin tiempos estimados: todas pesan igual.`,
    };
  const reemplazo = conocidas[Math.floor(conocidas.length / 2)];
  const peso = (p: PasoProgreso) => {
    const n = duracion(p);
    return Number.isFinite(n) && n > 0 ? n : reemplazo;
  };
  const total = trabajo.reduce((s, p) => s + peso(p), 0);
  const completado = hechos.reduce((s, p) => s + peso(p), 0);
  return {
    ...resumen,
    base: 'tiempo_estimado',
    porcentaje: porcentaje(completado, total, hechos.length === trabajo.length),
    minutosTotal: total,
    minutosCompletados: completado,
    explicacion: `${numero(completado)} de ${numero(total)} minutos estimados corresponden a operaciones completadas (${hechos.length} de ${trabajo.length}).${resumen.operacionesSinTiempo ? ` Ponderación aproximada. Operaciones sin tiempo positivo: ${resumen.operacionesSinTiempo}. Se usa la mediana disponible: ${numero(reemplazo)} min por operación.` : ''}`,
  };
}

export function progresoDeOrden(orden: {
  estado: string;
  pasos?: readonly PasoProgreso[];
}): ProgresoProduccion {
  return calcularProgreso(orden.pasos ?? [], orden.estado);
}

/** Suma trabajo, nunca promedia porcentajes redondeados. Si alguna OT no
 * tiene tiempos, usa conteo para todas: no mezcla minutos con operaciones. */
export function progresoDeCampana(
  ordenes: readonly { estado: string; pasos?: readonly PasoProgreso[] }[],
): ProgresoProduccion {
  const incluidas = ordenes.filter(
    (o) => o.estado !== 'borrador' && o.estado !== 'cancelada',
  );
  const resumenes = incluidas.map(progresoDeOrden);
  const sinRuta = resumenes.filter((r) => r.base === 'sin_operaciones').length;
  const conRuta = resumenes.filter((r) => r.operacionesTotal > 0);
  const porOperaciones = conRuta.some((r) => r.base === 'operaciones');
  const total = conRuta.reduce((s, r) => s + r.operacionesTotal, 0);
  const hechas = conRuta.reduce((s, r) => s + r.operacionesCompletadas, 0);
  const minutosTotal = conRuta.reduce((s, r) => s + (r.minutosTotal ?? 0), 0);
  const minutosCompletados = conRuta.reduce(
    (s, r) => s + (r.minutosCompletados ?? 0),
    0,
  );
  const sinTiempo = conRuta.reduce((s, r) => s + r.operacionesSinTiempo, 0);
  const base = !total
    ? 'sin_operaciones'
    : porOperaciones
      ? 'operaciones'
      : 'tiempo_estimado';
  const detalle = !total
    ? 'Sin operaciones para calcular el avance.'
    : porOperaciones
      ? `${hechas} de ${total} operaciones completadas. Hay OT sin tiempos estimados: todas las operaciones pesan igual.`
      : `${numero(minutosCompletados)} de ${numero(minutosTotal)} minutos estimados corresponden a operaciones completadas. Cada OT pesa según su trabajo previsto.${sinTiempo ? ` Ponderación aproximada en ${sinTiempo} operaciones sin tiempo positivo, usando la mediana de su OT.` : ''}`;
  return {
    base,
    porcentaje:
      !total || sinRuta
        ? null
        : porcentaje(
            porOperaciones ? hechas : minutosCompletados,
            porOperaciones ? total : minutosTotal,
            hechas === total && !sinRuta,
          ),
    operacionesTotal: total,
    operacionesCompletadas: hechas,
    operacionesSinTiempo: sinTiempo,
    minutosTotal: base === 'tiempo_estimado' ? minutosTotal : null,
    minutosCompletados: base === 'tiempo_estimado' ? minutosCompletados : null,
    explicacion: `${detalle} ${conRuta.length} de ${incluidas.length} OT emitidas con operaciones.${sinRuta ? ` Avance parcial: ${sinRuta} OT sin operaciones; no se puede confirmar el 100 %.` : ''} Borradores y canceladas excluidos.`,
  };
}
