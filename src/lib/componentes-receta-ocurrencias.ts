export type ProductoComponenteReferencia = {
  id: string;
  codigo: string;
  nombre: string;
};

export type OcurrenciaComponenteReferencia = {
  productoComponenteId: string;
  codigo: string;
  nombre: string;
};

const MAX_CODIGO_COMPONENTE = 100;

function codigoConSufijo(base: string, numeroUso: number): string {
  if (numeroUso === 1) return base.slice(0, MAX_CODIGO_COMPONENTE);
  const sufijo = `-${numeroUso}`;
  return `${base.slice(0, MAX_CODIGO_COMPONENTE - sufijo.length)}${sufijo}`;
}

/**
 * Crea la identidad estable de un uso BOM. El producto puede repetirse; lo
 * único en la receta es la ocurrencia, representada por `codigo`.
 */
export function crearIdentidadOcurrenciaComponente(
  producto: ProductoComponenteReferencia,
  existentes: OcurrenciaComponenteReferencia[],
): { codigo: string; nombre: string; numeroUso: number } {
  const usados = new Set(
    existentes.map((componente) => componente.codigo.trim().toLowerCase()),
  );
  const usosDelProducto = existentes.filter(
    (componente) => componente.productoComponenteId === producto.id,
  ).length;
  let numeroUso = usosDelProducto + 1;
  let codigo = codigoConSufijo(producto.codigo.trim(), numeroUso);

  while (usados.has(codigo.toLowerCase())) {
    numeroUso += 1;
    codigo = codigoConSufijo(producto.codigo.trim(), numeroUso);
  }

  return {
    codigo,
    nombre:
      usosDelProducto === 0
        ? producto.nombre.trim()
        : `${producto.nombre.trim()} · Uso ${numeroUso}`,
    numeroUso,
  };
}

export function cantidadUsosProductoComponente(
  productoId: string,
  existentes: OcurrenciaComponenteReferencia[],
): number {
  return existentes.filter(
    (componente) => componente.productoComponenteId === productoId,
  ).length;
}
