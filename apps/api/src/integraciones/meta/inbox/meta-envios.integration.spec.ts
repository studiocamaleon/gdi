import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  RolSistema,
  type MetaVinculo,
  type InboxConversacion,
} from '@prisma/client';
import type { CurrentAuth } from '../../../auth/auth.types';
import { PrismaService } from '../../../prisma/prisma.service';
import { runWithTenant } from '../../../common/tenant-context';
import { expandir, permisosDeRolBase } from '../../../auth/permisos';
import { MetaEnviosService } from './meta-envios.service';
import { ventanaRespuesta, presentarEnvio } from './meta-envios.config';
import { aplicarOperacionInbox } from './meta-inbox-proyeccion';
import { normalizarEventoInbox } from './meta-inbox-normalizar';
import type { ResultadoMeta } from '../meta-cloud.client';
const url = new URL(process.env.DATABASE_URL!);
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  !url.pathname.endsWith('_test')
)
  throw new Error('Requiere base local de tests');
const db = new PrismaService();
const client = { enviarTexto: jest.fn<Promise<ResultadoMeta>, [unknown]>() };
const secretos = {
  disponible: true,
  descifrar: jest.fn(() => 'token-ficticio'),
};
const capacidades = { exigirOperacionTx: jest.fn(), exigirIncluida: jest.fn() },
  bus = { avisar: jest.fn() };
const servicio = () =>
  new MetaEnviosService(
    db,
    client as never,
    secretos as never,
    capacidades as never,
    bus as never,
  );
const keys = [
  'META_INBOX_ENVIOS_ENABLED',
  'META_CONEXION_MODO',
  'META_CONEXION_TENANT_IDS',
  'META_INBOX_RECEPCION_ENABLED',
  'META_INBOX_LECTURA_ENABLED',
  'META_APP_ID',
  'META_APP_SECRET',
  'META_EMBEDDED_SIGNUP_CONFIG_ID',
];
const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
let auth: CurrentAuth,
  canal: MetaVinculo,
  conv: InboxConversacion,
  fetchMock: jest.SpyInstance;
async function preparar() {
  const t = await db.tenant.create({
    data: { nombre: 'Mensajes ficticios', slug: `envios-${randomUUID()}` },
  });
  const u = await db.user.create({
    data: { email: `${randomUUID()}@example.invalid` },
  });
  const m = await db.membership.create({
    data: { tenantId: t.id, userId: u.id, rol: RolSistema.ADMINISTRADOR },
  });
  const s = await db.authSession.create({
    data: {
      userId: u.id,
      currentTenantId: t.id,
      currentMembershipId: m.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  auth = {
    tenantId: t.id,
    userId: u.id,
    sessionId: s.id,
    membershipId: m.id,
    role: RolSistema.ADMINISTRADOR,
    email: u.email,
    permisos: expandir(permisosDeRolBase(RolSistema.ADMINISTRADOR)),
  } as CurrentAuth;
  canal = await db.metaVinculo.create({
    data: {
      tenantId: t.id,
      autorizacionId: randomUUID(),
      phoneNumberId: '123456',
      wabaId: randomUUID(),
      numero: '+16505550100',
      tokenCifrado: { ficticio: true },
      recepcionDesdeEl: new Date(Date.now() - 3600000),
      verificadoEl: new Date(Date.now() - 3600000),
    },
  });
  conv = await db.inboxConversacion.create({
    data: {
      tenantId: t.id,
      vinculoId: canal.id,
      contactoWaId: '16505550123',
      ultimoEntranteNuevoEl: new Date(Date.now() - 60000),
    },
  });
}
const dto = () => ({
  clave: randomUUID(),
  canalId: `${canal.id}:${canal.autorizacionId}`,
  texto: 'Hola, el trabajo ya está listo.',
});
const enviar = (d = dto(), c = conv.id, a = auth) =>
  runWithTenant(a.tenantId, () => servicio().enviar(a, '127.0.0.1', c, d));
async function webhook(
  id: string,
  status = 'delivered',
  recipient = '16505550123',
  wamid = 'wamid.respuesta',
) {
  const ops = normalizarEventoInbox(
    {
      tipo: 'statuses',
      payload: {
        statuses: [
          {
            id: wamid,
            status,
            recipient_id: recipient,
            timestamp: String(Math.floor(Date.now() / 1000)),
            biz_opaque_callback_data: `grafo-inbox:${id}`,
          },
        ],
      },
    },
    canal.numero!,
  ).operaciones;
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "MetaVinculo" WHERE id=${canal.id}::uuid FOR NO KEY UPDATE`;
    for (const op of ops) await aplicarOperacionInbox(tx, canal, op);
  });
}
beforeEach(async () => {
  jest.resetAllMocks();
  fetchMock = jest
    .spyOn(global, 'fetch')
    .mockRejectedValue(new Error('Red real prohibida'));
  await preparar();
  Object.assign(process.env, {
    META_INBOX_ENVIOS_ENABLED: 'true',
    META_CONEXION_MODO: 'coexistencia',
    META_CONEXION_TENANT_IDS: auth.tenantId,
    META_INBOX_RECEPCION_ENABLED: 'true',
    META_INBOX_LECTURA_ENABLED: 'true',
    META_APP_ID: '111',
    META_APP_SECRET: 'ficticio',
    META_EMBEDDED_SIGNUP_CONFIG_ID: '222',
  });
  client.enviarTexto.mockResolvedValue({
    estado: 'aceptada',
    wamid: 'wamid.respuesta',
  });
  secretos.disponible = true;
  secretos.descifrar.mockReturnValue('token-ficticio');
  capacidades.exigirIncluida.mockResolvedValue(undefined);
  capacidades.exigirOperacionTx.mockResolvedValue(undefined);
});
afterEach(async () => {
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockRestore();
  const where = { tenantId: auth.tenantId };
  await db.inboxEnvio.deleteMany({ where });
  await db.inboxMensaje.deleteMany({ where });
  await db.inboxConversacion.deleteMany({ where });
  await db.inboxCanalRevision.deleteMany({ where });
  await db.metaVinculo.deleteMany({ where });
  await db.tenant.delete({ where: { id: auth.tenantId } });
  await db.user.delete({ where: { id: auth.userId } });
});
afterAll(async () => {
  await db.$disconnect();
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
it('reserva un solo envío, usa el destinatario del servidor y distingue aceptación de entrega', async () => {
  const d = dto(),
    r = await enviar(d);
  expect(r.estado).toBe('ACEPTADO');
  expect(r.texto).toBeNull();
  expect(await enviar(d)).toEqual(r);
  expect(client.enviarTexto).toHaveBeenCalledTimes(1);
  expect(client.enviarTexto).toHaveBeenCalledWith(
    expect.objectContaining({
      telefono: '+16505550123',
      texto: d.texto,
      correlacion: `grafo-inbox:${r.id}`,
    }),
  );
  const m = await db.inboxMensaje.findUniqueOrThrow({
    where: { id: r.mensajeId! },
  });
  expect(m.estadoEntrega).toBe('ACEPTADO');
  expect(m.entranteNuevo).toBe(false);
  expect(m.delHistorial).toBe(false);
  expect(bus.avisar).toHaveBeenCalled();
});
it('dos solicitudes concurrentes con la misma clave hacen un solo POST', async () => {
  const d = dto();
  await Promise.all([enviar(d), enviar(d)]);
  expect(client.enviarTexto).toHaveBeenCalledTimes(1);
  expect(
    await db.inboxEnvio.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(1);
});
it('no reutiliza una clave para otro texto ni conversación', async () => {
  const d = dto();
  await enviar(d);
  await expect(enviar({ ...d, texto: 'Otro texto' })).rejects.toBeInstanceOf(
    ConflictException,
  );
  await expect(enviar(d, randomUUID())).rejects.toBeInstanceOf(
    ConflictException,
  );
  expect(client.enviarTexto).toHaveBeenCalledTimes(1);
});
it.each([
  null,
  new Date(Date.now() - 25 * 3600000),
  new Date(Date.now() + 3600000),
])('no admite ventana sin evidencia vigente: %s', async (fecha) => {
  await db.inboxConversacion.update({
    where: { id: conv.id },
    data: { ultimoEntranteNuevoEl: fecha },
  });
  await expect(enviar()).rejects.toBeInstanceOf(ConflictException);
  expect(client.enviarTexto).not.toHaveBeenCalled();
});
it('el historial no abre la ventana aunque tenga mensajes recientes', async () => {
  await db.inboxConversacion.update({
    where: { id: conv.id },
    data: { ultimoEntranteNuevoEl: null },
  });
  await db.$transaction((tx) =>
    aplicarOperacionInbox(tx, canal, {
      clase: 'mensaje',
      wamid: 'wamid.historia',
      contacto: conv.contactoWaId,
      direccion: 'ENTRANTE',
      fecha: new Date(),
      origen: 'HISTORIAL',
      tipo: 'text',
      contenido: { texto: 'Historial' },
      prioridad: 1,
    }),
  );
  await expect(enviar()).rejects.toBeInstanceOf(ConflictException);
});
it('la frontera de 24 horas es cerrada y el reloj futuro no cuenta', () => {
  const ahora = new Date('2026-09-26T12:00:00Z'),
    desde = new Date('2026-09-24T00:00:00Z');
  expect(
    ventanaRespuesta(new Date('2026-09-25T12:00:00Z'), desde, ahora).abierta,
  ).toBe(false);
  expect(
    ventanaRespuesta(new Date('2026-09-25T12:00:01Z'), desde, ahora).abierta,
  ).toBe(true);
});
it.each([
  'flag',
  'recepcion',
  'empresa',
  'token',
  'sesion',
  'generacion',
  'plan',
])('rechaza pérdida de autorización: %s', async (caso) => {
  const d = dto();
  if (caso === 'recepcion') process.env.META_INBOX_RECEPCION_ENABLED = 'false';
  if (caso === 'flag') process.env.META_INBOX_ENVIOS_ENABLED = 'false';
  if (caso === 'empresa') process.env.META_CONEXION_TENANT_IDS = randomUUID();
  if (caso === 'token')
    await db.metaVinculo.update({
      where: { id: canal.id },
      data: { tokenVenceEl: new Date(0) },
    });
  if (caso === 'sesion')
    await db.authSession.update({
      where: { id: auth.sessionId },
      data: { revokedAt: new Date() },
    });
  if (caso === 'generacion') d.canalId = `${canal.id}:${randomUUID()}`;
  if (caso === 'plan')
    capacidades.exigirOperacionTx.mockRejectedValue(new ForbiddenException());
  await expect(enviar(d)).rejects.toThrow();
  expect(client.enviarTexto).not.toHaveBeenCalled();
});
it('no permite impersonación, Plataforma o MCP ni conversación ajena', async () => {
  for (const a of [
    { ...auth, esPlataforma: true },
    { ...auth, mcp: true },
    { ...auth, impersonacion: { sesionId: 'ficticia' } },
  ])
    await expect(
      enviar(dto(), conv.id, a as CurrentAuth),
    ).rejects.toBeInstanceOf(ForbiddenException);
  await expect(enviar(dto(), randomUUID())).rejects.toBeInstanceOf(
    NotFoundException,
  );
  expect(client.enviarTexto).not.toHaveBeenCalled();
});
it('un resultado incierto no se reenvía, incluso con otro servicio; el webhook lo resuelve', async () => {
  client.enviarTexto.mockResolvedValue({ estado: 'incierta' });
  const d = dto(),
    r = await enviar(d);
  expect(r.estado).toBe('INCIERTO');
  await enviar(d);
  expect(client.enviarTexto).toHaveBeenCalledTimes(1);
  await webhook(r.id);
  const final = await enviar(d);
  expect(final.estado).toBe('ACEPTADO');
  expect(
    await db.inboxMensaje.findUniqueOrThrow({
      where: { id: final.mensajeId! },
    }),
  ).toMatchObject({ estadoEntrega: 'DELIVERED' });
  expect(client.enviarTexto).toHaveBeenCalledTimes(1);
});
it('ignora una correlación con destinatario incorrecto', async () => {
  client.enviarTexto.mockResolvedValue({ estado: 'incierta' });
  const r = await enviar();
  await webhook(r.id, 'read', '16505550999', 'wamid.ajeno');
  expect(
    await db.inboxEnvio.findUniqueOrThrow({ where: { id: r.id } }),
  ).toMatchObject({ estado: 'INCIERTO', mensajeId: null });
});
it('un webhook que llega antes del POST no se rebaja a aceptado', async () => {
  client.enviarTexto.mockImplementationOnce(async () => {
    const e = await db.inboxEnvio.findFirstOrThrow({
      where: { tenantId: auth.tenantId },
    });
    await webhook(e.id, 'read');
    return { estado: 'aceptada', wamid: 'wamid.respuesta' };
  });
  const r = await enviar();
  expect(
    await db.inboxMensaje.findUniqueOrThrow({ where: { id: r.mensajeId! } }),
  ).toMatchObject({ estadoEntrega: 'READ' });
  expect(
    await db.inboxMensaje.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(1);
});
it('reutiliza el mensaje canónico si el eco llegó antes del POST', async () => {
  client.enviarTexto.mockImplementationOnce(async () => {
    await db.$transaction((tx) =>
      aplicarOperacionInbox(tx, canal, {
        clase: 'mensaje',
        wamid: 'wamid.respuesta',
        contacto: conv.contactoWaId,
        direccion: 'SALIENTE',
        fecha: new Date(),
        origen: 'CELULAR',
        tipo: 'text',
        contenido: { texto: 'eco' },
        prioridad: 3,
      }),
    );
    return { estado: 'aceptada', wamid: 'wamid.respuesta' };
  });
  const r = await enviar();
  expect(r.mensajeId).toBeTruthy();
  expect(
    await db.inboxMensaje.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(1);
});
it('conserva rechazo explícito sin reintentar y sin filtrar secretos', async () => {
  client.enviarTexto.mockResolvedValue({ estado: 'fallida', codigo: '131047' });
  const d = dto(),
    r = await enviar(d);
  expect(r).toMatchObject({
    estado: 'RECHAZADO',
    codigo: '131047',
    mensajeId: null,
  });
  await enviar(d);
  expect(client.enviarTexto).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(r)).not.toMatch(/token|accessToken|phoneNumberId/);
});
it('registra el resultado, pero no lo entrega a una sesión revocada durante el envío', async () => {
  client.enviarTexto.mockImplementationOnce(async () => {
    await db.authSession.update({
      where: { id: auth.sessionId },
      data: { revokedAt: new Date() },
    });
    return { estado: 'aceptada', wamid: 'wamid.respuesta' };
  });
  await expect(enviar()).rejects.toBeInstanceOf(ForbiddenException);
  expect(
    await db.inboxEnvio.findFirstOrThrow({
      where: { tenantId: auth.tenantId },
    }),
  ).toMatchObject({ estado: 'ACEPTADO' });
});
it('un proceso interrumpido queda incierto al pasar el margen y no se reclama', async () => {
  client.enviarTexto.mockResolvedValue({ estado: 'incierta' });
  const d = dto(),
    r = await enviar(d);
  const e = await db.inboxEnvio.update({
    where: { id: r.id },
    data: { estado: 'ENVIANDO', createdAt: new Date(Date.now() - 60000) },
  });
  expect(presentarEnvio(e).estado).toBe('INCIERTO');
  expect((await enviar(d)).estado).toBe('INCIERTO');
  expect(client.enviarTexto).toHaveBeenCalledTimes(1);
});
it('un rechazo de ventana por Meta bloquea nuevos intentos hasta otro mensaje del cliente', async () => {
  client.enviarTexto.mockResolvedValueOnce({
    estado: 'fallida',
    codigo: '131047',
  });
  const r = await enviar();
  expect(r.estado).toBe('RECHAZADO');
  await expect(enviar()).rejects.toBeInstanceOf(ConflictException);
  expect(client.enviarTexto).toHaveBeenCalledTimes(1);
  await db.inboxConversacion.update({
    where: { id: conv.id },
    data: { ultimoEntranteNuevoEl: new Date() },
  });
  await expect(enviar()).resolves.toMatchObject({ estado: 'ACEPTADO' });
  expect(client.enviarTexto).toHaveBeenCalledTimes(2);
});
it('confirmar un envío pendiente cambia el hilo aunque el estado leído ya existía', async () => {
  client.enviarTexto.mockResolvedValueOnce({ estado: 'incierta' });
  const r = await enviar();
  await db.inboxMensaje.create({
    data: {
      tenantId: auth.tenantId,
      vinculoId: canal.id,
      wamid: 'wamid.respuesta',
      estadoEntrega: 'READ',
      estadoEntregaOrden: 5,
    },
  });
  const cambio = await db.$transaction((tx) =>
    aplicarOperacionInbox(tx, canal, {
      clase: 'estado',
      wamid: 'wamid.respuesta',
      estado: 'READ',
      orden: 5,
      fecha: new Date(),
      correlacion: r.id,
      destinatario: conv.contactoWaId,
    }),
  );
  expect(cambio).toBe(true);
  expect(await db.inboxEnvio.findUnique({ where: { id: r.id } })).toMatchObject(
    { estado: 'ACEPTADO', texto: null },
  );
});
it('una correlación que parece UUID pero es inválida no bloquea el webhook', async () => {
  const normalizado = normalizarEventoInbox(
    {
      tipo: 'statuses',
      payload: {
        statuses: [
          {
            id: 'wamid.sin-correlacion',
            status: 'sent',
            timestamp: String(Math.floor(Date.now() / 1000)),
            recipient_id: conv.contactoWaId,
            biz_opaque_callback_data: `grafo-inbox:${'-'.repeat(36)}`,
          },
        ],
      },
    },
    canal.numero!,
  );
  expect(normalizado.operaciones[0]).not.toHaveProperty('correlacion');
  await expect(
    db.$transaction((tx) =>
      aplicarOperacionInbox(tx, canal, normalizado.operaciones[0]),
    ),
  ).resolves.toBe(false);
});
