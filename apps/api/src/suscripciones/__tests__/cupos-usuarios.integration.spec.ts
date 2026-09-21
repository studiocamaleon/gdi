import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { AuthService } from '../../auth/auth.service';
import { CapacidadesEmpresaService } from '../capacidades-empresa.service';
import { SuscripcionesService } from '../suscripciones.service';
import { SuscripcionesPlataformaService } from '../../plataforma/suscripciones-plataforma.service';
import {
  AjustarCupoUsuariosDto,
  SuscripcionesPlataformaController,
} from '../../plataforma/suscripciones-plataforma.controller';
import { PlataformaAdminGuard } from '../../plataforma/plataforma-admin.guard';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { limiteUsuarios, resumenCupoUsuarios } from '../cupos-usuarios';

const db = new PrismaClient();
const prisma = db as PrismaService;
const cache = { invalidarTenant: jest.fn() };
const usuarios = new UsuariosService(prisma, cache as never, {} as never);
const authService = new AuthService(
  prisma,
  {} as never,
  cache as never,
  {} as never,
);
const plataforma = new SuscripcionesPlataformaService(
  prisma,
  {} as never,
  {} as never,
);
let tenantId: string,
  otroTenant: string,
  planId: string,
  suscripcionId: string,
  rolId: string;
let auth: CurrentAuth, staff: CurrentAuth, prefijo: string;
const email = () => `${prefijo}-${randomUUID()}@test.invalid`;
const futuro = () => new Date(Date.now() + 3600000);
async function persona(activa?: boolean) {
  const u = await db.user.create({
    data: { email: email(), passwordHash: 'no-se-usa-en-la-prueba' },
  });
  if (activa !== undefined)
    await db.membership.create({
      data: { tenantId, userId: u.id, rol: 'OPERADOR', rolId, activa },
    });
  return u;
}
async function invitacion(
  correo = email(),
  userId?: string,
  estado: 'vigente' | 'vencida' | 'aceptada' | 'revocada' = 'vigente',
) {
  const token = randomUUID();
  const fila = await db.invitation.create({
    data: {
      tenantId,
      email: correo,
      userId,
      rol: 'OPERADOR',
      rolId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: estado === 'vencida' ? new Date(0) : futuro(),
      ...(estado === 'aceptada' ? { acceptedAt: new Date() } : {}),
      ...(estado === 'revocada' ? { revokedAt: new Date() } : {}),
    },
  });
  return { ...fila, token };
}
async function alta(correo = email()) {
  return usuarios.crear(auth, { email: correo, rolId });
}
async function limite(n: number) {
  await db.plan.update({
    where: { id: planId },
    data: { featuresJson: { usuariosMax: n } },
  });
}

beforeEach(async () => {
  prefijo = `cupos-${randomUUID()}`;
  planId = (
    await db.plan.create({
      data: {
        codigo: randomUUID(),
        nombre: 'Plan de cupos de prueba',
        precioMensual: 0,
        featuresJson: { usuariosMax: 3 },
      },
    })
  ).id;
  const t = await db.tenant.create({
    data: {
      slug: randomUUID(),
      nombre: 'Cupos de prueba',
      suscripcion: { create: { planId } },
    },
    include: { suscripcion: true },
  });
  tenantId = t.id;
  suscripcionId = t.suscripcion!.id;
  otroTenant = (
    await db.tenant.create({
      data: { slug: randomUUID(), nombre: 'Otra empresa de prueba' },
    })
  ).id;
  rolId = (
    await db.rol.create({
      data: { tenantId, nombre: 'Operador', permisos: ['produccion.ver'] },
    })
  ).id;
  const admin = await persona(true);
  auth = {
    userId: admin.id,
    email: admin.email,
    tenantId,
    membershipId: (
      await db.membership.findFirstOrThrow({
        where: { tenantId, userId: admin.id },
      })
    ).id,
    sessionId: randomUUID(),
    role: 'ADMINISTRADOR',
  };
  const operador = await db.user.create({
    data: {
      email: email(),
      rolPlataforma: 'ADMIN',
      mfa: {
        create: {
          activatedAt: new Date(0),
          recuperacionConfirmadaEl: new Date(0),
        },
      },
    },
  });
  const sesion = await db.authSession.create({
    data: {
      userId: operador.id,
      expiresAt: futuro(),
      mfaVerificadoEl: new Date(),
    },
  });
  staff = {
    ...auth,
    userId: operador.id,
    email: operador.email,
    tenantId: '',
    membershipId: '',
    sessionId: sesion.id,
    esPlataforma: true,
  };
});
afterEach(async () => {
  await db.plataformaEvento.deleteMany({
    where: { staffUserId: staff.userId },
  });
  await db.tenant.deleteMany({ where: { id: { in: [tenantId, otroTenant] } } });
  await db.user.deleteMany({ where: { email: { startsWith: prefijo } } });
  await db.plan.delete({ where: { id: planId } });
});
afterAll(() => db.$disconnect());

it('cuenta activos y reservas vigentes una sola vez; excluye bajas, vencidas, aceptadas y revocadas', async () => {
  await persona(false);
  await invitacion(auth.email, auth.userId);
  const correo = email();
  await invitacion(correo);
  await invitacion(correo.toUpperCase());
  await invitacion(email(), undefined, 'vencida');
  await invitacion(email(), undefined, 'aceptada');
  await invitacion(email(), undefined, 'revocada');
  await db.membership.create({
    data: { tenantId: otroTenant, userId: staff.userId, rol: 'ADMINISTRADOR' },
  });
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    activos: 1,
    invitacionesPendientes: 1,
    ocupados: 2,
    disponibles: 1,
    incluidos: 3,
    adicionales: 0,
  });
  const listado = await usuarios.listar(auth);
  expect(listado.enUso).toBe(2);
  expect(listado.invitaciones).toHaveLength(1);
  expect(listado.invitaciones[0]).not.toHaveProperty('tokenHash');
});

it('tres altas simultáneas compiten por los dos lugares libres sin superar el límite', async () => {
  const r = await Promise.allSettled([alta(), alta(), alta()]);
  expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(2);
  expect(r.filter((x) => x.status === 'rejected')).toHaveLength(1);
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    ocupados: 3,
    disponibles: 0,
  });
});

it('alta y reactivación simultáneas compiten por el mismo lugar', async () => {
  await limite(2);
  const inactivo = await persona(false);
  const r = await Promise.allSettled([
    alta(),
    usuarios.editar(auth, inactivo.id, { activa: true }),
  ]);
  expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    ocupados: 2,
  });
});

it('dos altas del mismo correo no se pisan ni generan dos claves válidas', async () => {
  const correo = email();
  const r = await Promise.allSettled([alta(correo), alta(correo)]);
  expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    ocupados: 2,
  });
});

it('desactivar libera el lugar y revoca invitaciones que podrían devolver acceso', async () => {
  const u = await persona(true);
  await invitacion(u.email, u.id);
  await usuarios.editar(auth, u.id, { activa: false });
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    ocupados: 1,
  });
  expect(
    await db.invitation.count({ where: { tenantId, revokedAt: null } }),
  ).toBe(0);
});

it('cancelar una invitación libera sus duplicados y respeta la empresa', async () => {
  const i = await invitacion();
  await invitacion(i.email);
  await expect(
    usuarios.cancelarInvitacion({ ...auth, tenantId: otroTenant }, i.id),
  ).rejects.toThrow('no existe');
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    ocupados: 2,
  });
  await usuarios.cancelarInvitacion(auth, i.id);
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    ocupados: 1,
  });
});

it('aceptar sustituye la reserva en un cupo lleno y conserva el rol invitado', async () => {
  await limite(2);
  const u = await persona();
  await db.userMfa.create({ data: { userId: u.id, activatedAt: new Date() } });
  const i = await invitacion(u.email, u.id);
  await expect(alta()).rejects.toMatchObject({
    response: { code: 'CUPO_USUARIOS_AGOTADO' },
  });
  await authService.acceptInvitation(i.token, {});
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    activos: 2,
    invitacionesPendientes: 0,
    ocupados: 2,
  });
  expect(
    await db.membership.findFirst({ where: { tenantId, userId: u.id } }),
  ).toMatchObject({ activa: true, rolId });
  await expect(authService.acceptInvitation(i.token, {})).rejects.toThrow();
});

it('el alta con clave provisoria puede sustituir una reserva en un cupo lleno', async () => {
  await limite(2);
  const i = await invitacion();
  await alta(i.email);
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    activos: 2,
    invitacionesPendientes: 0,
  });
});

it('una invitación vencida no habilita acceso y ya no ocupa cupo', async () => {
  const i = await invitacion(email(), undefined, 'vencida');
  await expect(authService.acceptInvitation(i.token, {})).rejects.toThrow();
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    ocupados: 1,
  });
});

it('la invitación desde empleados reserva cupo sin activar el acceso antes de aceptarla', async () => {
  const empleado = await db.empleado.create({
    data: {
      tenantId,
      nombreCompleto: 'Persona de prueba',
      emailPrincipal: email(),
      telefonoCodigo: '+54',
      telefonoNumero: '2902000000',
      sector: 'Producción',
      fechaIngreso: new Date(),
    },
  });
  const correo = email();
  await authService.provisionEmployeeAccess(
    auth,
    empleado.id,
    correo,
    'OPERADOR',
  );
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    activos: 1,
    invitacionesPendientes: 1,
  });
  await authService.provisionEmployeeAccess(
    auth,
    empleado.id,
    correo,
    'OPERADOR',
  );
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    ocupados: 2,
  });
  await authService.revokeEmployeeAccess(auth, empleado.id);
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    ocupados: 1,
  });
});

it('la vía de empleados tampoco permite superar el límite y revierte su alta de usuario', async () => {
  await limite(1);
  const empleado = await db.empleado.create({
    data: {
      tenantId,
      nombreCompleto: 'Persona de prueba',
      emailPrincipal: email(),
      telefonoCodigo: '+54',
      telefonoNumero: '2902000000',
      sector: 'Producción',
      fechaIngreso: new Date(),
    },
  });
  const correo = email();
  await expect(
    authService.provisionEmployeeAccess(auth, empleado.id, correo, 'OPERADOR'),
  ).rejects.toMatchObject({ response: { code: 'CUPO_USUARIOS_AGOTADO' } });
  expect(await db.user.findUnique({ where: { email: correo } })).toBeNull();
});

it('si el contrato baja por debajo del uso conserva accesos y bloquea nuevas altas', async () => {
  await persona(true);
  await limite(1);
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    ocupados: 2,
    excedidos: 1,
    disponibles: 0,
  });
  await expect(alta()).rejects.toMatchObject({
    response: { code: 'CUPO_USUARIOS_AGOTADO' },
  });
  expect(await db.membership.count({ where: { tenantId, activa: true } })).toBe(
    2,
  );
});

it('un ajuste de adicionales cambia el cupo real, conserva el plan y deja auditoría', async () => {
  const r = await plataforma.ajustarCupoUsuarios(staff, suscripcionId, {
    adicionales: 2,
    anteriores: 0,
    motivo: 'Ampliación acordada de prueba',
  });
  expect(r).toMatchObject({ incluidos: 3, adicionales: 2, limite: 5 });
  expect(
    (await new CapacidadesEmpresaService(prisma).actual(tenantId)).contrato
      .limites.usuariosMax,
  ).toBe(5);
  expect(
    (
      await new SuscripcionesService(
        prisma,
        {} as never,
        {} as never,
        {} as never,
      ).limites(tenantId)
    ).usuariosMax,
  ).toBe(5);
  expect(await db.plan.findUnique({ where: { id: planId } })).toMatchObject({
    featuresJson: { usuariosMax: 3 },
  });
  expect(
    await db.plataformaEvento.findFirst({
      where: { tenantAfectadoId: tenantId },
    }),
  ).toMatchObject({
    tipo: 'suscripcion_cupo_usuarios_ajustado',
    staffUserId: staff.userId,
  });
});

it('rechaza ajustes de soporte, suplantación y sesiones sin MFA vigente', async () => {
  const dto = { adicionales: 1, anteriores: 0, motivo: 'Ampliación de prueba' };
  await expect(
    plataforma.ajustarCupoUsuarios(auth, suscripcionId, dto),
  ).rejects.toMatchObject({ status: 403 });
  await db.user.update({
    where: { id: staff.userId },
    data: { rolPlataforma: 'SOPORTE' },
  });
  await expect(
    plataforma.ajustarCupoUsuarios(staff, suscripcionId, dto),
  ).rejects.toMatchObject({ status: 403 });
  await db.user.update({
    where: { id: staff.userId },
    data: { rolPlataforma: 'ADMIN' },
  });
  await db.authSession.update({
    where: { id: staff.sessionId },
    data: { mfaVerificadoEl: null },
  });
  await expect(
    plataforma.ajustarCupoUsuarios(staff, suscripcionId, dto),
  ).rejects.toMatchObject({ status: 403 });
});

it('evita pisar ajustes simultáneos y reducir por debajo de la ocupación', async () => {
  const r = await Promise.allSettled(
    [1, 2].map((adicionales) =>
      plataforma.ajustarCupoUsuarios(staff, suscripcionId, {
        adicionales,
        anteriores: 0,
        motivo: 'Ampliación de prueba',
      }),
    ),
  );
  expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  const cupo = await resumenCupoUsuarios(db, tenantId);
  await persona(true);
  await persona(true);
  await persona(true);
  await expect(
    plataforma.ajustarCupoUsuarios(staff, suscripcionId, {
      adicionales: 0,
      anteriores: cupo.adicionales,
      motivo: 'Reducir cupo de prueba',
    }),
  ).rejects.toThrow('ocupados');
});

it('los adicionales manuales no alteran una suscripción facturada por Paddle', async () => {
  await db.suscripcion.update({
    where: { id: suscripcionId },
    data: { proveedor: 'paddle' },
  });
  expect(await plataforma.cupoUsuarios(suscripcionId)).toMatchObject({
    editable: false,
  });
  await expect(
    plataforma.ajustarCupoUsuarios(staff, suscripcionId, {
      adicionales: 1,
      anteriores: 0,
      motivo: 'Prueba de adicionales',
    }),
  ).rejects.toThrow('integración comercial');
});

it('mantiene Founder y cuentas legacy ilimitadas; cero no significa ilimitado', async () => {
  expect(
    limiteUsuarios({ featuresJson: { todo: true, usuariosMax: 3 } }, 4).limite,
  ).toBeNull();
  expect(limiteUsuarios(null).limite).toBeNull();
  expect(limiteUsuarios({ featuresJson: { usuariosMax: 0 } }).limite).toBe(0);
  await db.plan.update({
    where: { id: planId },
    data: { featuresJson: { todo: true, usuariosMax: 1 } },
  });
  await alta();
  expect(await resumenCupoUsuarios(db, tenantId)).toMatchObject({
    limite: null,
    disponibles: null,
  });
});

it('el endpoint exige admin y rechaza negativos, decimales y propiedades inyectadas', async () => {
  expect(
    Reflect.getMetadata(
      '__guards__',
      // eslint-disable-next-line @typescript-eslint/unbound-method
      SuscripcionesPlataformaController.prototype.ajustarCupoUsuarios,
    ),
  ).toContain(PlataformaAdminGuard);
  for (const datos of [
    { adicionales: -1, anteriores: 0, motivo: 'Motivo válido' },
    { adicionales: 1.5, anteriores: 0, motivo: 'Motivo válido' },
    { adicionales: 1, anteriores: 0, motivo: 'x' },
    {
      adicionales: 1,
      anteriores: 0,
      motivo: 'Motivo válido',
      tenantId: otroTenant,
    },
  ])
    expect(
      await validate(plainToInstance(AjustarCupoUsuariosDto, datos), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).not.toHaveLength(0);
});
