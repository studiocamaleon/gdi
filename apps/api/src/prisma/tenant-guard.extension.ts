import { Prisma } from '@prisma/client';
import { getCurrentTenantId } from '../common/tenant-context';

/**
 * Modelos EXENTOS de la inyección automática de tenant:
 *  - Sin columna tenantId (nivel plataforma).
 *  - Auth-layer consultado sin contexto de tenant (login/switch/invitación).
 */
const MODELOS_EXENTOS = new Set<string>([
  'Tenant',
  'CronLock',
  'User',
  'AuthSession',
  'Membership',
  'Invitation',
  'MaterialPreset',
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
  'delete',
  'deleteMany',
]);

type AnyArgs = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: Record<string, unknown>;
};

/**
 * Extensión de Prisma que inyecta `tenantId` (del contexto de request) en cada
 * query de un modelo con tenant. Red de seguridad de aislamiento multi-tenant:
 * aunque un service olvide el filtro, la fila ajena no es visible ni escribible.
 *
 * Solo modifica `args` (no toca conexiones), por lo que es compatible con las
 * transacciones interactivas del motor.
 */
export const tenantGuardExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'tenant-guard',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantId = getCurrentTenantId();
          if (!tenantId || !model || MODELOS_EXENTOS.has(model)) {
            return query(args);
          }

          const a = (args ?? {}) as AnyArgs;

          if (OPS_CON_WHERE.has(operation)) {
            a.where = { ...(a.where ?? {}), tenantId };
            return query(a);
          }

          if (operation === 'create') {
            if (
              a.data &&
              !Array.isArray(a.data) &&
              (a.data as Record<string, unknown>).tenantId === undefined
            ) {
              a.data = { ...(a.data as Record<string, unknown>), tenantId };
            }
            return query(a);
          }

          if (operation === 'createMany') {
            if (Array.isArray(a.data)) {
              a.data = (a.data as Record<string, unknown>[]).map((d) =>
                d && d.tenantId === undefined ? { ...d, tenantId } : d,
              );
            }
            return query(a);
          }

          if (operation === 'upsert') {
            // El `where` de upsert es único-compuesto (la app ya incluye
            // tenantId ahí); solo reforzamos el tenant en el create.
            if (
              a.create &&
              (a.create as Record<string, unknown>).tenantId === undefined
            ) {
              a.create = { ...a.create, tenantId };
            }
            return query(a);
          }

          if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
            // El `where` único no admite tenantId: post-filtramos el resultado.
            // Si la query trae `select` sin tenantId, se lo inyectamos para
            // poder verificar — si no, el post-filtro compararía contra
            // undefined y descartaría filas PROPIAS (bug: configuración
            // fiscal "inexistente" con select parcial).
            const sel = (a as { select?: Record<string, unknown> }).select;
            if (sel && sel.tenantId === undefined) sel.tenantId = true;
            const result = (await query(a)) as {
              tenantId?: string;
            } | null;
            if (result && result.tenantId !== tenantId) {
              if (operation === 'findUniqueOrThrow') {
                throw new Prisma.PrismaClientKnownRequestError(
                  'No record was found for a query.',
                  { code: 'P2025', clientVersion: Prisma.prismaVersion.client },
                );
              }
              return null;
            }
            return result;
          }

          return query(args);
        },
      },
    },
  }),
);
