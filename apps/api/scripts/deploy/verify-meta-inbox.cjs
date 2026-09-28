/* Base *_test y datos propios del ensayo. No llama a Meta ni modifica usuarios. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const source =
  process.env.VERIFY_META_SOURCE === 'true' ? '../../src' : '../../dist/src';
const { PrismaService } = require(`${source}/prisma/prisma.service`);
const { WhatsappContextoService } = require(
  `${source}/clientes/whatsapp-contexto.service`,
);
const { MetaInboxService } = require(
  `${source}/integraciones/meta/meta-inbox.service`,
);
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
    'El ensayo del inbox exige una base *_test identificada explícitamente.',
  );
const db = new PrismaService();
const tenantId = randomUUID(),
  ajenoId = randomUUID(),
  clienteId = randomUUID(),
  segundoId = randomUUID();
const waba = `11${Date.now()}`,
  phone = `22${Date.now()}`,
  telefono = '+16505550123';
const auth = {
  tenantId,
  userId: randomUUID(),
  role: 'ADMINISTRADOR',
  permisos: new Set(['crm.ver', 'produccion.ver']),
};
const service = new MetaInboxService(
  db,
  { async exigirIncluida() {} },
  new WhatsappContextoService(db),
);
Object.assign(process.env, {
  META_WHATSAPP_PILOT_ENABLED: 'true',
  META_WHATSAPP_RECEPCION_PILOT_ENABLED: 'true',
  META_PILOT_TENANT_ID: tenantId,
  META_PILOT_WABA_ID: waba,
  META_PILOT_PHONE_NUMBER_ID: phone,
  META_PILOT_RECIPIENT: telefono,
  META_PILOT_ACCESS_TOKEN: 'token-sintetico-no-credencial',
  META_APP_SECRET: 'secret-sintetico',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-sintetico',
});
async function main() {
  await db.$connect();
  await db.tenant.createMany({
    data: [
      { id: tenantId, nombre: 'Inbox ficticio', slug: `inbox-${tenantId}` },
      {
        id: ajenoId,
        nombre: 'Otra gráfica ficticia',
        slug: `inbox-${ajenoId}`,
      },
    ],
  });
  await db.cliente.createMany({
    data: [
      {
        id: clienteId,
        tenantId,
        nombre: 'Cliente propio',
        telefonoCodigo: '+1',
        telefonoNumero: '650 555 0123',
        paisCodigo: 'US',
      },
      {
        tenantId: ajenoId,
        nombre: 'Cliente ajeno',
        telefonoCodigo: '+1',
        telefonoNumero: '6505550123',
        paisCodigo: 'US',
      },
    ],
  });
  const rows = Array.from({ length: 115 }, (_, i) => ({
    id: randomUUID(),
    tenantId,
    wabaId: waba,
    phoneNumberId: phone,
    wamid: `wamid.${tenantId}.${i}`,
    remitente: telefono,
    tipo: 'text',
    texto: `Mensaje sintético ${i}`,
    nombreContacto: 'Contacto ficticio',
    enviadoEl: new Date(Date.UTC(2026, 8, 1, 12, Math.floor(i / 20))),
  }));
  const otro = {
    ...rows[0],
    id: randomUUID(),
    tenantId: ajenoId,
    wamid: `wamid.${ajenoId}`,
    texto: 'No visible',
  };
  await db.mensajeWhatsappRecibido.createMany({
    data: [
      ...rows,
      otro,
      {
        ...rows[0],
        id: randomUUID(),
        wamid: `wamid.${tenantId}.otro-canal`,
        phoneNumberId: '999',
      },
      {
        ...rows[0],
        id: randomUUID(),
        wamid: `wamid.${tenantId}.otro-contacto`,
        remitente: '+16505550199',
      },
    ],
  });
  const all = [];
  let query = {},
    pagina;
  do {
    pagina = await service.consultar(auth, query);
    assert(pagina);
    assert(pagina.mensajes.length <= 50);
    all.push(...pagina.mensajes);
    query = { antesDe: pagina.anterior };
  } while (pagina.anterior);
  assert.equal(all.length, 115);
  assert.equal(new Set(all.map((m) => m.id)).size, 115);
  assert.deepEqual(
    new Set(all.map((m) => m.id)),
    new Set(rows.map((m) => m.id)),
  );
  assert.equal(
    pagina.contexto.cliente.id,
    clienteId,
    'reconoce el cliente propio por teléfono',
  );
  await assert.rejects(
    service.consultar(auth, { antesDe: otro.id }),
    (error) => error.getStatus?.() === 404,
  );
  assert.equal(
    await service.consultar({ ...auth, tenantId: ajenoId }, {}),
    null,
  );
  await db.cliente.create({
    data: {
      id: segundoId,
      tenantId,
      nombre: 'Cliente con contacto',
      telefonoCodigo: '+1',
      telefonoNumero: '6505550199',
      paisCodigo: 'US',
    },
  });
  await db.clienteContacto.create({
    data: {
      tenantId,
      clienteId: segundoId,
      nombre: 'Contacto secundario',
      telefonoCodigo: '+1',
      telefonoNumero: '6505550123',
    },
  });
  pagina = await service.consultar(auth, {});
  assert.equal(pagina.contexto.estado, 'seleccionar_cliente');
  assert.equal(pagina.contexto.cliente, null);
  assert.equal(pagina.contexto.coincidencias.length, 2);
  assert.deepEqual(pagina.contexto.ordenes, []);
  pagina = await service.consultar(auth, { clienteId: segundoId });
  assert.equal(pagina.contexto.cliente.id, segundoId);
  assert.deepEqual(pagina.contexto.cliente.contactos, ['Contacto secundario']);
  assert.equal(
    (await service.consultar({ ...auth, permisos: new Set() }, {})).contexto,
    null,
  );
  process.env.META_WHATSAPP_RECEPCION_PILOT_ENABLED = 'false';
  assert.equal(await service.consultar(auth, {}), null);
  console.log(
    'Inbox PostgreSQL: 115 mensajes paginados sin saltos/duplicados; aislamiento por empresa/canal/contacto; reconocimiento de ficha y contacto secundario; ambigüedad, permisos y apagado comprobados.',
  );
}
main()
  .catch((error) => {
    console.error(
      'Falló el ensayo de inbox:',
      error instanceof assert.AssertionError
        ? error.message
        : error.code || error.name,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.tenant.deleteMany({ where: { id: { in: [tenantId, ajenoId] } } });
    await db.$disconnect();
  });
