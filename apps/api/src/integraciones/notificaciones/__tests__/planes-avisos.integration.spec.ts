import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { Server } from 'node:http';
import request from 'supertest';
import { RolesGuard } from '../../../auth/roles.guard';
import { PermisosGuard } from '../../../auth/permisos.guard';
import type { CurrentAuth } from '../../../auth/auth.types';
import { CapacidadGuard } from '../../../suscripciones/capacidad.guard';
import { NotificacionesController } from '../notificaciones.controller';
import { IntegracionesService } from '../../integraciones.service';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { conPlanesAsignados } from '../../../../test/soporte-planes-asignados';
import { runWithTenant } from '../../../common/tenant-context';
import { CapacidadesEmpresaService } from '../../../suscripciones/capacidades-empresa.service';
import { operacionesCambioPlan } from '../../../plataforma/planes/operaciones-cambio-plan';
import { NotificacionesService } from '../notificaciones.service';
import { DespachoService } from '../despacho.service';
import { AutomaticosWebService } from '../../whatsapp-web/automaticos.service';

const prisma = new PrismaService();
afterAll(() => prisma.$disconnect());
type Contexto = Parameters<Parameters<typeof conPlanesAsignados>[1]>[0];
const numero = '5492966123456';
async function preparar(c: Contexto, canal = 'WATI') {
  const { id: tenantId } = await c.tx.tenant.create({
    data: { nombre: 'Avisos de prueba', slug: `avisos-${randomUUID()}` },
  });
  const auth = { ...c.auth, tenantId },
    dispositivo = { tenantId, dispositivoId: randomUUID(), numero };
  const plan = await c.tx.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Ensayo',
      precioMensual: 290,
      featuresJson: {},
    },
  });
  await c.tx.suscripcion.create({
    data: {
      tenantId,
      planId: plan.id,
      planVersionId: c.versiones[1].id,
      proveedor: 'manual',
      estado: 'activa',
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
  await c.tx.configuracionNotificaciones.create({
    data: {
      tenantId,
      pausado: false,
      canalOrdenes: canal,
      horaDesde: '00:00',
      horaHasta: '00:00',
      diasAtencion: '1,2,3,4,5,6,7',
      whatsappWebDispositivoId: dispositivo.dispositivoId,
      whatsappWebNumero: numero,
    },
  });
  const cliente = await c.tx.cliente.create({
    data: {
      tenantId,
      nombre: 'Cliente sintético',
      telefonoCodigo: '+54',
      telefonoNumero: '2966123456',
      paisCodigo: 'AR',
      aceptaWhatsapp: true,
    },
  });
  const capacidades = new CapacidadesEmpresaService(c.db);
  const despachar = jest.fn().mockResolvedValue({ estado: 'nada' });
  const cola = new NotificacionesService(
    c.db,
    { despachar } as never,
    capacidades,
  );
  const web = new AutomaticosWebService(c.db, capacidades);
  const wati = {
    listarPlantillas: jest
      .fn()
      .mockResolvedValue([
        { nombre: 'grafo_orden_recibida_v2', estado: 'APPROVED' },
      ]),
    enviarPlantilla: jest.fn().mockResolvedValue({ ok: true, id: 'prueba' }),
  };
  const integraciones = {
    credencialesWati: jest.fn().mockResolvedValue({
      token: 'fixture',
      endpoint: 'https://fixture.invalid',
      tenantId: '1',
    }),
    mediaHeaderDe: jest.fn().mockResolvedValue(undefined),
  };
  const despacho = new DespachoService(
    c.db,
    integraciones as never,
    wati as never,
    capacidades,
  );
  const dentro = <T>(fn: () => Promise<T>) => runWithTenant(tenantId, fn);
  const encolar = () =>
    dentro(() =>
      cola.encolar({
        evento: 'orden_recibida',
        entidadId: randomUUID(),
        clienteId: cliente.id,
        parametros: [
          'Cliente',
          'OT-1',
          '22/09/2026',
          'https://example.invalid/ot',
        ],
      }),
    );
  const nueva = async () => {
    const r = await encolar();
    if (!r.encolada) throw new Error(r.motivo);
    return r.id;
  };
  const pendiente = (estado = 'checkout') =>
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
  const leer = (id: string) =>
    c.tx.notificacionWhatsapp.findUniqueOrThrow({ where: { id } });
  return {
    tenantId,
    auth,
    dispositivo,
    cliente,
    cola,
    web,
    wati,
    despacho,
    dentro,
    encolar,
    nueva,
    pendiente,
    leer,
    despachar,
  };
}

describe('Avisos: contrato, cierre y resultados inciertos', () => {
  it.each(
    ['WATI', 'WHATSAPP_WEB'].flatMap((canal) =>
      ['enviando', 'checkout', 'verificar'].map((estado) => [canal, estado]),
    ),
  )(
    '%s no encola nuevos avisos durante %s y no afecta la operación de negocio',
    (canal, estado) =>
      conPlanesAsignados(prisma, async (c) => {
        const x = await preparar(c, canal);
        await x.pendiente(estado);
        const resultado = await x.encolar();
        expect(resultado.encolada).toBe(false);
        if (!resultado.encolada)
          expect(resultado.motivo).toContain('cambio de plan');
        expect(
          await c.tx.notificacionWhatsapp.count({
            where: { tenantId: x.tenantId },
          }),
        ).toBe(0);
        expect(x.despachar).not.toHaveBeenCalled();
        await expect(
          x.dentro(() => x.cola.cambiarEvento('orden_recibida', true)),
        ).rejects.toMatchObject({ status: 409 });
        await expect(
          x.dentro(() => x.cola.cambiarConfiguracion({ pausado: false })),
        ).rejects.toMatchObject({ status: 409 });
        await x.dentro(() => x.cola.cambiarConfiguracion({ pausado: true }));
        await x.dentro(() => x.cola.cambiarEvento('orden_recibida', false));
      }),
  );

  it.each(['WATI', 'WHATSAPP_WEB'])(
    'un aviso previo de %s puede concluir durante el cambio pendiente',
    (canal) =>
      conPlanesAsignados(prisma, async (c) => {
        const x = await preparar(c, canal),
          id = await x.nueva();
        await x.pendiente();
        if (canal === 'WATI') {
          expect(await x.dentro(() => x.despacho.despachar(id))).toEqual({
            estado: 'enviada',
          });
          expect(x.wati.enviarPlantilla).toHaveBeenCalledTimes(1);
        } else {
          const reserva = (await x.web.reservar(x.tenantId, x.dispositivo))
            .trabajo!;
          await x.web.iniciar(x.tenantId, id, {
            ...x.dispositivo,
            token: reserva.token,
          });
          const resultado = {
            ...x.dispositivo,
            token: reserva.token,
            estado: 'enviada' as const,
            mensajeId: 'test',
          };
          await x.web.resultado(x.tenantId, id, resultado);
          await x.web.resultado(x.tenantId, id, resultado);
        }
        expect((await x.leer(id)).estado).toBe('enviada');
      }),
  );

  it('no inicia un envío Web si la empresa quedó en sólo lectura después de reservar', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c, 'WHATSAPP_WEB'),
        id = await x.nueva();
      const r = (await x.web.reservar(x.tenantId, x.dispositivo)).trabajo!;
      await c.tx.suscripcion.update({
        where: { tenantId: x.tenantId },
        data: { estado: 'baja' },
      });
      await expect(
        x.web.iniciar(x.tenantId, id, { ...x.dispositivo, token: r.token }),
      ).rejects.toMatchObject({ status: 403 });
      expect((await x.leer(id)).estado).toBe('web_reservada');
    }));

  it('un resultado Web autorizado antes de la baja se conserva sin duplicar el envío', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c, 'WHATSAPP_WEB'),
        id = await x.nueva();
      const r = (await x.web.reservar(x.tenantId, x.dispositivo)).trabajo!;
      await x.web.iniciar(x.tenantId, id, { ...x.dispositivo, token: r.token });
      await c.tx.suscripcion.update({
        where: { tenantId: x.tenantId },
        data: { estado: 'baja', planVersionId: c.versiones[0].id },
      });
      await x.web.resultado(x.tenantId, id, {
        ...x.dispositivo,
        token: r.token,
        estado: 'enviada',
        mensajeId: 'test',
      });
      expect((await x.leer(id)).estado).toBe('enviada');
      expect(
        (await x.web.reservar(x.tenantId, x.dispositivo)).trabajo,
      ).toBeNull();
    }));

  it('Wati vuelve a validar después de consultar las plantillas y antes de enviar', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c),
        id = await x.nueva();
      x.wati.listarPlantillas.mockImplementationOnce(async () => {
        await c.tx.suscripcion.update({
          where: { tenantId: x.tenantId },
          data: { estado: 'baja' },
        });
        return [{ nombre: 'grafo_orden_recibida_v2', estado: 'APPROVED' }];
      });
      expect((await x.dentro(() => x.despacho.despachar(id))).estado).toBe(
        'pendiente',
      );
      expect(x.wati.enviarPlantilla).not.toHaveBeenCalled();
      expect((await x.leer(id)).intentos).toBe(0);
    }));

  it('cuenta reservas y resultados inciertos; resolverlos permite retirar el canal conservando el historial', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c, 'WHATSAPP_WEB');
      const estados = ['web_reservada', 'web_enviando', 'web_incierta'];
      const ids: string[] = [];
      for (const estado of estados) {
        const id = await x.nueva();
        ids.push(id);
        await c.tx.notificacionWhatsapp.update({
          where: { id },
          data: { estado },
        });
      }
      const contar = async () =>
        (
          await operacionesCambioPlan(
            c.tx,
            x.tenantId,
            new Set(['whatsapp_web']),
          )
        ).find((o) => o.codigo === 'whatsapp_web_pendiente')!.cantidad;
      expect(await contar()).toBe(3);
      await expect(
        x.cola.resolver(x.auth, ids[1], {
          accion: 'descartar',
          estadoEsperado: 'web_enviando',
          motivo: 'Esperar respuesta',
        }),
      ).rejects.toMatchObject({ status: 409 });
      await x.cola.resolver(x.auth, ids[0], {
        accion: 'descartar',
        estadoEsperado: 'web_reservada',
        motivo: 'Cliente avisado por otro canal',
      });
      await x.cola.resolver(x.auth, ids[2], {
        accion: 'confirmar_enviada',
        estadoEsperado: 'web_incierta',
        motivo: 'Verificado en WhatsApp',
      });
      expect(await contar()).toBe(1);
      await c.tx.notificacionWhatsapp.update({
        where: { id: ids[1] },
        data: { estado: 'enviada' },
      });
      const versionId = c.versiones[0].id;
      const d = await c.asignaciones.diagnostico({
        tenantId: x.tenantId,
        versionId,
      });
      expect(d.bloqueos).toEqual([]);
      await c.asignaciones.asignar(c.staff, {
        tenantId: x.tenantId,
        versionId,
        revision: d.actual.revision,
        huella: d.huella,
        motivo: 'Cerrar avisos para retirar canal',
        operacionId: randomUUID(),
        revisionesAceptadas: d.revisiones,
      });
      expect(await x.dentro(() => x.cola.log())).toHaveLength(3);
      const auditoria = await c.tx.eventoSistema.findFirstOrThrow({
        where: {
          tenantId: x.tenantId,
          entidadId: ids[2],
          tipo: 'aviso.resuelto',
        },
      });
      expect(auditoria.actorUserId).toBe(x.auth.userId);
      expect(auditoria.mensaje).toContain('web_incierta → enviada');
      expect((await x.leer(ids[2])).motivo).toContain(auditoria.actorNombre);
      expect(await x.encolar()).toMatchObject({ encolada: false });
      await expect(
        x.cola.resolver(x.auth, ids[2], {
          accion: 'descartar',
          estadoEsperado: 'web_incierta',
          motivo: 'Vista desactualizada',
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        x.cola.resolver({ ...x.auth, tenantId: c.tenantId }, ids[0], {
          accion: 'descartar',
          estadoEsperado: 'pendiente',
          motivo: 'Empresa incorrecta',
        }),
      ).rejects.toMatchObject({ status: 404 });
    }));

  it('los avisos inciertos de Wati bloquean la retirada hasta registrar una resolución', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c),
        id = await x.nueva();
      x.wati.enviarPlantilla.mockResolvedValue({
        ok: false,
        incierto: true,
        motivo: 'Respuesta interrumpida',
      });
      expect((await x.dentro(() => x.despacho.despachar(id))).estado).toBe(
        'incierta',
      );
      const d = await c.asignaciones.diagnostico({
        tenantId: x.tenantId,
        versionId: c.versiones[0].id,
      });
      expect(d.bloqueos.length).toBeGreaterThan(0);
      await x.cola.resolver(x.auth, id, {
        accion: 'descartar',
        estadoEsperado: 'wati_incierta',
        motivo: 'Se verificó y avisó por otro medio',
      });
      expect((await x.dentro(() => x.despacho.despachar(id))).estado).toBe(
        'nada',
      );
      expect(x.wati.enviarPlantilla).toHaveBeenCalledTimes(1);
    }));
  it.each(['éxito', 'incierto', 'excepción', 'plan retirado'])(
    'el envío Wati de prueba persiste su autorización y maneja %s',
    (escenario) =>
      conPlanesAsignados(prisma, async (c) => {
        const x = await preparar(c);
        const service = new IntegracionesService(
          c.db,
          {} as never,
          x.wati as never,
          {} as never,
        );
        jest.spyOn(service, 'credencialesWati').mockResolvedValue({
          token: 'fixture',
          endpoint: 'https://fixture.invalid',
          tenantId: '1',
        });
        jest.spyOn(service, 'mediaHeaderDe').mockResolvedValue(undefined);
        x.wati.listarPlantillas.mockImplementation(async () => {
          if (escenario === 'plan retirado')
            await c.tx.suscripcion.update({
              where: { tenantId: x.tenantId },
              data: { planVersionId: c.versiones[0].id },
            });
          return [
            {
              nombre: 'plantilla_prueba',
              estado: 'APPROVED',
              parametros: ['nombre'],
            },
          ];
        });
        x.wati.enviarPlantilla.mockImplementation(async () => {
          const aviso = await c.tx.notificacionWhatsapp.findFirstOrThrow({
            where: { tenantId: x.tenantId },
          });
          expect(aviso.estado).toBe('enviando');
          expect(aviso.reservaToken).toBeTruthy();
          if (escenario === 'excepción') throw new Error('Corte simulado');
          return escenario === 'éxito'
            ? { ok: true }
            : { ok: false, incierto: true, motivo: 'Respuesta perdida' };
        });
        const probar = () =>
          x.dentro(() =>
            service.probarEnvioWati({
              telefono: '+5492966123456',
              plantilla: 'plantilla_prueba',
              parametros: ['Cliente'],
            }),
          );
        if (escenario === 'plan retirado') {
          await expect(probar()).rejects.toMatchObject({ status: 403 });
          expect(x.wati.enviarPlantilla).not.toHaveBeenCalled();
          expect(
            await c.tx.notificacionWhatsapp.count({
              where: { tenantId: x.tenantId },
            }),
          ).toBe(0);
        } else {
          const respuesta = await probar();
          expect(respuesta.ok).toBe(escenario === 'éxito');
          if (escenario !== 'éxito') {
            expect(respuesta.incierto).toBe(true);
            expect(respuesta.motivo).toContain('historial de avisos');
          }
          const aviso = await c.tx.notificacionWhatsapp.findFirstOrThrow({
            where: { tenantId: x.tenantId },
          });
          expect(aviso.estado).toBe(
            escenario === 'éxito' ? 'enviada' : 'wati_incierta',
          );
          expect(await x.dentro(() => x.despacho.despachar(aviso.id))).toEqual({
            estado: 'nada',
          });
          expect(x.wati.enviarPlantilla).toHaveBeenCalledTimes(1);
        }
      }),
  );

  it('HTTP conserva el historial sin canal, valida DTO y exige permiso y rol para resolver', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c),
        id = await x.nueva();
      await c.tx.notificacionWhatsapp.update({
        where: { id },
        data: { estado: 'wati_incierta' },
      });
      await c.tx.suscripcion.update({
        where: { tenantId: x.tenantId },
        data: { planVersionId: c.versiones[0].id },
      });
      let authHttp: CurrentAuth = {
        ...x.auth,
        permisos: new Set(['configuracion.ver']),
      };
      const capacidades = new CapacidadesEmpresaService(c.db);
      const modulo = await Test.createTestingModule({
        controllers: [NotificacionesController],
        providers: [
          Reflector,
          CapacidadGuard,
          { provide: NotificacionesService, useValue: x.cola },
          { provide: CapacidadesEmpresaService, useValue: capacidades },
        ],
      }).compile();
      const app = modulo.createNestApplication();
      app.use((req: { auth: CurrentAuth }, _res: unknown, next: () => void) => {
        req.auth = authHttp;
        runWithTenant(authHttp.tenantId, next);
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
      try {
        await app.init();
        const http = request(app.getHttpServer() as Server);
        const url = `/integraciones/notificaciones/${id}/resolver`;
        const dto = {
          accion: 'confirmar_enviada',
          estadoEsperado: 'wati_incierta',
          motivo: 'Verificado en Wati',
        };
        const log = await http
          .get('/integraciones/notificaciones/log')
          .expect(200);
        expect(log.body).toHaveLength(1);
        await http.post(url).send(dto).expect(403);
        authHttp = {
          ...authHttp,
          permisos: new Set(['configuracion.ver', 'configuracion.gestionar']),
          role: 'SUPERVISOR',
        };
        await http.post(url).send(dto).expect(403);
        authHttp = { ...authHttp, role: 'ADMINISTRADOR' };
        await http
          .post(url)
          .send({ ...dto, accion: 'reenviar' })
          .expect(400);
        await http
          .post(url)
          .send({ ...dto, tenantId: c.tenantId })
          .expect(400);
        await http.post(url).send(dto).expect(201);
        await http.post(url).send(dto).expect(409);
        authHttp = { ...authHttp, tenantId: c.tenantId };
        await http.post(url).send(dto).expect(404);
        expect(x.wati.enviarPlantilla).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    }));
  it('un despachador con una reserva sustituida no envía ni sobrescribe el intento nuevo', () =>
    conPlanesAsignados(prisma, async (c) => {
      const x = await preparar(c),
        id = await x.nueva(),
        nuevoToken = randomUUID();
      x.wati.listarPlantillas.mockImplementation(async () => {
        await c.tx.notificacionWhatsapp.update({
          where: { id },
          data: { estado: 'wati_reservada', reservaToken: nuevoToken },
        });
        return [{ nombre: 'grafo_orden_recibida_v2', estado: 'APPROVED' }];
      });
      await x.dentro(() => x.despacho.despachar(id));
      expect(x.wati.enviarPlantilla).not.toHaveBeenCalled();
      expect(await x.leer(id)).toMatchObject({
        estado: 'wati_reservada',
        reservaToken: nuevoToken,
      });
    }));
});
