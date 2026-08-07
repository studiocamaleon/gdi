/**
 * EFECTOS de paso — lo que un paso le exige al trabajo.
 * docs/efectos-de-paso-diseno.md
 *
 * Un paso de producción no sólo consume tiempo y materiales: a veces le
 * exige algo al trabajo. "Tensado de lona" necesita 100 mm más por lado para
 * poder envolver el bastidor; ese requerimiento es del paso REAL, no de una
 * familia-artefacto que sólo existe para agrandar la medida.
 *
 * Hasta la Etapa B eso era exclusivo de `modificacion_pre` (su `subTipo`,
 * `lados` y `demasiaMm` en la raíz de paramsPasoJson). Acá se generaliza: el
 * efecto se declara en el propio paso y CUALQUIER paso puede llevarlo.
 */
import { parsearLados } from './lados-pieza';
import type { LadoPieza } from './tipos';

/** Agranda la medida del trabajo antes de que nadie la lea. */
export interface EfectoDemasiaMedida {
  lados: LadoPieza[];
  mm: number;
  /**
   * La demasía deja una BANDA PLANA donde se puede perforar (un refuerzo),
   * en vez de un tubo que no se puede (un bolsillo para el caño). Los ojales
   * lo miran para centrarse sobre esa banda.
   *
   * Reemplaza al viejo `subTipo: 'bolsillo' | 'refuerzo'`: declara la
   * capacidad que importa en vez de un nombre que hay que interpretar — así
   * un paso llamado "Dobladillo" o "Vaina" puede decir lo suyo sin heredar
   * un vocabulario ajeno.
   */
  refuerza: boolean;
}

export interface EfectosDePaso {
  demasiaMedida?: EfectoDemasiaMedida;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Lee el efecto de demasía configurado en el paso. Acepta DOS formatos:
 *
 *  - **Nuevo**: `efectos.demasiaMedida = { lados, mm }` — cualquier paso.
 *  - **Viejo** (compat): `lados` + `demasiaMm` en la raíz, que es como los
 *    guardó `modificacion_pre` hasta la migración (F4). Se lee igual para que
 *    las rutas existentes sigan cotizando idéntico sin tocarlas.
 *
 * Devuelve `null` si el paso no declara el efecto, o si lo declara mal (sin
 * lados o sin milímetros útiles) — el caller decide si eso es un error.
 */
export function leerEfectoDemasia(
  paramsPasoJson: unknown,
): EfectoDemasiaMedida | null {
  const params = asRecord(paramsPasoJson);

  const nuevo = asRecord(asRecord(params.efectos).demasiaMedida);
  const crudo = Object.keys(nuevo).length > 0 ? nuevo : params;

  const lados = parsearLados(crudo.lados);
  if (lados.length === 0) return null;

  const mm = Number(crudo.mm ?? crudo.demasiaMm ?? NaN);
  if (!Number.isFinite(mm) || mm <= 0) return null;

  // Formato nuevo: lo declara el efecto. Viejo: se deriva del preset, donde
  // 'refuerzo' era el único subTipo que dejaba banda plana.
  const refuerza =
    typeof crudo.refuerza === 'boolean'
      ? crudo.refuerza
      : String(params.subTipo ?? '').trim() === 'refuerzo';

  return { lados, mm, refuerza };
}

/**
 * ¿El paso DECLARA la intención de tener el efecto, aunque esté mal
 * configurado? Sirve para distinguir "no tiene efecto" (se ignora) de "quiso
 * tenerlo pero le falta un dato" (hay que avisar, no cotizar de menos en
 * silencio).
 */
export function declaraEfectoDemasia(paramsPasoJson: unknown): boolean {
  const params = asRecord(paramsPasoJson);
  if (Object.keys(asRecord(asRecord(params.efectos).demasiaMedida)).length > 0) {
    return true;
  }
  // Formato viejo: alcanza con que asome cualquiera de los dos campos.
  return params.lados !== undefined || params.demasiaMm !== undefined;
}
