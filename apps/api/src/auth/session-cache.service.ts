import { Injectable } from '@nestjs/common';
import { CurrentAuth } from './auth.types';

/**
 * Cache in-memory de sesiones validadas para evitar que el AuthGuard consulte
 * la DB (3 joins) en cada request. TTL corto para acotar la ventana en que una
 * sesión revocada/cambiada podría seguir sirviéndose; además se invalida
 * explícitamente en logout y switch-tenant.
 *
 * Nota multi-instancia: es por réplica. Con N réplicas la invalidación es
 * local; la ventana de staleness queda acotada por el TTL. Migrar a Redis
 * cuando haya varias instancias (Fase 3).
 */
@Injectable()
export class SessionCacheService {
  private readonly cache = new Map<
    string,
    { auth: CurrentAuth; expiresAt: number }
  >();
  private readonly ttlMs = 30_000;

  get(sessionId: string): CurrentAuth | null {
    const entry = this.cache.get(sessionId);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(sessionId);
      return null;
    }
    return entry.auth;
  }

  set(auth: CurrentAuth): void {
    this.cache.set(auth.sessionId, {
      auth,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidate(sessionId: string): void {
    this.cache.delete(sessionId);
  }

  /**
   * Tira las sesiones cacheadas de un tenant. Se llama al tocar un rol o el rol
   * de alguien: sin esto, quitarle un permiso a un usuario tardaría hasta el
   * TTL en aplicarse, y ese medio minuto es justo cuando el admin está mirando
   * si funcionó. El mapa tiene una entrada por sesión viva: recorrerlo es
   * barato al lado de la confusión de no hacerlo.
   */
  invalidarTenant(tenantId: string): void {
    for (const [sessionId, entry] of this.cache) {
      if (entry.auth.tenantId === tenantId) this.cache.delete(sessionId);
    }
  }
}
