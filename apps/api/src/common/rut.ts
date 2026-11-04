/** RUT chileno con módulo 11. Acepta puntos, guion y k minúscula. */
export function normalizarRut(valor: string): string | null {
  const partes = /^(\d{1,8}|\d{1,2}(?:\.\d{3}){1,2})-?([\dkK])$/.exec(
    valor.trim(),
  );
  if (!partes) return null;
  const cuerpo = String(Number(partes[1].replace(/\./g, '')));
  if (cuerpo === '0' || cuerpo.length > 8) return null;
  let suma = 0;
  for (let posicion = 0; posicion < cuerpo.length; posicion++) {
    suma += Number(cuerpo[cuerpo.length - 1 - posicion]) * (2 + (posicion % 6));
  }
  const calculado = '0123456789K'[(11 - (suma % 11)) % 11];
  const verificador = partes[2].toUpperCase();
  return calculado === verificador ? `${cuerpo}-${verificador}` : null;
}
