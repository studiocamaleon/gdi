import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/max';

export { getCountries, getCountryCallingCode };
export type { CountryCode };
export const ERROR_TELEFONO =
  'Revisá el teléfono: elegí el país e ingresá el código de área y el número completo, sin repetir el código de país.';

/** Función pura compartida por formulario y API; no adivina ni recorta números inválidos. */
export function normalizarTelefonoCliente(
  codigo: string,
  numero: string,
  pais = 'AR',
) {
  const paisNormalizado = pais.trim().toUpperCase();
  const country: CountryCode = isSupportedCountry(paisNormalizado)
    ? (paisNormalizado as CountryCode)
    : 'AR';
  const code = codigo.replace(/\D/g, '');
  const raw = numero.trim();
  if (!raw)
    return {
      ok: true as const,
      telefonoCodigo: code || getCountryCallingCode(country),
      telefonoNumero: '',
      internacional: '',
      pais: country,
    };
  if (!/^[\d\s+().-]+$/.test(raw))
    return { ok: false as const, error: ERROR_TELEFONO };
  const digits = raw.replace(/\D/g, '');
  // Un número internacional pegado ya incluye su prefijo: nunca concatenarlo otra vez.
  let parsed =
    raw.startsWith('+') || raw.startsWith('00')
      ? parsePhoneNumberFromString(raw.replace(/^00/, '+'), { extract: false })
      : undefined;
  if (!raw.startsWith('+') && !raw.startsWith('00')) {
    const region =
      getCountries().find(
        (c) => getCountryCallingCode(c) === code && c === country,
      ) ?? getCountries().find((c) => getCountryCallingCode(c) === code);
    if (region) {
      parsed = parsePhoneNumberFromString(raw, {
        defaultCountry: region,
        extract: false,
      });
      if (!parsed?.isValid())
        parsed = parsePhoneNumberFromString(`+${code}${digits}`, {
          extract: false,
        });
      // También aceptar un prefijo pegado sin '+', sólo si el nacional no es válido.
      if (!parsed?.isValid() && digits.startsWith(code))
        parsed = parsePhoneNumberFromString(`+${digits}`, { extract: false });
    } else {
      if (codigo.trim().startsWith('+') || code === '1809')
        parsed = parsePhoneNumberFromString(`+${code}${digits}`, {
          extract: false,
        });
      // Datos anteriores usaban el campo código para el código de área (p. ej. 011).
      if (!parsed?.isValid())
        parsed = parsePhoneNumberFromString(`${codigo} ${raw}`.trim(), {
          defaultCountry: country,
          extract: false,
        });
    }
  }
  if (!parsed?.isValid() || parsed.ext)
    return { ok: false as const, error: ERROR_TELEFONO };
  return {
    ok: true as const,
    telefonoCodigo: parsed.countryCallingCode,
    telefonoNumero: String(parsed.nationalNumber),
    internacional: parsed.formatInternational(),
    pais: parsed.country ?? country,
  };
}
