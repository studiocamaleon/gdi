import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { FacturacionOrdenesService } from '../facturacion-ordenes.service';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Motor del vínculo factura↔orden y matching cobro↔factura (etapa B de
 * docs/facturacion-ordenes-deuda-comercial-diseno.md). Corre contra
 * gdi_saas_test con fixtures propios (ver test/jest-setup-db.ts); los
 * métodos del motor reciben `tx`, acá se les pasa el client directo.
 *
 * Cubre los casos borde del §7: parciales, FIFO, factura multi-orden con
 * cupo por orden, NC que resta, borrador que no cuenta, tope duro, y las
 * reversas con re-match.
 */
describe('FacturacionOrdenesService — motor', () => {
  const prisma = new PrismaClient();
  const motor = new FacturacionOrdenesService(
    prisma as unknown as PrismaService,
  );
  let tenantId: string;
  let clienteId: string;
  let puntoVentaId: string;
  let metodoPagoId: string;
  let cuentaId: string;
  let seq = 0;

  beforeAll(async () => {
    const slug = `test-fact-ord-${randomUUID().slice(0, 8)}`;
    const tenant = await prisma.tenant.create({
      data: { nombre: 'Test facturación órdenes', slug },
    });
    tenantId = tenant.id;
    const cliente = await prisma.cliente.create({
      data: {
        tenantId,
        nombre: `Cliente ${slug}`,
        emailPrincipal: 'test@test.com',
        telefonoCodigo: '11',
        telefonoNumero: '5555-5555',
        paisCodigo: 'AR',
      },
    });
    clienteId = cliente.id;
    const config = await prisma.configuracionFiscal.create({
      data: {
        tenantId,
        razonSocial: 'Test SA',
        cuit: '30712345671',
        condicionFiscal: 'RI',
      },
    });
    const pv = await prisma.puntoVenta.create({
      data: {
        tenantId,
        configuracionFiscalId: config.id,
        numero: 1,
        nombre: 'Test',
      },
    });
    puntoVentaId = pv.id;
    const cuenta = await prisma.cuentaFondos.create({
      data: { tenantId, tipo: 'caja', nombre: 'Caja test' },
    });
    cuentaId = cuenta.id;
    const metodo = await prisma.metodoPago.create({
      data: {
        tenantId,
        codigo: 'efectivo-test',
        nombre: 'Efectivo',
        tipo: 'efectivo',
      },
    });
    metodoPagoId = metodo.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  const crearOrden = async (total: number) => {
    seq += 1;
    return prisma.ordenTrabajo.create({
      data: {
        tenantId,
        numero: `OT-TEST-${String(seq).padStart(4, '0')}`,
        clienteId,
        estado: 'finalizada',
        fechaFinalizada: new Date(),
        subtotal: total,
        impuestos: 0,
        total,
      },
    });
  };

  const crearFactura = async (
    vinculos: Array<{ ordenId: string; monto: number }>,
    opts?: { tipo?: string; estado?: string; fecha?: Date },
  ) => {
    const total = vinculos.reduce((s, v) => s + v.monto, 0);
    return prisma.comprobante.create({
      data: {
        tenantId,
        tipo: opts?.tipo ?? 'factura',
        letra: 'B',
        puntoVentaId,
        fecha: opts?.fecha ?? new Date('2026-07-01'),
        clienteId,
        receptorSnapshot: { nombre: 'Test' },
        itemsJson: [],
        netoGravado: total,
        ivaPorAlicuota: [],
        total,
        estado: opts?.estado ?? 'emitido',
        idempotencyKey: randomUUID(),
        saldoPendiente: total,
        ordenes: {
          create: vinculos.map((v) => ({
            tenantId,
            ordenId: v.ordenId,
            monto: v.monto,
          })),
        },
      },
    });
  };

  const crearCobro = async (
    ordenId: string | null,
    monto: number,
    fecha = new Date('2026-07-05'),
  ) =>
    prisma.cobro.create({
      data: {
        tenantId,
        clienteId,
        ordenId,
        fecha,
        metodoPagoId,
        cuentaDestinoId: cuentaId,
        montoBruto: monto,
        netoAcreditado: monto,
        disponibleReal: monto,
        estadoAcreditacion: 'acreditado',
      },
    });

  const facturadoDe = async (ordenId: string) =>
    Number(
      (
        await prisma.ordenTrabajo.findUniqueOrThrow({
          where: { id: ordenId },
          select: { facturadoTotal: true },
        })
      ).facturadoTotal,
    );

  const saldoDe = async (comprobanteId: string) =>
    Number(
      (
        await prisma.comprobante.findUniqueOrThrow({
          where: { id: comprobanteId },
          select: { saldoPendiente: true },
        })
      ).saldoPendiente,
    );

  describe('recalcularFacturado', () => {
    it('suma facturas emitidas, ignora borradores, resta NC (piso 0)', async () => {
      const orden = await crearOrden(100_000);
      await crearFactura([{ ordenId: orden.id, monto: 40_000 }]);
      await crearFactura([{ ordenId: orden.id, monto: 25_000 }], {
        estado: 'borrador',
      });
      expect(
        await motor.recalcularFacturado(prisma, tenantId, orden.id),
      ).toBe(40_000);

      await crearFactura([{ ordenId: orden.id, monto: 15_000 }], {
        tipo: 'nota_credito',
      });
      expect(
        await motor.recalcularFacturado(prisma, tenantId, orden.id),
      ).toBe(25_000);

      // NC mayor que lo facturado: el agregado no baja de cero.
      await crearFactura([{ ordenId: orden.id, monto: 90_000 }], {
        tipo: 'nota_credito',
      });
      expect(
        await motor.recalcularFacturado(prisma, tenantId, orden.id),
      ).toBe(0);
    });
  });

  describe('matchearCobro (cobro después de la factura)', () => {
    it('cancela FIFO por fecha y deja el remanente libre', async () => {
      const orden = await crearOrden(200_000);
      const vieja = await crearFactura([{ ordenId: orden.id, monto: 60_000 }], {
        fecha: new Date('2026-06-01'),
      });
      const nueva = await crearFactura([{ ordenId: orden.id, monto: 80_000 }], {
        fecha: new Date('2026-06-20'),
      });

      const cobro = await crearCobro(orden.id, 100_000);
      await motor.matchearCobro(prisma, tenantId, cobro.id);

      // 60k cancelan la vieja, 40k van a la nueva, 0 libre.
      expect(await saldoDe(vieja.id)).toBe(0);
      expect(await saldoDe(nueva.id)).toBe(40_000);

      const imputaciones = await prisma.cobroImputacion.findMany({
        where: { cobroId: cobro.id },
      });
      expect(imputaciones.reduce((s, i) => s + Number(i.monto), 0)).toBe(
        100_000,
      );
    });

    it('sin facturas emitidas el cobro queda entero a cuenta', async () => {
      const orden = await crearOrden(50_000);
      await crearFactura([{ ordenId: orden.id, monto: 50_000 }], {
        estado: 'borrador',
      });
      const cobro = await crearCobro(orden.id, 30_000);
      await motor.matchearCobro(prisma, tenantId, cobro.id);
      expect(
        await prisma.cobroImputacion.count({ where: { cobroId: cobro.id } }),
      ).toBe(0);
    });
  });

  describe('matchearFactura (factura después del cobro)', () => {
    it('absorbe los cobros libres de la orden al emitirse', async () => {
      const orden = await crearOrden(120_000);
      const seña = await crearCobro(orden.id, 50_000, new Date('2026-06-10'));
      const resto = await crearCobro(orden.id, 30_000, new Date('2026-06-15'));

      const factura = await crearFactura([
        { ordenId: orden.id, monto: 120_000 },
      ]);
      await motor.matchearFactura(prisma, tenantId, factura.id);

      // 50k + 30k aplicados; la factura queda debiendo 40k.
      expect(await saldoDe(factura.id)).toBe(40_000);
      expect(
        await prisma.cobroImputacion.count({
          where: { cobroId: { in: [seña.id, resto.id] } },
        }),
      ).toBe(2);
    });

    it('multi-orden: los cobros de una orden no cancelan la porción de otra', async () => {
      const ordenA = await crearOrden(100_000);
      const ordenB = await crearOrden(200_000);
      // Cobro grande de A: más que su porción en la factura del lote.
      const cobroA = await crearCobro(ordenA.id, 150_000);

      const lote = await crearFactura([
        { ordenId: ordenA.id, monto: 100_000 },
        { ordenId: ordenB.id, monto: 200_000 },
      ]);
      await motor.matchearFactura(prisma, tenantId, lote.id);

      // Sólo 100k (la porción de A) se aplican; B sigue impaga.
      expect(await saldoDe(lote.id)).toBe(200_000);
      const imp = await prisma.cobroImputacion.findMany({
        where: { cobroId: cobroA.id },
      });
      expect(imp).toHaveLength(1);
      expect(Number(imp[0].monto)).toBe(100_000);
    });
  });

  describe('validarTope', () => {
    it('rebota la factura que excede el saldo sin facturar de la orden', async () => {
      const orden = await crearOrden(100_000);
      await crearFactura([{ ordenId: orden.id, monto: 70_000 }]);
      await motor.recalcularFacturado(prisma, tenantId, orden.id);

      const excedida = await crearFactura(
        [{ ordenId: orden.id, monto: 50_000 }],
        { estado: 'borrador' },
      );
      await expect(
        motor.validarTope(prisma, tenantId, excedida.id),
      ).rejects.toThrow(/no se puede facturar más/);

      const justa = await crearFactura(
        [{ ordenId: orden.id, monto: 30_000 }],
        { estado: 'borrador' },
      );
      await expect(
        motor.validarTope(prisma, tenantId, justa.id),
      ).resolves.toBeUndefined();
    });
  });

  describe('reversas', () => {
    it('revertirCobro restaura el saldo fiscal y el cobradoTotal', async () => {
      const orden = await crearOrden(80_000);
      const factura = await crearFactura([{ ordenId: orden.id, monto: 80_000 }]);
      const cobro = await crearCobro(orden.id, 80_000);
      await motor.recalcularCobrado(prisma, tenantId, orden.id);
      await motor.matchearCobro(prisma, tenantId, cobro.id);
      expect(await saldoDe(factura.id)).toBe(0);

      await prisma.cobro.update({
        where: { id: cobro.id },
        data: { anuladoEl: new Date() },
      });
      await motor.revertirCobro(prisma, tenantId, cobro.id);

      expect(await saldoDe(factura.id)).toBe(80_000);
      const ordenDespues = await prisma.ordenTrabajo.findUniqueOrThrow({
        where: { id: orden.id },
        select: { cobradoTotal: true },
      });
      expect(Number(ordenDespues.cobradoTotal)).toBe(0);
    });

    it('revertirFactura libera los cobros y los re-matchea contra otra factura', async () => {
      const orden = await crearOrden(150_000);
      const anulable = await crearFactura(
        [{ ordenId: orden.id, monto: 90_000 }],
        { fecha: new Date('2026-06-01') },
      );
      const cobro = await crearCobro(orden.id, 90_000);
      await motor.matchearCobro(prisma, tenantId, cobro.id);
      expect(await saldoDe(anulable.id)).toBe(0);

      // Segunda factura por el resto, todavía impaga.
      const otra = await crearFactura([{ ordenId: orden.id, monto: 60_000 }], {
        fecha: new Date('2026-06-20'),
      });

      await prisma.comprobante.update({
        where: { id: anulable.id },
        data: { estado: 'anulado', anuladoEl: new Date() },
      });
      await motor.revertirFactura(prisma, tenantId, anulable.id);

      // El cobro liberado se aplicó a la otra factura (60k) y quedan 30k
      // libres; la anulada ya no cuenta en el facturado.
      expect(await saldoDe(otra.id)).toBe(0);
      expect(await facturadoDe(orden.id)).toBe(60_000);
      const imp = await prisma.cobroImputacion.findMany({
        where: { cobroId: cobro.id },
      });
      expect(imp).toHaveLength(1);
      expect(imp[0].comprobanteId).toBe(otra.id);
      expect(Number(imp[0].monto)).toBe(60_000);
    });
  });
});
