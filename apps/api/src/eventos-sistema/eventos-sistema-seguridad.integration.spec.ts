import { randomUUID } from 'node:crypto';
import { get, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermisosGuard } from '../auth/permisos.guard';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { capacidadesDePrueba } from '../../test/fixture-capacidades';
import { EventosSistemaController } from './eventos-sistema.controller';
import { EventosSistemaService } from './eventos-sistema.service';
import { generarTokenMcp, hashTokenMcp } from '../auth/credencial-mcp.util';

/** HTTP SSE y PostgreSQL reales; sólo datos ficticios en la base local de test. */
describe('Canal de eventos: revocación con la conexión abierta', () => {
  const prisma = new PrismaService();
  const secret = randomUUID();
  const anterior = process.env.JWT_SECRET;
  const jwt = new JwtService({ secret });
  const capacidades = capacidadesDePrueba();
  let mcpHabilitado = true;
  const tenants: string[] = [];
  const users: string[] = [];
  let app: INestApplication<Server>;
  let validada = false;
  let tenantId: string,
    userId: string,
    sessionId: string,
    membershipId: string,
    rolId: string;
  let token: string;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    )
      throw new Error('Requiere base local de test y aislamiento activo');
    validada = true;
    process.env.JWT_SECRET = secret;
    await prisma.$connect();
    const plan = await capacidades.actual('ficticia');
    jest.spyOn(capacidades, 'actual').mockImplementation((id) =>
      Promise.resolve({
        ...plan,
        empresa: { ...plan.empresa, id },
        contrato: {
          ...plan.contrato,
          funciones: { ...plan.contrato.funciones, mcp: mcpHabilitado },
        },
      }),
    );
    const module = await Test.createTestingModule({
      controllers: [EventosSistemaController],
      providers: [
        AuthGuard,
        EventosSistemaService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: CapacidadesEmpresaService, useValue: capacidades },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    app.useGlobalGuards(
      app.get(AuthGuard),
      new PermisosGuard(app.get(Reflector)),
    );
    await app.listen(0, '127.0.0.1');
  });

  beforeEach(async () => {
    mcpHabilitado = true;
    const tenant = await prisma.tenant.create({
      data: { nombre: 'Empresa ficticia SSE', slug: `qa-sse-${randomUUID()}` },
    });
    tenantId = tenant.id;
    tenants.push(tenantId);
    const user = await prisma.user.create({
      data: { email: `qa-sse-${randomUUID()}@example.invalid` },
    });
    userId = user.id;
    users.push(userId);
    const rol = await prisma.rol.create({
      data: { tenantId, nombre: 'Lector ficticio', permisos: ['panel.ver'] },
    });
    rolId = rol.id;
    const miembro = await prisma.membership.create({
      data: { tenantId, userId, rolId, rol: 'OPERADOR' },
    });
    membershipId = miembro.id;
    const sesion = await prisma.authSession.create({
      data: {
        userId,
        currentTenantId: tenantId,
        currentMembershipId: membershipId,
        expiresAt: new Date(Date.now() + 6 * 3_600_000),
      },
    });
    sessionId = sesion.id;
    token = jwt.sign({
      sub: userId,
      sessionId,
      tenantId,
      membershipId,
      role: 'OPERADOR',
      email: user.email,
    });
  });

  afterAll(async () => {
    await app?.close();
    if (validada) {
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
    }
    await prisma.$disconnect();
    if (anterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = anterior;
  });

  it('un facturador sin Panel consulta y lee sólo sus notificaciones personales', async () => {
    await prisma.rol.update({
      where: { id: rolId },
      data: {
        permisos: ['acceso.por_vista', 'administracion.facturacion.gestionar'],
      },
    });
    const otro = await prisma.user.create({
      data: { email: `qa-notificaciones-${randomUUID()}@example.invalid` },
    });
    users.push(otro.id);
    await prisma.membership.create({
      data: { tenantId, userId: otro.id, rolId, rol: 'OPERADOR' },
    });
    const service = app.get(EventosSistemaService);
    for (const destinatario of [userId, otro.id])
      await service.publicar({
        tenantId,
        actorNombre: 'Sistema',
        tipo: 'facturacion_lote_finalizado',
        entidadTipo: 'facturacion_lote',
        titulo: 'Lote ficticio finalizado',
        mensaje: 'Finalizó el ensayo',
        topicos: [],
        destinatariosUserId: [destinatario],
      });
    const url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/eventos-sistema`;
    const headers = { authorization: `Bearer ${token}` };
    expect((await fetch(url + '/notificaciones')).status).toBe(401);
    const respuesta = await fetch(url + '/notificaciones', { headers });
    expect(respuesta.status).toBe(200);
    const filas = (await respuesta.json()) as { id: string }[];
    expect(filas).toHaveLength(1);
    expect(
      await (
        await fetch(url + '/notificaciones/no-leidas', { headers })
      ).json(),
    ).toEqual({ cantidad: 1 });
    const ajena = await prisma.notificacionInterna.findFirstOrThrow({
      where: { tenantId, userId: otro.id },
    });
    expect(
      (
        await fetch(url + '/notificaciones/' + ajena.id + '/leer', {
          method: 'PATCH',
          headers,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await fetch(url + '/notificaciones/' + filas[0].id + '/leer', {
          method: 'PATCH',
          headers,
        })
      ).status,
    ).toBe(200);
    expect((await fetch(url + '/cambios', { headers })).status).toBe(403);
    expect((await fetch(url + '/stream', { headers })).status).toBe(403);
    await prisma.membership.update({
      where: { id: membershipId },
      data: { activa: false },
    });
    expect((await fetch(url + '/notificaciones', { headers })).status).toBe(
      401,
    );
  });

  function abrir() {
    const port = (app.getHttpServer().address() as AddressInfo).port;
    let contenido = '';
    let resolverInicio!: () => void;
    let resolverFin!: (motivo: string) => void;
    const inicio = new Promise<void>((resolve) => {
      resolverInicio = resolve;
    });
    const fin = new Promise<string>((resolve) => {
      resolverFin = resolve;
    });
    const req = get(
      `http://127.0.0.1:${port}/eventos-sistema/stream`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'text/event-stream',
        },
      },
      (res) => {
        res.setEncoding('utf8');
        res.on('data', (parte: string) => {
          contenido += parte;
          if (contenido.includes('event: ready')) resolverInicio();
          if (contenido.includes('event: cambio')) resolverFin('cambio');
        });
        res.on('close', () => resolverFin('cerrado'));
        res.on('error', () => resolverFin('cerrado'));
      },
    );
    req.on('error', () => resolverFin('cerrado'));
    const timeout = setTimeout(() => {
      resolverInicio();
      resolverFin('timeout');
    }, 4500);
    return {
      inicio,
      fin,
      contenido: () => contenido,
      cerrar: () => {
        clearTimeout(timeout);
        req.destroy();
      },
    };
  }

  it.each([
    'logout',
    'usuario',
    'empresa',
    'membresia',
    'rol',
    'ip',
    'vencimiento',
    'clave-provisoria',
    'cambio-empresa',
  ] as const)('cierra por %s y no emite el evento posterior', async (caso) => {
    const stream = abrir();
    try {
      await stream.inicio;
      expect(stream.contenido()).toContain('event: ready');
      if (caso === 'logout')
        await prisma.authSession.update({
          where: { id: sessionId },
          data: { revokedAt: new Date() },
        });
      if (caso === 'usuario')
        await prisma.user.update({
          where: { id: userId },
          data: { activo: false },
        });
      if (caso === 'empresa')
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { activo: false },
        });
      if (caso === 'membresia')
        await prisma.membership.update({
          where: { id: membershipId },
          data: { activa: false },
        });
      if (caso === 'rol')
        await prisma.rol.update({
          where: { id: rolId },
          data: { permisos: [] },
        });
      if (caso === 'ip')
        await prisma.membership.update({
          where: { id: membershipId },
          data: { ipsPermitidas: ['203.0.113.9'] },
        });
      if (caso === 'vencimiento')
        await prisma.authSession.update({
          where: { id: sessionId },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
      if (caso === 'clave-provisoria')
        await prisma.user.update({
          where: { id: userId },
          data: { debeCambiarPassword: true },
        });
      if (caso === 'cambio-empresa')
        await prisma.authSession.update({
          where: { id: sessionId },
          data: { currentTenantId: null, currentMembershipId: null },
        });
      await app.get(EventosSistemaService).publicar({
        tenantId,
        actorNombre: 'Actor ficticio',
        tipo: 'prueba.privada',
        entidadTipo: 'prueba',
        titulo: 'Ficticio',
        mensaje: 'No publicar',
        topicos: ['prueba'],
      });
      expect(await stream.fin).toBe('cerrado');
      expect(stream.contenido()).not.toContain('prueba.privada');
    } finally {
      stream.cerrar();
    }
  });

  it('la sesión vigente recibe los eventos de su empresa', async () => {
    const stream = abrir();
    try {
      await stream.inicio;
      await app.get(EventosSistemaService).publicar({
        tenantId,
        actorNombre: 'Actor ficticio',
        tipo: 'prueba.permitida',
        entidadTipo: 'prueba',
        titulo: 'Ficticio',
        mensaje: 'Mensaje ficticio',
        topicos: ['prueba'],
      });
      expect(await stream.fin).toBe('cambio');
      expect(stream.contenido()).toContain('prueba.permitida');
    } finally {
      stream.cerrar();
    }
  });

  it('el vencimiento del JWT también cierra una conexión previamente autorizada', async () => {
    token = jwt.sign(
      {
        sub: userId,
        sessionId,
        tenantId,
        membershipId,
        role: 'OPERADOR',
        email: 'qa@example.invalid',
      },
      { expiresIn: 2 },
    );
    const stream = abrir();
    try {
      await stream.inicio;
      expect(stream.contenido()).toContain('event: ready');
      expect(await stream.fin).toBe('cerrado');
    } finally {
      stream.cerrar();
    }
  });

  it('permanecer conectado no prolonga por sí solo la sesión', async () => {
    const stream = abrir();
    try {
      await stream.inicio;
      const vence = new Date(Date.now() + 3600000);
      await prisma.authSession.update({
        where: { id: sessionId },
        data: { expiresAt: vence },
      });
      await app.get(EventosSistemaService).publicar({
        tenantId,
        actorNombre: 'Actor ficticio',
        tipo: 'prueba.activa',
        entidadTipo: 'prueba',
        titulo: 'Ficticio',
        mensaje: 'Ficticio',
        topicos: [],
      });
      expect(await stream.fin).toBe('cambio');
      expect(
        (
          await prisma.authSession.findUniqueOrThrow({
            where: { id: sessionId },
          })
        ).expiresAt,
      ).toEqual(vence);
    } finally {
      stream.cerrar();
    }
  });

  it.each(['revocada', 'scopes', 'plan'] as const)(
    'cierra también una credencial MCP por %s',
    async (caso) => {
      token = generarTokenMcp();
      const credencial = await prisma.credencialMcp.create({
        data: {
          tenantId,
          membershipId,
          nombre: 'MCP ficticio',
          tokenHash: hashTokenMcp(token),
          pista: token.slice(-4),
          creadaPorId: userId,
          scopes: ['panel.ver'],
        },
      });
      const stream = abrir();
      try {
        await stream.inicio;
        expect(stream.contenido()).toContain('event: ready');
        if (caso === 'revocada')
          await prisma.credencialMcp.update({
            where: { id: credencial.id },
            data: { revocadoEl: new Date() },
          });
        if (caso === 'scopes')
          await prisma.credencialMcp.update({
            where: { id: credencial.id },
            data: { scopes: ['registros.ver'] },
          });
        if (caso === 'plan') mcpHabilitado = false;
        await app.get(EventosSistemaService).publicar({
          tenantId,
          actorNombre: 'Actor ficticio',
          tipo: 'prueba.privada',
          entidadTipo: 'prueba',
          titulo: 'Ficticio',
          mensaje: 'Ficticio',
          topicos: [],
        });
        expect(await stream.fin).toBe('cerrado');
        expect(stream.contenido()).not.toContain('prueba.privada');
      } finally {
        stream.cerrar();
      }
    },
  );
});
