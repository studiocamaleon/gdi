import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import type { CurrentAuth } from '../../../auth/auth.types';
import { PermisosGuard } from '../../../auth/permisos.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../../suscripciones/capacidades-empresa.service';
import { CapacidadGuard } from '../../../suscripciones/capacidad.guard';
import { conPlanesAsignados } from '../../../../test/soporte-planes-asignados';
import { declararUnidadPrecioFixture } from '../../../../test/fixture-unidad-precio';
import { serviciosRecorridoF4 } from '../../../../test/soporte-recorridos-f4';
import { runWithTenant } from '../../../common/tenant-context';
import {
  CATALOGO_PLANES,
  PROPUESTA_PLANES,
} from '../../../plataforma/planes/catalogo-planes';
import { MotorUniversalService } from '../../../motor-universal/motor.service';
import { AplicarPrecioService } from '../aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../precios-especiales-clientes/precios-especiales-clientes.service';
import { PreciosEspecialesClientesController } from '../precios-especiales-clientes/precios-especiales-clientes.controller';
import { PresupuestosService } from '../../../presupuestos/presupuestos.service';
import { ArchivosService } from '../../../archivos/archivos.service';
import { DatosEmpresaService } from '../../../tenants/datos-empresa.service';
import { CuponesService } from '../../../cupones/cupones.service';
import { FidelizacionService } from '../../../fidelizacion/fidelizacion.service';
import { DocumentosPdfService } from '../../../documentos-pdf/documentos-pdf.service';

const db = new PrismaService();
afterAll(() => db.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
const configJson = {
  metodoCalculo: 'precio_fijo',
  detalle: { price: 200, precioIncluyeIva: false },
};
async function preparar(c: Contexto, indice = 1) {
  await c.asignar(c.versiones[indice].id);
  await declararUnidadPrecioFixture(c.tx, c.tenantId);
  const producto = await c.db.producto.findFirstOrThrow({
    where: { tenantId: c.tenantId, codigo: 'TARJ-PREMIUM-300' },
  });
  await c.db.producto.update({
    where: { id: producto.id },
    data: {
      precioConfigJson: {
        metodoCalculo: 'precio_fijo',
        detalle: { price: 1000, precioIncluyeIva: false },
      },
    },
  });
  const cliente = await c.db.cliente.create({
    data: {
      tenantId: c.tenantId,
      nombre: 'Cliente T08',
      telefonoCodigo: '54',
      telefonoNumero: '',
      paisCodigo: 'AR',
    },
  });
  const capacidades = new CapacidadesEmpresaService(c.db);
  const service = new PreciosEspecialesClientesService(c.db, capacidades);
  const motor = new MotorUniversalService(
    c.db,
    new AplicarPrecioService(),
    service,
  );
  let auth: CurrentAuth = {
    ...c.auth,
    permisos: new Set([
      'costos.ver',
      'costos.gestionar',
      'comercial.gestionar',
    ]),
  };
  const modulo = await Test.createTestingModule({
    controllers: [PreciosEspecialesClientesController],
    providers: [
      Reflector,
      CapacidadGuard,
      { provide: PreciosEspecialesClientesService, useValue: service },
      { provide: CapacidadesEmpresaService, useValue: capacidades },
    ],
  }).compile();
  const app = modulo.createNestApplication();
  app.use((req: { auth: CurrentAuth }, _res: unknown, next: () => void) => {
    req.auth = auth;
    next();
  });
  app.useGlobalGuards(new PermisosGuard(new Reflector()));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  const input = {
    tenantId: c.tenantId,
    productoId: producto.id,
    clienteId: cliente.id,
    periodo: '2026-06',
    jobContext: { cantidad: 500, caras: 2 },
  };
  return {
    auth,
    app,
    cliente,
    producto,
    service,
    capacidades,
    motor,
    input,
    http: request(app.getHttpServer() as Server),
    path: `/productos-servicios/productos/${producto.id}/precios-especiales`,
    crear: () =>
      service.crear(c.tenantId, producto.id, {
        clienteId: cliente.id,
        configJson,
      }),
    cotizar: () =>
      runWithTenant(c.tenantId, () => motor.cotizarYGuardar(input)),
    setAuth: (next: CurrentAuth) => {
      auth = next;
    },
  };
}

it.each([0, 1, 2])(
  'reglas por HTTP según contrato publicado: plan %i y permisos personales',
  async (indice) => {
    await conPlanesAsignados(db, async (c) => {
      const x = await preparar(c, indice);
      try {
        await x.http.get(x.path).expect(200);
        const result = await x.http
          .post(x.path)
          .send({ clienteId: x.cliente.id, configJson })
          .expect(indice ? 201 : 403);
        if (indice) {
          const precio = result.body as { id: string };
          await x.http
            .patch(`/productos-servicios/precios-especiales/${precio.id}`)
            .send({ activo: false })
            .expect(200);
          expect(
            await x.service.buscarActivo(
              c.tenantId,
              x.producto.id,
              x.cliente.id,
            ),
          ).toBeNull();
          await x.http
            .patch(`/productos-servicios/precios-especiales/${precio.id}`)
            .send({ activo: true })
            .expect(200);
          const cotizada = await x.cotizar();
          expect(
            cotizada.result.cotizacion?.desglosePrecio?.precioEspecialCliente
              ?.precioEspecialId,
          ).toBe(precio.id);
          await x.http
            .delete(`/productos-servicios/precios-especiales/${precio.id}`)
            .expect(200);
          expect(
            await x.service.buscarActivo(
              c.tenantId,
              x.producto.id,
              x.cliente.id,
            ),
          ).toBeNull();
        } else {
          const cotizada = await x.cotizar();
          expect(cotizada.result.exitoso).toBe(true);
          expect(
            cotizada.result.cotizacion?.desglosePrecio?.precioEspecialCliente,
          ).toBeNull();
        }
        x.setAuth({ ...x.auth, permisos: new Set(['costos.ver']) });
        await x.http.get(x.path).expect(200);
        await x.http
          .post(x.path)
          .send({ clienteId: x.cliente.id, configJson })
          .expect(403);
        x.setAuth({ ...x.auth, permisos: new Set() });
        await x.http.get(x.path).expect(403);
      } finally {
        await x.app.close();
      }
    });
  },
);

it('retirar T08 conserva la regla y el precio de una OT; recotizar usa el precio general', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      const regla = await x.crear();
      const cotizada = await x.cotizar();
      const recotizable = await x.cotizar();
      const guardado = await c.db.cotizacionItem.findUniqueOrThrow({
        where: { id: cotizada.cotizacionItemId },
      });
      const { ordenes } = serviciosRecorridoF4(c.db);
      const orden = await runWithTenant(c.tenantId, () =>
        ordenes.create(x.auth, {
          idempotencyKey: randomUUID(),
          estado: 'borrador',
          clienteId: x.cliente.id,
          canalVenta: 'mostrador',
          cotizacionId: cotizada.cotizacionId!,
          fechaEntrega: '2099-12-01',
          items: [
            {
              cotizacionItemId: cotizada.cotizacionItemId!,
              codigo: x.producto.codigo,
              nombre: x.producto.nombre,
              familia: 'Tarjetas',
              cantidad: 500,
              cantidadUnidad: 'u',
              subtotal: 0,
              impuestos: 0,
              total: 0,
            },
          ],
        }),
      );
      const antes = await c.db.ordenTrabajo.findUniqueOrThrow({
        where: { id: orden.id },
      });
      const d = await c.diagnosticar(c.versiones[0].id);
      expect(d.diagnostico.hallazgos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codigo: 'precios_especiales_configurados',
            nivel: 'revisar',
          }),
        ]),
      );
      await c.asignar(c.versiones[0].id);
      const consulta = await x.http.get(x.path).expect(200);
      expect(
        (consulta.body as Array<{ id: string }>).some((p) => p.id === regla.id),
      ).toBe(true);
      await x.http
        .patch(`/productos-servicios/precios-especiales/${regla.id}`)
        .send({ activo: false })
        .expect(403);
      await x.http
        .delete(`/productos-servicios/precios-especiales/${regla.id}`)
        .expect(403);
      expect(
        await x.service.buscarActivo(c.tenantId, x.producto.id, x.cliente.id),
      ).toBeNull();
      await runWithTenant(c.tenantId, () =>
        ordenes.cambiarEstado(x.auth, orden.id, { estado: 'pendiente' }),
      );
      const emitida = await c.db.ordenTrabajo.findUniqueOrThrow({
        where: { id: orden.id },
      });
      expect(Number(emitida.total)).toBe(Number(antes.total));
      expect(
        (
          await c.db.cotizacionItem.findUniqueOrThrow({
            where: { id: guardado.id },
          })
        ).precioEspecialClienteSnapshotJson,
      ).toEqual(guardado.precioEspecialClienteSnapshotJson);
      const nueva = await x.cotizar();
      expect(
        nueva.result.cotizacion?.desglosePrecio?.precioEspecialCliente,
      ).toBeNull();
      expect(
        nueva.result.cotizacion?.desglosePrecio?.precioNetoUnitario,
      ).toBeGreaterThan(
        cotizada.result.cotizacion?.desglosePrecio?.precioNetoUnitario ?? 0,
      );
      const recalculada = await runWithTenant(c.tenantId, () =>
        x.motor.recotizarItem({
          tenantId: c.tenantId,
          cotizacionItemId: recotizable.cotizacionItemId!,
          clienteId: x.cliente.id,
          jobContext: x.input.jobContext,
          periodo: x.input.periodo,
        }),
      );
      expect(
        recalculada.result.cotizacion?.desglosePrecio?.precioEspecialCliente,
      ).toBeNull();
      expect(
        (
          await c.db.cotizacionItem.findUniqueOrThrow({
            where: { id: recotizable.cotizacionItemId },
          })
        ).precioEspecialClienteSnapshotJson,
      ).toBeNull();
    } finally {
      await x.app.close();
    }
  });
});

it('un presupuesto enviado conserva el precio acordado al aprobarlo y convertirlo después de retirar T08', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      await x.crear();
      const cotizada = await x.cotizar();
      const item = await c.db.cotizacionItem.findUniqueOrThrow({
        where: { id: cotizada.cotizacionItemId },
      });
      const s = serviciosRecorridoF4(c.db);
      const presupuestos = new PresupuestosService(
        c.db,
        s.ordenes,
        new ArchivosService(c.db, {} as never, {} as never),
        {} as never,
        { sincronizar: () => Promise.resolve() } as never,
        s.enlaces,
        new DatosEmpresaService(c.db),
        new CuponesService(c.db),
        new FidelizacionService(c.db),
        new DocumentosPdfService(c.db),
        x.capacidades,
      );
      await runWithTenant(c.tenantId, () =>
        presupuestos.emitir(x.auth, {
          cotizacionId: cotizada.cotizacionId!,
          clienteId: x.cliente.id,
          canalVenta: 'mostrador',
          fechaEntrega: '2099-12-01',
          items: [
            {
              cotizacionItemId: item.id,
              codigo: x.producto.codigo,
              nombre: x.producto.nombre,
              familia: 'Tarjetas',
              cantidad: 500,
              cantidadUnidad: 'u',
              subtotal: 0,
              impuestos: 0,
              total: 0,
            },
          ],
        }),
      );
      await c.asignar(c.versiones[0].id);
      await runWithTenant(c.tenantId, async () => {
        await presupuestos.resolver(x.auth, cotizada.cotizacionId!, {
          resultado: 'aprobado',
        });
        const conversion = await presupuestos.convertir(
          x.auth,
          cotizada.cotizacionId!,
          {},
        );
        await s.ordenes.cambiarEstado(x.auth, conversion.ordenId, {
          estado: 'pendiente',
        });
        const ot = await c.db.ordenTrabajo.findUniqueOrThrow({
          where: { id: conversion.ordenId },
        });
        expect(Number(ot.total)).toBe(Number(item.precioTotal));
      });
      expect(
        (
          await c.db.cotizacionItem.findUniqueOrThrow({
            where: { id: item.id },
          })
        ).precioEspecialClienteSnapshotJson,
      ).toEqual(item.precioEspecialClienteSnapshotJson);
    } finally {
      await x.app.close();
    }
  });
});

it('el checkout que retira T08 bloquea reglas y nuevos precios especiales, pero permite cotizar al precio general', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      const regla = await x.crear();
      const anterior = await x.cotizar();
      const s = await c.db.suscripcion.findUniqueOrThrow({
        where: { tenantId: c.tenantId },
      });
      const oferta = await c.db.planOferta.create({
        data: {
          planId: s.planId,
          versionId: c.versiones[0].id,
          entorno: 'sandbox',
          creadaPorId: c.auth.userId,
          motivo: 'QA',
          registroPublico: false,
          recomendado: false,
        },
      });
      await c.db.planContratacion.create({
        data: {
          tenantId: c.tenantId,
          userId: c.auth.userId,
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
      const cantidad = await c.db.cotizacionItem.count({
        where: { tenantId: c.tenantId },
      });
      for (const ejecutar of [
        x.crear,
        () => x.service.actualizar(c.tenantId, regla.id, { activo: false }),
        () => x.service.eliminar(c.tenantId, regla.id),
        x.cotizar,
        () =>
          runWithTenant(c.tenantId, () =>
            x.motor.recotizarItem({
              tenantId: c.tenantId,
              cotizacionItemId: anterior.cotizacionItemId!,
              clienteId: x.cliente.id,
              jobContext: x.input.jobContext,
              periodo: x.input.periodo,
            }),
          ),
      ])
        await expect(ejecutar()).rejects.toMatchObject({
          response: { code: 'CAMBIO_PLAN_PENDIENTE' },
        });
      expect(
        await c.db.cotizacionItem.count({ where: { tenantId: c.tenantId } }),
      ).toBe(cantidad);
      const general = await runWithTenant(c.tenantId, () =>
        x.motor.cotizarYGuardar({ ...x.input, clienteId: undefined }),
      );
      expect(general.result.exitoso).toBe(true);
      await x.http.get(x.path).expect(200);
    } finally {
      await x.app.close();
    }
  });
});

it('revalida T08 si el contrato cambia después del cálculo y antes de guardar', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      await x.crear();
      const original = x.service.buscarActivo.bind(x.service);
      jest
        .spyOn(x.service, 'buscarActivo')
        .mockImplementationOnce(async (...args) => {
          const resultado = await original(...args);
          await c.asignar(c.versiones[0].id);
          return resultado;
        });
      const antes = await c.db.cotizacionItem.count({
        where: { tenantId: c.tenantId },
      });
      await expect(x.cotizar()).rejects.toMatchObject({ status: 403 });
      expect(
        await c.db.cotizacionItem.count({ where: { tenantId: c.tenantId } }),
      ).toBe(antes);
    } finally {
      await x.app.close();
    }
  });
});

it('no cruza clientes, productos ni reglas entre empresas; una cuenta vencida sólo consulta', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      const regla = await x.crear();
      const otro = await c.db.tenant.create({
        data: { nombre: 'Otro', slug: randomUUID() },
      });
      const cliente = await c.db.cliente.create({
        data: {
          tenantId: otro.id,
          nombre: 'Otro cliente',
          telefonoCodigo: '54',
          telefonoNumero: '',
          paisCodigo: 'AR',
        },
      });
      await expect(
        x.service.crear(c.tenantId, x.producto.id, {
          clienteId: cliente.id,
          configJson,
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        x.service.listarPorProducto(otro.id, x.producto.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        x.service.actualizar(otro.id, regla.id, { activo: false }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(x.service.eliminar(otro.id, regla.id)).rejects.toMatchObject(
        { status: 404 },
      );
      expect(
        await x.service.buscarActivo(otro.id, x.producto.id, x.cliente.id),
      ).toBeNull();
      await c.db.suscripcion.update({
        where: { tenantId: c.tenantId },
        data: { estado: 'vencida' },
      });
      await x.http.get(x.path).expect(200);
      await x.http
        .patch(`/productos-servicios/precios-especiales/${regla.id}`)
        .send({ activo: false })
        .expect(403);
      expect(
        await x.service.buscarActivo(c.tenantId, x.producto.id, x.cliente.id),
      ).toBeNull();
    } finally {
      await x.app.close();
    }
  });
});

it('configurar T08 funciona con sus dependencias y base, sin exigir reglas generales de precio ni CRM avanzado', async () => {
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
            f.base ||
              [
                'clientes',
                'productos',
                'materiales',
                'precios_especiales',
              ].includes(f.clave),
          ]),
        ),
      });
      await c.asignar(version.id);
      const regla = await x.crear();
      expect(
        (await x.service.buscarActivo(c.tenantId, x.producto.id, x.cliente.id))
          ?.id,
      ).toBe(regla.id);
      await x.http
        .patch(`/productos-servicios/precios-especiales/${regla.id}`)
        .send({ configJson })
        .expect(200);
      await x.http.get(x.path).expect(200);
    } finally {
      await x.app.close();
    }
  });
});
