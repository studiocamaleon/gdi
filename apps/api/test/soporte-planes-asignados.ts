import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PlanesVersionesService } from '../src/plataforma/planes/planes-versiones.service';
import { PlanesAsignacionService } from '../src/plataforma/planes/planes-asignacion.service';
import {
  PROPUESTA_PLANES,
  VERSION_CATALOGO_PLANES,
  type ContenidoPlan,
} from '../src/plataforma/planes/catalogo-planes';
import type { CurrentAuth } from '../src/auth/auth.types';
import { runWithTenant } from '../src/common/tenant-context';

/** Publicación, diagnóstico y asignación reales. La transacción exterior revierte
 * todos los datos; los savepoints conservan la atomicidad de los servicios.
 * Usa PrismaService para probar también las extensiones de aislamiento/snapshots. */
export async function conPlanesAsignados(
  cliente: PrismaService,
  ejecutar: (c: Awaited<ReturnType<typeof preparar>>) => Promise<void>,
) {
  const rollback = new Error('Revertir escenario de planes asignados');
  try {
    await cliente.$transaction(
      async (tx) => {
        await ejecutar(await preparar(tx, cliente));
        throw rollback;
      },
      { timeout: 90000 },
    );
  } catch (e) {
    if (e !== rollback) throw e;
  }
}

async function preparar(tx: Prisma.TransactionClient, cliente: PrismaService) {
  const db = new Proxy(tx, {
    get(target, prop) {
      // La conexión pertenece al cliente exterior; Nest no debe cerrarla desde la transacción.
      if (prop === 'onModuleInit' || prop === 'onModuleDestroy')
        return async () => {};
      if (prop === 'prepararSnapshot')
        return cliente.prepararSnapshot.bind(cliente);
      if (prop === '$transaction')
        return async (
          fn:
            | ((t: Prisma.TransactionClient) => Promise<unknown>)
            | Promise<unknown>[],
        ) => {
          if (Array.isArray(fn)) return Promise.all(fn);
          const sp = `plan_${randomUUID().replaceAll('-', '')}`;
          await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
          try {
            const resultado = await fn(tx);
            await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
            return resultado;
          } catch (e) {
            await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
            throw e;
          }
        };
      return Reflect.get(target, prop) as unknown;
    },
  }) as unknown as PrismaService;
  const tenant = await tx.tenant.findUniqueOrThrow({
    where: { slug: 'gdi-demo' },
  });
  const actor = await tx.user.create({
    data: {
      email: `planes-${randomUUID()}@test.local`,
      nombreCompleto: 'Prueba de planes',
      rolPlataforma: 'ADMIN',
    },
  });
  await tx.userMfa.create({
    data: {
      userId: actor.id,
      activatedAt: new Date(1),
      recuperacionConfirmadaEl: new Date(2),
    },
  });
  const sesion = await tx.authSession.create({
    data: {
      userId: actor.id,
      mfaVerificadoEl: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const staff: CurrentAuth = {
    userId: actor.id,
    email: actor.email,
    sessionId: sesion.id,
    esPlataforma: true,
    plataformaMfaPendiente: false,
    tenantId: '',
    membershipId: '',
    role: 'ADMINISTRADOR',
  };
  const miembro = await tx.membership.create({
    data: { userId: actor.id, tenantId: tenant.id, rol: 'ADMINISTRADOR' },
  });
  const auth: CurrentAuth = {
    sessionId: sesion.id,
    tenantId: tenant.id,
    userId: actor.id,
    email: actor.email,
    membershipId: miembro.id,
    role: 'ADMINISTRADOR',
    permisos: new Set([
      'produccion.supervisar',
      'comercial.ver',
      'finanzas.ver_margenes',
    ]),
  };
  const anterior = await tx.plan.create({
    data: {
      codigo: randomUUID(),
      nombre: 'Contrato anterior de prueba',
      precioMensual: 100,
      featuresJson: {},
    },
  });
  await tx.suscripcion.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, planId: anterior.id },
    update: {
      planId: anterior.id,
      planVersionId: null,
      proveedor: 'manual',
      referenciaExterna: null,
      estado: 'activa',
    },
  });
  const asignaciones = new PlanesAsignacionService(db);
  const publicar = async (contenido: ContenidoPlan) => {
    const b = await tx.planBorrador.create({
      data: {
        codigo: randomUUID(),
        contenido: contenido as unknown as Prisma.InputJsonValue,
        orden: 0,
      },
    });
    return new PlanesVersionesService(db).publicar(staff, b.id, {
      revision: 1,
      catalogoVersion: VERSION_CATALOGO_PLANES,
      motivo: 'Prueba integral con contrato persistido',
    });
  };
  const versiones = [];
  for (let i = 0; i < 3; i++)
    versiones.push(
      await publicar({
        ...structuredClone(PROPUESTA_PLANES[i].contenido),
        almacenamientoModo: 'limitado',
        almacenamientoGb: [250, 500, 1500][i],
      }),
    );
  const diagnosticar = (versionId: string | null) =>
    runWithTenant('', () =>
      asignaciones.diagnostico({ tenantId: tenant.id, versionId }),
    );
  const asignar = async (versionId: string | null) =>
    runWithTenant('', async () => {
      const d = await diagnosticar(versionId);
      if (d.bloqueos.length) throw new Error(d.bloqueos.join('\n'));
      return asignaciones.asignar(staff, {
        tenantId: tenant.id,
        versionId,
        huella: d.huella,
        revision: d.actual.revision,
        motivo: 'Recorrido integral del plan',
        operacionId: randomUUID(),
        revisionesAceptadas: d.revisiones,
      });
    });
  return {
    tx,
    db,
    auth,
    staff,
    tenantId: tenant.id,
    versiones,
    publicar,
    asignar,
    diagnosticar,
    asignaciones,
  };
}
