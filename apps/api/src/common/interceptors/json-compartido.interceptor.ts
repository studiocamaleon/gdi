import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs';
import { compactarJson, esJsonCompartido } from '../json-compartido';

export const MIME_JSON_COMPARTIDO = 'application/vnd.grafoprint.snapshot+json';

/** Sólo clientes que anuncian soporte reciben el formato compacto. Se ejecuta
 * DESPUÉS de la poda de costos: nunca se codifica información sin autorizar. */
@Injectable()
export class JsonCompartidoInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    const request = http.getRequest<{ headers: { accept?: string } }>();
    const response = http.getResponse<{
      setHeader: (k: string, v: string) => void;
      vary: (v: string) => void;
    }>();
    // Ambas representaciones dependen de Accept, también la convencional.
    response.vary('Accept');
    if (
      !request.headers.accept
        ?.split(',')
        .some((v) => v.trim() === MIME_JSON_COMPARTIDO)
    )
      return next.handle();
    return next.handle().pipe(
      map((data: unknown) => {
        if (
          !data ||
          typeof data !== 'object' ||
          (!Array.isArray(data) && data.constructor !== Object)
        )
          return data;
        const result = compactarJson(data);
        if (esJsonCompartido(result))
          response.setHeader('Content-Type', MIME_JSON_COMPARTIDO);
        return result;
      }),
    );
  }
}
