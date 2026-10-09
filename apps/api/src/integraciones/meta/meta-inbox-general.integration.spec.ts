import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, RolSistema, type MetaVinculo } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import { expandir, permisosDeRolBase } from '../../auth/permisos';
import { runWithTenant } from '../../common/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappContextoService } from '../../clientes/whatsapp-contexto.service';
import { MetaInboxGeneralService } from './meta-inbox-general.service';
import { aplicarOperacionInbox } from './inbox/meta-inbox-proyeccion';
import type { OperacionInbox } from './inbox/meta-inbox-normalizar';
import type { MetaInboxQueryDto } from './meta-inbox.dto';
import { WebhooksWhatsappService } from '../../webhooks-whatsapp/webhooks-whatsapp.service';
import { MetaInboxProcesador } from './inbox/meta-inbox-procesador.service';
import { MetaInboxStreamService } from './meta-inbox-stream.service';
import { InboxTiempoRealBus } from '../../inbox-tiempo-real/inbox-tiempo-real.bus';

const url = new URL(process.env.DATABASE_URL!);
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  !url.pathname.endsWith('_test')
)
  throw new Error('Esta prueba requiere PostgreSQL local *_test.');
const db = new PrismaService();
const envAnterior = process.env.META_INBOX_LECTURA_ENABLED;
const envRecepcion = process.env.META_INBOX_RECEPCION_ENABLED;
const envPiloto = process.env.META_WHATSAPP_PILOT_ENABLED;
const envRedis = process.env.REDIS_URL;
const fetchAnterior = global.fetch;
const tenants: string[] = [],
  users: string[] = [];
let auth: CurrentAuth,
  otra: CurrentAuth,
  canal: MetaVinculo,
  ajeno: MetaVinculo;
let service: MetaInboxGeneralService, contexto: WhatsappContextoService;
const capacidades = { exigirIncluida: jest.fn() };
const telefono = '16505550123';
const fecha = new Date('2026-09-20T12:00:00Z');
async function crear() {
  const tenantId = randomUUID(),
    userId = randomUUID();
  tenants.push(tenantId);
  users.push(userId);
  await db.tenant.create({
    data: {
      id: tenantId,
      nombre: 'Lectura ficticia',
      slug: `lectura-${tenantId}`,
    },
  });
  await db.user.create({
    data: { id: userId, email: `${userId}@example.invalid` },
  });
  const m = await db.membership.create({
    data: { tenantId, userId, rol: RolSistema.ADMINISTRADOR },
  });
  const s = await db.authSession.create({
    data: {
      userId,
      currentTenantId: tenantId,
      currentMembershipId: m.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const a: CurrentAuth = {
    tenantId,
    userId,
    sessionId: s.id,
    membershipId: m.id,
    role: RolSistema.ADMINISTRADOR,
    email: `${userId}@example.invalid`,
    permisos: expandir(permisosDeRolBase(RolSistema.ADMINISTRADOR)),
  };
  const v = await db.metaVinculo.create({
    data: {
      tenantId,
      wabaId: randomUUID(),
      phoneNumberId: randomUUID(),
      numero: '+16505550100',
      autorizacionId: randomUUID(),
      verificadoEl: new Date(),
      recepcionDesdeEl: new Date(),
      tokenCifrado: { solo: 'ficticio' },
    },
  });
  return { a, v };
}
async function chat(
  v = canal,
  waId = telefono,
  cantidad = 1,
  nombre = 'Alma Ferrer',
) {
  const c = await db.inboxConversacion.create({
    data: {
      tenantId: v.tenantId,
      vinculoId: v.id,
      contactoWaId: waId,
      ultimoMensajeEl: fecha,
    },
  });
  await db.inboxContacto.create({
    data: {
      tenantId: v.tenantId,
      vinculoId: v.id,
      waId,
      nombre,
      actualizadoMetaEl: fecha,
    },
  });
  const mensajes = Array.from({ length: cantidad }, (_, n) => ({
    id: randomUUID(),
    tenantId: v.tenantId,
    vinculoId: v.id,
    conversacionId: c.id,
    wamid: randomUUID(),
    direccion: n % 2 ? 'SALIENTE' : 'ENTRANTE',
    enviadoEl: new Date(fecha.getTime() + n * 1000),
    tipo: 'text',
    contenido: {
      texto: `Texto ficticio ${n}`,
      mediaId: 'NO_EXPONER',
      url: 'https://example.invalid/no-abrir',
    },
  }));
  if (mensajes.length) await db.inboxMensaje.createMany({ data: mensajes });
  return { c, mensajes };
}
const leer = (q: MetaInboxQueryDto = {}, a = auth) =>
  runWithTenant(a.tenantId, () => service.consultar(a, q, '127.0.0.1'));
beforeAll(async () => {
  await db.$connect();
  global.fetch = jest
    .fn()
    .mockRejectedValue(new Error('Prohibidas llamadas externas'));
});
beforeEach(async () => {
  process.env.META_INBOX_LECTURA_ENABLED = 'true';
  ({ a: auth, v: canal } = await crear());
  ({ a: otra, v: ajeno } = await crear());
  capacidades.exigirIncluida.mockReset().mockResolvedValue(undefined);
  contexto = new WhatsappContextoService(db);
  service = new MetaInboxGeneralService(db, capacidades as never, contexto);
});
afterEach(async () => {
  jest.restoreAllMocks();
  const where = { tenantId: { in: tenants } };
  await db.inboxTrabajoEvento.deleteMany({ where });
  await db.inboxBloqueHistorial.deleteMany({ where });
  await db.inboxImportacion.deleteMany({ where });
  await db.webhookWhatsappCrudo.deleteMany({
    where: { wabaId: { in: [canal.wabaId, ajeno.wabaId] } },
  });
  await db.inboxMensaje.deleteMany({ where });
  await db.inboxConversacion.deleteMany({ where });
  await db.inboxContacto.deleteMany({ where });
  await db.metaVinculo.deleteMany({ where });
  await db.cliente.deleteMany({ where });
  await db.tenant.deleteMany({ where: { id: { in: tenants } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  tenants.length = 0;
  users.length = 0;
});
afterAll(async () => {
  await db.$disconnect();
  global.fetch = fetchAnterior;
  for (const [k, v] of Object.entries({
    META_INBOX_LECTURA_ENABLED: envAnterior,
    META_INBOX_RECEPCION_ENABLED: envRecepcion,
    META_WHATSAPP_PILOT_ENABLED: envPiloto,
    REDIS_URL: envRedis,
  })) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

it('lee varios chats, separa empresas y deriva el contexto por teléfono sin revelar el contenido crudo', async () => {
  const a = await chat(),
    b = await chat(canal, '16505550124', 1, 'Bruno Lago');
  await chat(ajeno, telefono, 1, 'Nombre ajeno');
  const cliente = await db.cliente.create({
    data: {
      tenantId: auth.tenantId,
      nombre: 'Estudio Oliva',
      telefonoCodigo: '+1',
      telefonoNumero: '6505550123',
      paisCodigo: 'US',
    },
  });
  const resultado = await leer({ conversacionId: a.c.id });
  expect(resultado?.conversaciones).toHaveLength(2);
  expect(resultado?.contacto).toEqual({
    telefono: `+${telefono}`,
    nombre: 'Alma Ferrer',
  });
  expect(resultado?.contexto?.cliente?.id).toBe(cliente.id);
  expect(resultado?.mensajes[0]).toMatchObject({
    id: a.mensajes[0].id,
    texto: 'Texto ficticio 0',
    direccion: 'ENTRANTE',
  });
  for (const oculto of [
    'NO_EXPONER',
    'no-abrir',
    'Nombre ajeno',
    'wamid',
    'tokenCifrado',
  ])
    expect(JSON.stringify(resultado)).not.toContain(oculto);
  expect(
    (await leer({ conversacionId: b.c.id }))?.contexto?.cliente,
  ).toBeNull();
  await expect(
    leer({ conversacionId: b.c.id, clienteId: cliente.id }),
  ).rejects.toBeInstanceOf(NotFoundException);
});
it('una conexión vacía es una bandeja vacía; sin conexión no hay lectura', async () => {
  expect(await leer()).toMatchObject({
    origen: 'GENERAL',
    conversacionId: null,
    conversaciones: [],
    mensajes: [],
    contexto: null,
  });
  process.env.META_INBOX_LECTURA_ENABLED = 'false';
  expect(await leer()).toBeNull();
});
it.each([
  'revocado',
  'suspendido',
  'sin_token',
  'json_null',
  'token_vencido',
  'datos_vencidos',
  'sin_alta',
])('retira la bandeja si el canal queda %s', async (caso) => {
  await chat();
  await db.metaVinculo.update({
    where: { id: canal.id },
    data: {
      ...(caso === 'revocado' ? { estado: 'DESCONECTADO' } : {}),
      ...(caso === 'suspendido' ? { estado: 'SUSPENDIDO' } : {}),
      ...(caso === 'sin_token' ? { tokenCifrado: Prisma.DbNull } : {}),
      ...(caso === 'json_null' ? { tokenCifrado: Prisma.JsonNull } : {}),
      ...(caso === 'token_vencido' ? { tokenVenceEl: new Date(0) } : {}),
      ...(caso === 'datos_vencidos' ? { accesoDatosVenceEl: new Date(0) } : {}),
      ...(caso === 'sin_alta' ? { recepcionDesdeEl: null } : {}),
    },
  });
  expect(await leer()).toBeNull();
});
it('pagina la lista con fechas iguales, busca en todas las páginas y trata % como texto', async () => {
  for (let i = 0; i < 53; i++)
    await chat(
      canal,
      `1650555${String(100 + i).padStart(4, '0')}`,
      1,
      i === 52 ? 'Taller Único 100%' : 'Contacto común',
    );
  const primera = await leer();
  expect(primera?.conversaciones).toHaveLength(50);
  const segunda = await leer({ listaAntesDe: primera!.listaAnterior! });
  expect(segunda?.conversaciones).toHaveLength(3);
  expect(
    new Set(
      [...primera!.conversaciones, ...segunda!.conversaciones].map((c) => c.id),
    ).size,
  ).toBe(53);
  expect((await leer({ busqueda: 'ÚNICO' }))?.conversaciones).toHaveLength(1);
  expect((await leer({ busqueda: 'unico' }))?.conversaciones).toHaveLength(1);
  expect((await leer({ busqueda: '%' }))?.conversaciones).toHaveLength(1);
  expect(
    (await leer({ busqueda: '+1 (650) 555-0152' }))?.conversaciones,
  ).toHaveLength(1);
  await expect(
    leer({ listaAntesDe: primera!.listaAnterior!, busqueda: 'otra' }),
  ).rejects.toBeInstanceOf(BadRequestException);
  await expect(
    leer({ listaAntesDe: primera!.listaAnterior! }, otra),
  ).rejects.toBeInstanceOf(BadRequestException);
  await db.metaVinculo.update({
    where: { id: canal.id },
    data: { autorizacionId: randomUUID() },
  });
  await expect(
    leer({ listaAntesDe: primera!.listaAnterior! }),
  ).rejects.toBeInstanceOf(BadRequestException);
});
it('pagina mensajes y refresca ediciones y eliminaciones anteriores a los últimos 50', async () => {
  const { c, mensajes } = await chat(canal, telefono, 73);
  const primera = await leer({ conversacionId: c.id });
  expect(primera?.mensajes).toHaveLength(50);
  const segunda = await leer({
    conversacionId: c.id,
    antesDe: primera!.anterior!,
  });
  expect(segunda?.mensajes).toHaveLength(23);
  expect(segunda?.anterior).toBeNull();
  await db.inboxMensaje.update({
    where: { id: mensajes[0].id },
    data: { revocadoEl: new Date() },
  });
  await db.inboxMensaje.update({
    where: { id: mensajes[1].id },
    data: {
      edicionEl: new Date(),
      contenido: { texto: 'Texto corregido' },
      estadoEntrega: 'READ',
      delCelular: true,
      delHistorial: true,
    },
  });
  const refresco = await leer({
    conversacionId: c.id,
    desdeId: mensajes[0].id,
  });
  expect(refresco?.mensajes).toHaveLength(73);
  expect(refresco?.anterior).toBeNull();
  expect(refresco?.mensajes[0]).toMatchObject({
    eliminado: true,
    texto: null,
    tipo: 'revocado',
  });
  expect(refresco?.mensajes[1]).toMatchObject({
    texto: 'Texto corregido',
    editado: true,
    estadoEntrega: 'READ',
    delCelular: true,
    delHistorial: true,
  });
  expect(
    (await leer({ conversacionId: c.id, desdeId: mensajes[10].id }))?.anterior,
  ).toBe(mensajes[10].id);
});
it('acota una reconexión larga a 500 mensajes, con aviso y cursor para seguir leyendo', async () => {
  const { c, mensajes } = await chat(canal, telefono, 503);
  const r = await leer({ conversacionId: c.id, desdeId: mensajes[0].id });
  expect(r?.mensajes).toHaveLength(500);
  expect(r?.ventanaAcotada).toBe(true);
  expect(r?.anterior).toBe(mensajes[3].id);
  expect(
    (await leer({ conversacionId: c.id, antesDe: r!.anterior! }))?.mensajes,
  ).toHaveLength(3);
});
it('rechaza conversaciones y cursores ajenos, incluso de otro chat de la misma empresa', async () => {
  const a = await chat(),
    b = await chat(canal, '16505550124'),
    c = await chat(ajeno);
  for (const q of [
    { conversacionId: c.c.id },
    { conversacionId: a.c.id, antesDe: b.mensajes[0].id },
    { conversacionId: a.c.id, desdeId: c.mensajes[0].id },
  ])
    await expect(leer(q)).rejects.toBeInstanceOf(NotFoundException);
  await expect(leer({ antesDe: a.mensajes[0].id })).rejects.toBeInstanceOf(
    BadRequestException,
  );
  await expect(
    leer({
      conversacionId: a.c.id,
      antesDe: a.mensajes[0].id,
      desdeId: a.mensajes[0].id,
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
});
it('no presenta complementos huérfanos ni recupera nombres eliminados del directorio', async () => {
  const { c } = await chat();
  await db.inboxMensaje.create({
    data: {
      tenantId: auth.tenantId,
      vinculoId: canal.id,
      wamid: randomUUID(),
      estadoEntrega: 'READ',
      contenido: { texto: 'Huérfano no visible' },
    },
  });
  await db.inboxContacto.updateMany({
    where: { vinculoId: canal.id },
    data: { eliminado: true },
  });
  const r = await leer({ conversacionId: c.id });
  expect(r?.mensajes).toHaveLength(1);
  expect(r?.contacto.nombre).toBeNull();
  expect(r?.conversaciones[0].nombre).toBeNull();
  expect((await leer({ busqueda: 'Alma' }))?.conversaciones).toHaveLength(0);
});
it('aplica permisos de CRM y valida de nuevo sesión y generación al finalizar la lectura', async () => {
  const { c } = await chat();
  const restringida = {
    ...auth,
    permisos: new Set(['configuracion.gestionar']),
  };
  expect(
    (await leer({ conversacionId: c.id }, restringida))?.contexto,
  ).toBeNull();
  await expect(
    leer({ conversacionId: c.id, clienteId: randomUUID() }, restringida),
  ).rejects.toBeInstanceOf(ForbiddenException);
  jest.spyOn(contexto, 'contexto').mockImplementationOnce(async () => {
    await db.metaVinculo.update({
      where: { id: canal.id },
      data: { autorizacionId: randomUUID() },
    });
    return null as never;
  });
  await expect(leer()).rejects.toBeInstanceOf(ForbiddenException);
  await db.authSession.update({
    where: { id: auth.sessionId },
    data: { revokedAt: new Date() },
  });
  await expect(leer()).rejects.toBeInstanceOf(ForbiddenException);
});
it('la capacidad del plan sigue siendo obligatoria y jamás llama a Meta', async () => {
  capacidades.exigirIncluida.mockRejectedValue(new ForbiddenException());
  await expect(leer()).rejects.toBeInstanceOf(ForbiddenException);
  expect(global.fetch).not.toHaveBeenCalled();
});
it('no usa permisos antiguos del JWT para conservar acceso al CRM', async () => {
  await chat();
  const rol = await db.rol.create({
    data: {
      tenantId: auth.tenantId,
      nombre: 'Rol ficticio',
      permisos: ['configuracion.gestionar'],
    },
  });
  await db.membership.update({
    where: { id: auth.membershipId },
    data: { rolId: rol.id },
  });
  const spy = jest.spyOn(contexto, 'contexto');
  expect((await leer())?.contexto).toBeNull();
  expect(spy).not.toHaveBeenCalled();
  await db.rol.update({
    where: { id: rol.id },
    data: { permisos: ['configuracion.gestionar', 'crm.ver'] },
  });
  spy.mockImplementationOnce(async () => {
    await db.rol.update({
      where: { id: rol.id },
      data: { permisos: ['configuracion.gestionar'] },
    });
    return null as never;
  });
  await expect(leer()).rejects.toBeInstanceOf(ForbiddenException);
});
it('un webhook confirmado recorre PostgreSQL, el bus, SSE y la lectura general sin Meta real', async () => {
  process.env.META_INBOX_RECEPCION_ENABLED = 'true';
  process.env.META_WHATSAPP_PILOT_ENABLED = 'false';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  const bus = new InboxTiempoRealBus(db);
  const procesador = new MetaInboxProcesador(db, bus);
  const webhook = new WebhooksWhatsappService(db, undefined, procesador);
  const stream = new MetaInboxStreamService(db, capacidades as never, bus);
  let resolver!: (value: unknown) => void, rechazar!: (error: Error) => void;
  const cambio = new Promise((resolve, reject) => {
    resolver = resolve;
    rechazar = reject;
  });
  const timeout = setTimeout(
    () => rechazar(new Error('No llegó la revisión del mensaje al stream')),
    4000,
  );
  const sub = (
    await stream.abrir(auth, '127.0.0.1', Date.now() + 60000)
  ).subscribe((e) => {
    if (e.type === 'reintentar' || e.type === 'acceso_cerrado')
      rechazar(new Error(`El stream cerró: ${e.type}`));
    if (e.id === '1') resolver(e);
  });
  try {
    await db.metaVinculo.update({
      where: { id: canal.id },
      data: { recepcionDesdeEl: new Date(Date.now() - 60000) },
    });
    await webhook.persistir(
      webhook.extraerCambios({
        entry: [
          {
            id: canal.wabaId,
            time: Math.floor(Date.now() / 1000),
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { phone_number_id: canal.phoneNumberId },
                  contacts: [{ wa_id: telefono, profile: { name: 'Alma' } }],
                  messages: [
                    {
                      id: 'wamid.ensayo-local',
                      from: telefono,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      type: 'text',
                      text: { body: 'Consulta de prueba en vivo' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );
    expect(await procesador.procesarSiguiente()).toBe(true);
    const evento = await cambio;
    expect(JSON.stringify(evento)).not.toContain('Consulta de prueba');
    expect(await leer()).toMatchObject({
      mensajes: [
        expect.objectContaining({
          texto: 'Consulta de prueba en vivo',
          direccion: 'ENTRANTE',
        }),
      ],
    });
    expect(global.fetch).not.toHaveBeenCalled();
  } finally {
    clearTimeout(timeout);
    sub.unsubscribe();
    bus.onModuleDestroy();
  }
});

it('resuelve citas sólo dentro de la misma conversación y oculta el contenido revocado', async () => {
  const propio = await chat(canal, '16505550123', 2, 'Alma');
  const otro = await chat(canal, '16505550124', 1, 'Bruno');
  const externo = await chat(ajeno);
  const [original, respuesta] = propio.mensajes;
  const modificar = (contenido: Prisma.InputJsonObject) =>
    db.inboxMensaje.update({
      where: { id: respuesta.id },
      data: { contenido },
    });
  await modificar({ texto: 'Entendido', contextoWamid: original.wamid });
  let r = await leer({ conversacionId: propio.c.id });
  expect(r?.mensajes.find((m) => m.id === respuesta.id)?.cita).toMatchObject({
    id: original.id,
    texto: 'Texto ficticio 0',
  });
  expect(JSON.stringify(r)).not.toContain(original.wamid);
  for (const ajenoWamid of [
    otro.mensajes[0].wamid,
    externo.mensajes[0].wamid,
  ]) {
    await modificar({ texto: 'Entendido', contextoWamid: ajenoWamid });
    r = await leer({ conversacionId: propio.c.id });
    expect(r?.mensajes.find((m) => m.id === respuesta.id)?.cita).toMatchObject({
      id: null,
      texto: 'Mensaje anterior no disponible',
    });
  }
  await db.inboxMensaje.update({
    where: { id: original.id },
    data: { revocadoEl: new Date() },
  });
  await modificar({ texto: 'Entendido', contextoWamid: original.wamid });
  r = await leer({ conversacionId: propio.c.id });
  expect(r?.mensajes.find((m) => m.id === respuesta.id)?.cita).toMatchObject({
    eliminado: true,
    texto: 'Mensaje eliminado',
  });
  expect(JSON.stringify(r?.mensajes)).not.toContain('Texto ficticio 0');
});

it('ordena por mensaje entrante o saliente; historial, lectura y edición no adelantan chats', async () => {
  const a = await chat(),
    b = await chat(canal, '16505550124', 1, 'Bruno Lago');
  const aplicar = (op: OperacionInbox) =>
    runWithTenant(auth.tenantId, () =>
      db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "MetaVinculo" WHERE id=${canal.id}::uuid FOR UPDATE`;
        return aplicarOperacionInbox(tx, canal, op);
      }),
    );
  const nuevo = (
    contacto: string,
    segundos: number,
    direccion: 'ENTRANTE' | 'SALIENTE',
    origen: 'NUEVO' | 'GRAFO' | 'HISTORIAL' = 'NUEVO',
  ): OperacionInbox => ({
    clase: 'mensaje',
    wamid: randomUUID(),
    contacto,
    direccion,
    fecha: new Date(fecha.getTime() + segundos * 1000),
    origen,
    tipo: 'text',
    contenido: { texto: `Mensaje ${segundos}` },
    prioridad: 3,
  });
  await aplicar(nuevo('16505550124', 10, 'ENTRANTE'));
  expect((await leer())?.conversaciones.map((c) => c.id)).toEqual([
    b.c.id,
    a.c.id,
  ]);
  await aplicar(nuevo(telefono, 20, 'SALIENTE', 'GRAFO'));
  await aplicar(nuevo('16505550124', -86400, 'ENTRANTE', 'HISTORIAL'));
  await aplicar({
    clase: 'estado',
    wamid: b.mensajes[0].wamid,
    fecha: new Date(fecha.getTime() + 86400_000),
    estado: 'READ',
    orden: 3,
  });
  await aplicar({
    clase: 'edicion',
    wamid: b.mensajes[0].wamid,
    fecha: new Date(fecha.getTime() + 86400_000),
    tipo: 'text',
    contenido: { texto: 'Texto corregido' },
    prioridad: 3,
  });
  const resultado = await leer({ conversacionId: b.c.id });
  expect(resultado?.conversacionId).toBe(b.c.id);
  expect(resultado?.conversaciones.map((c) => c.id)).toEqual([a.c.id, b.c.id]);
  expect(resultado?.conversaciones.map((c) => c.ultimoMensaje?.texto)).toEqual([
    'Mensaje 20',
    'Mensaje 10',
  ]);
  expect(resultado?.conversaciones[0].ultimoMensaje?.enviadoEl).toBe(
    new Date(fecha.getTime() + 20000).toISOString(),
  );
});
