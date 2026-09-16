import type { ControlAccionesProduccion, OpcionesAccionProduccion } from './acciones-produccion';
import type { TableroPasoAccion } from './tablero-produccion';
import { avisarTramosCambiaron } from './ordenes-trabajo-api';
import { apiRequest } from '@/lib/api';
import type { ConfiguracionCola } from '../../apps/api/src/produccion/colas/configuracion-cola';
export type { SimulacionNestingCola } from '../../apps/api/src/produccion/colas/simulacion-nesting.types';
import type { SimulacionNestingCola } from '../../apps/api/src/produccion/colas/simulacion-nesting.types';

export function simularNestingCola(maquinaId: string, pasoIds: string[], signal?: AbortSignal) {
  return apiRequest<SimulacionNestingCola>(`/produccion/colas/${encodeURIComponent(maquinaId)}/simular-nesting`, {
    method: 'POST', body: JSON.stringify({ pasoIds }), signal,
  });
}

export type MaquinaCola = {
  id: string; nombre: string; codigo: string; activo: boolean;
  estacion: { id: string; nombre: string; activo: boolean } | null;
};
export type ResumenColas = {
  maquinas: Array<MaquinaCola & { pendientes: number; enCurso: number }>;
  sinMaquina: number;
};
export type EstadoCola = 'todos' | 'listos' | 'en_curso' | 'pausados' | 'en_espera' | 'bloqueados';
export type TrabajoCola = {
  id: string; itemId: string; ordenId: string; ordenNumero: string; nombre: string;
  producto: string; componenteDe: string | null; cliente: string;
  lote: { id: string; nombre: string; cantidad: number; unidad: string; productoNombre: string; esProductoDelLote: boolean } | null;
  cantidad: number; unidad: string; fechaEntrega: string | null;
  asignacionPersonal?: ReturnType<typeof import("../../apps/api/src/produccion/asignacion-personal").proyectarAsignacionPersonal>;
  duracionEstimadaMin: number | null; responsable: string | null; archivosCount: number;
  control: ControlAccionesProduccion & { puedeTomarMesa: boolean };
  estadoCola: Exclude<EstadoCola, 'todos'>; motivos: string[]; configuracion: ConfiguracionCola;
};
export type DatosCola = {
  maquina: MaquinaCola; totales: Record<EstadoCola, number>; total: number;
  page: number; pages: number; limit: number; items: TrabajoCola[]; consultadoEl: string;
};

export type TiempoCola = OpcionesAccionProduccion & { pasoId: string };
export async function completarTrabajosCola(maquinaId: string, pasoIds: string[], tiempos: TiempoCola[] = []) {
  const r = await apiRequest<{ completados: number; pasoIds: string[] }>(`/produccion/colas/${encodeURIComponent(maquinaId)}/completar`, {
    method: 'POST', body: JSON.stringify({ pasoIds, tiempos }),
  });
  avisarTramosCambiaron();
  return r;
}
export async function accionTrabajoCola(maquinaId: string, pasoId: string, accion: TableroPasoAccion, opts?: OpcionesAccionProduccion) {
  const r = await apiRequest<{ pasoId: string }>(`/produccion/colas/${encodeURIComponent(maquinaId)}/pasos/${encodeURIComponent(pasoId)}/accion`, { method: 'POST', body: JSON.stringify({ accion, ...opts }) });
  avisarTramosCambiaron();
  return r;
}

export function getResumenColas(signal?: AbortSignal) {
  return apiRequest<ResumenColas>('/produccion/colas', { signal });
}
export function getColaMaquina(maquinaId: string, filtro: { estado: EstadoCola; q: string; page: number }, signal?: AbortSignal) {
  const params = new URLSearchParams({ estado: filtro.estado, q: filtro.q, page: String(filtro.page) });
  return apiRequest<DatosCola>(`/produccion/colas/${encodeURIComponent(maquinaId)}?${params}`, { signal });
}

const decimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 });
const medidasDecimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
export function dimensionPiezaCola(pieza: ConfiguracionCola['piezas'][number]) {
  return `${medidasDecimal.format(pieza.anchoMm / 10)} × ${medidasDecimal.format(pieza.altoMm / 10)} cm`;
}
export function formatoCola(formatos: ConfiguracionCola['formatos'], subfamilia: ConfiguracionCola['materialSubfamilia'] = null) {
  if (!formatos.length) return 'Sin dato';
  // "sheet" describe la geometría; el catálogo distingue papel de material rígido.
  const plano = subfamilia === 'SUSTRATO_HOJA' || subfamilia === 'PAPEL_TRANSFERENCIA'
    ? 'Pliego (hoja)'
    : subfamilia === 'SUSTRATO_RIGIDO' || subfamilia === 'CHAPA_METALICA'
      ? 'Placa'
      : 'Formato plano';
  return formatos.map(f => f.tipo === 'roll'
    ? `Rollo · ${decimal.format(f.anchoMm / 1000)} m`
    : `${plano} · ${decimal.format(f.anchoMm)} × ${f.altoMm ? decimal.format(f.altoMm) : '—'} mm`).join(' / ');
}

/** Sólo abrevia la etiqueta visible; la identidad del perfil y su compatibilidad no cambian. */
export function detallePerfilCola(configuracion: Pick<ConfiguracionCola, 'perfilNombre' | 'modoColor'>) {
  const perfil = configuracion.perfilNombre?.trim();
  if (!perfil) return null;
  const comparable = (valor: string) => valor.replace(/\s+/g, '').toLocaleLowerCase('es');
  const color = comparable(configuracion.modoColor ?? '');
  if (comparable(perfil) === color) return null;
  const partes = perfil.match(/^(.+?)\s*[-–—·|:]\s*(.+)$/u);
  // Comparar el prefijo completo: CMYK no equivale a CMYK + blanco.
  return partes && comparable(partes[1]) === color ? partes[2].trim() : perfil;
}

/** Agrupación de lectura, nunca una autorización para mezclar o cambiar layouts. */
export function gruposVisualesCola(items: TrabajoCola[]) {
  const grupos = new Map<string, { key: string; configuracion: ConfiguracionCola; items: TrabajoCola[] }>();
  for (const item of items) {
    const c = item.configuracion;
    const key = c.materiaPrimaId ? `material:${c.materiaPrimaId}` : c.materialId ? `variante:${c.materialId}` : `sin-material:${item.id}`;
    const grupo = grupos.get(key) ?? { key, configuracion: c, items: [] };
    grupo.items.push(item); grupos.set(key, grupo);
  }
  return [...grupos.values()];
}

export function fechaCola(fecha: string | null) {
  if (!fecha) return 'Sin fecha';
  // DATE comercial: no convertir medianoche UTC a la zona del navegador.
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}
