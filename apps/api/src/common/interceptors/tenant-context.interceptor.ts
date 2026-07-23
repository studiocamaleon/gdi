import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import type { CurrentAuth } from '../../auth/auth.types';
import { SIN_TENANT_KEY } from '../sin-tenant.decorator';
import { tenantContext } from '../tenant-context';

/**
 * Setea el contexto de tenant (AsyncLocalStorage) a partir de
 * `request.auth.tenantId` para toda la ejecución del handler. Corre DESPUÉS de
 * los guards (AuthGuard ya pobló `request.auth`).
 *
 * Se envuelve la suscripción dentro de `tenantContext.run(...)` para que el
 * contexto propague a las continuaciones async del handler (si solo se
 * envolviera `next.handle()`, el contexto se perdería al suscribir Nest).
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Rutas @SinTenant(): el control plane lee A TRAVÉS de los tenants. Con
    // el contexto puesto, el tenant-guard filtraría todo al tenant del staff
    // y la consola devolvería datos silenciosamente incompletos.
    const sinTenant = this.reflector.getAllAndOverride<boolean>(
      SIN_TENANT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (sinTenant) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<{ auth?: CurrentAuth }>();
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return next.handle();
    }

    return new Observable((subscriber) =>
      tenantContext.run({ tenantId }, () =>
        next.handle().subscribe(subscriber),
      ),
    );
  }
}
