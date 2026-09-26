import { randomUUID } from 'node:crypto';
import { type MetaVinculo, type Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { runWithTenant } from '../../../common/tenant-context';
import { WebhooksWhatsappService } from '../../../webhooks-whatsapp/webhooks-whatsapp.service';
import { MetaInboxProcesador } from './meta-inbox-procesador.service';

const url = new URL(process.env.DATABASE_URL!);
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  !url.pathname.endsWith('_test')
)
  throw new Error('Esta prueba requiere PostgreSQL local *_test.');
const db = new PrismaService();
const envAntes = {
  recepcion: process.env.META_INBOX_RECEPCION_ENABLED,
  piloto: process.env.META_WHATSAPP_PILOT_ENABLED,
};
const fetchOriginal = global.fetch;
const tenants: string[] = [],
  cuentas: string[] = [];
const bus = { avisar: jest.fn() };
let canal: MetaVinculo,
  procesador: MetaInboxProcesador,
  webhook: WebhooksWhatsappService;
const contacto = '16505550123';
const segundos = () => Math.floor(Date.now() / 1000);
const mensaje = (
  id = 'wamid.ficticio',
  extra: Record<string, unknown> = {},
) => ({
  id,
  from: contacto,
  timestamp: '1700000000',
  type: 'text',
  text: { body: 'Mensaje ficticio' },
  ...extra,
});
const historial = (
  messages: unknown[],
  progress = 25,
  phase = 0,
  chunk_order = 1,
) => ({
  history: [
    {
      metadata: { phase, chunk_order, progress },
      threads: [{ id: contacto, messages }],
    },
  ],
});
async function crearCanal() {
  const tenantId = randomUUID();
  tenants.push(tenantId);
  const numero = `90${Date.now()}${tenants.length}`;
  cuentas.push(numero);
  await db.tenant.create({
    data: {
      id: tenantId,
      nombre: 'Imprenta ficticia Inbox',
      slug: `inbox-ensayo-${tenantId}`,
    },
  });
  return db.metaVinculo.create({
    data: {
      tenantId,
      wabaId: numero,
      phoneNumberId: `8${numero}`,
      numero: '+16505550100',
      autorizacionId: randomUUID(),
      verificadoEl: new Date(),
      recepcionDesdeEl: new Date(Date.now() - 60_000),
      tokenCifrado: { solo: 'dato-ficticio' },
    },
  });
}
async function recibir(
  tipo: string,
  value: Record<string, unknown>,
  c = canal,
  time = segundos(),
  sinNumero = false,
) {
  await webhook.persistir(
    webhook.extraerCambios({
      entry: [
        {
          id: c.wabaId,
          time,
          changes: [
            {
              field: tipo,
              value: {
                messaging_product: 'whatsapp',
                ...(!sinNumero
                  ? { metadata: { phone_number_id: c.phoneNumberId } }
                  : {}),
                ...value,
              },
            },
          ],
        },
      ],
    }),
  );
}
async function vaciar() {
  for (let i = 0; i < 30; i++)
    if (!(await procesador.procesarSiguiente())) return;
  throw new Error('La cola ficticia no terminó.');
}
const scope = () => ({ tenantId: canal.tenantId });
const fila = (wamid = 'wamid.ficticio') =>
  db.inboxMensaje.findFirstOrThrow({ where: { ...scope(), wamid } });
const trabajo = () =>
  db.inboxTrabajoEvento.findFirstOrThrow({
    where: scope(),
    orderBy: { createdAt: 'desc' },
  });

beforeAll(async () => {
  await db.$connect();
  global.fetch = jest
    .fn()
    .mockRejectedValue(new Error('No se permiten llamadas externas.'));
});
beforeEach(async () => {
  process.env.META_INBOX_RECEPCION_ENABLED = 'true';
  process.env.META_WHATSAPP_PILOT_ENABLED = 'false';
  canal = await crearCanal();
  procesador = new MetaInboxProcesador(db, bus as never);
  webhook = new WebhooksWhatsappService(db, undefined, procesador);
  bus.avisar.mockClear();
});
afterEach(async () => {
  jest.restoreAllMocks();
  const where = { tenantId: { in: tenants } };
  await db.inboxTrabajoEvento.deleteMany({ where });
  await db.inboxBloqueHistorial.deleteMany({ where });
  await db.inboxImportacion.deleteMany({ where });
  await db.inboxMensaje.deleteMany({ where });
  await db.inboxConversacion.deleteMany({ where });
  await db.inboxContacto.deleteMany({ where });
  await db.webhookWhatsappCrudo.deleteMany({
    where: { wabaId: { in: cuentas } },
  });
  await db.metaVinculo.deleteMany({ where });
  await db.tenant.deleteMany({ where: { id: { in: tenants } } });
  tenants.length = 0;
  cuentas.length = 0;
});
afterAll(async () => {
  await db.$disconnect();
  global.fetch = fetchOriginal;
  for (const [key, val] of Object.entries({
    META_INBOX_RECEPCION_ENABLED: envAntes.recepcion,
    META_WHATSAPP_PILOT_ENABLED: envAntes.piloto,
  })) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
});

it('con la bandera apagada sólo conserva el evento crudo', async () => {
  process.env.META_INBOX_RECEPCION_ENABLED = 'false';
  await recibir('history', historial([mensaje()]));
  expect(
    await db.webhookWhatsappCrudo.count({ where: { wabaId: canal.wabaId } }),
  ).toBe(1);
  expect(await db.inboxTrabajoEvento.count({ where: scope() })).toBe(0);
  expect(await procesador.procesarSiguiente()).toBe(false);
});
it('un vínculo verificado aún no habilitado no recibe trabajos', async () => {
  await db.metaVinculo.update({
    where: { id: canal.id },
    data: { recepcionDesdeEl: null },
  });
  await recibir('messages', { messages: [mensaje()] });
  expect(await db.inboxTrabajoEvento.count({ where: scope() })).toBe(0);
});
it('guardar el crudo y encolarlo es atómico', async () => {
  jest
    .spyOn(procesador, 'encolar')
    .mockRejectedValueOnce(new Error('Fallo ficticio'));
  await expect(recibir('history', historial([mensaje()]))).rejects.toThrow(
    'Fallo ficticio',
  );
  expect(
    await db.webhookWhatsappCrudo.count({ where: { wabaId: canal.wabaId } }),
  ).toBe(0);
});
it('tolera reentregas simultáneas y varios procesadores sin duplicar mensajes', async () => {
  const time = segundos();
  await Promise.all([
    recibir('history', historial([mensaje()]), canal, time),
    recibir('history', historial([mensaje()]), canal, time),
  ]);
  expect(await db.inboxTrabajoEvento.count({ where: scope() })).toBe(1);
  await Promise.all([
    procesador.procesarSiguiente(),
    new MetaInboxProcesador(db, bus as never).procesarSiguiente(),
  ]);
  await vaciar();
  expect(await db.inboxMensaje.count({ where: scope() })).toBe(1);
  expect((await trabajo()).estado).toBe('COMPLETADO');
  expect(bus.avisar).toHaveBeenCalledTimes(1);
});
it('procesa lotes de 50 y retoma desde el cursor tras reiniciar el procesador', async () => {
  await recibir(
    'history',
    historial(
      Array.from({ length: 107 }, (_, i) => mensaje(`wamid.lote${i}`)),
      100,
      2,
    ),
  );
  await procesador.procesarSiguiente();
  expect(await trabajo()).toMatchObject({
    cursor: 50,
    total: 108,
    estado: 'PENDIENTE',
  });
  expect(await db.inboxBloqueHistorial.count({ where: scope() })).toBe(0);
  procesador = new MetaInboxProcesador(db, bus as never);
  await vaciar();
  expect(await db.inboxMensaje.count({ where: scope() })).toBe(107);
  expect(await trabajo()).toMatchObject({ cursor: 108, estado: 'COMPLETADO' });
  expect(await db.inboxImportacion.findFirst({ where: scope() })).toMatchObject(
    { progresoInformado: 100, finInformadoEl: expect.any(Date) },
  );
}, 20000);
it('el progreso informado no retrocede cuando los bloques llegan desordenados', async () => {
  await recibir('history', historial([mensaje()], 100, 2, 4));
  await vaciar();
  await recibir('history', historial([mensaje()], 5, 0, 1));
  await vaciar();
  expect(
    (await db.inboxImportacion.findFirstOrThrow({ where: scope() }))
      .progresoInformado,
  ).toBe(100);
  expect(await db.inboxBloqueHistorial.count({ where: scope() })).toBe(2);
  expect(await db.inboxMensaje.count({ where: scope() })).toBe(1);
});
it('historial y ecos no abren atención ni crean notificaciones; una entrada nueva sí actualiza su fecha', async () => {
  await recibir('history', historial([mensaje()]));
  await recibir('smb_message_echoes', {
    message_echoes: [
      mensaje('wamid.eco', {
        from: canal.numero,
        to: contacto,
        timestamp: String(segundos() - 2),
      }),
    ],
  });
  await vaciar();
  expect(
    (await db.inboxConversacion.findFirstOrThrow({ where: scope() }))
      .ultimoEntranteNuevoEl,
  ).toBeNull();
  const t = segundos() - 5;
  await recibir('messages', {
    messages: [mensaje('wamid.nuevo', { timestamp: String(t) })],
  });
  await vaciar();
  expect(
    (await db.inboxConversacion.findFirstOrThrow({ where: scope() }))
      .ultimoEntranteNuevoEl,
  ).toEqual(new Date(t * 1000));
  await recibir('messages', {
    messages: [mensaje('wamid.nuevo', { timestamp: String(t + 1) })],
  });
  await vaciar();
  expect(
    (await db.inboxConversacion.findFirstOrThrow({ where: scope() }))
      .ultimoEntranteNuevoEl,
  ).toEqual(new Date(t * 1000));
  expect(await db.notificacionWhatsapp.count({ where: scope() })).toBe(0);
  expect(await db.notificacionInterna.count({ where: scope() })).toBe(0);
  expect(global.fetch).not.toHaveBeenCalled();
});
it.each([true, false])(
  'adjunto complementario antes del original: %s; respeta dirección y fecha original',
  async (antes) => {
    const suplemento = () =>
      recibir('history', {
        messages: [
          mensaje('wamid.ficticio', {
            type: 'image',
            timestamp: '1700000100',
            image: { id: '9000001', caption: 'Imagen de ensayo' },
          }),
        ],
      });
    const original = () =>
      recibir(
        'history',
        historial([
          mensaje('wamid.ficticio', {
            from: canal.numero,
            type: 'media_placeholder',
          }),
        ]),
      );
    await (antes ? suplemento() : original());
    await vaciar();
    if (antes) expect((await fila()).conversacionId).toBeNull();
    await (antes ? original() : suplemento());
    await vaciar();
    expect(await fila()).toMatchObject({
      direccion: 'SALIENTE',
      enviadoEl: new Date(1700000000000),
      tipo: 'image',
      contenido: { mediaId: '9000001' },
    });
  },
);
it('edición y eliminación anteriores al original sobreviven a bloques atrasados', async () => {
  const editar = (timestamp: string, body: string) =>
    recibir('messages', {
      messages: [
        mensaje(`wamid.edit${timestamp}`, {
          type: 'edit',
          timestamp,
          edit: {
            original_message_id: 'wamid.ficticio',
            message: { type: 'text', text: { body } },
          },
        }),
      ],
    });
  await editar('1700000100', 'Corregido');
  await vaciar();
  await editar('1700000050', 'Edición anterior');
  await vaciar();
  await recibir('history', historial([mensaje()]));
  await vaciar();
  expect((await fila()).contenido).toEqual({ texto: 'Corregido' });
  await recibir('messages', {
    messages: [
      mensaje('wamid.revoke', {
        type: 'revoke',
        timestamp: '1700000200',
        revoke: { original_message_id: 'wamid.ficticio' },
      }),
    ],
  });
  await vaciar();
  await editar('1700000300', 'No resucitar');
  await vaciar();
  await recibir('history', historial([mensaje()], 50));
  await vaciar();
  expect(await fila()).toMatchObject({
    revocadoEl: new Date(1700000200000),
    contenido: null,
  });
});
it('eliminar antes de recibir el original no recupera su contenido', async () => {
  await recibir('messages', {
    messages: [
      mensaje('wamid.revoke', {
        type: 'revoke',
        revoke: { original_message_id: 'wamid.ficticio' },
      }),
    ],
  });
  await vaciar();
  await recibir('history', historial([mensaje()]));
  await vaciar();
  expect(await fila()).toMatchObject({
    contenido: null,
    delHistorial: true,
    conversacionId: expect.any(String),
  });
});
it('el estado leído recibido antes que el mensaje no retrocede por un fallo tardío', async () => {
  await recibir('messages', {
    statuses: [
      { id: 'wamid.ficticio', status: 'read', timestamp: '1700000001' },
    ],
  });
  await vaciar();
  await recibir('messages', {
    statuses: [
      { id: 'wamid.ficticio', status: 'failed', timestamp: '1700000002' },
    ],
  });
  await vaciar();
  await recibir('history', historial([mensaje()]));
  await vaciar();
  expect(await fila()).toMatchObject({
    estadoEntrega: 'READ',
    estadoEntregaOrden: 5,
  });
});
it('no resucita un contacto eliminado con eventos anteriores o de igual fecha', async () => {
  for (const [action, timestamp] of [
    ['remove', '1700000100'],
    ['add', '1700000000'],
    ['add', '1700000100'],
  ]) {
    await recibir('smb_app_state_sync', {
      state_sync: [
        {
          type: 'contact',
          action,
          contact: { phone_number: contacto, full_name: 'Nombre ficticio' },
          metadata: { timestamp },
        },
      ],
    });
    await vaciar();
  }
  expect(await db.inboxContacto.findFirst({ where: scope() })).toMatchObject({
    eliminado: true,
    nombre: null,
  });
});
it('separa formatos desconocidos para revisión sin perder mensajes válidos del lote', async () => {
  await recibir(
    'history',
    historial([
      mensaje(),
      { ...mensaje('wamid.invalido'), timestamp: 'no-fecha' },
    ]),
  );
  await vaciar();
  expect(await trabajo()).toMatchObject({ estado: 'REVISION', avisos: 1 });
  expect(await db.inboxMensaje.count({ where: scope() })).toBe(1);
  expect(
    (
      await db.webhookWhatsappCrudo.findFirstOrThrow({
        where: { wabaId: canal.wabaId },
      })
    ).procesado,
  ).toBe(false);
});
it('distingue rechazo del historial de una sincronización completa y detecta contradicción con progreso cero', async () => {
  await recibir('history', historial([], 0));
  await vaciar();
  await recibir('history', { history: [{ errors: [{ code: 2593109 }] }] });
  await vaciar();
  expect(await db.inboxImportacion.findFirst({ where: scope() })).toMatchObject(
    { historialRechazado: true, necesitaRevision: true, finInformadoEl: null },
  );
});
it('una desvinculación autenticada invalida el canal y pausa el historial pendiente', async () => {
  await recibir('history', historial([mensaje()]));
  const time = segundos();
  await recibir(
    'account_update',
    { event: 'PARTNER_REMOVED', phone_number: canal.numero },
    canal,
    time,
    true,
  );
  await procesador.procesarSiguiente();
  expect(
    await db.metaVinculo.findUnique({ where: { id: canal.id } }),
  ).toMatchObject({
    estado: 'DESCONECTADO',
    tokenCifrado: null,
    recepcionDesdeEl: null,
    desconectadoEl: new Date(time * 1000),
  });
  await vaciar();
  expect(
    await db.inboxTrabajoEvento.count({
      where: { ...scope(), estado: 'PAUSADO' },
    }),
  ).toBe(1);
  expect(await db.inboxMensaje.count({ where: scope() })).toBe(0);
  await recibir(
    'account_update',
    { event: 'ACCOUNT_RECONNECTED' },
    canal,
    time + 1,
    true,
  );
  expect(
    (await db.metaVinculo.findUniqueOrThrow({ where: { id: canal.id } }))
      .estado,
  ).toBe('DESCONECTADO');
});
it('una desvinculación anterior al alta actual no la cancela', async () => {
  await recibir(
    'account_update',
    { event: 'ACCOUNT_OFFBOARDED' },
    canal,
    segundos() - 120,
    true,
  );
  await vaciar();
  expect(
    (await db.metaVinculo.findUniqueOrThrow({ where: { id: canal.id } }))
      .estado,
  ).toBe('VERIFICADO');
});
it('otra generación de autorización no procesa trabajos del alta anterior', async () => {
  await recibir('history', historial([mensaje()]));
  await db.metaVinculo.update({
    where: { id: canal.id },
    data: { autorizacionId: randomUUID() },
  });
  await vaciar();
  expect((await trabajo()).estado).toBe('PAUSADO');
  expect(await db.inboxMensaje.count({ where: scope() })).toBe(0);
});
it('el mismo wamid en dos empresas es independiente y el guard filtra lecturas', async () => {
  const otro = await crearCanal();
  await recibir('history', historial([mensaje()]));
  await recibir(
    'history',
    historial([mensaje('wamid.ficticio', { text: { body: 'Otra empresa' } })]),
    otro,
  );
  await vaciar();
  expect(
    await runWithTenant(
      canal.tenantId,
      async () => await db.inboxMensaje.count(),
    ),
  ).toBe(1);
  const ajeno = await db.inboxMensaje.findFirstOrThrow({
    where: { tenantId: otro.tenantId },
  });
  expect(
    await runWithTenant(
      canal.tenantId,
      async () => await db.inboxMensaje.findUnique({ where: { id: ajeno.id } }),
    ),
  ).toBeNull();
  await expect(
    db.inboxContacto.create({
      data: {
        tenantId: otro.tenantId,
        vinculoId: canal.id,
        waId: contacto,
        actualizadoMetaEl: new Date(),
      },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
});
it('no encola una combinación de cuenta y número ajenos', async () => {
  const otro = await crearCanal();
  await recibir('history', historial([mensaje()]), {
    ...canal,
    phoneNumberId: otro.phoneNumberId,
  });
  expect(await db.inboxTrabajoEvento.count({ where: scope() })).toBe(0);
});
it('un fallo a mitad del lote revierte mensajes, cursor y revisión; luego puede reintentar', async () => {
  await recibir(
    'history',
    historial([mensaje('wamid.primero'), mensaje('wamid.segundo')]),
  );
  const real = db.$transaction.bind(db);
  let interrumpir = true;
  const conFallo = new Proxy(db, {
    get(target, key) {
      if (key !== '$transaction') return Reflect.get(target, key);
      return (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        real(async (tx) =>
          fn(
            new Proxy(tx, {
              get(targetTx, prop) {
                if (prop !== 'inboxMensaje') return Reflect.get(targetTx, prop);
                return new Proxy(targetTx.inboxMensaje, {
                  get(delegate, metodo) {
                    if (metodo !== 'create')
                      return Reflect.get(delegate, metodo);
                    return async (args: Prisma.InboxMensajeCreateArgs) => {
                      if (interrumpir && args.data.wamid === 'wamid.segundo') {
                        interrumpir = false;
                        throw new Error('secreto-no-se-registra');
                      }
                      return delegate.create(args);
                    };
                  },
                });
              },
            }),
          ),
        );
    },
  });
  procesador = new MetaInboxProcesador(conFallo, bus as never);
  await procesador.procesarSiguiente();
  expect(await trabajo()).toMatchObject({
    cursor: 0,
    intentos: 1,
    estado: 'PENDIENTE',
    ultimoError: 'PROCESAMIENTO_INTERRUMPIDO',
  });
  expect(await db.inboxMensaje.count({ where: scope() })).toBe(0);
  expect(await db.inboxCanalRevision.count({ where: scope() })).toBe(0);
  expect(bus.avisar).not.toHaveBeenCalled();
  expect(await procesador.procesarSiguiente()).toBe(false);
  await db.inboxTrabajoEvento.updateMany({
    where: scope(),
    data: { proximoIntentoEl: new Date(0) },
  });
  await vaciar();
  expect(await db.inboxMensaje.count({ where: scope() })).toBe(2);
});
it('una identidad contradictoria deja revisión sin modificar la conversación original', async () => {
  await recibir('history', historial([mensaje()]));
  await vaciar();
  await recibir('messages', {
    messages: [mensaje('wamid.ficticio', { from: '16505550124' })],
  });
  await vaciar();
  expect(await trabajo()).toMatchObject({
    estado: 'REVISION',
    ultimoError: 'IDENTIDAD_CONFLICTIVA',
    cursor: 0,
  });
  expect(await db.inboxConversacion.count({ where: scope() })).toBe(1);
});
