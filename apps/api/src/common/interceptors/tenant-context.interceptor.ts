import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { CurrentAuth } from '../../auth/auth.types';
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
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<{ auth?: CurrentAuth }>();
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
