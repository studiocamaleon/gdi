import { InboxTiempoRealBus } from './inbox-tiempo-real.bus';
import { MetaInboxStreamService } from '../integraciones/meta/meta-inbox-stream.service';
import { RolSistema } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { Controller, Sse } from '@nestjs/common';
import type { Server } from 'node:http';
import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  })),
);
jest.mock('../integraciones/meta/meta-recepcion', () => ({
  configuracionMetaRecepcion: () => ({
    tenantId: 'empresa',
    wabaId: 'cuenta',
    phoneNumberId: 'numero',
  }),
}));
const canal = {
  tenantId: 'empresa',
  wabaId: 'cuenta',
  phoneNumberId: 'numero',
};
const auth = {
  userId: 'usuario',
  tenantId: 'empresa',
  sessionId: 'sesion',
  membershipId: 'miembro',
  role: RolSistema.ADMINISTRADOR,
  email: 'demo@example.invalid',
  permisos: new Set(['panel.ver']),
};
let bus: InboxTiempoRealBus;
const flag = process.env.META_INBOX_LECTURA_ENABLED;
beforeEach(() => {
  jest.useFakeTimers();
  process.env.META_INBOX_LECTURA_ENABLED = 'false';
});
afterEach(() => {
  bus?.onModuleDestroy();
  jest.useRealTimers();
  if (flag === undefined) delete process.env.META_INBOX_LECTURA_ENABLED;
  else process.env.META_INBOX_LECTURA_ENABLED = flag;
});
function prisma() {
  return {
    inboxCanalRevision: {
      findUnique: jest.fn().mockResolvedValue({ revision: 1n }),
    },
    authSession: {
      findUnique: jest.fn().mockResolvedValue({
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
          rol: RolSistema.ADMINISTRADOR,
          ipsPermitidas: [],
          rolDelTenant: null,
        },
      }),
    },
  };
}
it('cerrar el bus completa todos los streams, indica reintento y libera sus timers', async () => {
  const db = prisma();
  bus = new InboxTiempoRealBus(db as never);
  const service = new MetaInboxStreamService(
    db as never,
    { exigirIncluida: jest.fn().mockResolvedValue(undefined) } as never,
    bus,
  );
  const eventos: { type?: string }[][] = [[], []];
  const subs = [];
  for (const lista of eventos)
    subs.push(
      (await service.abrir(auth, '127.0.0.1', Date.now() + 60000)).subscribe(
        (e) => lista.push(e),
      ),
    );
  await jest.advanceTimersByTimeAsync(250);
  expect(eventos.every((e) => e[0]?.type === 'ready')).toBe(true);
  bus.onModuleDestroy();
  expect(subs.every((s) => s.closed)).toBe(true);
  expect(eventos.every((e) => e.at(-1)?.type === 'reintentar')).toBe(true);
  expect(eventos.flat().some((e) => e.type === 'acceso_cerrado')).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
  expect(() => bus.escuchar(canal, () => {})).toThrow('cerrado');
});
it('un listener que falla no impide cerrar los demás ni repite avisos', () => {
  bus = new InboxTiempoRealBus(prisma() as never);
  bus.escuchar(canal, () => {
    throw new Error('consumidor');
  });
  const listener = jest.fn();
  bus.escuchar(canal, listener);
  bus.onModuleDestroy();
  bus.onModuleDestroy();
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith(null);
  expect(jest.getTimerCount()).toBe(0);
});
it('Nest cierra HTTP con un SSE abierto sin esperar al timeout del proceso', async () => {
  jest.useRealTimers();
  bus = new InboxTiempoRealBus(prisma() as never);
  const service = new MetaInboxStreamService(
    prisma() as never,
    { exigirIncluida: jest.fn().mockResolvedValue(undefined) } as never,
    bus,
  );
  const notificaciones = new EventosSistemaService({
    eventoSistema: { findFirst: jest.fn().mockResolvedValue({ id: 0n }) },
    notificacionInterna: { count: jest.fn().mockResolvedValue(0) },
  } as never);
  @Controller()
  class CanalEnsayo {
    @Sse('stream')
    abrir() {
      return service.abrir(auth, '127.0.0.1', Date.now() + 60000);
    }
    @Sse('eventos')
    eventos() {
      return notificaciones.stream(auth, () => Promise.resolve(auth));
    }
  }
  const module = await Test.createTestingModule({
    controllers: [CanalEnsayo],
    providers: [
      { provide: InboxTiempoRealBus, useValue: bus },
      { provide: EventosSistemaService, useValue: notificaciones },
    ],
  }).compile();
  const app = module.createNestApplication();
  const servidor = app.getHttpServer() as Server;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    await app.listen(0, '127.0.0.1');
    const response = await fetch(`${await app.getUrl()}/stream`, {
      signal: controller.signal,
    });
    const reader = response.body!.getReader();
    let contenido = '';
    while (!contenido.includes('event: ready')) {
      const chunk = await reader.read();
      expect(chunk.done).toBe(false);
      contenido += new TextDecoder().decode(chunk.value);
    }
    const eventos = await fetch(`${await app.getUrl()}/eventos`, {
      signal: controller.signal,
    });
    const lectorEventos = eventos.body!.getReader();
    let eventosTexto = '';
    while (!eventosTexto.includes('event: ready')) {
      const chunk = await lectorEventos.read();
      expect(chunk.done).toBe(false);
      eventosTexto += new TextDecoder().decode(chunk.value);
    }
    const cierre = app.close();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      contenido += new TextDecoder().decode(chunk.value);
    }
    while (!(await lectorEventos.read()).done) {
      /* drenar cierre HTTP */
    }
    await cierre;
    expect(contenido).toContain('event: reintentar');
    expect(servidor.listening).toBe(false);
  } finally {
    clearTimeout(timeout);
    controller.abort();
    servidor.closeAllConnections();
    await app.close();
  }
});

it('el apagado de notificaciones no inicia consultas ni timers nuevos', async () => {
  const findFirst = jest.fn().mockResolvedValue({ id: 0n });
  const service = new EventosSistemaService({
    eventoSistema: { findFirst },
    notificacionInterna: { count: jest.fn().mockResolvedValue(0) },
  } as never);
  const a = service.stream(auth, () => Promise.resolve(auth)).subscribe();
  const b = service.stream(auth, () => Promise.resolve(auth)).subscribe();
  await jest.advanceTimersByTimeAsync(1);
  service.onModuleDestroy();
  expect(a.closed).toBe(true);
  expect(b.closed).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
  findFirst.mockClear();
  const tardia = service.stream(auth, () => Promise.resolve(auth)).subscribe();
  expect(tardia.closed).toBe(true);
  expect(findFirst).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});
