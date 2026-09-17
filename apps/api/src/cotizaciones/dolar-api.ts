import type { CotizacionDolar, DolarResponse } from './cotizaciones.types';

type Cobertura = {
  url: string;
  moneda: string;
  principal: string;
  campo: DolarResponse['campoPrincipal'];
};

/** URLs fijas: el endpoint nunca acepta una URL o un país del navegador. */
export const DOLAR_COBERTURA = {
  AR: {
    url: 'https://dolarapi.com/v1/dolares',
    moneda: 'ARS',
    principal: 'oficial',
    campo: 'venta',
  },
  BO: {
    url: 'https://bo.dolarapi.com/v1/dolares/oficial',
    moneda: 'BOB',
    principal: 'oficial',
    campo: 'venta',
  },
  BR: {
    url: 'https://br.dolarapi.com/v1/cotacoes/usd',
    moneda: 'BRL',
    principal: 'mercado',
    campo: 'venta',
  },
  CL: {
    url: 'https://cl.dolarapi.com/v1/cotizaciones/usd',
    moneda: 'CLP',
    principal: 'mercado',
    campo: 'venta',
  },
  CO: {
    url: 'https://co.dolarapi.com/v1/trm',
    moneda: 'COP',
    principal: 'trm',
    campo: 'referencia',
  },
  MX: {
    url: 'https://mx.dolarapi.com/v1/cotizaciones/usd',
    moneda: 'MXN',
    principal: 'fix',
    campo: 'referencia',
  },
  UY: {
    url: 'https://uy.dolarapi.com/v1/cotizaciones/usd',
    moneda: 'UYU',
    principal: 'brou',
    campo: 'venta',
  },
  VE: {
    url: 'https://ve.dolarapi.com/v1/dolares',
    moneda: 'VES',
    principal: 'oficial',
    campo: 'referencia',
  },
} as const satisfies Record<string, Cobertura>;

export type PaisDolar = keyof typeof DOLAR_COBERTURA;

export function tieneCobertura(pais: string): pais is PaisDolar {
  return Object.hasOwn(DOLAR_COBERTURA, pais);
}

const NOMBRES_AR: Record<string, string> = {
  oficial: 'Oficial',
  blue: 'Blue',
  bolsa: 'MEP',
  contadoconliqui: 'CCL',
  mayorista: 'Mayorista',
  cripto: 'Cripto',
  tarjeta: 'Tarjeta',
};

function importe(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

/** Valida cada formato publicado; una referencia jamás se convierte en venta. */
export function normalizarDolar(
  pais: PaisDolar,
  data: unknown,
): CotizacionDolar[] {
  const filas = Array.isArray(data) ? data : [data];
  const cotizaciones: CotizacionDolar[] = [];
  for (const fila of filas) {
    if (!fila || typeof fila !== 'object' || Array.isArray(fila)) continue;
    const raw = fila as Record<string, unknown>;
    if (
      pais === 'CO' ? raw.unidad !== 'COP' : (raw.moneda ?? raw.moeda) !== 'USD'
    )
      continue;
    const fecha = raw.fechaActualizacion ?? raw.dataAtualizacao;
    if (
      typeof fecha !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(fecha) ||
      !Number.isFinite(Date.parse(fecha))
    )
      continue;

    let id: string = DOLAR_COBERTURA[pais].principal;
    let nombre: string;
    switch (pais) {
      case 'AR':
        id = typeof raw.casa === 'string' ? raw.casa : '';
        nombre = Object.hasOwn(NOMBRES_AR, id) ? NOMBRES_AR[id] : '';
        break;
      case 'VE':
        id = typeof raw.fuente === 'string' ? raw.fuente : '';
        nombre =
          id === 'oficial' ? 'Oficial' : id === 'paralelo' ? 'Paralelo' : '';
        break;
      case 'BO':
        nombre = raw.casa === 'oficial' ? 'Oficial' : '';
        break;
      case 'CO':
        nombre = 'TRM';
        break;
      case 'MX':
        nombre = 'FIX';
        break;
      case 'UY':
        nombre = 'BROU';
        break;
      default:
        nombre = 'Mercado';
    }
    if (!nombre || cotizaciones.some((c) => c.id === id)) continue;
    const cotizacion: CotizacionDolar = {
      id,
      nombre,
      compra: importe(raw.compra),
      venta: importe(raw.venta ?? raw.venda),
      referencia: importe(
        pais === 'MX'
          ? raw.fix
          : pais === 'CO'
            ? raw.valor
            : pais === 'VE'
              ? raw.promedio
              : null,
      ),
      tipoReferencia:
        pais === 'MX'
          ? 'FIX'
          : pais === 'CO'
            ? 'TRM'
            : pais === 'VE'
              ? 'Referencia'
              : null,
      fechaActualizacion: new Date(fecha).toISOString(),
    };
    if (cotizacion[DOLAR_COBERTURA[pais].campo] !== null)
      cotizaciones.push(cotizacion);
  }
  const principal = DOLAR_COBERTURA[pais].principal;
  if (!cotizaciones.some((c) => c.id === principal)) {
    throw new Error('DolarAPI no publicó una cotización principal válida');
  }
  return cotizaciones.sort(
    (a, b) => Number(b.id === principal) - Number(a.id === principal),
  );
}
