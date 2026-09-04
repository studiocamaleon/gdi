export type MotivoCambioRecetaCodigo =
  | 'PRODUCTO'
  | 'RUTA'
  | 'WORKFLOW'
  | 'PASOS'
  | 'MATERIALES'
  | 'RECURSOS'
  | 'CARGOS'
  | 'DOCUMENTOS'
  | 'COMPONENTES'
  | 'ETAPAS'
  | 'OTROS';

export type MotivoCambioReceta = {
  codigo: MotivoCambioRecetaCodigo;
  titulo: string;
  detalle: string;
};

function esRegistro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function ordenarCanonico(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordenarCanonico);
  if (!esRegistro(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, ordenarCanonico(item)]),
  );
}

function iguales(a: unknown, b: unknown): boolean {
  return (
    JSON.stringify(ordenarCanonico(a)) === JSON.stringify(ordenarCanonico(b))
  );
}

function lista(snapshot: Record<string, unknown>, key: string): unknown[] {
  return Array.isArray(snapshot[key]) ? snapshot[key] : [];
}

function agregar(
  motivos: MotivoCambioReceta[],
  codigo: MotivoCambioRecetaCodigo,
  titulo: string,
  detalle: string,
) {
  if (motivos.some((motivo) => motivo.codigo === codigo)) return;
  motivos.push({ codigo, titulo, detalle });
}

/**
 * Traduce el diff técnico de snapshots a motivos que el usuario puede accionar.
 * No determina vigencia: la fuente de verdad sigue siendo la huella SHA-256.
 */
export function motivosCambioEntreSnapshots(
  publicada: unknown,
  actual: unknown,
): MotivoCambioReceta[] {
  if (!esRegistro(publicada) || !esRegistro(actual)) {
    return [
      {
        codigo: 'OTROS',
        titulo: 'Snapshot incompatible',
        detalle:
          'La receta publicada no tiene un formato comparable con la configuración actual.',
      },
    ];
  }

  const motivos: MotivoCambioReceta[] = [];
  if (!iguales(publicada.producto, actual.producto)) {
    agregar(
      motivos,
      'PRODUCTO',
      'Datos productivos del producto',
      'Cambió la unidad, las medidas o algún atributo incluido en la receta.',
    );
  }
  if (!iguales(publicada.ruta, actual.ruta)) {
    agregar(
      motivos,
      'RUTA',
      'Ruta de producción',
      'Cambió la ruta asociada, su versión o alguno de sus datos versionados.',
    );
  }
  if (!iguales(publicada.grafoProduccion, actual.grafoProduccion)) {
    agregar(
      motivos,
      'WORKFLOW',
      'Orden y dependencias',
      'Cambió la secuencia, el paralelismo o los controles del Workflow.',
    );
  }
  if (!iguales(publicada.cargosCotizacion, actual.cargosCotizacion)) {
    agregar(
      motivos,
      'CARGOS',
      'Cargos de la cotización',
      'Cambió un cargo directo asociado al producto.',
    );
  }
  if (!iguales(publicada.documentos, actual.documentos)) {
    agregar(
      motivos,
      'DOCUMENTOS',
      'Requisitos documentales',
      'Cambió un documento requerido por la receta o por alguno de sus pasos.',
    );
  }
  if (!iguales(publicada.componentes, actual.componentes)) {
    agregar(
      motivos,
      'COMPONENTES',
      'Componentes fabricados',
      'Cambió una ocurrencia o existe una nueva publicación de un componente hijo.',
    );
  }
  if (!iguales(publicada.pasosCompuestos, actual.pasosCompuestos)) {
    agregar(
      motivos,
      'ETAPAS',
      'Operaciones de etapas',
      'Cambió la configuración interna de una etapa compuesta.',
    );
  }

  const pasosPublicados = lista(publicada, 'pasos').filter(esRegistro);
  const pasosActuales = lista(actual, 'pasos').filter(esRegistro);
  const publicadosPorClave = new Map(
    pasosPublicados.map((paso, index) => [String(paso.clave ?? index), paso]),
  );
  const actualesPorClave = new Map(
    pasosActuales.map((paso, index) => [String(paso.clave ?? index), paso]),
  );
  if (
    pasosPublicados.length !== pasosActuales.length ||
    [...publicadosPorClave.keys()].some((clave) => !actualesPorClave.has(clave))
  ) {
    agregar(
      motivos,
      'WORKFLOW',
      'Pasos del Workflow',
      'Se agregó, quitó o reemplazó al menos un paso de producción.',
    );
  }

  for (const [clave, pasoActual] of actualesPorClave) {
    const pasoPublicado = publicadosPorClave.get(clave);
    if (!pasoPublicado) continue;
    if (
      !iguales(
        {
          nombre: pasoPublicado.nombre,
          familiaCodigo: pasoPublicado.familiaCodigo,
          orden: pasoPublicado.orden,
        },
        {
          nombre: pasoActual.nombre,
          familiaCodigo: pasoActual.familiaCodigo,
          orden: pasoActual.orden,
        },
      )
    ) {
      agregar(
        motivos,
        'WORKFLOW',
        'Pasos del Workflow',
        'Cambió el orden, la familia o la identificación de un paso.',
      );
    }
    if (!iguales(pasoPublicado.configuracion, pasoActual.configuracion)) {
      agregar(
        motivos,
        'PASOS',
        'Configuración de pasos',
        'Cambió la activación, cantidad, tiempo, parámetros o tercerización de un paso.',
      );
    }
    if (!iguales(pasoPublicado.slots, pasoActual.slots)) {
      agregar(
        motivos,
        'MATERIALES',
        'Materiales y consumos',
        'Cambió un material, candidato, fórmula, medida o porcentaje de merma.',
      );
    }
    if (!iguales(pasoPublicado.recurso, pasoActual.recurso)) {
      agregar(
        motivos,
        'RECURSOS',
        'Máquinas y recursos',
        'Cambió una máquina, perfil, centro de costo o capacidad productiva.',
      );
    }
  }

  if (motivos.length === 0 && !iguales(publicada, actual)) {
    agregar(
      motivos,
      'OTROS',
      'Contrato técnico',
      'Cambió información versionada que todavía no tiene una categoría específica.',
    );
  }
  return motivos;
}
