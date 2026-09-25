/* Ensayo con PostgreSQL real y Meta simulado. Nunca usa red hacia Meta. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const source =
  process.env.VERIFY_META_SOURCE === 'true' ? '../../src' : '../../dist/src';
const { PrismaService } = require(`${source}/prisma/prisma.service`);
const { MetaPilotoService } = require(
  `${source}/integraciones/meta/meta-piloto.service`,
);
const { WebhooksWhatsappService } = require(
  `${source}/webhooks-whatsapp/webhooks-whatsapp.service`,
);
const { runWithTenant } = require(`${source}/common/tenant-context`);
const url = new URL(
  process.env.DATABASE_URL || 'postgresql://localhost/no-configurada',
);
const database = decodeURIComponent(url.pathname.slice(1));
if (
  !database.endsWith('_test') ||
  database !== process.env.DEPLOY_DATABASE_NAME
) {
  throw new Error(
    'El ensayo Meta sólo admite una base *_test identificada explícitamente.',
  );
}
const db = new PrismaService();
const tenantId = randomUUID();
const ajenoId = randomUUID();
const phone = '111222333';
const waba = '444555666';
Object.assign(process.env, {
  META_WHATSAPP_PILOT_ENABLED: 'true',
  META_PILOT_TENANT_ID: tenantId,
  META_PILOT_PHONE_NUMBER_ID: phone,
  META_PILOT_WABA_ID: waba,
  META_PILOT_RECIPIENT: '+16505550123',
  META_PILOT_ACCESS_TOKEN: 'token-sintetico-no-es-una-credencial',
  META_APP_SECRET: 'secret-sintetico',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-sintetico',
});
let llamadas = 0;
let temprano = false;
let incierto = false;
const webhooks = new WebhooksWhatsappService(db);
function envelope(id, status, correlacion, phoneNumber = phone, wabaId = waba) {
  return {
    entry: [
      {
        id: wabaId,
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: phoneNumber },
              statuses: [
                {
                  id,
                  status,
                  timestamp: '1780000000',
                  ...(correlacion
                    ? { biz_opaque_callback_data: correlacion }
                    : {}),
                },
              ],
            },
          },
        ],
      },
    ],
  };
}
const callback = async (body) =>
  webhooks.persistir(webhooks.extraerCambios(body));
const client = {
  async enviarPlantilla(args) {
    llamadas++;
    assert.equal(args.telefono, '+16505550123');
    const wamid = `wamid.${tenantId}.${llamadas}`;
    if (temprano)
      await callback(envelope(wamid, 'delivered', args.correlacion));
    return incierto ? { estado: 'incierta' } : { estado: 'aceptada', wamid };
  },
};
const piloto = new MetaPilotoService(db, client, {
  async exigirOperacionTx() {},
});
async function main() {
  await db.$connect();
  await db.tenant.createMany({
    data: [
      { id: tenantId, nombre: 'Ensayo Meta aislado', slug: `meta-${tenantId}` },
      { id: ajenoId, nombre: 'Ensayo aislamiento', slug: `meta-${ajenoId}` },
    ],
  });
  const key = randomUUID();
  await Promise.all([
    piloto.enviarPrueba(tenantId, key),
    piloto.enviarPrueba(tenantId, key),
  ]);
  assert.equal(
    llamadas,
    1,
    'dos pedidos simultáneos deben producir un solo envío',
  );
  let row = await db.notificacionWhatsapp.findFirstOrThrow({
    where: { tenantId },
  });
  const stateRead = envelope(row.metaWamid, 'read');
  await callback(stateRead);
  await callback(stateRead);
  await callback(envelope(row.metaWamid, 'sent'));
  await callback(envelope(row.metaWamid, 'delivered'));
  assert.equal(
    await db.webhookWhatsappCrudo.count({ where: { tenantId } }),
    3,
    'el mismo evento no debe duplicarse',
  );
  row = await db.notificacionWhatsapp.findFirstOrThrow({
    where: { id: row.id },
  });
  assert.equal(
    row.estadoEntrega,
    'read',
    'eventos viejos no deben deshacer lectura',
  );
  assert.equal(await piloto.estado(ajenoId), null);
  const ajeno = await db.notificacionWhatsapp.create({
    data: {
      tenantId: ajenoId,
      canal: 'META_WHATSAPP',
      evento: 'meta_prueba',
      claveUnica: 'aislamiento',
      telefono: '+16505550123',
      plantilla: 'hello_world',
      parametros: [],
      metaPhoneNumberId: phone,
    },
  });
  await callback(envelope('wamid.atajo', 'delivered', ajeno.id));
  assert.equal(
    (
      await db.notificacionWhatsapp.findFirstOrThrow({
        where: { id: ajeno.id },
      })
    ).estadoEntrega,
    null,
    'la correlación no debe cruzar empresas',
  );
  const soloPropios = await runWithTenant(
    tenantId,
    async () => await db.notificacionWhatsapp.findMany(),
  );
  assert(soloPropios.every((r) => r.tenantId === tenantId));
  temprano = true;
  await piloto.enviarPrueba(tenantId, randomUUID());
  assert.equal(
    await db.notificacionWhatsapp.count({
      where: { tenantId, estadoEntrega: 'delivered' },
    }),
    1,
    'un webhook anterior a la respuesta debe conservarse',
  );
  temprano = false;
  incierto = true;
  const uncertainKey = randomUUID();
  await piloto.enviarPrueba(tenantId, uncertainKey);
  const uncertain = await db.notificacionWhatsapp.findFirstOrThrow({
    where: { tenantId, claveUnica: `meta_prueba:${uncertainKey}` },
  });
  assert.equal(uncertain.estado, 'meta_incierta');
  await callback(
    envelope(`wamid.${tenantId}.recuperado`, 'delivered', uncertain.id),
  );
  assert.equal(
    (
      await db.notificacionWhatsapp.findFirstOrThrow({
        where: { id: uncertain.id },
      })
    ).estadoEntrega,
    'delivered',
  );
  await piloto.enviarPrueba(tenantId, uncertainKey);
  assert.equal(llamadas, 3, 'el intento incierto no se reenvía');
  console.log(
    'Meta simulado: concurrencia, deduplicación, estados fuera de orden, aislamiento y respuesta temprana comprobados con PostgreSQL.',
  );
}
main()
  .catch((error) => {
    console.error(
      'Falló el ensayo de Meta con PostgreSQL:',
      error instanceof assert.AssertionError
        ? error.message
        : error.code || error.name,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    // Sólo las filas sintéticas de ESTE ensayo. No reset, seed ni borrado global.
    await db.webhookWhatsappCrudo.deleteMany({
      where: {
        OR: [
          { tenantId },
          {
            wabaId: waba,
            payload: { path: ['statuses', '0', 'id'], equals: 'wamid.atajo' },
          },
        ],
      },
    });
    await db.tenant.deleteMany({ where: { id: { in: [tenantId, ajenoId] } } });
    await db.$disconnect();
  });
