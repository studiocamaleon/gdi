/* PostgreSQL real, webhooks sintéticos. Sin red hacia Meta ni mensajes reales. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const source =
  process.env.VERIFY_META_SOURCE === 'true' ? '../../src' : '../../dist/src';
const { PrismaService } = require(`${source}/prisma/prisma.service`);
const { WebhooksWhatsappService } = require(
  `${source}/webhooks-whatsapp/webhooks-whatsapp.service`,
);
const { MetaRecepcionService } = require(
  `${source}/integraciones/meta/meta-recepcion.service`,
);
const { runWithTenant } = require(`${source}/common/tenant-context`);
const database = decodeURIComponent(
  new URL(
    process.env.DATABASE_URL || 'postgresql://localhost/no-configurada',
  ).pathname.slice(1),
);
if (
  !database.endsWith('_test') ||
  database !== process.env.DEPLOY_DATABASE_NAME
)
  throw new Error(
    'El ensayo de recepción exige una base *_test identificada explícitamente.',
  );

const db = new PrismaService();
const tenantId = randomUUID();
const ajenoId = randomUUID();
const phone = `11${Date.now()}`;
const waba = `22${Date.now()}`;
const autorizado = '16505550123';
const webhooks = new WebhooksWhatsappService(db);
const bandeja = new MetaRecepcionService(db, { async exigirIncluida() {} });
Object.assign(process.env, {
  META_WHATSAPP_PILOT_ENABLED: 'true',
  META_WHATSAPP_RECEPCION_PILOT_ENABLED: 'true',
  META_PILOT_TENANT_ID: tenantId,
  META_PILOT_PHONE_NUMBER_ID: phone,
  META_PILOT_WABA_ID: waba,
  META_PILOT_RECIPIENT: `+${autorizado}`,
  META_PILOT_ACCESS_TOKEN: 'token-sintetico-no-es-una-credencial',
  META_APP_SECRET: 'secret-sintetico',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-sintetico',
});
function mensaje(id, extra = {}) {
  return {
    id: `wamid.${tenantId}.${id}`,
    from: autorizado,
    type: 'text',
    text: { body: 'Hola Grafo 👋' },
    timestamp: '1780000000',
    ...extra,
  };
}
function envelope(messages, options = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: options.waba || waba,
        changes: [
          {
            field: options.field || 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: options.phone || phone },
              contacts: [
                {
                  wa_id: autorizado,
                  profile: { name: options.nombre || 'Contacto ficticio' },
                },
              ],
              messages,
            },
          },
        ],
      },
    ],
  };
}
const callback = (body) => webhooks.persistir(webhooks.extraerCambios(body));
async function main() {
  await db.$connect();
  await db.tenant.createMany({
    data: [
      {
        id: tenantId,
        nombre: 'Ensayo recepción',
        slug: `recepcion-${tenantId}`,
      },
      {
        id: ajenoId,
        nombre: 'Ensayo aislamiento',
        slug: `recepcion-${ajenoId}`,
      },
    ],
  });
  const primero = mensaje('primero');
  await Promise.all([
    callback(envelope([primero])),
    callback(envelope([primero])),
  ]);
  await callback(envelope([primero], { nombre: 'Metadata distinta' }));
  assert.equal(
    await db.mensajeWhatsappRecibido.count({ where: { tenantId } }),
    1,
    'el mismo wamid no debe duplicarse aunque cambie la metadata',
  );
  let vista = await bandeja.listar(tenantId);
  assert.equal(vista.mensajes[0].nombreContacto, 'Contacto ficticio');
  assert.equal(vista.mensajes[0].texto, 'Hola Grafo 👋');
  assert(!('wamid' in vista.mensajes[0]) && !('payload' in vista.mensajes[0]));

  await callback(
    envelope([
      mensaje('viejo', { timestamp: '1779000000' }),
      mensaje('nuevo', { timestamp: '1781000000' }),
      mensaje('otro-contacto', { from: '16505550199' }),
    ]),
  );
  vista = await bandeja.listar(tenantId);
  assert.equal(vista.mensajes.length, 3);
  assert.equal(
    vista.mensajes[0].enviadoEl.getTime(),
    1781000000000,
    'el orden es el del mensaje, no el de llegada del webhook',
  );
  assert.equal(await bandeja.listar(ajenoId), null);
  assert.deepEqual(
    await runWithTenant(ajenoId, async () => await db.mensajeWhatsappRecibido.findMany()),
    [],
  );

  for (const opciones of [
    { waba: '999' },
    { phone: '999' },
    { field: 'history' },
    { field: 'smb_message_echoes' },
  ])
    await callback(envelope([mensaje('no-entrante')], opciones));
  assert.equal(
    await db.mensajeWhatsappRecibido.count({ where: { tenantId } }),
    3,
  );
  await db.integracionTenant.create({
    data: {
      tenantId: ajenoId,
      proveedor: 'META_WHATSAPP',
      estado: 'CONECTADA',
      metadataJson: { wabaId: waba, phoneNumberId: phone },
    },
  });
  await callback(envelope([mensaje('ambiguo')]));
  assert.equal(
    await db.mensajeWhatsappRecibido.count({ where: { tenantId } }),
    3,
  );
  assert.equal(
    (
      await db.webhookWhatsappCrudo.findFirstOrThrow({
        where: { wamid: mensaje('ambiguo').id, wabaId: waba },
      })
    ).tenantId,
    null,
  );
  await db.integracionTenant.updateMany({
    where: { tenantId: ajenoId },
    data: { estado: 'DESCONECTADA' },
  });

  process.env.META_WHATSAPP_RECEPCION_PILOT_ENABLED = 'false';
  await callback(envelope([mensaje('apagado')]));
  assert.equal(await bandeja.listar(tenantId), null);
  assert.equal(
    await db.mensajeWhatsappRecibido.count({ where: { tenantId } }),
    3,
  );
  assert.equal(
    (
      await db.webhookWhatsappCrudo.findFirstOrThrow({
        where: { wamid: mensaje('apagado').id, wabaId: waba },
      })
    ).procesado,
    false,
  );
  process.env.META_WHATSAPP_RECEPCION_PILOT_ENABLED = 'true';

  // Fuerza fallo de FK al proyectar. El crudo insertado en esa misma
  // transacción debe revertirse, para no confirmar a Meta datos perdidos.
  process.env.META_PILOT_TENANT_ID = randomUUID();
  await assert.rejects(callback(envelope([mensaje('rollback')])));
  assert.equal(
    await db.webhookWhatsappCrudo.count({
      where: { wamid: mensaje('rollback').id },
    }),
    0,
  );
  process.env.META_PILOT_TENANT_ID = tenantId;

  for (let i = 0; i < 55; i++)
    await callback(envelope([mensaje(`pagina-${i}`)]));
  vista = await bandeja.listar(tenantId);
  assert.equal(vista.mensajes.length, 50, 'la lectura debe tener límite');
  assert(vista.mensajes.every((m) => m.remitente === `+${autorizado}`));
  console.log(
    'Recepción Meta: persistencia, concurrencia, deduplicación, orden, límite, aislamiento, ambigüedad, apagado y rollback comprobados con PostgreSQL.',
  );
}
main()
  .catch((error) => {
    console.error(
      'Falló el ensayo de recepción:',
      error instanceof assert.AssertionError
        ? error.message
        : error.code || error.name,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.webhookWhatsappCrudo.deleteMany({
      where: {
        OR: [{ wabaId: waba }, { wamid: { startsWith: `wamid.${tenantId}.` } }],
      },
    });
    await db.tenant.deleteMany({ where: { id: { in: [tenantId, ajenoId] } } });
    await db.$disconnect();
  });
