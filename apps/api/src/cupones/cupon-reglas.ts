/**
 * Reglas de un cupón (F4 descuentos — docs/descuentos-diseno.md §5.3).
 * Función PURA: dado el cupón y el contexto del carrito, decide si puede
 * aplicarse y a QUÉ líneas alcanza. El motivo de rechazo es texto para el
 * vendedor (se muestra tal cual en el modal de descuento).
 *
 * El cupón produce después el MISMO descuento por línea de F1 (un % igual a
 * cada línea alcanzada; un $ prorrateado entre ellas): acá no hay matemática
 * de precio, sólo elegibilidad.
 */

export type CuponEvaluable = {
  codigo: string;
  tipo: string; // PORCENTAJE | MONTO
  valor: number;
  alcanceTipo: string; // ORDEN | CATEGORIA | SUBCATEGORIA | PRODUCTO | CLIENTE
  alcanceRef: string | null;
  montoMinimo: number | null;
  vigenciaDesde: Date | null;
  vigenciaHasta: Date | null;
  usoMax: number | null;
  usoCount: number;
  activo: boolean;
};

export type ItemCarrito = {
  /** Clave del front para devolver qué líneas alcanza (id del item de la ficha). */
  key: string;
  productoId?: string | null;
  categoriaCodigo?: string | null;
  subcategoriaCodigo?: string | null;
  /** Neto de lista de la línea (sin descuentos previos). */
  neto: number;
};

export type ContextoCarrito = {
  ahora: Date;
  clienteId: string | null;
  items: ItemCarrito[];
};

export type ResultadoCupon =
  | { ok: true; alcanzadas: string[] }
  | { ok: false; motivo: string };

export function evaluarCupon(
  cupon: CuponEvaluable,
  contexto: ContextoCarrito,
): ResultadoCupon {
  if (!cupon.activo) {
    return { ok: false, motivo: 'El cupón está desactivado.' };
  }
  if (cupon.vigenciaDesde && contexto.ahora < cupon.vigenciaDesde) {
    return { ok: false, motivo: 'El cupón todavía no está vigente.' };
  }
  if (cupon.vigenciaHasta && contexto.ahora > cupon.vigenciaHasta) {
    return { ok: false, motivo: 'El cupón está vencido.' };
  }
  if (cupon.usoMax != null && cupon.usoCount >= cupon.usoMax) {
    return { ok: false, motivo: 'El cupón ya no tiene usos disponibles.' };
  }

  if (cupon.alcanceTipo === 'CLIENTE') {
    if (!contexto.clienteId) {
      return {
        ok: false,
        motivo: 'Este cupón es de un cliente: asigná el cliente primero.',
      };
    }
    if (contexto.clienteId !== cupon.alcanceRef) {
      return { ok: false, motivo: 'El cupón no es para este cliente.' };
    }
  }

  const alcanzadas = contexto.items
    .filter((item) => {
      switch (cupon.alcanceTipo) {
        case 'CATEGORIA':
          return item.categoriaCodigo === cupon.alcanceRef;
        case 'SUBCATEGORIA':
          return item.subcategoriaCodigo === cupon.alcanceRef;
        case 'PRODUCTO':
          return item.productoId === cupon.alcanceRef;
        // ORDEN y CLIENTE alcanzan todas las líneas.
        default:
          return true;
      }
    })
    .map((item) => item.key);
  if (alcanzadas.length === 0) {
    return {
      ok: false,
      motivo: 'Ningún producto de la orden entra en el alcance del cupón.',
    };
  }

  // El mínimo se controla contra el neto TOTAL de la orden (la compra), no
  // contra las líneas alcanzadas: "compras desde $X" habla del ticket.
  if (cupon.montoMinimo != null) {
    const netoOrden = contexto.items.reduce((a, i) => a + i.neto, 0);
    if (netoOrden < cupon.montoMinimo) {
      return {
        ok: false,
        motivo: `El cupón pide una compra mínima que la orden todavía no alcanza.`,
      };
    }
  }

  return { ok: true, alcanzadas };
}

/** Normalización única del código (se guarda y se busca en MAYÚSCULAS). */
export function normalizarCodigoCupon(codigo: string): string {
  return codigo.trim().toUpperCase();
}
