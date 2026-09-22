/* Matchers de Jest y transporte simulado; persistencia en la base dedicada de pruebas. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { PrismaClient, Prisma } from '@prisma/client';
import { PROPUESTA_PLANES } from '../planes/catalogo-planes';
import { createHash, randomUUID } from 'node:crypto';
import { PlataformaService } from '../plataforma.service';
import { InvitacionesEmpresaService } from '../invitaciones-empresa.service';
import { EmpresasPlataformaService } from '../empresas.service';
import { TenantProvisioningService } from '../../provisionamiento/tenant-provisioning.service';
import { PrismaService } from '../../prisma/prisma.service';
import { conPlanesAsignados } from '../../../test/soporte-planes-asignados';
import { PlataformaController } from '../plataforma.controller';
import { PlataformaAdminGuard } from '../plataforma-admin.guard';
import { AuthService } from '../../auth/auth.service';
import { SessionCacheService } from '../../auth/session-cache.service';
import { JwtService } from '@nestjs/jwt';

const prisma = new PrismaClient();
const db = prisma as unknown as PrismaService;
const auth = new AuthService(
  db,
  new JwtService({ secret: 'prueba-invitaciones' }),
  new SessionCacheService(),
  {} as never,
);
const enviar = jest.fn();
const invitaciones = new InvitacionesEmpresaService(db, {
  enviarInvitacionEmpresa: enviar,
} as never);
const plataforma = new PlataformaService(
  db,
  {} as never,
  new TenantProvisioningService(),
  invitaciones,
);
let staffId: string, planId: string;
const tenants: string[] = [];
beforeAll(async () => {
  staffId = (
    await prisma.user.create({
      data: { email: `${randomUUID()}@test.local`, rolPlataforma: 'ADMIN' },
    })
  ).id;
  planId = (
    await prisma.plan.create({
      data: {
        codigo: randomUUID(),
        nombre: 'Co-founder de prueba',
        precioMensual: 290,
        trialDias: 30,
        featuresJson: { usuariosMax: 20 },
        publico: false,
      },
    })
  ).id;
});
beforeEach(() => {
  enviar.mockReset().mockResolvedValue({ id: 'correo-simulado' });
});
afterAll(async () => {
  await prisma.plataformaEvento.deleteMany({ where: { staffUserId: staffId } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
  await prisma.plan.delete({ where: { id: planId } });
  await prisma.user.delete({ where: { id: staffId } });
  await prisma.$disconnect();
});

async function crear(email = ' Invitada@example.com ') {
  const r = await plataforma.crearTenant(staffId, {
    nombre: 'Empresa invitada',
    slug: `invitada-${randomUUID().slice(0, 12)}`,
    planId,
    adminEmail: email,
  });
  tenants.push(r.tenantId);
  return r;
}
async function habilitarReenvio(id: string) {
  await prisma.invitation.update({
    where: { id },
    data: { correoIntentoEl: new Date(Date.now() - 180000) },
  });
}

it('persiste el alta antes de enviar, conserva el plazo real y audita sin guardar el token en claro', async () => {
  enviar.mockImplementation(async (datos: { empresa: string }) => {
    expect(
      await prisma.tenant.count({ where: { nombre: datos.empresa } }),
    ).toBeGreaterThan(0);
    return { id: 'correo-simulado' };
  });
  const r = await crear();
  const s = await prisma.suscripcion.findUniqueOrThrow({
    where: { tenantId: r.tenantId },
  });
  expect(enviar).toHaveBeenCalledWith(
    expect.objectContaining({
      para: 'invitada@example.com',
      plan: 'Co-founder de prueba',
      mensual: 290,
      trialHasta: s.trialHasta,
    }),
    expect.objectContaining({ idempotencyKey: expect.any(String) }),
  );
  expect(s.trialHasta!.getTime() - Date.now()).toBeGreaterThan(29 * 86400000);
  expect(r.invitacion.correoEstado).toBe('enviado');
  const token = new URL(r.invitacionUrl!).searchParams.get('token')!;
  const guardada = await prisma.invitation.findUniqueOrThrow({
    where: { id: r.invitacion.id },
  });
  expect(guardada.tokenHash).toBe(
    createHash('sha256').update(token).digest('hex'),
  );
  expect(guardada.correoProveedorId).toBe('correo-simulado');
  const eventos = await prisma.plataformaEvento.findMany({
    where: { tenantAfectadoId: r.tenantId },
  });
  expect(JSON.stringify(eventos)).not.toContain(token);
  expect(eventos.some((e) => e.tipo === 'invitacion_empresa_enviada')).toBe(
    true,
  );
});

it('si falla el proveedor conserva la empresa, informa el error y permite recuperarla desde su ficha', async () => {
  enviar.mockRejectedValueOnce(new Error('Proveedor no disponible'));
  const r = await crear();
  expect(r.invitacion.correoEstado).toBe('error');
  expect(
    await prisma.tenant.findUnique({ where: { id: r.tenantId } }),
  ).not.toBeNull();
  const detalle = await new EmpresasPlataformaService(db).detalle(r.tenantId);
  expect(detalle.invitacionAdministrador).toMatchObject({
    correoEstado: 'error',
    email: 'invitada@example.com',
  });
  expect(detalle.invitacionAdministrador).not.toHaveProperty('tokenHash');
  await habilitarReenvio(r.invitacion.id);
  const segundo = await invitaciones.reenviar(staffId, r.tenantId);
  expect(segundo.invitacion.correoEstado).toBe('enviado');
  expect(segundo.tenantId).toBe(r.tenantId);
  expect(segundo.invitacion.id).toBe(r.invitacion.id);
  expect(segundo.invitacionUrl).not.toBe(r.invitacionUrl);
});

it('dos reenvíos simultáneos generan un solo envío y no prorrogan la prueba', async () => {
  const r = await crear();
  const antes = await prisma.suscripcion.findUniqueOrThrow({
    where: { tenantId: r.tenantId },
  });
  await habilitarReenvio(r.invitacion.id);
  enviar.mockClear();
  const resultados = await Promise.allSettled([
    invitaciones.reenviar(staffId, r.tenantId),
    invitaciones.reenviar(staffId, r.tenantId),
  ]);
  expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(enviar).toHaveBeenCalledTimes(1);
  const despues = await prisma.suscripcion.findUniqueOrThrow({
    where: { tenantId: r.tenantId },
  });
  expect(despues.trialHasta).toEqual(antes.trialHasta);
});

it.each(['aceptada', 'revocada', 'bloqueada', 'trial_vencido'])(
  'impide reenviar una invitación %s',
  async (situacion) => {
    const r = await crear();
    await habilitarReenvio(r.invitacion.id);
    if (situacion === 'aceptada')
      await prisma.invitation.update({
        where: { id: r.invitacion.id },
        data: { acceptedAt: new Date() },
      });
    if (situacion === 'revocada')
      await prisma.invitation.update({
        where: { id: r.invitacion.id },
        data: { revokedAt: new Date() },
      });
    if (situacion === 'bloqueada')
      await prisma.tenant.update({
        where: { id: r.tenantId },
        data: { activo: false },
      });
    if (situacion === 'trial_vencido')
      await prisma.suscripcion.update({
        where: { tenantId: r.tenantId },
        data: { trialHasta: new Date(1) },
      });
    enviar.mockClear();
    await expect(invitaciones.reenviar(staffId, r.tenantId)).rejects.toThrow();
    expect(enviar).not.toHaveBeenCalled();
  },
);

it('renueva un enlace vencido sin crear otra invitación', async () => {
  const r = await crear();
  await habilitarReenvio(r.invitacion.id);
  await prisma.invitation.update({
    where: { id: r.invitacion.id },
    data: { expiresAt: new Date(1) },
  });
  const renovada = await invitaciones.reenviar(staffId, r.tenantId);
  expect(new Date(renovada.invitacion.venceEl).getTime()).toBeGreaterThan(
    Date.now() + 6 * 86400000,
  );
  expect(
    await prisma.invitation.count({ where: { tenantId: r.tenantId } }),
  ).toBe(1);
  await expect(
    auth.getInvitation(new URL(r.invitacionUrl!).searchParams.get('token')!),
  ).rejects.toThrow();
});

it.each([false, true])(
  'recorre alta, correo y aceptación de una sola vez (usuario existente: %s)',
  async (existente) => {
    const email = `invitacion-${randomUUID()}@test.local`;
    if (existente)
      await prisma.user.create({
        data: { email, passwordHash: 'hash-que-no-debe-cambiar' },
      });
    try {
      const r = await crear(email);
      const token = new URL(r.invitacionUrl!).searchParams.get('token')!;
      expect((await auth.getInvitation(token)).requiresPasswordSetup).toBe(
        !existente,
      );
      await auth.acceptInvitation(
        token,
        existente ? {} : { password: 'clave-prueba-123' },
      );
      const i = await prisma.invitation.findUniqueOrThrow({
        where: { id: r.invitacion.id },
      });
      expect(i.acceptedAt).not.toBeNull();
      expect(
        await prisma.membership.count({
          where: { tenantId: r.tenantId, user: { email } },
        }),
      ).toBe(1);
      if (existente)
        expect(
          (await prisma.user.findUniqueOrThrow({ where: { email } }))
            .passwordHash,
        ).toBe('hash-que-no-debe-cambiar');
      await expect(auth.acceptInvitation(token, {})).rejects.toThrow();
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  },
);

it('el endpoint de reenvío está protegido para administradores de Plataforma', () => {
  expect(
    Reflect.getMetadata(
      '__guards__',
      PlataformaController.prototype.reenviarInvitacion,
    ),
  ).toContain(PlataformaAdminGuard);
});

it('Co-founder toma precio, exención y prueba de la oferta asignada, aunque el espejo del plan tenga otros valores', async () => {
  const cliente = new PrismaService();
  try {
    await conPlanesAsignados(cliente, async (c) => {
      const prisma = c.tx;
      const staffId = c.staff.userId;
      const plataforma = new PlataformaService(
        c.db,
        {} as never,
        new TenantProvisioningService(),
        new InvitacionesEmpresaService(c.db, {
          enviarInvitacionEmpresa: enviar,
        } as never),
      );
      const codigo = randomUUID();
      const contenido = {
        ...structuredClone(PROPUESTA_PLANES[1].contenido),
        nombre: 'Co-founder Pro publicado',
        almacenamientoModo: 'limitado',
        almacenamientoGb: 500,
        precios: {
          moneda: 'USD',
          mensual: 290,
          anual: 2900,
          usuarioMensual: 15,
          usuarioAnual: 150,
        },
        comercial: { acceso: 'invitacion', trialDias: 30, implementacion: 0 },
      };
      const borrador = await prisma.planBorrador.create({
        data: {
          codigo,
          contenido: contenido as unknown as Prisma.InputJsonValue,
          orden: 0,
        },
      });
      const version = await prisma.planVersion.create({
        data: {
          borradorId: borrador.id,
          codigo,
          numero: 1,
          revisionBorrador: 1,
          catalogoVersion: 2,
          contenido: contenido as unknown as Prisma.InputJsonValue,
          catalogoSnapshot: {},
          publicadoPorId: staffId,
          publicadoPorNombre: 'Prueba',
          motivo: 'Condiciones para invitación',
        },
      });
      const plan = await prisma.plan.create({
        data: {
          codigo,
          nombre: 'Espejo cambiado',
          precioMensual: 999,
          trialDias: 14,
          featuresJson: {},
          publico: false,
          comercialVersionado: true,
        },
      });
      const oferta = await prisma.planOferta.create({
        data: {
          planId: plan.id,
          versionId: version.id,
          entorno:
            process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox',
          trialDias: 30,
          registroPublico: false,
          recomendado: false,
          creadaPorId: staffId,
          motivo: 'Prueba',
          precios: {
            create: {
              entorno: 'sandbox',
              priceId: randomUUID(),
              productId: 'prueba',
              tipo: 'base',
              ciclo: 'mensual',
              importe: 290,
              moneda: 'USD',
              cantidadMaxima: 1,
            },
          },
        },
      });
      await prisma.plan.update({
        where: { id: plan.id },
        data: { ofertaActualId: oferta.id },
      });
      const r = await plataforma.crearTenant(staffId, {
        nombre: 'Invitación privada',
        slug: `privada-${codigo.slice(0, 8)}`,
        planId: plan.id,
        adminEmail: 'privada@example.com',
      });
      const tenantId = r.tenantId;
      expect(enviar).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: 'Co-founder Pro publicado',
          mensual: 290,
          implementacion: 0,
        }),
        expect.any(Object),
      );
      const s = await prisma.suscripcion.findUniqueOrThrow({
        where: { tenantId },
      });
      expect(s.ofertaId).toBe(oferta.id);
      expect(s.planVersionId).toBe(version.id);
      expect(s.trialHasta!.getTime() - Date.now()).toBeGreaterThan(
        29 * 86400000,
      );
    });
  } finally {
    await cliente.$disconnect();
  }
});
