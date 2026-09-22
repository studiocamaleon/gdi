import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SuscripcionesPlataformaService } from '../suscripciones-plataforma.service';
import {
  ConsultaSuscripcionesDto,
  ConsultarPaddleDto,
  SuscripcionesPlataformaController,
} from '../suscripciones-plataforma.controller';
import { PlataformaGuard } from '../plataforma.guard';
import { PlataformaAdminGuard } from '../plataforma-admin.guard';
import { SuscripcionSyncService } from '../../cobro/suscripcion-sync.service';
import { CobroWebhookController } from '../../cobro/cobro-webhook.controller';
import type { PrismaService } from '../../prisma/prisma.service';
import type { PaddleService } from '../../cobro/paddle.service';
import type { CurrentAuth } from '../../auth/auth.types';

const prisma = new PrismaClient();
const db = prisma as unknown as PrismaService;
const leer = jest.fn();
const verificar = jest.fn();
const paddle = {
  habilitado: true,
  puedeVerificarFirma: true,
  obtenerSuscripcion: leer,
  verificarEvento: verificar,
} as unknown as PaddleService;
const sync = new SuscripcionSyncService(db);
const service = new SuscripcionesPlataformaService(db, paddle, sync);
let auth: CurrentAuth;
let tenant: string,
  id: string,
  plan: string,
  referencia: string,
  precio: string;
const motivo = 'Cliente informa pago regularizado';
const futuro = () => new Date(Date.now() + 3600_000);
const remoto = (over: Record<string, unknown> = {}) => ({
  id: referencia,
  status: 'active',
  updated_at: new Date().toISOString(),
  custom_data: { tenantId: tenant },
  items: [{ price: { id: precio } }],
  ...over,
});
beforeEach(async () => {
  jest.clearAllMocks();
  const u = await prisma.user.create({
    data: {
      email: `test-subs-${randomUUID()}@test.local`,
      rolPlataforma: 'ADMIN',
      nombreCompleto: 'Operador prueba',
    },
  });
  await prisma.userMfa.create({
    data: {
      userId: u.id,
      activatedAt: new Date(0),
      recuperacionConfirmadaEl: new Date(0),
    },
  });
  const sesion = await prisma.authSession.create({
    data: { userId: u.id, expiresAt: futuro(), mfaVerificadoEl: new Date() },
  });
  auth = {
    userId: u.id,
    email: u.email,
    sessionId: sesion.id,
    esPlataforma: true,
    plataformaMfaPendiente: false,
    tenantId: '',
    membershipId: '',
    role: 'ADMINISTRADOR',
  };
  tenant = (
    await prisma.tenant.create({
      data: {
        nombre: 'Suscripción prueba',
        slug: `subs-${randomUUID()}`,
        activo: false,
        bloqueoAccesoMotivo: 'Verificación administrativa',
      },
    })
  ).id;
  precio = `pri_${randomUUID()}`;
  plan = (
    await prisma.plan.create({
      data: {
        nombre: 'Plan prueba',
        codigo: `plan-${randomUUID()}`,
        precioMensual: 10,
        featuresJson: {},
        paddlePriceId: precio,
      },
    })
  ).id;
  referencia = `sub_${randomUUID()}`;
  id = (
    await prisma.suscripcion.create({
      data: {
        tenantId: tenant,
        planId: plan,
        proveedor: 'paddle',
        referenciaExterna: referencia,
        estado: 'suspendida',
        estadoProveedor: 'past_due',
        graciaHasta: new Date(0),
        moraDesde: new Date(0),
      },
    })
  ).id;
  leer.mockResolvedValue(remoto());
});
afterEach(async () => {
  await prisma.eventoCobro.deleteMany({
    where: { referenciaSuscripcion: referencia },
  });
  await prisma.sincronizacionPaddle.deleteMany({
    where: { staffUserId: auth.userId },
  });
  await prisma.plataformaEvento.deleteMany({
    where: { staffUserId: auth.userId },
  });
  await prisma.user.delete({ where: { id: auth.userId } });
  await prisma.tenant.delete({ where: { id: tenant } });
  await prisma.plan.delete({ where: { id: plan } });
});
afterAll(() => prisma.$disconnect());

it('detecta la prueba de Paddle por su próximo cobro sin recrear el trial local', async () => {
  const vence = new Date(Date.now() + 86_400_000).toISOString();
  leer.mockResolvedValue(remoto({ status: 'trialing', next_billed_at: vence }));
  await service.sincronizar(auth, id, randomUUID(), motivo);
  const lista = await service.listar({
    pagina: 1,
    limite: 25,
    q: referencia,
    caso: 'prueba',
  });
  expect(lista.suscripciones).toHaveLength(1);
  expect(lista.suscripciones[0].trialHasta).toBe(vence);
  expect(
    lista.suscripciones[0].senales.some((s) => s.codigo === 'prueba'),
  ).toBe(true);
  expect(
    (await prisma.suscripcion.findUniqueOrThrow({ where: { id } })).trialHasta,
  ).toBeNull();
});

it('protege lectura y escritura con roles y valida filtros, solicitud y motivo', async () => {
  expect(
    Reflect.getMetadata('__guards__', SuscripcionesPlataformaController),
  ).toContain(PlataformaGuard);
  expect(
    Reflect.getMetadata(
      '__guards__',
      // eslint-disable-next-line @typescript-eslint/unbound-method -- Se inspecciona metadata, no se invoca el método.
      SuscripcionesPlataformaController.prototype.sincronizar,
    ),
  ).toContain(PlataformaAdminGuard);
  expect(
    await validate(
      plainToInstance(ConsultarPaddleDto, {
        solicitudId: 'x',
        motivo: '  ',
        tenantId: tenant,
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    ),
  ).toHaveLength(3);
  expect(
    (
      await validate(
        plainToInstance(ConsultaSuscripcionesDto, {
          pagina: 0,
          limite: 999,
          caso: 'desconocido',
        }),
      )
    ).length,
  ).toBeGreaterThan(0);
});
it('lista y diagnostica con filtros en servidor sin consultar Paddle', async () => {
  const l = await service.listar({
    pagina: 1,
    limite: 1,
    q: referencia,
    caso: 'atencion',
  });
  expect(l.total).toBe(1);
  expect(l.suscripciones).toHaveLength(1);
  expect(l.suscripciones[0].senales.map((s) => s.codigo)).toEqual(
    expect.arrayContaining(['mora', 'bloqueo', 'consulta']),
  );
  expect(l.suscripciones[0].acceso.modo).toBe('bloqueado');
  expect(
    (
      await service.listar({
        pagina: 1,
        limite: 10,
        q: referencia,
        proveedor: 'manual',
      })
    ).total,
  ).toBe(0);
  await service.detalle(id);
  expect(leer).not.toHaveBeenCalled();
});
it('actualiza desde Paddle, conserva bloqueo administrativo y registra antes/después', async () => {
  const resultado = await service.sincronizar(auth, id, randomUUID(), motivo);
  expect(resultado.estado).toBe('completada');
  const d = await service.detalle(id);
  expect(d.estado).toBe('activa');
  expect(d.acceso.modo).toBe('bloqueado');
  expect(d.ultimaConsulta).not.toBeNull();
  expect(resultado.antesJson).toMatchObject({ estado: 'suspendida' });
  expect(resultado.despuesJson).toMatchObject({ estado: 'activa' });
  expect(
    await prisma.plataformaEvento.count({
      where: { staffUserId: auth.userId },
    }),
  ).toBe(2);
});
it('reintentar la misma solicitud no vuelve a consultar ni duplicar auditoría', async () => {
  const solicitud = randomUUID();
  const r = await service.sincronizar(auth, id, solicitud, motivo);
  expect((await service.sincronizar(auth, id, solicitud, motivo)).id).toBe(
    r.id,
  );
  expect(leer).toHaveBeenCalledTimes(1);
  await expect(
    service.sincronizar(auth, id, solicitud, 'Otro motivo'),
  ).rejects.toThrow('otra operación');
});
it('impide dos consultas simultáneas y devuelve la operación al repetir su identificador', async () => {
  let liberar!: (v: unknown) => void;
  let iniciada!: () => void;
  const listo = new Promise<void>((r) => {
    iniciada = r;
  });
  leer.mockImplementationOnce(() => {
    iniciada();
    return new Promise((r) => {
      liberar = r;
    });
  });
  const solicitud = randomUUID();
  const pendiente = service.sincronizar(auth, id, solicitud, motivo);
  await listo;
  try {
    expect(
      (await service.sincronizar(auth, id, solicitud, motivo)).estado,
    ).toBe('en_curso');
    await expect(
      service.sincronizar(auth, id, randomUUID(), motivo),
    ).rejects.toThrow('en curso');
  } finally {
    liberar(remoto());
  }
  await pendiente;
  expect(leer).toHaveBeenCalledTimes(1);
});
it('un fallo queda registrado sin exponer excepciones ni afirmar actualización', async () => {
  leer.mockRejectedValueOnce(
    new Error('API_TOKEN_privado y datos del cliente'),
  );
  const r = await service.sincronizar(auth, id, randomUUID(), motivo);
  expect(r.estado).toBe('fallida');
  expect(JSON.stringify(r)).not.toContain('API_TOKEN');
  expect((await service.detalle(id)).estado).toBe('suspendida');
  expect((await service.historial(id, 1, 10)).operaciones[0].estado).toBe(
    'fallida',
  );
});
it('rechaza Soporte, sesiones revocadas y ausencia de MFA, aun llamando al servicio', async () => {
  await prisma.user.update({
    where: { id: auth.userId },
    data: { rolPlataforma: 'SOPORTE' },
  });
  await expect(
    service.sincronizar(auth, id, randomUUID(), motivo),
  ).rejects.toThrow('Administración');
  await prisma.user.update({
    where: { id: auth.userId },
    data: { rolPlataforma: 'ADMIN' },
  });
  await prisma.authSession.update({
    where: { id: auth.sessionId },
    data: { mfaVerificadoEl: null },
  });
  await expect(
    service.sincronizar(auth, id, randomUUID(), motivo),
  ).rejects.toThrow('MFA');
  await expect(
    service.sincronizar(
      { ...auth, esPlataforma: false },
      id,
      randomUUID(),
      motivo,
    ),
  ).rejects.toThrow('personal');
  expect(leer).not.toHaveBeenCalled();
});
it('vuelve a comprobar autorización después de obtener la respuesta', async () => {
  leer.mockImplementationOnce(async () => {
    await prisma.user.update({
      where: { id: auth.userId },
      data: { rolPlataforma: 'SOPORTE' },
    });
    return remoto();
  });
  expect(
    (await service.sincronizar(auth, id, randomUUID(), motivo)).estado,
  ).toBe('fallida');
  expect((await service.detalle(id)).estado).toBe('suspendida');
});
it('no permite consultar una suscripción manual ni aplicar una referencia o empresa ajena', async () => {
  leer.mockResolvedValueOnce(remoto({ id: 'sub_otro' }));
  expect(
    (await service.sincronizar(auth, id, randomUUID(), motivo)).estado,
  ).toBe('fallida');
  leer.mockResolvedValueOnce(
    remoto({ custom_data: { tenantId: randomUUID() } }),
  );
  expect(
    (await service.sincronizar(auth, id, randomUUID(), motivo)).estado,
  ).toBe('fallida');
  await prisma.suscripcion.update({
    where: { id },
    data: { proveedor: 'manual' },
  });
  await expect(
    service.sincronizar(auth, id, randomUUID(), motivo),
  ).rejects.toThrow('vínculo');
});
it('una respuesta de API vieja no pisa un evento más reciente recibido durante la consulta', async () => {
  const viejo = new Date(Date.now() - 60_000);
  leer.mockImplementationOnce(async () => {
    await sync.aplicar(sync.extraer(remoto({ status: 'canceled' }))!, {
      origen: 'webhook',
      ocurridoEl: new Date(),
    });
    return remoto({ updated_at: viejo.toISOString() });
  });
  expect(
    (await service.sincronizar(auth, id, randomUUID(), motivo)).estado,
  ).toBe('sin_aplicar');
  expect((await service.detalle(id)).estado).toBe('baja');
});
it('un webhook antiguo posterior a una consulta reciente no revierte su estado', async () => {
  await service.sincronizar(auth, id, randomUUID(), motivo);
  const old = new Date(Date.now() - 60_000);
  const r = await sync.aplicar(
    sync.extraer(
      remoto({ status: 'past_due', updated_at: old.toISOString() }),
    )!,
    { origen: 'webhook', ocurridoEl: old },
  );
  expect(r.aplicado).toBe(false);
  expect((await service.detalle(id)).estado).toBe('activa');
});
it('informa la falta de vínculo del precio sin inventar un nuevo plan', async () => {
  leer.mockResolvedValueOnce(
    remoto({ items: [{ price: { id: 'pri_desconocido' } }] }),
  );
  expect(
    (await service.sincronizar(auth, id, randomUUID(), motivo)).estado,
  ).toBe('revisar');
  expect((await service.detalle(id)).plan.id).toBe(plan);
});
it('distingue eventos históricos informativos de fallidos y omite payloads y errores crudos', async () => {
  for (const [tipo, procesadoEl, errorTexto] of [
    ['transaction.completed', new Date(), 'Texto interno sensible'],
    ['subscription.updated', null, 'API_TOKEN_privado'],
    ['subscription.updated', new Date(), 'Evento anterior al último aplicado'],
  ] as const)
    await prisma.eventoCobro.create({
      data: {
        proveedor: 'paddle',
        eventoId: randomUUID(),
        tipo,
        referenciaSuscripcion: referencia,
        payloadJson: { secret: 'privado' },
        procesadoEl,
        errorTexto,
      },
    });
  const r = await service.eventos(id, 1, 10);
  expect(r.eventos.map((e) => e.resultado)).toEqual(
    expect.arrayContaining(['ignorado', 'fallido', 'sin_aplicar']),
  );
  expect(JSON.stringify(r)).not.toMatch(/API_TOKEN|secret|Texto interno/);
  expect((await service.eventos(id, 2, 2)).eventos).toHaveLength(1);
});
it('dos entregas simultáneas del mismo webhook aplican una vez y dejan resultado explícito', async () => {
  const webhook = new CobroWebhookController(db, paddle, sync);
  verificar.mockResolvedValue({
    eventId: randomUUID(),
    eventType: 'subscription.updated',
    data: remoto(),
    occurredAt: new Date(),
  });
  const resultados = await Promise.all([
    webhook.paddleWebhook({ rawBody: Buffer.from('{}') }, 'firma'),
    webhook.paddleWebhook({ rawBody: Buffer.from('{}') }, 'firma'),
  ]);
  expect(resultados.filter((r) => 'repetido' in r)).toHaveLength(1);
  expect((await service.eventos(id, 1, 10)).eventos[0].resultado).toBe(
    'aplicado',
  );
});
it('permite recuperar una consulta abandonada y no vuelve a ejecutar su solicitud original', async () => {
  const vieja = await prisma.sincronizacionPaddle.create({
    data: {
      id: randomUUID(),
      tenantId: tenant,
      suscripcionId: id,
      referencia,
      staffUserId: auth.userId,
      motivo,
      creadaEl: new Date(Date.now() - 180_000),
    },
  });
  expect((await service.historial(id, 1, 10)).operaciones[0].estado).toBe(
    'interrumpida',
  );
  expect(
    (await service.sincronizar(auth, id, randomUUID(), motivo)).estado,
  ).toBe('completada');
  expect((await service.sincronizar(auth, id, vieja.id, motivo)).estado).toBe(
    'interrumpida',
  );
  expect(leer).toHaveBeenCalledTimes(1);
});
