import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { TenantsController } from '../../tenants/tenants.controller';
import { TenantsService } from '../../tenants/tenants.service';
import { DatosEmpresaService } from '../../tenants/datos-empresa.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { AuthGuard } from '../auth.guard';
import { RolesGuard } from '../roles.guard';
import { PermisosGuard } from '../permisos.guard';

/** Sesiones, permisos y escrituras de empresa reales. El almacenamiento de
 * logos se sustituye: se comprueba que un rechazo nunca llegue al servicio. */
describe('Configuración de empresa: el rol base no sustituye al permiso efectivo', () => {
  const prisma = new PrismaService();
  const jwtSecretAnterior = process.env.JWT_SECRET;
  const jwtSecret = randomUUID();
  const jwt = new JwtService({ secret: jwtSecret });
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const tokens: Record<string, string> = {};
  const archivos = {
    logoDeTenant: jest.fn(() => Promise.resolve(null)),
    definirLogo: jest.fn(() => Promise.resolve({ ok: true })),
    quitarLogo: jest.fn(() => Promise.resolve(undefined)),
  };
  let app: INestApplication<Server>;
  let baseValidada = false;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test') ||
      process.env.TENANT_GUARD === 'off'
    ) {
      throw new Error('Se requiere base local de test y aislamiento activo');
    }
    baseValidada = true;
    process.env.JWT_SECRET = jwtSecret;
    await prisma.$connect();
    for (const id of tenants) {
      await prisma.tenant.create({
        data: { id, slug: `qa-config-${id}`, nombre: 'Empresa ficticia' },
      });
    }
    for (const [actor, role, permisos] of [
      ['administrador-limitado', 'ADMINISTRADOR', []],
      ['supervisor-limitado', 'SUPERVISOR', []],
      ['autorizado', 'ADMINISTRADOR', ['configuracion.gestionar']],
    ] as const) {
      const user = await prisma.user.create({
        data: { email: `qa-config-${randomUUID()}@example.invalid` },
      });
      users.push(user.id);
      const rol = await prisma.rol.create({
        data: { tenantId: tenants[0], nombre: actor, permisos: [...permisos] },
      });
      const membership = await prisma.membership.create({
        data: {
          tenantId: tenants[0],
          userId: user.id,
          rol: role,
          rolId: rol.id,
        },
      });
      const session = await prisma.authSession.create({
        data: {
          userId: user.id,
          currentTenantId: tenants[0],
          currentMembershipId: membership.id,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      tokens[actor] = jwt.sign({
        sub: user.id,
        email: user.email,
        sessionId: session.id,
        tenantId: tenants[0],
        membershipId: membership.id,
        role,
      });
    }
    const module = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        { provide: TenantsService, useValue: {} },
        { provide: ArchivosService, useValue: archivos },
        {
          provide: DatosEmpresaService,
          useValue: new DatosEmpresaService(prisma),
        },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.useLogger(false);
    const reflector = new Reflector();
    app.useGlobalGuards(
      new AuthGuard(reflector, jwt, prisma),
      new RolesGuard(reflector),
      new PermisosGuard(reflector),
    );
    app.useGlobalInterceptors(new TenantContextInterceptor(reflector));
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (jwtSecretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = jwtSecretAnterior;
    await app?.close();
    if (baseValidada) {
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.$disconnect();
  });

  const escrituras = [
    ['put', '/tenants/empresa', { nombre: 'Nombre no autorizado' }],
    ['put', '/tenants/logo', { archivoId: randomUUID() }],
    ['delete', '/tenants/logo', {}],
  ] as const;

  it.each(escrituras)(
    'rechaza %s %s sin sesión',
    async (metodo, ruta, body) => {
      await request(app.getHttpServer())[metodo](ruta).send(body).expect(401);
    },
  );

  describe.each(['administrador-limitado', 'supervisor-limitado'])(
    '%s',
    (actor) => {
      it.each(escrituras)(
        'rechaza %s %s sin configurar la empresa',
        async (metodo, ruta, body) => {
          archivos.definirLogo.mockClear();
          archivos.quitarLogo.mockClear();
          const antes = await prisma.tenant.findUniqueOrThrow({
            where: { id: tenants[0] },
          });
          await request(app.getHttpServer())
            [metodo](ruta)
            .auth(tokens[actor], { type: 'bearer' })
            .send(body)
            .expect(403);
          expect(
            await prisma.tenant.findUniqueOrThrow({
              where: { id: tenants[0] },
            }),
          ).toEqual(antes);
          expect(archivos.definirLogo).not.toHaveBeenCalled();
          expect(archivos.quitarLogo).not.toHaveBeenCalled();
        },
      );

      it('conserva la lectura de su empresa y logo', async () => {
        await request(app.getHttpServer())
          .get('/tenants/empresa')
          .auth(tokens[actor], { type: 'bearer' })
          .expect(200);
        await request(app.getHttpServer())
          .get('/tenants/logo')
          .auth(tokens[actor], { type: 'bearer' })
          .expect(200);
      });
    },
  );

  it('el permiso efectivo permite guardar y no toca otra empresa aunque se falsifique la cabecera', async () => {
    const ajena = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenants[1] },
    });
    const resultado = await request(app.getHttpServer())
      .put('/tenants/empresa')
      .auth(tokens.autorizado, { type: 'bearer' })
      .set('x-tenant-id', tenants[1])
      .send({ nombre: 'Nombre autorizado' })
      .expect(200);
    expect((resultado.body as { nombre: string }).nombre).toBe(
      'Nombre autorizado',
    );
    expect(
      (await prisma.tenant.findUniqueOrThrow({ where: { id: tenants[0] } }))
        .nombre,
    ).toBe('Nombre autorizado');
    expect(
      await prisma.tenant.findUniqueOrThrow({ where: { id: tenants[1] } }),
    ).toEqual(ajena);
  });

  it('el permiso efectivo permite pedir la actualización y retirada de logo', async () => {
    const archivoId = randomUUID();
    await request(app.getHttpServer())
      .put('/tenants/logo')
      .auth(tokens.autorizado, { type: 'bearer' })
      .send({ archivoId })
      .expect(200);
    expect(archivos.definirLogo).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: tenants[0] }),
      archivoId,
    );
    await request(app.getHttpServer())
      .delete('/tenants/logo')
      .auth(tokens.autorizado, { type: 'bearer' })
      .expect(200);
    expect(archivos.quitarLogo).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: tenants[0] }),
    );
  });
});
