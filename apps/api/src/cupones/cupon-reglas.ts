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

import { claveFechaEnZona } from '../common/zona';

export type CuponEvaluable = {
  codigo: string;
  tipo: string; // PORCENTAJE | MONTO
  valor: number;
  alcanceTipo: string; // ORDEN | CATEGORIA | SUBCATEGORIA | PRODUCTO | CLIENTE
  alcanceRef: string | null;
  montoMinimo: number | null;
  /** YYYY-MM-DD, fecha calendario del tenant. */
  vigenciaDesde: string | null;
  vigenciaHasta: string | null;
  usoMax: number | null;
  usoCount: number;
  activo: boolean;
};

export type ItemCarrito = {
  /** Clave del front para devolver qué líneas alcanza (id del item de la ficha). */
  key: string;
  /** Id (uuid) del producto — lo que la ficha lleva como `motorCodigo`. */
  productoId?: string | null;
  /** Código del producto. Viaja además del id porque un cupón con alcance
   *  PRODUCTO puede haber guardado cualquiera de los dos. */
  productoCodigo?: string | null;
  categoriaCodigo?: string | null;
  subcategoriaCodigo?: string | null;
  /** Neto de lista de la línea (sin descuentos previos). */
  neto: number;
};

export type ContextoCarrito = {
  ahora: Date;
  zonaHoraria: string;
  clienteId: string | null;
  items: ItemCarrito[];
};

export type ResultadoCupon =
  | { ok: true; alcanzadas: string[] }
  | { ok: false; motivo: string };

export type LineaPlanCupon = {
  key: string;
  tipo: 'PORCENTAJE' | 'MONTO';
  valor: number;
};

/**
 * Distribución monetaria canónica. Trabaja en unidades menores enteras para
 * que la suma sea exacta tanto en monedas con centavos como CLP/PYG.
 */
export function planDescuentoCupon(
  cupon: Pick<CuponEvaluable, 'tipo' | 'valor'>,
  items: ItemCarrito[],
  alcanzadas: readonly string[],
  decimales: number,
): LineaPlanCupon[] {
  const elegibles = items.filter(
    (item) => alcanzadas.includes(item.key) && item.neto > 0,
  );
  if (cupon.tipo === 'PORCENTAJE') {
    return elegibles.map((item) => ({
      key: item.key,
      tipo: 'PORCENTAJE',
      valor: cupon.valor,
    }));
  }

  const factor = 10 ** decimales;
  const netos = elegibles.map((item) =>
    Math.max(0, Math.round(item.neto * factor)),
  );
  const total = netos.reduce((suma, neto) => suma + neto, 0);
  const objetivo = Math.min(Math.round(cupon.valor * factor), total);
  if (objetivo <= 0 || total <= 0) return [];

  const objetivoExacto = BigInt(objetivo);
  const totalExacto = BigInt(total);
  const bases = netos.map(
    (neto) => (objetivoExacto * BigInt(neto)) / totalExacto,
  );
  let restantes =
    objetivoExacto - bases.reduce((suma, base) => suma + base, 0n);
  const orden = netos
    .map((neto, index) => ({
      index,
      resto: (objetivoExacto * BigInt(neto)) % totalExacto,
    }))
    .sort((a, b) =>
      a.resto === b.resto ? a.index - b.index : a.resto > b.resto ? -1 : 1,
    );
  for (const { index } of orden) {
    if (restantes <= 0n) break;
    if (bases[index] < BigInt(netos[index])) {
      bases[index] += 1n;
      restantes -= 1n;
    }
  }
  return elegibles.map((item, index) => ({
    key: item.key,
    tipo: 'MONTO',
    valor: Number(bases[index]) / factor,
  }));
}

export function evaluarCupon(
  cupon: CuponEvaluable,
  contexto: ContextoCarrito,
): ResultadoCupon {
  if (!cupon.activo) {
    return { ok: false, motivo: 'El cupón está desactivado.' };
  }
  const hoy = claveFechaEnZona(contexto.ahora, contexto.zonaHoraria);
  if (cupon.vigenciaDesde && hoy < cupon.vigenciaDesde) {
    return { ok: false, motivo: 'El cupón todavía no está vigente.' };
  }
  if (cupon.vigenciaHasta && hoy > cupon.vigenciaHasta) {
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
          // Contra el id Y contra el código: hay dos identificadores del
          // producto dando vueltas (la ficha usa el uuid, el catálogo
          // muestra el código) y el cupón pudo guardar cualquiera.
          return (
            item.productoId === cupon.alcanceRef ||
            item.productoCodigo === cupon.alcanceRef
          );
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
