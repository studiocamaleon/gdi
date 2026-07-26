/**
 * Período — el cimiento compartido de todos los reportes del Panel.
 * Resuelve el rango pedido, su período ANTERIOR equivalente (para los
 * deltas), la granularidad de las series, y los meses "YYYY-MM" que el
 * rango cubre (para agregar costos fijos, que se cargan por mes).
 *
 * Todo el calendario se piensa en la ZONA DEL TENANT: el rango lleva su
 * `zona` y los bordes son instantes de medianoche EN ESA ZONA (no la del
 * proceso). La aritmética de fechas se hace sobre claves "YYYY-MM-DD"
 * —independiente del reloj del server— y sólo se convierte a instantes en
 * los bordes, con `instanteDe`.
 *
 * Puro y testeable: `hoy` se inyecta para no depender del reloj.
 */

import {
  claveFechaEnZona,
  instanteDe,
  sumarDiasAClave,
  ZONA_DEFAULT,
} from '../common/zona';

export type Rango = {
  /** Instante de las 00:00 del primer día, en la zona del rango. */
  desde: Date;
  /** Instante de las 00:00 del ÚLTIMO día (inclusivo), en la zona del rango. */
  hasta: Date;
  /** Zona IANA del tenant: la que define qué es "un día" para este rango. */
  zona: string;
};
export type Granularidad = 'dia' | 'semana' | 'mes';

const MS_DIA = 86_400_000;

/** Date.UTC normalizado → "YYYY-MM-DD" (mes 0-11, como Date). */
function claveDeUTC(y: number, m0: number, d: number): string {
  const f = new Date(Date.UTC(y, m0, d));
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}-${String(f.getUTCDate()).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" válida → la misma clave. Inválida (30/02) → null. */
function claveValida(valor: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return null;
  // La normalización de Date.UTC delata las fechas imposibles (30/02 rota).
  return claveDeUTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) === valor
    ? valor
    : null;
}

function inicioDeMesClave(clave: string): string {
  return `${clave.slice(0, 7)}-01`;
}

function finDeMesClave(clave: string): string {
  const [y, m] = clave.split('-').map(Number);
  return claveDeUTC(y, m, 0); // día 0 del mes siguiente = último de éste
}

function esUltimoDiaDeMes(clave: string): boolean {
  return clave === finDeMesClave(clave);
}

/** Días de a → b (claves), con signo. Aritmética pura, sin zona. */
function diasEntreClaves(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / MS_DIA);
}

function rangoDeClaves(desde: string, hasta: string, zona: string): Rango {
  return {
    desde: instanteDe(desde, '00:00', zona),
    hasta: instanteDe(hasta, '00:00', zona),
    zona,
  };
}

/** Las claves calendario del rango, en su propia zona. */
function clavesDe(rango: Rango): { desde: string; hasta: string } {
  return {
    desde: claveFechaEnZona(rango.desde, rango.zona),
    hasta: claveFechaEnZona(rango.hasta, rango.zona),
  };
}

/**
 * Resuelve el rango a mostrar. Sin fechas → mes en curso EN LA ZONA del
 * tenant. `hasta` se interpreta inclusivo (todo el día). Lanza si el rango
 * es inválido.
 */
export function parseRango(
  desde?: string,
  hasta?: string,
  hoy: Date = new Date(),
  zona: string = ZONA_DEFAULT,
): Rango {
  if (!desde && !hasta) {
    const hoyClave = claveFechaEnZona(hoy, zona);
    return rangoDeClaves(inicioDeMesClave(hoyClave), finDeMesClave(hoyClave), zona);
  }
  const d = desde ? claveValida(desde) : null;
  const h = hasta ? claveValida(hasta) : null;
  if ((desde && !d) || (hasta && !h)) {
    throw new Error('Fechas del rango inválidas (se espera YYYY-MM-DD).');
  }
  const inicio = d ?? inicioDeMesClave(h as string);
  const fin = h ?? finDeMesClave(d as string);
  // Las claves ISO comparan bien como strings.
  if (inicio > fin) {
    throw new Error('El rango es inválido: "desde" es posterior a "hasta".');
  }
  return rangoDeClaves(inicio, fin, zona);
}

/** Cantidad de días inclusivos del rango. */
export function diasDelRango(rango: Rango): number {
  const c = clavesDe(rango);
  return diasEntreClaves(c.desde, c.hasta) + 1;
}

/**
 * Período ANTERIOR equivalente. Si el rango son meses calendario
 * completos (mes/trimestre/año), corre por MESES (junio vs. julio, sin el
 * error de "31 días atrás"); si es un rango arbitrario, corre por la
 * misma cantidad de días, inmediatamente antes.
 */
export function periodoAnterior(rango: Rango): Rango {
  const c = clavesDe(rango);
  const alineadoAMeses = c.desde.endsWith('-01') && esUltimoDiaDeMes(c.hasta);
  if (alineadoAMeses) {
    const [yd, md] = c.desde.split('-').map(Number);
    const [yh, mh] = c.hasta.split('-').map(Number);
    const meses = (yh - yd) * 12 + (mh - md) + 1;
    const desde = claveDeUTC(yd, md - 1 - meses, 1);
    const hasta = finDeMesClave(claveDeUTC(yh, mh - 1 - meses, 1));
    return rangoDeClaves(desde, hasta, rango.zona);
  }
  const dias = diasEntreClaves(c.desde, c.hasta) + 1;
  const hasta = sumarDiasAClave(c.desde, -1);
  const desde = sumarDiasAClave(hasta, -(dias - 1));
  return rangoDeClaves(desde, hasta, rango.zona);
}

/**
 * Mismo período del AÑO anterior (delta interanual). Si el rango son
 * meses calendario completos corre 12 meses preservando el fin de mes;
 * si es arbitrario, las mismas fechas un año atrás.
 */
export function mismoPeriodoAnioAnterior(rango: Rango): Rango {
  const c = clavesDe(rango);
  const [yd, md, dd] = c.desde.split('-').map(Number);
  const [yh, mh, dh] = c.hasta.split('-').map(Number);
  const desde = claveDeUTC(yd - 1, md - 1, dd);
  const hasta = esUltimoDiaDeMes(c.hasta)
    ? finDeMesClave(claveDeUTC(yh - 1, mh - 1, 1))
    : claveDeUTC(yh - 1, mh - 1, dh);
  return rangoDeClaves(desde, hasta, rango.zona);
}

/** Granularidad de las series según el largo del rango. */
export function granularidad(rango: Rango): Granularidad {
  const dias = diasDelRango(rango);
  if (dias <= 31) return 'dia';
  if (dias <= 120) return 'semana';
  return 'mes';
}

/** Meses "YYYY-MM" que el rango toca (para costos fijos por período). */
export function mesesDelRango(rango: Rango): string[] {
  const c = clavesDe(rango);
  const [y0, m0] = c.desde.split('-').map(Number);
  const [y1, m1] = c.hasta.split('-').map(Number);
  const meses: string[] = [];
  let cursor = y0 * 12 + (m0 - 1);
  const fin = y1 * 12 + (m1 - 1);
  let guardia = 0;
  while (cursor <= fin && guardia < 240) {
    meses.push(
      `${Math.floor(cursor / 12)}-${String((cursor % 12) + 1).padStart(2, '0')}`,
    );
    cursor += 1;
    guardia += 1;
  }
  return meses;
}

/**
 * Fracción [0..1] del mes "YYYY-MM" que cae dentro del rango. Prorratea
 * los costos fijos (mensuales) a rangos parciales: mes completo → 1,
 * medio mes → ~0,5. Base del punto de equilibrio para cualquier rango.
 */
export function fraccionMesEnRango(mes: string, rango: Rango): number {
  const c = clavesDe(rango);
  const inicioMes = `${mes}-01`;
  const finMes = finDeMesClave(inicioMes);
  const overlapInicio = inicioMes > c.desde ? inicioMes : c.desde;
  const overlapFin = finMes < c.hasta ? finMes : c.hasta;
  if (overlapFin < overlapInicio) return 0;
  const dias = diasEntreClaves(overlapInicio, overlapFin) + 1;
  return dias / Number(finMes.slice(8, 10));
}

/**
 * Primer instante DESPUÉS del rango (medianoche del día siguiente al
 * `hasta`, en la zona del rango): el borde para comparaciones `<` en SQL.
 * Antes cada service lo calculaba con getters locales del proceso; con
 * zonas por tenant eso mezclaba calendarios.
 */
export function finExclusivo(rango: Rango): Date {
  const c = clavesDe(rango);
  return instanteDe(sumarDiasAClave(c.hasta, 1), '00:00', rango.zona);
}

/** Último instante del rango (23:59:59.999 local), para `<=` en SQL. */
export function finDeDia(rango: Rango): Date {
  return new Date(finExclusivo(rango).getTime() - 1);
}
