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
  | 'corte'
  | 'ciclo'
  | 'unidad'
  | 'kg'
  | 'litro'
  | 'lote';

export type TipoOperacionProceso =
  | 'preprensa'
  | 'prensa'
  | 'postprensa'
  | 'acabado'
  | 'servicio'
  | 'instalacion';

export type ModoProductividadProceso = 'fija' | 'variable';
export type ModoProductividadNivel =
  | 'fija'
  | 'variable_manual'
  | 'variable_perfil';

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
  niveles: ProcesoOperacionNivel[];
  activo: boolean;
  warnings?: string[];
};

export type ProcesoOperacionNivel = {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  modoProductividadNivel: ModoProductividadNivel;
  tiempoFijoMin: number | null;
  productividadBase: number | null;
  unidadSalida: UnidadProceso | null;
  unidadTiempo: UnidadProceso | null;
  maquinaId: string | null;
  maquinaNombre: string;
  perfilOperativoId: string | null;
  perfilOperativoNombre: string;
  setupMin: number | null;
  cleanupMin: number | null;
  resumen: string;
  detalle: Record<string, unknown> | null;
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
  niveles?: ProcesoOperacionNivelPayload[];
  activo: boolean;
};

export type ProcesoOperacionNivelPayload = {
  id?: string;
  nombre: string;
  orden?: number;
  activo: boolean;
  modoProductividadNivel: ModoProductividadNivel;
  tiempoFijoMin?: number;
  productividadBase?: number;
  unidadSalida?: UnidadProceso;
  unidadTiempo?: UnidadProceso;
  maquinaId?: string;
  perfilOperativoId?: string;
  setupMin?: number;
  cleanupMin?: number;
  detalle?: Record<string, unknown>;
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
  tiempoFijoMin: number | null;
  modoProductividad: ModoProductividadProceso;
  productividadBase: number | null;
  unidadEntrada: UnidadProceso;
  unidadSalida: UnidadProceso;
  unidadTiempo: UnidadProceso;
  mermaRunPct: number | null;
  reglaVelocidad: Record<string, unknown> | null;
  reglaMerma: Record<string, unknown> | null;
  observaciones: string;
  niveles: ProcesoOperacionNivel[];
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
  tiempoFijoMin?: number;
  modoProductividad?: ModoProductividadProceso;
  productividadBase?: number;
  unidadEntrada?: UnidadProceso;
  unidadSalida?: UnidadProceso;
  unidadTiempo?: UnidadProceso;
  mermaRunPct?: number;
  reglaVelocidad?: Record<string, unknown>;
  reglaMerma?: Record<string, unknown>;
  observaciones?: string;
  niveles?: ProcesoOperacionNivelPayload[];
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
  { label: 'Preprensa', value: 'preprensa' },
  { label: 'Prensa', value: 'prensa' },
  { label: 'Post-prensa', value: 'postprensa' },
  { label: 'Acabado', value: 'acabado' },
  { label: 'Servicio', value: 'servicio' },
  { label: 'Instalación', value: 'instalacion' },
];

export const modoProductividadProcesoItems: Array<{
  label: string;
  value: ModoProductividadProceso;
}> = [
  { label: 'Fija', value: 'fija' },
  { label: 'Variable', value: 'variable' },
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
  { label: 'Corte', value: 'corte' },
  { label: 'Ciclo', value: 'ciclo' },
  { label: 'Unidad', value: 'unidad' },
  { label: 'Kilogramo', value: 'kg' },
  { label: 'Litro', value: 'litro' },
  { label: 'Lote', value: 'lote' },
];
