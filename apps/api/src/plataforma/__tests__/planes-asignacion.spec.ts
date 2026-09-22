import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PlanesVersionesService } from '../planes/planes-versiones.service';
import { PlanesAsignacionService } from '../planes/planes-asignacion.service';
import {
  PROPUESTA_PLANES,
  type ContenidoPlan,
} from '../planes/catalogo-planes';
import type { CurrentAuth } from '../../auth/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { SuscripcionesService } from '../../suscripciones/suscripciones.service';
import { EmpresasPlataformaService } from '../empresas.service';
import {
  resumenCupoUsuarios,
  exigirCupoUsuario,
} from '../../suscripciones/cupos-usuarios';
import {
  cupoAlmacenamiento,
  exigirEspacio,
} from '../../archivos/cupo-almacenamiento';
import type { VistaAsignacionPlan } from '../planes/asignacion-planes';
import { SuscripcionSyncService } from '../../cobro/suscripcion-sync.service';
import { ordenImpresionFixture } from '../../../test/fixture-impresion-planes';

const prisma = new PrismaClient();
afterAll(() => prisma.$disconnect());
const contenido = (i = 0): ContenidoPlan => ({
  ...structuredClone(PROPUESTA_PLANES[i].contenido),
  almacenamientoModo: 'limitado',
  almacenamientoGb: i ? 500 : 250,
});
const solicitud = (v: VistaAsignacionPlan) => ({
  tenantId: v.empresa.id,
  versionId: v.destino.versionId,
  revision: v.actual.revision,
  huella: v.huella,
  motivo: 'Validación de contrato interno',
  operacionId: randomUUID(),
  revisionesAceptadas: v.revisiones,
});

it('retirar impresión exige revisar sus pendientes y conserva registros tras asignar la versión', () =>
  escenario(async (c) => {
    const o = await ordenImpresionFixture(c.tx, c.tenantId);
    await o.solicitar(1);
    await o.solicitar(2);
    await o.enviar({ pagina: 3, estado: 'COMPLETE' });
    const antes = await c.tx.ordenTrabajoEvento.findMany({
      where: { ordenId: o.ordenId },
      orderBy: { id: 'asc' },
    });
    const v = await c.service.diagnostico(c);
    expect(v.bloqueos).toEqual([]);
    expect(v.revisiones).toEqual(
      expect.arrayContaining([
        'impresion_sin_envio',
        'impresion_sin_verificar',
        'impresion_en_equipos',
      ]),
    );
    expect(v.diagnostico.hallazgos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'impresion_sin_envio', cantidad: 2 }),
        expect.objectContaining({
          codigo: 'impresion_sin_verificar',
          cantidad: 1,
        }),
      ]),
    );
    await expect(
      c.service.asignar(c.auth, {
        ...solicitud(v),
        revisionesAceptadas: v.revisiones.filter(
          (k) => k !== 'impresion_sin_verificar',
        ),
      }),
    ).rejects.toThrow('revisiones');
    expect(
      (
        await c.tx.suscripcion.findUniqueOrThrow({
          where: { tenantId: c.tenantId },
        })
      ).planVersionId,
    ).toBeNull();
    await c.service.asignar(c.auth, solicitud(v));
    expect(
      await new CapacidadesEmpresaService(c.db).puedeOperar(
        c.tenantId,
        'impresion_directa',
      ),
    ).toBe(false);
    expect(
      await c.tx.ordenTrabajoEvento.findMany({
        where: { ordenId: o.ordenId },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(antes);
  }));

it('no asigna usando una revisión anterior si cambió el envío pendiente aunque la cantidad siga igual', () =>
  escenario(async (c) => {
    const o = await ordenImpresionFixture(c.tx, c.tenantId);
    await o.enviar();
    const antes = await c.service.diagnostico(c);
    await o.enviar({ estado: 'ERROR' });
    const despues = await c.service.diagnostico(c);
    expect(despues.diagnostico).toEqual(antes.diagnostico);
    expect(despues.huella).not.toBe(antes.huella);
    await expect(c.service.asignar(c.auth, solicitud(antes))).rejects.toThrow(
      'cambiaron',
    );
    await expect(
      c.service.asignar(c.auth, solicitud(despues)),
    ).resolves.toMatchObject({ versionId: c.versionId });
  }));

it('Paddle conserva la versión si el precio es desconocido y aplica el contrato remoto cuando puede resolverlo', () =>
  escenario(async (c) => {
    await c.service.asignar(c.auth, solicitud(await c.service.diagnostico(c)));
    const sync = new SuscripcionSyncService(c.db);
    const price = `pri_${randomUUID()}`;
    const externa = {
      referencia: `sub_${randomUUID()}`,
      tenantId: c.tenantId,
      estadoProveedor: 'active',
      clienteExterno: null,
      proximoCobro: null,
      periodoDesde: null,
      cambioProgramado: null,
      cambioProgramadoEl: null,
      precios: [price],
    };
    expect(await sync.aplicar(externa)).toMatchObject({ aplicado: false });
    expect(
      await c.tx.suscripcion.findUnique({ where: { tenantId: c.tenantId } }),
    ).toMatchObject({
      planVersionId: c.versionId,
      proveedor: 'manual',
      revisionContrato: 1,
    });
    const remoto = await c.tx.plan.create({
      data: {
        codigo: randomUUID(),
        nombre: 'Plan externo de prueba',
        precioMensual: 100,
        featuresJson: {},
        paddlePriceId: price,
      },
    });
    expect(await sync.aplicar(externa)).toMatchObject({ aplicado: true });
    expect(
      await c.tx.suscripcion.findUnique({ where: { tenantId: c.tenantId } }),
    ).toMatchObject({
      planVersionId: null,
      planId: remoto.id,
      proveedor: 'paddle',
      revisionContrato: 2,
    });
  }));

async function escenario(
  fn: (c: {
    tx: Prisma.TransactionClient;
    db: PrismaService;
    auth: CurrentAuth;
    tenantId: string;
    otra: string;
    versionId: string;
    proId: string;
    service: PlanesAsignacionService;
  }) => Promise<void>,
) {
  const rollback = new Error('rollback del escenario');
  try {
    await prisma.$transaction(
      async (tx) => {
        const db = new Proxy(tx, {
          get(target, key) {
            if (key === '$transaction')
              return async (
                cb: (client: Prisma.TransactionClient) => Promise<unknown>,
              ) => {
                const sp = `prueba_${randomUUID().replaceAll('-', '')}`;
                await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
                try {
                  const r = await cb(tx);
                  await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
                  return r;
                } catch (e) {
                  await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
                  throw e;
                }
              };
            return Reflect.get(target, key) as unknown;
          },
        }) as unknown as PrismaService;
        const u = await tx.user.create({
          data: {
            email: `asignacion-${randomUUID()}@test.local`,
            rolPlataforma: 'ADMIN',
          },
        });
        await tx.userMfa.create({
          data: {
            userId: u.id,
            activatedAt: new Date(1),
            recuperacionConfirmadaEl: new Date(2),
          },
        });
        const sesion = await tx.authSession.create({
          data: {
            userId: u.id,
            mfaVerificadoEl: new Date(),
            expiresAt: new Date(Date.now() + 3600000),
          },
        });
        const auth: CurrentAuth = {
          userId: u.id,
          email: u.email,
          sessionId: sesion.id,
          esPlataforma: true,
          plataformaMfaPendiente: false,
          tenantId: '',
          membershipId: '',
          role: 'ADMINISTRADOR',
        };
        const plan = await tx.plan.create({
          data: {
            codigo: randomUUID(),
            nombre: 'Contrato anterior de prueba',
            precioMensual: 125,
            featuresJson: { todo: true, impresionDirecta: true },
          },
        });
        const tenant = await tx.tenant.create({
          data: {
            nombre: 'Empresa de prueba',
            slug: randomUUID(),
            suscripcion: { create: { planId: plan.id } },
          },
        });
        const otra = await tx.tenant.create({
          data: {
            nombre: 'Otra empresa',
            slug: randomUUID(),
            suscripcion: { create: { planId: plan.id } },
          },
        });
        const ids: string[] = [];
        for (let i = 0; i < 2; i++) {
          const b = await tx.planBorrador.create({
            data: {
              codigo: randomUUID(),
              orden: i,
              contenido: contenido(i) as unknown as Prisma.InputJsonValue,
            },
          });
          const v = await new PlanesVersionesService(db).publicar(auth, b.id, {
            revision: 1,
            catalogoVersion: b.catalogoVersion,
            motivo: 'Versión de prueba de asignación',
          });
          ids.push(v.id);
        }
        await fn({
          tx,
          db,
          auth,
          tenantId: tenant.id,
          otra: otra.id,
          versionId: ids[0],
          proId: ids[1],
          service: new PlanesAsignacionService(db),
        });
        throw rollback;
      },
      { timeout: 25000 },
    );
  } catch (e) {
    if (e !== rollback) throw e;
  }
}

it('publicar → diagnosticar → asignar aplica funciones y topes reales de forma aislada', () =>
  escenario(async (c) => {
    const antes = await c.tx.suscripcion.findUniqueOrThrow({
      where: { tenantId: c.tenantId },
    });
    const vista = await c.service.diagnostico(c);
    expect(vista.bloqueos).toEqual([]);
    await c.service.asignar(c.auth, solicitud(vista));
    const caps = new CapacidadesEmpresaService(c.db);
    expect((await caps.actual(c.tenantId)).contrato).toMatchObject({
      origen: 'version',
      nombre: 'Grafo Esencial',
      versionId: c.versionId,
      limites: { usuariosMax: 3, almacenamiento: { gb: 250 } },
    });
    await expect(caps.exigir(c.tenantId, 'compras')).rejects.toThrow(
      'no está incluida',
    );
    await expect(
      caps.exigir(c.tenantId, 'cotizacion'),
    ).resolves.toBeUndefined();
    expect((await caps.actual(c.otra)).contrato.origen).toBe('compatibilidad');
    expect((await resumenCupoUsuarios(c.tx, c.tenantId)).limite).toBe(3);
    expect((await cupoAlmacenamiento(c.tx, c.tenantId)).cuotaBytes).toBe(
      250n * 1024n ** 3n,
    );
    const s = new SuscripcionesService(
      c.db,
      null as never,
      null as never,
      null as never,
    );
    expect(await s.limites(c.tenantId)).toMatchObject({
      usuariosMax: 3,
      storageGb: 250,
    });
    expect(await s.feature(c.tenantId, 'impresionDirecta')).toBe(false);
    const ficha = await new EmpresasPlataformaService(c.db).detalle(c.tenantId);
    expect(ficha.suscripcion?.planNombre).toBe('Grafo Esencial');
    expect(ficha.limites).toEqual({
      usuariosMax: 3,
      storageGb: 250,
      ordenesMesMax: null,
    });
    const despues = await c.tx.suscripcion.findUniqueOrThrow({
      where: { tenantId: c.tenantId },
    });
    expect(despues).toMatchObject({
      planId: antes.planId,
      estado: antes.estado,
      proveedor: antes.proveedor,
      trialHasta: antes.trialHasta,
      revisionContrato: 1,
    });
  }));

it('reintentos son idempotentes y otra intención no puede reutilizar el identificador', () =>
  escenario(async (c) => {
    const dto = solicitud(await c.service.diagnostico(c));
    const r = await c.service.asignar(c.auth, dto);
    expect(await c.service.asignar(c.auth, dto)).toEqual(r);
    await expect(
      c.service.asignar(c.auth, { ...dto, motivo: 'Otra intención diferente' }),
    ).rejects.toThrow('otra operación');
    expect(
      await c.tx.plataformaEvento.count({
        where: { tenantAfectadoId: c.tenantId, tipo: 'plan_version_asignada' },
      }),
    ).toBe(1);
  }));

it('cambiar versión y restaurar compatibilidad conserva auditoría y no modifica snapshots', () =>
  escenario(async (c) => {
    const original = await c.tx.planVersion.findUniqueOrThrow({
      where: { id: c.versionId },
    });
    await c.service.asignar(c.auth, solicitud(await c.service.diagnostico(c)));
    await c.service.asignar(
      c.auth,
      solicitud(
        await c.service.diagnostico({
          tenantId: c.tenantId,
          versionId: c.proId,
        }),
      ),
    );
    expect(
      (await new CapacidadesEmpresaService(c.db).actual(c.tenantId)).contrato
        .funciones.compras,
    ).toBe(true);
    await c.service.asignar(
      c.auth,
      solicitud(
        await c.service.diagnostico({ tenantId: c.tenantId, versionId: null }),
      ),
    );
    expect(
      (await new CapacidadesEmpresaService(c.db).actual(c.tenantId)).contrato,
    ).toMatchObject({
      origen: 'compatibilidad',
      funciones: { impresion_directa: true },
    });
    expect(
      await c.tx.planVersion.findUniqueOrThrow({ where: { id: c.versionId } }),
    ).toEqual(original);
    expect(
      (
        await c.tx.suscripcion.findUniqueOrThrow({
          where: { tenantId: c.tenantId },
        })
      ).revisionContrato,
    ).toBe(3);
  }));

it('detecta cambios de uso después de revisar y exige repetir el diagnóstico', () =>
  escenario(async (c) => {
    const dto = solicitud(await c.service.diagnostico(c));
    await c.tx.tenant.update({
      where: { id: c.tenantId },
      data: { bytesArchivos: 12n },
    });
    await expect(c.service.asignar(c.auth, dto)).rejects.toThrow('cambiaron');
    await c.service.asignar(c.auth, solicitud(await c.service.diagnostico(c)));
  }));

it('no asigna si archivos o usuarios exceden el cupo', () =>
  escenario(async (c) => {
    await c.tx.tenant.update({
      where: { id: c.tenantId },
      data: { bytesArchivos: 251n * 1024n ** 3n },
    });
    for (let i = 0; i < 4; i++) {
      const u = await c.tx.user.create({
        data: { email: `${randomUUID()}@test.local` },
      });
      await c.tx.membership.create({
        data: { tenantId: c.tenantId, userId: u.id, rol: 'ADMINISTRADOR' },
      });
    }
    const v = await c.service.diagnostico(c);
    expect(v.diagnostico.usuariosExcedidos).toBe(1);
    expect(v.diagnostico.almacenamientoExcedidoBytes).toBe(String(1024 ** 3));
    await expect(c.service.asignar(c.auth, solicitud(v))).rejects.toThrow();
    expect(
      (
        await c.tx.suscripcion.findUniqueOrThrow({
          where: { tenantId: c.tenantId },
        })
      ).planVersionId,
    ).toBeNull();
  }));

it('conserva ajustes y adicionales y exige reconocer las revisiones', () =>
  escenario(async (c) => {
    await c.tx.suscripcion.update({
      where: { tenantId: c.tenantId },
      data: { usuariosAdicionales: 2 },
    });
    await c.tx.tenant.update({
      where: { id: c.tenantId },
      data: { cuotaBytesArchivos: 300n * 1024n ** 3n },
    });
    const v = await c.service.diagnostico(c);
    expect(v.diagnostico.usuariosCupoResultante).toBe(5);
    expect(v.revisiones).toContain('almacenamiento_ajustado');
    await expect(
      c.service.asignar(c.auth, { ...solicitud(v), revisionesAceptadas: [] }),
    ).rejects.toThrow('revisiones');
    await c.service.asignar(c.auth, solicitud(v));
    expect((await cupoAlmacenamiento(c.tx, c.tenantId)).origen).toBe('ajuste');
    expect((await resumenCupoUsuarios(c.tx, c.tenantId)).limite).toBe(5);
  }));

it('los límites asignados rechazan nuevas invitaciones y archivos sin alterar datos existentes', () =>
  escenario(async (c) => {
    await c.service.asignar(c.auth, solicitud(await c.service.diagnostico(c)));
    for (let i = 0; i < 3; i++) {
      const u = await c.tx.user.create({
        data: { email: `${randomUUID()}@test.local` },
      });
      await c.tx.membership.create({
        data: { tenantId: c.tenantId, userId: u.id, rol: 'ADMINISTRADOR' },
      });
    }
    await expect(
      exigirCupoUsuario(c.tx, c.tenantId, { email: 'nuevo@test.local' }),
    ).rejects.toThrow('cupo de 3');
    await expect(
      exigirEspacio(c.tx, c.tenantId, 251n * 1024n ** 3n),
    ).rejects.toThrow('No hay espacio');
  }));

it('bloquea retirar módulos con compromisos pendientes', () =>
  escenario(async (c) => {
    const categoria = await c.tx.categoriaEgreso.create({
      data: {
        tenantId: c.tenantId,
        nombre: 'Recurrente',
        codigo: 'REC-TEST',
        naturaleza: 'GASTO_ESTRUCTURA',
      },
    });
    await c.tx.gastoRecurrente.create({
      data: {
        tenantId: c.tenantId,
        descripcion: 'Contrato activo',
        categoriaEgresoId: categoria.id,
        monto: 100,
        vigenteDesde: '2026-09',
      },
    });
    const v = await c.service.diagnostico(c);
    expect(v.bloqueos.join(' ')).toContain('Gastos recurrentes activos');
    await expect(c.service.asignar(c.auth, solicitud(v))).rejects.toThrow();
  }));

it('no sustituye contratos Paddle ni quita bloqueos administrativos', () =>
  escenario(async (c) => {
    await c.tx.suscripcion.update({
      where: { tenantId: c.tenantId },
      data: { proveedor: 'paddle', referenciaExterna: randomUUID() },
    });
    const v = await c.service.diagnostico(c);
    expect(v.bloqueos.join(' ')).toContain('cobro externo');
    await expect(c.service.asignar(c.auth, solicitud(v))).rejects.toThrow();
    await c.tx.suscripcion.update({
      where: { tenantId: c.tenantId },
      data: { proveedor: 'manual', referenciaExterna: null },
    });
    await c.tx.tenant.update({
      where: { id: c.tenantId },
      data: { activo: false },
    });
    await c.service.asignar(c.auth, solicitud(await c.service.diagnostico(c)));
    expect(
      (await new CapacidadesEmpresaService(c.db).actual(c.tenantId)).acceso
        .modo,
    ).toBe('bloqueado');
  }));

it('soporte o una sesión revocada no pueden asignar aunque conservaran un diagnóstico', () =>
  escenario(async (c) => {
    const dto = solicitud(await c.service.diagnostico(c));
    await c.tx.user.update({
      where: { id: c.auth.userId },
      data: { rolPlataforma: 'SOPORTE' },
    });
    await expect(c.service.asignar(c.auth, dto)).rejects.toThrow(
      'administración',
    );
    await c.tx.user.update({
      where: { id: c.auth.userId },
      data: { rolPlataforma: 'ADMIN' },
    });
    await c.tx.authSession.update({
      where: { id: c.auth.sessionId },
      data: { revokedAt: new Date() },
    });
    await expect(c.service.asignar(c.auth, dto)).rejects.toThrow(
      'administración',
    );
  }));
