import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FacturacionOrdenesService } from '../facturacion-ordenes.service';
import { EntregaService } from '../../ordenes-trabajo/entrega.service';
import { CobrosService } from '../cobros.service';
import { MetodosPagoService } from '../metodos-pago.service';
import {
  validarReglasRetencion,
  validarRetenciones,
} from '../retenciones-validacion';
import type { CurrentAuth } from '../../auth/auth.types';
import type { AcreditarCobroDto } from '../dto/cobro.dto';

describe('Retenciones y liquidación confirmada (base exclusiva de pruebas)', () => {
  const prisma = new PrismaService();
  const tenantId = randomUUID();
  const ajeno = randomUUID();
  const auth: CurrentAuth = {
    tenantId,
    userId: randomUUID(),
    sessionId: randomUUID(),
    membershipId: randomUUID(),
    role: RolSistema.ADMINISTRADOR,
    email: 'operador@example.invalid',
  };
  const capacidades = {
    puedeOperar: jest.fn().mockResolvedValue(true),
    exigirOperacionTx: jest.fn().mockResolvedValue(undefined),
    exigir: jest.fn().mockResolvedValue(undefined),
    incluida: jest.fn().mockResolvedValue(true),
  };
  const facturas = {
    aplicarCobroComercial: jest.fn().mockResolvedValue([]),
    matchearCobro: jest.fn(),
  };
  const recibos = {
    numerar: jest.fn().mockImplementation(() => `REC-TEST-${randomUUID()}`),
    emitirEnlace: jest.fn(),
    materializarPdfEnSegundoPlano: jest.fn(),
  };
  // Servicios externos reemplazados: nunca envía correos, PDF, ARCA ni WhatsApp.
  const cobros = new CobrosService(
    prisma,
    facturas as never,
    recibos as never,
    { avisar: jest.fn() } as never,
    { reconciliarOrden: jest.fn() } as never,
    capacidades as never,
  );
  const metodos = new MetodosPagoService(prisma, capacidades as never);
  let cuentaId: string;
  let metodoId: string;
  const regla = {
    id: randomUUID(),
    regimen: 'SIRTAC',
    jurisdiccion: 'Provincia de prueba',
    agente: 'procesador' as const,
    alicuota: 3.5,
    baseCalculo: 'neto_liquidacion' as const,
  };
  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('_test'))
      throw new Error('Sólo base de pruebas.');
    await prisma.$connect();
    for (const id of [tenantId, ajeno])
      await prisma.tenant.create({
        data: { id, nombre: 'Empresa ficticia retenciones', slug: `ret-${id}` },
      });
    await prisma.user.create({
      data: { id: auth.userId, email: `ret-${auth.userId}@example.invalid` },
    });
    await prisma.membership.create({
      data: {
        id: auth.membershipId,
        userId: auth.userId,
        tenantId,
        rol: 'ADMINISTRADOR',
      },
    });
    cuentaId = (
      await prisma.cuentaFondos.create({
        data: {
          tenantId,
          nombre: 'Banco ficticio',
          tipo: 'banco',
          moneda: 'ARS',
        },
      })
    ).id;
    metodoId = (
      await metodos.create(auth, {
        nombre: 'Débito ficticio',
        tipo: 'tarjeta_debito',
        comisionPct: 1,
        ivaComisionPct: 21,
        plazoAcreditacionDias: 1,
        sufreRetencion: true,
        cuentaDestinoId: cuentaId,
        retencionesConfig: [regla],
      })
    ).id;
  });
  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, ajeno] } },
    });
    await prisma.user.delete({ where: { id: auth.userId } });
    await prisma.$disconnect();
  });
  const nuevo = () =>
    cobros.create(auth, {
      fecha: '2026-09-25',
      metodoPagoId: metodoId,
      cuentaDestinoId: cuentaId,
      montoBruto: 100000,
      comisionPctAplicada: 1,
    });
  const liquidacion: AcreditarCobroDto = {
    fecha: '2026-09-28',
    comisionMonto: 1000,
    comisionIvaMonto: 210,
    referencia: 'LIQ-FICTICIA',
    retenciones: [{ ...regla, base: 98790, monto: 3458 }],
  };

  it('acredita un lote con la misma LIQ y reintenta sin duplicar fondos', async () => {
    const creados = await Promise.all([nuevo(), nuevo()]);
    const payload = { cobros: creados.map((c) => ({ ...liquidacion, id: c.id })) };
    await Promise.all([cobros.acreditarLote(auth, payload), cobros.acreditarLote(auth, payload)]);
    const actuales = await prisma.cobro.findMany({ where: { id: { in: creados.map((c) => c.id) } }, include: { movimientos: true, retenciones: true } });
    expect(actuales).toHaveLength(2);
    for (const c of actuales) {
      expect(c.estadoAcreditacion).toBe('acreditado');
      expect(c.referenciaAcreditacion).toBe('LIQ-FICTICIA');
      expect(Number(c.montoBruto)).toBe(100000);
      expect(c.movimientos).toHaveLength(1);
      expect(Number(c.movimientos[0].monto)).toBe(95332);
      expect(c.retenciones[0].estado).toBe('confirmada');
    }
  });
  it('revierte todo el lote si un cobro falla y rechaza IDs ajenos o repetidos', async () => {
    const creados = (await Promise.all([nuevo(), nuevo()])).sort((a, b) => a.id.localeCompare(b.id));
    await expect(cobros.acreditarLote(auth, { cobros: creados.map((c, i) => ({ ...liquidacion, id: c.id, comisionMonto: i === 1 ? 100001 : 1000 })) })).rejects.toThrow(BadRequestException);
    for (const c of creados) {
      expect((await cobros.findOne(auth, c.id)).estadoAcreditacion).toBe('pendiente');
      expect(await prisma.movimientoFondos.count({ where: { cobroId: c.id } })).toBe(0);
    }
    await expect(cobros.acreditarLote(auth, { cobros: [{ ...liquidacion, id: creados[0].id }, { ...liquidacion, id: randomUUID() }] })).rejects.toThrow('no está disponible');
    await expect(cobros.acreditarLote(auth, { cobros: [{ ...liquidacion, id: creados[0].id }, { ...liquidacion, id: creados[0].id }] })).rejects.toThrow('diferentes');
    await expect(cobros.acreditarLote({ ...auth, tenantId: ajeno }, { cobros: [{ ...liquidacion, id: creados[0].id }] })).rejects.toThrow(ForbiddenException);
    await prisma.membership.update({ where: { id: auth.membershipId }, data: { cuentasRestringidas: true, cuentasOperablesIds: [cuentaId] } });
    try {
      await expect(cobros.acreditarLote(auth, { cobros: [{ ...liquidacion, id: creados[0].id }] })).rejects.toThrow(ForbiddenException);
    } finally {
      await prisma.membership.update({ where: { id: auth.membershipId }, data: { cuentasRestringidas: false } });
    }
  });
  it('no mezcla una acreditación previa con otra LIQ y valida la fecha común', async () => {
    const c = await nuevo();
    await cobros.acreditar(auth, c.id, liquidacion);
    await expect(cobros.acreditarLote(auth, { cobros: [{ ...liquidacion, id: c.id, referencia: 'OTRA-LIQ' }] })).rejects.toThrow('otra liquidación');
    await expect(cobros.acreditarLote(auth, { cobros: [{ ...liquidacion, id: c.id, fecha: '2099-01-01' }] })).rejects.toThrow('no futura');
  });

  it('el vendedor cobra y entrega con caja asignada, incluso si la confirmación tarda más de cinco segundos', async () => {
    const orden = await prisma.ordenTrabajo.create({ data: { tenantId, numero: 'OT-FICTICIA-ENTREGA', estado: 'finalizada', total: 100000,
      items: { create: { tenantId, codigo: 'FICTICIO', nombre: 'Trabajo ficticio', familia: 'Prueba', cantidad: 1, cantidadUnidad: 'unidad', subtotal: 100000, impuestos: 0, total: 100000 } },
    }, include: { items: true } });
    const vendedor = { ...auth, permisos: new Set(['comercial.gestionar', 'administracion.cobrar']) };
    await prisma.membership.update({ where: { id: auth.membershipId }, data: { cuentasRestringidas: true, cuentasOperablesIds: [cuentaId] } });
    const cobrosVendedor = new CobrosService(prisma, new FacturacionOrdenesService(prisma), recibos as never, { avisar: jest.fn() } as never, { reconciliarOrden: jest.fn() } as never, capacidades as never);
    const entregas = new EntregaService(prisma, cobrosVendedor, { reconciliarOrden: jest.fn(async (tx) => { await tx.$queryRaw`SELECT 1 AS espera FROM pg_sleep(5.1)`; }) } as never);
    try {
      const escaneo = await entregas.escanear(vendedor, orden.numero!);
      expect(escaneo).toMatchObject({ puedeCobrar: true, puedeEntregar: true, puedeRevertir: false });
      await expect(entregas.entregar(vendedor, orden.id, { itemIds: [orden.items[0].id], cobro: {
        fecha: '2026-09-25', metodoPagoId: metodoId, cuentaDestinoId: cuentaId, montoBruto: 100000, comisionPctAplicada: 1, idempotencyKey: randomUUID(),
      } })).resolves.toMatchObject({ ordenCerrada: true, entregados: 1 });
      expect(await prisma.cobro.count({ where: { ordenId: orden.id, anuladoEl: null } })).toBe(1);
      expect((await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id: orden.id } })).estado).toBe('entregada');
    } finally {
      await prisma.membership.update({ where: { id: auth.membershipId }, data: { cuentasRestringidas: false } });
    }
  }, 15000);

  it('propone retenciones, guarda el snapshot y no acredita por tiempo transcurrido', async () => {
    const c = await nuevo();
    expect(c.disponibleReal).toBe(95332.35);
    expect(c.retenciones[0].estado).toBe('estimada');
    expect(c.fechaAcreditacionEstimada?.slice(0, 10)).toBe('2026-09-28');
    expect(await cobros.barrerVencidos(tenantId)).toBe(0);
    expect((await cobros.findOne(auth, c.id)).estadoAcreditacion).toBe(
      'pendiente',
    );
    expect(
      await prisma.movimientoFondos.count({ where: { cobroId: c.id } }),
    ).toBe(0);
  });
  it('confirma una sola entrada ante dos operadores y conserva la estimación y el bruto', async () => {
    const c = await nuevo();
    const resultados = await Promise.all([
      cobros.acreditar(auth, c.id, liquidacion),
      cobros.acreditar(auth, c.id, liquidacion),
    ]);
    expect(resultados.every((r) => r.estadoAcreditacion === 'acreditado')).toBe(
      true,
    );
    const actual = await prisma.cobro.findUniqueOrThrow({
      where: { id: c.id },
      include: { retenciones: true, movimientos: true },
    });
    expect(Number(actual.montoBruto)).toBe(100000);
    expect(Number(actual.disponibleReal)).toBe(95332);
    expect(actual.movimientos).toHaveLength(1);
    expect(Number(actual.movimientos[0].monto)).toBe(95332);
    expect(actual.liquidacionEstimada).toMatchObject({
      disponibleReal: 95332.35,
    });
    expect(actual.retenciones[0].estado).toBe('confirmada');
    expect(actual.retenciones[0].periodoFiscal).toBe('2026-09');
    expect(actual.fechaAcreditacionReal?.toISOString().slice(0, 10)).toBe(
      '2026-09-28',
    );
  });
  it('no modifica cobros anteriores al editar el método ni permite acceder a otra empresa', async () => {
    const c = await nuevo();
    await expect(
      cobros.acreditar({ ...auth, tenantId: ajeno }, c.id, liquidacion),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await metodos.update(auth, metodoId, {
      nombre: 'Débito ficticio',
      tipo: 'tarjeta_debito',
      comisionPct: 1,
      ivaComisionPct: 21,
      plazoAcreditacionDias: 1,
      sufreRetencion: true,
      cuentaDestinoId: cuentaId,
      retencionesConfig: [{ ...regla, alicuota: 2 }],
    });
    expect((await cobros.findOne(auth, c.id)).retencionesTotal).toBe(3457.65);
    expect((await nuevo()).retencionesTotal).toBe(1975.8);
  });
  it('rechaza fechas futuras, importes imposibles y retenciones duplicadas antes de mover fondos', async () => {
    const c = await nuevo();
    await expect(
      cobros.acreditar(auth, c.id, { ...liquidacion, fecha: '2099-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      cobros.acreditar(auth, c.id, { ...liquidacion, comisionMonto: 100001 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      cobros.acreditar(auth, c.id, {
        ...liquidacion,
        retenciones: [liquidacion.retenciones[0], liquidacion.retenciones[0]],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      cobros.acreditar(auth, c.id, { ...liquidacion, comisionMonto: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await prisma.movimientoFondos.count({ where: { cobroId: c.id } }),
    ).toBe(0);
  });
  it('impide vigencias superpuestas y acepta tasas sucesivas', () => {
    expect(() =>
      validarReglasRetencion([regla, { ...regla, id: randomUUID() }]),
    ).toThrow();
    expect(() =>
      validarReglasRetencion([
        { ...regla, vigenteHasta: '2026-10-31' },
        { ...regla, id: randomUUID(), vigenteDesde: '2026-11-01' },
      ]),
    ).not.toThrow();
    expect(() => validarReglasRetencion([regla], [], 'cheque_echeq')).toThrow();
    expect(() =>
      validarRetenciones([
        { regimen: 'SIRTAC', base: 100, alicuota: 3, monto: 101 },
      ]),
    ).toThrow();
  });
});
