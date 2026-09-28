import { MetaAltaService } from './meta-alta.service';
import { aplicarCambioCuenta } from './inbox/meta-inbox-cuenta';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { RolSistema } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import { runWithTenant } from '../../common/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { bloquearCupoUsuarios } from '../../suscripciones/cupos-usuarios';
import {
  SecretosService,
  type SecretoCifrado,
} from '../cripto/secretos.service';
import {
  ErrorConexionMeta,
  type ActivosMetaVerificados,
} from './meta-conexion.client';
import { MetaConexionService } from './meta-conexion.service';

// Nunca saltar silenciosamente a desarrollo ni tocar datos existentes.
const url = new URL(process.env.DATABASE_URL!);
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  !url.pathname.endsWith('_test')
)
  throw new Error('Esta prueba requiere PostgreSQL local *_test.');
const db = new PrismaService();
const clavesEnv = [
  'META_APP_ID',
  'META_APP_SECRET',
  'META_EMBEDDED_SIGNUP_CONFIG_ID',
  'META_GRAPH_API_VERSION',
  'INTEGRACIONES_ENCRYPTION_KEY',
  'META_WHATSAPP_PILOT_ENABLED',
  'META_CONEXION_MODO',
  'META_SANDBOX_WABA_ID',
  'META_CONEXION_TENANT_IDS',
  'META_INBOX_RECEPCION_ENABLED',
] as const;
const envAntes = Object.fromEntries(clavesEnv.map((k) => [k, process.env[k]]));
const fetchOriginal = global.fetch;
const ip = '127.0.0.1';
let auth: CurrentAuth,
  otra: CurrentAuth,
  secretos: SecretosService,
  service: MetaConexionService;
let altas: MetaAltaService;
let client: {
  canjear: jest.Mock;
  verificar: jest.Mock;
  verificarSandbox: jest.Mock;
  suscribir: jest.Mock;
  sincronizar: jest.Mock;
};
let capacidadPermitida: boolean;
const tenants: string[] = [],
  usuarios: string[] = [];
const activos = (): ActivosMetaVerificados => ({
  wabaId: `21${Date.now()}`,
  phoneNumberId: `31${Date.now()}`,
  numero: '+16505550123',
  nombreVerificado: 'Imprenta ficticia',
  tokenVenceEl: new Date(Date.now() + 3600000),
  accesoDatosVenceEl: null,
});
const enEmpresa = <T>(a: CurrentAuth, fn: () => Promise<T>) =>
  runWithTenant(a.tenantId, fn);
const preparar = (a = auth) => enEmpresa(a, () => service.preparar(a, ip));
const canjear = async (a = auth) => {
  const intento = await preparar(a);
  await enEmpresa(a, () => service.canjear(a, ip, intento, 'codigo-sintetico'));
  return intento;
};
const crearUsuario = async (): Promise<CurrentAuth> => {
  const tenantId = randomUUID(),
    userId = randomUUID();
  tenants.push(tenantId);
  usuarios.push(userId);
  await db.tenant.create({
    data: {
      id: tenantId,
      nombre: 'Ensayo Meta aislado',
      slug: `meta-ensayo-${tenantId}`,
    },
  });
  await db.user.create({
    data: {
      id: userId,
      email: `${userId}@example.invalid`,
      nombreCompleto: 'Operador ficticio',
    },
  });
  const member = await db.membership.create({
    data: { tenantId, userId, rol: RolSistema.ADMINISTRADOR },
  });
  const sesion = await db.authSession.create({
    data: {
      userId,
      currentTenantId: tenantId,
      currentMembershipId: member.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  return {
    tenantId,
    userId,
    membershipId: member.id,
    sessionId: sesion.id,
    role: RolSistema.ADMINISTRADOR,
    email: `${userId}@example.invalid`,
  };
};
function diferida<T>() {
  let resolver!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promise, resolver };
}
beforeAll(async () => {
  await db.$connect();
  global.fetch = jest
    .fn()
    .mockRejectedValue(new Error('Prohibidas llamadas reales en este ensayo'));
  Object.assign(process.env, {
    META_APP_ID: '100001',
    META_APP_SECRET: 'secreto-sintetico',
    META_EMBEDDED_SIGNUP_CONFIG_ID: '100002',
    META_GRAPH_API_VERSION: 'v26.0',
    INTEGRACIONES_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    META_WHATSAPP_PILOT_ENABLED: 'false',
  });
  secretos = new SecretosService();
  secretos.onModuleInit();
});
beforeEach(async () => {
  process.env.META_CONEXION_MODO = '';
  process.env.META_SANDBOX_WABA_ID = '200001';
  process.env.META_CONEXION_TENANT_IDS = '';
  process.env.META_INBOX_RECEPCION_ENABLED = 'false';
  auth = await crearUsuario();
  otra = await crearUsuario();
  capacidadPermitida = true;
  client = {
    verificarSandbox: jest.fn().mockResolvedValue(undefined),
    suscribir: jest.fn().mockResolvedValue(undefined),
    sincronizar: jest
      .fn()
      .mockImplementation((_c, _t, _p, tipo) =>
        Promise.resolve(`solicitud-${tipo}`),
      ),
    canjear: jest.fn().mockResolvedValue('token-sintetico-de-cliente'),
    verificar: jest.fn().mockImplementation(() => Promise.resolve(activos())),
  };
  // Capacidad controlada por el ensayo; lock real compartido con el servicio
  // de suscripciones. El resto (sesión, membresía, cifrado, unicidad) es real.
  const capacidades = {
    puedeOperar: async () => capacidadPermitida,
    exigirOperacionTx: async (tx, tenantId) => {
      await bloquearCupoUsuarios(tx, tenantId);
      if (!capacidadPermitida) throw new ForbiddenException();
    },
  } as CapacidadesEmpresaService;
  service = new MetaConexionService(db, secretos, client as never, capacidades);
  altas = new MetaAltaService(db, secretos, client as never, capacidades);
});
afterEach(async () => {
  await db.metaAlta.deleteMany({ where: { tenantId: { in: tenants } } });
  await db.metaVinculo.deleteMany({ where: { tenantId: { in: tenants } } });
  await db.tenant.deleteMany({ where: { id: { in: tenants } } });
  await db.user.deleteMany({ where: { id: { in: usuarios } } });
  tenants.length = 0;
  usuarios.length = 0;
});
afterAll(async () => {
  await db.$disconnect();
  global.fetch = fetchOriginal;
  for (const key of clavesEnv) {
    if (envAntes[key] === undefined) delete process.env[key];
    else process.env[key] = envAntes[key];
  }
});

it('guarda hash y token cifrado; la respuesta no contiene credenciales', async () => {
  const intento = await canjear();
  const fila = await db.metaAutorizacion.findUniqueOrThrow({
    where: { id: intento.id },
  });
  expect(fila.estadoHash).not.toBe(intento.estadoSecreto);
  expect(fila.estadoHash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(fila)).not.toContain('codigo-sintetico');
  expect(JSON.stringify(fila)).not.toContain('token-sintetico-de-cliente');
  expect(secretos.descifrar(fila.tokenCifrado as SecretoCifrado)).toBe(
    'token-sintetico-de-cliente',
  );
  const estado = await enEmpresa(auth, () =>
    service.consultar(auth, ip, intento),
  );
  expect(Object.keys(estado).sort()).toEqual([
    'estado',
    'falloCodigo',
    'id',
    'modo',
    'venceEl',
    'verificadaEl',
  ]);
});
it('dos canjes concurrentes consumen el código una sola vez', async () => {
  const intento = await preparar();
  await Promise.all(
    [1, 2, 3].map(() =>
      enEmpresa(auth, () => service.canjear(auth, ip, intento, 'codigo')),
    ),
  );
  expect(client.canjear).toHaveBeenCalledTimes(1);
  expect((await service.consultar(auth, ip, intento)).estado).toBe('CANJEADA');
});
it('un timeout no reintenta el código ni expone el error original', async () => {
  const intento = await preparar();
  client.canjear.mockRejectedValueOnce(
    new ErrorConexionMeta('RESPUESTA_INCIERTA'),
  );
  expect(await service.canjear(auth, ip, intento, 'codigo')).toMatchObject({
    estado: 'REINICIAR',
    falloCodigo: 'RESPUESTA_INCIERTA',
  });
  await service.canjear(auth, ip, intento, 'codigo');
  expect(client.canjear).toHaveBeenCalledTimes(1);
});
it('otra empresa, usuario, sesión o secreto no pueden consumir el intento', async () => {
  const intento = await preparar();
  await expect(
    enEmpresa(otra, () => service.canjear(otra, ip, intento, 'codigo')),
  ).rejects.toBeInstanceOf(NotFoundException);
  const otraSesion = await db.authSession.create({
    data: {
      userId: auth.userId,
      currentTenantId: auth.tenantId,
      currentMembershipId: auth.membershipId,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  await expect(
    service.canjear(
      { ...auth, sessionId: otraSesion.id },
      ip,
      intento,
      'codigo',
    ),
  ).rejects.toBeInstanceOf(NotFoundException);
  await expect(
    service.canjear(
      auth,
      ip,
      { ...intento, estadoSecreto: randomBytes(32).toString('base64url') },
      'codigo',
    ),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(client.canjear).not.toHaveBeenCalled();
});
it('vence el intento, borra su token y no inicia la verificación', async () => {
  const intento = await canjear();
  await db.metaAutorizacion.update({
    where: { id: intento.id },
    data: { venceEl: new Date(0) },
  });
  expect(
    await service.verificar(auth, ip, intento, { wabaId: '21' }),
  ).toMatchObject({ estado: 'REINICIAR', falloCodigo: 'INTENTO_VENCIDO' });
  expect(client.verificar).not.toHaveBeenCalled();
  expect(
    (await db.metaAutorizacion.findUniqueOrThrow({ where: { id: intento.id } }))
      .tokenCifrado,
  ).toBeNull();
});
it('cancelar durante el canje impide que la respuesta tardía guarde el token', async () => {
  const intento = await preparar(),
    entro = diferida<void>(),
    red = diferida<string>();
  client.canjear.mockImplementationOnce(() => {
    entro.resolver();
    return red.promise;
  });
  const enviando = service.canjear(auth, ip, intento, 'codigo');
  await entro.promise;
  await service.cancelar(auth, ip, intento);
  red.resolver('token-tardio');
  expect((await enviando).estado).toBe('CANCELADA');
  expect(
    (await db.metaAutorizacion.findUniqueOrThrow({ where: { id: intento.id } }))
      .tokenCifrado,
  ).toBeNull();
});
it('crear otro intento invalida el anterior incluso mientras Meta responde', async () => {
  const intento = await preparar(),
    entro = diferida<void>(),
    red = diferida<string>();
  client.canjear.mockImplementationOnce(() => {
    entro.resolver();
    return red.promise;
  });
  const enviando = service.canjear(auth, ip, intento, 'codigo');
  await entro.promise;
  const nuevo = await preparar();
  red.resolver('token-tardio');
  expect((await enviando).estado).toBe('CANCELADA');
  expect((await service.consultar(auth, ip, nuevo)).estado).toBe('PREPARADA');
});
it('sólo un intento queda preparado ante dos pestañas simultáneas', async () => {
  await Promise.all([preparar(), preparar()]);
  expect(
    await db.metaAutorizacion.count({
      where: { tenantId: auth.tenantId, estado: 'PREPARADA' },
    }),
  ).toBe(1);
});
it('confirmar dos veces guarda un vínculo y no activa mensajes ni historial', async () => {
  const intento = await canjear();
  await Promise.all(
    [1, 2].map(() =>
      enEmpresa(auth, () =>
        service.verificar(auth, ip, intento, { wabaId: '21' }),
      ),
    ),
  );
  const vinculo = await db.metaVinculo.findFirstOrThrow({
    where: { tenantId: auth.tenantId },
  });
  expect(vinculo.estado).toBe('VERIFICADO');
  expect(client.verificar).toHaveBeenCalledTimes(1);
  expect(
    (await db.metaAutorizacion.findUniqueOrThrow({ where: { id: intento.id } }))
      .tokenCifrado,
  ).toBeNull();
  expect(
    await db.integracionTenant.count({
      where: { tenantId: auth.tenantId, proveedor: 'META_WHATSAPP' },
    }),
  ).toBe(0);
  expect(global.fetch).not.toHaveBeenCalled();
});
it('dos empresas compitiendo por los mismos activos nunca comparten la vinculación', async () => {
  const uno = await canjear(auth),
    dos = await canjear(otra),
    asset = activos();
  client.verificar.mockResolvedValue(asset);
  const resultados = await Promise.all([
    enEmpresa(auth, () =>
      service.verificar(auth, ip, uno, { wabaId: asset.wabaId }),
    ),
    enEmpresa(otra, () =>
      service.verificar(otra, ip, dos, { wabaId: asset.wabaId }),
    ),
  ]);
  expect(resultados.map((x) => x.estado).sort()).toEqual([
    'REINICIAR',
    'VERIFICADA',
  ]);
  expect(resultados.find((x) => x.estado === 'REINICIAR')?.falloCodigo).toBe(
    'ASOCIACION_NO_DISPONIBLE',
  );
  expect(await db.metaVinculo.count({ where: { wabaId: asset.wabaId } })).toBe(
    1,
  );
});
it('desconectar borra la credencial pero conserva la propiedad del número', async () => {
  const intento = await canjear(),
    asset = activos();
  client.verificar.mockResolvedValue(asset);
  await service.verificar(auth, ip, intento, { wabaId: asset.wabaId });
  capacidadPermitida = false;
  await service.descartarVinculoPreparado(auth, ip);
  expect(
    await db.metaVinculo.findFirst({ where: { tenantId: auth.tenantId } }),
  ).toMatchObject({ estado: 'DESCONECTADO', tokenCifrado: null });
  capacidadPermitida = true;
  const ajeno = await canjear(otra);
  expect(
    (
      await enEmpresa(otra, () =>
        service.verificar(otra, ip, ajeno, { wabaId: asset.wabaId }),
      )
    ).estado,
  ).toBe('REINICIAR');
});
it('puede renovar el mismo vínculo, sin permitir cambiar silenciosamente de número', async () => {
  const intento = await canjear(),
    asset = activos();
  client.verificar.mockResolvedValue(asset);
  await service.verificar(auth, ip, intento, { wabaId: asset.wabaId });
  const otraAutorizacion = await canjear();
  expect(
    (
      await service.verificar(auth, ip, otraAutorizacion, {
        wabaId: asset.wabaId,
      })
    ).estado,
  ).toBe('VERIFICADA');
  const cambio = await canjear();
  client.verificar.mockResolvedValue({ ...asset, phoneNumberId: '99999999' });
  expect(
    (await service.verificar(auth, ip, cambio, { wabaId: asset.wabaId }))
      .estado,
  ).toBe('REINICIAR');
  expect(
    (
      await db.metaVinculo.findFirstOrThrow({
        where: { tenantId: auth.tenantId },
      })
    ).phoneNumberId,
  ).toBe(asset.phoneNumberId);
});
it('cancelar durante la comprobación no deja una asociación creada', async () => {
  const intento = await canjear(),
    entro = diferida<void>(),
    red = diferida<ActivosMetaVerificados>();
  client.verificar.mockImplementationOnce(() => {
    entro.resolver();
    return red.promise;
  });
  const verificando = service.verificar(auth, ip, intento, { wabaId: '21' });
  await entro.promise;
  await service.cancelar(auth, ip, intento);
  red.resolver(activos());
  expect((await verificando).estado).toBe('CANCELADA');
  expect(
    await db.metaVinculo.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(0);
});
it('no asocia una cuenta registrada por el mecanismo anterior en otra empresa', async () => {
  const intento = await canjear(),
    asset = activos();
  client.verificar.mockResolvedValue(asset);
  await db.integracionTenant.create({
    data: {
      tenantId: otra.tenantId,
      proveedor: 'META_WHATSAPP',
      estado: 'CONECTADA',
      metadataJson: {
        wabaId: asset.wabaId,
        phoneNumberId: asset.phoneNumberId,
      },
    },
  });
  expect(
    (
      await enEmpresa(auth, () =>
        service.verificar(auth, ip, intento, { wabaId: asset.wabaId }),
      )
    ).estado,
  ).toBe('REINICIAR');
});
it.each([
  'sesion',
  'miembro',
  'usuario',
  'empresa',
  'password',
  'rol',
  'ip',
  'plan',
])('revalida %s antes de conservar la respuesta de Meta', async (caso) => {
  const intento = await preparar();
  client.canjear.mockImplementationOnce(async () => {
    if (caso === 'sesion')
      await db.authSession.update({
        where: { id: auth.sessionId },
        data: { revokedAt: new Date() },
      });
    if (caso === 'miembro')
      await db.membership.update({
        where: { id: auth.membershipId },
        data: { activa: false },
      });
    if (caso === 'usuario')
      await db.user.update({
        where: { id: auth.userId },
        data: { activo: false },
      });
    if (caso === 'empresa')
      await db.authSession.update({
        where: { id: auth.sessionId },
        data: { currentTenantId: otra.tenantId },
      });
    if (caso === 'password')
      await db.user.update({
        where: { id: auth.userId },
        data: { debeCambiarPassword: true },
      });
    if (caso === 'rol')
      await db.membership.update({
        where: { id: auth.membershipId },
        data: { rol: RolSistema.OPERADOR },
      });
    if (caso === 'ip')
      await db.membership.update({
        where: { id: auth.membershipId },
        data: { ipsPermitidas: ['192.0.2.1'] },
      });
    if (caso === 'plan') capacidadPermitida = false;
    return 'token-que-no-se-debe-guardar';
  });
  if (caso === 'plan')
    expect((await service.canjear(auth, ip, intento, 'codigo')).estado).toBe(
      'REINICIAR',
    );
  else
    await expect(
      service.canjear(auth, ip, intento, 'codigo'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  expect(
    (await db.metaAutorizacion.findUniqueOrThrow({ where: { id: intento.id } }))
      .tokenCifrado,
  ).toBeNull();
});
it.each([{ mcp: {} }, { impersonacion: {} }, { esPlataforma: true }])(
  'rechaza accesos no humanos de la empresa: %j',
  async (extra) => {
    await expect(
      service.preparar({ ...auth, ...extra } as CurrentAuth, ip),
    ).rejects.toBeInstanceOf(ForbiddenException);
  },
);

it('un rol personalizado sin gestionar configuración no puede preparar el alta', async () => {
  const rol = await db.rol.create({
    data: {
      tenantId: auth.tenantId,
      nombre: 'Sólo lectura',
      permisos: ['configuracion.ver'],
    },
  });
  await db.membership.update({
    where: { id: auth.membershipId },
    data: { rolId: rol.id },
  });
  await expect(preparar()).rejects.toBeInstanceOf(ForbiddenException);
  expect(
    await db.metaAutorizacion.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(0);
});

it('no prepara el intento cuando el plan no permite operar con WhatsApp', async () => {
  capacidadPermitida = false;
  await expect(preparar()).rejects.toBeInstanceOf(ForbiddenException);
  expect(
    await db.metaAutorizacion.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(0);
});

it('un token vencido durante la comprobación nunca queda como vínculo verificado', async () => {
  const intento = await canjear();
  client.verificar.mockResolvedValue({
    ...activos(),
    tokenVenceEl: new Date(0),
  });
  expect(
    await service.verificar(auth, ip, intento, { wabaId: '21' }),
  ).toMatchObject({ estado: 'REINICIAR', falloCodigo: 'TOKEN_INVALIDO' });
  expect(
    await db.metaVinculo.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(0);
});

async function altaRealPreparada() {
  process.env.META_CONEXION_MODO = 'coexistencia';
  process.env.META_CONEXION_TENANT_IDS = auth.tenantId;
  process.env.META_INBOX_RECEPCION_ENABLED = 'true';
  const intento = await canjear();
  await enEmpresa(auth, () =>
    service.verificar(auth, ip, intento, { wabaId: '200001' }),
  );
  return db.metaAlta.findUniqueOrThrow({
    where: { autorizacionId: intento.id },
  });
}
it('una pausa o descarte local no habilitan otra alta; la retirada confirmada por Meta sí', async () => {
  client.verificar.mockResolvedValue(activos());
  const alta = await altaRealPreparada();
  await db.metaVinculo.update({
    where: { id: alta.vinculoId },
    data: { estado: 'SUSPENDIDO', ultimoEventoCuenta: 'ACCOUNT_OFFBOARDED' },
  });
  expect((await service.estado(auth, ip)).disponible).toBe(false);
  await expect(preparar()).rejects.toThrow('conexión existente');
  await service.descartarVinculoPreparado(auth, ip);
  expect((await service.estado(auth, ip)).disponible).toBe(false);
  await expect(preparar()).rejects.toThrow('conexión existente');
  await db.metaVinculo.update({
    where: { id: alta.vinculoId },
    data: { ultimoEventoCuenta: 'PARTNER_REMOVED' },
  });
  const estado = await service.estado(auth, ip);
  expect(estado.disponible).toBe(true);
  expect(estado.canal?.reconexionPermitida).toBe(true);
  const nuevo = await canjear();
  await service.verificar(auth, ip, nuevo, { wabaId: '200001' });
  expect(
    await db.metaVinculo.findUnique({ where: { id: alta.vinculoId } }),
  ).toMatchObject({
    estado: 'VERIFICADO',
    autorizacionId: nuevo.id,
    ultimoEventoCuenta: null,
  });
  expect(await db.metaAlta.count({ where: { tenantId: auth.tenantId } })).toBe(
    2,
  );
  expect((await service.estado(auth, ip)).canal?.resumen?.estado).toBe(
    'PREPARANDO',
  );
});
it('pausar y reconectar mientras un POST está en vuelo no repite ni avanza una solicitud incierta', async () => {
  const alta = await altaRealPreparada();
  client.suscribir.mockImplementationOnce(async () => {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "MetaVinculo" WHERE id = ${alta.vinculoId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR NO KEY UPDATE`;
      const canal = await tx.metaVinculo.findFirstOrThrow({
        where: { id: alta.vinculoId, tenantId: auth.tenantId },
      });
      const t = Math.floor(Date.now() / 1000) * 1000;
      await aplicarCambioCuenta(tx, canal, {
        clase: 'cuenta',
        evento: 'ACCOUNT_OFFBOARDED',
        fecha: new Date(t),
        numero: null,
      });
      await aplicarCambioCuenta(tx, canal, {
        clase: 'cuenta',
        evento: 'ACCOUNT_RECONNECTED',
        fecha: new Date(t + 1000),
        numero: null,
      });
    });
  });
  await altas.procesarSiguiente();
  expect(
    await db.metaAlta.findUnique({ where: { id: alta.id } }),
  ).toMatchObject({
    estado: 'REVISION',
    falloCodigo: 'ALTA_INTERRUMPIDA_POR_CUENTA',
  });
  expect(await altas.procesarSiguiente()).toBe(false);
  expect(client.sincronizar).not.toHaveBeenCalled();
  expect(client.suscribir).toHaveBeenCalledTimes(1);
});
it('sandbox verifica autorización sin vínculo, credencial retenida ni trabajo posterior', async () => {
  process.env.META_CONEXION_MODO = 'sandbox';
  process.env.META_CONEXION_TENANT_IDS = auth.tenantId;
  const intento = await canjear();
  expect(intento.modo).toBe('SANDBOX');
  await service.verificar(auth, ip, intento, { wabaId: '200001' });
  expect(client.verificarSandbox).toHaveBeenCalledTimes(1);
  expect(client.verificarSandbox).toHaveBeenCalledWith(
    expect.objectContaining({ sandboxWabaId: '200001' }),
    expect.any(String),
    '200001',
  );
  expect(client.verificar).not.toHaveBeenCalled();
  expect(
    await db.metaVinculo.count({ where: { tenantId: auth.tenantId } }),
  ).toBe(0);
  expect(await db.metaAlta.count({ where: { tenantId: auth.tenantId } })).toBe(
    0,
  );
  expect(
    (await db.metaAutorizacion.findUniqueOrThrow({ where: { id: intento.id } }))
      .tokenCifrado,
  ).toBeNull();
  const estado = await service.estado(auth, ip);
  expect(estado.sandboxVerificadoEl).toBeInstanceOf(Date);
  expect(estado.canal).toBeNull();
  expect(await altas.procesarSiguiente()).toBe(false);
  expect(client.suscribir).not.toHaveBeenCalled();
});
it('agenda atómicamente; tres workers no repiten suscripción, contactos ni historial', async () => {
  const alta = await altaRealPreparada();
  const detenida = diferida<void>();
  client.suscribir.mockImplementationOnce(async () => {
    const v = await db.metaVinculo.findUniqueOrThrow({
      where: { id: alta.vinculoId },
    });
    expect(v.recepcionDesdeEl).toBeInstanceOf(Date);
    await detenida.promise;
  });
  const primero = altas.procesarSiguiente();
  while (!client.suscribir.mock.calls.length)
    await new Promise((r) => setTimeout(r, 10));
  expect(await altas.procesarSiguiente()).toBe(false);
  detenida.resolver();
  await primero;
  await Promise.all([
    altas.procesarSiguiente(),
    altas.procesarSiguiente(),
    altas.procesarSiguiente(),
  ]);
  while (await altas.procesarSiguiente()) {
    /* agotar pasos pendientes */
  }
  expect(client.suscribir).toHaveBeenCalledTimes(1);
  expect(client.sincronizar.mock.calls.map((c) => c[3])).toEqual([
    'smb_app_state_sync',
    'history',
  ]);
  expect(
    await db.metaAlta.findUniqueOrThrow({ where: { id: alta.id } }),
  ).toMatchObject({
    estado: 'SOLICITUDES_COMPLETADAS',
    contactosRequestId: 'solicitud-smb_app_state_sync',
    historialRequestId: 'solicitud-history',
  });
  // Solicitudes aceptadas no inventan una importación finalizada.
  const estado = await service.estado(auth, ip);
  expect(estado.canal?.importacion).toBeNull();
  expect(estado.disponible).toBe(false);
  expect(JSON.stringify(estado)).not.toContain('token-sintetico');
  expect((await service.estado(otra, ip)).canal).toBeNull();
  await expect(preparar()).rejects.toThrow('conexión existente');
});
it.each([
  'SUSCRIBIENDO',
  'SOLICITANDO_CONTACTOS',
  'SOLICITANDO_HISTORIAL',
] as const)(
  'un reinicio durante %s exige revisión; no vuelve a hacer POST',
  async (estado) => {
    const alta = await altaRealPreparada();
    await db.metaAlta.update({
      where: { id: alta.id },
      data: { estado, pasoIniciadoEl: new Date(Date.now() - 180000) },
    });
    expect(await altas.procesarSiguiente()).toBe(true);
    expect(await altas.procesarSiguiente()).toBe(false);
    expect(client.suscribir).not.toHaveBeenCalled();
    expect(client.sincronizar).not.toHaveBeenCalled();
    expect(
      await db.metaAlta.findUniqueOrThrow({ where: { id: alta.id } }),
    ).toMatchObject({ estado: 'REVISION', falloCodigo: 'RESPUESTA_INCIERTA' });
  },
);
it('un timeout al solicitar historial no lo solicita de nuevo', async () => {
  const alta = await altaRealPreparada();
  await altas.procesarSiguiente();
  await altas.procesarSiguiente();
  client.sincronizar.mockRejectedValueOnce(
    new ErrorConexionMeta('RESPUESTA_INCIERTA'),
  );
  await altas.procesarSiguiente();
  await altas.procesarSiguiente();
  expect(client.sincronizar).toHaveBeenCalledTimes(2);
  expect(
    await db.metaAlta.findUniqueOrThrow({ where: { id: alta.id } }),
  ).toMatchObject({ estado: 'REVISION', falloCodigo: 'RESPUESTA_INCIERTA' });
});
it.each([
  'vencido',
  'plan',
  'desconectado',
  'generacion',
  'credencial',
  'configuracion',
  'fuera-lista',
  'apagado',
])('detiene el alta: %s', async (caso) => {
  const alta = await altaRealPreparada();
  if (caso === 'vencido')
    await db.metaAlta.update({
      where: { id: alta.id },
      data: { venceEl: new Date(0) },
    });
  if (caso === 'plan') capacidadPermitida = false;
  if (caso === 'desconectado')
    await service.descartarVinculoPreparado(auth, ip);
  if (caso === 'generacion')
    await db.metaVinculo.update({
      where: { id: alta.vinculoId },
      data: { autorizacionId: randomUUID() },
    });
  if (caso === 'credencial')
    await db.metaVinculo.update({
      where: { id: alta.vinculoId },
      data: { tokenCifrado: { invalido: true } },
    });
  if (caso === 'configuracion') process.env.META_APP_ID = '999001';
  if (caso === 'fuera-lista')
    process.env.META_CONEXION_TENANT_IDS = otra.tenantId;
  if (caso === 'apagado') process.env.META_INBOX_RECEPCION_ENABLED = 'false';
  try {
    await altas.procesarSiguiente();
  } finally {
    process.env.META_APP_ID = '100001';
  }
  expect(client.suscribir).not.toHaveBeenCalled();
  expect(client.sincronizar).not.toHaveBeenCalled();
});
it('desconectar durante la red no reactiva el canal ni solicita contactos', async () => {
  const alta = await altaRealPreparada();
  const red = diferida<void>();
  client.suscribir.mockReturnValueOnce(red.promise);
  const paso = altas.procesarSiguiente();
  while (!client.suscribir.mock.calls.length)
    await new Promise((r) => setTimeout(r, 10));
  await service.descartarVinculoPreparado(auth, ip);
  red.resolver();
  await paso;
  await altas.procesarSiguiente();
  expect(client.sincronizar).not.toHaveBeenCalled();
  expect(
    await db.metaAlta.findUniqueOrThrow({ where: { id: alta.id } }),
  ).toMatchObject({ estado: 'PAUSADA' });
  expect(
    (await db.metaVinculo.findUniqueOrThrow({ where: { id: alta.vinculoId } }))
      .recepcionDesdeEl,
  ).toBeNull();
});
