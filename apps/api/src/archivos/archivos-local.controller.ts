import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { Public } from '../auth/public.decorator';
import { LocalDriver } from './storage/local.driver';
import { STORAGE_DRIVER, type StorageDriver } from './storage/storage.driver';

const MAX_BYTES_DEFAULT = 100 * 1024 * 1024;

/**
 * "El bucket" cuando no hay credenciales de R2 (desarrollo y tests).
 *
 * Existe para que el front use el MISMO camino en dev y en prod: pedir URL
 * firmada → PUT directo → confirmar. Si en dev se subiera por un endpoint
 * normal del API, la parte más delicada del flujo (la que involucra CORS,
 * firmas y vencimientos) sería justo la que nunca se prueba hasta producción.
 *
 * Es @Public porque las URLs firmadas de un storage no llevan sesión: la
 * credencial es el HMAC de la query, igual que en R2.
 */
@Controller('archivos/local')
export class ArchivosLocalController {
  private readonly maxBytes = Number(
    process.env.ARCHIVOS_MAX_BYTES ?? MAX_BYTES_DEFAULT,
  );

  constructor(
    private readonly local: LocalDriver,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  @Public()
  @Put('*key')
  async subir(
    @Param('key') key: string | string[],
    @Query() query: Record<string, string>,
    @Req() req: Request,
  ): Promise<{ ok: true; bytes: number }> {
    const clave = this.claveDe(key, query);
    const cuerpo = await this.leerCuerpo(req);
    await this.local.escribir(clave, cuerpo);
    return { ok: true, bytes: cuerpo.length };
  }

  @Public()
  @Get('*key')
  async bajar(
    @Param('key') key: string | string[],
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    const clave = this.claveDe(key, query, 'GET');
    const contenido = await this.local.leer(clave);
    if (!contenido) throw new NotFoundException();

    // El disposition va FIRMADO, igual que el ResponseContentDisposition de
    // R2: el cliente no puede pedir que un .svg se sirva inline.
    if (query.cd) res.setHeader('Content-Disposition', query.cd);
    res.setHeader('Content-Type', query.ct ?? 'application/octet-stream');
    res.setHeader('Content-Length', String(contenido.length));
    // helmet le pone `Cross-Origin-Resource-Policy: same-origin` a TODA
    // respuesta del API. El front corre en otro origen, así que sin este
    // override el navegador bloquea el <img> con
    // ERR_BLOCKED_BY_RESPONSE.NotSameOrigin y el logo sale roto. En
    // producción no pasa porque el objeto lo sirve R2, que no manda CORP —
    // o sea: es un bug que SÓLO existe en dev y que sólo se ve en el
    // navegador. Se arregla acá para que dev y prod se comporten igual.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.end(contenido);
  }

  private claveDe(
    key: string | string[],
    query: Record<string, string>,
    metodo: 'PUT' | 'GET' = 'PUT',
  ): string {
    // Con el driver de R2 activo estas rutas no tienen por qué existir.
    if (this.storage.nombre !== 'local') throw new NotFoundException();

    const clave = Array.isArray(key) ? key.join('/') : key;
    if (!this.local.verificar(metodo, clave, query)) {
      throw new ForbiddenException('Firma inválida o vencida.');
    }
    return clave;
  }

  /**
   * El body llega crudo: express sólo parsea json/urlencoded, y estos PUT van
   * con el content-type real del archivo. Por eso el límite de 1 MB de
   * `main.ts` no aplica acá — y por eso el corte de tamaño se hace a mano.
   */
  private leerCuerpo(req: Request): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const partes: Buffer[] = [];
      let total = 0;
      req.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > this.maxBytes) {
          req.destroy();
          reject(new PayloadTooLargeException('Archivo demasiado grande.'));
          return;
        }
        partes.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(partes)));
      req.on('error', reject);
    });
  }
}
