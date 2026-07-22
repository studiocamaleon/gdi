import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

/**
 * Teléfono a E.164, que es lo único que WhatsApp acepta.
 *
 * Se usa `libphonenumber-js` en vez de armarlo a mano a propósito, y la
 * primera versión de este archivo es la prueba: intentaba sacar el `15` de
 * los celulares argentinos con una expresión regular y en `3415551840`
 * encontraba un "15" que era parte del número, devolviendo un teléfono
 * ajeno. En este contexto eso no es un error de formato — es un WhatsApp con
 * datos de una orden mandado a un desconocido.
 *
 * La librería resuelve sola los dos prefijos que sólo existen dentro de
 * Argentina: el `0` de larga distancia y el `15` de celular.
 *
 * Lo que la librería NO puede resolver, y decidimos nosotros, está abajo en
 * `forzarMovilAr`.
 *
 * La base guarda el teléfono partido en tres columnas (`telefonoCodigo`,
 * `telefonoNumero`, `paisCodigo`) y cargado a mano durante años, así que hay
 * de todo: con `0`, con `15`, con guiones, con el código de país repetido.
 */

export type ResultadoTelefono =
  | { ok: true; e164: string }
  | { ok: false; motivo: string };

/** País por defecto cuando la fila no lo trae. El sistema es argentino. */
const PAIS_DEFAULT: CountryCode = 'AR';

export function aE164(datos: {
  telefonoCodigo?: string | null;
  telefonoNumero?: string | null;
  paisCodigo?: string | null;
}): ResultadoTelefono {
  const crudo = `${(datos.telefonoCodigo ?? '').trim()} ${(
    datos.telefonoNumero ?? ''
  ).trim()}`.trim();

  if (!crudo || !/\d/.test(crudo)) {
    return { ok: false, motivo: 'El cliente no tiene teléfono cargado.' };
  }

  const pais = normalizarPais(datos.paisCodigo);
  const parsed = parsePhoneNumberFromString(crudo, pais);

  if (!parsed) {
    return { ok: false, motivo: `No pude interpretar "${crudo}".` };
  }
  if (!parsed.isValid()) {
    return {
      ok: false,
      motivo: `"${crudo}" no es un número válido para ${parsed.country ?? pais}.`,
    };
  }

  const e164 =
    parsed.country === 'AR'
      ? forzarMovilAr(parsed.nationalNumber)
      : parsed.number.replace(/^\+/, '');

  return { ok: true, e164 };
}

/**
 * En Argentina, WhatsApp exige la forma MÓVIL: `54` + `9` + número nacional.
 *
 * El problema es que un número guardado sin el `15` es ambiguo —`3415551840`
 * puede ser el fijo 341 555-1840 o el celular escrito sin prefijo— y la
 * librería, con razón, lo interpreta como fijo.
 *
 * Se fuerza la forma móvil igual, y la razón es asimétrica: si el número era
 * realmente un fijo, WhatsApp no iba a llegar de ninguna manera, así que
 * agregar el 9 no empeora nada. Si era un celular al que le faltaba el `15`
 * —que es el caso frecuente en datos cargados a mano— NO agregarlo garantiza
 * que el mensaje nunca llegue, y encima Meta acepta el envío sin error.
 *
 * O sea: agregarlo puede fallar donde ya iba a fallar; no agregarlo falla
 * donde podía funcionar.
 */
function forzarMovilAr(nacional: string): string {
  const n = nacional.startsWith('9') ? nacional : `9${nacional}`;
  return `54${n}`;
}

/** `AR`, `ar`, `argentina`, vacío → CountryCode válido. */
function normalizarPais(pais?: string | null): CountryCode {
  const p = (pais ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(p) ? (p as CountryCode) : PAIS_DEFAULT;
}

/**
 * Para la UI: cuántos clientes tienen un teléfono que no sirve para WhatsApp.
 * Se sabe ANTES de encender la integración, no cuando falla el primer envío.
 */
export function contarInvalidos(
  clientes: Array<{
    telefonoCodigo?: string | null;
    telefonoNumero?: string | null;
    paisCodigo?: string | null;
  }>,
): number {
  return clientes.filter((c) => !aE164(c).ok).length;
}
