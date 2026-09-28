import { ForbiddenException } from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import {
  MetaInboxStreamService,
  vencimientoStream,
} from './meta-inbox-stream.service';

const auth: CurrentAuth = {
  userId: 'usuario',
  tenantId: 'empresa',
  sessionId: 'sesion',
  membershipId: 'miembro',
  role: RolSistema.ADMINISTRADOR,
  email: 'admin@example.invalid',
};
const config = {
  tenantId: 'empresa',
  wabaId: 'cuenta',
  phoneNumberId: 'numero',
};
jest.mock('./meta-recepcion', () => ({
  configuracionMetaRecepcion: () => config,
}));
let revision: (revision: string | null) => void;
const lecturaAnterior = process.env.META_INBOX_LECTURA_ENABLED;
let escuchar: jest.Mock<
  () => void,
  [unknown, (revision: string | null) => void]
>;
let dejar: jest.Mock,
  prisma: {
    authSession: { findUnique: jest.Mock };
    metaVinculo: { findFirst: jest.Mock };
  },
  capacidades: { exigirIncluida: jest.Mock },
  service: MetaInboxStreamService;
function sesion() {
  return {
    userId: 'usuario',
    currentTenantId: 'empresa',
    currentMembershipId: 'miembro',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 3600000),
    impersonacionId: null,
    user: { activo: true },
    currentTenant: { activo: true },
    currentMembership: {
      activa: true,
      userId: 'usuario',
      tenantId: 'empresa',
      rol: RolSistema.ADMINISTRADOR as RolSistema,
      ipsPermitidas: [],
      rolDelTenant: null,
    },
  };
}
beforeEach(() => {
  process.env.META_INBOX_LECTURA_ENABLED = 'false';
  jest.useFakeTimers();
  dejar = jest.fn();
  prisma = {
    metaVinculo: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'vinculo',
        autorizacionId: 'alta-1',
        tipo: 'COEXISTENCIA',
        ...config,
      }),
    },
    authSession: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(sesion())),
    },
  };
  capacidades = { exigirIncluida: jest.fn().mockResolvedValue(undefined) };
  escuchar = jest.fn(
    (_canal: unknown, cb: (revision: string | null) => void) => {
      revision = cb;
      return dejar;
    },
  );
  service = new MetaInboxStreamService(
    prisma as never,
    capacidades as never,
    { escuchar } as never,
  );
});
afterEach(() => {
  jest.useRealTimers();
  if (lecturaAnterior === undefined)
    delete process.env.META_INBOX_LECTURA_ENABLED;
  else process.env.META_INBOX_LECTURA_ENABLED = lecturaAnterior;
});
it('ready reconcilia siempre, agrupa ráfagas y sólo publica identidad y revisión', async () => {
  const events: unknown[] = [];
  const stream = await service.abrir(auth, '127.0.0.1', Date.now() + 600000);
  const sub = stream.subscribe((e) => events.push(e));
  revision('4');
  await jest.advanceTimersByTimeAsync(250);
  revision('5');
  revision('6');
  await jest.advanceTimersByTimeAsync(250);
  expect(events).toEqual([
    expect.objectContaining({
      type: 'ready',
      id: '4',
      data: { empresaId: 'empresa', usuarioId: 'usuario', revision: '4' },
    }),
    expect.objectContaining({
      type: 'cambio',
      id: '6',
      data: { empresaId: 'empresa', usuarioId: 'usuario', revision: '6' },
    }),
  ]);
  await jest.advanceTimersByTimeAsync(15000);
  expect(events.at(-1)).toMatchObject({ type: 'heartbeat', id: '6' });
  sub.unsubscribe();
  expect(dejar).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
it.each([
  'revocada',
  'empresa',
  'membresia',
  'usuario',
  'inactivo',
  'rol',
  'permiso',
  'ip',
  'plan',
])(
  'cierra y retira acceso cuando cambia %s, aun sin mensajes',
  async (caso) => {
    const events: { type?: string }[] = [];
    const stream = await service.abrir(auth, '127.0.0.1', Date.now() + 600000);
    const sub = stream.subscribe((e) => events.push(e));
    revision('1');
    await jest.advanceTimersByTimeAsync(250);
    const s = sesion();
    if (caso === 'revocada') s.revokedAt = new Date() as never;
    if (caso === 'empresa') s.currentTenantId = 'otra';
    if (caso === 'membresia') s.currentMembershipId = 'otro';
    if (caso === 'usuario') s.userId = 'otro';
    if (caso === 'inactivo') s.user.activo = false;
    if (caso === 'rol') s.currentMembership.rol = RolSistema.OPERADOR;
    if (caso === 'permiso')
      s.currentMembership.rolDelTenant = { permisos: [] } as never;
    if (caso === 'ip')
      s.currentMembership.ipsPermitidas = ['192.0.2.1'] as never;
    if (caso === 'plan')
      capacidades.exigirIncluida.mockRejectedValue(new ForbiddenException());
    prisma.authSession.findUnique.mockResolvedValue(s);
    await jest.advanceTimersByTimeAsync(15000);
    expect(events.at(-1)?.type).toBe('acceso_cerrado');
    expect(sub.closed).toBe(true);
    expect(dejar).toHaveBeenCalledTimes(1);
  },
);
it.each([
  { mcp: {} },
  { impersonacion: {} },
  { esPlataforma: true },
  { tenantId: 'otra' },
])('rechaza otro ámbito antes de abrir SSE: %j', async (extra) => {
  await expect(
    service.abrir(
      { ...auth, ...extra } as CurrentAuth,
      '127.0.0.1',
      Date.now() + 60000,
    ),
  ).rejects.toBeInstanceOf(ForbiddenException);
});
it('renueva al vencer el JWT y no revela fallos internos de DB', async () => {
  const stream = await service.abrir(auth, '127.0.0.1', Date.now() + 1000);
  const sub = stream.subscribe();
  revision('1');
  await jest.advanceTimersByTimeAsync(1000);
  expect(sub.closed).toBe(true);
  expect(dejar).toHaveBeenCalledTimes(1);
  const eventos: { type?: string }[] = [];
  const siguiente = (
    await service.abrir(auth, '127.0.0.1', Date.now() + 60000)
  ).subscribe((e) => eventos.push(e));
  prisma.authSession.findUnique.mockRejectedValue(new Error('dato interno'));
  revision('2');
  await jest.advanceTimersByTimeAsync(250);
  expect(eventos).toEqual([expect.objectContaining({ type: 'reintentar' })]);
  expect(JSON.stringify(eventos)).not.toContain('dato interno');
  expect(siguiente.closed).toBe(true);
});
it('no prolonga un token sin expiración', () => {
  expect(vencimientoStream('Bearer invalido')).toBe(0);
  const body = Buffer.from(JSON.stringify({ exp: 123456 })).toString(
    'base64url',
  );
  expect(vencimientoStream(`Bearer header.${body}.firma`)).toBe(123456000);
});
it.each(['desconectado', 'reconectado', 'crm', 'password', 'bandera'])(
  'el stream general usa el canal propio y cierra por %s sin mensajes nuevos',
  async (caso) => {
    process.env.META_INBOX_LECTURA_ENABLED = 'true';
    const eventos: { type?: string }[] = [];
    const sub = (
      await service.abrir(auth, '127.0.0.1', Date.now() + 60000)
    ).subscribe((e) => eventos.push(e));
    // El bus recibe sólo las tres columnas de la identidad, sin metadatos de autorización.
    expect(escuchar.mock.calls[0][0]).toEqual(config);
    revision('1');
    await jest.advanceTimersByTimeAsync(250);
    expect(eventos.at(-1)?.type).toBe('ready');
    if (caso === 'desconectado')
      prisma.metaVinculo.findFirst.mockResolvedValue(null);
    if (caso === 'reconectado')
      prisma.metaVinculo.findFirst.mockResolvedValue({
        id: 'vinculo',
        autorizacionId: 'alta-2',
        tipo: 'COEXISTENCIA',
        ...config,
      });
    if (caso === 'crm') {
      const s = sesion();
      s.currentMembership.rolDelTenant = {
        permisos: ['configuracion.gestionar'],
      } as never;
      prisma.authSession.findUnique.mockResolvedValue(s);
    }
    if (caso === 'password') {
      const s = sesion();
      prisma.authSession.findUnique.mockResolvedValue({
        ...s,
        user: { activo: true, debeCambiarPassword: true },
      });
    }
    if (caso === 'bandera') process.env.META_INBOX_LECTURA_ENABLED = 'false';
    await jest.advanceTimersByTimeAsync(15000);
    expect(eventos.at(-1)?.type).toBe('acceso_cerrado');
    expect(sub.closed).toBe(true);
    expect(dejar).toHaveBeenCalledTimes(1);
  },
);
it('el canal general mantiene tiempo real para operadores y lo cierra al quitarles el permiso', async () => {
  process.env.META_INBOX_LECTURA_ENABLED = 'true';
  const s = sesion();
  s.currentMembership.rol = RolSistema.OPERADOR;
  s.currentMembership.rolDelTenant = { permisos: ['inbox.atender'] } as never;
  prisma.authSession.findUnique.mockResolvedValue(s);
  const events: { type?: string }[] = [];
  const stream = await service.abrir(
    { ...auth, role: RolSistema.OPERADOR },
    '127.0.0.1',
    Date.now() + 600000,
  );
  const sub = stream.subscribe((e) => events.push(e));
  revision('1');
  await jest.advanceTimersByTimeAsync(250);
  expect(events.at(-1)?.type).toBe('ready');
  s.currentMembership.rolDelTenant = { permisos: [] } as never;
  revision('2');
  await jest.advanceTimersByTimeAsync(250);
  expect(events.at(-1)?.type).toBe('acceso_cerrado');
  expect(sub.closed).toBe(true);
});
