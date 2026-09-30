import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { CentroCopiadoController } from '../centro-copiado.controller';
import { CentroCopiadoService } from '../centro-copiado.service';
import { CentroCopiadoSaludService } from '../centro-copiado-salud.service';
import { CentroCopiadoAuditoriaService } from '../centro-copiado-auditoria.service';

/** Guardas HTTP, sesiones y permisos reales. El cálculo/guardado se sustituye
 * para comprobar que el permiso se exige antes de ejecutar el servicio. */
describe('Centro de Copiado: consultar no permite guardar cotizaciones', () => {
  const prisma = new PrismaService();
  const jwtSecretAnterior = process.env.JWT_SECRET;
  const jwtSecret = randomUUID();
  const jwt = new JwtService({ secret: jwtSecret });
  const tenants = [randomUUID(), randomUUID()];
  const users: string[] = [];
  const tokens: Record<string, string> = {};
  const roles: Record<string, string> = {};
  const servicio = {
    cotizar: jest.fn(() => Promise.resolve({ total: 100 })),
    construirItems: jest.fn(() => Promise.resolve({ items: [] })),
    guardarTomo: jest.fn(() => Promise.resolve({ guardado: true })),
    agregarAOrden: jest.fn(() => Promise.resolve({ guardado: true })),
  };
  const capacidades = { exigirIncluida: jest.fn(() => Promise.resolve()) };
  const body = {
    documentos: [
      {
        id: 'documento-ficticio',
        paginas: 1,
        copias: 1,
        tamano: 'A4',
        tamanoAnchoMm: 210,
        tamanoAltoMm: 297,
        papelMateriaPrimaId: randomUUID(),
        color: 'BN',
        faz: 1,
      },
    ],
  };
  const escrituras = [
    ['guardar-tomo', 'guardarTomo'],
    ['agregar-a-orden', 'agregarAOrden'],
  ] as const;
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
        data: {
          id,
          slug: `qa-copiado-${id}`,
          nombre: 'Empresa ficticia',
        },
      });
    }
    for (const [actor, rolBase, permisos] of [
      ['lector', 'OPERADOR', ['comercial.ver']],
      ['administrador-limitado', 'ADMINISTRADOR', ['comercial.ver']],
      ['autorizado', 'OPERADOR', ['comercial.ver', 'comercial.gestionar']],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          email: `qa-copiado-${randomUUID()}@example.invalid`,
        },
      });
      users.push(user.id);
      const rol = await prisma.rol.create({
        data: {
          tenantId: tenants[0],
          nombre: actor,
          permisos: [...permisos],
        },
      });
      roles[actor] = rol.id;
      const membership = await prisma.membership.create({
        data: {
          tenantId: tenants[0],
          userId: user.id,
          rol: rolBase,
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
        role: rolBase,
      });
    }
    const module = await Test.createTestingModule({
      controllers: [CentroCopiadoController],
      providers: [
        { provide: CentroCopiadoService, useValue: servicio },
        { provide: CapacidadesEmpresaService, useValue: capacidades },
        { provide: CentroCopiadoSaludService, useValue: {} },
        { provide: CentroCopiadoAuditoriaService, useValue: {} },
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

  beforeEach(() => jest.clearAllMocks());

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

  it.each(escrituras)('rechaza %s sin sesión', async (ruta, metodo) => {
    await request(app.getHttpServer())
      .post(`/centro-copiado/${ruta}`)
      .send(body)
      .expect(401);
    expect(servicio[metodo]).not.toHaveBeenCalled();
  });

  describe.each(['lector', 'administrador-limitado'])('%s', (actor) => {
    it.each(escrituras)('rechaza %s antes de guardar', async (ruta, metodo) => {
      await request(app.getHttpServer())
        .post(`/centro-copiado/${ruta}`)
        .auth(tokens[actor], { type: 'bearer' })
        .send(body)
        .expect(403);
      expect(servicio[metodo]).not.toHaveBeenCalled();
      expect(capacidades.exigirIncluida).not.toHaveBeenCalled();
    });
    it.each([
      ['cotizar', 'cotizar'],
      ['construir-items', 'construirItems'],
    ] as const)('conserva la previsualización %s', async (ruta, metodo) => {
      await request(app.getHttpServer())
        .post(`/centro-copiado/${ruta}`)
        .auth(tokens[actor], { type: 'bearer' })
        .send(body)
        .expect(201);
      expect(servicio[metodo]).toHaveBeenCalledWith(tenants[0], body);
    });
  });

  it.each(escrituras)(
    'permite %s con permiso y la empresa de la sesión',
    async (ruta, metodo) => {
      await request(app.getHttpServer())
        .post(`/centro-copiado/${ruta}`)
        .auth(tokens.autorizado, { type: 'bearer' })
        .set('x-tenant-id', tenants[1])
        .send(body)
        .expect(201);
      expect(servicio[metodo]).toHaveBeenCalledWith(tenants[0], body);
      expect(capacidades.exigirIncluida).toHaveBeenCalledWith(
        tenants[0],
        'centro_copiado',
      );
    },
  );

  it('retirar el permiso impide ambas escrituras sin renovar la sesión', async () => {
    await prisma.rol.update({
      where: { id: roles.autorizado },
      data: { permisos: ['comercial.ver'] },
    });
    for (const [ruta, metodo] of escrituras) {
      await request(app.getHttpServer())
        .post(`/centro-copiado/${ruta}`)
        .auth(tokens.autorizado, { type: 'bearer' })
        .send(body)
        .expect(403);
      expect(servicio[metodo]).not.toHaveBeenCalled();
    }
  });
});
