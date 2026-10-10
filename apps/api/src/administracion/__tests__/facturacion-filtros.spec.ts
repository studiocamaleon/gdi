import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { FacturacionOrdenesService } from '../facturacion-ordenes.service';
import type { PrismaService } from '../../prisma/prisma.service';

describe('Facturación — filtros opcionales de OT', () => {
  const prisma = new PrismaClient();
  const service = new FacturacionOrdenesService(
    prisma as unknown as PrismaService,
  );
  let tenantId: string;
  let otroTenantId: string;

  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'))
      throw new Error('Se requiere base exclusiva de tests');
    for (const otro of [false, true]) {
      const tenant = await prisma.tenant.create({
        data: {
          nombre: 'Taller ficticio de filtros',
          slug: `test-fact-filtros-${randomUUID()}`,
        },
      });
      if (otro) otroTenantId = tenant.id;
      else tenantId = tenant.id;
    }
    await prisma.datosEmpresa.create({
      data: { tenantId, zonaHoraria: 'America/Argentina/Buenos_Aires' },
    });
    const base = {
      tenantId,
      total: 100,
      estado: 'finalizada',
      fechaFinalizada: new Date('2026-10-10T12:00:00Z'),
      fechaEmision: new Date('2026-10-08T03:00:00Z'),
    };
    await prisma.ordenTrabajo.createMany({
      data: [
        { ...base, numero: 'PAGADA', cobradoTotal: 100 },
        { ...base, numero: 'EXCEDENTE', cobradoTotal: 120 },
        { ...base, numero: 'UN-CENTAVO', cobradoTotal: 99.99 },
        { ...base, numero: 'IMPAGA', cobradoTotal: 0 },
        {
          ...base,
          numero: 'PARCIAL-FISCAL',
          cobradoTotal: 100,
          facturadoTotal: 20,
        },
        {
          ...base,
          numero: 'UN-CENTAVO-FISCAL',
          cobradoTotal: 100,
          facturadoTotal: 99.99,
        },
        {
          ...base,
          numero: 'FACTURADA',
          cobradoTotal: 100,
          facturadoTotal: 100,
        },
        {
          ...base,
          numero: 'NO-FISCAL',
          cobradoTotal: 100,
          tratamientoFiscal: 'SIN_COMPROBANTE',
        },
        { ...base, numero: 'BORRADOR', estado: 'borrador', cobradoTotal: 100 },
        {
          ...base,
          numero: 'CANCELADA',
          estado: 'cancelada',
          cobradoTotal: 100,
        },
        {
          ...base,
          numero: 'OTRA-EMPRESA',
          tenantId: otroTenantId,
          cobradoTotal: 100,
        },
        {
          ...base,
          numero: 'ANTES',
          cobradoTotal: 100,
          fechaEmision: new Date('2026-10-08T02:59:59.999Z'),
        },
        {
          ...base,
          numero: 'ULTIMO-INSTANTE',
          estado: 'entregada',
          cobradoTotal: 100,
          fechaEmision: new Date('2026-10-09T02:59:59.999Z'),
        },
        {
          ...base,
          numero: 'DESPUES',
          cobradoTotal: 100,
          fechaEmision: new Date('2026-10-09T03:00:00Z'),
        },
        { ...base, numero: 'SIN-FECHA', cobradoTotal: 100, fechaEmision: null },
      ],
    });
  });
  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otroTenantId].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });
  const numeros = async (filtros = {}) =>
    (await service.pendientesFacturacion(tenantId, filtros))
      .map((o) => o.numero)
      .sort();

  it('sin filtros mantiene impagas, parciales y cobradas, sólo de la empresa y facturables', async () => {
    expect(await numeros()).toEqual([
      'ANTES',
      'DESPUES',
      'EXCEDENTE',
      'IMPAGA',
      'PAGADA',
      'PARCIAL-FISCAL',
      'SIN-FECHA',
      'ULTIMO-INSTANTE',
      'UN-CENTAVO',
    ]);
  });
  it('sólo completamente cobradas y sin importe facturado, sin redondear un centavo de deuda', async () => {
    expect(await numeros({ cobro: 'cobradas_sin_facturar' })).toEqual([
      'ANTES',
      'DESPUES',
      'EXCEDENTE',
      'PAGADA',
      'SIN-FECHA',
      'ULTIMO-INSTANTE',
    ]);
  });
  it('combina cobro y emisión, incluye ambos días completos en la zona del taller', async () => {
    const filas = await service.pendientesFacturacion(tenantId, {
      cobro: 'cobradas_sin_facturar',
      emisionDesde: '2026-10-08',
      emisionHasta: '2026-10-08',
    });
    expect(filas.map((o) => o.numero).sort()).toEqual([
      'EXCEDENTE',
      'PAGADA',
      'ULTIMO-INSTANTE',
    ]);
    expect(filas.find((o) => o.numero === 'PAGADA')?.fechaEmision).toBe(
      '2026-10-08T03:00:00.000Z',
    );
  });
  it('permite un solo extremo de fechas y excluye fecha desconocida sólo cuando se filtra', async () => {
    expect(await numeros({ emisionHasta: '2026-10-07' })).toEqual(['ANTES']);
    expect(await numeros({ emisionDesde: '2026-10-09' })).toEqual(['DESPUES']);
  });
  it('rechaza fechas imposibles y rangos invertidos', async () => {
    await expect(numeros({ emisionDesde: '2026-02-30' })).rejects.toThrow(
      'rango válido',
    );
    await expect(
      numeros({ emisionDesde: '2026-10-09', emisionHasta: '2026-10-08' }),
    ).rejects.toThrow('rango válido');
  });
  it('aplica el filtro fiscal antes del límite de 500', async () => {
    await prisma.ordenTrabajo.createMany({
      data: Array.from({ length: 500 }, (_, i) => ({
        tenantId,
        numero: `HISTORICA-${i}`,
        total: 100,
        facturadoTotal: 100,
        cobradoTotal: 100,
        estado: 'finalizada',
        fechaFinalizada: new Date('2026-01-01T12:00:00Z'),
      })),
    });
    expect(await numeros()).toContain('PAGADA');
    expect(await numeros({ cobro: 'cobradas_sin_facturar' })).toContain(
      'PAGADA',
    );
  });
  it('también aplica cobro y fechas antes del límite, aunque haya 500 pendientes anteriores', async () => {
    await prisma.ordenTrabajo.createMany({
      data: Array.from({ length: 500 }, (_, i) => ({
        tenantId,
        numero: `IMPAGA-ANTERIOR-${i}`,
        total: 100,
        estado: 'finalizada',
        fechaEmision: new Date('2026-01-01T12:00:00Z'),
        fechaFinalizada: new Date('2026-01-01T12:00:00Z'),
      })),
    });
    expect(await numeros({ cobro: 'cobradas_sin_facturar' })).toContain(
      'PAGADA',
    );
    expect(await numeros({ emisionDesde: '2026-10-08' })).toContain('PAGADA');
  });
});
