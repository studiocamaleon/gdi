/**
 * Categorías de alto nivel del catálogo de familias.
 *
 * Las 9 categorías agrupan las 31 familias para UI y navegación.
 * Ver `docs/motor-por-pasos-analisis/01-tipos-de-paso.md` §1.
 */

import type { CategoriaFamiliaCodigo } from './types';

export interface DefinicionCategoria {
  codigo: CategoriaFamiliaCodigo;
  nombre: string;
  descripcion: string;
  /** Orden para UI. */
  orden: number;
}

export const CATEGORIAS: Record<CategoriaFamiliaCodigo, DefinicionCategoria> = {
  pre_prensa: {
    codigo: 'pre_prensa',
    nombre: 'Pre-prensa',
    descripcion: 'Preparación previa a imprimir: armado de imposición, proof.',
    orden: 1,
  },
  produccion_impresion: {
    codigo: 'produccion_impresion',
    nombre: 'Producción / impresión',
    descripcion: 'Lo que aplica tinta o pigmento.',
    orden: 2,
  },
  corte_y_formado: {
    codigo: 'corte_y_formado',
    nombre: 'Corte y formado',
    descripcion:
      'Recortar o moldear: guillotina, plotter, troquelado, CNC, plegado, perforado.',
    orden: 3,
  },
  terminaciones: {
    codigo: 'terminaciones',
    nombre: 'Terminaciones',
    descripcion:
      'Acabados después de imprimir: laminado, barniz, dorado, hotstamping, lijado.',
    orden: 4,
  },
  encuadernacion_armado: {
    codigo: 'encuadernacion_armado',
    nombre: 'Encuadernación / armado',
    descripcion: 'Unir piezas en producto final.',
    orden: 5,
  },
  estructural_montaje: {
    codigo: 'estructural_montaje',
    nombre: 'Estructural / montaje físico',
    descripcion: 'Cartelería, herrería, instalación eléctrica de luminosos.',
    orden: 6,
  },
  operaciones_manuales: {
    codigo: 'operaciones_manuales',
    nombre: 'Operaciones manuales',
    descripcion:
      'Sin máquina industrial: control, embalaje, conteo, atado, etiquetado, modificaciones físicas.',
    orden: 7,
  },
  logistica_instalacion: {
    codigo: 'logistica_instalacion',
    nombre: 'Logística / instalación in situ',
    descripcion: 'Entrega + colocación.',
    orden: 8,
  },
  servicios_profesionales: {
    codigo: 'servicios_profesionales',
    nombre: 'Servicios profesionales',
    descripcion:
      'Servicios humanos sin producción física: diseño, copywriting, traducciones, asesoría.',
    orden: 9,
  },
};
