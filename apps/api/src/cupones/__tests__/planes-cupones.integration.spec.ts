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
import { CuponesController } from '../cupones.controller';
import { CuponesService } from '../cupones.service';
import { serviciosRecorridoF4 } from '../../../test/soporte-recorridos-f4';
import { declararUnidadPrecioFixture } from '../../../test/fixture-unidad-precio';
import { runWithTenant } from '../../common/tenant-context';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';

const db = new PrismaService();
afterAll(() => db.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
const dto = { codigo: 'PROMO-QA', tipo: 'PORCENTAJE', valor: 10 } as const;

it.each(['borrador', 'pendiente'] as const)(
  'cotización con cupón → OT %s → emisión → cancelación libera el uso sin duplicarlo',
  async (estado) => {
    await conPlanesAsignados(db, async (c) => {
      await c.asignar(c.versiones[1].id);
      await runWithTenant(c.tenantId, async () => {
        await declararUnidadPrecioFixture(c.tx, c.tenantId);
        const cupones = new CuponesService(c.db);
        const cupon = await cupones.crear(c.auth, {
          ...dto,
          codigo: `PROMO-${randomUUID()}`,
          usoMax: 1,
        });
        const motor = new MotorUniversalService(
          c.db,
          new AplicarPrecioService(),
          new PreciosEspecialesClientesService(c.db),
        );
        const producto = await c.db.producto.findFirstOrThrow({
          where: { codigo: 'TARJ-PREMIUM-300' },
        });
        const cotizada = await motor.cotizarYGuardar({
          tenantId: c.tenantId,
          productoId: producto.id,
          periodo: '2026-06',
          jobContext: { cantidad: 500, caras: 2 },
          descuento: { tipo: 'PORCENTAJE', valor: 10 },
        });
        expect(cotizada.result.errores).toEqual([]);
        const { ordenes } = serviciosRecorridoF4(c.db);
        const cliente = await c.db.cliente.create({
          data: {
            tenantId: c.tenantId,
            nombre: `Cupones ${randomUUID()}`,
            telefonoCodigo: '54',
            telefonoNumero: '',
            paisCodigo: 'AR',
          },
        });
        const payload = {
          idempotencyKey: randomUUID(),
          estado,
          clienteId: cliente.id,
          canalVenta: 'mostrador',
          cotizacionId: cotizada.cotizacionId!,
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
              descuentoCuponId: cupon.id,
            },
          ],
        };
        const orden = await ordenes.create(c.auth, payload);
        const d = await c.diagnosticar(c.versiones[0].id);
        expect(d.bloqueos.join(' ')).toContain('Órdenes abiertas con cupones');
        if (estado === 'borrador')
          await ordenes.cambiarEstado(c.auth, orden.id, {
            estado: 'pendiente',
          });
        const redenciones = await c.db.cuponRedencion.findMany({
          where: { cuponId: cupon.id },
        });
        expect(redenciones).toHaveLength(1);
        expect(redenciones[0].estado).toBe('CONSUMIDA');
        expect(Number(redenciones[0].montoAplicado)).toBeGreaterThan(0);
        expect(
          (await c.db.cupon.findUniqueOrThrow({ where: { id: cupon.id } }))
            .usoCount,
        ).toBe(1);
        // Repetir el alta con la misma clave devuelve la misma OT y no toma otro uso.
        expect((await ordenes.create(c.auth, payload)).id).toBe(orden.id);
        await ordenes.cancelar(c.auth, orden.id, {
          motivo: 'Prueba de reversión del cupón',
        });
        expect(
          (await c.db.cupon.findUniqueOrThrow({ where: { id: cupon.id } }))
            .usoCount,
        ).toBe(0);
        expect(
          (
            await c.db.cuponRedencion.findUniqueOrThrow({
              where: { id: redenciones[0].id },
            })
          ).estado,
        ).toBe('LIBERADA');
        const nueva = await motor.cotizarYGuardar({
          tenantId: c.tenantId,
          productoId: producto.id,
          periodo: '2026-06',
          jobContext: { cantidad: 500, caras: 2 },
          descuento: { tipo: 'PORCENTAJE', valor: 10 },
        });
        const cantidadAntes = await c.db.ordenTrabajo.count({
          where: { tenantId: c.tenantId },
        });
        // Se invoca con .call(this) para conservar cada instancia intervenida.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const exigir = CapacidadesEmpresaService.prototype.exigir;
        let retirada = false;
        const entrada = jest
          .spyOn(CapacidadesEmpresaService.prototype, 'exigir')
          .mockImplementation(async function (tenantId, clave, tx) {
            await exigir.call(this, tenantId, clave, tx);
            if (tenantId === c.tenantId && clave === 'cupones' && !retirada) {
              retirada = true;
              await c.asignar(c.versiones[0].id);
            }
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
          ).toBe(cantidadAntes);
        } finally {
          entrada.mockRestore();
        }
      });
    });
  },
);

async function preparar(c: Contexto, indice = 1) {
  const tenant = await c.db.tenant.create({
    data: { nombre: 'Cupones QA', slug: `cupones-${randomUUID()}` },
  });
  const tenantId = tenant.id;
  const plan = await c.db.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Cupones QA',
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
      'comercial.aprobar_descuento',
    ]),
  };
  const capacidades = new CapacidadesEmpresaService(c.db);
  const service = new CuponesService(c.db, capacidades);
  const modulo = await Test.createTestingModule({
    controllers: [CuponesController],
    providers: [
      Reflector,
      CapacidadGuard,
      { provide: CuponesService, useValue: service },
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
  const diagnostico = () =>
    c.asignaciones.diagnostico({ tenantId, versionId: c.versiones[0].id });
  const asignar = async () => {
    const d = await diagnostico();
    return c.asignaciones.asignar(c.staff, {
      tenantId,
      versionId: c.versiones[0].id,
      huella: d.huella,
      revision: d.actual.revision,
      operacionId: randomUUID(),
      motivo: 'Verificar retirada de Cupones',
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
  const presupuesto = async (cuponId: string) => {
    const cotizacion = await c.db.cotizacion.create({
      data: { tenantId, numero: 'PRES-QA', estado: 'enviado' },
    });
    // Son los importes autorizados por el caller; la reserva vuelve a validar
    // la distribución contra las reglas del cupón, no confía en su descuento.
    const items = [
      {
        cotizacionItemId: randomUUID(),
        codigo: 'QA',
        subtotal: 90,
        descuentoTipo: 'PORCENTAJE',
        descuentoValor: 10,
        descuentoMonto: 10,
        descuentoCuponId: cuponId,
      },
    ];
    const reservar = () =>
      c.db.$transaction((tx) =>
        service.reservarParaPresupuesto(tx, auth, cotizacion.id, null, items),
      );
    const liberar = () =>
      c.db.$transaction((tx) =>
        service.liberarReservasPresupuesto(
          tx,
          tenantId,
          cotizacion.id,
          'Presupuesto rechazado',
        ),
      );
    return { cotizacion, reservar, liberar };
  };
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
    presupuesto,
    setAuth: (value: CurrentAuth) => {
      auth = value;
    },
  };
}

async function escenario(
  c: Contexto,
  fn: (f: Awaited<ReturnType<typeof preparar>>) => Promise<void>,
  indice = 1,
) {
  const f = await preparar(c, indice);
  try {
    await fn(f);
  } finally {
    await f.app.close();
  }
}

it.each([0, 1, 2])(
  'contrato %i: consulta, creación, validación y permisos por HTTP',
  async (indice) => {
    await conPlanesAsignados(db, (c) =>
      escenario(
        c,
        async (f) => {
          await f.http.get('/cupones').expect(200);
          const creada = await f.http
            .post('/cupones')
            .send(dto)
            .expect(indice ? 201 : 403);
          if (!indice) return;
          const id = (creada.body as { id: string }).id;
          await f.http
            .post('/cupones/validar')
            .send({ codigo: dto.codigo, items: [{ key: 'a', neto: 100 }] })
            .expect(201);
          await f.http.get(`/cupones/${id}/historial`).expect(200);
          f.setAuth({ ...f.auth, permisos: new Set() });
          await f.http.get('/cupones').expect(403);
          await f.http.get(`/cupones/${id}/historial`).expect(403);
          await f.http
            .post('/cupones')
            .send({ ...dto, codigo: 'OTRO' })
            .expect(403);
        },
        indice,
      ),
    );
  },
);

it('la reserva bloquea retirar Cupones; liberar permite asignar y conserva el historial sin habilitar escrituras', async () => {
  await conPlanesAsignados(db, (c) =>
    escenario(c, async (f) => {
      const cupon = await f.service.crear(f.auth, dto);
      const p = await f.presupuesto(cupon.id);
      await p.reservar();
      await p.reservar();
      expect(
        (await c.db.cupon.findUniqueOrThrow({ where: { id: cupon.id } }))
          .usoCount,
      ).toBe(1);
      const d = await f.diagnostico();
      expect(d.bloqueos.join(' ')).toContain(
        'Cupones comprometidos en presupuestos',
      );
      await expect(f.asignar()).rejects.toMatchObject({ status: 409 });
      await p.liberar();
      await p.liberar();
      await f.asignar();
      await f.http.get('/cupones').expect(200);
      const historial = await f.http
        .get(`/cupones/${cupon.id}/historial`)
        .expect(200);
      expect(historial.body as unknown).toMatchObject({
        redenciones: [{ estado: 'LIBERADA', montoAplicado: 10 }],
      });
      expect(
        (await c.db.cupon.findUniqueOrThrow({ where: { id: cupon.id } }))
          .usoCount,
      ).toBe(0);
      await f.http
        .post('/cupones')
        .send({ ...dto, codigo: 'NUEVO' })
        .expect(403);
      await f.http
        .patch(`/cupones/${cupon.id}`)
        .send({ version: 1, valor: 20 })
        .expect(403);
      await f.http.delete(`/cupones/${cupon.id}`).expect(403);
      await f.http
        .post('/cupones/validar')
        .send({ codigo: dto.codigo, items: [] })
        .expect(403);
      await expect(f.service.eliminar(f.auth, cupon.id)).rejects.toMatchObject({
        status: 403,
      });
      await expect(p.reservar()).rejects.toMatchObject({ status: 403 });
    }),
  );
});

it('la conversión parcial conserva el compromiso aunque el primer uso ya esté consumido', async () => {
  await conPlanesAsignados(db, (c) =>
    escenario(c, async (f) => {
      const cupon = await f.service.crear(f.auth, dto);
      const p = await f.presupuesto(cupon.id);
      await p.reservar();
      await c.db.cuponRedencion.updateMany({
        where: { tenantId: f.tenantId },
        data: { estado: 'CONSUMIDA' },
      });
      await c.db.cotizacion.update({
        where: { id: p.cotizacion.id },
        data: { estado: 'aprobado' },
      });
      expect((await f.diagnostico()).bloqueos.join(' ')).toContain(
        'Cupones comprometidos',
      );
      await c.db.cotizacion.update({
        where: { id: p.cotizacion.id },
        data: { estado: 'convertido' },
      });
      await f.asignar();
      expect(
        (await c.db.cupon.findUniqueOrThrow({ where: { id: cupon.id } }))
          .usoCount,
      ).toBe(1);
    }),
  );
});

it('cuenta todas las OT emitidas con cupón, incluso las conversiones que comparten una redención', async () => {
  await conPlanesAsignados(db, (c) =>
    escenario(c, async (f) => {
      const cupon = await f.service.crear(f.auth, dto);
      const ot = await c.db.ordenTrabajo.create({
        data: {
          tenantId: f.tenantId,
          numero: 'OT-CUPON',
          estado: 'finalizada',
          fechaEmision: new Date(),
          total: 90,
          items: {
            create: {
              tenantId: f.tenantId,
              codigo: 'QA',
              nombre: 'Trabajo',
              familia: 'Manual',
              cantidad: 1,
              cantidadUnidad: 'u',
              subtotal: 90,
              impuestos: 0,
              total: 90,
              descuentoCuponId: cupon.id,
              descuentoMonto: 10,
              descuentoTipo: 'PORCENTAJE',
              descuentoValor: 10,
            },
          },
        },
      });
      expect((await f.diagnostico()).bloqueos.join(' ')).toContain(
        'Órdenes abiertas con cupones',
      );
      await expect(f.asignar()).rejects.toMatchObject({ status: 409 });
      await c.db.ordenTrabajo.update({
        where: { id: ot.id },
        data: { estado: 'entregada' },
      });
      await f.asignar();
      expect(
        Number(
          (await c.db.ordenTrabajo.findUniqueOrThrow({ where: { id: ot.id } }))
            .total,
        ),
      ).toBe(90);
    }),
  );
});

it('un checkout pendiente impide crear, editar o reservar; no impide borrar un cupón sin uso', async () => {
  await conPlanesAsignados(db, (c) =>
    escenario(c, async (f) => {
      const cupon = await f.service.crear(f.auth, dto);
      const p = await f.presupuesto(cupon.id);
      await f.pendiente();
      for (const escritura of [
        () => f.service.crear(f.auth, { ...dto, codigo: 'OTRO' }),
        () => f.service.actualizar(f.auth, cupon.id, { version: 1, valor: 20 }),
        p.reservar,
      ])
        await expect(escritura()).rejects.toMatchObject({
          response: { code: 'CAMBIO_PLAN_PENDIENTE' },
        });
      expect(
        await c.db.cuponRedencion.count({ where: { tenantId: f.tenantId } }),
      ).toBe(0);
      expect(
        await c.db.cuponEvento.count({ where: { tenantId: f.tenantId } }),
      ).toBe(1);
      await f.service.eliminar(f.auth, cupon.id);
      expect(await c.db.cupon.count({ where: { tenantId: f.tenantId } })).toBe(
        0,
      );
    }),
  );
});

it('revalida dentro de la escritura si el contrato cambia después de la validación inicial', async () => {
  await conPlanesAsignados(db, (c) =>
    escenario(c, async (f) => {
      const exigir = f.capacidades.exigir.bind(f.capacidades);
      jest
        .spyOn(f.capacidades, 'exigir')
        .mockImplementationOnce(async (...args) => {
          await exigir(...args);
          await f.asignar();
        });
      await expect(f.service.crear(f.auth, dto)).rejects.toMatchObject({
        status: 403,
      });
      expect(await c.db.cupon.count({ where: { tenantId: f.tenantId } })).toBe(
        0,
      );
      expect(
        await c.db.cuponEvento.count({ where: { tenantId: f.tenantId } }),
      ).toBe(0);
    }),
  );
});

it('cuenta vencida conserva lectura y una empresa distinta no accede al historial', async () => {
  await conPlanesAsignados(db, (c) =>
    escenario(c, async (f) => {
      const cupon = await f.service.crear(f.auth, dto);
      await c.db.suscripcion.update({
        where: { tenantId: f.tenantId },
        data: { estado: 'vencida' },
      });
      await f.http.get(`/cupones/${cupon.id}/historial`).expect(200);
      await f.http
        .patch(`/cupones/${cupon.id}`)
        .send({ version: 1, valor: 20 })
        .expect(403);
      await f.http.delete(`/cupones/${cupon.id}`).expect(403);
      f.setAuth({ ...f.auth, tenantId: c.tenantId });
      await f.http.get(`/cupones/${cupon.id}/historial`).expect(404);
    }),
  );
});
