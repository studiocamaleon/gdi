import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { EgresosService } from '../../egresos/egresos.service';
import { RecurrentesService } from '../../egresos/recurrentes.service';
import { CobrosService } from '../../administracion/cobros.service';
import { TesoreriaService } from '../../administracion/tesoreria.service';

const prisma = new PrismaService();
afterAll(() => prisma.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
const pendiente = { response: { code: 'CAMBIO_PLAN_PENDIENTE' } };

async function preparar(c: Contexto) {
  const tenant = await c.tx.tenant.create({
    data: {
      nombre: 'Finanzas aisladas de prueba',
      slug: `finanzas-planes-${randomUUID()}`,
    },
  });
  const tenantId = tenant.id;
  const auth = { ...c.auth, tenantId };
  const plan = await c.tx.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Contrato financiero',
      precioMensual: 290,
      featuresJson: {},
    },
  });
  await c.tx.suscripcion.create({
    data: {
      tenantId,
      planId: plan.id,
      planVersionId: c.versiones[1].id,
      estado: 'activa',
      proveedor: 'manual',
    },
  });
  const oferta =
    (await c.tx.planOferta.findFirst({
      where: { versionId: c.versiones[0].id, entorno: 'sandbox' },
    })) ??
    (await c.tx.planOferta.create({
      data: {
        planId: plan.id,
        versionId: c.versiones[0].id,
        entorno: 'sandbox',
        registroPublico: false,
        recomendado: false,
        creadaPorId: auth.userId,
        motivo: 'Ensayo de continuidad financiera',
      },
    }));
  const categoria = await c.tx.categoriaEgreso.create({
    data: {
      tenantId,
      codigo: 'PRUEBA',
      nombre: 'Gasto de prueba',
      naturaleza: 'GASTO_ESTRUCTURA',
    },
  });
  const cuenta = await c.tx.cuentaFondos.create({
    data: { tenantId, nombre: 'Banco de prueba', tipo: 'banco', saldo: 10000 },
  });
  const metodo = await c.tx.metodoPago.create({
    data: {
      tenantId,
      codigo: 'EFECTIVO',
      nombre: 'Efectivo',
      tipo: 'efectivo',
    },
  });
  const cheque = await c.tx.metodoPago.create({
    data: {
      tenantId,
      codigo: 'CHEQUE',
      nombre: 'Cheque',
      tipo: 'cheque_echeq',
    },
  });
  const egresos = new EgresosService(
    c.db,
    {} as never,
    {} as never,
    {} as never,
  );
  const recurrentes = new RecurrentesService(c.db);
  const recibos = {
    numerar: jest.fn().mockResolvedValue('REC-ENSAYO'),
    emitirEnlace: jest.fn().mockResolvedValue(undefined),
    materializarPdfEnSegundoPlano: jest.fn(),
  };
  const avisos = { avisar: jest.fn().mockResolvedValue(undefined) };
  const cobros = new CobrosService(
    c.db,
    {
      aplicarCobroComercial: jest.fn().mockResolvedValue([]),
      matchearCobro: jest.fn().mockResolvedValue(undefined),
      revertirCobro: jest.fn().mockResolvedValue(undefined),
    } as never,
    recibos as never,
    avisos as never,
    { reconciliarOrden: jest.fn().mockResolvedValue(undefined) } as never,
  );
  const tesoreria = new TesoreriaService(c.db, cobros);
  const crearEgreso = () =>
    egresos.crear(auth, {
      descripcion: 'Factura de ensayo',
      categoriaEgresoId: categoria.id,
      beneficiarioNombre: 'Proveedor',
      neto: 100,
      fechaVencimiento: '2099-01-01',
    });
  const plantilla = {
    descripcion: 'Alquiler de ensayo',
    categoriaEgresoId: categoria.id,
    monto: 100,
    vigenteDesde: new Date().toISOString().slice(0, 7),
  };
  const pagar = (egresoId: string) =>
    egresos.registrarPago(auth, {
      metodoPagoId: metodo.id,
      cuentaOrigenId: cuenta.id,
      imputaciones: [{ egresoId, monto: 100 }],
      idempotencyKey: randomUUID(),
    });
  const iniciar = (estado = 'checkout') =>
    c.tx.planContratacion.create({
      data: {
        tenantId,
        userId: auth.userId,
        ofertaId: oferta.id,
        ciclo: 'mensual',
        adicionales: 0,
        tipo: 'checkout',
        estado,
        huella: 'prueba',
        revisionContrato: 0,
        revisionJson: {},
        cobroJson: {},
        expiraEl: new Date(1),
      },
    });
  const cobrarCheque = () =>
    cobros.create(auth, {
      fecha: '2026-09-01',
      metodoPagoId: cheque.id,
      montoBruto: 100,
      comisionPctAplicada: 0,
      valor: {
        origen: 'tercero',
        formato: 'echeq',
        numero: randomUUID(),
        banco: 'Banco de prueba',
        fechaPago: '2026-09-01',
      },
    });
  return {
    tenantId,
    auth,
    egresos,
    recurrentes,
    cobros,
    tesoreria,
    categoria,
    cuenta,
    metodo,
    cheque,
    crearEgreso,
    plantilla,
    pagar,
    iniciar,
    cobrarCheque,
    avisos,
  };
}

describe('Contrato pendiente y compromisos financieros', () => {
  it.each(['enviando', 'checkout', 'verificar'])(
    'no crea egresos ni activa/genera recurrentes durante %s; permite desactivar y consultar',
    (estado) =>
      conPlanesAsignados(prisma, async (c) => {
        const x = await preparar(c);
        const activa = await x.recurrentes.crear(x.auth, x.plantilla);
        const pausada = await x.recurrentes.crear(x.auth, x.plantilla);
        await x.recurrentes.editar(x.auth, pausada.id, { activo: false });
        const intento = await x.iniciar(estado);
        await expect(x.crearEgreso()).rejects.toMatchObject(pendiente);
        await expect(
          x.recurrentes.crear(x.auth, x.plantilla),
        ).rejects.toMatchObject(pendiente);
        await expect(
          x.recurrentes.editar(x.auth, pausada.id, { activo: true }),
        ).rejects.toMatchObject(pendiente);
        await expect(
          x.recurrentes.generarDeTenant(x.tenantId),
        ).rejects.toMatchObject(pendiente);
        expect(
          await c.tx.egreso.count({ where: { tenantId: x.tenantId } }),
        ).toBe(0);
        expect(
          (
            await c.tx.gastoRecurrente.findUniqueOrThrow({
              where: { id: activa.id },
            })
          ).ultimoPeriodoGenerado,
        ).toBeNull();
        await x.recurrentes.editar(x.auth, activa.id, { activo: false });
        expect((await x.recurrentes.listar(x.auth)).recurrentes).toHaveLength(
          2,
        );
        await c.tx.planContratacion.update({
          where: { id: intento.id },
          data: { estado: 'rechazada' },
        });
        await x.recurrentes.editar(x.auth, pausada.id, { activo: true });
        expect(await x.recurrentes.generarDeTenant(x.tenantId)).toBe(1);
        expect(await x.recurrentes.generarDeTenant(x.tenantId)).toBe(0);
      }),
  );

  it('permite pagar o anular un egreso existente y bloquea la reapertura de deuda por anulación de pago', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      const a = await x.crearEgreso(),
        b = await x.crearEgreso(),
        d = await x.crearEgreso();
      const pago = await x.pagar(a.id);
      const intento = await x.iniciar();
      await x.pagar(b.id);
      await x.egresos.anular(x.auth, d.id, {
        motivo: 'Cerrar deuda de prueba',
      });
      await expect(
        x.egresos.anularPago(x.auth, pago.id, {
          motivo: 'Reabrir deuda de prueba',
        }),
      ).rejects.toMatchObject(pendiente);
      expect(
        (await c.tx.egreso.findUniqueOrThrow({ where: { id: a.id } })).estado,
      ).toBe('pagado');
      expect(
        Number(
          (
            await c.tx.cuentaFondos.findUniqueOrThrow({
              where: { id: x.cuenta.id },
            })
          ).saldo,
        ),
      ).toBe(9800);
      await c.tx.planContratacion.update({
        where: { id: intento.id },
        data: { estado: 'rechazada' },
      });
      await x.egresos.anularPago(x.auth, pago.id, {
        motivo: 'Corrección autorizada de prueba',
      });
      expect(
        (await c.tx.egreso.findUniqueOrThrow({ where: { id: a.id } })).estado,
      ).toBe('pendiente');
    }));

  it('no registra un cheque de tercero ni emite uno propio si el cambio retira Valores', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      const e = await x.crearEgreso();
      await x.iniciar();
      await expect(x.cobrarCheque()).rejects.toMatchObject(pendiente);
      await expect(
        x.egresos.registrarPago(x.auth, {
          metodoPagoId: x.cheque.id,
          cuentaOrigenId: x.cuenta.id,
          imputaciones: [{ egresoId: e.id, monto: 100 }],
          cheque: {
            numero: 'TEST-1',
            banco: 'Banco de prueba',
            formato: 'echeq',
            modalidad: 'comun',
          },
        }),
      ).rejects.toMatchObject(pendiente);
      expect(await c.tx.valor.count({ where: { tenantId: x.tenantId } })).toBe(
        0,
      );
      expect(await c.tx.pago.count({ where: { tenantId: x.tenantId } })).toBe(
        0,
      );
      expect(x.avisos.avisar).not.toHaveBeenCalled();
    }));

  it('no vuelve a dejar pendiente un cheque acreditado mientras se retira su gestión', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      const cobro = await x.cobrarCheque();
      const valor = await c.tx.valor.findFirstOrThrow({
        where: { tenantId: x.tenantId },
      });
      await x.tesoreria.depositarValor(x.auth, valor.id, {
        cuentaDestinoId: x.cuenta.id,
        fecha: '2026-09-02',
      });
      await x.tesoreria.acreditarValor(x.auth, valor.id, {
        fecha: '2026-09-03',
      });
      await x.iniciar();
      await expect(
        x.tesoreria.revertirAcreditacionValor(x.auth, valor.id, {
          motivo: 'Corrección de prueba',
        }),
      ).rejects.toMatchObject(pendiente);
      await expect(
        x.tesoreria.rechazarValor(x.auth, valor.id, {
          motivo: 'Rechazo de prueba',
        }),
      ).rejects.toMatchObject(pendiente);
      await expect(
        x.cobros.anular(x.auth, cobro.id, { motivo: 'Anulación de prueba' }),
      ).rejects.toMatchObject(pendiente);
      expect(
        (await c.tx.valor.findUniqueOrThrow({ where: { id: valor.id } }))
          .estado,
      ).toBe('acreditado');
      expect(
        Number(
          (
            await c.tx.cuentaFondos.findUniqueOrThrow({
              where: { id: x.cuenta.id },
            })
          ).saldo,
        ),
      ).toBe(10100);
    }));

  it('vuelve a leer una plantilla pausada después de la consulta inicial del generador', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      const plantilla = await x.recurrentes.crear(x.auth, x.plantilla);
      let interceptado = false;
      const cliente = new Proxy(c.db, {
        get(target, prop) {
          if (prop === '$transaction')
            return async (
              run: Parameters<PrismaService['$transaction']>[0],
            ) => {
              interceptado = true;
              await c.tx.gastoRecurrente.update({
                where: { id: plantilla.id },
                data: { activo: false },
              });
              return target.$transaction(run);
            };
          return Reflect.get(target, prop) as unknown;
        },
      });
      expect(
        await new RecurrentesService(cliente).generarDeTenant(x.tenantId),
      ).toBe(0);
      expect(interceptado).toBe(true);
      expect(await c.tx.egreso.count({ where: { tenantId: x.tenantId } })).toBe(
        0,
      );
    }));

  it('en sólo lectura conserva las acreditaciones pendientes sin escribir al consultar su historial', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      await c.tx.cobro.create({
        data: {
          tenantId: x.tenantId,
          fecha: new Date(),
          metodoPagoId: x.metodo.id,
          cuentaDestinoId: x.cuenta.id,
          montoBruto: 100,
          comisionPctAplicada: 0,
          comisionMonto: 0,
          comisionIvaMonto: 0,
          netoAcreditado: 100,
          retencionesTotal: 0,
          disponibleReal: 100,
          estadoAcreditacion: 'pendiente',
          fechaAcreditacionEstimada: new Date(1),
        },
      });
      await c.tx.suscripcion.update({
        where: { tenantId: x.tenantId },
        data: { estado: 'baja' },
      });
      const pendientes = await x.cobros.pendientesAcreditacion(x.auth);
      expect(pendientes).toHaveLength(1);
      expect(
        (
          await c.tx.cobro.findUniqueOrThrow({
            where: { id: pendientes[0].id },
          })
        ).estadoAcreditacion,
      ).toBe('pendiente');
      expect(
        await c.tx.movimientoFondos.count({ where: { tenantId: x.tenantId } }),
      ).toBe(0);
    }));

  it(
    'el barrido avanza sobre una página completa de empresas en sólo lectura y acredita las siguientes',
    () =>
      conPlanesAsignados(prisma, async (c) => {
        const cerrada = await preparar(c);
        const activa = await preparar(c);
        const datos = (x: typeof activa) => ({
          tenantId: x.tenantId,
          fecha: new Date(),
          metodoPagoId: x.metodo.id,
          cuentaDestinoId: x.cuenta.id,
          montoBruto: 100,
          comisionPctAplicada: 0,
          comisionMonto: 0,
          comisionIvaMonto: 0,
          netoAcreditado: 100,
          retencionesTotal: 0,
          disponibleReal: 100,
          estadoAcreditacion: 'pendiente',
          fechaAcreditacionEstimada: new Date(1),
        });
        await c.tx.cobro.createMany({
          data: Array.from({ length: 500 }, (_, i) => ({
            ...datos(cerrada),
            id: `00000000-0000-4000-8000-${(i + 1).toString(16).padStart(12, '0')}`,
          })),
        });
        const cobro = await c.tx.cobro.create({
          data: {
            ...datos(activa),
            id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          },
        });
        await c.tx.suscripcion.update({
          where: { tenantId: cerrada.tenantId },
          data: { estado: 'baja' },
        });
        await activa.cobros.barrerVencidos();
        expect(
          (await c.tx.cobro.findUniqueOrThrow({ where: { id: cobro.id } }))
            .estadoAcreditacion,
        ).toBe('acreditado');
        expect(
          await c.tx.cobro.count({
            where: {
              tenantId: cerrada.tenantId,
              estadoAcreditacion: 'pendiente',
            },
          }),
        ).toBe(500);
        expect(
          await c.tx.movimientoFondos.count({
            where: { tenantId: cerrada.tenantId },
          }),
        ).toBe(0);
        expect(
          await c.tx.movimientoFondos.count({
            where: { tenantId: activa.tenantId },
          }),
        ).toBe(1);
      }),
    90000,
  );
});
