import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { concatMap } from 'rxjs';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RecetasProductoService } from './recetas-producto.service';

type Origen =
  | 'producto'
  | 'productoNuevo'
  | 'rutaAlternativa'
  | 'ruta'
  | 'configPaso'
  | 'pasoExtra'
  | 'cargoPaso'
  | 'cargoCotizacion';
const META = 'recetas:publicar-cambios';

/** Se resuelve el propietario antes de escribir, también para eliminaciones. */
@Injectable()
export class PublicacionAutomaticaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly recetas: RecetasProductoService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const config = this.reflector.get<{ origen: Origen; parametro: string }>(
      META,
      context.getHandler(),
    );
    const request = context
      .switchToHttp()
      .getRequest<{ auth: CurrentAuth; params: Record<string, string> }>();
    const { tenantId } = request.auth;
    const id = request.params[config.parametro];
    const productos = await this.productosAfectados(
      tenantId,
      config.origen,
      id,
    );
    return next.handle().pipe(
      concatMap(async (resultado: unknown) => {
        if (
          config.origen === 'productoNuevo' &&
          resultado &&
          typeof resultado === 'object' &&
          'id' in resultado &&
          typeof resultado.id === 'string'
        )
          productos.push(resultado.id);
        if (productos.length)
          await this.recetas.sincronizarPublicaciones(request.auth, productos);
        return resultado;
      }),
    );
  }

  private async productosAfectados(
    tenantId: string,
    origen: Origen,
    id?: string,
  ): Promise<string[]> {
    if (origen === 'productoNuevo' || !id) return [];
    if (origen === 'producto') return [id];
    if (origen === 'ruta') {
      return (
        await this.prisma.productoRutaAlternativa.findMany({
          where: { tenantId, rutaId: id, activo: true },
          select: { productoId: true },
        })
      ).map((r) => r.productoId);
    }
    if (origen === 'rutaAlternativa') {
      const ruta = await this.prisma.productoRutaAlternativa.findFirst({
        where: { tenantId, id },
        select: { productoId: true },
      });
      return ruta ? [ruta.productoId] : [];
    }
    if (origen === 'pasoExtra') {
      const paso = await this.prisma.productoPasoExtra.findFirst({
        where: { tenantId, id },
        select: { productoId: true },
      });
      return paso ? [paso.productoId] : [];
    }
    if (origen === 'cargoCotizacion') {
      const cargo = await this.prisma.productoCargoDirectoCotizacion.findFirst({
        where: { tenantId, id },
        select: { productoId: true },
      });
      return cargo ? [cargo.productoId] : [];
    }
    if (origen === 'cargoPaso') {
      const cargo = await this.prisma.productoCargoDirectoPaso.findFirst({
        where: { tenantId, id },
        select: {
          productoConfigPaso: {
            select: {
              productoRutaAlternativa: { select: { productoId: true } },
            },
          },
        },
      });
      return cargo
        ? [cargo.productoConfigPaso.productoRutaAlternativa.productoId]
        : [];
    }
    const paso = await this.prisma.productoConfigPaso.findFirst({
      where: { tenantId, id },
      select: { productoRutaAlternativa: { select: { productoId: true } } },
    });
    return paso ? [paso.productoRutaAlternativa.productoId] : [];
  }
}

export function PublicarCambiosReceta(origen: Origen, parametro = 'id') {
  return applyDecorators(
    SetMetadata(META, { origen, parametro }),
    UseInterceptors(PublicacionAutomaticaInterceptor),
  );
}
