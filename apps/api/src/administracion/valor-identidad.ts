/**
 * Clave estable del instrumento para impedir duplicados funcionales.
 *
 * Un número escrito como "0001 2345" y "00012345" representa el mismo
 * cheque. El banco conserva espacios internos normalizados porque forman
 * parte del nombre, pero no distingue mayúsculas.
 */
export function claveInstrumentoValor(
  origen: 'tercero' | 'propio',
  banco: string,
  numero: string,
): string {
  const bancoNormalizado = banco
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es');
  const numeroNormalizado = numero
    .trim()
    .replace(/\s+/g, '')
    .toLocaleLowerCase('es');
  return `${origen}|${bancoNormalizado}|${numeroNormalizado}`;
}

export function numeroValorNormalizado(numero: string): string {
  return numero.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function bancoValorNormalizado(banco: string): string {
  return banco.trim().replace(/\s+/g, ' ');
}
