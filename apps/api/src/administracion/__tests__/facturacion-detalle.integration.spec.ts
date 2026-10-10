import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { ComprobantesService } from '../comprobantes.service';
import { FacturaService } from '../factura.service';
import { FacturaPdfService } from '../factura-pdf.service';

describe('Facturas detalladas y agrupadas con snapshots reales', () => {
  const db = new PrismaService();
  const tenantId = randomUUID();
  const ordenIds: string[] = [];
  let puntoVentaId: string;
  let service: ComprobantesService;
  const auth = {
    tenantId,
    permisos: new Set(['administracion.facturacion.gestionar']),
  } as CurrentAuth;
  const emitir = jest.fn(async (_auth, id) => {
    const c = await db.comprobante.findUniqueOrThrow({ where: { id } });
    return {
      id: c.id,
      estado: 'emitido',
      total: Number(c.total),
      items: c.itemsJson,
    };
  });
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !url.pathname.endsWith('_test') ||
      !['localhost', '127.0.0.1'].includes(url.hostname)
    )
      throw new Error('Sólo base local de pruebas');
    await db.tenant.create({
      data: {
        id: tenantId,
        slug: `factura-detalle-${tenantId}`,
        nombre: 'Empresa ficticia',
      },
    });
    const config = await db.configuracionFiscal.create({
      data: {
        tenantId,
        razonSocial: 'Empresa ficticia',
        cuit: '30712345671',
        condicionFiscal: 'RI',
      },
    });
    puntoVentaId = (
      await db.puntoVenta.create({
        data: {
          tenantId,
          configuracionFiscalId: config.id,
          numero: 1,
          nombre: 'Prueba local',
        },
      })
    ).id;
    for (let i = 0; i < 2; i++) {
      const o = await db.ordenTrabajo.create({
        data: {
          tenantId,
          numero: `OT-FICTICIA-${i}`,
          estado: 'finalizada',
          total: 363,
          cargosDirectosJson: [
            {
              nombreSnapshot: 'Envío',
              montoNeto: 100,
              impuestoPorcentaje: 21,
              total: 121,
            },
          ],
          items: {
            create: [
              {
                tenantId,
                nombre: 'Tarjetas',
                codigo: 'T',
                familia: 'Pruebas',
                cantidad: 500,
                cantidadUnidad: 'unidad',
                subtotal: 200,
                impuestos: 42,
                total: 242,
              },
            ],
          },
        },
      });
      ordenIds.push(o.id);
    }
    service = Object.assign(Object.create(ComprobantesService.prototype), {
      prisma: db,
      capacidades: { exigir: jest.fn(), exigirOperacionTx: jest.fn() },
      afipIntegracion: { facturacionHabilitada: async () => true },
      emitir,
    }) as ComprobantesService;
  });
  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.$disconnect();
  });
  it('facturar una OT detalla por defecto y el PDF usa productos y cargos, sin contactar ARCA', async () => {
    const f = await service.facturarOrden(auth, ordenIds[0], {
      emitir: false,
      puntoVentaId,
    });
    expect(f.items.map((i) => i.descripcion)).toEqual(['Tarjetas', 'Envío']);
    expect(f.total).toBe(363);
    const documento = await new FacturaService(db, {
      paraDocumentos: async () => ({ nombre: 'Empresa ficticia' }),
    } as never).documento(tenantId, f.id);
    expect(documento.items.map((i) => i.descripcion)).toEqual([
      'Tarjetas',
      'Envío',
    ]);
    const pdf = await new FacturaPdfService().generar(documento, null);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(emitir).not.toHaveBeenCalled();
  });
  it('agrupada permite detalle completo con identidad de OT y mantiene cada vínculo', async () => {
    const r = await service.facturarLote(auth, {
      ordenIds,
      puntoVentaId,
      modo: 'agrupada',
      detalle: 'items',
    });
    expect(r.resultados.every((x) => x.ok)).toBe(true);
    const id = r.resultados[0].comprobante!.id;
    const c = await db.comprobante.findUniqueOrThrow({
      where: { id },
      include: { ordenes: true },
    });
    expect(Number(c.total)).toBe(726);
    expect(c.ordenes.map((v) => Number(v.monto))).toEqual([363, 363]);
    expect(
      (c.itemsJson as { descripcion: string }[]).map((i) => i.descripcion),
    ).toEqual([
      'OT-FICTICIA-0 · Tarjetas',
      'OT-FICTICIA-0 · Envío',
      'OT-FICTICIA-1 · Tarjetas',
      'OT-FICTICIA-1 · Envío',
    ]);
  });
  it('agrupada conserva resumen predeterminado; por orden conserva detalle predeterminado', async () => {
    const resumen = await service.facturarLote(auth, {
      ordenIds,
      puntoVentaId,
      modo: 'agrupada',
    });
    const c = await db.comprobante.findUniqueOrThrow({
      where: { id: resumen.resultados[0].comprobante!.id },
    });
    expect(c.itemsJson as unknown[]).toHaveLength(2);
    const individuales = await service.facturarLote(auth, {
      ordenIds,
      puntoVentaId,
      modo: 'por_orden',
    });
    for (const r of individuales.resultados) {
      const f = await db.comprobante.findUniqueOrThrow({
        where: { id: r.comprobante!.id },
      });
      expect(
        (f.itemsJson as { descripcion: string }[]).map((i) => i.descripcion),
      ).toEqual(['Tarjetas', 'Envío']);
    }
  });
});
