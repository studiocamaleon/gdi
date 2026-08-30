export type OperadorReglaUnidad =
  "COPIAR" | "SUMAR" | "RESTAR" | "MULTIPLICAR" | "DIVIDIR";

export function esMedidaInternaMm(clave: string): boolean {
  return /(?:^|\.)(?:anchoMm|altoMm)$/.test(clave);
}

export function unidadVisibleParametro(
  clave: string,
  unidadInterna?: string | null,
): string | null {
  return esMedidaInternaMm(clave) ? "cm" : (unidadInterna ?? null);
}

export function valorInternoAVisible(clave: string, valor: number): number {
  return esMedidaInternaMm(clave) ? valor / 10 : valor;
}

export function valorVisibleAInterno(clave: string, valor: number): number {
  return esMedidaInternaMm(clave) ? valor * 10 : valor;
}

export function operacionUsaUnidad(operador: OperadorReglaUnidad): boolean {
  return operador === "SUMAR" || operador === "RESTAR";
}

export function valorReglaInternoAVisible(
  campoPadre: string,
  operador: OperadorReglaUnidad,
  valor: number,
): number {
  return operacionUsaUnidad(operador)
    ? valorInternoAVisible(campoPadre, valor)
    : valor;
}

export function valorReglaVisibleAInterno(
  campoPadre: string,
  operador: OperadorReglaUnidad,
  valor: number,
): number {
  return operacionUsaUnidad(operador)
    ? valorVisibleAInterno(campoPadre, valor)
    : valor;
}
