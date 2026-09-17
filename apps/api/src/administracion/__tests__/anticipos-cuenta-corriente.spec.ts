import { PrismaClient, RolSistema } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { CurrentAuth } from '../../auth/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';
import { FacturacionOrdenesService } from '../facturacion-ordenes.service';
import { CuentaCorrienteService } from '../cuenta-corriente.service';
import { CobrosService } from '../cobros.service';
import { ImputacionesService } from '../imputaciones.service';
import type { RecibosService } from '../recibos.service';
import type { NotificacionesCobrosService } from '../../integraciones/notificaciones/notificaciones-cobros.service';
import { reconciliarAnticiposHistoricos } from '../reconciliacion-anticipos';
import { saldoComercialCobro } from '../saldo-comercial';
import { FidelizacionService } from '../../fidelizacion/fidelizacion.service';

describe('Anticipos y deuda comercial — integración aislada', () => {
  const prisma = new PrismaClient();
  const servicioPrisma = prisma as unknown as PrismaService;
  const motor = new FacturacionOrdenesService(servicioPrisma);
  const cc = new CuentaCorrienteService(servicioPrisma);
  const imputaciones = new ImputacionesService(servicioPrisma);
  const cobrosApi = new CobrosService(
    servicioPrisma,
    motor,
    {} as RecibosService,
    {} as NotificacionesCobrosService,
    new FidelizacionService(servicioPrisma),
  );
  let tenantId: string;
  let clienteId: string;
  let puntoVentaId: string;
  let metodoPagoId: string;
  let cuentaId: string;
  let auth: CurrentAuth;
  let secuencia = 0;

  beforeAll(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: { nombre: 'Test anticipos', slug: `anticipos-${randomUUID()}` },
      })
    ).id;
    auth = {
      tenantId,
      userId: randomUUID(),
      sessionId: randomUUID(),
      membershipId: randomUUID(),
      role: RolSistema.ADMINISTRADOR,
      email: 'test@test.local',
    };
    const config = await prisma.configuracionFiscal.create({
      data: {
        tenantId,
        razonSocial: 'Test',
        cuit: '30712345671',
        condicionFiscal: 'RI',
      },
    });
    puntoVentaId = (
      await prisma.puntoVenta.create({
        data: {
          tenantId,
          configuracionFiscalId: config.id,
          numero: 1,
          nombre: 'Test',
        },
      })
    ).id;
    cuentaId = (
      await prisma.cuentaFondos.create({
        data: { tenantId, tipo: 'caja', nombre: 'Caja' },
      })
    ).id;
    metodoPagoId = (
      await prisma.metodoPago.create({
        data: {
          tenantId,
          codigo: 'efectivo',
          nombre: 'Efectivo',
          tipo: 'efectivo',
        },
      })
    ).id;
  });
  beforeEach(async () => {
    clienteId = (
      await prisma.cliente.create({
        data: {
          tenantId,
          nombre: `Cliente ${randomUUID()}`,
          emailPrincipal: 'test@test.local',
          telefonoCodigo: '11',
          telefonoNumero: '55555555',
          paisCodigo: 'AR',
        },
      })
    ).id;
  });
  afterAll(async () => {
    if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  const orden = (total: number, dia = 1) =>
    prisma.ordenTrabajo.create({
      data: {
        tenantId,
        clienteId,
        numero: `OT-ANT-${++secuencia}`,
        estado: 'finalizada',
        fechaFinalizada: new Date(`2026-07-${String(dia).padStart(2, '0')}`),
        fechaVencimientoComercial: new Date(
          `2026-07-${String(dia).padStart(2, '0')}`,
        ),
        total,
        subtotal: total,
        impuestos: 0,
      },
    });
  const cobro = (monto: number, ordenId: string | null = null) =>
    prisma.cobro.create({
      data: {
        tenantId,
        clienteId,
        ordenId,
        fecha: new Date('2026-06-01'),
        metodoPagoId,
        cuentaDestinoId: cuentaId,
        montoBruto: monto,
        netoAcreditado: monto,
        disponibleReal: monto,
        estadoAcreditacion: 'acreditado',
      },
    });
  const factura = (
    total: number,
    ordenId?: string,
    tipo = 'factura',
    comprobanteOrigenId?: string,
  ) =>
    prisma.comprobante.create({
      data: {
        tenantId,
        clienteId,
        tipo,
        letra: 'B',
        puntoVentaId,
        fecha: new Date('2026-05-01'),
        receptorSnapshot: {},
        itemsJson: [],
        netoGravado: total,
        ivaPorAlicuota: [],
        total,
        saldoPendiente: tipo === 'nota_credito' ? 0 : total,
        estado: 'emitido',
        idempotencyKey: randomUUID(),
        comprobanteOrigenId,
        ...(ordenId
          ? { ordenes: { create: { tenantId, ordenId, monto: total } } }
          : {}),
      },
    });
  const cobrado = async (id: string) =>
    Number(
      (await prisma.ordenTrabajo.findUniqueOrThrow({ where: { id } }))
        .cobradoTotal,
    );
  const aplicar = (id: string) =>
    prisma.$transaction((tx) =>
      motor.aplicarAnticiposClienteAOrden(tx, tenantId, id),
    );

  it('no reutiliza un recibo pagado a una factura histórica ni muestra saldo a favor ficticio', async () => {
    await factura(500);
    const c = await cobro(500);
    await motor.matchearCobro(prisma, tenantId, c.id);
    const o = await orden(100);
    await aplicar(o.id);
    expect(await cobrado(o.id)).toBe(0);
    expect((await cc.obtener(auth, clienteId)).saldo).toBe(100);
    expect(
      (await cc.deudores(auth)).find((d) => d.clienteId === clienteId)?.total,
    ).toBe(100);
    expect((await saldoComercialCobro(prisma, tenantId, c.id)).libre).toBe(0);
  });

  it('aplica sólo el excedente real de un recibo parcialmente consumido por historia', async () => {
    await factura(150);
    const c = await cobro(200);
    await motor.matchearCobro(prisma, tenantId, c.id);
    const o = await orden(100);
    await aplicar(o.id);
    await aplicar(o.id);
    expect(await cobrado(o.id)).toBe(50);
    expect((await cc.obtener(auth, clienteId)).saldo).toBe(50);
    expect(await prisma.cobroOrden.count({ where: { cobroId: c.id } })).toBe(1);
  });

  it('una factura de la misma OT no consume dos veces el dinero', async () => {
    const o = await orden(200);
    await factura(200, o.id);
    const c = await cobro(200);
    await motor.matchearCobro(prisma, tenantId, c.id);
    await aplicar(o.id);
    expect(await cobrado(o.id)).toBe(200);
    const cuenta = await cc.obtener(auth, clienteId);
    expect(cuenta.saldo).toBe(0);
    expect(cuenta.movimientos.filter((m) => m.tipo === 'fa')).toHaveLength(0);
    expect(
      (await cc.deudores(auth)).find((d) => d.clienteId === clienteId),
    ).toBeUndefined();
  });

  it('distribuye FIFO, expone sólo la porción de cada OT y conserva el recibo original', async () => {
    const a = await orden(100, 1);
    const b = await orden(150, 2);
    const c = await cobro(300);
    await motor.aplicarCobroComercial(prisma, tenantId, c.id);
    const pagosA = await cobrosApi.findAll(auth, { ordenId: a.id });
    const pagosB = await cobrosApi.findAll(auth, { ordenId: b.id });
    expect(pagosA).toEqual([
      expect.objectContaining({
        id: c.id,
        montoBruto: 300,
        montoAplicadoOrden: 100,
        origenAplicacion: 'cuenta_corriente',
      }),
    ]);
    expect(pagosB[0]).toEqual(
      expect.objectContaining({ montoAplicadoOrden: 150 }),
    );
    expect((await saldoComercialCobro(prisma, tenantId, c.id)).libre).toBe(50);
    expect((await cc.obtener(auth, clienteId)).saldo).toBe(-50);
    expect(
      await cobrosApi.findAll(
        { ...auth, tenantId: randomUUID() },
        { ordenId: a.id },
      ),
    ).toEqual([]);
  });

  it('no usa fondos reservados a OTs para otra factura histórica (automático ni manual)', async () => {
    const o = await orden(100);
    const c = await cobro(100);
    await motor.aplicarCobroComercial(prisma, tenantId, c.id);
    const f = await factura(100);
    await motor.matchearFactura(prisma, tenantId, f.id);
    await motor.matchearCobro(prisma, tenantId, c.id);
    expect(
      Number(
        (await prisma.comprobante.findUniqueOrThrow({ where: { id: f.id } }))
          .saldoPendiente,
      ),
    ).toBe(100);
    await expect(
      imputaciones.imputar(auth, c.id, { comprobanteId: f.id, monto: 100 }),
    ).rejects.toThrow('reservado');
    expect(await cobrado(o.id)).toBe(100);
  });

  it('reserva también los cobros directos legacy sin CobroOrden', async () => {
    const o = await orden(100);
    const c = await cobro(100, o.id);
    const f = await factura(100);
    await expect(
      imputaciones.imputar(auth, c.id, { comprobanteId: f.id, monto: 100 }),
    ).rejects.toThrow('reservado');
    const pagos = await cobrosApi.findAll(auth, { ordenId: o.id });
    expect(pagos[0]).toEqual(
      expect.objectContaining({
        montoAplicadoOrden: 100,
        origenAplicacion: 'directo',
      }),
    );
  });

  it('muestra el cargo y el pago de una OT pendiente sin filas de reserva ni cargos duplicados al finalizar', async () => {
    const abierta = await orden(200);
    const fechaEmision = new Date('2026-05-20T12:00:00Z');
    await prisma.ordenTrabajo.update({
      where: { id: abierta.id },
      data: { estado: 'pendiente', fechaEmision, fechaFinalizada: null, fechaVencimientoComercial: null },
    });
    const senia = await cobro(200, abierta.id);
    await motor.aplicarCobroComercial(prisma, tenantId, senia.id);
    const terminada = await orden(100);
    await aplicar(terminada.id);
    const cuenta = await cc.obtener(auth, clienteId);
    expect(cuenta.saldo).toBe(100);
    expect(cuenta.anticipoDisponible).toBe(0);
    expect(cuenta.agingTotal).toBe(100);
    expect(await cobrado(terminada.id)).toBe(0);
    expect(cuenta.movimientos.filter((m) => m.ordenId === abierta.id)).toEqual([
      expect.objectContaining({ tipo: 'orden', fecha: '2026-05-20', debe: 200, haber: 0 }),
    ]);
    expect(cuenta.movimientos.filter((m) => m.tipo === 'reserva')).toEqual([]);
    expect(cuenta.movimientos[0].saldo).toBe(cuenta.agingTotal - cuenta.anticipoDisponible);
    expect(await prisma.cobroOrden.count({ where: { cobroId: senia.id } })).toBe(1);

    await prisma.ordenTrabajo.update({
      where: { id: abierta.id },
      data: { estado: 'finalizada', fechaFinalizada: new Date('2026-07-02') },
    });
    const cerrada = await cc.obtener(auth, clienteId);
    expect(cerrada.movimientos.filter((m) => m.ordenId === abierta.id)).toEqual([
      expect.objectContaining({ tipo: 'orden', fecha: '2026-05-20', debe: 200 }),
    ]);
    expect(cerrada.saldo).toBe(100);
    expect(cerrada.agingTotal).toBe(100);
    expect(await cobrado(abierta.id)).toBe(200);
  });

  it('anular el pago deja pendiente el cargo de la OT emitida aunque todavía no haya finalizado', async () => {
    const abierta = await orden(80);
    await prisma.ordenTrabajo.update({
      where: { id: abierta.id },
      data: { estado: 'pendiente', fechaFinalizada: null, fechaVencimientoComercial: null },
    });
    const senia = await cobro(80, abierta.id);
    await motor.recalcularCobrado(prisma, tenantId, abierta.id);
    const antes = await cc.obtener(auth, clienteId);
    expect(antes.movimientos).toHaveLength(2);
    expect(antes.saldo).toBe(0);
    await prisma.$transaction(async (tx) => {
      await tx.cobro.update({
        where: { id: senia.id },
        data: { anuladoEl: new Date(), estadoAcreditacion: 'anulado' },
      });
      await motor.revertirCobro(tx, tenantId, senia.id);
    });
    const despues = await cc.obtener(auth, clienteId);
    expect(despues.movimientos).toEqual([expect.objectContaining({ tipo: 'orden', debe: 80 })]);
    expect(despues.saldo).toBe(80);
    expect(despues.agingTotal).toBe(80);
    expect(despues.aging.a_vencer).toBe(80);
    expect(despues.sinVencimiento).toBe(80);
    expect(await prisma.cobro.count({ where: { clienteId } })).toBe(1);
  });

  it('conserva el cargo, su fecha y el pago al reabrir una OT, sin alterar el excedente del recibo general', async () => {
    const o = await orden(100);
    const c = await cobro(150);
    await motor.aplicarCobroComercial(prisma, tenantId, c.id);
    const cerrada = await cc.obtener(auth, clienteId);
    await prisma.ordenTrabajo.update({ where: { id: o.id }, data: { estado: 'produccion' } });
    const abierta = await cc.obtener(auth, clienteId);
    expect(abierta.movimientos).toEqual(cerrada.movimientos);
    expect(abierta.anticipoDisponible).toBe(50);
    expect(abierta.saldo).toBe(-50);
  });

  it('separa emisión y vencimiento, actualiza el cargo al editar y excluye borradores y canceladas', async () => {
    const o = await orden(100);
    const creadaEl = new Date('2026-01-01T12:00:00Z');
    const emitidaEl = new Date('2026-02-01T12:00:00Z');
    await prisma.ordenTrabajo.update({ where: { id: o.id }, data: {
      estado: 'borrador', createdAt: creadaEl, fechaFinalizada: null, fechaVencimientoComercial: null,
    } });
    expect((await cc.obtener(auth, clienteId)).movimientos).toEqual([]);
    await prisma.ordenTrabajo.update({ where: { id: o.id }, data: { estado: 'pendiente', fechaEmision: emitidaEl } });
    const emitida = await cc.obtener(auth, clienteId);
    expect(emitida.movimientos).toEqual([expect.objectContaining({ tipo: 'orden', fecha: '2026-02-01', debe: 100 })]);
    expect(emitida.saldo).toBe(100);
    expect(emitida.agingTotal).toBe(100);
    expect(emitida.aging.a_vencer).toBe(100);
    expect(emitida.sinVencimiento).toBe(100);
    expect(emitida.comprobantesPendientes).toBe(1);
    expect((await cc.deudores(auth)).find((d) => d.clienteId === clienteId)).toMatchObject({ total: 100, aging: { a_vencer: 100 } });

    await prisma.ordenTrabajo.update({ where: { id: o.id }, data: { total: 125, estado: 'produccion' } });
    const editada = await cc.obtener(auth, clienteId);
    expect(editada.movimientos).toEqual([expect.objectContaining({ fecha: '2026-02-01', debe: 125 })]);
    expect(editada.saldo).toBe(125);
    await prisma.ordenTrabajo.update({ where: { id: o.id }, data: { estado: 'finalizada', fechaFinalizada: new Date('2026-03-01'), fechaVencimientoComercial: new Date('2026-03-31') } });
    const finalizada = await cc.obtener(auth, clienteId);
    expect(finalizada.movimientos).toEqual(editada.movimientos);
    expect(finalizada.sinVencimiento).toBe(0);
    await prisma.ordenTrabajo.update({ where: { id: o.id }, data: { estado: 'cancelada', canceladaEl: new Date() } });
    const cancelada = await cc.obtener(auth, clienteId);
    expect(cancelada.movimientos).toEqual([]);
    expect(cancelada.saldo).toBe(0);
    expect(cancelada.agingTotal).toBe(0);
    expect((await cc.deudores(auth)).find((d) => d.clienteId === clienteId)).toBeUndefined();
  });

  it('usa una fecha estable para OTs antiguas sin fecha de emisión: evento y luego creación', async () => {
    const o = await orden(100);
    await prisma.ordenTrabajo.update({ where: { id: o.id }, data: { createdAt: new Date('2026-01-01T12:00:00Z') } });
    expect((await cc.obtener(auth, clienteId)).movimientos[0].fecha).toBe('2026-01-01');
    await prisma.ordenTrabajoEvento.create({ data: {
      tenantId, ordenId: o.id, tipo: 'emision', descripcion: 'OT emitida', usuarioNombre: 'Test', origen: 'sistema', fecha: new Date('2026-02-01T12:00:00Z'),
    } });
    expect((await cc.obtener(auth, clienteId)).movimientos[0].fecha).toBe('2026-02-01');
  });

  it('permite completar una aplicación existente sin duplicarla e incluye el último centavo', async () => {
    const o = await orden(100.01);
    const c = await cobro(100.01);
    await prisma.cobroOrden.create({
      data: { tenantId, cobroId: c.id, ordenId: o.id, monto: 100 },
    });
    await motor.recalcularCobrado(prisma, tenantId, o.id);
    await aplicar(o.id);
    await aplicar(o.id);
    expect(await cobrado(o.id)).toBe(100.01);
    expect(await prisma.cobroOrden.count({ where: { cobroId: c.id } })).toBe(1);
    expect(
      await prisma.ordenTrabajoEvento.count({ where: { ordenId: o.id } }),
    ).toBe(1);
  });

  it('al anular el recibo vuelve a quedar pendiente lo aplicado, conservando su rastro', async () => {
    const o = await orden(75);
    const f = await factura(75, o.id);
    const c = await cobro(100);
    await aplicar(o.id);
    await prisma.$transaction(async (tx) => {
      await tx.cobro.update({
        where: { id: c.id },
        data: { anuladoEl: new Date(), estadoAcreditacion: 'anulado' },
      });
      await motor.revertirCobro(tx, tenantId, c.id);
    });
    expect(await cobrado(o.id)).toBe(0);
    expect((await cc.obtener(auth, clienteId)).saldo).toBe(75);
    expect(
      Number(
        (await prisma.comprobante.findUniqueOrThrow({ where: { id: f.id } }))
          .saldoPendiente,
      ),
    ).toBe(75);
    expect(await cobrosApi.findAll(auth, { ordenId: o.id })).toEqual([]);
    expect(await prisma.cobroOrden.count({ where: { cobroId: c.id } })).toBe(1);
  });

  it('incluye facturas/ND históricas y descuenta sus NC sin duplicar ventas de OTs', async () => {
    const f = await factura(200);
    await factura(50, undefined, 'nota_credito', f.id);
    await motor.revertirFactura(prisma, tenantId, f.id);
    await factura(10, undefined, 'nota_debito', f.id);
    const cuenta = await cc.obtener(auth, clienteId);
    expect(cuenta.saldo).toBe(160);
    expect(cuenta.agingTotal).toBe(160);
    expect(cuenta.comprobantesPendientes).toBe(2);
    expect(
      (await cc.deudores(auth)).find((d) => d.clienteId === clienteId)?.total,
    ).toBe(160);
  });

  it('dos finalizaciones simultáneas no consumen dos veces el mismo anticipo', async () => {
    const a = await orden(100);
    const b = await orden(100);
    await cobro(100);
    await Promise.all([aplicar(a.id), aplicar(b.id)]);
    expect((await cobrado(a.id)) + (await cobrado(b.id))).toBe(100);
  });

  it('dos facturas históricas simultáneas tampoco exceden el recibo', async () => {
    const a = await factura(100);
    const b = await factura(100);
    const c = await cobro(100);
    await Promise.all(
      [a, b].map((f) =>
        prisma.$transaction((tx) => motor.matchearFactura(tx, tenantId, f.id)),
      ),
    );
    const total = await prisma.cobroImputacion.aggregate({
      where: { cobroId: c.id },
      _sum: { monto: true },
    });
    expect(Number(total._sum.monto)).toBe(100);
    expect((await saldoComercialCobro(prisma, tenantId, c.id)).libre).toBe(0);
  });

  it('repara aplicaciones antiguas, reaplica sólo anticipos reales y es idempotente', async () => {
    const f = await factura(500);
    const viejo = await cobro(500);
    await motor.matchearCobro(prisma, tenantId, viejo.id);
    const a = await orden(100, 1);
    const b = await orden(100, 2);
    await prisma.cobroOrden.createMany({
      data: [a, b].map((o) => ({
        tenantId,
        ordenId: o.id,
        cobroId: viejo.id,
        monto: 100,
      })),
    });
    await motor.recalcularCobrado(prisma, tenantId, a.id);
    await motor.recalcularCobrado(prisma, tenantId, b.id);
    const real = await cobro(150);
    const reparar = () =>
      prisma.$transaction((tx) =>
        reconciliarAnticiposHistoricos(tx, motor, tenantId, clienteId),
      );
    expect(await reparar()).toHaveLength(2);
    expect(await cobrado(a.id)).toBe(100);
    expect(await cobrado(b.id)).toBe(50);
    expect(
      await prisma.cobroOrden.count({ where: { cobroId: viejo.id } }),
    ).toBe(0);
    expect(await prisma.cobroOrden.count({ where: { cobroId: real.id } })).toBe(
      2,
    );
    expect(
      Number(
        (await prisma.comprobante.findUniqueOrThrow({ where: { id: f.id } }))
          .saldoPendiente,
      ),
    ).toBe(0);
    expect((await cc.obtener(auth, clienteId)).saldo).toBe(50);
    expect(await reparar()).toHaveLength(0);
  });
});
