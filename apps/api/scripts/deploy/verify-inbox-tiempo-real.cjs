/* Ensayo aislado: PostgreSQL y Redis locales reales, ninguna llamada a Meta. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: pausa } = require('node:timers/promises');
const source =
  process.env.VERIFY_META_SOURCE === 'true' ? '../../src' : '../../dist/src';
const { PrismaService } = require(`${source}/prisma/prisma.service`);
const { InboxTiempoRealBus } = require(
  `${source}/inbox-tiempo-real/inbox-tiempo-real.bus`,
);
const { registrarCambioInbox } = require(
  `${source}/inbox-tiempo-real/inbox-revision`,
);
const { WebhooksWhatsappService } = require(
  `${source}/webhooks-whatsapp/webhooks-whatsapp.service`,
);
const { runWithTenant } = require(`${source}/common/tenant-context`);
const dbUrl = new URL(process.env.DATABASE_URL);
const redisUrl = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
if (
  !['localhost', '127.0.0.1'].includes(dbUrl.hostname) ||
  !dbUrl.pathname.endsWith('_test') ||
  dbUrl.pathname.slice(1) !== process.env.DEPLOY_DATABASE_NAME ||
  !['localhost', '127.0.0.1'].includes(redisUrl.hostname)
)
  throw new Error('El ensayo exige PostgreSQL *_test y Redis locales.');
const db = new PrismaService();
const bus1 = new InboxTiempoRealBus(db),
  bus2 = new InboxTiempoRealBus(db);
const tenantId = randomUUID(),
  otroId = randomUUID();
const canal = {
  tenantId,
  wabaId: `22${Date.now()}`,
  phoneNumberId: `11${Date.now()}`,
};
const otro = { ...canal, tenantId: otroId };
const avisos1 = [],
  avisos2 = [],
  avisosOtro = [];
const webhooks = new WebhooksWhatsappService(db, bus1);
Object.assign(process.env, {
  META_WHATSAPP_PILOT_ENABLED: 'true',
  META_WHATSAPP_RECEPCION_PILOT_ENABLED: 'true',
  META_PILOT_TENANT_ID: tenantId,
  META_PILOT_PHONE_NUMBER_ID: canal.phoneNumberId,
  META_PILOT_WABA_ID: canal.wabaId,
  META_PILOT_RECIPIENT: '+16505550123',
  META_PILOT_ACCESS_TOKEN: 'token-sintetico-no-es-una-credencial',
  META_APP_SECRET: 'sintetico',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'sintetico',
});
const cambio = (n) => ({
  ...canal,
  tipo: 'messages',
  wamid: `wamid.${tenantId}.${n}`,
  payload: {
    messages: [
      {
        id: `wamid.${tenantId}.${n}`,
        from: '16505550123',
        type: 'text',
        text: { body: 'Ensayo de tiempo real' },
        timestamp: '1780000000',
      },
    ],
  },
});
async function esperar(fn, ms = 4000) {
  const hasta = Date.now() + ms;
  while (!fn() && Date.now() < hasta) await pausa(40);
  assert(fn(), 'No llegó el aviso esperado dentro del plazo.');
}
async function main() {
  await db.$connect();
  await db.tenant.createMany({
    data: [tenantId, otroId].map((id) => ({
      id,
      nombre: 'Ensayo aislado Inbox',
      slug: `inbox-${id}`,
    })),
  });
  // Dos instancias representan réplicas API distintas. Un callback compartido
  // no puede heredar la empresa del primer suscriptor.
  runWithTenant(tenantId, () => bus1.escuchar(canal, (r) => avisos1.push(r)));
  runWithTenant(tenantId, () => bus2.escuchar(canal, (r) => avisos2.push(r)));
  runWithTenant(otroId, () => bus2.escuchar(otro, (r) => avisosOtro.push(r)));
  await esperar(
    () =>
      avisos1.includes('0') &&
      avisos2.includes('0') &&
      avisosOtro.includes('0'),
  );
  await esperar(
    () =>
      bus1.publicador?.status === 'ready' && bus2.receptor?.status === 'ready',
  );
  // Concurrencia y reentrega: un solo mensaje y una sola revisión.
  await Promise.all([
    webhooks.persistir([cambio(1)]),
    webhooks.persistir([cambio(1)]),
  ]);
  await esperar(() => avisos2.includes('1'));
  assert.equal(
    await db.mensajeWhatsappRecibido.count({ where: { tenantId } }),
    1,
  );
  assert.equal(
    (
      await db.inboxCanalRevision.findUniqueOrThrow({
        where: { tenantId_wabaId_phoneNumberId: canal },
      })
    ).revision,
    1n,
  );
  assert.deepEqual(avisosOtro, ['0']);
  // Si falla la revisión, también debe revertirse el mensaje y no emitirse.
  const prismaFallida = {
    integracionTenant: db.integracionTenant,
    $transaction: (fn) =>
      db.$transaction((tx) =>
        fn(
          new Proxy(tx, {
            get: (t, p) =>
              p === 'inboxCanalRevision'
                ? {
                    upsert: async () => {
                      throw new Error('fallo simulado');
                    },
                  }
                : t[p],
          }),
        ),
      ),
  };
  await assert.rejects(
    new WebhooksWhatsappService(prismaFallida, bus1).persistir([
      cambio('rollback'),
    ]),
  );
  assert.equal(
    await db.webhookWhatsappCrudo.count({
      where: { wamid: cambio('rollback').wamid },
    }),
    0,
  );
  assert.equal(
    await db.mensajeWhatsappRecibido.count({ where: { tenantId } }),
    1,
  );
  // Redis no es imprescindible: omitir aviso y esperar control compartido DB.
  bus2.receptor.disconnect();
  await db.$transaction((tx) => registrarCambioInbox(tx, canal));
  await esperar(() => avisos2.includes('2'), 18000);
  // También procesa otro tenant correctamente, sin contaminar los existentes.
  await runWithTenant(otroId, () =>
    db.$transaction((tx) => registrarCambioInbox(tx, otro)),
  );
  bus2.avisar(otro);
  await esperar(() => avisosOtro.includes('1'));
  assert.equal(avisos1.at(-1), '2');
  assert.equal(avisos2.at(-1), '2');
  // Una conexión nueva obtiene la revisión durable aun sin historial de Redis.
  const recuperados = [];
  const bus3 = new InboxTiempoRealBus(db);
  try {
    bus3.escuchar(canal, (r) => recuperados.push(r));
    await esperar(() => recuperados.includes('2'));
  } finally {
    bus3.onModuleDestroy();
  }
  console.log(
    'Inbox: commit, deduplicación concurrente, rollback, Redis entre réplicas, respaldo sin Redis, aislamiento y reconexión verificados.',
  );
}
main()
  .catch((error) => {
    console.error(
      'Ensayo Inbox:',
      error instanceof assert.AssertionError
        ? error.message
        : error.code || error.name,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    bus1.onModuleDestroy();
    bus2.onModuleDestroy();
    await db.webhookWhatsappCrudo.deleteMany({
      where: { wabaId: canal.wabaId },
    });
    await db.tenant.deleteMany({ where: { id: { in: [tenantId, otroId] } } });
    await db.$disconnect();
  });
