/**
 * Pasos propios del tenant: INSTANCIAS de una plantilla del catálogo del
 * sistema (docs/pasos-tenant-por-plantilla-diseno.md).
 *
 * Reemplaza a `familia-tenant-validacion.ts`, que validaba una FORMA
 * declarada por el tenant (378 líneas de vocabularios y coherencia entre
 * ejes). Ya no hace falta: **la forma no se escribe, se hereda**. Acá sólo
 * queda validar que la plantilla exista y que el nombre sirva, y proyectar
 * la instancia sobre su plantilla.
 */
import { FAMILIAS } from './familias';
import type { DefinicionFamiliaResuelta } from './types';

/** Lo único que el tenant declara al crear su paso. */
export interface PasoTenantInput {
  nombre: string;
  plantillaCodigo: string;
  descripcion?: string | null;
  icono?: string | null;
}

export interface ErrorPasoTenant {
  campo: string;
  mensaje: string;
}

/**
 * Plantillas instanciables: el catálogo visible del sistema. No se limita a
 * las manuales — "Impresión Xerox interior" es un nombre legítimo del taller
 * para un paso de impresión (decisión 5 del diseño).
 */
export function plantillasInstanciables(): Array<{
  codigo: string;
  nombre: string;
  categoria: string;
  descripcion?: string;
}> {
  return Object.values(FAMILIAS)
    .filter((f) => f.visibleEnSelector !== false)
    .map((f) => ({
      codigo: f.codigo as string,
      nombre: f.nombre,
      categoria: f.categoria as string,
      descripcion: f.descripcion,
    }));
}

/** Nombre humano de la plantilla. OJO: no sirve leerlo de la proyección —
 *  ahí el nombre ya es el de la instancia. */
export function nombrePlantilla(codigo: string): string | null {
  return FAMILIAS[codigo as keyof typeof FAMILIAS]?.nombre ?? null;
}

/** La única puerta de escritura. Sin forma que validar, queda mínima. */
export function validarPasoTenant(input: PasoTenantInput): ErrorPasoTenant[] {
  const errores: ErrorPasoTenant[] = [];

  const nombre = (input.nombre ?? '').trim();
  if (!nombre) {
    errores.push({ campo: 'nombre', mensaje: 'Poné un nombre al paso.' });
  } else if (nombre.length > 80) {
    errores.push({
      campo: 'nombre',
      mensaje: 'El nombre no puede pasar de 80 caracteres.',
    });
  }

  const plantilla = FAMILIAS[input.plantillaCodigo as keyof typeof FAMILIAS];
  if (!input.plantillaCodigo) {
    errores.push({
      campo: 'plantillaCodigo',
      mensaje: 'Elegí de qué tipo de paso parte.',
    });
  } else if (!plantilla) {
    errores.push({
      campo: 'plantillaCodigo',
      mensaje: `La plantilla "${input.plantillaCodigo}" no existe en el catálogo.`,
    });
  } else if (plantilla.visibleEnSelector === false) {
    errores.push({
      campo: 'plantillaCodigo',
      mensaje: 'La plantilla elegida no está disponible para crear pasos propios.',
    });
  }

  return errores;
}

/**
 * LA HERENCIA. La instancia toma la ficha ENTERA de su plantilla —derivador,
 * nesting, primitivas, params, todo— y sólo pisa lo suyo: código, nombre y
 * (si lo puso) descripción. Es viva: si mañana la plantilla gana un eje, las
 * instancias lo ganan sin migrar nada.
 *
 * Devuelve `undefined` si la plantilla no existe (paso apuntando a un código
 * que se retiró del catálogo): el caller decide si es error o se ignora.
 */
export function proyectarPasoTenant(row: {
  id: string;
  plantillaCodigo: string;
  nombre: string;
  descripcion?: string | null;
}): DefinicionFamiliaResuelta | undefined {
  const plantilla = FAMILIAS[row.plantillaCodigo as keyof typeof FAMILIAS];
  if (!plantilla) return undefined;

  return {
    ...plantilla,
    codigo: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion ?? plantilla.descripcion,
    esDeTenant: true,
    plantillaCodigo: row.plantillaCodigo,
  };
}
