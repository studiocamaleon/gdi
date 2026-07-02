import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de tenant por request (AsyncLocalStorage). Lo setea el
 * TenantContextInterceptor a partir de `request.auth.tenantId` y lo consume la
 * extensión de Prisma (tenant-guard) para inyectar el scope automáticamente.
 */
export const tenantContext = new AsyncLocalStorage<{ tenantId: string }>();

export function getCurrentTenantId(): string | undefined {
  return tenantContext.getStore()?.tenantId;
}

export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return tenantContext.run({ tenantId }, fn);
}
