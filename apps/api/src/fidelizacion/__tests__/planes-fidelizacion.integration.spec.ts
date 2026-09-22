import {
  CATALOGO_PLANES,
  PROPUESTA_PLANES,
} from '../../plataforma/planes/catalogo-planes';
import { serviciosRecorridoF4 } from '../../../test/soporte-recorridos-f4';
import { declararUnidadPrecioFixture } from '../../../test/fixture-unidad-precio';
import { runWithTenant } from '../../common/tenant-context';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import type { CurrentAuth } from '../../auth/auth.types';
import { PermisosGuard } from '../../auth/permisos.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { CapacidadGuard } from '../../suscripciones/capacidad.guard';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { FidelizacionController } from '../fidelizacion.controller';
import { FidelizacionService } from '../fidelizacion.service';
const db = new PrismaService();
afterAll(() => db.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
async function preparar(c: Contexto, indice = 1) {
  const tenant = await c.db.tenant.create({
    data: { nombre: 'Fidelización QA', slug: `puntos-${randomUUID()}` },
  });
  const tenantId = tenant.id;
  const plan = await c.db.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Fidelización QA',
      precioMensual: 100,
      featuresJson: {},
    },
  });
  await c.db.suscripcion.create({
    data: {
      tenantId,
      planId: plan.id,
      planVersionId: c.versiones[indice].id,
      estado: 'activa',
      proveedor: 'manual',
    },
  });
  let auth: CurrentAuth = {
    ...c.auth,
    tenantId,
    permisos: new Set([
      'crm.ver',
      'comercial.gestionar',
      'crm.configurar_fidelizacion',
    ]),
  };
  const capacidades = new CapacidadesEmpresaService(c.db);
  const service = new FidelizacionService(c.db, capacidades);
  const modulo = await Test.createTestingModule({
    controllers: [FidelizacionController],
    providers: [
      Reflector,
      CapacidadGuard,
      { provide: FidelizacionService, useValue: service },
      { provide: CapacidadesEmpresaService, useValue: capacidades },
    ],
  }).compile();
  const app = modulo.createNestApplication();
  app.use((req: { auth: CurrentAuth }, _res: unknown, next: () => void) => {
    req.auth = auth;
    next();
  });
  app.useGlobalGuards(
    new PermisosGuard(new Reflector()),
    new RolesGuard(new Reflector()),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  const diagnostico = (versionId = c.versiones[0].id) =>
    c.asignaciones.diagnostico({ tenantId, versionId });
  const asignar = async (versionId = c.versiones[0].id) => {
    const d = await diagnostico(versionId);
    return c.asignaciones.asignar(c.staff, {
      tenantId,
      versionId,
      huella: d.huella,
      revision: d.actual.revision,
      operacionId: randomUUID(),
      motivo: 'Verificar retirada de Fidelización',
      revisionesAceptadas: d.revisiones,
    });
  };
  const pendiente = async () => {
    const oferta = await c.db.planOferta.create({
      data: {
        planId: plan.id,
        versionId: c.versiones[0].id,
        entorno: 'sandbox',
        registroPublico: false,
        recomendado: false,
        creadaPorId: auth.userId,
        motivo: 'QA',
      },
    });
    await c.db.planContratacion.create({
      data: {
        tenantId,
        userId: auth.userId,
        ofertaId: oferta.id,
        ciclo: 'mensual',
        adicionales: 0,
        tipo: 'checkout',
        estado: 'checkout',
        huella: 'QA',
        revisionContrato: 0,
        revisionJson: {},
        cobroJson: {},
        expiraEl: new Date(1),
      },
    });
  };
  const cliente = await c.db.cliente.create({
    data: {
      tenantId,
      nombre: 'Cliente puntos QA',
      telefonoCodigo: '54',
      telefonoNumero: '',
      paisCodigo: 'AR',
    },
  });
  const credito = (puntos = 100) =>
    service.ajustar(auth, cliente.id, {
      tipo: 'CREDITO',
      puntos,
      motivo: 'Saldo inicial QA',
    });
  const orden = (data: Record<string, unknown> = {}) =>
    c.db.ordenTrabajo.create({
      data: {
        tenantId,
        clienteId: cliente.id,
        numero: randomUUID(),
        estado: 'pendiente',
        total: 0,
        fechaEmision: new Date(),
        ...data,
      },
    });
  return {
    tenantId,
    auth,
    capacidades,
    service,
    app,
    http: request(app.getHttpServer() as Server),
    diagnostico,
    asignar,
    pendiente,
    cliente,
    credito,
    orden,
    setAuth: (value: CurrentAuth) => {
      auth = value;
    },
  };
}

it.each([0, 1, 2])(
  'historial accesible y escrituras según contrato publicado: plan %i',
  async (indice) => {
    await conPlanesAsignados(db, async (c) => {
      const x = await preparar(c, indice);
      try {
        await x.http.get('/fidelizacion/resumen').expect(200);
        await x.http.get(`/fidelizacion/clientes/${x.cliente.id}`).expect(200);
        await x.http
          .patch('/fidelizacion/configuracion')
          .send({ acumulacionActiva: true })
          .expect(indice ? 200 : 403);
        await x.http
          .post(`/fidelizacion/clientes/${x.cliente.id}/ajustes`)
          .send({ tipo: 'CREDITO', puntos: 10, motivo: 'Prueba' })
          .expect(indice ? 201 : 403);
        x.setAuth({ ...x.auth, permisos: new Set(['crm.ver']) });
        await x.http.get('/fidelizacion/resumen').expect(200);
        await x.http
          .post(`/fidelizacion/clientes/${x.cliente.id}/ajustes`)
          .send({ tipo: 'CREDITO', puntos: 10, motivo: 'Prueba' })
          .expect(403);
        x.setAuth({ ...x.auth, permisos: new Set() });
        await x.http.get('/fidelizacion/resumen').expect(403);
      } finally {
        await x.app.close();
      }
    });
  },
);

it('reserva → liberación única → retirada con saldo conservado y sin nuevas operaciones', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      await x.credito();
      const orden = await x.orden();
      const reserva = await c.db.$transaction((tx) =>
        x.service.reservar(tx, {
          tenantId: x.tenantId,
          clienteId: x.cliente.id,
          ordenId: orden.id,
          puntos: 30,
        }),
      );
      expect(reserva?.puntos).toBe(30);
      expect((await x.diagnostico()).bloqueos.join(' ')).toContain(
        'Canjes de puntos reservados',
      );
      await expect(x.asignar()).rejects.toMatchObject({ status: 409 });
      for (let n = 0; n < 2; n++)
        await c.db.$transaction((tx) =>
          x.service.liberarReservas(
            tx,
            x.tenantId,
            { ordenId: orden.id },
            'Cancelado',
          ),
        );
      expect(
        (await x.service.cuenta(x.auth, x.cliente.id)).reservadosPuntos,
      ).toBe(0);
      const d = await x.diagnostico();
      expect(
        d.diagnostico.hallazgos.find((o) => o.codigo === 'puntos_saldos')
          ?.cantidad,
      ).toBe(1);
      await x.asignar();
      expect((await x.service.cuenta(x.auth, x.cliente.id)).saldoPuntos).toBe(
        100,
      );
      await x.http.get('/fidelizacion/resumen').expect(200);
      await expect(x.credito()).rejects.toMatchObject({ status: 403 });
      await expect(
        c.db.$transaction((tx) =>
          x.service.reservar(tx, {
            tenantId: x.tenantId,
            clienteId: x.cliente.id,
            puntos: 1,
          }),
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        x.service.simular(x.tenantId, x.cliente.id, 1000, 1000, 1),
      ).rejects.toMatchObject({ status: 403 });
      expect(
        await x.service.simular(x.tenantId, x.cliente.id, 1000, 1000),
      ).toMatchObject({ puntosEstimados: 0, canjePuntos: 0 });
    } finally {
      await x.app.close();
    }
  });
});

it('canje consumido bloquea la retirada mientras la OT está abierta y su reverso se conserva sin R03', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      await x.credito();
      const orden = await x.orden({ fidelizacionCanjePuntos: 30 });
      const reserva = await c.db.$transaction((tx) =>
        x.service.reservar(tx, {
          tenantId: x.tenantId,
          clienteId: x.cliente.id,
          ordenId: orden.id,
          puntos: 30,
        }),
      );
      await c.db.$transaction((tx) =>
        x.service.consumirReserva(tx, x.auth, orden.id, reserva!.id),
      );
      expect((await x.service.cuenta(x.auth, x.cliente.id)).saldoPuntos).toBe(
        70,
      );
      expect((await x.diagnostico()).bloqueos.join(' ')).toContain(
        'Órdenes con puntos por resolver',
      );
      await c.db.ordenTrabajo.update({
        where: { id: orden.id },
        data: { estado: 'entregada' },
      });
      await x.asignar();
      for (let n = 0; n < 2; n++)
        await c.db.$transaction((tx) =>
          x.service.revertirCanjeOrden(
            tx,
            x.tenantId,
            orden.id,
            'Anulación histórica',
          ),
        );
      const cuenta = await x.service.cuenta(x.auth, x.cliente.id);
      expect(cuenta.saldoPuntos).toBe(100);
      expect(
        cuenta.movimientos.filter((m) => m.tipo === 'REVERSO_CANJE'),
      ).toHaveLength(1);
    } finally {
      await x.app.close();
    }
  });
});

it('los puntos prometidos deben acreditarse; una corrección histórica puede revertir y restaurar sin duplicar', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      const orden = await x.orden({
        fidelizacionPuntosEstimados: 20,
        fidelizacionCanjePuntos: 0,
      });
      expect((await x.diagnostico()).bloqueos.join(' ')).toContain(
        'Órdenes con puntos por resolver',
      );
      // Entregada pero sin pago suficiente: todavía hay un compromiso.
      await c.db.ordenTrabajo.update({
        where: { id: orden.id },
        data: { estado: 'entregada', total: 10 },
      });
      await c.db.$transaction((tx) =>
        x.service.reconciliarOrden(tx, x.tenantId, orden.id),
      );
      expect((await x.diagnostico()).bloqueos.join(' ')).toContain(
        'Órdenes con puntos por resolver',
      );
      // Una OT bonificada no requiere un cobro artificial.
      await c.db.ordenTrabajo.update({
        where: { id: orden.id },
        data: { total: 0 },
      });
      for (let n = 0; n < 2; n++)
        await c.db.$transaction((tx) =>
          x.service.reconciliarOrden(tx, x.tenantId, orden.id),
        );
      expect((await x.service.cuenta(x.auth, x.cliente.id)).saldoPuntos).toBe(
        20,
      );
      await x.asignar();
      for (let n = 0; n < 3; n++) {
        await c.db.ordenTrabajo.update({
          where: { id: orden.id },
          data: { estado: 'pendiente' },
        });
        await c.db.$transaction((tx) =>
          x.service.reconciliarOrden(tx, x.tenantId, orden.id),
        );
        expect((await x.service.cuenta(x.auth, x.cliente.id)).saldoPuntos).toBe(
          0,
        );
        await c.db.ordenTrabajo.update({
          where: { id: orden.id },
          data: { estado: 'entregada' },
        });
        await c.db.$transaction((tx) =>
          x.service.reconciliarOrden(tx, x.tenantId, orden.id),
        );
        expect((await x.service.cuenta(x.auth, x.cliente.id)).saldoPuntos).toBe(
          20,
        );
      }
      const otra = await x.orden({
        estado: 'entregada',
        fidelizacionPuntosEstimados: 40,
      });
      await c.db.$transaction((tx) =>
        x.service.reconciliarOrden(tx, x.tenantId, otra.id),
      );
      expect((await x.service.cuenta(x.auth, x.cliente.id)).saldoPuntos).toBe(
        20,
      );
    } finally {
      await x.app.close();
    }
  });
});

it('presupuestos y borradores con puntos se detectan antes de cambiar el plan', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      const presupuesto = await c.db.cotizacion.create({
        data: {
          tenantId: x.tenantId,
          numero: 'PRES-QA',
          estado: 'borrador',
          fidelizacionPuntosEstimados: 5,
        },
      });
      const orden = await x.orden({
        estado: 'borrador',
        fechaEmision: null,
        fidelizacionPuntosEstimados: 8,
      });
      const d = await x.diagnostico();
      expect(d.bloqueos.join(' ')).toContain(
        'Presupuestos con puntos comprometidos',
      );
      expect(d.bloqueos.join(' ')).toContain('Órdenes con puntos por resolver');
      await c.db.cotizacion.update({
        where: { id: presupuesto.id },
        data: { estado: 'rechazado' },
      });
      await c.db.ordenTrabajo.update({
        where: { id: orden.id },
        data: { estado: 'cancelada' },
      });
      await x.asignar();
      await expect(
        c.db.$transaction((tx) =>
          x.service.exigirCompromisoTx(tx, x.tenantId, { puntosEstimados: 5 }),
        ),
      ).rejects.toMatchObject({ status: 403 });
      await c.db.$transaction((tx) =>
        x.service.exigirCompromisoTx(tx, x.tenantId, {
          puntosEstimados: 0,
          canjePuntos: 0,
        }),
      );
    } finally {
      await x.app.close();
    }
  });
});

it('un checkout que retira R03 congela nuevos compromisos, configuración y ajustes', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      await x.credito();
      await x.pendiente();
      await expect(x.credito()).rejects.toMatchObject({ status: 409 });
      await expect(
        x.service.actualizarConfiguracion(x.auth, { acumulacionActiva: true }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        c.db.$transaction((tx) =>
          x.service.exigirCompromisoTx(tx, x.tenantId, { puntosEstimados: 1 }),
        ),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        c.db.$transaction((tx) =>
          x.service.reservar(tx, {
            tenantId: x.tenantId,
            clienteId: x.cliente.id,
            puntos: 10,
          }),
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect((await x.service.cuenta(x.auth, x.cliente.id)).saldoPuntos).toBe(
        100,
      );
    } finally {
      await x.app.close();
    }
  });
});

it('simular no crea datos y no expone saldos de clientes de otra empresa; vencida conserva consulta', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      await x.service.simular(x.tenantId, x.cliente.id, 1000, 1000);
      expect(
        await c.db.configuracionFidelizacion.count({
          where: { tenantId: x.tenantId },
        }),
      ).toBe(0);
      expect(
        await c.db.fidelizacionCuenta.count({
          where: { tenantId: x.tenantId },
        }),
      ).toBe(0);
      const ajeno = await c.db.cliente.create({
        data: {
          tenantId: c.tenantId,
          nombre: 'Ajeno',
          telefonoCodigo: '54',
          telefonoNumero: '',
          paisCodigo: 'AR',
        },
      });
      await x.http.get(`/fidelizacion/clientes/${ajeno.id}`).expect(404);
      await x.http
        .post(`/fidelizacion/clientes/${ajeno.id}/simular`)
        .send({ margen: 100, total: 100 })
        .expect(404);
      await x.credito();
      await c.db.suscripcion.update({
        where: { tenantId: x.tenantId },
        data: { estado: 'vencida' },
      });
      await x.http.get('/fidelizacion/resumen').expect(200);
      await x.http
        .post(`/fidelizacion/clientes/${x.cliente.id}/ajustes`)
        .send({ tipo: 'CREDITO', puntos: 10, motivo: 'Prueba' })
        .expect(403);
    } finally {
      await x.app.close();
    }
  });
});

it('convertir parte del presupuesto conserva el canje de su OT al liberar el remanente', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      await x.credito();
      const presupuesto = await c.db.cotizacion.create({
        data: { tenantId: x.tenantId, estado: 'aprobado' },
      });
      await c.db.$transaction((tx) =>
        x.service.reservar(tx, {
          tenantId: x.tenantId,
          clienteId: x.cliente.id,
          cotizacionId: presupuesto.id,
          puntos: 60,
        }),
      );
      const orden = await x.orden({
        estado: 'borrador',
        fidelizacionCanjePuntos: 20,
      });
      const parcial = await c.db.$transaction((tx) =>
        x.service.reservarParaOrden(tx, {
          tenantId: x.tenantId,
          clienteId: x.cliente.id,
          cotizacionId: presupuesto.id,
          ordenId: orden.id,
          puntos: 20,
        }),
      );
      await c.db.$transaction((tx) =>
        x.service.liberarReservas(
          tx,
          x.tenantId,
          { cotizacionId: presupuesto.id },
          'Cancelado el resto',
        ),
      );
      expect(
        (await x.service.cuenta(x.auth, x.cliente.id)).reservadosPuntos,
      ).toBe(20);
      expect(
        (
          await c.db.fidelizacionReserva.findUniqueOrThrow({
            where: { id: parcial!.id },
          })
        ).estado,
      ).toBe('RESERVADA');
      await c.db.$transaction((tx) =>
        x.service.consumirReserva(tx, x.auth, orden.id, parcial!.id),
      );
      expect(await x.service.cuenta(x.auth, x.cliente.id)).toMatchObject({
        saldoPuntos: 80,
        reservadosPuntos: 0,
      });
    } finally {
      await x.app.close();
    }
  });
});

it.each([0, 10])(
  'motor → borrador → emisión → cancelación con canje de %i puntos',
  async (canje) => {
    await conPlanesAsignados(db, async (c) => {
      await c.asignar(c.versiones[1].id);
      await runWithTenant(c.tenantId, async () => {
        await declararUnidadPrecioFixture(c.tx, c.tenantId);
        const puntos = new FidelizacionService(c.db);
        await puntos.actualizarConfiguracion(c.auth, {
          acumulacionActiva: true,
          porcentajeMargen: 10,
        });
        const cliente = await c.db.cliente.create({
          data: {
            tenantId: c.tenantId,
            nombre: 'Fidelización recorrido',
            telefonoCodigo: '54',
            telefonoNumero: '',
            paisCodigo: 'AR',
          },
        });
        if (canje)
          await puntos.ajustar(c.auth, cliente.id, {
            tipo: 'CREDITO',
            puntos: 100,
            motivo: 'Inicio QA',
          });
        const motor = new MotorUniversalService(
          c.db,
          new AplicarPrecioService(),
          new PreciosEspecialesClientesService(c.db),
        );
        const producto = await c.db.producto.findFirstOrThrow({
          where: { codigo: 'TARJ-PREMIUM-300' },
        });
        const cotizar = () =>
          motor.cotizarYGuardar({
            tenantId: c.tenantId,
            productoId: producto.id,
            periodo: '2026-06',
            jobContext: { cantidad: 500, caras: 2 },
          });
        const cotizada = await cotizar();
        expect(cotizada.result.errores).toEqual([]);
        const { ordenes } = serviciosRecorridoF4(c.db);
        const payload = {
          idempotencyKey: randomUUID(),
          estado: 'borrador',
          clienteId: cliente.id,
          canalVenta: 'mostrador',
          cotizacionId: cotizada.cotizacionId!,
          fidelizacionCanjePuntos: canje,
          fechaEntrega: '2099-12-01',
          items: [
            {
              cotizacionItemId: cotizada.cotizacionItemId!,
              codigo: producto.codigo,
              nombre: producto.nombre,
              familia: 'Tarjetas',
              cantidad: 500,
              cantidadUnidad: 'u',
              subtotal: 0,
              impuestos: 0,
              total: 0,
            },
          ],
        };
        const orden = await ordenes.create(c.auth, payload);
        const guardada = await c.db.ordenTrabajo.findUniqueOrThrow({
          where: { id: orden.id },
        });
        if (canje)
          expect(
            (await puntos.cuenta(c.auth, cliente.id)).reservadosPuntos,
          ).toBe(canje);
        else expect(guardada.fidelizacionPuntosEstimados).toBeGreaterThan(0);
        expect(
          (await c.diagnosticar(c.versiones[0].id)).bloqueos.join(' '),
        ).toContain('Órdenes con puntos por resolver');
        await ordenes.cambiarEstado(c.auth, orden.id, { estado: 'pendiente' });
        if (canje)
          expect(await puntos.cuenta(c.auth, cliente.id)).toMatchObject({
            saldoPuntos: 90,
            reservadosPuntos: 0,
          });
        await ordenes.cancelar(c.auth, orden.id, {
          motivo: 'Fin QA fidelización',
        });
        if (canje)
          expect(await puntos.cuenta(c.auth, cliente.id)).toMatchObject({
            saldoPuntos: 100,
            reservadosPuntos: 0,
          });
        // Cambiar el contrato después de simular no permite guardar el compromiso.
        const nueva = await cotizar();
        // Se invoca con .call(this) para mantener la instancia original.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const simular = FidelizacionService.prototype.simular;
        let retirada = false;
        const entrada = jest
          .spyOn(FidelizacionService.prototype, 'simular')
          .mockImplementation(async function (...args) {
            const resultado = await simular.call(this, ...args);
            if (!retirada && args[0] === c.tenantId) {
              retirada = true;
              await c.asignar(c.versiones[0].id);
            }
            return resultado;
          });
        const antes = await c.db.ordenTrabajo.count({
          where: { tenantId: c.tenantId },
        });
        try {
          await expect(
            ordenes.create(c.auth, {
              ...payload,
              idempotencyKey: randomUUID(),
              cotizacionId: nueva.cotizacionId!,
              items: [
                {
                  ...payload.items[0],
                  cotizacionItemId: nueva.cotizacionItemId!,
                },
              ],
            }),
          ).rejects.toMatchObject({ status: 403 });
          expect(retirada).toBe(true);
          expect(
            await c.db.ordenTrabajo.count({ where: { tenantId: c.tenantId } }),
          ).toBe(antes);
        } finally {
          entrada.mockRestore();
        }
      });
    });
  },
);

it('Fidelización funciona con Clientes y base, sin exigir Cupones, Tesorería ni Reportes', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c, 0);
    try {
      const version = await c.publicar({
        ...structuredClone(PROPUESTA_PLANES[0].contenido),
        almacenamientoModo: 'limitado',
        almacenamientoGb: 250,
        funciones: Object.fromEntries(
          CATALOGO_PLANES.map((f) => [
            f.clave,
            f.base || ['clientes', 'fidelizacion'].includes(f.clave),
          ]),
        ),
      });
      await x.asignar(version.id);
      await x.service.actualizarConfiguracion(x.auth, {
        acumulacionActiva: true,
        porcentajeMargen: 10,
      });
      await x.credito();
      expect(
        await x.service.simular(x.tenantId, x.cliente.id, 10000, 10000),
      ).toMatchObject({ saldoDisponible: 100, puntosEstimados: 100 });
      expect(
        await x.service.simular(x.tenantId, null, 10000, 10000),
      ).toMatchObject({ puntosEstimados: 0 });
      await x.http.get('/fidelizacion/resumen').expect(200);
    } finally {
      await x.app.close();
    }
  });
});
