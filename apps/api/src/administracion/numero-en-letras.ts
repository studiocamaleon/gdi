/**
 * Importes en letras para el recibo de pago.
 *
 * Un recibo lleva el monto en letras porque en letras no se puede alterar un
 * dígito: es lo que separa un comprobante de un papel con un número impreso.
 *
 * Las trampas del castellano que resuelve —y que los tests fijan— son cuatro:
 *  - apócope: 21.000 es "veintiún mil", no "veintiuno mil";
 *  - "cien" exacto vs "ciento" cuando le sigue algo (100 / 101);
 *  - el millón va en singular y con "de" implícito ("un millón", "dos millones");
 *  - "mil" no lleva "un" adelante (1.000 es "mil", no "un mil"), pero sí lo
 *    lleva el millón.
 *
 * Ver docs/recibos-pago-diseno.md
 */

import { monedaDe, numeroMoneda, type Moneda } from '../common/moneda';

const UNIDADES = [
  '',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];

const DECENAS = [
  '',
  '',
  'veinte',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
];

const CENTENAS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

/** 0-999 en letras. `apocope` convierte el "uno" final en "un" (veintiún mil). */
function centenasEnLetras(n: number, apocope: boolean): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';

  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);

  if (resto > 0) {
    let texto: string;
    if (resto < 30) {
      texto = UNIDADES[resto];
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      texto = u > 0 ? `${DECENAS[d]} y ${UNIDADES[u]}` : DECENAS[d];
    }
    if (apocope) {
      // "veintiuno" → "veintiún", "treinta y uno" → "treinta y un".
      texto = texto.replace(/veintiuno$/, 'veintiún').replace(/ uno$/, ' un');
      if (texto === 'uno') texto = 'un';
    }
    partes.push(texto);
  }

  return partes.join(' ');
}

/** Entero no negativo en letras, hasta 999.999.999. */
export function enteroEnLetras(n: number): string {
  const entero = Math.floor(Math.abs(n));
  if (entero === 0) return 'cero';

  const millones = Math.floor(entero / 1_000_000);
  const miles = Math.floor((entero % 1_000_000) / 1000);
  const resto = entero % 1000;
  const partes: string[] = [];

  if (millones === 1) {
    partes.push('un millón');
  } else if (millones > 1) {
    partes.push(`${centenasEnLetras(millones, true)} millones`);
  }

  // "mil" va solo: 1.000 es "mil", no "un mil". Pero 21.000 sí es "veintiún mil".
  if (miles === 1) {
    partes.push('mil');
  } else if (miles > 1) {
    partes.push(`${centenasEnLetras(miles, true)} mil`);
  }

  if (resto > 0) partes.push(centenasEnLetras(resto, false));

  return partes.join(' ');
}

/** El formato de importe del recibo. Único, para que letras y cifras no puedan divergir. */
export function formatearImporte(monto: number): string {
  return Math.abs(monto).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * El sustantivo de cada moneda del catálogo, para las letras del recibo.
 * Una moneda sin entrada acá sale con su código ISO ("124.059 XXX con…"),
 * que es feo pero nunca miente.
 */
const NOMBRES_EN_LETRAS: Record<string, { singular: string; plural: string }> =
  {
    ARS: { singular: 'peso', plural: 'pesos' },
    BOB: { singular: 'boliviano', plural: 'bolivianos' },
    BRL: { singular: 'real', plural: 'reales' },
    CLP: { singular: 'peso', plural: 'pesos' },
    COP: { singular: 'peso', plural: 'pesos' },
    PYG: { singular: 'guaraní', plural: 'guaraníes' },
    PEN: { singular: 'sol', plural: 'soles' },
    UYU: { singular: 'peso', plural: 'pesos' },
    VED: { singular: 'bolívar', plural: 'bolívares' },
    MXN: { singular: 'peso', plural: 'pesos' },
    GTQ: { singular: 'quetzal', plural: 'quetzales' },
    HNL: { singular: 'lempira', plural: 'lempiras' },
    NIO: { singular: 'córdoba', plural: 'córdobas' },
    CRC: { singular: 'colón', plural: 'colones' },
    PAB: { singular: 'balboa', plural: 'balboas' },
    DOP: { singular: 'peso', plural: 'pesos' },
    CUP: { singular: 'peso', plural: 'pesos' },
    USD: { singular: 'dólar', plural: 'dólares' },
  };

/**
 * El importe como va en el recibo: "Ciento veinticuatro mil cincuenta y nueve
 * pesos con 00/100." Los centavos van en cifras a propósito — es la convención
 * de los recibos de la región y evita discutir si "cincuenta" son centavos o
 * pesos. En una moneda sin centavos (CLP, PYG) el "con 00/100" directamente
 * no existe.
 *
 * Las letras se derivan del MISMO string que se imprime arriba, no del float.
 * No es paranoia: `Intl` redondea sobre la representación decimal e `Math.round`
 * sobre el binario, y en los bordes no coinciden (1.005 sale "1,01" con el
 * primero y 1,00 con el segundo). Un centavo de diferencia entre el número y
 * las letras invalida el recibo, así que se calcula una sola vez y se parte.
 */
export function importeEnLetras(monto: number, moneda?: Moneda): string {
  const m = moneda ?? monedaDe(null);

  // El mismo string que imprime el PDF, partido por el separador decimal DE
  // ESA moneda: en Honduras el decimal es "." y el "." argentino agrupa.
  const numero = numeroMoneda(Math.abs(monto), m);
  const decimal = separadorDecimalDe(m.locale);
  const [enteroStr, centavosStr] = numero.split(decimal);
  const entero = Number(enteroStr.replace(/[^\d]/g, ''));

  const letras = enteroEnLetras(entero);
  // Apócope delante del sustantivo: "un peso", no "uno peso".
  const letrasApocopadas = letras.replace(/uno$/, 'un');
  const nombre = NOMBRES_EN_LETRAS[m.codigo];
  const unidad = nombre
    ? entero === 1
      ? nombre.singular
      : nombre.plural
    : m.codigo;

  const centavos =
    m.decimales > 0 && centavosStr !== undefined
      ? ` con ${centavosStr}/100`
      : '';
  const frase = `${letrasApocopadas} ${unidad}${centavos}.`;
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/** "," en es-AR/es-CL, "." en es-HN/es-MX — lo dice ICU, no nosotros. */
function separadorDecimalDe(locale: string): string {
  return (
    new Intl.NumberFormat(locale)
      .formatToParts(1.5)
      .find((p) => p.type === 'decimal')?.value ?? ','
  );
}
