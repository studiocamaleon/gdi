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
};

export const latamCountries: LatamCountry[] = [
  { code: "AR", flag: "🇦🇷", name: "Argentina", phoneCode: "54" },
  { code: "BO", flag: "🇧🇴", name: "Bolivia", phoneCode: "591" },
  { code: "BR", flag: "🇧🇷", name: "Brasil", phoneCode: "55" },
  { code: "CL", flag: "🇨🇱", name: "Chile", phoneCode: "56" },
  { code: "CO", flag: "🇨🇴", name: "Colombia", phoneCode: "57" },
  { code: "CR", flag: "🇨🇷", name: "Costa Rica", phoneCode: "506" },
  { code: "CU", flag: "🇨🇺", name: "Cuba", phoneCode: "53" },
  { code: "DO", flag: "🇩🇴", name: "Republica Dominicana", phoneCode: "1809" },
  { code: "EC", flag: "🇪🇨", name: "Ecuador", phoneCode: "593" },
  { code: "SV", flag: "🇸🇻", name: "El Salvador", phoneCode: "503" },
  { code: "GT", flag: "🇬🇹", name: "Guatemala", phoneCode: "502" },
  { code: "HN", flag: "🇭🇳", name: "Honduras", phoneCode: "504" },
  { code: "MX", flag: "🇲🇽", name: "Mexico", phoneCode: "52" },
  { code: "NI", flag: "🇳🇮", name: "Nicaragua", phoneCode: "505" },
  { code: "PA", flag: "🇵🇦", name: "Panama", phoneCode: "507" },
  { code: "PY", flag: "🇵🇾", name: "Paraguay", phoneCode: "595" },
  { code: "PE", flag: "🇵🇪", name: "Peru", phoneCode: "51" },
  { code: "UY", flag: "🇺🇾", name: "Uruguay", phoneCode: "598" },
  { code: "VE", flag: "🇻🇪", name: "Venezuela", phoneCode: "58" },
];

/** Argentina, el default de todas las altas. */
export const PAIS_DEFAULT = "AR";

/** El prefijo del país, o el de Argentina si el código no está en la lista. */
export function phoneCodeDe(codigoPais: string): string {
  return (
    latamCountries.find((c) => c.code === codigoPais)?.phoneCode ??
    latamCountries.find((c) => c.code === PAIS_DEFAULT)!.phoneCode
  );
}
