import { Prisma } from '@prisma/client';
import { CC_PRODUCTO_CODIGO, CC_RUTA_CODIGO } from './provisionar-plantilla';

export interface TomoCotizadoPersistible {
  juegos: number;
  anilladoActivo: boolean;
  costos: {
    unitario: number;
    total: number;
  } & Record<string, unknown>;
  subtotal: number;
  iva: number;
  total: number;
  jobContext: Record<string, unknown>;
  pasos: unknown[];
  precio: {
    precioConfig?: unknown;
    impuestos?: unknown;
    comisiones?: unknown;
    precioEspecialCliente?: unknown;
  } | null;
}

/**
 * Única proyección del agregado cotizado por el motor a CotizacionItem. No
 * calcula precios ni costos: congela exactamente los resultados universales
 * ya compuestos y deja un snapshot materializable por Producción.
 */
export function dataCotizacionItemTomo(args: {
  tenantId: string;
  cotizacionId: string;
  productoId: string;
  rutaAlternativaId: string;
  tomo: TomoCotizadoPersistible;
}): Prisma.CotizacionItemUncheckedCreateInput {
  const { tomo } = args;
  const precioUnitario =
    tomo.juegos > 0 ? tomo.total / tomo.juegos : tomo.total;
  return {
    tenantId: args.tenantId,
    cotizacionId: args.cotizacionId,
    productoId: args.productoId,
    rutaAlternativaId: args.rutaAlternativaId,
    cantidad: String(tomo.juegos),
    jobContextJson: tomo.jobContext as Prisma.InputJsonValue,
    snapshotJson: {
      producto: {
        id: args.productoId,
        codigo: CC_PRODUCTO_CODIGO,
        nombre: 'Impresión por hoja',
        unidadComercial: tomo.anilladoActivo ? 'libros' : 'unidad',
        modoMedidas: 'MIXTA',
        minimoComercialBase: 'cantidad_comercial',
      },
      ruta: {
        codigo: CC_RUTA_CODIGO,
        nombre: 'Impresión de documento (centro de copiado)',
        alternativa: 'Impresión digital',
      },
      ejecucion: {
        cantidadEfectiva: tomo.juegos,
        cantidadPedida: tomo.juegos,
        cantidadComercialReal: tomo.juegos,
        cantidadComercialPricing: 1,
        unidadComercialPricing: tomo.anilladoActivo ? 'libros' : 'unidad',
        costos: tomo.costos,
      },
    } as Prisma.InputJsonValue,
    costoUnitario: String(tomo.costos.unitario),
    costoTotal: String(tomo.costos.total),
    precioNetoUnitario: String(
      tomo.juegos > 0 ? tomo.subtotal / tomo.juegos : tomo.subtotal,
    ),
    precioNetoTotal: String(tomo.subtotal),
    impuestosPorFueraTotal: String(tomo.iva),
    precioUnitario: String(precioUnitario),
    precioTotal: String(tomo.total),
    trazabilidadJson: {
      pasos: tomo.pasos,
      cargosDirectosCotizacion: [],
    } as Prisma.InputJsonValue,
    precioConfigSnapshotJson: (tomo.precio?.precioConfig ??
      Prisma.DbNull) as Prisma.InputJsonValue,
    impuestosSnapshotJson: (tomo.precio?.impuestos ??
      Prisma.DbNull) as Prisma.InputJsonValue,
    comisionesSnapshotJson: (tomo.precio?.comisiones ??
      Prisma.DbNull) as Prisma.InputJsonValue,
    precioEspecialClienteSnapshotJson: (tomo.precio?.precioEspecialCliente ??
      Prisma.DbNull) as Prisma.InputJsonValue,
  };
}
