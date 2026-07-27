import { PrismaClient, RolSistema } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';

import { EgresosService } from '../egresos.service';
import { estadoPorPagado, incideEnResultado } from '../egresos.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';

/**
 * Egresos y Cuentas por pagar (F1). Corre contra gdi_saas_test con fixtures
 * propios (ver test/jest-setup-db.ts).
 *
 * Cubre lo que realmente puede romper: el contado que exige pago, el
 * antiduplicado de facturas, el parcial, el pago de más, el pago multi-factura,
 * la anulación con contramovimiento, y las naturalezas que NO son gasto.
 */
describe('EgresosService', () => {
  const prisma = new PrismaClient();
  // Las dependencias del PDF no se ejercitan acá (la orden de pago se prueba
  // en su propio spec): se pasan explícitas para que el día que este spec las
  // necesite falle en la construcción y no con un `undefined` a mitad de test.
  const service = new EgresosService(
    prisma as unknown as PrismaService,
    null as never,
    null as never,
    null as never,
  );
  let tenantId: string;
  let auth: CurrentAuth;
  let cuentaId: string;
  let metodoPagoId: string;
  let metodoChequeId: string;
  let proveedorId: string;
  let otroProveedorId: string;
  let catMateriales: string;
  let catAdelanto: string;
  let catVehiculo: string;
  let catMaquinaria: string;
  let seq = 0;

  beforeAll(async () => {
    const slug = `test-egresos-${randomUUID().slice(0, 8)}`;
    const tenant = await prisma.tenant.create({
      data: { nombre: 'Test egresos', slug },
    });
    tenantId = tenantId = tenant.id;
    auth = {
      userId: randomUUID(),
      sessionId: randomUUID(),
      tenantId,
      membershipId: randomUUID(),
      role: RolSistema.ADMINISTRADOR,
      email: 'admin@test.local',
    } as CurrentAuth;

    const cuenta = await prisma.cuentaFondos.create({
      data: { tenantId, tipo: 'caja', nombre: 'Caja test', saldo: 1_000_000 },
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
    const chequeMetodo = await prisma.metodoPago.create({
      data: {
        tenantId,
        codigo: 'cheque-test',
        nombre: 'Cheque propio',
        tipo: 'cheque_echeq',
      },
    });
    metodoChequeId = chequeMetodo.id;
    const prov = await prisma.proveedor.create({
      data: {
        tenantId,
        nombre: 'Papelera del Sur',
        emailPrincipal: 'p@test.com',
        telefonoCodigo: '11',
        telefonoNumero: '4444-4444',
        paisCodigo: 'AR',
        condicionPagoDias: 30,
      },
    });
    proveedorId = prov.id;
    const otro = await prisma.proveedor.create({
      data: {
        tenantId,
        nombre: 'Matricería López',
        emailPrincipal: 'm@test.com',
        telefonoCodigo: '11',
        telefonoNumero: '5555-5555',
        paisCodigo: 'AR',
      },
    });
    otroProveedorId = otro.id;

    // Siembra del árbol curado.
    await service.asegurarCategorias(tenantId);
    const cats = await prisma.categoriaEgreso.findMany({ where: { tenantId } });
    catMateriales = cats.find((c) => c.codigo === 'materiales')!.id;
    catAdelanto = cats.find((c) => c.codigo === 'adelanto_sueldo')!.id;
    catVehiculo = cats.find((c) => c.codigo === 'vehiculo')!.id;
    catMaquinaria = cats.find((c) => c.codigo === 'maquinaria')!.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  const nroDoc = () => {
    seq += 1;
    return String(10_000 + seq);
  };

  const saldoCuenta = async () => {
    const c = await prisma.cuentaFondos.findUniqueOrThrow({
      where: { id: cuentaId },
      select: { saldo: true },
    });
    return Number(c.saldo);
  };

  // ── El árbol curado ──────────────────────────────────────────────────

  describe('categorías', () => {
    it('siembra el árbol y es idempotente', async () => {
      const antes = await prisma.categoriaEgreso.count({ where: { tenantId } });
      expect(antes).toBeGreaterThan(30);
      await service.asegurarCategorias(tenantId);
      const despues = await prisma.categoriaEgreso.count({
        where: { tenantId },
      });
      expect(despues).toBe(antes);
    });

    it('las de sistema no se borran', async () => {
      await expect(
        service.borrarCategoria(auth, catMateriales),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('la amortización NO está en el árbol: no es un egreso', async () => {
      const cats = await prisma.categoriaEgreso.findMany({
        where: { tenantId },
        select: { codigo: true, nombre: true },
      });
      const hayAmortizacion = cats.some(
        (c) =>
          c.codigo.includes('amortiz') ||
          c.nombre.toLowerCase().includes('amortiz'),
      );
      expect(hayAmortizacion).toBe(false);
    });
  });

  // ── Contado vs. diferido ─────────────────────────────────────────────

  describe('el momento del pago', () => {
    it('un egreso de contado necesita su pago en el mismo gesto', async () => {
      await expect(
        service.crear(auth, {
          descripcion: 'Nafta sin cuenta',
          categoriaEgresoId: catMateriales,
          beneficiarioNombre: 'YPF',
          neto: 45_000,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('contado: nace pagado, mueve la caja y NO entra en cuentas por pagar', async () => {
      const saldoAntes = await saldoCuenta();
      const { id } = await service.crear(auth, {
        descripcion: 'Nafta camioneta',
        categoriaEgresoId: catMateriales,
        beneficiarioNombre: 'YPF',
        neto: 45_000,
        pago: { metodoPagoId, cuentaOrigenId: cuentaId },
      });
      const egreso = await prisma.egreso.findUniqueOrThrow({ where: { id } });
      expect(egreso.estado).toBe('pagado');
      expect(egreso.fechaVencimiento).toBeNull();
      expect(Number(egreso.pagadoTotal)).toBe(45_000);
      expect(await saldoCuenta()).toBe(saldoAntes - 45_000);

      // No aparece en el filtro de Cuentas por pagar.
      const cxp = await service.listar(auth, { soloPendientes: 'true' });
      expect(cxp.egresos.some((e) => e.id === id)).toBe(false);
    });

    it('diferido: queda pendiente y SÍ entra en cuentas por pagar', async () => {
      const { id } = await service.crear(auth, {
        descripcion: 'Papel obra',
        categoriaEgresoId: catMateriales,
        proveedorId,
        fechaVencimiento: '2026-08-30',
        neto: 320_000,
        iva: 67_200,
        tipoComprobante: 'FA',
        puntoVenta: '0001',
        numeroComprobante: nroDoc(),
      });
      const egreso = await prisma.egreso.findUniqueOrThrow({ where: { id } });
      expect(egreso.estado).toBe('pendiente');
      expect(Number(egreso.total)).toBe(387_200);
      // El nombre del proveedor se congela.
      expect(egreso.beneficiarioNombre).toBe('Papelera del Sur');

      const cxp = await service.listar(auth, { soloPendientes: 'true' });
      expect(cxp.egresos.some((e) => e.id === id)).toBe(true);
    });
  });

  // ── El antiduplicado ─────────────────────────────────────────────────

  describe('antiduplicado de facturas', () => {
    it('rechaza la misma factura del mismo proveedor dos veces', async () => {
      const numero = nroDoc();
      const base = {
        descripcion: 'Papel',
        categoriaEgresoId: catMateriales,
        proveedorId,
        fechaVencimiento: '2026-08-30',
        neto: 100_000,
        tipoComprobante: 'FA',
        puntoVenta: '0001',
        numeroComprobante: numero,
      };
      await service.crear(auth, { ...base });
      await expect(service.crear(auth, { ...base })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('dos gastos SIN documento no se estorban', async () => {
      // Los NULL no colisionan en Postgres: es lo que deja entrar la caja chica.
      const base = {
        descripcion: 'Flete Ramón',
        categoriaEgresoId: catMateriales,
        beneficiarioNombre: 'Ramón',
        neto: 8_000,
        pago: { metodoPagoId, cuentaOrigenId: cuentaId },
      };
      const a = await service.crear(auth, { ...base });
      const b = await service.crear(auth, { ...base });
      expect(a.id).not.toBe(b.id);
    });
  });

  // ── Pagos ────────────────────────────────────────────────────────────

  describe('pagos', () => {
    const crearDiferido = async (total: number, prov = proveedorId) =>
      service.crear(auth, {
        descripcion: 'Insumos',
        categoriaEgresoId: catMateriales,
        proveedorId: prov,
        fechaVencimiento: '2026-08-30',
        neto: total,
        tipoComprobante: 'FA',
        puntoVenta: '0001',
        numeroComprobante: nroDoc(),
      });

    it('un pago parcial deja el egreso en parcial y sigue en cuentas por pagar', async () => {
      const { id } = await crearDiferido(780_000);
      await service.registrarPago(auth, {
        metodoPagoId,
        cuentaOrigenId: cuentaId,
        imputaciones: [{ egresoId: id, monto: 500_000 }],
      });
      const egreso = await prisma.egreso.findUniqueOrThrow({ where: { id } });
      expect(egreso.estado).toBe('parcial');
      expect(Number(egreso.pagadoTotal)).toBe(500_000);

      const cxp = await service.listar(auth, { soloPendientes: 'true' });
      const fila = cxp.egresos.find((e) => e.id === id);
      expect(fila?.saldo).toBe(280_000);
    });

    it('no deja pagar más que el saldo', async () => {
      const { id } = await crearDiferido(100_000);
      await expect(
        service.registrarPago(auth, {
          metodoPagoId,
          cuentaOrigenId: cuentaId,
          imputaciones: [{ egresoId: id, monto: 150_000 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('un pago cierra VARIAS facturas y genera un solo movimiento', async () => {
      const a = await crearDiferido(100_000);
      const b = await crearDiferido(200_000);
      const c = await crearDiferido(300_000);
      const saldoAntes = await saldoCuenta();

      const pago = await service.registrarPago(auth, {
        metodoPagoId,
        cuentaOrigenId: cuentaId,
        referencia: 'TRF-9988',
        imputaciones: [
          { egresoId: a.id, monto: 100_000 },
          { egresoId: b.id, monto: 200_000 },
          { egresoId: c.id, monto: 300_000 },
        ],
      });

      expect(pago.numero).toMatch(/^OP-\d{4}-\d{4}$/);
      const estados = await prisma.egreso.findMany({
        where: { id: { in: [a.id, b.id, c.id] } },
        select: { estado: true },
      });
      expect(estados.every((e) => e.estado === 'pagado')).toBe(true);
      expect(await saldoCuenta()).toBe(saldoAntes - 600_000);

      const movs = await prisma.movimientoFondos.count({
        where: { tenantId, pagoId: pago.id },
      });
      expect(movs).toBe(1);
    });

    it('un pago es de UN proveedor: una orden de pago se le manda a alguien', async () => {
      const a = await crearDiferido(50_000);
      const b = await crearDiferido(50_000, otroProveedorId);
      await expect(
        service.registrarPago(auth, {
          metodoPagoId,
          cuentaOrigenId: cuentaId,
          imputaciones: [
            { egresoId: a.id, monto: 50_000 },
            { egresoId: b.id, monto: 50_000 },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('anular el pago devuelve la deuda y REVIERTE la caja con un contramovimiento', async () => {
      const { id } = await crearDiferido(120_000);
      const saldoAntes = await saldoCuenta();
      const pago = await service.registrarPago(auth, {
        metodoPagoId,
        cuentaOrigenId: cuentaId,
        imputaciones: [{ egresoId: id, monto: 120_000 }],
      });
      expect(await saldoCuenta()).toBe(saldoAntes - 120_000);

      await service.anularPago(auth, pago.id, { motivo: 'Rechazó el banco' });

      const egreso = await prisma.egreso.findUniqueOrThrow({ where: { id } });
      expect(egreso.estado).toBe('pendiente');
      expect(Number(egreso.pagadoTotal)).toBe(0);
      expect(await saldoCuenta()).toBe(saldoAntes);

      // El movimiento NO se borra: queda el original y su contramovimiento.
      const movs = await prisma.movimientoFondos.findMany({
        where: { tenantId, pagoId: pago.id },
        select: { tipo: true },
      });
      expect(movs).toHaveLength(2);
      expect(movs.filter((m) => m.tipo === 'salida')).toHaveLength(1);
      expect(movs.filter((m) => m.tipo === 'entrada')).toHaveLength(1);
    });

    it('un egreso con pagos no se edita ni se anula sin anular el pago', async () => {
      const { id } = await crearDiferido(90_000);
      await service.registrarPago(auth, {
        metodoPagoId,
        cuentaOrigenId: cuentaId,
        imputaciones: [{ egresoId: id, monto: 90_000 }],
      });
      await expect(
        service.editar(auth, id, { neto: 95_000 }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.anular(auth, id, { motivo: 'me equivoqué' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── Naturalezas ──────────────────────────────────────────────────────

  describe('naturaleza del egreso', () => {
    it('el adelanto de sueldo sale de la caja pero NO incide en resultado', async () => {
      const saldoAntes = await saldoCuenta();
      const { id } = await service.crear(auth, {
        descripcion: 'Adelanto Martín',
        categoriaEgresoId: catAdelanto,
        beneficiarioNombre: 'Martín',
        neto: 100_000,
        pago: { metodoPagoId, cuentaOrigenId: cuentaId },
      });
      // La plata salió.
      expect(await saldoCuenta()).toBe(saldoAntes - 100_000);
      // Pero no es gasto: si lo fuera, el costo laboral se contaría dos veces
      // (el adelanto y después el sueldo completo).
      const listado = await service.listar(auth, {});
      const fila = listado.egresos.find((e) => e.id === id);
      expect(fila?.naturaleza).toBe('NO_RESULTADO');
      expect(incideEnResultado('NO_RESULTADO')).toBe(false);
    });

    it('sólo costo de producción y estructura inciden en resultado', () => {
      expect(incideEnResultado('COSTO_PRODUCCION')).toBe(true);
      expect(incideEnResultado('GASTO_ESTRUCTURA')).toBe(true);
      // Una máquina nueva no es gasto de julio; un retiro de socios tampoco.
      expect(incideEnResultado('INVERSION')).toBe(false);
      expect(incideEnResultado('RETIRO_SOCIOS')).toBe(false);
    });
  });

  // ── F2: retenciones practicadas (C4) ─────────────────────────────────

  describe('retenciones practicadas', () => {
    it('reducen lo que SALE sin reducir lo que se salda', async () => {
      const { id } = await service.crear(auth, {
        descripcion: 'Servicio con retención',
        categoriaEgresoId: catMateriales,
        proveedorId,
        fechaVencimiento: '2026-09-30',
        neto: 320_000,
        tipoComprobante: 'FA',
        puntoVenta: '0004',
        numeroComprobante: nroDoc(),
      });
      const saldoAntes = await saldoCuenta();

      const pago = await service.registrarPago(auth, {
        metodoPagoId,
        cuentaOrigenId: cuentaId,
        imputaciones: [{ egresoId: id, monto: 320_000 }],
        retenciones: [
          {
            regimen: 'SICORE_GANANCIAS',
            base: 320_000,
            alicuota: 3,
            monto: 9_600,
          },
        ],
      });

      // La factura queda saldada por el BRUTO...
      const egreso = await prisma.egreso.findUniqueOrThrow({ where: { id } });
      expect(egreso.estado).toBe('pagado');
      expect(Number(egreso.pagadoTotal)).toBe(320_000);
      // ...pero de la cuenta salió el NETO: lo retenido se deposita al fisco.
      expect(pago.montoNeto).toBe(310_400);
      expect(await saldoCuenta()).toBe(saldoAntes - 310_400);

      const ret = await prisma.retencionPercepcion.findMany({
        where: { tenantId, pagoId: pago.id },
      });
      expect(ret).toHaveLength(1);
      expect(ret[0].direccion).toBe('practicada');
    });

    it('no deja retener más que el pago', async () => {
      const { id } = await service.crear(auth, {
        descripcion: 'Chico',
        categoriaEgresoId: catMateriales,
        proveedorId,
        fechaVencimiento: '2026-09-30',
        neto: 1_000,
        tipoComprobante: 'FA',
        puntoVenta: '0004',
        numeroComprobante: nroDoc(),
      });
      await expect(
        service.registrarPago(auth, {
          metodoPagoId,
          cuentaOrigenId: cuentaId,
          imputaciones: [{ egresoId: id, monto: 1_000 }],
          retenciones: [
            { regimen: 'otro', base: 1_000, alicuota: 200, monto: 2_000 },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── F2: cheque propio (C5) ───────────────────────────────────────────

  describe('cheque propio', () => {
    it('salda la factura pero NO toca la cuenta hasta que se debite', async () => {
      const { id } = await service.crear(auth, {
        descripcion: 'Pago con cheque',
        categoriaEgresoId: catMateriales,
        proveedorId,
        fechaVencimiento: '2026-09-30',
        neto: 200_000,
        tipoComprobante: 'FA',
        puntoVenta: '0005',
        numeroComprobante: nroDoc(),
      });
      const saldoAntes = await saldoCuenta();

      const pago = await service.registrarPago(auth, {
        metodoPagoId: metodoChequeId,
        cuentaOrigenId: cuentaId,
        imputaciones: [{ egresoId: id, monto: 200_000 }],
        cheque: {
          numero: '00012345',
          banco: 'Galicia',
          formato: 'echeq',
          fechaPago: '2026-11-30',
        },
      });

      expect(pago.enCartera).toBe(true);
      const egreso = await prisma.egreso.findUniqueOrThrow({ where: { id } });
      expect(egreso.estado).toBe('pagado');
      // La plata NO salió: el cheque está en cartera.
      expect(await saldoCuenta()).toBe(saldoAntes);
      const movs = await prisma.movimientoFondos.count({
        where: { tenantId, pagoId: pago.id },
      });
      expect(movs).toBe(0);

      const valor = await prisma.valor.findFirstOrThrow({
        where: { tenantId, numero: '00012345' },
      });
      expect(valor.origen).toBe('propio');
      expect(valor.estado).toBe('cartera');
      expect(valor.proveedorId).toBe(proveedorId);
    });

    it('exige los datos del cheque si el método es cheque', async () => {
      const { id } = await service.crear(auth, {
        descripcion: 'Sin datos de cheque',
        categoriaEgresoId: catMateriales,
        proveedorId,
        fechaVencimiento: '2026-09-30',
        neto: 5_000,
        tipoComprobante: 'FA',
        puntoVenta: '0005',
        numeroComprobante: nroDoc(),
      });
      await expect(
        service.registrarPago(auth, {
          metodoPagoId: metodoChequeId,
          cuentaOrigenId: cuentaId,
          imputaciones: [{ egresoId: id, monto: 5_000 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('anular el pago con cheque en cartera lo da de baja, sin contramovimiento', async () => {
      const { id } = await service.crear(auth, {
        descripcion: 'Cheque a anular',
        categoriaEgresoId: catMateriales,
        proveedorId,
        fechaVencimiento: '2026-09-30',
        neto: 70_000,
        tipoComprobante: 'FA',
        puntoVenta: '0006',
        numeroComprobante: nroDoc(),
      });
      const saldoAntes = await saldoCuenta();
      const pago = await service.registrarPago(auth, {
        metodoPagoId: metodoChequeId,
        cuentaOrigenId: cuentaId,
        imputaciones: [{ egresoId: id, monto: 70_000 }],
        cheque: { numero: '00099999', banco: 'Nación', formato: 'fisico' },
      });

      await service.anularPago(auth, pago.id, { motivo: 'sin fondos' });

      const egreso = await prisma.egreso.findUniqueOrThrow({ where: { id } });
      expect(egreso.estado).toBe('pendiente');
      // Nunca salió plata, así que tampoco vuelve nada.
      expect(await saldoCuenta()).toBe(saldoAntes);
      const movs = await prisma.movimientoFondos.count({
        where: { tenantId, pagoId: pago.id },
      });
      expect(movs).toBe(0);
      const valor = await prisma.valor.findFirstOrThrow({
        where: { tenantId, numero: '00099999' },
      });
      expect(valor.estado).toBe('rechazado');
    });
  });

  // ── F2: cuotas (B11) ─────────────────────────────────────────────────

  describe('cuotas', () => {
    it('crea N egresos hermanados y el total cierra exacto', async () => {
      const doc = nroDoc();
      await service.crear(auth, {
        descripcion: 'Guillotina en cuotas',
        categoriaEgresoId: catMaquinaria,
        proveedorId,
        fechaVencimiento: '2026-09-10',
        neto: 100_000,
        cuotas: 3,
        tipoComprobante: 'FA',
        puntoVenta: '0007',
        numeroComprobante: doc,
      });
      const cuotas = await prisma.egreso.findMany({
        where: { tenantId, numeroComprobante: { startsWith: `${doc}/` } },
        orderBy: { fechaVencimiento: 'asc' },
      });
      expect(cuotas).toHaveLength(3);
      // El total cierra exacto: el resto va en la primera, no se pierde.
      const suma = cuotas.reduce((acc, c) => acc + Number(c.total), 0);
      expect(Math.round(suma * 100) / 100).toBe(100_000);
      // Un vencimiento por mes.
      expect(cuotas.map((c) => c.fechaVencimiento?.toISOString().slice(0, 10)))
        .toEqual(['2026-09-10', '2026-10-10', '2026-11-10']);
      expect(cuotas[0].descripcion).toContain('cuota 1/3');
    });

    it('en cuotas no puede nacer pagado', async () => {
      await expect(
        service.crear(auth, {
          descripcion: 'Cuotas pagadas',
          categoriaEgresoId: catMaquinaria,
          beneficiarioNombre: 'X',
          fechaVencimiento: '2026-09-10',
          neto: 30_000,
          cuotas: 3,
          pago: { metodoPagoId, cuentaOrigenId: cuentaId },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── F2: saldo por proveedor con aging (E2) ───────────────────────────

  describe('saldos por proveedor', () => {
    it('agrupa la deuda por proveedor y la reparte por antigüedad', async () => {
      const r = await service.saldosPorProveedor(auth);
      const papelera = r.proveedores.find((p) => p.proveedorId === proveedorId);
      expect(papelera).toBeDefined();
      expect(papelera!.total).toBeGreaterThan(0);
      // La suma de los tramos es el total del proveedor.
      const suma =
        papelera!.aging.a_vencer +
        papelera!.aging.d0_30 +
        papelera!.aging.d31_60 +
        papelera!.aging.d61_90 +
        papelera!.aging.d90_mas;
      expect(Math.round(suma * 100) / 100).toBe(papelera!.total);
    });

    it('los egresos sin proveedor tienen su propia fila', async () => {
      await service.crear(auth, {
        descripcion: 'Flete sin factura a plazo',
        categoriaEgresoId: catMateriales,
        beneficiarioNombre: 'Ramón',
        fechaVencimiento: '2026-12-01',
        neto: 12_345,
      });
      const r = await service.saldosPorProveedor(auth);
      const sin = r.proveedores.find((p) => p.proveedorId === null);
      expect(sin?.nombre).toBe('Sin proveedor');
      expect(sin?.total).toBeGreaterThanOrEqual(12_345);
    });
  });

  // ── Reclasificar (D6) ────────────────────────────────────────────────

  describe('corregir un egreso ya pagado', () => {
    const crearPagado = async (total: number) => {
      const { id } = await service.crear(auth, {
        descripcion: 'Para reclasificar',
        categoriaEgresoId: catMateriales,
        beneficiarioNombre: 'YPF',
        neto: total,
        pago: { metodoPagoId, cuentaOrigenId: cuentaId },
      });
      return id;
    };

    it('deja RECLASIFICAR: cambiar la categoría no mueve un peso', async () => {
      const id = await crearPagado(30_000);
      // Es justo lo que uno descubre DESPUÉS de pagar, mirando el reporte.
      await service.editar(auth, id, { categoriaEgresoId: catVehiculo });
      const e = await prisma.egreso.findUniqueOrThrow({ where: { id } });
      expect(e.categoriaEgresoId).toBe(catVehiculo);
      expect(e.estado).toBe('pagado');
    });

    it('deja corregir el mes de competencia', async () => {
      const id = await crearPagado(20_000);
      await service.editar(auth, id, { fechaCompetencia: '2026-01-31' });
      const listado = await service.listar(auth, {});
      expect(
        listado.egresos.find((x) => x.id === id)?.fechaCompetencia,
      ).toBe('2026-01-31');
    });

    it('NO deja tocar el importe: rompería pagadoTotal <= total', async () => {
      const id = await crearPagado(40_000);
      await expect(
        service.editar(auth, id, { neto: 10_000 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── Reporte (E3) ─────────────────────────────────────────────────────

  describe('reporte por categoría y naturaleza', () => {
    it('separa lo que es gasto de lo que sólo mueve caja', async () => {
      const mk = (categoriaEgresoId: string, neto: number, desc: string) =>
        service.crear(auth, {
          descripcion: desc,
          categoriaEgresoId,
          beneficiarioNombre: 'Varios',
          fechaCompetencia: '2026-05-15',
          neto,
          pago: { metodoPagoId, cuentaOrigenId: cuentaId },
        });
      await mk(catMateriales, 100_000, 'Papel'); // costo de producción
      await mk(catVehiculo, 50_000, 'Nafta'); // estructura
      await mk(catMaquinaria, 900_000, 'Guillotina'); // inversión
      await mk(catAdelanto, 30_000, 'Adelanto'); // no incide en resultado

      const r = await service.reporte(auth, {
        desde: '2026-05-01',
        hasta: '2026-05-31',
      });

      // Salió de la caja todo; gasto del período es sólo lo primero.
      expect(r.totalSalida).toBe(1_080_000);
      expect(r.totalResultado).toBe(150_000);

      const inversion = r.naturalezas.find((n) => n.naturaleza === 'INVERSION');
      expect(inversion?.monto).toBe(900_000);
      expect(inversion?.incideEnResultado).toBe(false);

      const noResultado = r.naturalezas.find(
        (n) => n.naturaleza === 'NO_RESULTADO',
      );
      expect(noResultado?.incideEnResultado).toBe(false);

      // Ordenado de mayor a menor: lo que más pesa, primero.
      expect(r.categorias[0].monto).toBe(900_000);
    });

    it('un egreso anulado no aparece en ningún total', async () => {
      const { id } = await service.crear(auth, {
        descripcion: 'Se anula',
        categoriaEgresoId: catMateriales,
        beneficiarioNombre: 'Error',
        fechaCompetencia: '2026-04-10',
        neto: 777_000,
        fechaVencimiento: '2026-05-10',
        tipoComprobante: 'FA',
        puntoVenta: '0003',
        numeroComprobante: nroDoc(),
      });
      const antes = await service.reporte(auth, {
        desde: '2026-04-01',
        hasta: '2026-04-30',
      });
      expect(antes.totalSalida).toBe(777_000);

      await service.anular(auth, id, { motivo: 'cargado por error' });

      const despues = await service.reporte(auth, {
        desde: '2026-04-01',
        hasta: '2026-04-30',
      });
      expect(despues.totalSalida).toBe(0);
    });

    it('agrupa por COMPETENCIA, no por cuándo se pagó', async () => {
      // La luz de marzo pagada en abril es gasto de MARZO. Se usa un mes que
      // ningún otro test toca: el reporte suma todo el tenant y un vecino que
      // escriba en el mismo período haría fallar esto por interferencia.
      await service.crear(auth, {
        descripcion: 'Luz de marzo',
        categoriaEgresoId: catVehiculo,
        beneficiarioNombre: 'Edenor',
        fechaCompetencia: '2026-03-20',
        neto: 15_000,
        pago: {
          metodoPagoId,
          cuentaOrigenId: cuentaId,
          fecha: '2026-04-05T12:00:00.000Z',
        },
      });
      const marzo = await service.reporte(auth, {
        desde: '2026-03-01',
        hasta: '2026-03-31',
      });
      expect(marzo.totalSalida).toBe(15_000);
    });
  });

  // ── La competencia y la zona horaria ─────────────────────────────────

  describe('fecha de competencia', () => {
    it('respeta la fecha que manda el front, sin corrimiento de día', async () => {
      // El 31 es el caso que importa: un día de más lo tira al mes siguiente y
      // el gasto queda contado en el período equivocado.
      const { id } = await service.crear(auth, {
        descripcion: 'Servicio de fin de mes',
        categoriaEgresoId: catMateriales,
        beneficiarioNombre: 'Edenor',
        fechaCompetencia: '2026-07-31',
        neto: 10_000,
        pago: { metodoPagoId, cuentaOrigenId: cuentaId },
      });
      const listado = await service.listar(auth, {});
      const fila = listado.egresos.find((e) => e.id === id);
      expect(fila?.fechaCompetencia).toBe('2026-07-31');
    });

    it('sin fecha, la toma del día en la ZONA del tenant', async () => {
      // Cargando de noche en Argentina (UTC-3), UTC ya está en el día
      // siguiente: el default tiene que salir del calendario del taller.
      const { id } = await service.crear(auth, {
        descripcion: 'Gasto sin fecha',
        categoriaEgresoId: catMateriales,
        beneficiarioNombre: 'Kiosco',
        neto: 5_000,
        pago: { metodoPagoId, cuentaOrigenId: cuentaId },
      });
      const esperado = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const listado = await service.listar(auth, {});
      const fila = listado.egresos.find((e) => e.id === id);
      expect(fila?.fechaCompetencia).toBe(esperado);
    });
  });

  // ── El resumen del lunes a la mañana ─────────────────────────────────

  describe('resumen', () => {
    it('separa lo vencido de lo que vence esta semana', async () => {
      const vencido = await service.crear(auth, {
        descripcion: 'Vencida',
        categoriaEgresoId: catMateriales,
        proveedorId,
        fechaVencimiento: '2020-01-01',
        neto: 11_000,
        tipoComprobante: 'FA',
        puntoVenta: '0002',
        numeroComprobante: nroDoc(),
      });
      const res = await service.resumen(auth);
      expect(res.aPagar).toBeGreaterThanOrEqual(11_000);
      expect(res.vencido).toBeGreaterThanOrEqual(11_000);
      expect(vencido.numero).toMatch(/^EGR-\d{4}-\d{4}$/);
    });
  });
});

// ── Regla pura ─────────────────────────────────────────────────────────

describe('estadoPorPagado', () => {
  it('nada pagado es pendiente', () => {
    expect(estadoPorPagado(1000, 0)).toBe('pendiente');
  });

  it('algo pagado es parcial', () => {
    expect(estadoPorPagado(1000, 400)).toBe('parcial');
  });

  it('todo pagado es pagado', () => {
    expect(estadoPorPagado(1000, 1000)).toBe('pagado');
  });

  it('un resto de redondeo NO deja la factura parcial para siempre', () => {
    // Sin el margen, $0,004 de diferencia la dejaban en Cuentas por pagar
    // eternamente.
    expect(estadoPorPagado(1000, 999.998)).toBe('pagado');
  });
});
