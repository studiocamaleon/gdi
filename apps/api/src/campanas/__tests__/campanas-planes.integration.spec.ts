import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { CampanasService } from '../campanas.service';
import { CampanasController } from '../campanas.controller';
import { CampanasQueryDto } from '../dto/campanas.dto';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { CapacidadGuard } from '../../suscripciones/capacidad.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import type { CurrentAuth } from '../../auth/auth.types';
import { operacionesCambioPlan } from '../../plataforma/planes/operaciones-cambio-plan';

const prisma = new PrismaService();
afterAll(() => prisma.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
const pendiente = { response: { code: 'CAMBIO_PLAN_PENDIENTE' } };

async function preparar(c: Contexto) {
  const tenant = await c.tx.tenant.create({
    data: { nombre: 'Campañas de prueba', slug: `campanas-${randomUUID()}` },
  });
  const tenantId = tenant.id;
  const auth: CurrentAuth = {
    ...c.auth,
    tenantId,
    permisos: new Set(['comercial.ver', 'comercial.gestionar']),
  };
  const plan = await c.tx.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Contrato de prueba',
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
  const oferta = await c.tx.planOferta.create({
    data: {
      planId: plan.id,
      versionId: c.versiones[0].id,
      entorno: 'sandbox',
      registroPublico: false,
      recomendado: false,
      creadaPorId: auth.userId,
      motivo: 'Prueba',
    },
  });
  const cliente = await c.tx.cliente.create({
    data: {
      tenantId,
      nombre: 'Cliente de prueba',
      telefonoCodigo: '+54',
      telefonoNumero: '1111111111',
      paisCodigo: 'AR',
    },
  });
  const capacidades = new CapacidadesEmpresaService(c.db);
  const service = new CampanasService(c.db, undefined, capacidades);
  const crear = () =>
    service.crear(auth, { nombre: 'Campaña de ensayo', clienteId: cliente.id });
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
  return { tenantId, auth, cliente, service, capacidades, crear, iniciar };
}

describe('Proyectos: cambio de plan y conservación del historial', () => {
  it.each(['enviando', 'checkout', 'verificar'])(
    'impide nuevos compromisos en %s y permite cerrar campañas e hitos anteriores',
    (estado) =>
      conPlanesAsignados(prisma, async (c) => {
        const x = await preparar(c);
        let campana = await x.crear();
        campana = await x.service.cambiarEstado(x.auth, campana.id, {
          estado: 'activo',
          updatedAt: campana.updatedAt,
        });
        campana = await x.service.crearHito(x.auth, campana.id, {
          titulo: 'Entrega',
        });
        const hito = campana.hitos[0];
        const cotizacion = await c.tx.cotizacion.create({
          data: { tenantId: x.tenantId, clienteId: x.cliente.id },
        });
        await x.service.vincularCotizacion(x.auth, campana.id, cotizacion.id);
        const intento = await x.iniciar(estado);
        await expect(x.crear()).rejects.toMatchObject(pendiente);
        await expect(
          x.service.crearHito(x.auth, campana.id, { titulo: 'Otro pendiente' }),
        ).rejects.toMatchObject(pendiente);
        await expect(
          x.service.vincularCotizacion(x.auth, campana.id, cotizacion.id),
        ).rejects.toMatchObject(pendiente);
        await x.service.desvincularCotizacion(
          x.auth,
          campana.id,
          cotizacion.id,
        );
        campana = await x.service.cambiarEstado(x.auth, campana.id, {
          estado: 'completado',
          updatedAt: campana.updatedAt,
        });
        // Cerrar la campaña no oculta los hitos que todavía requieren gestión.
        const diagnostico = await operacionesCambioPlan(
          c.tx,
          x.tenantId,
          new Set(['proyectos']),
        );
        expect(
          diagnostico.find((o) => o.codigo === 'proyectos_abiertos')?.cantidad,
        ).toBe(1);
        await expect(
          x.service.cambiarEstado(x.auth, campana.id, {
            estado: 'activo',
            updatedAt: campana.updatedAt,
          }),
        ).rejects.toMatchObject(pendiente);
        campana = await x.service.editarHito(x.auth, campana.id, hito.id, {
          estado: 'completado',
          updatedAt: hito.updatedAt,
        });
        const cerrado = campana.hitos[0];
        await expect(
          x.service.editarHito(x.auth, campana.id, cerrado.id, {
            estado: 'pendiente',
            updatedAt: cerrado.updatedAt,
          }),
        ).rejects.toMatchObject(pendiente);
        expect(
          (
            await operacionesCambioPlan(
              c.tx,
              x.tenantId,
              new Set(['proyectos']),
            )
          ).find((o) => o.codigo === 'proyectos_abiertos')?.cantidad,
        ).toBe(0);
        const listado = await x.service.listar(x.auth, new CampanasQueryDto());
        expect(listado.data).toHaveLength(1);
        expect(
          await c.tx.proyectoCampana.count({ where: { tenantId: x.tenantId } }),
        ).toBe(1);
        expect(
          await c.tx.proyectoCampanaHito.count({
            where: { tenantId: x.tenantId },
          }),
        ).toBe(1);
        await c.tx.planContratacion.update({
          where: { id: intento.id },
          data: { estado: 'rechazada' },
        });
        expect(
          (
            await x.service.cambiarEstado(x.auth, campana.id, {
              estado: 'activo',
              updatedAt: campana.updatedAt,
            })
          ).estado,
        ).toBe('activo');
      }),
  );

  it('rechaza crear si el contrato cambia después de las lecturas previas, sin consumir numeración', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      const db = new Proxy(c.db, {
        get(target, prop) {
          if (prop === '$transaction')
            return async (fn: Parameters<typeof c.db.$transaction>[0]) => {
              await c.tx.suscripcion.update({
                where: { tenantId: x.tenantId },
                data: { planVersionId: c.versiones[0].id },
              });
              return target.$transaction(fn);
            };
          return Reflect.get(target, prop) as unknown;
        },
      });
      await expect(
        new CampanasService(db).crear(x.auth, {
          nombre: 'No debe crearse',
          clienteId: x.cliente.id,
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect(
        await c.tx.proyectoCampanaContador.count({
          where: { tenantId: x.tenantId },
        }),
      ).toBe(0);
      expect(
        await c.tx.proyectoCampanaEvento.count({
          where: { tenantId: x.tenantId },
        }),
      ).toBe(0);
    }));

  it('mantiene consultas HTTP tras retirar Proyectos y rechaza escrituras, opciones y datos ajenos', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c);
      const campana = await x.crear();
      await x.service.cambiarEstado(x.auth, campana.id, {
        estado: 'cancelado',
        updatedAt: campana.updatedAt,
      });
      const d = await c.asignaciones.diagnostico({
        tenantId: x.tenantId,
        versionId: c.versiones[0].id,
      });
      expect(d.bloqueos).toEqual([]);
      await c.asignaciones.asignar(c.staff, {
        tenantId: x.tenantId,
        versionId: c.versiones[0].id,
        huella: d.huella,
        revision: d.actual.revision,
        motivo: 'Prueba de lectura histórica',
        operacionId: randomUUID(),
        revisionesAceptadas: d.revisiones,
      });
      let authHttp = x.auth;
      const modulo = await Test.createTestingModule({
        controllers: [CampanasController],
        providers: [
          Reflector,
          CapacidadGuard,
          { provide: CampanasService, useValue: x.service },
          { provide: CapacidadesEmpresaService, useValue: x.capacidades },
        ],
      }).compile();
      const app = modulo.createNestApplication();
      app.use((req: { auth: CurrentAuth }, _res: unknown, next: () => void) => {
        req.auth = authHttp;
        next();
      });
      app.useGlobalGuards(new PermisosGuard(new Reflector()));
      try {
        await app.init();
        const http = request(app.getHttpServer() as Server);
        await http.get('/campanas').expect(200);
        const result = await http.get(`/campanas/${campana.id}`).expect(200);
        expect((result.body as { estado: string }).estado).toBe('cancelado');
        await http.get('/campanas/opciones').expect(403);
        await http.post('/campanas').send({}).expect(403);
        await http.patch(`/campanas/${campana.id}`).send({}).expect(403);
        await http.patch(`/campanas/${campana.id}/estado`).send({}).expect(403);
        await http.post(`/campanas/${campana.id}/hitos`).send({}).expect(403);
        await http.put(`/campanas/${campana.id}/equipo`).send({}).expect(403);
        await expect(x.crear()).rejects.toMatchObject({ status: 403 });
        authHttp = { ...x.auth, permisos: new Set() };
        await http.get(`/campanas/${campana.id}`).expect(403);
        authHttp = { ...x.auth, tenantId: randomUUID() };
        await http.get(`/campanas/${campana.id}`).expect(404);
      } finally {
        await app.close();
      }
    }));
});
