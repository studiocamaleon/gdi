export type SuscripcionAcceso = {
  estado: string;
  proveedor?: string;
  estadoProveedor?: string | null;
  trialHasta?: Date | null;
  graciaHasta?: Date | null;
};

/** Diagnóstico compartido por el API y Plataforma. El bloqueo administrativo
 * siempre prevalece; el cobro nunca lo levanta como efecto secundario. */
export function resolverAccesoEmpresa(
  activo: boolean,
  suscripcion: SuscripcionAcceso | null,
  motivoBloqueo?: string | null,
  ahora = new Date(),
) {
  const resultado = (
    modo: 'operativo' | 'solo_lectura' | 'bloqueado',
    codigo: string,
    descripcion: string,
  ) => ({ modo, codigo, descripcion });
  if (!activo)
    return resultado(
      'bloqueado',
      'bloqueo_administrativo',
      motivoBloqueo ||
        'Bloqueo anterior sin motivo registrado. Revisá el historial antes de levantarlo.',
    );
  if (!suscripcion)
    return resultado(
      'operativo',
      'legacy',
      'Cuenta anterior a los planes. Conserva su acceso; los pilotos requieren habilitación explícita.',
    );
  if (suscripcion.estado === 'baja')
    return resultado(
      'solo_lectura',
      'baja',
      'La suscripción está dada de baja.',
    );
  if (
    suscripcion.estadoProveedor === 'past_due' &&
    suscripcion.graciaHasta &&
    suscripcion.graciaHasta <= ahora
  )
    return resultado(
      'solo_lectura',
      'gracia_vencida',
      'Venció el período de gracia del pago pendiente.',
    );
  if (
    suscripcion.proveedor === 'manual' &&
    suscripcion.trialHasta &&
    suscripcion.trialHasta <= ahora
  )
    return resultado(
      'solo_lectura',
      'prueba_vencida',
      'La prueba gratuita terminó.',
    );
  if (suscripcion.estado !== 'activa')
    return resultado(
      'solo_lectura',
      'suscripcion_inactiva',
      suscripcion.estadoProveedor === 'paused'
        ? 'La suscripción está pausada en el proveedor.'
        : 'La suscripción está inactiva. Revisá su origen e historial.',
    );
  if (suscripcion.estadoProveedor === 'past_due')
    return resultado(
      'operativo',
      'gracia',
      'Pago pendiente. Mantiene acceso durante el período de gracia.',
    );
  return resultado(
    'operativo',
    'habilitado',
    'La cuenta puede operar con las funciones de su plan.',
  );
}
