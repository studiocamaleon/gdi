import type { PlantillaMaquinaria } from '@/lib/maquinaria';

export type EstadoConfiguracionProceso = 'borrador' | 'incompleta' | 'lista';
export type UnidadProceso =
  | 'ninguna'
  | 'hora'
  | 'minuto'
  | 'hoja'
  | 'copia'
  | 'a4_equiv'
  | 'm2'
  | 'metro_lineal'
  | 'pieza'
  | 'ciclo'
  | 'unidad'
  | 'kg'
  | 'litro'
  | 'lote';

export type TipoOperacionProceso =
  | 'preflight'
  | 'preprensa'
  | 'impresion'
  | 'corte'
  | 'mecanizado'
  | 'grabado'
  | 'terminacion'
  | 'curado'
  | 'laminado'
  | 'transferencia'
  | 'control_calidad'
  | 'empaque'
  | 'logistica'
  | 'tercerizado'
  | 'otro';

export type ModoProductividadProceso = 'fija' | 'formula' | 'tabla';

export type ProcesoOperacion = {
  id: string;
  orden: number;
  codigo: string;
  nombre: string;
  tipoOperacion: TipoOperacionProceso;
  centroCostoId: string;
  centroCostoNombre: string;
  maquinaId: string;
  maquinaNombre: string;
  perfilOperativoId: string;
  perfilOperativoNombre: string;
  setupMin: number | null;
  runMin: number | null;
  cleanupMin: number | null;
  tiempoFijoMin: number | null;
  modoProductividad: ModoProductividadProceso;
  productividadBase: number | null;
  unidadEntrada: UnidadProceso;
  unidadSalida: UnidadProceso;
  unidadTiempo: UnidadProceso;
  mermaSetup: number | null;
  mermaRunPct: number | null;
  reglaVelocidad: Record<string, unknown> | null;
  reglaMerma: Record<string, unknown> | null;
  detalle: Record<string, unknown> | null;
  activo: boolean;
  warnings?: string[];
};

export type Proceso = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  plantillaMaquinaria: PlantillaMaquinaria | null;
  currentVersion: number;
  estadoConfiguracion: EstadoConfiguracionProceso;
  activo: boolean;
  observaciones: string;
  advertencias?: string[];
  operaciones: ProcesoOperacion[];
  createdAt: string;
  updatedAt: string;
};

export type ProcesoOperacionPayload = {
  codigo?: string;
  nombre: string;
  tipoOperacion: TipoOperacionProceso;
  centroCostoId?: string;
  maquinaId?: string;
  perfilOperativoId?: string;
  orden?: number;
  setupMin?: number;
  runMin?: number;
  cleanupMin?: number;
  tiempoFijoMin?: number;
  modoProductividad?: ModoProductividadProceso;
  productividadBase?: number;
  unidadEntrada?: UnidadProceso;
  unidadSalida?: UnidadProceso;
  unidadTiempo?: UnidadProceso;
  mermaSetup?: number;
  mermaRunPct?: number;
  reglaVelocidad?: Record<string, unknown>;
  reglaMerma?: Record<string, unknown>;
  detalle?: Record<string, unknown>;
  activo: boolean;
};

export type ProcesoPayload = {
  codigo?: string;
  nombre: string;
  descripcion?: string;
  plantillaMaquinaria?: PlantillaMaquinaria | null;
  estadoConfiguracion?: EstadoConfiguracionProceso;
  activo: boolean;
  observaciones?: string;
  operaciones: ProcesoOperacionPayload[];
};

export type ProcesoOperacionPlantilla = {
  id: string;
  nombre: string;
  tipoOperacion: TipoOperacionProceso;
  centroCostoId: string | null;
  centroCostoNombre: string;
  maquinaId: string | null;
  maquinaNombre: string;
  perfilOperativoId: string | null;
  perfilOperativoNombre: string;
  setupMin: number | null;
  cleanupMin: number | null;
  modoProductividad: ModoProductividadProceso;
  productividadBase: number | null;
  unidadEntrada: UnidadProceso;
  unidadSalida: UnidadProceso;
  unidadTiempo: UnidadProceso;
  mermaRunPct: number | null;
  reglaVelocidad: Record<string, unknown> | null;
  reglaMerma: Record<string, unknown> | null;
  observaciones: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProcesoOperacionPlantillaPayload = {
  nombre: string;
  tipoOperacion: TipoOperacionProceso;
  centroCostoId?: string;
  maquinaId?: string;
  perfilOperativoId?: string;
  setupMin?: number;
  cleanupMin?: number;
  modoProductividad?: ModoProductividadProceso;
  productividadBase?: number;
  unidadEntrada?: UnidadProceso;
  unidadSalida?: UnidadProceso;
  unidadTiempo?: UnidadProceso;
  mermaRunPct?: number;
  reglaVelocidad?: Record<string, unknown>;
  reglaMerma?: Record<string, unknown>;
  observaciones?: string;
  activo: boolean;
};

export const estadoConfiguracionProcesoItems: Array<{
  label: string;
  value: EstadoConfiguracionProceso;
}> = [
  { label: 'Borrador', value: 'borrador' },
  { label: 'Incompleta', value: 'incompleta' },
  { label: 'Lista', value: 'lista' },
];

export const tipoOperacionProcesoItems: Array<{
  label: string;
  value: TipoOperacionProceso;
}> = [
  { label: 'Preflight', value: 'preflight' },
  { label: 'Preprensa', value: 'preprensa' },
  { label: 'Impresion', value: 'impresion' },
  { label: 'Corte', value: 'corte' },
  { label: 'Mecanizado', value: 'mecanizado' },
  { label: 'Grabado', value: 'grabado' },
  { label: 'Terminacion', value: 'terminacion' },
  { label: 'Curado', value: 'curado' },
  { label: 'Laminado', value: 'laminado' },
  { label: 'Transferencia', value: 'transferencia' },
  { label: 'Control calidad', value: 'control_calidad' },
  { label: 'Empaque', value: 'empaque' },
  { label: 'Logistica', value: 'logistica' },
  { label: 'Tercerizado', value: 'tercerizado' },
  { label: 'Otro', value: 'otro' },
];

export const modoProductividadProcesoItems: Array<{
  label: string;
  value: ModoProductividadProceso;
}> = [
  { label: 'Fija', value: 'fija' },
  { label: 'Formula', value: 'formula' },
  { label: 'Tabla', value: 'tabla' },
];

export const unidadProcesoItems: Array<{ label: string; value: UnidadProceso }> = [
  { label: 'No aplica', value: 'ninguna' },
  { label: 'Hora', value: 'hora' },
  { label: 'Minuto', value: 'minuto' },
  { label: 'Hoja', value: 'hoja' },
  { label: 'Copia', value: 'copia' },
  { label: 'A4 equivalente', value: 'a4_equiv' },
  { label: 'Metro cuadrado', value: 'm2' },
  { label: 'Metro lineal', value: 'metro_lineal' },
  { label: 'Pieza', value: 'pieza' },
  { label: 'Ciclo', value: 'ciclo' },
  { label: 'Unidad', value: 'unidad' },
  { label: 'Kilogramo', value: 'kg' },
  { label: 'Litro', value: 'litro' },
  { label: 'Lote', value: 'lote' },
];
