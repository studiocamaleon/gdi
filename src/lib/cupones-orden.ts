import { validarCupon, type ValidarCuponResultado } from "./cupones-api";
import { netoListaDeItem } from "./descuentos-orden";
import type { PropuestaItem } from "./propuestas";

/** Entrada compartida por el campo manual y el lector. La redención sigue al emitir. */
export async function validarYAplicarCuponOrden({
  codigo,
  clienteId,
  items,
  contextoVigente,
  aplicar,
}: {
  codigo: string;
  clienteId: string;
  items: PropuestaItem[];
  contextoVigente: () => boolean;
  aplicar: (resultado: ValidarCuponResultado) => Promise<boolean>;
}) {
  const resultado = await validarCupon({
    codigo: codigo.trim(),
    clienteId: clienteId || undefined,
    items: items.map((item) => ({
      key: item.id,
      productoId: item.motorCodigo || undefined,
      productoCodigo: item.productoCodigo || undefined,
      categoriaCodigo: item.categoriaComercialCodigo || undefined,
      subcategoriaCodigo: item.subcategoriaComercialCodigo || undefined,
      neto: netoListaDeItem(item),
    })),
  });
  if (!contextoVigente()) {
    throw new Error(
      "La orden cambió durante la validación. Volvé a validar el cupón.",
    );
  }
  return aplicar(resultado);
}
