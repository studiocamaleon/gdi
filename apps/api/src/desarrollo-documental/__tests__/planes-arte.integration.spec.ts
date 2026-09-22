import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import type { CurrentAuth } from '../../auth/auth.types';
import { PermisosGuard } from '../../auth/permisos.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { CapacidadGuard } from '../../suscripciones/capacidad.guard';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { DesarrolloDocumentalService } from '../desarrollo-documental.service';
import { DesarrolloDocumentalController } from '../desarrollo-documental.controller';
import { EnlacesPublicosService } from '../../enlaces-publicos/enlaces-publicos.service';
import { PROPUESTA_PLANES } from '../../plataforma/planes/catalogo-planes';

const db = new PrismaService();
afterAll(() => db.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
async function preparar(c: Contexto, indice = 1) {
  const tenant = await c.db.tenant.create({
    data: { nombre: 'Arte QA', slug: `arte-${randomUUID()}` },
  });
  const tenantId = tenant.id;
  const plan = await c.db.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Arte QA',
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
      'comercial.ver',
      'comercial.gestionar',
      'produccion.ver',
    ]),
  };
  const capacidades = new CapacidadesEmpresaService(c.db);
  const enlaces = new EnlacesPublicosService(c.db, capacidades);
  const archivos = {
    firmarDescargaDe: jest
      .fn()
      .mockResolvedValue('https://archivos.example.test/arte.pdf'),
  };
  const service = new DesarrolloDocumentalService(
    c.db,
    enlaces,
    archivos as never,
    undefined,
    capacidades,
  );
  const modulo = await Test.createTestingModule({
    controllers: [DesarrolloDocumentalController],
    providers: [
      Reflector,
      CapacidadGuard,
      { provide: DesarrolloDocumentalService, useValue: service },
      { provide: CapacidadesEmpresaService, useValue: capacidades },
    ],
  }).compile();
  const app = modulo.createNestApplication();
  app.use(
    (
      req: { auth?: CurrentAuth; path: string },
      _res: unknown,
      next: () => void,
    ) => {
      if (!req.path.includes('/publico/')) req.auth = auth;
      next();
    },
  );
  app.useGlobalGuards(new PermisosGuard(new Reflector()));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  const orden = await c.db.ordenTrabajo.create({
    data: {
      tenantId,
      numero: 'OT-QA',
      estado: 'pendiente',
      fechaEmision: new Date(),
    },
  });
  const archivo = await c.db.archivo.create({
    data: {
      tenantId,
      ordenId: orden.id,
      scope: 'ORDEN',
      key: randomUUID(),
      nombreOriginal: 'arte.pdf',
      mimeType: 'application/pdf',
      bytes: 100,
      hash: 'a'.repeat(64),
      estado: 'LISTO',
    },
  });
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
      motivo: 'QA arte por planes',
      revisionesAceptadas: d.revisiones,
    });
  };
  const crear = () =>
    service.crearMaestro(auth, {
      ordenId: orden.id,
      nombre: 'Arte final',
      proposito: 'PRINT',
      etapa: 'DISENO',
    });
  const prepararRevision = async () => {
    let data = await crear();
    const maestroId = data.maestros[0].id;
    data = await service.crearRevision(auth, maestroId, {
      archivoId: archivo.id,
    });
    const revisionId = data.maestros[0].revisiones[0].id;
    data = await service.solicitar(auth, revisionId, {
      tipo: 'CLIENTE',
      permiteDecisionExterna: true,
    });
    const solicitudId = data.maestros[0].revisiones[0].solicitudes[0].id;
    return { maestroId, revisionId, solicitudId };
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
  return {
    tenantId,
    auth,
    service,
    capacidades,
    enlaces,
    archivos,
    app,
    http: request(app.getHttpServer() as Server),
    orden,
    archivo,
    crear,
    prepararRevision,
    asignar,
    diagnostico,
    pendiente,
    setAuth: (value: CurrentAuth) => {
      auth = value;
    },
  };
}

it.each([0, 1, 2])(
  'plan %i: historial legible y creación protegida por contrato y permiso',
  async (indice) => {
    await conPlanesAsignados(db, async (c) => {
      const x = await preparar(c, indice);
      try {
        await x.http
          .get(`/desarrollo-documental/ordenes/${x.orden.id}/documentos`)
          .expect(200);
        await x.http
          .post('/desarrollo-documental/maestros')
          .send({
            ordenId: x.orden.id,
            nombre: 'Arte',
            proposito: 'PRINT',
            etapa: 'DISENO',
          })
          .expect(indice ? 201 : 403);
        x.setAuth({ ...x.auth, permisos: new Set(['comercial.ver']) });
        await x.http
          .post('/desarrollo-documental/maestros')
          .send({
            ordenId: x.orden.id,
            nombre: 'Otro',
            proposito: 'PRINT',
            etapa: 'DISENO',
          })
          .expect(403);
        x.setAuth({ ...x.auth, permisos: new Set() });
        await x.http
          .get(`/desarrollo-documental/ordenes/${x.orden.id}/documentos`)
          .expect(403);
      } finally {
        await x.app.close();
      }
    });
  },
);

it('arte de OT funciona sin Proyectos: revisión → enlace público → aprobación → liberación → retirada e historial', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c, 0);
    try {
      const version = await c.publicar({
        ...structuredClone(PROPUESTA_PLANES[0].contenido),
        almacenamientoModo: 'limitado',
        almacenamientoGb: 250,
        funciones: {
          ...PROPUESTA_PLANES[0].contenido.funciones,
          aprobacion_arte: true,
          proyectos: false,
        },
      });
      await x.asignar(version.id);
      const r = await x.prepararRevision();
      await x.service.crearGate(x.auth, {
        ordenId: x.orden.id,
        archivoMaestroId: r.maestroId,
        tipoAprobacion: 'CLIENTE',
        nombre: 'Arte final',
      });
      await expect(x.service.exigirGatesCumplidos(x.orden.id)).rejects.toThrow(
        'Producción bloqueada',
      );
      expect((await x.diagnostico()).bloqueos.join(' ')).toContain(
        'Aprobaciones de arte pendientes',
      );
      await expect(x.asignar()).rejects.toMatchObject({ status: 409 });
      const link = await x.service.emitirLink(x.auth, r.solicitudId, {});
      const publico = await x.http
        .get(`/desarrollo-documental/publico/${link.token}`)
        .expect(200);
      expect(publico.body).toMatchObject({
        campana: null,
        orden: { numero: 'OT-QA' },
        puedeDecidir: true,
      });
      await x.http
        .post(`/desarrollo-documental/publico/${link.token}/decision`)
        .send({ decision: 'APROBAR', actorNombre: 'Cliente QA' })
        .expect(201);
      expect((await x.diagnostico()).bloqueos.join(' ')).toContain(
        'Órdenes esperando arte liberado',
      );
      await x.service.liberar(x.auth, r.revisionId);
      await expect(
        x.service.exigirGatesCumplidos(x.orden.id),
      ).resolves.toBeUndefined();
      await x.asignar();
      const historial = await x.service.listarOrden(x.auth, x.orden.id);
      expect(historial.maestros[0].revisionLiberada?.id).toBe(r.revisionId);
      await x.http
        .get(`/desarrollo-documental/publico/${link.token}`)
        .expect(200);
      await x.http
        .get(`/desarrollo-documental/publico/${link.token}/archivo`)
        .expect(302);
      await expect(
        x.service.crearRevision(x.auth, r.maestroId, {
          archivoId: x.archivo.id,
        }),
      ).rejects.toMatchObject({ status: 403 });
      await x.service.revocarLink(x.auth, r.solicitudId);
      await x.http
        .get(`/desarrollo-documental/publico/${link.token}`)
        .expect(404);
      expect(
        await c.db.ordenTrabajoEvento.count({
          where: { ordenId: x.orden.id, tipo: 'revision_documental_liberada' },
        }),
      ).toBe(1);
    } finally {
      await x.app.close();
    }
  });
});

it('un checkout retira nuevas revisiones y solicitudes pero permite cancelar pendientes vencidas y resolver controles', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      const r = await x.prepararRevision();
      await x.service.crearGate(x.auth, {
        ordenId: x.orden.id,
        archivoMaestroId: r.maestroId,
        tipoAprobacion: 'CLIENTE',
        nombre: 'Arte',
      });
      await x.pendiente();
      await expect(
        x.service.crearRevision(x.auth, r.maestroId, {
          archivoId: x.archivo.id,
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        x.service.emitirLink(x.auth, r.solicitudId, {}),
      ).rejects.toMatchObject({ status: 409 });
      await c.db.solicitudAprobacionDocumento.update({
        where: { id: r.solicitudId },
        data: { expiraEl: new Date(1) },
      });
      await x.service.decidir(x.auth, r.solicitudId, {
        decision: 'CANCELAR',
        comentario: 'Trabajo cancelado',
      });
      const gate = await c.db.gateProduccionDocumento.findFirstOrThrow({
        where: { tenantId: x.tenantId },
      });
      await x.service.eliminarGate(x.auth, gate.id);
      expect(
        await c.db.gateProduccionDocumento.findUnique({
          where: { id: gate.id },
        }),
      ).toMatchObject({ activo: false });
      expect(
        await c.db.ordenTrabajoEvento.count({
          where: {
            ordenId: x.orden.id,
            tipo: 'control_documental_desactivado',
          },
        }),
      ).toBe(1);
    } finally {
      await x.app.close();
    }
  });
});

it('aisla maestros, revisiones y adjuntos por empresa aunque se llame al servicio directamente', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      const r = await x.prepararRevision();
      const ajeno = { ...x.auth, tenantId: c.tenantId };
      await expect(
        x.service.listarOrden(ajeno, x.orden.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        x.service.crearRevision(ajeno, r.maestroId, {
          archivoId: x.archivo.id,
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        x.service.decidir(ajeno, r.solicitudId, { decision: 'APROBAR' }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        x.service.liberar(ajeno, r.revisionId),
      ).rejects.toMatchObject({ status: 404 });
      await c.db.suscripcion.update({
        where: { tenantId: x.tenantId },
        data: { estado: 'vencida' },
      });
      await x.http
        .get(`/desarrollo-documental/ordenes/${x.orden.id}/documentos`)
        .expect(200);
      await expect(
        x.service.liberar(x.auth, r.revisionId),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await x.app.close();
    }
  });
});

it('mantiene el circuito de campaña y no mezcla sus archivos con los de otra OT', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      const cliente = await c.db.cliente.create({
        data: {
          tenantId: x.tenantId,
          nombre: 'Cliente campaña',
          telefonoCodigo: '54',
          telefonoNumero: '',
          paisCodigo: 'AR',
        },
      });
      const campana = await c.db.proyectoCampana.create({
        data: {
          tenantId: x.tenantId,
          clienteId: cliente.id,
          codigo: 'CAM-QA',
          nombre: 'Campaña QA',
        },
      });
      const archivo = await c.db.archivo.create({
        data: {
          tenantId: x.tenantId,
          proyectoCampanaId: campana.id,
          scope: 'CAMPANA',
          key: randomUUID(),
          nombreOriginal: 'arte-campana.pdf',
          mimeType: 'application/pdf',
          hash: 'b'.repeat(64),
          estado: 'LISTO',
        },
      });
      const creada = await x.service.crearMaestro(x.auth, {
        proyectoCampanaId: campana.id,
        nombre: 'Arte compartido',
        etapa: 'DISENO',
        proposito: 'PRINT',
      });
      const id = creada.maestros[0].id;
      await expect(
        x.service.crearRevision(x.auth, id, { archivoId: x.archivo.id }),
      ).rejects.toMatchObject({ status: 400 });
      const revision = await x.service.crearRevision(x.auth, id, {
        archivoId: archivo.id,
      });
      expect(revision.maestros[0]).toMatchObject({
        proyectoCampanaId: campana.id,
        ordenId: null,
      });
      const solicitada = await x.service.solicitar(
        x.auth,
        revision.maestros[0].revisiones[0].id,
        { tipo: 'DISENO', asignadaARol: 'SUPERVISOR' },
      );
      const solicitudId =
        solicitada.maestros[0].revisiones[0].solicitudes[0].id;
      await x.service.decidir(x.auth, solicitudId, { decision: 'APROBAR' });
      await x.service.liberar(x.auth, revision.maestros[0].revisiones[0].id);
      expect(
        await c.db.proyectoCampanaEvento.count({
          where: {
            proyectoCampanaId: campana.id,
            tipo: 'revision_documental_liberada',
          },
        }),
      ).toBe(1);
    } finally {
      await x.app.close();
    }
  });
});

it('retirar el plan entre la lectura y la escritura impide crear arte', async () => {
  await conPlanesAsignados(db, async (c) => {
    const x = await preparar(c);
    try {
      const exigir = x.capacidades.exigir.bind(x.capacidades);
      const entrada = jest
        .spyOn(x.capacidades, 'exigir')
        .mockImplementation(async (...args) => {
          await exigir(...args);
          await x.asignar();
        });
      await expect(x.crear()).rejects.toMatchObject({ status: 403 });
      expect(
        await c.db.archivoMaestro.count({ where: { tenantId: x.tenantId } }),
      ).toBe(0);
      entrada.mockRestore();
    } finally {
      await x.app.close();
    }
  });
});
