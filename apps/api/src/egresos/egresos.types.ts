/**
 * Egresos — tipos, estados y el ÁRBOL SEMILLA de categorías.
 * Contrato espejo del frontend: src/lib/egresos.ts.
 * Ver docs/egresos-y-cuentas-por-pagar-diseno.md
 */

import { NaturalezaEgreso } from '@prisma/client';

/**
 * Estados de un egreso. `parcial` existe porque un pago puede no alcanzar:
 * la factura sigue en Cuentas por pagar por el saldo.
 */
export const EGRESO_ESTADOS = [
  'pendiente',
  'parcial',
  'pagado',
  'anulado',
] as const;

export type EgresoEstado = (typeof EGRESO_ESTADOS)[number];

export const EGRESO_ESTADO_LABELS: Record<EgresoEstado, string> = {
  pendiente: 'Pendiente',
  parcial: 'Pago parcial',
  pagado: 'Pagado',
  anulado: 'Anulado',
};

/**
 * Tipo de comprobante que nos dio el proveedor. `SIN_DOCUMENTO` no es un hueco
 * a tapar: es el flete que no dio nada y la propina de la caja chica, que
 * también salen de la caja y tienen que poder registrarse.
 */
export const TIPOS_COMPROBANTE_COMPRA = [
  'FA',
  'FB',
  'FC',
  'ND',
  'NC',
  'TICKET',
  'RECIBO',
  'SIN_DOCUMENTO',
] as const;

export type TipoComprobanteCompra = (typeof TIPOS_COMPROBANTE_COMPRA)[number];

export const TIPO_COMPROBANTE_LABELS: Record<TipoComprobanteCompra, string> = {
  FA: 'Factura A',
  FB: 'Factura B',
  FC: 'Factura C',
  ND: 'Nota de débito',
  NC: 'Nota de crédito',
  TICKET: 'Ticket',
  RECIBO: 'Recibo',
  SIN_DOCUMENTO: 'Sin documento',
};

/**
 * Regímenes de retención PRACTICADA. Mismo catálogo que las sufridas del lado
 * de cobros (`administracion/dto/cobro.dto.ts`): son los mismos impuestos,
 * cambia de qué lado del mostrador estamos.
 */
export const REGIMENES_RETENCION = [
  'SICORE_GANANCIAS',
  'IVA_RG2854',
  'IIBB_CONVENIO',
  'SUSS',
  'otro',
] as const;

export const REGIMEN_RETENCION_LABELS: Record<string, string> = {
  SICORE_GANANCIAS: 'Ganancias (SICORE)',
  IVA_RG2854: 'IVA',
  IIBB_CONVENIO: 'Ingresos brutos',
  SUSS: 'SUSS',
  otro: 'Otro',
};

export const NATURALEZA_LABELS: Record<NaturalezaEgreso, string> = {
  COSTO_PRODUCCION: 'Costo de producción',
  GASTO_ESTRUCTURA: 'Gasto de estructura',
  INVERSION: 'Inversión',
  RETIRO_SOCIOS: 'Retiro de socios',
  NO_RESULTADO: 'No incide en resultado',
};

/**
 * Qué naturalezas suman al RESULTADO del período. Las otras mueven caja y
 * nada más: una máquina nueva no es gasto de julio, un retiro de socios no es
 * gasto, y un adelanto de sueldo es plata que el empleado debe.
 *
 * Si esto se ignorara, el mes en que se compra una guillotina parecería
 * catastrófico y el costo laboral se contaría dos veces (el adelanto y después
 * el sueldo completo).
 */
export const NATURALEZAS_DE_RESULTADO: NaturalezaEgreso[] = [
  NaturalezaEgreso.COSTO_PRODUCCION,
  NaturalezaEgreso.GASTO_ESTRUCTURA,
];

export function incideEnResultado(naturaleza: NaturalezaEgreso): boolean {
  return NATURALEZAS_DE_RESULTADO.includes(naturaleza);
}

/**
 * El árbol CURADO que se siembra en cada tenant.
 *
 * Curado y no libre porque el usuario lo pidió así, y con razón: con un campo
 * de texto libre, en tres meses hay cuarenta categorías escritas a mano y
 * ningún reporte que cierre. Editable porque cada taller le dice distinto a lo
 * mismo.
 *
 * Dos niveles y no más: el plan de cuentas de la competencia tiene tres y 80+
 * hojas (`2.01.0012 Mantenimiento de Equipos Administrativos`) y nadie lo
 * mantiene.
 *
 * La AMORTIZACIÓN no está acá a propósito: no es un egreso porque no sale
 * plata. Vive sólo en `GastoFijoEstructura`, donde sirve para costear. Si
 * apareciera en este árbol, la caja mentiría.
 */
export type CategoriaSemilla = {
  codigo: string;
  nombre: string;
  naturaleza: NaturalezaEgreso;
};

export const CATEGORIAS_SEMILLA: CategoriaSemilla[] = [
  // ── Costo de producción ──────────────────────────────────────────────
  {
    codigo: 'materiales',
    nombre: 'Materiales e insumos productivos',
    naturaleza: NaturalezaEgreso.COSTO_PRODUCCION,
  },
  {
    codigo: 'tercerizacion',
    nombre: 'Tercerización / trabajos a terceros',
    naturaleza: NaturalezaEgreso.COSTO_PRODUCCION,
  },
  {
    codigo: 'consumibles_maquina',
    nombre: 'Consumibles de máquina (tintas, tóner, planchas)',
    naturaleza: NaturalezaEgreso.COSTO_PRODUCCION,
  },
  {
    codigo: 'repuestos_maquinas',
    nombre: 'Repuestos y mantenimiento de máquinas',
    naturaleza: NaturalezaEgreso.COSTO_PRODUCCION,
  },
  {
    codigo: 'fletes',
    nombre: 'Fletes de compra y de entrega',
    naturaleza: NaturalezaEgreso.COSTO_PRODUCCION,
  },

  // ── Gasto de estructura ──────────────────────────────────────────────
  {
    codigo: 'alquiler',
    nombre: 'Alquiler',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'servicios',
    nombre: 'Servicios (luz, gas, agua, internet, telefonía)',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'limpieza_mantenimiento',
    nombre: 'Limpieza y mantenimiento del local',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'insumos_oficina',
    nombre: 'Insumos de oficina',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'honorarios',
    nombre: 'Honorarios profesionales (contable, legal)',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'software',
    nombre: 'Software y licencias',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'seguros',
    nombre: 'Seguros',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'marketing',
    nombre: 'Publicidad y marketing',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'bancarios',
    nombre: 'Gastos bancarios y financieros',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'impuestos_tasas',
    nombre: 'Impuestos y tasas',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'multas',
    nombre: 'Multas y recargos',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'vehiculo',
    nombre: 'Vehículo (combustible, patente, seguro, mantenimiento)',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'sueldos',
    nombre: 'Sueldos y jornales',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'cargas_sociales',
    nombre: 'Cargas sociales y ART',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'aguinaldo',
    nombre: 'Aguinaldo (SAC)',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'vacaciones',
    nombre: 'Vacaciones',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'indemnizaciones',
    nombre: 'Indemnizaciones',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'ropa_trabajo',
    nombre: 'Ropa de trabajo y seguridad',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'capacitacion',
    nombre: 'Capacitación',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },
  {
    codigo: 'otros_gastos',
    nombre: 'Otros gastos',
    naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
  },

  // ── Inversión ────────────────────────────────────────────────────────
  {
    codigo: 'maquinaria',
    nombre: 'Maquinaria y equipos',
    naturaleza: NaturalezaEgreso.INVERSION,
  },
  {
    codigo: 'instalaciones',
    nombre: 'Instalaciones y obra',
    naturaleza: NaturalezaEgreso.INVERSION,
  },
  {
    codigo: 'rodados',
    nombre: 'Rodados',
    naturaleza: NaturalezaEgreso.INVERSION,
  },
  {
    codigo: 'intangibles',
    nombre: 'Software y activos intangibles',
    naturaleza: NaturalezaEgreso.INVERSION,
  },

  // ── Retiro de socios ─────────────────────────────────────────────────
  {
    codigo: 'retiro_socios',
    nombre: 'Retiro de socios',
    naturaleza: NaturalezaEgreso.RETIRO_SOCIOS,
  },
  {
    codigo: 'distribucion_utilidades',
    nombre: 'Distribución de utilidades',
    naturaleza: NaturalezaEgreso.RETIRO_SOCIOS,
  },

  // ── No incide en resultado ───────────────────────────────────────────
  {
    codigo: 'adelanto_sueldo',
    nombre: 'Adelantos de sueldo',
    naturaleza: NaturalezaEgreso.NO_RESULTADO,
  },
  {
    codigo: 'prestamos_otorgados',
    nombre: 'Préstamos otorgados',
    naturaleza: NaturalezaEgreso.NO_RESULTADO,
  },
  {
    codigo: 'devoluciones_proveedores',
    nombre: 'Devoluciones a proveedores',
    naturaleza: NaturalezaEgreso.NO_RESULTADO,
  },
  {
    codigo: 'ajustes_caja',
    nombre: 'Ajustes de caja',
    naturaleza: NaturalezaEgreso.NO_RESULTADO,
  },
];

/**
 * Estado que le corresponde a un egreso según lo pagado. Se recalcula en la
 * MISMA transacción que la imputación, igual que `cobradoTotal` en la orden.
 *
 * El margen de 1 centavo evita que un redondeo deje una factura eternamente
 * "parcial" por $0,004 y siga apareciendo en Cuentas por pagar para siempre.
 */
export function estadoPorPagado(
  total: number,
  pagado: number,
): Extract<EgresoEstado, 'pendiente' | 'parcial' | 'pagado'> {
  if (pagado <= 0.005) return 'pendiente';
  if (pagado >= total - 0.005) return 'pagado';
  return 'parcial';
}
