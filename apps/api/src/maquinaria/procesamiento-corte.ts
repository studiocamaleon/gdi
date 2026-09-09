/** Contrato puro compartido con la UI. La configuración se guarda y audita
 * en parametrosTecnicosJson; los perfiles la referencian por IDs estables. */
export const OPERACIONES_CORTE = [
  'CORTE_COMPLETO',
  'CORTE_PARCIAL',
  'HENDIDO',
] as const;
export type OperacionCorte = (typeof OPERACIONES_CORTE)[number];
export const NOMBRES_OPERACION_CORTE: Record<OperacionCorte, string> = {
  CORTE_COMPLETO: 'Corte completo',
  CORTE_PARCIAL: 'Corte parcial',
  HENDIDO: 'Hendido',
};
export const TIPOS_HERRAMIENTA_CORTE = {
  CUCHILLA: 'Cuchilla',
  OSCILANTE: 'Cuchilla oscilante',
  RUEDA: 'Rueda de hendido',
  FRESA: 'Fresa',
  LASER: 'Láser',
} as const;
export type HerramientaCorte = {
  id: string;
  nombre: string;
  tipo: keyof typeof TIPOS_HERRAMIENTA_CORTE;
  activo: boolean;
  operaciones: OperacionCorte[];
  posicion: number;
  montada: boolean;
  espesorMaxMm?: number;
  diametroMm?: number;
  desgaste: {
    modo: 'INCLUIDO_CENTRO' | 'POR_METRO' | 'POR_HORA';
    costoReposicion?: number;
    vidaUtil?: number;
  };
};
export type ConfiguracionProcesamientoCorte = {
  version: 1;
  posiciones: number;
  cambio: 'MANUAL' | 'AUTOMATICO';
  preparacionMin: number;
  limpiezaMin: number;
  cargaDescargaPlacaMin: number;
  registroPlacaMin: number;
  cambioMin: number;
  activacionSeg: number;
  herramientas: HerramientaCorte[];
};
export type DetallePerfilCorte = {
  procesamientoCorteVersion: 1;
  herramientaId: string;
  operacionCorte: OperacionCorte;
  material: string[];
  espesorMinMm: number;
  espesorMaxMm: number;
  modoVelocidad: 'POR_PASADA' | 'PROCESO_COMPLETO';
  pasadas: number;
  anchoCorteMm: number;
  ajusteMin?: number;
  entradaSeg?: number;
  profundidadMm?: number;
  profundidadPasadaMm?: number;
  presionN?: number;
  rpm?: number;
};
export const CAMPOS_PERFIL_CORTE = [
  'procesamientoCorteVersion',
  'herramientaId',
  'operacionCorte',
  'material',
  'espesorMinMm',
  'espesorMaxMm',
  'modoVelocidad',
  'pasadas',
  'anchoCorteMm',
  'ajusteMin',
  'entradaSeg',
  'profundidadMm',
  'profundidadPasadaMm',
  'presionN',
  'rpm',
];
export const PLANTILLAS_PROCESAMIENTO_CORTE = [
  'mesa_de_corte',
  'corte_laser',
  'router_cnc',
];
export const registroCorte = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export function configuracionCorteInicial(): ConfiguracionProcesamientoCorte {
  return {
    version: 1,
    posiciones: 1,
    cambio: 'MANUAL',
    preparacionMin: 0,
    limpiezaMin: 0,
    cargaDescargaPlacaMin: 0,
    registroPlacaMin: 0,
    cambioMin: 0,
    activacionSeg: 0,
    herramientas: [],
  };
}
export const esNumeroCorte = (v: unknown, min = 0): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min;
export function erroresConfiguracionCorte(
  value: unknown,
  plantilla?: string,
): string[] {
  const c = registroCorte(value),
    errores: string[] = [];
  if (c.version !== 1)
    errores.push(
      'La configuración de herramientas necesita una versión compatible.',
    );
  if (
    !Number.isInteger(c.posiciones) ||
    !esNumeroCorte(c.posiciones, 1) ||
    c.posiciones > 12
  )
    errores.push('Indicá entre 1 y 12 posiciones de herramientas.');
  if (!['MANUAL', 'AUTOMATICO'].includes(String(c.cambio)))
    errores.push('Indicá cómo se reemplazan las herramientas.');
  for (const key of [
    'preparacionMin',
    'limpiezaMin',
    'cargaDescargaPlacaMin',
    'registroPlacaMin',
    'cambioMin',
    'activacionSeg',
  ])
    if (!esNumeroCorte(c[key]))
      errores.push(`El tiempo ${key} debe ser un número no negativo.`);
  const herramientas = Array.isArray(c.herramientas) ? c.herramientas : [];
  if (!herramientas.some((h) => registroCorte(h).activo === true))
    errores.push('Agregá al menos una herramienta activa.');
  const ids = new Set<string>(),
    posiciones = new Set<number>();
  for (const raw of herramientas) {
    const h = registroCorte(raw),
      nombre = String(h.nombre || 'Sin nombre');
    if (typeof h.id !== 'string' || !h.id.trim() || ids.has(h.id))
      errores.push('Las herramientas deben tener identificadores únicos.');
    ids.add(String(h.id));
    if (typeof h.nombre !== 'string' || !h.nombre.trim())
      errores.push('Completá el nombre de la herramienta.');
    const tiposPermitidos =
      plantilla?.toLowerCase() === 'corte_laser'
        ? ['LASER']
        : plantilla?.toLowerCase() === 'router_cnc'
          ? ['FRESA']
          : ['CUCHILLA', 'OSCILANTE', 'RUEDA', 'FRESA'];
    if (plantilla && !tiposPermitidos.includes(String(h.tipo)))
      errores.push(
        `${nombre}: herramienta incompatible con esta plantilla de máquina.`,
      );
    if (
      h.tipo === 'RUEDA' &&
      Array.isArray(h.operaciones) &&
      h.operaciones.some((o) => o !== 'HENDIDO')
    )
      errores.push(`${nombre}: la rueda realiza hendido.`);
    if (
      h.tipo !== 'RUEDA' &&
      Array.isArray(h.operaciones) &&
      h.operaciones.includes('HENDIDO')
    )
      errores.push(
        `${nombre}: para hendido por deformación seleccioná una rueda; el corte de plegado se clasifica como corte parcial.`,
      );
    if (!Object.hasOwn(TIPOS_HERRAMIENTA_CORTE, String(h.tipo)))
      errores.push(`${nombre}: tipo de herramienta inválido.`);
    if (typeof h.activo !== 'boolean' || typeof h.montada !== 'boolean')
      errores.push(`${nombre}: estado de herramienta inválido.`);
    if (
      !Array.isArray(h.operaciones) ||
      !h.operaciones.length ||
      h.operaciones.some((o) => !OPERACIONES_CORTE.includes(o))
    )
      errores.push(`${nombre}: indicá las operaciones compatibles.`);
    if (
      !Number.isInteger(h.posicion) ||
      !esNumeroCorte(h.posicion, 1) ||
      h.posicion > Number(c.posiciones)
    )
      errores.push(`${nombre}: posición fuera de la capacidad de la máquina.`);
    if (h.activo && h.montada) {
      if (posiciones.has(Number(h.posicion)))
        errores.push(
          `${nombre}: hay dos herramientas montadas en la misma posición.`,
        );
      posiciones.add(Number(h.posicion));
    }
    for (const key of ['espesorMaxMm', 'diametroMm'])
      if (h[key] != null && !esNumeroCorte(h[key], Number.EPSILON))
        errores.push(`${nombre}: ${key} debe ser mayor que cero.`);
    const d = registroCorte(h.desgaste);
    if (!['INCLUIDO_CENTRO', 'POR_METRO', 'POR_HORA'].includes(String(d.modo)))
      errores.push(`${nombre}: indicá cómo se costea el desgaste.`);
    if (
      d.modo !== 'INCLUIDO_CENTRO' &&
      (!esNumeroCorte(d.costoReposicion, Number.EPSILON) ||
        !esNumeroCorte(d.vidaUtil, Number.EPSILON))
    )
      errores.push(`${nombre}: completá costo de reposición y vida útil.`);
  }
  return errores;
}
export function erroresPerfilCorte(
  perfil: {
    productivityValue?: unknown;
    productivityUnit?: unknown;
    detalle?: unknown;
    detalleJson?: unknown;
  },
  config: unknown,
): string[] {
  const d = registroCorte(perfil.detalle ?? perfil.detalleJson),
    c = registroCorte(config);
  const errores: string[] = [];
  if (d.procesamientoCorteVersion !== 1)
    errores.push('Activá el perfil por herramienta.');
  const herramientas = Array.isArray(c.herramientas) ? c.herramientas : [];
  const h = herramientas
    .map(registroCorte)
    .find((h) => h.id === d.herramientaId && h.activo === true);
  if (!h) errores.push('Elegí una herramienta activa de esta máquina.');
  if (!OPERACIONES_CORTE.includes(d.operacionCorte as OperacionCorte))
    errores.push('Elegí la operación del perfil.');
  else if (
    h &&
    (!Array.isArray(h.operaciones) || !h.operaciones.includes(d.operacionCorte))
  )
    errores.push('La herramienta no admite esta operación.');
  if (
    !Array.isArray(d.material) ||
    !d.material.length ||
    d.material.some((v) => typeof v !== 'string' || !v.trim())
  )
    errores.push('Elegí al menos un material para el perfil.');
  if (
    !esNumeroCorte(d.espesorMinMm, Number.EPSILON) ||
    !esNumeroCorte(d.espesorMaxMm, Number.EPSILON) ||
    d.espesorMaxMm < d.espesorMinMm
  )
    errores.push('Indicá un rango de espesores válido.');
  if (
    h &&
    esNumeroCorte(h.espesorMaxMm) &&
    Number(d.espesorMaxMm) > h.espesorMaxMm
  )
    errores.push(
      'El espesor del perfil supera la capacidad de la herramienta.',
    );
  if (!esNumeroCorte(perfil.productivityValue, Number.EPSILON))
    errores.push('Indicá una velocidad mayor que cero.');
  if (
    !['MM_S', 'MM_MIN', 'M_MIN'].includes(
      String(perfil.productivityUnit).toUpperCase(),
    )
  )
    errores.push('La velocidad debe expresarse en mm/s, mm/min o m/min.');
  if (!['POR_PASADA', 'PROCESO_COMPLETO'].includes(String(d.modoVelocidad)))
    errores.push(
      'Indicá si la velocidad es por pasada o del proceso completo.',
    );
  if (
    !Number.isInteger(d.pasadas) ||
    !esNumeroCorte(d.pasadas, 1) ||
    d.pasadas > 1000
  )
    errores.push('Indicá una cantidad entera de pasadas entre 1 y 1000.');
  if (!esNumeroCorte(d.anchoCorteMm))
    errores.push('Indicá el ancho efectivo de corte (puede ser cero).');
  for (const key of [
    'ajusteMin',
    'entradaSeg',
    'profundidadMm',
    'profundidadPasadaMm',
    'presionN',
    'rpm',
  ])
    if (d[key] != null && !esNumeroCorte(d[key]))
      errores.push(`${key} debe ser un número no negativo.`);
  if (d.modoVelocidad === 'PROCESO_COMPLETO' && Number(d.entradaSeg) > 0)
    errores.push(
      'La velocidad efectiva ya incluye maniobras; quitá el tiempo adicional por entrada.',
    );
  return errores;
}

export type OperacionCorteCosteada = {
  operacion: OperacionCorte;
  perfilId: string;
  perfilNombre: string;
  herramienta: HerramientaCorte;
  parametros: DetallePerfilCorte;
  velocidad: number;
  unidadVelocidad: string;
  metros: number;
  ahorroRecorridoM: number;
  metrosProcesados: number;
  entradas: number;
  recorridoMin: number;
  ajusteMin: number;
  desgasteCosto: number;
  fuentes: Array<{
    piezaId: string;
    geometriaId?: string;
    archivoHash?: string;
    entidadId: string;
    capa: string;
    metros: number;
  }>;
};
export type ProcesamientoCorteCosteado = {
  version: 1;
  maquinaId: string;
  configuracion: ConfiguracionProcesamientoCorte;
  firmaConfiguracion: string;
  redondeo?: 'EXACTO' | 'MINUTO';
  /** El desglose es el de toda la tanda; el nodo recibe esta participación. */
  participacion?: {
    loteId: string;
    porcentaje: number;
    runAsignadoMin: number;
    desgasteAsignadoCosto: number;
  };
  materialId: string;
  materialVarianteId?: string;
  espesorMm: number;
  operaciones: OperacionCorteCosteada[];
  placas: number;
  manejoMin: number;
  cambiosMin: number;
  cambiosHerramienta: number;
  activaciones: number;
  ajustesMin: number;
  recorridoMin: number;
  runMin: number;
  desgasteCosto: number;
};
