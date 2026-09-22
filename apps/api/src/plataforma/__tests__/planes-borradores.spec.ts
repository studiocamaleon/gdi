import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CATALOGO_PLANES,
  PROPUESTA_PLANES,
  VERSION_CATALOGO_PLANES,
} from '../planes/catalogo-planes';
import { problemasPlan, revisionComercial } from '../planes/validacion-planes';
import { PlanesBorradoresService } from '../planes/planes-borradores.service';
import {
  GuardarPlanesDto,
  PlanesBorradoresController,
} from '../planes/planes-borradores.controller';
import { PlataformaGuard } from '../plataforma.guard';
import { PlataformaAdminGuard } from '../plataforma-admin.guard';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';

const prisma = new PrismaClient();
const service = new PlanesBorradoresService(prisma as unknown as PrismaService);
let admin: CurrentAuth, soporte: CurrentAuth;
const usuarios: string[] = [],
  borradores: string[] = [];
const contenido = () => structuredClone(PROPUESTA_PLANES[0].contenido);

async function actor(rol: 'ADMIN' | 'SOPORTE') {
  const u = await prisma.user.create({
    data: {
      email: `planes-${randomUUID()}@test.local`,
      passwordHash: 'no-login',
      rolPlataforma: rol,
    },
  });
  usuarios.push(u.id);
  await prisma.userMfa.create({
    data: {
      userId: u.id,
      activatedAt: new Date(1),
      recuperacionConfirmadaEl: new Date(2),
    },
  });
  const s = await prisma.authSession.create({
    data: {
      userId: u.id,
      expiresAt: new Date(Date.now() + 3600000),
      mfaVerificadoEl: new Date(),
    },
  });
  return {
    userId: u.id,
    email: u.email,
    sessionId: s.id,
    esPlataforma: true,
    plataformaMfaPendiente: false,
    tenantId: '',
    membershipId: '',
    role: 'ADMINISTRADOR',
  } satisfies CurrentAuth;
}
async function borrador() {
  const p = await prisma.planBorrador.create({
    data: {
      codigo: `test-${randomUUID()}`,
      orden: 100,
      contenido: contenido(),
    },
  });
  borradores.push(p.id);
  return p;
}
beforeAll(async () => {
  admin = await actor('ADMIN');
  soporte = await actor('SOPORTE');
});
afterEach(async () => {
  await prisma.planBorrador.deleteMany({ where: { id: { in: borradores } } });
  borradores.length = 0;
});
afterAll(async () => {
  await prisma.plataformaEvento.deleteMany({
    where: { staffUserId: { in: usuarios } },
  });
  await prisma.authSession.deleteMany({ where: { userId: { in: usuarios } } });
  await prisma.user.deleteMany({ where: { id: { in: usuarios } } });
  await prisma.$disconnect();
});

it('incluye el catálogo del barrido y dependencias conocidas sin ciclos', () => {
  expect(CATALOGO_PLANES).toHaveLength(66);
  expect(new Set(CATALOGO_PLANES.map((c) => c.clave)).size).toBe(66);
  function recorrer(clave: string, anteriores: string[] = []) {
    expect(anteriores).not.toContain(clave);
    const c = CATALOGO_PLANES.find((c) => c.clave === clave)!;
    expect(c).toBeDefined();
    for (const d of c.requiere) recorrer(d, [...anteriores, clave]);
  }
  CATALOGO_PLANES.forEach((c) => recorrer(c.clave));
});
it('una oferta mensual configurada sólo deja pendiente el anual opcional', () => {
  const p = contenido();
  p.almacenamientoModo = 'limitado';
  p.almacenamientoGb = 250;
  p.precios = {
    moneda: 'USD',
    mensual: 190,
    anual: null,
    usuarioMensual: 15,
    usuarioAnual: null,
  };
  const revision = revisionComercial(p);
  expect(revision.controlesPendientes).toBe(0);
  expect(revision.pendientes).toContain(
    'Definir el precio anual si se ofrecerá esa modalidad.',
  );
  expect(revision.pendientes).not.toContain('Definir el precio mensual.');
  expect(
    revision.pendientes.some((s) =>
      s.includes('Definir el precio de usuarios adicionales'),
    ),
  ).toBe(false);
});
it('al incorporar modalidad anual exige su precio de usuarios adicionales', () => {
  const p = contenido();
  p.precios = {
    moneda: 'USD',
    mensual: 190,
    anual: 2280,
    usuarioMensual: 15,
    usuarioAnual: null,
  };
  expect(revisionComercial(p).pendientes).toContain(
    'Definir el precio de usuarios adicionales para las modalidades ofrecidas.',
  );
});
it('precarga la propuesta acumulativa 3/20/40 sin impresión directa ni fabricación adicional', () => {
  expect(PROPUESTA_PLANES.map((p) => p.contenido.usuariosIncluidos)).toEqual([
    3, 20, 40,
  ]);
  for (let i = 0; i < 3; i++) {
    const p = PROPUESTA_PLANES[i].contenido;
    expect(problemasPlan(p)).toEqual([]);
    expect(p.adicionalesPermitidos).toBe(true);
    expect(p.funciones.impresion_directa).toBe(false);
    expect(p.funciones.exportacion_fabricacion).toBe(false);
    expect(p.funciones.centro_copiado).toBe(true);
    expect(p.funciones.cotizacion_cad).toBe(true);
    if (i)
      for (const [k, v] of Object.entries(
        PROPUESTA_PLANES[i - 1].contenido.funciones,
      ))
        if (v) expect(p.funciones[k]).toBe(true);
  }
  expect(PROPUESTA_PLANES[0].contenido.funciones.compras).toBe(false);
  expect(PROPUESTA_PLANES[1].contenido.funciones.compras).toBe(true);
  expect(PROPUESTA_PLANES[1].contenido.funciones.planificacion_avanzada).toBe(
    false,
  );
  expect(PROPUESTA_PLANES[2].contenido.funciones.planificacion_avanzada).toBe(
    true,
  );
});
it.each(['desconocida', 'impresion_directa', 'exportacion_fabricacion'])(
  'rechaza activar la clave no disponible %s',
  (clave) => {
    const p = contenido();
    p.funciones[clave] = true;
    expect(problemasPlan(p).length).toBeGreaterThan(0);
  },
);
it('separa cuotas y funciones y valida dependencias y bases obligatorias', () => {
  const p = contenido();
  p.funciones.centro_copiado = false;
  p.funciones.identidad = false;
  p.usuariosIncluidos = 0;
  expect(problemasPlan(p).join(' ')).toContain('requiere');
  expect(problemasPlan(p).join(' ')).toContain('base');
  expect(problemasPlan(p).join(' ')).toContain('usuarios');
  p.almacenamientoModo = 'limitado';
  p.almacenamientoGb = null;
  expect(problemasPlan(p).join(' ')).toContain('almacenamiento');
});
it('valida DTO anidado y rechaza campos extra, coerciones y revisiones ausentes', async () => {
  const good = {
    catalogoVersion: 2,
    cambios: [{ id: randomUUID(), revision: 1, contenido: contenido() }],
  };
  expect(
    await validate(plainToInstance(GuardarPlanesDto, good), {
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  ).toHaveLength(0);
  good.cambios[0].contenido = {
    ...contenido(),
    usuariosIncluidos: '40',
    publico: true,
  } as never;
  expect(
    (
      await validate(plainToInstance(GuardarPlanesDto, good), {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    ).length,
  ).toBeGreaterThan(0);
});
it('exige Plataforma y reserva las escrituras a administración', () => {
  const guardar = Object.getOwnPropertyDescriptor(
    PlanesBorradoresController.prototype,
    'guardar',
  );
  expect(
    Reflect.getMetadata('__guards__', PlanesBorradoresController),
  ).toContain(PlataformaGuard);
  expect(Reflect.getMetadata('__guards__', guardar?.value as object)).toContain(
    PlataformaAdminGuard,
  );
});
it('persiste varios borradores, aumenta revisiones y audita sin alterar planes vigentes', async () => {
  const p = await borrador(),
    q = await borrador();
  const planesAntes = await prisma.plan.findMany({ orderBy: { id: 'asc' } });
  const result = await service.guardar(admin, {
    catalogoVersion: VERSION_CATALOGO_PLANES,
    cambios: [p, q].map((x) => ({
      id: x.id,
      revision: 1,
      contenido: {
        ...contenido(),
        nombre: 'Propuesta editada',
        usuariosIncluidos: 5,
        precios: {
          moneda: 'USD',
          mensual: 190,
          anual: null,
          usuarioMensual: 15,
          usuarioAnual: null,
        },
      },
    })),
  });
  expect(result.borradores.map((x) => x.revision)).toEqual([2, 2]);
  expect(result.borradores[0].contenido.usuariosIncluidos).toBe(5);
  expect(result.borradores[0].contenido.precios).toMatchObject({
    mensual: 190,
    anual: null,
    usuarioMensual: 15,
  });
  expect(await prisma.plan.findMany({ orderBy: { id: 'asc' } })).toEqual(
    planesAntes,
  );
  const evento = await prisma.plataformaEvento.findFirstOrThrow({
    where: {
      staffUserId: admin.userId,
      tipo: 'plan_borrador_actualizado',
      datosJson: { path: ['borradorId'], equals: p.id },
    },
  });
  expect(evento.datosJson).toMatchObject({
    revisionAnterior: 1,
    despues: { usuariosIncluidos: 5 },
  });
});
it('valida precios positivos y decimales sin convertir pendientes en gratuitos', async () => {
  const precios = {
    moneda: 'USD' as const,
    mensual: 190,
    anual: null,
    usuarioMensual: 15,
    usuarioAnual: null,
  };
  expect(problemasPlan({ ...contenido(), precios })).toEqual([]);
  for (const mensual of [0, -1, 190.001, Infinity, NaN, '190', undefined]) {
    expect(
      problemasPlan({
        ...contenido(),
        precios: { ...precios, mensual } as never,
      }).join(' '),
    ).toContain('precio mensual');
  }
  expect(
    problemasPlan({
      ...contenido(),
      precios: { ...precios, moneda: 'ARS' } as never,
    }).join(' '),
  ).toContain('USD');
  const dto = {
    catalogoVersion: 2,
    cambios: [
      { id: randomUUID(), revision: 1, contenido: { ...contenido(), precios } },
    ],
  };
  expect(
    await validate(plainToInstance(GuardarPlanesDto, dto), {
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  ).toHaveLength(0);
  Object.assign(dto.cambios[0].contenido.precios, {
    paddlePriceId: 'no-autorizado',
  });
  expect(
    (
      await validate(plainToInstance(GuardarPlanesDto, dto), {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    ).length,
  ).toBeGreaterThan(0);
});
it('soporte y sesiones ajenas o sin MFA no pueden guardar ni llamando al servicio', async () => {
  const p = await borrador();
  const dto = {
    catalogoVersion: 2,
    cambios: [{ id: p.id, revision: 1, contenido: contenido() }],
  };
  for (const a of [
    soporte,
    { ...admin, esPlataforma: false },
    { ...admin, plataformaMfaPendiente: true },
    { ...admin, sessionId: soporte.sessionId },
  ])
    await expect(service.guardar(a, dto)).rejects.toThrow(
      /administración|personal/,
    );
  expect(
    (await prisma.planBorrador.findUniqueOrThrow({ where: { id: p.id } }))
      .revision,
  ).toBe(1);
});
it('rechaza catálogos viejos y cambios duplicados', async () => {
  const p = await borrador();
  const cambio = { id: p.id, revision: 1, contenido: contenido() };
  await expect(
    service.guardar(admin, { catalogoVersion: 0, cambios: [cambio] }),
  ).rejects.toThrow('catálogo');
  await expect(
    service.guardar(admin, { catalogoVersion: 2, cambios: [cambio, cambio] }),
  ).rejects.toThrow('lista');
});
it('dos editores no se pisan y un conflicto revierte el lote completo', async () => {
  const a = await borrador(),
    b = await borrador();
  const dto = {
    catalogoVersion: 2,
    cambios: [{ id: a.id, revision: 1, contenido: contenido() }],
  };
  const resultados = await Promise.allSettled([
    service.guardar(admin, dto),
    service.guardar(admin, dto),
  ]);
  expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(resultados.filter((r) => r.status === 'rejected')).toHaveLength(1);
  await expect(
    service.guardar(admin, {
      catalogoVersion: 2,
      cambios: [
        { id: b.id, revision: 1, contenido: contenido() },
        { id: a.id, revision: 1, contenido: contenido() },
      ],
    }),
  ).rejects.toThrow(/actualizó|cambió/);
  expect(
    (await prisma.planBorrador.findUniqueOrThrow({ where: { id: b.id } }))
      .revision,
  ).toBe(1);
});
