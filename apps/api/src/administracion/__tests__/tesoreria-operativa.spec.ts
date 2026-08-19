import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { NaturalezaEgreso, RolSistema } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import type { CurrentAuth } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { CobrosService } from '../cobros.service';
import type { FacturacionOrdenesService } from '../facturacion-ordenes.service';
import type { RecibosService } from '../recibos.service';
import { TesoreriaService } from '../tesoreria.service';
import type { NotificacionesCobrosService } from '../../integraciones/notificaciones/notificaciones-cobros.service';
import { EgresosService } from '../../egresos/egresos.service';
import type { DatosEmpresaService } from '../../tenants/datos-empresa.service';
import type { ArchivosService } from '../../archivos/archivos.service';
import type { OrdenPagoPdfService } from '../../egresos/orden-pago-pdf.service';

describe('Tesorería operativa', () => {
  const prisma = new PrismaService();
  const tenantId = randomUUID();
  const auth: CurrentAuth = {
    userId: randomUUID(),
    sessionId: randomUUID(),
    tenantId,
    membershipId: randomUUID(),
    role: RolSistema.ADMINISTRADOR,
    email: 'tesoreria@test.local',
  };
  const cobrosMock = {
    barrerVencidos: jest.fn().mockResolvedValue(0),
  } as unknown as CobrosService;
  const tesoreria = new TesoreriaService(prisma, cobrosMock);
  const cobros = new CobrosService(
    prisma,
    {
      aplicarCobroComercial: jest.fn().mockResolvedValue([]),
      matchearCobro: jest.fn().mockResolvedValue(undefined),
      revertirCobro: jest.fn().mockResolvedValue(undefined),
    } as unknown as FacturacionOrdenesService,
    {} as RecibosService,
    {} as NotificacionesCobrosService,
  );
  const egresos = new EgresosService(
    prisma,
    {} as DatosEmpresaService,
    {} as ArchivosService,
    {} as OrdenPagoPdfService,
  );

  const cuenta = async (saldoInicial = 0, moneda = 'ARS') => {
    const creada = await tesoreria.crearCuenta(auth, {
      tipo: 'banco',
      nombre: `Cuenta ${randomUUID()}`,
      moneda,
      saldoInicial,
    });
    return creada.id;
  };

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.tenant.create({
      data: {
        id: tenantId,
        nombre: 'Tenant de pruebas de Tesorería',
        slug: `tesoreria-${tenantId}`,
      },
    });
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('crea una cuenta con apertura y auditoría append-only', async () => {
    const id = await cuenta(1250);
    await tesoreria.editarCuenta(auth, id, {
      nombre: 'Cuenta de apertura auditada',
    });
    const [actual, movimientos, eventos] = await Promise.all([
      prisma.cuentaFondos.findUniqueOrThrow({ where: { id } }),
      prisma.movimientoFondos.findMany({ where: { cuentaId: id } }),
      prisma.cuentaFondosEvento.findMany({
        where: { cuentaId: id },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    expect(Number(actual.saldo)).toBe(1250);
    expect(actual.nombre).toBe('Cuenta de apertura auditada');
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]).toMatchObject({
      origenTipo: 'saldo_inicial',
      estadoConciliacion: 'conciliado',
      actorNombre: 'tesoreria@test.local',
    });
    expect(eventos).toHaveLength(2);
    expect(eventos[0]).toMatchObject({
      tipo: 'creada',
      actorNombre: 'tesoreria@test.local',
    });
    expect(eventos[1]).toMatchObject({
      tipo: 'editada',
      actorNombre: 'tesoreria@test.local',
    });
  });

  it('transfiere una sola vez ante reintentos y registra las dos puntas', async () => {
    const desdeCuentaId = await cuenta(1000);
    const haciaCuentaId = await cuenta();
    const idempotencyKey = randomUUID();
    const payload = {
      desdeCuentaId,
      haciaCuentaId,
      monto: 250,
      idempotencyKey,
      referencia: 'TRX-TEST',
    };

    const primera = await tesoreria.transferir(auth, payload);
    const segunda = await tesoreria.transferir(auth, payload);
    const [desde, hacia, movimientos] = await Promise.all([
      prisma.cuentaFondos.findUniqueOrThrow({ where: { id: desdeCuentaId } }),
      prisma.cuentaFondos.findUniqueOrThrow({ where: { id: haciaCuentaId } }),
      prisma.movimientoFondos.findMany({
        where: { operacionId: primera.operacionId! },
      }),
    ]);

    expect(segunda.operacionId).toBe(primera.operacionId);
    expect(Number(desde.saldo)).toBe(750);
    expect(Number(hacia.saldo)).toBe(250);
    expect(movimientos).toHaveLength(2);
    expect(
      movimientos.every((movimiento) => movimiento.referencia === 'TRX-TEST'),
    ).toBe(true);
    expect(
      movimientos.every((movimiento) => movimiento.transferenciaParId),
    ).toBe(true);
  });

  it('impide el sobregiro incluso con dos operaciones concurrentes', async () => {
    const desdeCuentaId = await cuenta(100);
    const haciaCuentaId = await cuenta();
    const resultado = await Promise.allSettled([
      tesoreria.transferir(auth, {
        desdeCuentaId,
        haciaCuentaId,
        monto: 80,
        idempotencyKey: randomUUID(),
      }),
      tesoreria.transferir(auth, {
        desdeCuentaId,
        haciaCuentaId,
        monto: 80,
        idempotencyKey: randomUUID(),
      }),
    ]);
    const [desde, hacia] = await Promise.all([
      prisma.cuentaFondos.findUniqueOrThrow({ where: { id: desdeCuentaId } }),
      prisma.cuentaFondos.findUniqueOrThrow({ where: { id: haciaCuentaId } }),
    ]);

    expect(
      resultado.filter((item) => item.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(resultado.filter((item) => item.status === 'rejected')).toHaveLength(
      1,
    );
    expect(Number(desde.saldo)).toBe(20);
    expect(Number(hacia.saldo)).toBe(80);
  });

  it('registra transferencias entre monedas sin mezclar importes', async () => {
    const desdeCuentaId = await cuenta(500, 'ARS');
    const haciaCuentaId = await cuenta(0, 'USD');
    const resultado = await tesoreria.transferir(auth, {
      desdeCuentaId,
      haciaCuentaId,
      monto: 120,
      montoDestino: 0.1,
      idempotencyKey: randomUUID(),
    });
    const movimientos = await prisma.movimientoFondos.findMany({
      where: { operacionId: resultado.operacionId! },
      orderBy: { tipo: 'asc' },
    });
    const desde = await prisma.cuentaFondos.findUniqueOrThrow({
      where: { id: desdeCuentaId },
    });
    const hacia = await prisma.cuentaFondos.findUniqueOrThrow({
      where: { id: haciaCuentaId },
    });

    expect(Number(desde.saldo)).toBe(380);
    expect(Number(hacia.saldo)).toBe(0.1);
    expect(movimientos.map((item) => Number(item.monto)).sort()).toEqual([
      0.1, 120,
    ]);
    expect(
      movimientos.every((item) => Number(item.tipoCambio) === 0.0008),
    ).toBe(true);
  });

  it('recalcula el saldo corrido cuando se carga un movimiento retroactivo', async () => {
    const cuentaId = await cuenta();
    await tesoreria.ajustar(auth, cuentaId, {
      tipo: 'entrada',
      monto: 100,
      fecha: '2026-01-02',
      concepto: 'Segundo movimiento',
    });
    await tesoreria.ajustar(auth, cuentaId, {
      tipo: 'entrada',
      monto: 50,
      fecha: '2026-01-01',
      concepto: 'Primer movimiento',
    });
    const movimientos = await prisma.movimientoFondos.findMany({
      where: { cuentaId },
      orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    });
    const actual = await prisma.cuentaFondos.findUniqueOrThrow({
      where: { id: cuentaId },
    });

    expect(movimientos.map((item) => Number(item.saldoPosterior))).toEqual([
      50, 150,
    ]);
    expect(Number(actual.saldo)).toBe(150);
  });

  it('congela quién y cuándo concilió un movimiento', async () => {
    const cuentaId = await cuenta();
    const ajuste = await tesoreria.ajustar(auth, cuentaId, {
      tipo: 'entrada',
      monto: 10,
      fecha: '2026-02-01',
      concepto: 'Diferencia bancaria',
    });
    await tesoreria.conciliar(auth, cuentaId, ajuste.id, {
      estado: 'conciliado',
      notas: 'Verificado contra extracto',
    });
    const movimiento = await prisma.movimientoFondos.findUniqueOrThrow({
      where: { id: ajuste.id },
    });

    expect(movimiento.estadoConciliacion).toBe('conciliado');
    expect(movimiento.conciliadoEl).toBeInstanceOf(Date);
    expect(movimiento.conciliadoPorNombre).toBe('tesoreria@test.local');
    expect(movimiento.notas).toBe('Verificado contra extracto');
  });

  it('filtra días completos en la zona del tenant, no en UTC', async () => {
    const cuentaId = await cuenta();
    await prisma.movimientoFondos.createMany({
      data: [
        {
          tenantId,
          cuentaId,
          fecha: new Date('2026-06-02T02:30:00Z'),
          tipo: 'entrada',
          monto: 10,
          concepto: 'Todavía es 1 de junio en Argentina',
          origenTipo: 'ajuste_manual',
          saldoPosterior: 10,
        },
        {
          tenantId,
          cuentaId,
          fecha: new Date('2026-06-02T03:30:00Z'),
          tipo: 'entrada',
          monto: 20,
          concepto: 'Ya es 2 de junio en Argentina',
          origenTipo: 'ajuste_manual',
          saldoPosterior: 30,
        },
      ],
    });

    const pagina = await tesoreria.movimientos(auth, cuentaId, {
      desde: '2026-06-01',
      hasta: '2026-06-01',
    });

    expect(pagina.items).toHaveLength(1);
    expect(pagina.items[0].concepto).toContain('Todavía');
  });

  it('acredita el disponible real una sola vez aunque haya concurrencia', async () => {
    const cuentaId = await cuenta();
    const metodo = await prisma.metodoPago.create({
      data: {
        tenantId,
        codigo: `tarjeta-${randomUUID()}`,
        nombre: 'Tarjeta de prueba',
        tipo: 'tarjeta_credito',
        plazoAcreditacionDias: 3,
      },
    });
    const cobro = await prisma.cobro.create({
      data: {
        tenantId,
        fecha: new Date('2026-03-01T12:00:00Z'),
        metodoPagoId: metodo.id,
        cuentaDestinoId: cuentaId,
        montoBruto: 1000,
        comisionPctAplicada: 10,
        comisionMonto: 100,
        comisionIvaMonto: 21,
        netoAcreditado: 879,
        retencionesTotal: 79,
        disponibleReal: 800,
        estadoAcreditacion: 'pendiente',
        moneda: 'ARS',
      },
    });

    const resultado = await Promise.allSettled([
      cobros.acreditar(auth, cobro.id),
      cobros.acreditar(auth, cobro.id),
    ]);
    const actual = await prisma.cuentaFondos.findUniqueOrThrow({
      where: { id: cuentaId },
    });
    const movimientos = await prisma.movimientoFondos.findMany({
      where: { cobroId: cobro.id, tipo: 'entrada' },
    });

    expect(
      resultado.filter((item) => item.status === 'fulfilled'),
    ).toHaveLength(2);
    expect(Number(actual.saldo)).toBe(800);
    expect(movimientos).toHaveLength(1);
    expect(Number(movimientos[0].monto)).toBe(800);
  });

  it('mantiene el cheque sin cuenta, permite corregir hitos y completa su ciclo', async () => {
    const cuentaId = await cuenta();
    const metodo = await prisma.metodoPago.create({
      data: {
        tenantId,
        codigo: `cheque-${randomUUID()}`,
        nombre: 'Cheque de prueba',
        tipo: 'cheque_echeq',
      },
    });
    const recibos = {
      numerar: jest.fn().mockResolvedValue(`REC-${randomUUID()}`),
      emitirEnlace: jest.fn().mockResolvedValue(undefined),
      materializarPdfEnSegundoPlano: jest.fn(),
    } as unknown as RecibosService;
    const avisos = {
      avisar: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificacionesCobrosService;
    const servicioCobros = new CobrosService(
      prisma,
      {
        aplicarCobroComercial: jest.fn().mockResolvedValue([]),
        matchearCobro: jest.fn().mockResolvedValue(undefined),
      } as unknown as FacturacionOrdenesService,
      recibos,
      avisos,
    );
    const numeroValor = `VAL-${randomUUID()}`;
    const creado = await servicioCobros.create(auth, {
      fecha: '2026-04-01',
      metodoPagoId: metodo.id,
      montoBruto: 500,
      comisionPctAplicada: 0,
      valor: {
        origen: 'tercero',
        formato: 'echeq',
        numero: numeroValor,
        banco: 'Banco de prueba',
        fechaPago: '2026-04-10',
      },
    });
    await expect(
      servicioCobros.create(auth, {
        fecha: '2026-04-01',
        metodoPagoId: metodo.id,
        montoBruto: 500,
        comisionPctAplicada: 0,
        valor: {
          origen: 'tercero',
          formato: 'echeq',
          numero: numeroValor.toLowerCase(),
          banco: '  Banco   de prueba ',
          fechaPago: '2026-04-10',
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    const cobro = await prisma.cobro.findUniqueOrThrow({
      where: { id: creado.id },
    });
    const valor = await prisma.valor.findFirstOrThrow({
      where: { cobroId: cobro.id },
    });

    expect(cobro.cuentaDestinoId).toBeNull();
    expect(creado.cuentaDestinoNombre).toBeNull();

    await tesoreria.depositarValor(auth, valor.id, {
      cuentaDestinoId: cuentaId,
      fecha: '2026-04-02',
    });
    await tesoreria.revertirDepositoValor(auth, valor.id, {
      fecha: '2026-04-02',
      motivo: 'Cuenta seleccionada por error',
    });
    const devueltoACartera = await prisma.valor.findUniqueOrThrow({
      where: { id: valor.id },
    });
    expect(devueltoACartera.estado).toBe('cartera');
    expect(devueltoACartera.cuentaDepositoId).toBeNull();

    await tesoreria.depositarValor(auth, valor.id, {
      cuentaDestinoId: cuentaId,
      fecha: '2026-04-02',
    });
    await tesoreria.acreditarValor(auth, valor.id, {
      fecha: '2026-04-03',
      idempotencyKey: randomUUID(),
    });
    await tesoreria.revertirAcreditacionValor(auth, valor.id, {
      fecha: '2026-04-03',
      motivo: 'Confirmación bancaria anticipada',
      idempotencyKey: randomUUID(),
    });
    const [devueltoADepositado, cuentaCorregida] = await Promise.all([
      prisma.valor.findUniqueOrThrow({ where: { id: valor.id } }),
      prisma.cuentaFondos.findUniqueOrThrow({ where: { id: cuentaId } }),
    ]);
    expect(devueltoADepositado.estado).toBe('depositado');
    expect(Number(cuentaCorregida.saldo)).toBe(0);

    await tesoreria.acreditarValor(auth, valor.id, {
      fecha: '2026-04-03',
      idempotencyKey: randomUUID(),
    });
    await tesoreria.rechazarValor(auth, valor.id, {
      fecha: '2026-04-04',
      motivo: 'Orden de no pagar',
      idempotencyKey: randomUUID(),
    });
    const [cuentaActual, cobroDepositado, valorActual, eventos, movimientos] =
      await Promise.all([
        prisma.cuentaFondos.findUniqueOrThrow({ where: { id: cuentaId } }),
        prisma.cobro.findUniqueOrThrow({ where: { id: cobro.id } }),
        prisma.valor.findUniqueOrThrow({ where: { id: valor.id } }),
        prisma.valorEvento.findMany({ where: { valorId: valor.id } }),
        prisma.movimientoFondos.findMany({ where: { valorId: valor.id } }),
      ]);

    expect(Number(cuentaActual.saldo)).toBe(0);
    expect(cobroDepositado.cuentaDestinoId).toBe(cuentaId);
    expect(valorActual.estado).toBe('rechazado');
    expect(valorActual.motivoRechazo).toBe('Orden de no pagar');
    expect(eventos.map((evento) => evento.tipo)).toEqual([
      'recibido',
      'depositado',
      'deposito_revertido',
      'depositado',
      'acreditado',
      'acreditacion_revertida',
      'acreditado',
      'rechazado',
    ]);
    expect(movimientos.map((movimiento) => movimiento.tipo).sort()).toEqual([
      'entrada',
      'entrada',
      'salida',
      'salida',
    ]);
  });

  it('no permite desactivar una cuenta con saldo ni leer cuentas de otro tenant', async () => {
    const cuentaId = await cuenta(100);
    await expect(
      tesoreria.editarCuenta(auth, cuentaId, { activo: false }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const otroTenant = await prisma.tenant.create({
      data: {
        nombre: 'Otro tenant de prueba',
        slug: `otro-${randomUUID()}`,
      },
    });
    const ajena = await prisma.cuentaFondos.create({
      data: {
        tenantId: otroTenant.id,
        tipo: 'caja',
        nombre: 'Caja ajena',
      },
    });
    await expect(tesoreria.movimientos(auth, ajena.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await prisma.tenant.delete({ where: { id: otroTenant.id } });
  });

  it('calcula comisión, IVA y retenciones sin confundir neto con disponible', () => {
    expect(
      cobros.calcularCifras({
        montoBruto: 1000,
        comisionPctAplicada: 10,
        ivaComisionPct: 21,
        retencionesTotal: 79,
      }),
    ).toEqual({
      comisionMonto: 100,
      comisionIvaMonto: 21,
      netoAcreditado: 879,
      disponibleReal: 800,
    });
  });

  it('hace idempotente una orden de pago incluso ante doble envío', async () => {
    const cuentaId = await cuenta(1000);
    const metodo = await prisma.metodoPago.create({
      data: {
        tenantId,
        codigo: `pago-${randomUUID()}`,
        nombre: 'Transferencia de egreso',
        tipo: 'transferencia',
      },
    });
    const categoria = await prisma.categoriaEgreso.create({
      data: {
        tenantId,
        codigo: `categoria-${randomUUID()}`,
        nombre: 'Categoría de prueba',
        naturaleza: NaturalezaEgreso.GASTO_ESTRUCTURA,
      },
    });
    const egreso = await prisma.egreso.create({
      data: {
        tenantId,
        numero: `EGR-${randomUUID()}`,
        descripcion: 'Factura a pagar',
        categoriaEgresoId: categoria.id,
        beneficiarioNombre: 'Proveedor de prueba',
        fechaCompetencia: new Date('2026-05-01T00:00:00Z'),
        fechaVencimiento: new Date('2026-05-10T00:00:00Z'),
        moneda: 'ARS',
        neto: 300,
        total: 300,
      },
    });
    const dto = {
      idempotencyKey: randomUUID(),
      metodoPagoId: metodo.id,
      cuentaOrigenId: cuentaId,
      imputaciones: [{ egresoId: egreso.id, monto: 300 }],
    };

    const [primero, segundo] = await Promise.all([
      egresos.registrarPago(auth, dto),
      egresos.registrarPago(auth, dto),
    ]);
    const [cuentaActual, egresoActual, pagos, movimientos] = await Promise.all([
      prisma.cuentaFondos.findUniqueOrThrow({ where: { id: cuentaId } }),
      prisma.egreso.findUniqueOrThrow({ where: { id: egreso.id } }),
      prisma.pago.findMany({ where: { idempotencyKey: dto.idempotencyKey } }),
      prisma.movimientoFondos.findMany({
        where: {
          pagoId: { not: null },
          cuentaId,
          concepto: { contains: egreso.numero },
        },
      }),
    ]);

    expect(segundo.id).toBe(primero.id);
    expect(pagos).toHaveLength(1);
    expect(movimientos).toHaveLength(1);
    expect(Number(cuentaActual.saldo)).toBe(700);
    expect(Number(egresoActual.pagadoTotal)).toBe(300);
    expect(egresoActual.estado).toBe('pagado');
  });
});
