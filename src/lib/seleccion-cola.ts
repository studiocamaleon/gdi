import type { TrabajoCola } from './colas-produccion';

export type SeleccionCola = { ids: string[] };
export const SELECCION_COLA_VACIA: SeleccionCola = { ids: [] };

/** Límite operativo del guardado conjunto; no compara configuraciones ni estados. */
export function motivoSeleccionCola(item: TrabajoCola, seleccion: SeleccionCola) {
  return !seleccion.ids.includes(item.id) && seleccion.ids.length >= 50 ? 'Podés completar hasta 50 trabajos de una vez.' : null;
}

export function alternarSeleccionCola(seleccion: SeleccionCola, item: TrabajoCola): SeleccionCola {
  if (seleccion.ids.includes(item.id)) return { ids: seleccion.ids.filter(id => id !== item.id) };
  if (motivoSeleccionCola(item, seleccion)) return seleccion;
  return { ids: [...seleccion.ids, item.id] };
}

export function alternarGrupoCola(seleccion: SeleccionCola, items: TrabajoCola[]): SeleccionCola {
  if (items.length && items.every(i => seleccion.ids.includes(i.id))) {
    const quitar = new Set(items.map(i => i.id));
    return { ids: seleccion.ids.filter(id => !quitar.has(id)) };
  }
  return { ids: [...new Set([...seleccion.ids, ...items.map(i => i.id)])].slice(0, 50) };
}

/** Si un trabajo desapareció, no completar silenciosamente sólo los restantes. */
export function seleccionColaVigente(seleccion: SeleccionCola, items: TrabajoCola[]) {
  const visibles = new Set(items.map(i => i.id));
  return seleccion.ids.length > 0 && seleccion.ids.every(id => visibles.has(id));
}

/** Completar mantiene selección libre; simular necesita una única identidad material verificada. */
export function motivoNestingSeleccionCola(seleccion: SeleccionCola, items: TrabajoCola[]): string | null {
  if (!seleccion.ids.length) return 'Seleccioná trabajos del mismo material para simular nesting.';
  if (!seleccionColaVigente(seleccion, items)) return 'La cola cambió. Volvé a seleccionar los trabajos.';
  const porId = new Map(items.map(i => [i.id, i]));
  const configuraciones = seleccion.ids.map(id => porId.get(id)!.configuracion);
  if (configuraciones.some(c => c.productoCompuesto)) return 'La selección incluye un producto compuesto. Su layout está bloqueado y no se puede volver a nestear desde Colas.';
  if (configuraciones.some(c => c.layoutConservado)) return 'La selección incluye trabajos con layout bloqueado. Conservá su distribución calculada.';
  if (configuraciones.some(c => c.formatos?.some(f => f.tipo === 'sheet'))) return 'La simulación de Colas está disponible sólo para rollos; no admite placas.';
  const claves = seleccion.ids.map(id => porId.get(id)!.configuracion.materialNestingClave);
  if (claves.some(c => !c)) return 'Falta identificar el material de un trabajo. Revisalo antes de simular nesting.';
  if (new Set(claves).size > 1) return 'Para simular nesting, seleccioná un solo material. Podés completar juntos trabajos de distintos materiales.';
  return null;
}
