/**
 * Validación de CUIT/CUIL argentino: 11 dígitos + verificador (módulo 11).
 * Un CUIT inválido hace que ARCA rechace el comprobante al emitir, así que
 * conviene frenarlo donde todavía se puede corregir.
 */

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** "30-71234567-1" → "30712345671". */
export function normalizarCuit(cuit: string): string {
  return cuit.replace(/\D/g, '');
}

/** "30712345671" → "30-71234567-1" (para mostrar). */
export function formatearCuit(cuit: string): string {
  const d = normalizarCuit(cuit);
  if (d.length !== 11) return cuit;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export function cuitValido(cuit: string): boolean {
  const d = normalizarCuit(cuit);
  if (!/^\d{11}$/.test(d)) return false;
  const digitos = d.split('').map(Number);
  const resto = PESOS.reduce((acc, p, i) => acc + p * digitos[i], 0) % 11;
  const verificador = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
  return verificador === digitos[10];
}
