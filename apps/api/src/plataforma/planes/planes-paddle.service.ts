import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaddleService } from '../../cobro/paddle.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { autorizarEdicionPlanes } from './autorizar-edicion-planes';
import { PlanesOfertasService } from './planes-ofertas.service';
import type { ContenidoPlan } from './catalogo-planes';
import { problemasPublicacionPlan } from './validacion-planes';
import type { PrecioOfertaDto } from './planes-ofertas.controller';

@Injectable()
export class PlanesPaddleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleService,
    private readonly ofertas: PlanesOfertasService,
  ) {}

  async sincronizar(
    auth: CurrentAuth,
    dto: {
      versionId: string;
      entorno: string;
      revision: number;
      recomendado: boolean;
      motivo: string;
    },
  ) {
    await this.prisma.$transaction((tx) => autorizarEdicionPlanes(tx, auth));
    if (!this.paddle.habilitado || dto.entorno !== this.paddle.entorno)
      throw new BadRequestException(
        'Revisá el entorno de Paddle antes de publicar.',
      );
    const version = await this.prisma.planVersion.findUniqueOrThrow({
      where: { id: dto.versionId },
    });
    const estado = await this.ofertas.estado(version.borradorId);
    if (estado.actual?.versionId === version.id) return estado;
    if (estado.revision !== dto.revision)
      throw new ConflictException(
        'La oferta cambió. Recargá antes de sincronizar.',
      );
    const p = version.contenido as unknown as ContenidoPlan;
    const errores = problemasPublicacionPlan(p, version.catalogoVersion);
    if (
      ![1, 2].includes(version.catalogoVersion) ||
      errores.length ||
      !p.comercial ||
      !p.precios?.mensual ||
      (p.adicionalesPermitidos &&
        (!p.precios.usuarioMensual ||
          (p.precios.anual && !p.precios.usuarioAnual)))
    )
      throw new BadRequestException(
        errores.length
          ? errores
          : 'Completá precios y condiciones comerciales en Usuarios y oferta y publicá la versión.',
      );
    const existente = await this.prisma.planOferta.findUnique({
      where: {
        versionId_entorno: { versionId: version.id, entorno: dto.entorno },
      },
      include: { precios: true },
    });
    if (existente)
      return this.ofertas.activar(auth, {
        ...dto,
        registroPublico: p.comercial.acceso === 'publico',
        trialDias: p.comercial.trialDias,
        precios: existente.precios.map((i) => ({
          tipo: i.tipo,
          ciclo: i.ciclo,
          priceId: i.priceId,
        })) as PrecioOfertaDto[],
      });
    const precios: PrecioOfertaDto[] = [];
    const tipos = [
      'base',
      ...(p.adicionalesPermitidos ? ['usuario'] : []),
      ...(p.comercial.implementacion > 0 ? ['implementacion'] : []),
    ] as PrecioOfertaDto['tipo'][];
    for (const tipo of tipos) {
      const nombre = `${tipo === 'base' ? p.nombre : tipo === 'usuario' ? `Usuario adicional · ${p.nombre}` : `Implementación · ${p.nombre}`} · v${version.numero}`;
      const claveProducto = `producto:${tipo}`;
      const productId = await this.recurso(version.id, claveProducto, () =>
        this.paddle.crearProductoPlan(version.id, claveProducto, nombre),
      );
      const ciclos: PrecioOfertaDto['ciclo'][] =
        tipo === 'implementacion'
          ? ['unico']
          : ['mensual', ...(p.precios.anual ? ['anual' as const] : [])];
      for (const ciclo of ciclos) {
        const importe =
          tipo === 'implementacion'
            ? p.comercial.implementacion
            : tipo === 'base'
              ? p.precios[ciclo as 'mensual' | 'anual']!
              : p.precios[
                  ciclo === 'mensual' ? 'usuarioMensual' : 'usuarioAnual'
                ]!;
        const clave = `precio:${tipo}:${ciclo}`;
        const priceId = await this.recurso(version.id, clave, () =>
          this.paddle.crearPrecioPlan({
            versionId: version.id,
            clave,
            productId,
            nombre: `${nombre} · ${ciclo === 'unico' ? 'pago único' : ciclo}`,
            importe,
            ciclo,
            cantidadMaxima: tipo === 'usuario' ? 999 : 1,
          }),
        );
        precios.push({ tipo, ciclo, priceId });
      }
    }
    // La activación vuelve a autorizar y valida cada precio contra Paddle.
    return this.ofertas.activar(auth, {
      ...dto,
      registroPublico: p.comercial.acceso === 'publico',
      trialDias: p.comercial.trialDias,
      precios,
    });
  }

  private async recurso(
    versionId: string,
    clave: string,
    crear: () => Promise<{ id: string }>,
  ): Promise<string> {
    const entorno = this.paddle.entorno;
    let r = await this.prisma.planPaddleRecurso.upsert({
      where: { versionId_entorno_clave: { versionId, entorno, clave } },
      create: { versionId, entorno, clave },
      update: {},
    });
    if (r.referencia) return r.referencia;
    if (r.estado !== 'pendiente') {
      // Incluye caída del proceso tras el POST: buscar por identidad estable.
      const referencia = await this.paddle.buscarRecursoPlan(versionId, clave);
      if (!referencia)
        throw new ConflictException(
          'Paddle todavía no confirmó un recurso de esta publicación. Reintentá la consulta; Grafo no duplicará el envío.',
        );
      await this.prisma.planPaddleRecurso.update({
        where: { id: r.id },
        data: { referencia, estado: 'listo' },
      });
      return referencia;
    }
    const tomada = await this.prisma.planPaddleRecurso.updateMany({
      where: { id: r.id, estado: 'pendiente' },
      data: { estado: 'enviando' },
    });
    if (!tomada.count)
      throw new ConflictException(
        'Esta publicación ya está sincronizándose. Volvé a consultar.',
      );
    try {
      const remoto = await crear();
      r = await this.prisma.planPaddleRecurso.update({
        where: { id: r.id },
        data: { estado: 'listo', referencia: remoto.id },
      });
      return r.referencia!;
    } catch (e) {
      await this.prisma.planPaddleRecurso.updateMany({
        where: { id: r.id, referencia: null },
        data: {
          estado: this.paddle.esRechazoDefinitivo(e)
            ? 'pendiente'
            : 'verificar',
        },
      });
      throw new BadRequestException(
        'No se completó la sincronización con Paddle. Podés reintentar; Grafo conserva el avance y consulta los envíos inciertos antes de continuar.',
      );
    }
  }
}
