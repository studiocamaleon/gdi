/**
 * Los países que ofrece el sistema, en un solo lugar.
 *
 * Esta lista estaba escrita DOS VECES, idéntica, en `clientes.ts` y en
 * `proveedores.ts` —y `empleados.ts` re-exportaba la segunda—. Mientras nadie
 * la tocaba no molestaba; el problema era el día que alguien agregara un país
 * o corrigiera un código telefónico en una sola: el alta de clientes y la de
 * proveedores quedarían ofreciendo listas distintas, y nada lo avisaría.
 *
 * `clientes.ts` y `proveedores.ts` la re-exportan para no romper los imports
 * que ya existen; lo nuevo conviene que importe de acá.
 */

export type LatamCountry = {
  /** ISO 3166-1 alfa-2. Es lo que se guarda en `paisCodigo`. */
  code: string;
  flag: string;
  name: string;
  /** Prefijo telefónico internacional, sin el "+". Se guarda en `telefonoCodigo`. */
  phoneCode: string;
  /**
   * ISO 4217 de la moneda que la pantalla de Empresa SUGIERE al elegir el
   * país. Sugerencia, no regla: en Venezuela existe el VED pero los
   * presupuestos reales se hacen en USD. El catálogo vive en `monedas.ts`.
   */
  monedaSugerida: string;
  /** Zona IANA que se sugiere al elegir el país (la de la capital). */
  zonaHoraria: string;
};

export const latamCountries: LatamCountry[] = [
  { code: "AR", flag: "🇦🇷", name: "Argentina", phoneCode: "54", monedaSugerida: "ARS", zonaHoraria: "America/Argentina/Buenos_Aires" },
  { code: "BO", flag: "🇧🇴", name: "Bolivia", phoneCode: "591", monedaSugerida: "BOB", zonaHoraria: "America/La_Paz" },
  { code: "BR", flag: "🇧🇷", name: "Brasil", phoneCode: "55", monedaSugerida: "BRL", zonaHoraria: "America/Sao_Paulo" },
  { code: "CL", flag: "🇨🇱", name: "Chile", phoneCode: "56", monedaSugerida: "CLP", zonaHoraria: "America/Santiago" },
  { code: "CO", flag: "🇨🇴", name: "Colombia", phoneCode: "57", monedaSugerida: "COP", zonaHoraria: "America/Bogota" },
  { code: "CR", flag: "🇨🇷", name: "Costa Rica", phoneCode: "506", monedaSugerida: "CRC", zonaHoraria: "America/Costa_Rica" },
  { code: "CU", flag: "🇨🇺", name: "Cuba", phoneCode: "53", monedaSugerida: "CUP", zonaHoraria: "America/Havana" },
  { code: "DO", flag: "🇩🇴", name: "República Dominicana", phoneCode: "1809", monedaSugerida: "DOP", zonaHoraria: "America/Santo_Domingo" },
  { code: "EC", flag: "🇪🇨", name: "Ecuador", phoneCode: "593", monedaSugerida: "USD", zonaHoraria: "America/Guayaquil" },
  { code: "SV", flag: "🇸🇻", name: "El Salvador", phoneCode: "503", monedaSugerida: "USD", zonaHoraria: "America/El_Salvador" },
  { code: "GT", flag: "🇬🇹", name: "Guatemala", phoneCode: "502", monedaSugerida: "GTQ", zonaHoraria: "America/Guatemala" },
  { code: "HN", flag: "🇭🇳", name: "Honduras", phoneCode: "504", monedaSugerida: "HNL", zonaHoraria: "America/Tegucigalpa" },
  { code: "MX", flag: "🇲🇽", name: "México", phoneCode: "52", monedaSugerida: "MXN", zonaHoraria: "America/Mexico_City" },
  { code: "NI", flag: "🇳🇮", name: "Nicaragua", phoneCode: "505", monedaSugerida: "NIO", zonaHoraria: "America/Managua" },
  { code: "PA", flag: "🇵🇦", name: "Panamá", phoneCode: "507", monedaSugerida: "USD", zonaHoraria: "America/Panama" },
  { code: "PY", flag: "🇵🇾", name: "Paraguay", phoneCode: "595", monedaSugerida: "PYG", zonaHoraria: "America/Asuncion" },
  { code: "PE", flag: "🇵🇪", name: "Perú", phoneCode: "51", monedaSugerida: "PEN", zonaHoraria: "America/Lima" },
  { code: "UY", flag: "🇺🇾", name: "Uruguay", phoneCode: "598", monedaSugerida: "UYU", zonaHoraria: "America/Montevideo" },
  { code: "VE", flag: "🇻🇪", name: "Venezuela", phoneCode: "58", monedaSugerida: "USD", zonaHoraria: "America/Caracas" },
];

/**
 * Las zonas que ofrece el selector: la de cada país más las variantes que
 * un taller real puede necesitar (Chile continental vs. Magallanes, el norte
 * de México, la Amazonia brasileña). IANA, no offsets: el DST de Chile o de
 * Cuba lo resuelve la base de datos de zonas, no nosotros.
 */
export const ZONAS_HORARIAS: string[] = [
  ...new Set([
    ...latamCountries.map((p) => p.zonaHoraria),
    "America/Punta_Arenas",
    "America/Tijuana",
    "America/Cancun",
    "America/Manaus",
  ]),
].sort();

/** La zona sugerida del país, o la de Argentina si el código no está. */
export function zonaHorariaDe(codigoPais: string | null | undefined): string {
  return (
    latamCountries.find((c) => c.code === codigoPais)?.zonaHoraria ??
    "America/Argentina/Buenos_Aires"
  );
}

/** La moneda sugerida del país, o ARS si el código no está. */
export function monedaSugeridaDe(codigoPais: string | null | undefined): string {
  return (
    latamCountries.find((c) => c.code === codigoPais)?.monedaSugerida ?? "ARS"
  );
}

/** Argentina, el default de todas las altas. */
export const PAIS_DEFAULT = "AR";

/** El prefijo del país, o el de Argentina si el código no está en la lista. */
export function phoneCodeDe(codigoPais: string): string {
  return (
    latamCountries.find((c) => c.code === codigoPais)?.phoneCode ??
    latamCountries.find((c) => c.code === PAIS_DEFAULT)!.phoneCode
  );
}
