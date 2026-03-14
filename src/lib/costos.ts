export type TipoCentroCosto =
  | "productivo"
  | "apoyo"
  | "administrativo"
  | "comercial"
  | "logistico"
  | "tercerizado";

export type CategoriaGraficaCentroCosto =
  | "preprensa"
  | "impresion"
  | "terminacion"
  | "empaque"
  | "logistica"
  | "calidad"
  | "mantenimiento"
  | "administracion"
  | "comercial"
  | "tercerizado";

export type ImputacionPreferidaCentroCosto =
  | "directa"
  | "indirecta"
  | "reparto";

export type UnidadBaseCentroCosto =
  | "ninguna"
  | "hora_maquina"
  | "hora_hombre"
  | "pliego"
  | "unidad"
  | "m2"
  | "kg";

export type EstadoConfiguracionCentroCosto =
  | "sin_configurar"
  | "borrador"
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

export type AreaCosto = {
  id: string;
  plantaId: string;
  plantaNombre: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  activa: boolean;
};

export type CentroCosto = {
  id: string;
  plantaId: string;
  plantaNombre: string;
  areaCostoId: string;
  areaCostoNombre: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  tipoCentro: TipoCentroCosto;
  categoriaGrafica: CategoriaGraficaCentroCosto;
  imputacionPreferida: ImputacionPreferidaCentroCosto;
  unidadBaseFutura: UnidadBaseCentroCosto;
  responsableEmpleadoId: string;
  responsableEmpleadoNombre: string;
  activo: boolean;
  estadoConfiguracion: EstadoConfiguracionCentroCosto;
  ultimoPeriodoConfigurado: string;
  ultimaTarifaPublicada: number | null;
  unidadTarifaPublicada: UnidadBaseCentroCosto | "";
  ultimaTarifaBase: number | null;
  ultimaTarifaAbsorbida: number | null;
  ultimaTarifaTotal: number | null;
  ultimaCapacidadPractica: number | null;
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
  unidadBase: UnidadBaseCentroCosto;
  diasPorMes: number;
  horasPorDia: number;
  capacidadTeorica: number;
  capacidadPractica: number;
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

export type CentroCostoConfiguracionDetalle = {
  periodo: string;
  centro: CentroCosto;
  recursos: CentroCostoRecurso[];
  recursosMaquinaria: CentroCostoRecursoMaquinariaPeriodo[];
  componentesCosto: CentroCostoComponenteCosto[];
  capacidad: CentroCostoCapacidad | null;
  tarifaBorrador: CentroCostoTarifaPeriodo | null;
  tarifaPublicada: CentroCostoTarifaPeriodo | null;
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

export type AreaCostoPayload = {
  plantaId: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
};

export type CentroCostoPayload = {
  plantaId: string;
  areaCostoId: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipoCentro: TipoCentroCosto;
  categoriaGrafica: CategoriaGraficaCentroCosto;
  imputacionPreferida: ImputacionPreferidaCentroCosto;
  unidadBaseFutura: UnidadBaseCentroCosto;
  responsableEmpleadoId?: string;
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

export type CentroCostoCapacidadPayload = {
  diasPorMes: number;
  horasPorDia: number;
  overrideManualCapacidad?: number;
};

export const tipoCentroItems: Array<{ label: string; value: TipoCentroCosto }> = [
  { label: "Productivo", value: "productivo" },
  { label: "Apoyo", value: "apoyo" },
  { label: "Administrativo", value: "administrativo" },
  { label: "Comercial", value: "comercial" },
  { label: "Logistico", value: "logistico" },
  { label: "Tercerizado", value: "tercerizado" },
];

export const categoriaGraficaItems: Array<{
  label: string;
  value: CategoriaGraficaCentroCosto;
}> = [
  { label: "Preprensa", value: "preprensa" },
  { label: "Impresion", value: "impresion" },
  { label: "Terminacion", value: "terminacion" },
  { label: "Empaque", value: "empaque" },
  { label: "Logistica", value: "logistica" },
  { label: "Calidad", value: "calidad" },
  { label: "Mantenimiento", value: "mantenimiento" },
  { label: "Administracion", value: "administracion" },
  { label: "Comercial", value: "comercial" },
  { label: "Tercerizado", value: "tercerizado" },
];

export const imputacionPreferidaItems: Array<{
  label: string;
  value: ImputacionPreferidaCentroCosto;
}> = [
  { label: "Directa", value: "directa" },
  { label: "Indirecta", value: "indirecta" },
  { label: "Reparto", value: "reparto" },
];

export const unidadBaseItems: Array<{ label: string; value: UnidadBaseCentroCosto }> = [
  { label: "Ninguna", value: "ninguna" },
  { label: "Hora maquina", value: "hora_maquina" },
  { label: "Hora hombre", value: "hora_hombre" },
  { label: "Pliego", value: "pliego" },
  { label: "Unidad", value: "unidad" },
  { label: "m2", value: "m2" },
  { label: "Kg", value: "kg" },
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
  { label: "Publicado", value: "publicado" },
];

const tipoCentroLabels = new Map(
  tipoCentroItems.map((item) => [item.value, item.label] as const),
);

const categoriaGraficaLabels = new Map(
  categoriaGraficaItems.map((item) => [item.value, item.label] as const),
);

const imputacionPreferidaLabels = new Map(
  imputacionPreferidaItems.map((item) => [item.value, item.label] as const),
);

const unidadBaseLabels = new Map(
  unidadBaseItems.map((item) => [item.value, item.label] as const),
);

const tipoRecursoLabels = new Map(
  tipoRecursoItems.map((item) => [item.value, item.label] as const),
);

const tipoGastoGeneralLabels = new Map(
  tipoGastoGeneralItems.map((item) => [item.value, item.label] as const),
);

const categoriaComponenteCostoLabels = new Map(
  categoriaComponenteCostoItems.map((item) => [item.value, item.label] as const),
);

const estadoConfiguracionLabels = new Map(
  estadoConfiguracionItems.map((item) => [item.value, item.label] as const),
);

export function getTipoCentroLabel(value: TipoCentroCosto) {
  return tipoCentroLabels.get(value) ?? value;
}

export function getCategoriaGraficaLabel(value: CategoriaGraficaCentroCosto) {
  return categoriaGraficaLabels.get(value) ?? value;
}

export function getImputacionPreferidaLabel(
  value: ImputacionPreferidaCentroCosto,
) {
  return imputacionPreferidaLabels.get(value) ?? value;
}

export function getUnidadBaseLabel(value: UnidadBaseCentroCosto | "") {
  if (!value) {
    return "";
  }

  return unidadBaseLabels.get(value) ?? value;
}

export function getTipoRecursoLabel(value: TipoRecursoCentroCosto) {
  return tipoRecursoLabels.get(value) ?? value;
}

export function getTipoGastoGeneralLabel(value: TipoGastoGeneralCentroCosto | "") {
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

export function getSuggestedUnidadBase(
  tipoCentro: TipoCentroCosto,
  categoriaGrafica: CategoriaGraficaCentroCosto,
): UnidadBaseCentroCosto {
  if (tipoCentro === "tercerizado") {
    if (categoriaGrafica === "tercerizado" || categoriaGrafica === "empaque") {
      return "unidad";
    }

    return "m2";
  }

  if (tipoCentro === "administrativo") {
    return "hora_hombre";
  }

  if (categoriaGrafica === "impresion") {
    return "hora_maquina";
  }

  if (categoriaGrafica === "preprensa") {
    return "hora_hombre";
  }

  return "unidad";
}

export function getSuggestedImputacion(
  tipoCentro: TipoCentroCosto,
): ImputacionPreferidaCentroCosto {
  if (tipoCentro === "administrativo") {
    return "indirecta";
  }

  if (tipoCentro === "tercerizado") {
    return "reparto";
  }

  return "directa";
}
