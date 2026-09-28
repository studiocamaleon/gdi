import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { RolSistema, type MetaVinculo } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithTenant } from '../../common/tenant-context';
import { expandir, permisosDeRolBase } from '../../auth/permisos';
import type { CurrentAuth } from '../../auth/auth.types';
import { SecretosService } from '../cripto/secretos.service';
import { MetaPruebaService } from './meta-prueba.service';
import { canalGeneralInbox, identidadCanalInbox } from './meta-inbox-canal';
import { MetaInboxGeneralService } from './meta-inbox-general.service';
import { MetaEnviosService } from './inbox/meta-envios.service';
import { MetaInboxProcesador } from './inbox/meta-inbox-procesador.service';
import { MetaConexionService } from './meta-conexion.service';
import { WhatsappContextoService } from '../../clientes/whatsapp-contexto.service';
import { WebhooksWhatsappService } from '../../webhooks-whatsapp/webhooks-whatsapp.service';
import { WebhooksWhatsappController } from '../../webhooks-whatsapp/webhooks-whatsapp.controller';
import { registrarCambioInbox } from '../../inbox-tiempo-real/inbox-revision';
import { InboxTiempoRealBus } from '../../inbox-tiempo-real/inbox-tiempo-real.bus';
import { MetaInboxStreamService } from './meta-inbox-stream.service';
import { normalizarPlantilla } from './inbox/meta-plantillas';
const url = new URL(process.env.DATABASE_URL!);
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  !url.pathname.endsWith('_test')
)
  throw new Error('Requiere PostgreSQL local *_test');
const db = new PrismaService(),
  prev = { ...process.env };
const destinatario = '16505550123',
  token = 'credencial-ficticia-sin-acceso-real';
const capacidades = {
  exigirOperacionTx: jest.fn(),
  exigirIncluida: jest.fn(),
  puedeOperar: jest.fn(),
};
const verificador = { verificarPrueba: jest.fn() };
const client = {
  enviarTexto: jest.fn(),
  enviarPlantilla: jest.fn(),
  listarPlantillas: jest.fn(),
};
let canal: MetaVinculo,
  auth: CurrentAuth,
  secretos: SecretosService,
  convId: string;
let activacion: MetaPruebaService,
  inbox: MetaInboxGeneralService,
  envios: MetaEnviosService;
let bus: InboxTiempoRealBus,
  procesador: MetaInboxProcesador,
  hook: WebhooksWhatsappController,
  fetchMock: jest.SpyInstance;
const plantilla = {
  id: '400001',
  name: 'ensayo_listo',
  language: 'es_AR',
  status: 'APPROVED',
  category: 'UTILITY',
  components: [{ type: 'BODY', text: 'Hola {{1}}, pedido {{2}} listo.' }],
};
const scoped = <T>(f: () => Promise<T>) => runWithTenant(auth.tenantId, f);
const leer = () => scoped(() => inbox.consultar(auth, {}, '127.0.0.1'));
const enviar = (clave = randomUUID(), conversacionId = convId, actor = auth) =>
  runWithTenant(actor.tenantId, () =>
    envios.enviar(actor, '127.0.0.1', conversacionId, {
      clave,
      canalId: identidadCanalInbox(canal),
      texto: 'Respuesta ficticia de Grafo',
    }),
  );
async function recibir(
  value: Record<string, unknown>,
  field = 'messages',
  wabaId = canal.wabaId,
) {
  const body = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: wabaId,
        time: Math.floor(Date.now() / 1000),
        changes: [
          {
            field,
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: canal.phoneNumberId },
              ...value,
            },
          },
        ],
      },
    ],
  };
  const rawBody = Buffer.from(JSON.stringify(body));
  await hook.recibir(
    { rawBody, body },
    'sha256=' +
      createHmac('sha256', 'secreto-ficticio').update(rawBody).digest('hex'),
  );
}
const mensaje = (from = destinatario, id = 'wamid.entrada') => ({
  messages: [
    {
      id,
      from,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: 'text',
      text: { body: 'Consulta ficticia' },
    },
  ],
});
const estado = (status: string, id: string, recipient = destinatario) => ({
  statuses: [
    {
      id: 'wamid.salida',
      status,
      recipient_id: recipient,
      timestamp: String(Math.floor(Date.now() / 1000)),
      biz_opaque_callback_data: `grafo-inbox:${id}`,
    },
  ],
});
async function procesar() {
  for (let n = 0; n < 20; n++)
    if (!(await procesador.procesarSiguiente())) return;
  throw new Error('Cola ficticia no vacía');
}
beforeEach(async () => {
  jest.resetAllMocks();
  fetchMock = jest
    .spyOn(global, 'fetch')
    .mockRejectedValue(new Error('Red externa prohibida'));
  const t = await db.tenant.create({
    data: { nombre: 'Canal ficticio', slug: `prueba-${randomUUID()}` },
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
    membershipId: m.id,
    sessionId: s.id,
    role: RolSistema.ADMINISTRADOR,
    email: u.email,
    permisos: expandir(permisosDeRolBase(RolSistema.ADMINISTRADOR)),
  };
  Object.assign(process.env, {
    GRAFO_DEPLOY_ENV: 'staging',
    META_INBOX_PRUEBA_ENABLED: 'true',
    META_INBOX_PRUEBA_TENANT_ID: t.id,
    META_INBOX_PRUEBA_WABA_ID: '200001',
    META_INBOX_PRUEBA_PHONE_NUMBER_ID: '300001',
    META_INBOX_PRUEBA_DESTINATARIO_WA_ID: destinatario,
    META_INBOX_PRUEBA_DESTINO_E164: `+${destinatario}`,
    META_INBOX_LECTURA_ENABLED: 'true',
    META_INBOX_RECEPCION_ENABLED: 'true',
    META_INBOX_ENVIOS_ENABLED: 'true',
    META_INBOX_PLANTILLAS_ENABLED: 'true',
    META_WHATSAPP_PILOT_ENABLED: 'false',
    META_INBOX_ADJUNTOS_ENABLED: 'false',
    META_CONEXION_MODO: '',
    META_CONEXION_TENANT_IDS: '',
    META_APP_ID: '100001',
    META_APP_SECRET: 'secreto-ficticio',
    META_EMBEDDED_SIGNUP_CONFIG_ID: '',
    REDIS_URL: 'redis://127.0.0.1:6379',
    INTEGRACIONES_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  });
  secretos = new SecretosService();
  secretos.onModuleInit();
  verificador.verificarPrueba.mockResolvedValue({
    wabaId: '200001',
    phoneNumberId: '300001',
    numero: '+16505550100',
    nombreVerificado: 'Prueba ficticia',
    tokenVenceEl: new Date(Date.now() + 3600000),
    accesoDatosVenceEl: null,
  });
  activacion = new MetaPruebaService(
    db,
    secretos,
    verificador as never,
    capacidades as never,
  );
  await activacion.activar(token);
  canal = await db.metaVinculo.findFirstOrThrow({ where: { tenantId: t.id } });
  canal = await db.metaVinculo.update({
    where: { id: canal.id },
    data: { recepcionDesdeEl: new Date(Date.now() - 2000) },
  });
  convId = (
    await db.inboxConversacion.findFirstOrThrow({ where: { tenantId: t.id } })
  ).id;
  bus = new InboxTiempoRealBus(db);
  procesador = new MetaInboxProcesador(db, bus);
  hook = new WebhooksWhatsappController(
    new WebhooksWhatsappService(db, undefined, procesador),
  );
  inbox = new MetaInboxGeneralService(
    db,
    capacidades as never,
    new WhatsappContextoService(db),
  );
  envios = new MetaEnviosService(
    db,
    client as never,
    secretos,
    capacidades as never,
    bus,
    {} as never,
    {} as never,
  );
  client.enviarTexto.mockResolvedValue({
    estado: 'aceptada',
    wamid: 'wamid.salida',
  });
  client.enviarPlantilla.mockResolvedValue({
    estado: 'aceptada',
    wamid: 'wamid.plantilla',
  });
  client.listarPlantillas.mockResolvedValue({
    data: [plantilla],
    siguiente: null,
  });
});
afterEach(async () => {
  bus?.onModuleDestroy();
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockRestore();
  const where = { tenantId: auth.tenantId };
  await db.inboxTrabajoEvento.deleteMany({ where });
  await db.inboxEnvio.deleteMany({ where });
  await db.inboxAdjunto.deleteMany({ where });
  await db.inboxMensaje.deleteMany({ where });
  await db.inboxConversacion.deleteMany({ where });
  await db.inboxContacto.deleteMany({ where });
  await db.inboxBloqueHistorial.deleteMany({ where });
  await db.inboxImportacion.deleteMany({ where });
  await db.inboxCanalRevision.deleteMany({ where });
  await db.metaAlta.deleteMany({ where });
  await db.metaAutorizacion.deleteMany({ where });
  await db.webhookWhatsappCrudo.deleteMany({
    where: { OR: [where, { wabaId: { in: ['200001', '900001'] } }] },
  });
  await db.metaVinculo.deleteMany({ where });
  await db.tenant.delete({ where: { id: auth.tenantId } });
  await db.user.delete({ where: { id: auth.userId } });
  for (const k of Object.keys(process.env))
    if (!(k in prev)) delete process.env[k];
  Object.assign(process.env, prev);
});
afterAll(() => db.$disconnect());
it('activa cifrado, sin autorización ficticia ni historial; sólo plantilla con la ventana cerrada', async () => {
  expect(canal.tipo).toBe('PRUEBA');
  expect(JSON.stringify(canal.tokenCifrado)).not.toContain(token);
  const r = await leer();
  expect(r?.prueba).toMatchObject({ numero: '+16505550100' });
  expect(r?.conversaciones).toHaveLength(1);
  expect(r?.mensajes).toEqual([]);
  expect(r?.respuesta).toMatchObject({
    habilitado: true,
    abierta: false,
    plantillasHabilitadas: true,
  });
  expect(JSON.stringify(r)).not.toContain(token);
  expect(
    await db.metaAutorizacion.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(0);
  expect(await db.metaAlta.count({ where: { tenantId: auth.tenantId } })).toBe(
    0,
  );
  expect(
    await db.inboxImportacion.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(0);
  await expect(enviar()).rejects.toThrow('ventana de atención');
  const p = normalizarPlantilla(plantilla, null)!;
  await scoped(() =>
    envios.enviarPlantilla(auth, '127.0.0.1', convId, {
      clave: randomUUID(),
      canalId: identidadCanalInbox(canal),
      plantillaId: p.id,
      version: p.version,
      valores: ['Cliente ficticio', 'DEMO-001'],
      consentimientoConfirmado: true,
    }),
  );
  expect(client.enviarPlantilla).toHaveBeenCalledTimes(1);
  expect((await leer())?.respuesta.abierta).toBe(false);
});
it('firma → cola → recepción → texto → estados → SSE en dos sesiones, sin duplicados', async () => {
  const busOtraInstancia = new InboxTiempoRealBus(db);
  const stream = new MetaInboxStreamService(
      db,
      capacidades as never,
      busOtraInstancia,
    ),
    events: string[][] = [[], []];
  const subs = await Promise.all(
    events.map(async (e) =>
      (await stream.abrir(auth, '127.0.0.1', Date.now() + 60000)).subscribe(
        (x) => e.push(x.type!),
      ),
    ),
  );
  try {
    await recibir(mensaje());
    await recibir(mensaje());
    await procesar();
    expect((await leer())?.mensajes).toHaveLength(1);
    const clave = randomUUID(),
      enviado = await enviar(clave);
    expect(enviado.estado).toBe('ACEPTADO');
    await enviar(clave);
    expect(client.enviarTexto).toHaveBeenCalledTimes(1);
    expect(client.enviarTexto).toHaveBeenCalledWith(
      expect.objectContaining({
        telefono: `+${destinatario}`,
        accessToken: token,
      }),
    );
    for (const [meta, visible] of [
      ['sent', 'SENT'],
      ['delivered', 'DELIVERED'],
      ['read', 'READ'],
    ]) {
      await recibir(estado(meta, enviado.id));
      await recibir(estado(meta, enviado.id));
      await procesar();
      expect(
        (await leer())?.mensajes.find((m) => m.direccion === 'SALIENTE')
          ?.estadoEntrega,
      ).toBe(visible);
    }
    expect((await leer())?.mensajes).toHaveLength(2);
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(events.every((e) => e.includes('ready'))).toBe(true);
    await recibir(mensaje(destinatario, 'wamid.segunda'));
    await procesar();
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(events.every((e) => e.includes('cambio'))).toBe(true);
    await db.metaVinculo.update({
      where: { id: canal.id },
      data: { estado: 'DESCONECTADO' },
    });
    const aviso = {
      tenantId: canal.tenantId,
      wabaId: canal.wabaId,
      phoneNumberId: canal.phoneNumberId,
    };
    await db.$transaction((tx) => registrarCambioInbox(tx, aviso));
    bus.avisar(aviso);
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(events.every((e) => e.includes('acceso_cerrado'))).toBe(true);
  } finally {
    subs.forEach((s) => s.unsubscribe());
    busOtraInstancia.onModuleDestroy();
  }
}, 15000);
it.each(['production', 'development', ''])(
  'bloquea fuera de staging (%s)',
  async (entorno) => {
    process.env.GRAFO_DEPLOY_ENV = entorno;
    expect(await scoped(() => canalGeneralInbox(db, auth.tenantId))).toBeNull();
    await expect(activacion.activar(token)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(enviar()).rejects.toThrow();
    await recibir(mensaje());
    await procesar();
    expect(
      await db.inboxTrabajoEvento.count({ where: { tenantId: auth.tenantId } }),
    ).toBe(0);
    expect(client.enviarTexto).not.toHaveBeenCalled();
  },
);
it.each([
  'tenant',
  'cuenta',
  'numero',
  'destinatario',
  'destino',
  'flag',
  'vencimiento',
  'desconexion',
])('cierra lectura, envío y stream al cambiar %s', async (caso) => {
  const vars: Record<string, string> = {
    tenant: 'META_INBOX_PRUEBA_TENANT_ID',
    cuenta: 'META_INBOX_PRUEBA_WABA_ID',
    numero: 'META_INBOX_PRUEBA_PHONE_NUMBER_ID',
    destinatario: 'META_INBOX_PRUEBA_DESTINATARIO_WA_ID',
    destino: 'META_INBOX_PRUEBA_DESTINO_E164',
    flag: 'META_INBOX_PRUEBA_ENABLED',
  };
  if (vars[caso])
    process.env[vars[caso]] =
      caso === 'tenant'
        ? randomUUID()
        : caso === 'destinatario'
          ? '16505550199'
          : caso === 'flag'
            ? 'false'
            : '900001';
  if (caso === 'vencimiento')
    await db.metaVinculo.update({
      where: { id: canal.id },
      data: { tokenVenceEl: new Date(0) },
    });
  if (caso === 'desconexion')
    await db.metaVinculo.update({
      where: { id: canal.id },
      data: { estado: 'DESCONECTADO' },
    });
  expect(await leer()).toBeNull();
  await expect(enviar()).rejects.toThrow();
  await expect(
    new MetaInboxStreamService(db, capacidades as never, bus).abrir(
      auth,
      '127.0.0.1',
      Date.now() + 60000,
    ),
  ).rejects.toThrow();
});
it('ignora otro remitente/cuenta, historial y ecos; rechaza conversación ajena', async () => {
  await recibir(mensaje('16505550199'));
  await recibir(mensaje(), 'messages', '900001');
  await recibir(
    {
      history: [
        { metadata: { phase: 0, chunk_order: 1, progress: 100 }, threads: [] },
      ],
    },
    'history',
  );
  await recibir(
    {
      message_echoes: [
        { ...mensaje().messages[0], from: '16505550100', to: destinatario },
      ],
    },
    'smb_message_echoes',
  );
  await procesar();
  expect((await leer())?.mensajes).toEqual([]);
  expect((await leer())?.respuesta.abierta).toBe(false);
  expect(
    await db.inboxImportacion.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(0);
  const otra = await db.inboxConversacion.create({
    data: {
      tenantId: auth.tenantId,
      vinculoId: canal.id,
      contactoWaId: '16505550199',
      ultimoEntranteNuevoEl: new Date(),
      ultimoMensajeEl: new Date(),
    },
  });
  expect((await leer())?.conversaciones).toHaveLength(1);
  await expect(enviar(randomUUID(), otra.id)).rejects.toThrow('destinatario');
  await expect(
    scoped(() =>
      inbox.consultar(auth, { conversacionId: otra.id }, '127.0.0.1'),
    ),
  ).rejects.toThrow();
});
it('un estado ajeno no confirma lectura ni se infiere de una respuesta', async () => {
  await recibir(mensaje());
  await procesar();
  const r = await enviar();
  await recibir(estado('read', r.id, '16505550199'));
  await procesar();
  await recibir(mensaje(destinatario, 'wamid.respuesta'));
  await procesar();
  expect(
    (await leer())?.mensajes.find((m) => m.direccion === 'SALIENTE')
      ?.estadoEntrega,
  ).not.toBe('READ');
});
it('conserva permisos, aislamiento y plan; rechaza firma falsa', async () => {
  await expect(
    enviar(randomUUID(), convId, { ...auth, tenantId: randomUUID() }),
  ).rejects.toThrow();
  await expect(
    hook.recibir(
      { rawBody: Buffer.from('{}'), body: {} },
      'sha256=' + '0'.repeat(64),
    ),
  ).rejects.toThrow('Firma inválida');
  await recibir(mensaje());
  await procesar();
  capacidades.exigirOperacionTx.mockRejectedValueOnce(new ForbiddenException());
  await expect(enviar()).rejects.toThrow();
  await db.membership.update({
    where: { id: auth.membershipId },
    data: { activa: false },
  });
  await expect(enviar()).rejects.toThrow();
  expect(client.enviarTexto).not.toHaveBeenCalled();
});
it('renueva generación conservando mensajes, sin abrir coexistencia', async () => {
  await recibir(mensaje());
  await procesar();
  const original = canal.autorizacionId;
  await activacion.activar('otro-token-ficticio');
  canal = await db.metaVinculo.findFirstOrThrow({ where: { id: canal.id } });
  expect(canal.autorizacionId).not.toBe(original);
  expect((await leer())?.mensajes).toHaveLength(1);
  expect((await leer())?.respuesta.abierta).toBe(false);
  const conexion = new MetaConexionService(
    db,
    secretos,
    verificador as never,
    capacidades as never,
  );
  const r = await scoped(() => conexion.estado(auth, '127.0.0.1'));
  expect(r.disponible).toBe(false);
  expect(r.canal?.prueba?.habilitada).toBe(true);
  expect(r.canal?.resumen).toBeNull();
  expect(r.canal?.reconexionPermitida).toBe(false);
  await db.metaVinculo.update({
    where: { id: canal.id },
    data: {
      tipo: 'COEXISTENCIA',
      pruebaDestinatarioWaId: null,
      pruebaDestinoE164: null,
    },
  });
  await expect(activacion.activar(token)).rejects.toThrow('otro canal');
});

it('conserva el canal anterior si Meta rechaza la renovación', async () => {
  verificador.verificarPrueba.mockRejectedValueOnce(
    new Error('Token rechazado'),
  );
  await expect(activacion.activar('rechazado')).rejects.toThrow();
  const actual = await db.metaVinculo.findFirstOrThrow({
    where: { id: canal.id },
  });
  expect(actual.autorizacionId).toBe(canal.autorizacionId);
  expect(actual.tokenCifrado).toEqual(canal.tokenCifrado);
});

it('no proyecta un trabajo pendiente cuando el token ya venció', async () => {
  await recibir(mensaje());
  expect(
    await db.inboxTrabajoEvento.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(1);
  await db.metaVinculo.update({
    where: { id: canal.id },
    data: { tokenVenceEl: new Date(0) },
  });
  await procesar();
  expect(
    await db.inboxMensaje.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(0);
});

it('revalida el permiso de escritura después de reservar, antes del POST', async () => {
  await recibir(mensaje());
  await procesar();
  capacidades.exigirOperacionTx
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new ForbiddenException('Plan pasó a sólo lectura'));
  await enviar();
  expect(client.enviarTexto).not.toHaveBeenCalled();
  expect(
    await db.inboxEnvio.findFirst({ where: { tenantId: auth.tenantId } }),
  ).toMatchObject({
    estado: 'RECHAZADO',
    codigo: 'CANAL_NO_VIGENTE',
  });
});

it('usa el destino de prueba explícito y conserva recepción, estados e identidad canónica', async () => {
  await recibir(mensaje());
  await procesar();
  // Ambos datos son ficticios. El operador acredita la relación; no se deduce
  // ni se modifica el número de otras conversaciones por reglas de país.
  const destinoPrueba = '+16505550124';
  process.env.META_INBOX_PRUEBA_DESTINO_E164 = destinoPrueba;
  expect(await leer()).toBeNull();
  const generacion = canal.autorizacionId;
  await activacion.activar(token);
  canal = await db.metaVinculo.update({
    where: { id: canal.id },
    data: { recepcionDesdeEl: new Date(Date.now() - 2000) },
  });
  expect(canal.autorizacionId).not.toBe(generacion);
  expect(canal.pruebaDestinoE164).toBe(destinoPrueba);
  expect((await leer())?.mensajes).toHaveLength(1);
  expect(
    await db.inboxConversacion.findUnique({ where: { id: convId } }),
  ).toMatchObject({ contactoWaId: destinatario });
  await recibir(mensaje(destinatario, 'wamid.nueva'));
  await procesar();
  const envio = await enviar();
  expect(client.enviarTexto).toHaveBeenCalledWith(
    expect.objectContaining({ telefono: destinoPrueba }),
  );
  await recibir(estado('delivered', envio.id));
  await procesar();
  expect(
    (await leer())?.mensajes.find((m) => m.direccion === 'SALIENTE')
      ?.estadoEntrega,
  ).toBe('DELIVERED');
  const p = normalizarPlantilla(plantilla, null)!;
  await scoped(() =>
    envios.enviarPlantilla(auth, '127.0.0.1', convId, {
      clave: randomUUID(),
      canalId: identidadCanalInbox(canal),
      plantillaId: p.id,
      version: p.version,
      valores: ['Cliente ficticio', 'DEMO-002'],
      consentimientoConfirmado: true,
    }),
  );
  expect(client.enviarPlantilla).toHaveBeenCalledWith(
    expect.objectContaining({ telefono: destinoPrueba }),
  );
});

it('no redirige el POST si cambia el destino después de reservar', async () => {
  await recibir(mensaje());
  await procesar();
  capacidades.exigirOperacionTx
    .mockResolvedValueOnce(undefined)
    .mockImplementationOnce(() => {
      process.env.META_INBOX_PRUEBA_DESTINO_E164 = '+16505550199';
    });
  await expect(enviar()).rejects.toThrow();
  expect(client.enviarTexto).not.toHaveBeenCalled();
  expect(
    await db.inboxEnvio.findFirst({ where: { tenantId: auth.tenantId } }),
  ).toMatchObject({ estado: 'RECHAZADO', codigo: 'CANAL_NO_VIGENTE' });
});

it.each(['', '16505550123', '+0123', 'https://example.invalid'])(
  'rechaza un destino de prueba ausente o inválido (%s)',
  async (destino) => {
    process.env.META_INBOX_PRUEBA_DESTINO_E164 = destino;
    await expect(activacion.activar(token)).rejects.toThrow();
    expect(await leer()).toBeNull();
  },
);
