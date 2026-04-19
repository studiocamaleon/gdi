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
  | 'instalacion'
  | 'entrega_despacho';

export type RolProcesoOperacion = 'impresion';

export type ModoProductividadProceso = 'fija' | 'variable';
export type BaseCalculoProductividad =
  | 'cantidad'
  | 'area_total_m2'
  | 'metro_lineal_total'
  | 'perimetro_total_ml';

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
  multiplicadorDobleFaz: number | null;
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
  baseCalculoProductividad?: BaseCalculoProductividad | null;
  rol: RolProcesoOperacion | null;
  esOpcional: boolean;
  activo: boolean;
  warnings?: string[];
};

// P4.1 — ProcesoOperacionNivel eliminado. Las "variantes de productividad"
// se representan ahora como ProcesoOperacionAlternativa con overrides.

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
  multiplicadorDobleFaz?: number;
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
  baseCalculoProductividad?: BaseCalculoProductividad;
  rol?: RolProcesoOperacion;
  esOpcional?: boolean;
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
  maquinaPlantilla: string | null;
  perfilOperativoId: string | null;
  perfilOperativoNombre: string;
  setupMin: number | null;
  cleanupMin: number | null;
  tiempoFijoMin: number | null;
  multiplicadorDobleFaz: number | null;
  modoProductividad: ModoProductividadProceso;
  productividadBase: number | null;
  unidadEntrada: UnidadProceso;
  unidadSalida: UnidadProceso;
  unidadTiempo: UnidadProceso;
  mermaRunPct: number | null;
  reglaVelocidad: Record<string, unknown> | null;
  reglaMerma: Record<string, unknown> | null;
  detalle: Record<string, unknown> | null;
  baseCalculoProductividad?: BaseCalculoProductividad | null;
  observaciones: string;
  estacionId: string | null;
  estacionNombre: string;
  // P3.a.1 — Modelo universal en plantilla
  familiaV2: string | null;
  unidadProductivaV2: string | null;
  activacionV2: "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL" | null;
  condicionV2: Record<string, unknown> | null;
  leeDelTrabajoV2: string[] | null;
  leeDePasosV2: string[] | null;
  produceV2: string[] | null;
  configNestingV2: Record<string, unknown> | null;
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
  multiplicadorDobleFaz?: number;
  modoProductividad?: ModoProductividadProceso;
  productividadBase?: number;
  unidadEntrada?: UnidadProceso;
  unidadSalida?: UnidadProceso;
  unidadTiempo?: UnidadProceso;
  mermaRunPct?: number;
  reglaVelocidad?: Record<string, unknown>;
  reglaMerma?: Record<string, unknown>;
  baseCalculoProductividad?: BaseCalculoProductividad;
  observaciones?: string;
  estacionId?: string;
  // P3.a.1 — Modelo universal
  familiaV2?: string;
  unidadProductivaV2?: string;
  activacionV2?: "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL";
  condicionV2?: Record<string, unknown>;
  leeDelTrabajoV2?: string[];
  leeDePasosV2?: string[];
  produceV2?: string[];
  configNestingV2?: Record<string, unknown>;
  activo: boolean;
};

export const rolProcesoOperacionItems: Array<{
  label: string;
  value: RolProcesoOperacion | '';
}> = [
  { label: 'Ninguno', value: '' },
  { label: 'Impresión', value: 'impresion' },
];

export const estadoConfiguracionProcesoItems: Array<{
  label: string;
  value: EstadoConfiguracionProceso;
}> = [
  { label: 'Borrador', value: 'borrador' },
  { label: 'Incompleta', value: 'incompleta' },
  { label: 'Lista', value: 'lista' },
];

export const etapaProcesoItems: Array<{
  label: string;
  value: TipoOperacionProceso;
}> = [
  { label: 'Pre-prensa', value: 'preprensa' },
  { label: 'Prensa', value: 'prensa' },
  { label: 'Post-prensa', value: 'postprensa' },
  { label: 'Instalación', value: 'instalacion' },
  { label: 'Entrega / Despacho', value: 'entrega_despacho' },
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

export const baseCalculoProductividadItems: Array<{
  label: string;
  value: BaseCalculoProductividad;
}> = [
  { label: 'Cantidad', value: 'cantidad' },
  { label: 'Area total (m2)', value: 'area_total_m2' },
  { label: 'Largo total (ml)', value: 'metro_lineal_total' },
  { label: 'Perimetro total (ml)', value: 'perimetro_total_ml' },
];
