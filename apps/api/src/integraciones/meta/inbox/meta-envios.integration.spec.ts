import sharp from 'sharp';
import {
  MetaArchivosPlantillaService,
  versionArchivoPlantilla,
} from './meta-archivos-plantilla.service';
import { WhatsappContextoService } from '../../../clientes/whatsapp-contexto.service';
import { normalizarPlantilla } from './meta-plantillas';
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
const client = {
  enviarTexto: jest.fn<Promise<ResultadoMeta>, [unknown]>(),
  enviarPlantilla: jest.fn<Promise<ResultadoMeta>, [unknown]>(),
  listarPlantillas: jest.fn(),
  subirArchivo: jest.fn(),
};
const secretos = {
  disponible: true,
  descifrar: jest.fn(() => 'token-ficticio'),
};
const capacidades = { exigirOperacionTx: jest.fn(), exigirIncluida: jest.fn() },
  bus = { avisar: jest.fn() };
const pdf = Buffer.from('%PDF-1.7 ejemplo sintetico');
const storage = { cabecera: jest.fn(), leerCabecera: jest.fn() };
const archivos = new MetaArchivosPlantillaService(
  db,
  new WhatsappContextoService(db),
  capacidades as never,
  storage as never,
);
const servicio = () =>
  new MetaEnviosService(
    db,
    client as never,
    secretos as never,
    capacidades as never,
    bus as never,
    archivos,
  );
const keys = [
  'META_INBOX_ADJUNTOS_ENABLED',
  'META_INBOX_ENVIOS_ENABLED',
  'META_INBOX_PLANTILLAS_ENABLED',
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
    META_INBOX_ADJUNTOS_ENABLED: 'true',
    META_INBOX_ENVIOS_ENABLED: 'true',
    META_INBOX_PLANTILLAS_ENABLED: 'true',
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
  storage.cabecera.mockResolvedValue({
    bytes: pdf.length,
    contentType: 'application/pdf',
  });
  storage.leerCabecera.mockResolvedValue(pdf);
  client.subirArchivo.mockResolvedValue('56789');
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
  await db.inboxAdjunto.deleteMany({ where });
  await db.inboxMensaje.deleteMany({ where });
  await db.archivo.deleteMany({ where });
  await db.cliente.deleteMany({ where });
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

const plantillaRaw = {
  id: '123',
  name: 'pedido_listo',
  language: 'es_AR',
  status: 'APPROVED',
  category: 'UTILITY',
  parameter_format: 'NAMED',
  components: [
    { type: 'BODY', text: 'Hola {{nombre}}, tu trabajo está listo.' },
  ],
};
const plantillaDto = () => ({
  clave: randomUUID(),
  canalId: `${canal.id}:${canal.autorizacionId}`,
  plantillaId: '123',
  version: normalizarPlantilla(plantillaRaw, null)!.version,
  pagina: null,
  valores: ['Alma'],
  consentimientoConfirmado: true,
});
const enviarPlantilla = (d = plantillaDto(), c = conv.id) =>
  runWithTenant(auth.tenantId, () =>
    servicio().enviarPlantilla(auth, '127.0.0.1', c, d),
  );
function catalogoValido() {
  client.listarPlantillas.mockResolvedValue({
    data: [plantillaRaw],
    siguiente: null,
  });
  client.enviarPlantilla.mockResolvedValue({
    estado: 'aceptada',
    wamid: 'wamid.plantilla',
  });
}
it('plantilla funciona fuera de 24h, no abre texto libre y recibe estado real por webhook', async () => {
  catalogoValido();
  await db.inboxConversacion.update({
    where: { id: conv.id },
    data: { ultimoEntranteNuevoEl: null },
  });
  const r = await enviarPlantilla();
  expect(r.estado).toBe('ACEPTADO');
  expect(client.enviarTexto).not.toHaveBeenCalled();
  expect(client.enviarPlantilla).toHaveBeenCalledWith(
    expect.objectContaining({
      telefono: '+16505550123',
      plantilla: 'pedido_listo',
      idioma: 'es_AR',
      componentes: [
        {
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'nombre', text: 'Alma' },
          ],
        },
      ],
    }),
  );
  const m = await db.inboxMensaje.findUniqueOrThrow({
    where: { id: r.mensajeId! },
  });
  expect(m.tipo).toBe('template');
  expect(m.contenido).toEqual({ texto: 'Hola Alma, tu trabajo está listo.' });
  await webhook(r.id, 'read', '16505550123', 'wamid.plantilla');
  expect(
    (await db.inboxMensaje.findUniqueOrThrow({ where: { id: m.id } }))
      .estadoEntrega,
  ).toBe('READ');
  await expect(enviar()).rejects.toThrow('ventana de atención');
});
it('concurrencia hace un único POST y comprobar no necesita el catálogo posteriormente', async () => {
  catalogoValido();
  const d = plantillaDto();
  await Promise.all([enviarPlantilla(d), enviarPlantilla(d)]);
  expect(client.enviarPlantilla).toHaveBeenCalledTimes(1);
  client.listarPlantillas.mockRejectedValue(new Error('Fuera de servicio'));
  expect((await enviarPlantilla(d)).estado).toBe('ACEPTADO');
  expect(client.enviarPlantilla).toHaveBeenCalledTimes(1);
  await expect(enviarPlantilla({ ...d, valores: ['Bruno'] })).rejects.toThrow(
    'otro mensaje',
  );
});
it.each(['PAUSED', 'REJECTED'])(
  'rechaza una plantilla que ahora figura %s antes de reservar un intento',
  async (status) => {
    catalogoValido();
    client.listarPlantillas.mockResolvedValue({
      data: [{ ...plantillaRaw, status }],
      siguiente: null,
    });
    await expect(enviarPlantilla()).rejects.toThrow('plantilla cambió');
    expect(client.enviarPlantilla).not.toHaveBeenCalled();
    expect(
      await db.inboxEnvio.count({ where: { tenantId: auth.tenantId } }),
    ).toBe(0);
  },
);
it('rechaza plantilla ajena, valores incompletos y falta de consentimiento', async () => {
  catalogoValido();
  await expect(
    enviarPlantilla({ ...plantillaDto(), plantillaId: '999' }),
  ).rejects.toThrow('plantilla cambió');
  await expect(
    enviarPlantilla({ ...plantillaDto(), valores: [] }),
  ).rejects.toThrow('Completá');
  await expect(
    enviarPlantilla({ ...plantillaDto(), consentimientoConfirmado: false }),
  ).rejects.toThrow('autorizó');
  expect(client.enviarPlantilla).not.toHaveBeenCalled();
  expect(client.listarPlantillas).toHaveBeenCalledWith(
    expect.objectContaining({ wabaId: canal.wabaId }),
  );
});
it('respeta flags y reconexiones ocurridas mientras se consultaban plantillas', async () => {
  catalogoValido();
  process.env.META_INBOX_PLANTILLAS_ENABLED = 'false';
  await expect(enviarPlantilla()).rejects.toThrow(ForbiddenException);
  expect(client.listarPlantillas).not.toHaveBeenCalled();
  process.env.META_INBOX_PLANTILLAS_ENABLED = 'true';
  client.listarPlantillas.mockImplementation(async () => {
    await db.metaVinculo.update({
      where: { id: canal.id },
      data: { autorizacionId: randomUUID() },
    });
    return { data: [plantillaRaw], siguiente: null };
  });
  await expect(enviarPlantilla()).rejects.toThrow(ForbiddenException);
  expect(client.enviarPlantilla).not.toHaveBeenCalled();
});
it('timeout conserva el intento y un webhook posterior confirma sin repetir', async () => {
  catalogoValido();
  client.enviarPlantilla.mockResolvedValue({ estado: 'incierta' });
  const d = plantillaDto(),
    r = await enviarPlantilla(d);
  expect(r.estado).toBe('INCIERTO');
  expect((await enviarPlantilla(d)).estado).toBe('INCIERTO');
  await webhook(r.id, 'delivered', '16505550123', 'wamid.plantilla');
  expect((await enviarPlantilla(d)).estado).toBe('ACEPTADO');
  expect(client.enviarPlantilla).toHaveBeenCalledTimes(1);
});
it('rechaza conversaciones ajenas y sesiones revocadas', async () => {
  catalogoValido();
  await expect(enviarPlantilla(plantillaDto(), randomUUID())).rejects.toThrow(
    NotFoundException,
  );
  await db.authSession.update({
    where: { id: auth.sessionId },
    data: { revokedAt: new Date() },
  });
  await expect(enviarPlantilla()).rejects.toThrow();
  expect(client.enviarPlantilla).not.toHaveBeenCalled();
});

async function prepararArchivo() {
  catalogoValido();
  const raw = {
    ...plantillaRaw,
    components: [
      { type: 'HEADER', format: 'DOCUMENT' },
      ...plantillaRaw.components,
    ],
  };
  client.listarPlantillas.mockResolvedValue({ data: [raw], siguiente: null });
  const cliente = await db.cliente.create({
    data: {
      tenantId: auth.tenantId,
      nombre: 'Cliente de prueba',
      telefonoCodigo: '+1',
      telefonoNumero: '6505550123',
      paisCodigo: 'US',
    },
  });
  const file = await db.archivo.create({
    data: {
      tenantId: auth.tenantId,
      scope: 'CLIENTE',
      clienteId: cliente.id,
      key: `prueba/${randomUUID()}.pdf`,
      nombreOriginal: 'Trabajo.pdf',
      mimeType: 'application/pdf',
      bytes: pdf.length,
      estado: 'LISTO',
    },
  });
  return {
    file,
    cliente,
    dto: {
      ...plantillaDto(),
      version: normalizarPlantilla(raw, null)!.version,
      archivoId: file.id,
      archivoVersion: versionArchivoPlantilla(file),
    },
  };
}
it('sube un PDF privado una sola vez y proyecta una copia independiente con sus checks', async () => {
  const { file, dto: d } = await prepararArchivo();
  const listado = await runWithTenant(auth.tenantId, () =>
    archivos.listar(auth, '127.0.0.1', conv.id, d.canalId),
  );
  expect(listado.archivos.map((f) => f.id)).toEqual([file.id]);
  expect(JSON.stringify(listado)).not.toContain(file.key);
  const [r] = await Promise.all([enviarPlantilla(d), enviarPlantilla(d)]);
  expect(client.subirArchivo).toHaveBeenCalledTimes(1);
  expect(client.enviarPlantilla).toHaveBeenCalledTimes(1);
  expect(client.enviarPlantilla).toHaveBeenCalledWith(
    expect.objectContaining({
      componentes: [
        {
          type: 'header',
          parameters: [
            {
              type: 'document',
              document: { id: '56789', filename: 'Trabajo.pdf' },
            },
          ],
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'nombre', text: 'Alma' },
          ],
        },
      ],
    }),
  );
  const m = await db.inboxMensaje.findFirstOrThrow({
    where: { tenantId: auth.tenantId },
    include: { adjunto: true },
  });
  expect(m).toMatchObject({
    tipo: 'document',
    estadoEntrega: 'ACEPTADO',
    contenido: {
      texto: 'Hola Alma, tu trabajo está listo.',
      mediaId: '56789',
      plantilla: true,
    },
    adjunto: { estado: 'PENDIENTE', archivoId: null },
  });
  expect(
    (await db.archivo.findUniqueOrThrow({ where: { id: file.id } })).estado,
  ).toBe('LISTO');
  await webhook(r.id, 'read', conv.contactoWaId, 'wamid.plantilla');
  expect(
    (await db.inboxMensaje.findUniqueOrThrow({ where: { id: m.id } }))
      .estadoEntrega,
  ).toBe('READ');
  await enviarPlantilla(d);
  expect(client.subirArchivo).toHaveBeenCalledTimes(1);
  await expect(
    enviarPlantilla({ ...d, archivoVersion: 'f'.repeat(64) }),
  ).rejects.toThrow('otro mensaje');
});
it('el webhook adelantado recupera también el adjunto de una plantilla', async () => {
  const { dto: d } = await prepararArchivo();
  client.enviarPlantilla.mockImplementation(async () => {
    const intento = await db.inboxEnvio.findFirstOrThrow({
      where: { tenantId: auth.tenantId },
    });
    await webhook(
      intento.id,
      'delivered',
      conv.contactoWaId,
      'wamid.plantilla',
    );
    return { estado: 'incierta' };
  });
  expect((await enviarPlantilla(d)).estado).toBe('ACEPTADO');
  expect(
    await db.inboxAdjunto.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(1);
});
it.each([
  'otro-cliente',
  'version',
  'publico',
  'borrado',
  'sin-permiso',
  'flag',
  'ambiguo',
  'limite',
  'tipo',
])(
  'bloquea archivo no autorizado/compatible antes de reservar o subir: %s',
  async (caso) => {
    const { file, cliente, dto: d } = await prepararArchivo();
    if (caso === 'otro-cliente')
      await db.cliente.update({
        where: { id: cliente.id },
        data: { telefonoNumero: '6505550199' },
      });
    if (caso === 'version') d.archivoVersion = 'f'.repeat(64);
    if (caso === 'publico')
      await db.archivo.update({
        where: { id: file.id },
        data: { publico: true },
      });
    if (caso === 'borrado')
      await db.archivo.update({
        where: { id: file.id },
        data: { estado: 'ELIMINADO' },
      });
    if (caso === 'flag') process.env.META_INBOX_ADJUNTOS_ENABLED = 'false';
    if (caso === 'sin-permiso')
      await db.authSession.update({
        where: { id: auth.sessionId },
        data: { revokedAt: new Date() },
      });
    if (caso === 'ambiguo')
      await db.cliente.create({
        data: {
          tenantId: auth.tenantId,
          nombre: 'Otra ficha',
          telefonoCodigo: '+1',
          telefonoNumero: '6505550123',
          paisCodigo: 'US',
        },
      });
    if (caso === 'limite' || caso === 'tipo') {
      const nuevo = await db.archivo.update({
        where: { id: file.id },
        data:
          caso === 'limite' ? { bytes: 20_000_001 } : { mimeType: 'image/png' },
      });
      d.archivoVersion = versionArchivoPlantilla(nuevo);
    }
    await expect(enviarPlantilla(d)).rejects.toThrow();
    expect(client.subirArchivo).not.toHaveBeenCalled();
    expect(client.enviarPlantilla).not.toHaveBeenCalled();
    expect(
      await db.inboxEnvio.count({ where: { tenantId: auth.tenantId } }),
    ).toBe(0);
  },
);
it.each(['firma', 'bytes', 'storage', 'upload'])(
  'si falla la preparación %s no hace POST de mensajes ni reintenta',
  async (caso) => {
    const { dto: d } = await prepararArchivo();
    if (caso === 'firma')
      storage.leerCabecera.mockResolvedValue(Buffer.alloc(pdf.length));
    if (caso === 'bytes')
      storage.leerCabecera.mockResolvedValue(Buffer.from('%PDF-no coincide'));
    if (caso === 'storage') storage.cabecera.mockResolvedValue(null);
    if (caso === 'upload')
      client.subirArchivo.mockRejectedValue(new Error('Error sensible de red'));
    const r = await enviarPlantilla(d);
    expect(r).toMatchObject({
      estado: 'RECHAZADO',
      codigo: 'ARCHIVO_NO_PREPARADO',
    });
    const cantidad = client.subirArchivo.mock.calls.length;
    await enviarPlantilla(d);
    expect(client.subirArchivo).toHaveBeenCalledTimes(cantidad);
    expect(client.enviarPlantilla).not.toHaveBeenCalled();
  },
);
it('revocar la sesión durante la subida impide enviar el mensaje', async () => {
  const { dto: d } = await prepararArchivo();
  client.subirArchivo.mockImplementation(async () => {
    await db.authSession.update({
      where: { id: auth.sessionId },
      data: { revokedAt: new Date() },
    });
    return '56789';
  });
  await expect(enviarPlantilla(d)).rejects.toThrow(ForbiddenException);
  expect(client.enviarPlantilla).not.toHaveBeenCalled();
  expect(
    await db.inboxEnvio.findFirst({ where: { tenantId: auth.tenantId } }),
  ).toMatchObject({ estado: 'RECHAZADO', codigo: 'ARCHIVO_NO_PREPARADO' });
});

it('una imagen RGB válida se envía mediante ID de Meta', async () => {
  const { file, dto: d } = await prepararArchivo();
  const bytes = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#ff6535' },
  })
    .png()
    .toBuffer();
  const nuevo = await db.archivo.update({
    where: { id: file.id },
    data: {
      mimeType: 'image/png',
      bytes: bytes.length,
      nombreOriginal: 'Ejemplo.png',
    },
  });
  d.archivoVersion = versionArchivoPlantilla(nuevo);
  const raw = {
    ...plantillaRaw,
    components: [
      { type: 'HEADER', format: 'IMAGE' },
      ...plantillaRaw.components,
    ],
  };
  d.version = normalizarPlantilla(raw, null)!.version;
  client.listarPlantillas.mockResolvedValue({ data: [raw], siguiente: null });
  storage.cabecera.mockResolvedValue({
    bytes: bytes.length,
    contentType: 'image/png',
  });
  storage.leerCabecera.mockResolvedValue(bytes);
  expect((await enviarPlantilla(d)).estado).toBe('ACEPTADO');
  expect(client.enviarPlantilla).toHaveBeenCalledWith(
    expect.objectContaining({
      componentes: expect.arrayContaining([
        {
          type: 'header',
          parameters: [{ type: 'image', image: { id: '56789' } }],
        },
      ]),
    }),
  );
});
it('rechaza el ID de un archivo perteneciente a otra empresa', async () => {
  const { file, dto: d } = await prepararArchivo();
  const otra = await db.tenant.create({
    data: { nombre: 'Otra empresa ficticia', slug: `otra-${randomUUID()}` },
  });
  try {
    // La conversación y cliente siguen siendo propios; el archivo se vuelve ajeno.
    const nuevo = await db.archivo.update({
      where: { id: file.id },
      data: { tenantId: otra.id },
    });
    d.archivoVersion = versionArchivoPlantilla(nuevo);
    await expect(enviarPlantilla(d)).rejects.toThrow('archivo cambió');
    expect(client.subirArchivo).not.toHaveBeenCalled();
    expect(client.enviarPlantilla).not.toHaveBeenCalled();
  } finally {
    await db.archivo.deleteMany({ where: { tenantId: otra.id } });
    await db.tenant.delete({ where: { id: otra.id } });
  }
});
