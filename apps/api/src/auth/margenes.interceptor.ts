import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';

import { CurrentAuth } from './auth.types';
import { OCULTA_MARGENES_KEY } from './margenes.decorator';
import { podarPlata } from './margenes';

/**
 * Saca la plata de la respuesta cuando el usuario no puede verla.
 *
 * Va donde el costo es información COLATERAL: el cotizador, la orden de
 * trabajo, los reportes. En el módulo Costos no se aplica —ahí el costo es el
 * dato, y quien entra ya pasó por `costos.ver`—: podarlo dejaría el módulo
 * mostrando pantallas vacías.
 *
 * Se activa con `@OcultaMargenes()` y no automáticamente por dos razones: se
 * lee en el controller (queda claro qué endpoints devuelven plata) y recorrer
 * cada respuesta del sistema para nada tiene un costo que no hace falta pagar.
 *
 * Ver docs/usuarios-roles-permisos-diseno.md
 */
@Injectable()
export class MargenesInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const aplica = this.reflector.getAllAndOverride<boolean>(
      OCULTA_MARGENES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!aplica) return next.handle();

    const request = context.switchToHttp().getRequest<{ auth?: CurrentAuth }>();
    const permisos = request.auth?.permisos;
    // Sin permisos resueltos (ruta pública) no hay a quién esconderle nada: el
    // seguimiento público del cliente nunca trae costos de todos modos.
    if (!permisos || permisos.has('finanzas.ver_margenes')) {
      return next.handle();
    }

    return next.handle().pipe(map((data: unknown) => podarPlata(data)));
  }
}
