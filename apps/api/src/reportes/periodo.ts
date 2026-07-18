/**
 * Período — el cimiento compartido de todos los reportes del Panel.
 * Resuelve el rango pedido, su período ANTERIOR equivalente (para los
 * deltas), la granularidad de las series, y los meses "YYYY-MM" que el
 * rango cubre (para agregar costos fijos, que se cargan por mes).
 * Puro y testeable: `hoy` se inyecta para no depender del reloj.
 */

export type Rango = { desde: Date; hasta: Date };
export type Granularidad = 'dia' | 'semana' | 'mes';

const MS_DIA = 86_400_000;

/** "YYYY-MM-DD" → Date local a medianoche. Inválida → null. */
function parseFechaLocal(valor: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return null;
  const [, y, mo, d] = m;
  const fecha = new Date(Number(y), Number(mo) - 1, Number(d));
  // Rechaza fechas imposibles (30/02 rota al normalizar).
  if (
    fecha.getFullYear() !== Number(y) ||
    fecha.getMonth() !== Number(mo) - 1 ||
    fecha.getDate() !== Number(d)
  ) {
    return null;
  }
  return fecha;
}

function inicioDeMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

function finDeMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
}

function esUltimoDiaDeMes(fecha: Date): boolean {
  return fecha.getDate() === finDeMes(fecha).getDate();
}

/**
 * Resuelve el rango a mostrar. Sin fechas → mes en curso. `hasta` se
 * interpreta inclusivo (todo el día). Lanza si el rango es inválido.
 */
export function parseRango(
  desde?: string,
  hasta?: string,
  hoy: Date = new Date(),
): Rango {
  if (!desde && !hasta) {
    return { desde: inicioDeMes(hoy), hasta: finDeMes(hoy) };
  }
  const d = desde ? parseFechaLocal(desde) : null;
  const h = hasta ? parseFechaLocal(hasta) : null;
  if ((desde && !d) || (hasta && !h)) {
    throw new Error('Fechas del rango inválidas (se espera YYYY-MM-DD).');
  }
  const inicio = d ?? inicioDeMes(h as Date);
  const fin = h ?? finDeMes(d as Date);
  if (inicio > fin) {
    throw new Error('El rango es inválido: "desde" es posterior a "hasta".');
  }
  return { desde: inicio, hasta: fin };
}

/** Cantidad de días inclusivos del rango. */
export function diasDelRango(rango: Rango): number {
  return Math.round((rango.hasta.getTime() - rango.desde.getTime()) / MS_DIA) + 1;
}

/**
 * Período ANTERIOR equivalente. Si el rango son meses calendario
 * completos (mes/trimestre/año), corre por MESES (junio vs. julio, sin el
 * error de "31 días atrás"); si es un rango arbitrario, corre por la
 * misma cantidad de días, inmediatamente antes.
 */
export function periodoAnterior(rango: Rango): Rango {
  const alineadoAMeses =
    rango.desde.getDate() === 1 && esUltimoDiaDeMes(rango.hasta);
  if (alineadoAMeses) {
    const meses =
      (rango.hasta.getFullYear() - rango.desde.getFullYear()) * 12 +
      (rango.hasta.getMonth() - rango.desde.getMonth()) +
      1;
    const desde = new Date(
      rango.desde.getFullYear(),
      rango.desde.getMonth() - meses,
      1,
    );
    const hasta = finDeMes(
      new Date(rango.hasta.getFullYear(), rango.hasta.getMonth() - meses, 1),
    );
    return { desde, hasta };
  }
  const dias = diasDelRango(rango);
  const hasta = new Date(rango.desde.getTime() - MS_DIA);
  const desde = new Date(hasta.getTime() - (dias - 1) * MS_DIA);
  return { desde, hasta };
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
  const meses: string[] = [];
  let cursor = inicioDeMes(rango.desde);
  const fin = inicioDeMes(rango.hasta);
  let guardia = 0;
  while (cursor <= fin && guardia < 240) {
    meses.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
    );
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    guardia += 1;
  }
  return meses;
}

/** `hasta` como instante de fin de día, para comparaciones < en SQL. */
export function finDeDia(fecha: Date): Date {
  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    23,
    59,
    59,
    999,
  );
}
