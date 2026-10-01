import { Prisma } from '@prisma/client';
import { getCurrentTenantId } from '../common/tenant-context';

/**
 * Modelos EXENTOS de la inyección automática de tenant:
 *  - Sin columna tenantId (nivel plataforma).
 *  - Auth-layer consultado sin contexto de tenant (login/switch/invitación).
 */
export const MODELOS_EXENTOS: ReadonlySet<string> = new Set<string>([
  'Tenant',
  'CronLock',
  // Auditoría del control plane: vive por encima de los tenants.
  'PlataformaEvento',
  // Credencial del representante SaaS; administración exclusiva del control plane.
  'CredencialFiscalPlataforma',
  // Webhooks de las pasarelas de cobro: llegan sin contexto de tenant.
  'EventoCobro',
  // Webhooks de WhatsApp (Meta): llegan sin contexto; el tenant se resuelve
  // después por phone_number_id. Ver docs/whatsapp-tech-provider-diseno.md
  'WebhookWhatsappCrudo',
  'User',
  'AuthSession',
  'UserMfa',
  // Recuperación de identidad global y cuotas compartidas: sin acceso por tenant.
  'AccesoToken',
  'AccesoCorreo',
  'AccesoLimite',
  // Navegadores recordados por identidad, compartidos entre sus empresas.
  'MfaDispositivo',
  'MfaChallenge',
  'InvitacionPlataforma',
  'Membership',
  'Invitation',
  // Se resuelve por tokenHash único global ANTES de que exista contexto de
  // tenant (el tenant sale de la fila). Ver docs/mcp-cotizador-diseno.md
  'CredencialMcp',
  'MaterialPreset',
  // Catálogo del SaaS: mismos planes para todos los tenants.
  'Plan',
  'PlanBorrador',
  'PlanVersion',
  // Oferta global y precios asociados a versiones inmutables.
  'PlanOferta',
  'PlanOfertaPrecio',
  'PlanPaddleRecurso',
  'PlanPrecioLegacy',
  // Alta pública anterior a que exista un tenant. El token es global y el
  // tenant nace recién al consumirlo.
  'RegistroTenant',
  'MaterialPresetVariante',
  'ProductoCategoriaComercial',
  'ProductoSubcategoriaComercial',
]);

// Operaciones cuyo `where` admite filtros arbitrarios (incluye no-únicos).
const OPS_CON_WHERE = new Set<string>([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'findUnique',
  'findUniqueOrThrow',
  'upsert',
  'delete',
  'deleteMany',
]);

type AnyArgs = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
};

/** Valida el propietario, también en escrituras que usan una relación Prisma. */
function protegerDatos(
  data: unknown,
  tenantId: string,
  crear: boolean,
): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const d = data as Record<string, unknown>;
  const propietario = d.tenantId;
  if (propietario !== undefined) {
    const valor =
      typeof propietario === 'object' && propietario !== null
        ? (propietario as Record<string, unknown>).set
        : propietario;
    if (valor !== tenantId)
      throw new Error('La escritura pertenece a otra empresa.');
  }
  if (d.tenant !== undefined) {
    const relacion = d.tenant as { connect?: { id?: string } } | null;
    if (
      !relacion ||
      Object.keys(relacion).length !== 1 ||
      relacion.connect?.id !== tenantId
    ) {
      throw new Error('No se permite cambiar la empresa de un registro.');
    }
    return d;
  }
  return crear ? { ...d, tenantId } : d;
}

/**
 * Defensa adicional para operaciones de primer nivel de modelos con tenant.
 * Mantiene el filtro original y exige además el tenant del contexto. Prisma 6
 * admite filtros no únicos junto al campo único en findUnique/update/upsert.
 * Las relaciones anidadas, modelos exentos, SQL y consultas sin contexto
 * requieren comprobaciones explícitas en sus servicios.
 */
export const tenantGuardExtension = Prisma.defineExtension({
  name: 'tenant-guard',
  query: {
    // El callback global evita una unión de todos los modelos/operaciones.
    // Las consultas raw no tienen model y conservan el retorno inmediato.
    async $allOperations({
      model,
      operation,
      args,
      query,
    }: {
      model?: string;
      operation: string;
      args: unknown;
      query: (args: unknown) => Promise<unknown>;
    }) {
      const tenantId = getCurrentTenantId();
      if (!tenantId || !model || MODELOS_EXENTOS.has(model)) {
        return query(args);
      }

      const a = (args ?? {}) as AnyArgs;

      const escritura = [
        'update',
        'updateMany',
        'updateManyAndReturn',
        'upsert',
        'delete',
        'deleteMany',
      ].includes(operation);
      if (
        escritura &&
        typeof a.where?.tenantId === 'string' &&
        a.where.tenantId !== tenantId
      ) {
        throw new Error('La escritura pertenece a otra empresa.');
      }

      if (OPS_CON_WHERE.has(operation)) {
        // No sobrescribir el filtro original: un tenantId ajeno debe dar cero
        // resultados, nunca transformarse en una consulta a la empresa propia.
        const original = a.where ?? {};
        a.where = {
          ...original,
          AND: [
            ...(Array.isArray(original.AND)
              ? (original.AND as unknown[])
              : original.AND
                ? [original.AND]
                : []),
            { tenantId },
          ],
        };
        if (escritura) a.data = protegerDatos(a.data, tenantId, false);
        if (operation === 'upsert') {
          a.create = protegerDatos(
            a.create,
            tenantId,
            true,
          ) as AnyArgs['create'];
          a.update = protegerDatos(
            a.update,
            tenantId,
            false,
          ) as AnyArgs['update'];
        }
        return query(a);
      }

      if (
        operation === 'create' ||
        operation === 'createMany' ||
        operation === 'createManyAndReturn'
      ) {
        a.data = Array.isArray(a.data)
          ? a.data.map((d) => protegerDatos(d, tenantId, true))
          : protegerDatos(a.data, tenantId, true);
        return query(a);
      }

      return query(args);
    },
  },
});
