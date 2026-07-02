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
}
