import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PlataformaService } from '../plataforma.service';
import { EmpresasPlataformaService } from '../empresas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaddleService } from '../../cobro/paddle.service';
import { SuscripcionSyncService } from '../../cobro/suscripcion-sync.service';
import { TenantProvisioningService } from '../../provisionamiento/tenant-provisioning.service';
import { resolverAccesoEmpresa } from '../../suscripciones/acceso-empresa';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  EmpresasConsultaDto,
  SuspenderTenantDto,
} from '../plataforma.controller';

const prisma = new PrismaClient();
const db = prisma as unknown as PrismaService;
const plataforma = new PlataformaService(
  db,
  new PaddleService(),
  new TenantProvisioningService(),
);
const empresas = new EmpresasPlataformaService(db);
const sync = new SuscripcionSyncService(db);

describe('Empresas: acceso independiente del cobro', () => {
  const sufijo = randomUUID();
  let staffId: string;
  let planId: string;
  let otroPlanId: string;
  let tenantId: string;
  const tenants: string[] = [];

  beforeAll(async () => {
    staffId = (
      await prisma.user.create({
        data: {
          email: `empresas-${sufijo}@test.local`,
          rolPlataforma: 'ADMIN',
        },
      })
    ).id;
    planId = (
      await prisma.plan.create({
        data: {
          codigo: `empresas-${sufijo}`,
          nombre: 'Plan empresas test',
          precioMensual: 10,
          featuresJson: { todo: true, impresionDirecta: true },
        },
      })
    ).id;
    otroPlanId = (
      await prisma.plan.create({
        data: {
          codigo: `otro-${sufijo}`,
          nombre: 'Otro plan test',
          precioMensual: 20,
          featuresJson: { whatsapp: true },
        },
      })
    ).id;
  });
  beforeEach(async () => {
    tenantId = (
      await prisma.tenant.create({
        data: {
          nombre: `Empresas ${sufijo}`,
          slug: `empresa-${randomUUID()}`,
          suscripcion: { create: { planId } },
        },
      })
    ).id;
    tenants.push(tenantId);
  });
  afterAll(async () => {
    await prisma.plataformaEvento.deleteMany({
      where: { staffUserId: staffId },
    });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
    await prisma.user.delete({ where: { id: staffId } });
    await prisma.plan.deleteMany({
      where: { id: { in: [planId, otroPlanId] } },
    });
    await prisma.$disconnect();
  });

  it('un cambio de plan local nunca reemplaza un contrato de Paddle', async () => {
    await prisma.suscripcion.update({
      where: { tenantId },
      data: {
        proveedor: 'paddle',
        referenciaExterna: `sub_${sufijo}`,
        estadoProveedor: 'active',
      },
    });
    await expect(
      plataforma.cambiarPlan(
        staffId,
        tenantId,
        otroPlanId,
        'Cambio solicitado',
      ),
    ).rejects.toThrow('proveedor');
    expect((await empresas.detalle(tenantId)).suscripcion?.planId).toBe(planId);
    expect(
      await prisma.plataformaEvento.count({
        where: { tenantAfectadoId: tenantId },
      }),
    ).toBe(0);
  });

  it('bloquear, recibir un pago y levantar el bloqueo conserva el contrato y el motivo', async () => {
    const referencia = `sub_${randomUUID()}`;
    await prisma.suscripcion.update({
      where: { tenantId },
      data: {
        proveedor: 'paddle',
        referenciaExterna: referencia,
        estadoProveedor: 'past_due',
        estado: 'suspendida',
      },
    });
    await plataforma.suspenderTenant(
      staffId,
      tenantId,
      '  Revisión administrativa  ',
    );
    expect((await empresas.detalle(tenantId)).suscripcion?.estado).toBe(
      'suspendida',
    );
    await sync.aplicar({
      referencia,
      estadoProveedor: 'active',
      clienteExterno: null,
      proximoCobro: null,
      periodoDesde: null,
      precios: [],
      tenantId,
      cambioProgramado: null,
      cambioProgramadoEl: null,
    });
    const bloqueada = await empresas.detalle(tenantId);
    expect(bloqueada.acceso.modo).toBe('bloqueado');
    expect(bloqueada.bloqueo.motivo).toBe('Revisión administrativa');
    expect(bloqueada.suscripcion?.estadoProveedor).toBe('active');
    expect(bloqueada.funciones.every((f) => !f.habilitada)).toBe(true);
    await plataforma.reactivarTenant(staffId, tenantId, 'Revisión completada');
    expect((await empresas.detalle(tenantId)).acceso.modo).toBe('operativo');
    const historial = await empresas.historial(tenantId, 1, 25);
    expect(historial.total).toBe(2);
    expect(historial.eventos.map((e) => e.descripcion).join(' ')).toContain(
      'Revisión administrativa',
    );
  });

  it.each(['suspendida', 'baja'])(
    'levantar el bloqueo no reactiva una suscripción %s',
    async (estado) => {
      await prisma.suscripcion.update({
        where: { tenantId },
        data: {
          estado,
          proveedor: 'paddle',
          estadoProveedor: estado === 'baja' ? 'canceled' : 'past_due',
        },
      });
      await plataforma.suspenderTenant(
        staffId,
        tenantId,
        'Intervención de soporte',
      );
      await plataforma.reactivarTenant(
        staffId,
        tenantId,
        'Finalizó la intervención',
      );
      const empresa = await empresas.detalle(tenantId);
      expect(empresa.activo).toBe(true);
      expect(empresa.acceso.modo).toBe('solo_lectura');
      expect(empresa.suscripcion?.estado).toBe(estado);
    },
  );

  it('asignar un plan manual conserva fechas y estado, sin renovar una prueba vencida', async () => {
    const trialHasta = new Date('2020-01-01');
    const hasta = new Date('2020-02-01');
    await prisma.suscripcion.update({
      where: { tenantId },
      data: { estado: 'baja', trialHasta, hasta },
    });
    await plataforma.cambiarPlan(
      staffId,
      tenantId,
      otroPlanId,
      'Cambio administrativo acordado',
    );
    expect(
      await prisma.suscripcion.findUnique({ where: { tenantId } }),
    ).toMatchObject({ planId: otroPlanId, estado: 'baja', trialHasta, hasta });
  });

  it('los bloqueos históricos conservan su estado y no reciben un motivo inventado', async () => {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { activo: false },
    });
    const e = await empresas.detalle(tenantId);
    expect(e.bloqueo).toEqual({ motivo: null, desde: null });
    expect(e.acceso.descripcion).toContain('sin motivo registrado');
  });

  it('dos bloqueos simultáneos dejan una sola intervención', async () => {
    const r = await Promise.allSettled([
      plataforma.suspenderTenant(staffId, tenantId, 'Primer operador'),
      plataforma.suspenderTenant(staffId, tenantId, 'Segundo operador'),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(
      await prisma.plataformaEvento.count({
        where: { tenantAfectadoId: tenantId, tipo: 'tenant_suspendido' },
      }),
    ).toBe(1);
  });

  it('directorio paginado, filtros y búsqueda por correo no mezclan empresas', async () => {
    const paginas = await empresas.listar({ pagina: 1, limite: 2, q: sufijo });
    const siguiente = await empresas.listar({
      pagina: 2,
      limite: 2,
      q: sufijo,
    });
    expect(paginas.empresas).toHaveLength(2);
    expect(
      siguiente.empresas.every(
        (e) => !paginas.empresas.some((a) => a.id === e.id),
      ),
    ).toBe(true);
    await prisma.membership.create({
      data: { tenantId, userId: staffId, rol: 'ADMINISTRADOR' },
    });
    const porCorreo = await empresas.listar({
      pagina: 1,
      limite: 25,
      q: `empresas-${sufijo}@test.local`,
    });
    expect(porCorreo.empresas.map((e) => e.id)).toEqual([tenantId]);
    const usuarios = await empresas.usuarios(tenantId, 1, 25);
    expect(usuarios.usuarios[0].email).toBe(`empresas-${sufijo}@test.local`);
    await plataforma.suspenderTenant(staffId, tenantId, 'Comprobar filtro');
    expect(
      (
        await empresas.listar({
          pagina: 1,
          limite: 25,
          q: `empresas-${sufijo}@test.local`,
          acceso: 'habilitado',
        })
      ).total,
    ).toBe(0);
  });

  it('historial paginado limita resultados a la empresa solicitada', async () => {
    await prisma.plataformaEvento.createMany({
      data: Array.from({ length: 31 }, (_, n) => ({
        staffUserId: staffId,
        tenantAfectadoId: tenantId,
        tipo: 'test',
        descripcion: `Intervención ${n}`,
      })),
    });
    const primero = await empresas.historial(tenantId, 1, 25);
    const segundo = await empresas.historial(tenantId, 2, 25);
    expect(primero.total).toBe(31);
    expect(primero.eventos).toHaveLength(25);
    expect(segundo.eventos).toHaveLength(6);
    expect(
      segundo.eventos.every((e) => !primero.eventos.some((a) => a.id === e.id)),
    ).toBe(true);
  });
});

describe('Contrato de acceso y validación', () => {
  it('gracia y prueba vencidas restringen escrituras aunque el cron todavía no corrió', () => {
    const ayer = new Date(Date.now() - 86400000);
    expect(
      resolverAccesoEmpresa(true, {
        estado: 'activa',
        proveedor: 'manual',
        trialHasta: ayer,
      }).codigo,
    ).toBe('prueba_vencida');
    expect(
      resolverAccesoEmpresa(true, {
        estado: 'activa',
        proveedor: 'paddle',
        estadoProveedor: 'past_due',
        graciaHasta: ayer,
      }).modo,
    ).toBe('solo_lectura');
    expect(
      resolverAccesoEmpresa(true, {
        estado: 'activa',
        proveedor: 'paddle',
        trialHasta: ayer,
      }).modo,
    ).toBe('operativo');
  });
  it('limita páginas, tamaño, filtros y motivos en el endpoint', async () => {
    expect(
      await validate(
        plainToInstance(EmpresasConsultaDto, {
          pagina: 0,
          limite: 10000,
          acceso: 'inventado',
        }),
      ),
    ).toHaveLength(3);
    expect(
      await validate(plainToInstance(SuspenderTenantDto, { motivo: '   ' })),
    ).toHaveLength(1);
    expect(
      await validate(
        plainToInstance(EmpresasConsultaDto, { pagina: '2', limite: '25' }),
      ),
    ).toHaveLength(0);
  });
});
