/**
 * Un centro produce lo que se vende, o es estructura que se reparte entre los
 * que producen. No hay un tercer caso.
 */
export type TipoCentroCosto = "productivo" | "no_productivo";

export type EstadoConfiguracionCentroCosto =
  | "sin_configurar"
  | "borrador"
  | "borrador_pendiente"
  | "publicado";

export type TipoRecursoCentroCosto =
  | "empleado"
  | "maquinaria"
  | "gasto_general"
  | "activo_fijo";

export type TipoGastoGeneralCentroCosto =
  | "limpieza"
  | "mantenimiento"
  | "servicios"
  | "alquiler"
  | "otro";

export type CategoriaComponenteCostoCentro =
  | "sueldos"
  | "cargas"
  | "mantenimiento"
  | "energia"
  | "alquiler"
  | "amortizacion"
  | "tercerizacion"
  | "insumos_indirectos"
  | "otros";

export type OrigenComponenteCostoCentro = "manual" | "sugerido";

export type EstadoTarifaCentroCosto = "borrador" | "publicada";
export type MetodoDepreciacionMaquina = "lineal";

export type Planta = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  activa: boolean;
};

export type CentroCosto = {
  id: string;
  plantaId: string;
  plantaNombre: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  tipoCentro: TipoCentroCosto;
  activo: boolean;
  estadoConfiguracion: EstadoConfiguracionCentroCosto;
  ultimoPeriodoConfigurado: string;
  ultimaTarifaPublicada: number | null;
  ultimaTarifaBase: number | null;
  ultimaTarifaAbsorbida: number | null;
  ultimaTarifaTotal: number | null;
  ultimaCapacidadPractica: number | null;
};

export type SeccionCentroCostoLinea =
  | "gasto_general"
  | "empleado"
  | "activo_fijo";

/** Una fila de la planilla, tal como vuelve del servidor. */
export type CentroCostoLinea = {
  id: string;
  periodo: string;
  seccion: SeccionCentroCostoLinea;
  nombre: string;
  categoria: CategoriaComponenteCostoCentro | null;
  ocupacion: string | null;
  dedicacionPct: number | null;
  salarioMensual: number | null;
  cargasPct: number | null;
  vidaUtilRestanteMeses: number | null;
  valorActual: number | null;
  valorFinalVida: number | null;
  importeMensual: number;
  orden: number;
  notas: string | null;
};

/**
 * Lo que se manda al guardar. Sin `importeMensual`: si el total viajara, la
 * planilla podría mostrar una cosa y costear otra.
 */
export type CentroCostoLineaPayload = {
  seccion: SeccionCentroCostoLinea;
  nombre: string;
  categoria?: CategoriaComponenteCostoCentro;
  valorMensual?: number;
  ocupacion?: string;
  dedicacionPct?: number;
  salarioMensual?: number;
  cargasPct?: number;
  vidaUtilRestanteMeses?: number;
  valorActual?: number;
  valorFinalVida?: number;
  notas?: string;
};

/**
 * Una fila del listado de centros, con los números vivos del período.
 *
 * `prorrateado` es lo que un centro de estructura manda a los productivos, y
 * `absorbido` lo que cada productivo recibe: el total de las dos columnas tiene
 * que coincidir, y el listado lo muestra para que se vea de un vistazo que el
 * reparto no perdió plata.
 *
 * `horasProductivas` y `valorHora` vienen en null en los centros que reparten
 * su costo entero: lo que cuestan ya se cobra dentro de los productivos que los
 * absorbieron, y mostrarles una tarifa invitaría a cobrarlo dos veces.
 */
export type ResumenCentroCostoFila = {
  id: string;
  codigo: string;
  nombre: string;
  tipoCentro: TipoCentroCosto;
  horasProductivas: number | null;
  gastos: number;
  absorbido: number;
  prorrateado: number;
  gastoTotal: number;
  valorHora: number | null;
  lineas: number;
};

export type ResumenCentrosCosto = {
  periodo: string;
  centros: ResumenCentroCostoFila[];
  totales: {
    gastos: number;
    absorbido: number;
    prorrateado: number;
    gastoTotal: number;
  };
};

export type CentroCostoRecurso = {
  id: string;
  periodo: string;
  tipoRecurso: TipoRecursoCentroCosto;
  empleadoId: string;
  empleadoNombre: string;
  maquinaId: string;
  maquinaNombre: string;
  nombreRecurso: string;
  tipoGastoGeneral: TipoGastoGeneralCentroCosto | "";
  valorMensual: number | null;
  vidaUtilRestanteMeses: number | null;
  valorActual: number | null;
  valorFinalVida: number | null;
  depreciacionMensualCalc: number | null;
  descripcion: string;
  porcentajeAsignacion: number | null;
  activo: boolean;
};

export type CentroCostoRecursoMaquinariaPeriodo = {
  id: string;
  centroCostoRecursoId: string;
  periodo: string;
  maquinaId: string;
  maquinaNombre: string;
  metodoDepreciacion: MetodoDepreciacionMaquina;
  valorCompra: number;
  valorResidual: number;
  vidaUtilMeses: number;
  potenciaNominalKw: number;
  factorCargaPct: number;
  tarifaEnergiaKwh: number;
  horasProgramadasMes: number;
  disponibilidadPct: number;
  eficienciaPct: number;
  horasProductivas: number;
  mantenimientoMensual: number;
  segurosMensual: number;
  otrosFijosMensual: number;
  amortizacionMensual: number;
  energiaMensual: number;
  costoMensualTotal: number;
  tarifaHora: number;
  updatedAt: string;
};

export type CentroCostoComponenteCosto = {
  id: string;
  periodo: string;
  categoria: CategoriaComponenteCostoCentro;
  nombre: string;
  origen: OrigenComponenteCostoCentro;
  importeMensual: number;
  notas: string;
  detalle: Record<string, unknown> | null;
};

export type CentroCostoCapacidad = {
  id: string;
  periodo: string;
  diasPorMes: number;
  horasPorDia: number;
  porcentajeNoProductivo: number;
  capacidadTeorica: number;
  capacidadPractica: number;
  /** Las horas del período. Es lo que divide el costo para dar el valor hora. */
  horasProductivas: number;
  overrideManualCapacidad: number | null;
};

export type CentroCostoTarifaPeriodo = {
  id: string;
  periodo: string;
  costoMensualTotal: number;
  capacidadPractica: number;
  tarifaCalculada: number;
  estado: EstadoTarifaCentroCosto;
  resumen: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type RepartoAbsorbidoCentroCosto = {
  total: number;
  desglose: {
    desdeCentroCostoId: string;
    desdeCentroCodigo: string;
    desdeCentroNombre: string;
    monto: number;
  }[];
};

export type CentroCostoConfiguracionDetalle = {
  periodo: string;
  centro: CentroCosto;
  /** La planilla del período: lo que edita la ficha y lo que costea el motor. */
  lineas: CentroCostoLinea[];
  recursos: CentroCostoRecurso[];
  recursosMaquinaria: CentroCostoRecursoMaquinariaPeriodo[];
  componentesCosto: CentroCostoComponenteCosto[];
  capacidad: CentroCostoCapacidad | null;
  tarifaBorrador: CentroCostoTarifaPeriodo | null;
  tarifaPublicada: CentroCostoTarifaPeriodo | null;
  repartoAbsorbido?: RepartoAbsorbidoCentroCosto;
  advertencias: string[];
  empleadosDisponibilidad: EmpleadoDisponibilidadCentroCosto[];
};

export type EmpleadoAsignacionCentroCosto = {
  centroCostoId: string;
  centroCodigo: string;
  centroNombre: string;
  porcentajeAsignacion: number;
};

export type EmpleadoDisponibilidadCentroCosto = {
  empleadoId: string;
  empleadoNombre: string;
  porcentajeAsignadoEnEsteCentro: number;
  porcentajeAsignadoEnOtrosCentros: number;
  porcentajeDisponible: number;
  asignacionesOtrosCentros: EmpleadoAsignacionCentroCosto[];
};

export type PlantaPayload = {
  codigo: string;
  nombre: string;
  descripcion?: string;
};

export type CentroCostoPayload = {
  plantaId: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipoCentro: TipoCentroCosto;
  activo: boolean;
};

export type CentroCostoRecursoPayload = {
  tipoRecurso: TipoRecursoCentroCosto;
  empleadoId?: string;
  maquinaId?: string;
  nombreRecurso?: string;
  tipoGastoGeneral?: TipoGastoGeneralCentroCosto;
  valorMensual?: number;
  vidaUtilRestanteMeses?: number;
  valorActual?: number;
  valorFinalVida?: number;
  descripcion?: string;
  porcentajeAsignacion?: number;
  activo: boolean;
};

export type CentroCostoRecursoMaquinariaPayload = {
  centroCostoRecursoId: string;
  maquinaId?: string;
  nombreRecurso?: string;
  metodoDepreciacion: MetodoDepreciacionMaquina;
  valorCompra: number;
  valorResidual: number;
  vidaUtilMeses: number;
  potenciaNominalKw?: number;
  factorCargaPct?: number;
  tarifaEnergiaKwh?: number;
  horasProgramadasMes?: number;
  disponibilidadPct?: number;
  eficienciaPct?: number;
  mantenimientoMensual: number;
  segurosMensual: number;
  otrosFijosMensual: number;
};

export type CentroCostoComponenteCostoPayload = {
  categoria: CategoriaComponenteCostoCentro;
  nombre: string;
  origen: OrigenComponenteCostoCentro;
  importeMensual: number;
  notas?: string;
  detalle?: Record<string, unknown>;
};

export type CentroCostoCapacidadManualPayload = {
  /** Las horas del período, cargadas a mano. Manda sobre la fórmula vieja. */
  horasProductivas: number;
};

export type CentroCostoCapacidadPayload = {
  diasPorMes: number;
  horasPorDia: number;
  porcentajeNoProductivo?: number;
  overrideManualCapacidad?: number;
};

export const tipoCentroItems: Array<{ label: string; value: TipoCentroCosto }> =
  [
    { label: "Productivo", value: "productivo" },
    { label: "No productivo", value: "no_productivo" },
  ];

export const tipoRecursoItems: Array<{
  label: string;
  value: TipoRecursoCentroCosto;
}> = [
  { label: "Persona", value: "empleado" },
  { label: "Maquinaria", value: "maquinaria" },
  { label: "Gasto general", value: "gasto_general" },
  { label: "Activo fijo", value: "activo_fijo" },
];

export const tipoGastoGeneralItems: Array<{
  label: string;
  value: TipoGastoGeneralCentroCosto;
}> = [
  { label: "Limpieza", value: "limpieza" },
  { label: "Mantenimiento", value: "mantenimiento" },
  { label: "Servicios", value: "servicios" },
  { label: "Alquiler", value: "alquiler" },
  { label: "Otro", value: "otro" },
];

export const categoriaComponenteCostoItems: Array<{
  label: string;
  value: CategoriaComponenteCostoCentro;
}> = [
  { label: "Sueldos", value: "sueldos" },
  { label: "Cargas", value: "cargas" },
  { label: "Mantenimiento", value: "mantenimiento" },
  { label: "Energia", value: "energia" },
  { label: "Alquiler", value: "alquiler" },
  { label: "Amortizacion", value: "amortizacion" },
  { label: "Tercerizacion", value: "tercerizacion" },
  { label: "Insumos indirectos", value: "insumos_indirectos" },
  { label: "Otros", value: "otros" },
];

export const origenComponenteCostoItems: Array<{
  label: string;
  value: OrigenComponenteCostoCentro;
}> = [
  { label: "Manual", value: "manual" },
  { label: "Sugerido", value: "sugerido" },
];

export const estadoConfiguracionItems: Array<{
  label: string;
  value: EstadoConfiguracionCentroCosto;
}> = [
  { label: "Sin configurar", value: "sin_configurar" },
  { label: "Borrador", value: "borrador" },
  { label: "Borrador pendiente", value: "borrador_pendiente" },
  { label: "Publicado", value: "publicado" },
];

const tipoCentroLabels = new Map(
  tipoCentroItems.map((item) => [item.value, item.label] as const),
);

const tipoRecursoLabels = new Map(
  tipoRecursoItems.map((item) => [item.value, item.label] as const),
);

const tipoGastoGeneralLabels = new Map(
  tipoGastoGeneralItems.map((item) => [item.value, item.label] as const),
);

const categoriaComponenteCostoLabels = new Map(
  categoriaComponenteCostoItems.map(
    (item) => [item.value, item.label] as const,
  ),
);

const estadoConfiguracionLabels = new Map(
  estadoConfiguracionItems.map((item) => [item.value, item.label] as const),
);

export function getTipoCentroLabel(value: TipoCentroCosto) {
  return tipoCentroLabels.get(value) ?? value;
}

export function getTipoRecursoLabel(value: TipoRecursoCentroCosto) {
  return tipoRecursoLabels.get(value) ?? value;
}

export function getTipoGastoGeneralLabel(
  value: TipoGastoGeneralCentroCosto | "",
) {
  if (!value) {
    return "";
  }

  return tipoGastoGeneralLabels.get(value) ?? value;
}

export function getCategoriaComponenteCostoLabel(
  value: CategoriaComponenteCostoCentro,
) {
  return categoriaComponenteCostoLabels.get(value) ?? value;
}

export function getEstadoConfiguracionLabel(
  value: EstadoConfiguracionCentroCosto,
) {
  return estadoConfiguracionLabels.get(value) ?? value;
}

export function getCurrentPeriodo() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

/** Período "YYYY-MM" inmediatamente anterior (retrocede de enero a diciembre). */
export function periodoAnterior(periodo: string): string {
  const [anioStr, mesStr] = periodo.split("-");
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  if (!Number.isFinite(anio) || !Number.isFinite(mes)) return periodo;
  const prevMes = mes === 1 ? 12 : mes - 1;
  const prevAnio = mes === 1 ? anio - 1 : anio;
  return `${prevAnio}-${String(prevMes).padStart(2, "0")}`;
}

