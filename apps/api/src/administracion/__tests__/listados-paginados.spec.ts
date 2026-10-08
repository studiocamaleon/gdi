import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FacturacionOrdenesService } from '../facturacion-ordenes.service';
import { ComprobantesService } from '../comprobantes.service';
import {
  FacturacionPaginaDto,
  ComprobantesPaginaDto,
} from '../dto/listado-fiscal.dto';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';

describe('Listados fiscales paginados — datos fuera de los límites antiguos', () => {
  const prisma = new PrismaClient();
  const ordenes = new FacturacionOrdenesService(
    prisma as unknown as PrismaService,
  );
  const comprobantes: ComprobantesService = Object.assign(
    Object.create(ComprobantesService.prototype),
    { prisma },
  ) as ComprobantesService;
  let tenantId: string;
  let ajeno: string;
  const auth = () => ({ tenantId }) as CurrentAuth;
  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'))
      throw Error('Sólo test');
    tenantId = (
      await prisma.tenant.create({
        data: { nombre: 'Empresa ficticia paginada', slug: randomUUID() },
      })
    ).id;
    ajeno = (
      await prisma.tenant.create({
        data: { nombre: 'Otra empresa ficticia', slug: randomUUID() },
      })
    ).id;
    const cliente = await prisma.cliente.create({
      data: {
        tenantId,
        nombre: 'Árbol ficticio',
        paisCodigo: 'AR',
        telefonoCodigo: '54',
        telefonoNumero: '92966456789',
        cuit: '20123456789',
      },
    });
    await prisma.ordenTrabajo.createMany({
      data: Array.from({ length: 502 }, (_, i) => ({
        tenantId,
        clienteId: cliente.id,
        numero: `OT-PAG-${String(i).padStart(4, '0')}`,
        estado: 'finalizada',
        total: 100,
        fechaFinalizada: new Date(2026, 0, 1, 0, 0, i),
      })),
    });
    await prisma.ordenTrabajo.create({
      data: {
        tenantId: ajeno,
        numero: 'OT-AJENA',
        estado: 'finalizada',
        total: 999,
      },
    });
    const cf = await prisma.configuracionFiscal.create({
      data: { tenantId, razonSocial: 'Emisor ficticio', cuit: '30123456789' },
    });
    const pv = await prisma.puntoVenta.create({
      data: {
        tenantId,
        configuracionFiscalId: cf.id,
        numero: 2,
        nombre: 'Punto ficticio',
      },
    });
    const viejo = new Date('2026-01-01T00:00:00Z');
    await prisma.comprobante.createMany({
      data: Array.from({ length: 202 }, (_, i) => ({
        tenantId,
        puntoVentaId: pv.id,
        tipo: i === 201 ? 'nota_credito' : 'factura',
        letra: 'A',
        numero: i + 1,
        fecha: viejo,
        createdAt: new Date(viejo.getTime() + i * 1000),
        receptorSnapshot: {
          nombre: i === 0 ? 'Único histórico' : 'Cliente ficticio',
        },
        itemsJson: [],
        ivaPorAlicuota: [],
        netoGravado: 100,
        total: 100,
        saldoPendiente: 100,
        estado: 'emitido',
        cae: i === 0 ? 'CAE-ficticio' : null,
        idempotencyKey: randomUUID(),
      })),
    });
  }, 30000);
  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, ajeno].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });
  it('recorre más de 500 OT sin repetidos, con totales globales y orden estable', async () => {
    const ids: string[] = [];
    for (let pagina = 1; pagina <= 21; pagina++) {
      const r = await ordenes.pendientesFacturacionPagina(tenantId, { pagina });
      expect(r.total).toBe(502);
      expect(r.resumen.importe).toBe(50200);
      expect(r.resumen.clientes).toBe(1);
      expect(r.items.length).toBe(pagina === 21 ? 2 : 25);
      ids.push(...r.items.map((o) => o.ordenId));
    }
    expect(new Set(ids).size).toBe(502);
    expect(
      (
        await ordenes.pendientesFacturacionPagina(tenantId, {
          q: 'OT-PAG-0501',
        })
      ).items,
    ).toHaveLength(1);
    expect(
      (await ordenes.pendientesFacturacionPagina(tenantId, { q: 'arbol' }))
        .total,
    ).toBe(502);
    expect(
      (await ordenes.pendientesFacturacionPagina(tenantId, { q: 'AJENA' }))
        .total,
    ).toBe(0);
  });
  it('busca comprobantes anteriores al límite 200, con acentos y número completo', async () => {
    const r = await comprobantes.listarPagina(auth(), { q: 'unico historico' });
    expect(r.total).toBe(1);
    expect(r.items[0].numero).toBe(1);
    expect(
      (await comprobantes.listarPagina(auth(), { q: 'A 0002-00000001' })).total,
    ).toBe(1);
    expect(
      (
        await comprobantes.listarPagina({ tenantId: ajeno } as CurrentAuth, {
          q: 'unico',
        })
      ).total,
    ).toBe(0);
  });
  it('pagina comprobantes y mantiene agregados completos, incluso con fecha empatada', async () => {
    const ids: string[] = [];
    for (let pagina = 1; pagina <= 9; pagina++) {
      const r = await comprobantes.listarPagina(auth(), { pagina });
      expect(r.total).toBe(202);
      expect(r.resumen.facturado).toBe(20000);
      expect(r.resumen.pendiente).toBe(20100);
      ids.push(...r.items.map((c) => c.id));
    }
    expect(new Set(ids).size).toBe(202);
  });
  it('separa Con CAE y Sin CAE antes de paginar y conserva vacíos y páginas fuera de rango', async () => {
    expect(
      (await comprobantes.listarPagina(auth(), { estado: 'cae' })).total,
    ).toBe(1);
    expect(
      (await comprobantes.listarPagina(auth(), { estado: 'emitido' })).total,
    ).toBe(201);
    const vacio = await comprobantes.listarPagina(auth(), {
      q: "%' OR 1=1 --",
    });
    expect(vacio.total).toBe(0);
    expect(vacio.items).toEqual([]);
    expect(vacio.pagina).toBe(1);
    expect(
      (await comprobantes.listarPagina(auth(), { pagina: 999 })).pagina,
    ).toBe(9);
    expect(
      (await ordenes.pendientesFacturacionPagina(tenantId, { pagina: 999 }))
        .pagina,
    ).toBe(21);
    expect(
      (await comprobantes.listarPagina(auth(), { tipo: 'nota_credito' }))
        .resumen.facturado,
    ).toBe(-100);
  });
  it('rechaza páginas inválidas, texto desmedido y filtros desconocidos', async () => {
    for (const Clase of [FacturacionPaginaDto, ComprobantesPaginaDto]) {
      for (const pagina of ['0', '-1', '1.5', 'abc', '1000001'])
        expect(
          (await validate(plainToInstance(Clase, { pagina }))).length,
        ).toBeGreaterThan(0);
      expect(
        await validate(plainToInstance(Clase, { pagina: '2' })),
      ).toHaveLength(0);
      expect(
        (await validate(plainToInstance(Clase, { q: 'x'.repeat(201) }))).length,
      ).toBeGreaterThan(0);
    }
    expect(
      (
        await validate(
          plainToInstance(ComprobantesPaginaDto, { estado: 'inventado' }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
