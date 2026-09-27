import { randomUUID, createHash } from 'node:crypto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolSistema, type MetaVinculo } from '@prisma/client';
import type { CurrentAuth } from '../../../auth/auth.types';
import { PrismaService } from '../../../prisma/prisma.service';
import { runWithTenant } from '../../../common/tenant-context';
import { expandir, permisosDeRolBase } from '../../../auth/permisos';
import { MetaAdjuntosService } from './meta-adjuntos.service';
import { encolarAdjunto } from './meta-adjuntos';
import { ErrorMediaMeta } from './meta-media.client';
import { ArchivosService } from '../../../archivos/archivos.service';
const url = new URL(process.env.DATABASE_URL!);
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  !url.pathname.endsWith('_test')
)
  throw new Error('Requiere PostgreSQL local *_test');
const db = new PrismaService(),
  bytes = Buffer.from('%PDF-1.4\nfixture privado');
const metadata = {
  url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?ficticio=1',
  mime: 'application/pdf',
  bytes: bytes.length,
  hash: createHash('sha256').update(bytes).digest('hex'),
  ext: 'pdf',
};
const secrets = {
  disponible: true,
  descifrar: jest.fn(() => 'token-ficticio'),
};
const client = { metadata: jest.fn(), descargar: jest.fn() },
  storage = { subir: jest.fn(), firmarDescarga: jest.fn(), borrar: jest.fn() },
  capacidades = { exigirIncluida: jest.fn(), exigirOperacionTx: jest.fn() },
  bus = { avisar: jest.fn() };
const service = () =>
  new MetaAdjuntosService(
    db,
    secrets as never,
    client as never,
    capacidades as never,
    bus as never,
    storage as never,
  );
const keys = [
  'GRAFO_DEPLOY_ENV',
  'META_INBOX_PRUEBA_ENABLED',
  'META_INBOX_PRUEBA_TENANT_ID',
  'META_INBOX_PRUEBA_WABA_ID',
  'META_INBOX_PRUEBA_PHONE_NUMBER_ID',
  'META_INBOX_PRUEBA_DESTINATARIO_WA_ID',
  'META_INBOX_ADJUNTOS_ENABLED',
  'META_CONEXION_MODO',
  'META_CONEXION_TENANT_IDS',
  'META_INBOX_RECEPCION_ENABLED',
  'META_INBOX_LECTURA_ENABLED',
  'META_APP_ID',
  'META_APP_SECRET',
  'META_EMBEDDED_SIGNUP_CONFIG_ID',
];
const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]])),
  tenants: string[] = [],
  users: string[] = [];
let auth: CurrentAuth,
  ajena: CurrentAuth,
  canal: MetaVinculo,
  api: MetaAdjuntosService,
  fetchMock: jest.SpyInstance;
async function cuenta() {
  const tenantId = randomUUID(),
    userId = randomUUID();
  tenants.push(tenantId);
  users.push(userId);
  await db.tenant.create({
    data: {
      id: tenantId,
      nombre: 'Adjuntos ficticios',
      slug: `adjuntos-${tenantId}`,
      cuotaBytesArchivos: 100000n,
    },
  });
  await db.user.create({
    data: { id: userId, email: `${userId}@example.invalid` },
  });
  const m = await db.membership.create({
      data: { tenantId, userId, rol: RolSistema.ADMINISTRADOR },
    }),
    s = await db.authSession.create({
      data: {
        userId,
        currentTenantId: tenantId,
        currentMembershipId: m.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
  const v = await db.metaVinculo.create({
    data: {
      tenantId,
      wabaId: randomUUID(),
      phoneNumberId: randomUUID(),
      numero: '+16505550100',
      autorizacionId: randomUUID(),
      verificadoEl: new Date(),
      recepcionDesdeEl: new Date(),
      tokenCifrado: { ficticio: true },
    },
  });
  return {
    v,
    auth: {
      tenantId,
      userId,
      sessionId: s.id,
      membershipId: m.id,
      role: RolSistema.ADMINISTRADOR,
      email: `${userId}@example.invalid`,
      permisos: expandir(permisosDeRolBase(RolSistema.ADMINISTRADOR)),
    } as CurrentAuth,
  };
}
async function mensaje() {
  const m = await db.inboxMensaje.create({
    data: {
      tenantId: canal.tenantId,
      vinculoId: canal.id,
      wamid: `wamid.${randomUUID()}`,
      tipo: 'document',
      enviadoEl: new Date(),
      direccion: 'ENTRANTE',
      contenido: {
        mediaId: '123',
        nombreArchivo: 'Pedido.pdf',
        sha256: metadata.hash,
      },
    },
  });
  await db.$transaction((tx) => encolarAdjunto(tx, canal, m.wamid));
  return m;
}
const trabajo = (id: string) =>
  db.inboxAdjunto.findUniqueOrThrow({
    where: { mensajeId: id },
    include: { archivo: true },
  });
const usado = async () =>
  (await db.tenant.findUniqueOrThrow({ where: { id: canal.tenantId } }))
    .bytesArchivos;
beforeEach(async () => {
  jest.resetAllMocks();
  secrets.descifrar.mockReturnValue('token-ficticio');
  fetchMock = jest
    .spyOn(global, 'fetch')
    .mockRejectedValue(new Error('Red prohibida'));
  const a = await cuenta(),
    b = await cuenta();
  auth = a.auth;
  canal = a.v;
  ajena = b.auth;
  Object.assign(process.env, {
    GRAFO_DEPLOY_ENV: 'local',
    META_INBOX_PRUEBA_ENABLED: 'false',
    META_INBOX_ADJUNTOS_ENABLED: 'true',
    META_CONEXION_MODO: 'coexistencia',
    META_CONEXION_TENANT_IDS: canal.tenantId,
    META_INBOX_RECEPCION_ENABLED: 'true',
    META_INBOX_LECTURA_ENABLED: 'true',
    META_APP_ID: '111',
    META_APP_SECRET: 'ficticio',
    META_EMBEDDED_SIGNUP_CONFIG_ID: '222',
  });
  client.metadata.mockResolvedValue(metadata);
  client.descargar.mockResolvedValue(bytes);
  storage.subir.mockResolvedValue(undefined);
  storage.firmarDescarga.mockResolvedValue(
    'https://files.example.invalid/privado',
  );
  capacidades.exigirIncluida.mockResolvedValue(undefined);
  capacidades.exigirOperacionTx.mockResolvedValue(undefined);
  api = service();
});
afterEach(async () => {
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockRestore();
  const where = { tenantId: { in: tenants } };
  await db.inboxAdjunto.deleteMany({ where });
  await db.archivo.deleteMany({ where });
  await db.inboxMensaje.deleteMany({ where });
  await db.inboxConversacion.deleteMany({ where });
  await db.inboxCanalRevision.deleteMany({ where });
  await db.metaVinculo.deleteMany({ where });
  await db.tenant.deleteMany({ where: { id: { in: tenants } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  tenants.length = 0;
  users.length = 0;
});
afterAll(async () => {
  await db.$disconnect();
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
it('copia privada, contabilizada una vez, lectura sin credenciales', async () => {
  const m = await mensaje();
  expect(await api.procesarSiguiente()).toBe(true);
  const j = await trabajo(m.id);
  expect(j.estado).toBe('LISTO');
  expect(j.archivo).toMatchObject({
    scope: 'INBOX',
    publico: false,
    generado: true,
    bytesReservados: 0n,
  });
  expect(await usado()).toBe(BigInt(bytes.length));
  expect(await api.procesarSiguiente()).toBe(false);
  expect(client.descargar).toHaveBeenCalledTimes(1);
  const r = await runWithTenant(auth.tenantId, () =>
    api.abrir(auth, '127.0.0.1', m.id),
  );
  expect(r.nombre).toBe('Pedido.pdf');
  expect(r.expiraEn).toBe(60);
  const [, opciones] = storage.firmarDescarga.mock.calls[0] as [
    string,
    { disposition: string },
  ];
  expect(opciones.disposition.startsWith('attachment;')).toBe(true);
  expect(JSON.stringify(r)).not.toMatch(/token|mediaId|lookaside/);
  expect(bus.avisar).toHaveBeenCalled();
});
it('aisla empresas y bloquea las rutas generales de archivos', async () => {
  const m = await mensaje();
  await api.procesarSiguiente();
  await expect(
    runWithTenant(ajena.tenantId, () => api.abrir(ajena, '127.0.0.1', m.id)),
  ).rejects.toBeInstanceOf(NotFoundException);
  const j = await trabajo(m.id),
    archivos = new ArchivosService(db, storage as never, {} as never);
  await expect(
    runWithTenant(auth.tenantId, () => archivos.urlDeDescarga(j.archivoId!)),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(storage.firmarDescarga).not.toHaveBeenCalled();
});
it('bloquea impersonación, MCP, plataforma y sesión revocada', async () => {
  const m = await mensaje();
  await api.procesarSiguiente();
  for (const mod of [
    { esPlataforma: true },
    { mcp: {} },
    { impersonacion: {} },
  ])
    await expect(
      api.abrir({ ...auth, ...mod } as CurrentAuth, '127.0.0.1', m.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  await db.authSession.update({
    where: { id: auth.sessionId },
    data: { revokedAt: new Date() },
  });
  await expect(api.abrir(auth, '127.0.0.1', m.id)).rejects.toBeInstanceOf(
    ForbiddenException,
  );
});
it('revalida después de firmar', async () => {
  const m = await mensaje();
  await api.procesarSiguiente();
  storage.firmarDescarga.mockImplementationOnce(async () => {
    await db.authSession.update({
      where: { id: auth.sessionId },
      data: { revokedAt: new Date() },
    });
    return 'https://files.example.invalid/no-entregar';
  });
  await expect(api.abrir(auth, '127.0.0.1', m.id)).rejects.toBeInstanceOf(
    ForbiddenException,
  );
});
it('no descarga sin espacio ni deja reservas', async () => {
  await db.tenant.update({
    where: { id: canal.tenantId },
    data: { cuotaBytesArchivos: 1n },
  });
  const m = await mensaje();
  await api.procesarSiguiente();
  expect(client.descargar).not.toHaveBeenCalled();
  expect((await trabajo(m.id)).estado).toBe('REVISION');
  expect(await usado()).toBe(0n);
});
it.each(['canal', 'mensaje'])(
  'no publica si se revoca %s durante la descarga',
  async (cual) => {
    const m = await mensaje();
    client.descargar.mockImplementationOnce(async () => {
      if (cual === 'canal')
        await db.metaVinculo.update({
          where: { id: canal.id },
          data: { estado: 'DESCONECTADO' },
        });
      else
        await db.inboxMensaje.update({
          where: { id: m.id },
          data: { revocadoEl: new Date() },
        });
      return bytes;
    });
    await api.procesarSiguiente();
    expect((await trabajo(m.id)).estado).toBe('NO_DISPONIBLE');
    expect((await trabajo(m.id)).archivoId).toBeNull();
    expect(await usado()).toBe(0n);
  },
);
it('retira copia y cuota al eliminar el mensaje', async () => {
  const m = await mensaje();
  await api.procesarSiguiente();
  await db.inboxMensaje.update({
    where: { id: m.id },
    data: { revocadoEl: new Date() },
  });
  await db.$transaction((tx) => encolarAdjunto(tx, canal, m.wamid));
  await api.procesarSiguiente();
  expect((await trabajo(m.id)).estado).toBe('RETIRADO');
  expect(await usado()).toBe(0n);
  await expect(api.abrir(auth, '127.0.0.1', m.id)).rejects.toBeInstanceOf(
    NotFoundException,
  );
});
it('excluye descargas concurrentes entre instancias', async () => {
  const m = await mensaje();
  let resolver!: () => void, empezado!: () => void;
  const espera = new Promise<void>((r) => {
      resolver = r;
    }),
    inicio = new Promise<void>((r) => {
      empezado = r;
    });
  client.descargar.mockImplementationOnce(async () => {
    empezado();
    await espera;
    return bytes;
  });
  const primera = api.procesarSiguiente();
  await inicio;
  try {
    expect(await service().procesarSiguiente()).toBe(false);
  } finally {
    resolver();
  }
  await primera;
  expect(client.descargar).toHaveBeenCalledTimes(1);
  expect((await trabajo(m.id)).estado).toBe('LISTO');
  expect(await usado()).toBe(BigInt(bytes.length));
});
it('pausa sin consumir intentos', async () => {
  const m = await mensaje();
  await db.metaVinculo.update({
    where: { id: canal.id },
    data: { estado: 'SUSPENDIDO' },
  });
  await api.procesarSiguiente();
  expect((await trabajo(m.id)).intentos).toBe(0);
  expect(client.metadata).not.toHaveBeenCalled();
});
it('limita fallas transitorias', async () => {
  const m = await mensaje();
  client.descargar.mockRejectedValue(new ErrorMediaMeta('TEMPORAL'));
  for (let i = 0; i < 4; i++) {
    await db.inboxAdjunto.update({
      where: { mensajeId: m.id },
      data: { proximoIntentoEl: new Date(0) },
    });
    await api.procesarSiguiente();
  }
  expect((await trabajo(m.id)).estado).toBe('REVISION');
  expect(await usado()).toBe(0n);
  expect(await api.procesarSiguiente()).toBe(false);
});
it('recupera una ejecución interrumpida', async () => {
  const m = await mensaje();
  await db.inboxAdjunto.update({
    where: { mensajeId: m.id },
    data: {
      estado: 'DESCARGANDO',
      bloqueoId: randomUUID(),
      bloqueoHasta: new Date(0),
      intentos: 1,
    },
  });
  await api.procesarSiguiente();
  expect((await trabajo(m.id)).estado).toBe('LISTO');
  expect(await usado()).toBe(BigInt(bytes.length));
});
it('no usa red con el flag apagado', async () => {
  await mensaje();
  process.env.META_INBOX_ADJUNTOS_ENABLED = 'false';
  expect(await api.procesarSiguiente()).toBe(false);
  expect(client.metadata).not.toHaveBeenCalled();
});
it('la base también impide cruces de empresa', async () => {
  const m = await mensaje(),
    j = await trabajo(m.id);
  await expect(
    db.inboxAdjunto.update({
      where: { id: j.id },
      data: { tenantId: ajena.tenantId },
    }),
  ).rejects.toThrow();
  const f = await db.archivo.create({
    data: {
      tenantId: ajena.tenantId,
      scope: 'INBOX',
      generado: true,
      key: randomUUID(),
      nombreOriginal: 'a.pdf',
      mimeType: 'application/pdf',
    },
  });
  await expect(
    db.inboxAdjunto.update({ where: { id: j.id }, data: { archivoId: f.id } }),
  ).rejects.toThrow();
});

it('copia un adjunto del destinatario de prueba sin coexistencia y bloquea otro contacto', async () => {
  canal = await db.metaVinculo.update({
    where: { id: canal.id },
    data: {
      tipo: 'PRUEBA',
      wabaId: '200001',
      phoneNumberId: '300001',
      pruebaDestinatarioWaId: '16505550123',
      pruebaDestinoE164: '+16505550123',
      tokenVenceEl: new Date(Date.now() + 60000),
    },
  });
  Object.assign(process.env, {
    GRAFO_DEPLOY_ENV: 'staging',
    META_INBOX_PRUEBA_ENABLED: 'true',
    META_INBOX_PRUEBA_TENANT_ID: canal.tenantId,
    META_INBOX_PRUEBA_WABA_ID: canal.wabaId,
    META_INBOX_PRUEBA_PHONE_NUMBER_ID: canal.phoneNumberId,
    META_INBOX_PRUEBA_DESTINATARIO_WA_ID: '16505550123',
    META_INBOX_PRUEBA_DESTINO_E164: '+16505550123',
    META_CONEXION_MODO: '',
    META_CONEXION_TENANT_IDS: '',
    META_EMBEDDED_SIGNUP_CONFIG_ID: '',
  });
  for (const waId of ['16505550123', '16505550199']) {
    const conv = await db.inboxConversacion.create({
      data: {
        tenantId: canal.tenantId,
        vinculoId: canal.id,
        contactoWaId: waId,
      },
    });
    const m = await mensaje();
    await db.inboxMensaje.update({
      where: { id: m.id },
      data: { conversacionId: conv.id },
    });
    expect(await api.procesarSiguiente()).toBe(waId === '16505550123');
    expect((await trabajo(m.id)).estado).toBe(
      waId === '16505550123' ? 'LISTO' : 'RETIRADO',
    );
  }
  expect(client.descargar).toHaveBeenCalledTimes(1);
  expect(storage.subir).toHaveBeenCalledTimes(1);
});
