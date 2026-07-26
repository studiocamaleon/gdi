/**
 * Las monedas que ofrece el sistema, en un solo lugar.
 *
 * Mismo criterio que `paises.ts`: catálogo en código, no en base — la lista
 * cambia una vez por década y versionarla con el código es gratis. Hay un
 * ESPEJO en `apps/api/src/common/monedas.ts` porque no existe un paquete
 * compartido entre front y API; si se toca uno se tocan los dos.
 *
 * Dos cosas que NO son obvias y por las que este archivo existe:
 *
 * - `decimales`: CLP y PYG son monedas de CERO decimales. No es una
 *   preferencia de redondeo: un chileno jamás vio "$1.500,50". El formateo,
 *   los inputs y el redondeo de pricing salen de acá.
 * - `simboloDoc`: cinco países comparten el símbolo `$` (AR, CL, CO, MX, UY
 *   más los dolarizados). En pantalla, para el usuario logueado, `simbolo`
 *   alcanza — sabe en qué moneda trabaja—; en un documento que puede cruzar
 *   una frontera (PDF, link público) va el símbolo desambiguado.
 *
 * Ver docs/multi-moneda-zona-horaria-diseno.md (D4, D6).
 */

export type Moneda = {
  /** ISO 4217. Es lo que se guarda en `monedaCodigo`. */
  codigo: string;
  nombre: string;
  /** Lo que ve el usuario en pantalla: "$", "Bs", "R$", "S/", "₲", "L"… */
  simbolo: string;
  /** Desambiguado para documentos: "AR$", "CLP $", "US$"… */
  simboloDoc: string;
  /** CLP y PYG = 0. El resto de la región usa 2. */
  decimales: 0 | 2;
  /**
   * Separadores por defecto cuando no se conoce el país del tenant:
   * es-AR agrupa "1.234,56"; es-HN / es-MX agrupan "1,234.56".
   */
  locale: string;
};

export const monedas: Moneda[] = [
  // Sudamérica
  { codigo: "ARS", nombre: "Peso argentino", simbolo: "$", simboloDoc: "AR$", decimales: 2, locale: "es-AR" },
  { codigo: "BOB", nombre: "Boliviano", simbolo: "Bs", simboloDoc: "Bs", decimales: 2, locale: "es-BO" },
  { codigo: "BRL", nombre: "Real brasileño", simbolo: "R$", simboloDoc: "R$", decimales: 2, locale: "pt-BR" },
  { codigo: "CLP", nombre: "Peso chileno", simbolo: "$", simboloDoc: "CLP $", decimales: 0, locale: "es-CL" },
  { codigo: "COP", nombre: "Peso colombiano", simbolo: "$", simboloDoc: "COL$", decimales: 2, locale: "es-CO" },
  { codigo: "PYG", nombre: "Guaraní", simbolo: "₲", simboloDoc: "₲", decimales: 0, locale: "es-PY" },
  { codigo: "PEN", nombre: "Sol peruano", simbolo: "S/", simboloDoc: "S/", decimales: 2, locale: "es-PE" },
  { codigo: "UYU", nombre: "Peso uruguayo", simbolo: "$U", simboloDoc: "$U", decimales: 2, locale: "es-UY" },
  { codigo: "VED", nombre: "Bolívar", simbolo: "Bs.", simboloDoc: "Bs.", decimales: 2, locale: "es-VE" },
  // México, Centroamérica y Caribe
  { codigo: "MXN", nombre: "Peso mexicano", simbolo: "$", simboloDoc: "MX$", decimales: 2, locale: "es-MX" },
  { codigo: "GTQ", nombre: "Quetzal", simbolo: "Q", simboloDoc: "Q", decimales: 2, locale: "es-GT" },
  { codigo: "HNL", nombre: "Lempira", simbolo: "L", simboloDoc: "L", decimales: 2, locale: "es-HN" },
  { codigo: "NIO", nombre: "Córdoba", simbolo: "C$", simboloDoc: "C$", decimales: 2, locale: "es-NI" },
  { codigo: "CRC", nombre: "Colón costarricense", simbolo: "₡", simboloDoc: "₡", decimales: 2, locale: "es-CR" },
  { codigo: "PAB", nombre: "Balboa", simbolo: "B/.", simboloDoc: "B/.", decimales: 2, locale: "es-PA" },
  { codigo: "DOP", nombre: "Peso dominicano", simbolo: "RD$", simboloDoc: "RD$", decimales: 2, locale: "es-DO" },
  { codigo: "CUP", nombre: "Peso cubano", simbolo: "$", simboloDoc: "CUP $", decimales: 2, locale: "es-CU" },
  // Transversal: Ecuador, El Salvador y Panamá facturan directamente en USD,
  // y en Venezuela es la moneda real de los presupuestos.
  { codigo: "USD", nombre: "Dólar estadounidense", simbolo: "$", simboloDoc: "US$", decimales: 2, locale: "es-AR" },
];

/** Argentina, el default de todo tenant existente. */
export const MONEDA_DEFAULT = "ARS";

/** La moneda del código, o ARS si el código no está en la lista. */
export function monedaDe(codigo: string | null | undefined): Moneda {
  return (
    monedas.find((m) => m.codigo === codigo) ??
    monedas.find((m) => m.codigo === MONEDA_DEFAULT)!
  );
}
