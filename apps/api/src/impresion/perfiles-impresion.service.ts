import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import {
  DestinoImpresionDto,
  BandejaImpresionDto,
  PerfilImpresionDto,
  PreparacionBandejaDto,
  ConfiguracionCadDto,
  PruebaCadDto,
} from './perfiles-impresion.dto';
import { ImpresionService } from './impresion.service';
import { pdfPruebaA4 } from './prueba-documento';
import { esConfiguracionCad } from './cad.domain';
import { pdfPruebaCad } from './prueba-cad';

@Injectable()
export class PerfilesImpresionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly impresion: ImpresionService,
  ) {}

  perfiles(tenantId: string, db: Prisma.TransactionClient = this.prisma) {
    return db.impresionPerfil.findMany({
      where: { bandeja: { destino: { tenantId } } },
      include: { bandeja: { include: { destino: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async configuracion(auth: CurrentAuth) {
    const [destinos, perfiles, maquinas, papeles] = await Promise.all([
      this.prisma.impresionDestino.findMany({
        where: { tenantId: auth.tenantId },
        include: { bandejas: true },
        orderBy: { nombre: 'asc' },
      }),
      this.perfiles(auth.tenantId),
      this.prisma.maquina.findMany({
        where: { tenantId: auth.tenantId },
        select: { id: true, nombre: true, plantilla: true, activo: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.materiaPrima.findMany({
        where: {
          tenantId: auth.tenantId,
          activo: true,
          subfamilia: 'SUSTRATO_HOJA',
        },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);
    return { destinos, perfiles, maquinas, papeles };
  }

  private async destino(
    tenantId: string,
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const destino = await db.impresionDestino.findFirst({
      where: { id, tenantId },
    });
    if (!destino) throw new NotFoundException('Destino no encontrado.');
    return destino;
  }

  async guardarDestino(
    auth: CurrentAuth,
    dto: DestinoImpresionDto,
    id?: string,
  ) {
    const maquina = await this.prisma.maquina.findFirst({
      where: { id: dto.maquinaId, tenantId: auth.tenantId, activo: true },
      select: { id: true },
    });
    if (!maquina)
      throw new BadRequestException(
        'Elegí una máquina activa de esta empresa.',
      );
    const { version, ...campos } = dto;
    const datos = {
      ...campos,
      nombre: dto.nombre.trim(),
      host: dto.host.trim().toLowerCase(),
      impresora: dto.impresora.trim(),
    };
    if (!datos.nombre || !datos.impresora)
      throw new BadRequestException('Completá el nombre y la impresora.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Maquina" WHERE id = ${dto.maquinaId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
        if (
          dto.activo &&
          (await tx.impresionDestino.findFirst({
            where: {
              tenantId: auth.tenantId,
              maquinaId: dto.maquinaId,
              activo: true,
              ...(id ? { id: { not: id } } : {}),
            },
          }))
        )
          throw new ConflictException(
            'Esta máquina ya tiene una impresora activa. Usá sus bandejas o desactivá el destino anterior.',
          );
        if (!id)
          return tx.impresionDestino.create({
            data: { ...datos, tenantId: auth.tenantId },
          });
        await tx.$queryRaw`SELECT id FROM "ImpresionDestino" WHERE id = ${id}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
        const anterior = await this.destino(auth.tenantId, id, tx);
        if (anterior.version !== version)
          throw new ConflictException(
            'La impresora cambió. Actualizá antes de guardar.',
          );
        const cambia =
          anterior.activo !== datos.activo ||
          anterior.host !== datos.host ||
          anterior.impresora !== datos.impresora ||
          anterior.maquinaId !== datos.maquinaId;
        if (cambia) {
          await tx.impresionPerfil.updateMany({
            where: { bandeja: { destinoId: id } },
            data: { probado: false, version: { increment: 1 } },
          });
          await tx.impresionBandeja.updateMany({
            where: { destinoId: id },
            data: {
              papelPreparadoId: null,
              gramajePreparado: null,
              preparadoEl: null,
              preparadoPor: null,
              version: { increment: 1 },
            },
          });
        }
        return tx.impresionDestino.update({
          where: { id },
          data: {
            ...datos,
            ...(esConfiguracionCad(anterior.cad) &&
            (anterior.host !== datos.host ||
              anterior.impresora !== datos.impresora)
              ? {
                  cad: {
                    ...anterior.cad,
                    origenPapel: '',
                    usarOrigenPredeterminado: false,
                  },
                }
              : {}),
            version: { increment: 1 },
          },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException(
          'Esta cola de impresión ya está configurada.',
        );
      throw e;
    }
  }

  async agregarBandeja(
    auth: CurrentAuth,
    destinoId: string,
    dto: BandejaImpresionDto,
  ) {
    await this.destino(auth.tenantId, destinoId);
    if (!dto.codigo.trim() || !dto.nombre.trim())
      throw new BadRequestException('Completá la bandeja.');
    try {
      return await this.prisma.impresionBandeja.create({
        data: {
          tenantId: auth.tenantId,
          destinoId,
          nombre: dto.nombre.trim(),
          codigo: dto.codigo.trim(),
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException('La bandeja ya existe en esta impresora.');
      throw e;
    }
  }

  async guardarCad(auth: CurrentAuth, id: string, dto: ConfiguracionCadDto) {
    const cad = {
      anchoRolloMm: dto.anchoRolloMm,
      margenMm: 5,
      origenPapel: dto.usarOrigenPredeterminado ? '' : dto.origenPapel.trim(),
      usarOrigenPredeterminado: dto.usarOrigenPredeterminado,
    };
    if (dto.habilitado && !esConfiguracionCad(cad))
      throw new BadRequestException(
        'Elegí el origen del rollo y un ancho entre 300 y 914,4 mm.',
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ImpresionDestino" WHERE id = ${id}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const destino = await this.destino(auth.tenantId, id, tx);
      if (destino.version !== dto.version)
        throw new ConflictException(
          'La impresora cambió. Actualizá antes de guardar el rollo.',
        );
      // Cambiar de modo invalida perfiles/preparación de hojas previos.
      await tx.impresionPerfil.updateMany({
        where: { bandeja: { destinoId: id } },
        data: { probado: false, version: { increment: 1 } },
      });
      await tx.impresionBandeja.updateMany({
        where: { destinoId: id },
        data: {
          papelPreparadoId: null,
          gramajePreparado: null,
          preparadoPor: null,
          preparadoEl: null,
          version: { increment: 1 },
        },
      });
      return tx.impresionDestino.update({
        where: { id },
        data: {
          cad: dto.habilitado ? cad : Prisma.DbNull,
          version: { increment: 1 },
        },
      });
    });
  }

  async pruebaCad(auth: CurrentAuth, id: string, dto: PruebaCadDto, perfilEsperado?: { id: string; version: number }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ImpresionDestino" WHERE id = ${id}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const destino = await this.destino(auth.tenantId, id, tx);
      if (perfilEsperado) {
        const perfil = await tx.impresionPerfil.findFirst({ where: {
          id: perfilEsperado.id, tenantId: auth.tenantId, version: perfilEsperado.version,
          tamano: 'CAD', activo: true, color: dto.color, bandeja: { destinoId: id },
        } });
        if (!perfil) throw new ConflictException('El perfil CAD cambió. Actualizá antes de imprimir.');
      }
      if (!destino.activo)
        throw new BadRequestException('Activá la impresora antes de probar.');
      if (destino.version !== dto.version)
        throw new ConflictException(
          'La impresora cambió. Actualizá antes de imprimir.',
        );
      if (!esConfiguracionCad(destino.cad))
        throw new BadRequestException('Configurá primero el rollo CAD.');
      let preparado: Awaited<ReturnType<typeof pdfPruebaCad>>;
      try {
        preparado = await pdfPruebaCad(destino.cad, dto.formato);
      } catch (e) {
        throw new BadRequestException(
          e instanceof Error ? e.message : 'No se pudo preparar la prueba CAD.',
        );
      }
      const { plan, pdf } = preparado;
      const color = dto.color ?? 'COLOR';
      const params = {
        printer: { name: destino.impresora },
        options: {
          copies: 1,
          jobName: `Grafo prueba CAD ${plan.original.nombre} ${color === 'BN' ? 'B-N' : 'Color'}`,
          units: 'mm',
          size: {
            width: plan.anchoSalidaMm,
            height: plan.largoSalidaMm,
            custom: true,
          },
          colorType: color === 'BN' ? 'grayscale' : 'color',
          duplex: 'one-sided',
          printerTray: destino.cad.usarOrigenPredeterminado
            ? null
            : destino.cad.origenPapel,
          // El PDF ya está girado y su ancho representa el ancho físico del rollo.
          // PORTRAIT evita el intercambio adicional de ejes del PageFormat de Java.
          orientation: 'portrait',
          rotation: 0,
          margins: 0,
          rasterize: false,
          scaleContent: false,
          // La calidad Fast/Normal/Best se configura en la cola HP de Windows.
          // density: 'draft' no representa Fast y rasterizaría el PDF.
        },
        data: [
          {
            type: 'pixel',
            format: 'pdf',
            flavor: 'base64',
            data: pdf.toString('base64'),
          },
        ],
      };
      return {
        ...this.impresion.firmarDocumento(params),
        params,
        totalPaginas: 1,
        plan,
      };
    });
  }

  async guardarPerfil(auth: CurrentAuth, dto: PerfilImpresionDto, id?: string) {
    const bandeja = await this.prisma.impresionBandeja.findFirst({
      where: { id: dto.bandejaId, destino: { tenantId: auth.tenantId } },
    });
    const papel = await this.prisma.materiaPrima.findFirst({
      where: {
        id: dto.papelMateriaPrimaId,
        tenantId: auth.tenantId,
        activo: true,
        subfamilia: 'SUSTRATO_HOJA',
      },
      select: { id: true },
    });
    if (!bandeja || !papel)
      throw new BadRequestException(
        'Revisá la bandeja y el papel de esta empresa.',
      );
    const { version, ...datos } = dto;
    if (!datos.nombre.trim())
      throw new BadRequestException('Completá el nombre del perfil.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ImpresionDestino" WHERE id = ${bandeja.destinoId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      if ((await this.destino(auth.tenantId, bandeja.destinoId, tx)).cad)
        throw new BadRequestException(
          'Esta impresora usa el piloto CAD. Los perfiles A4 no se aplican al rollo.',
        );
      if (!id)
        return tx.impresionPerfil.create({
          data: {
            ...datos,
            tenantId: auth.tenantId,
            actualizadoPor: auth.email,
          },
        });
      const anterior = await tx.impresionPerfil.findFirst({
        where: { id, bandeja: { destino: { tenantId: auth.tenantId } } },
      });
      if (!anterior) throw new NotFoundException('Perfil no encontrado.');
      if (anterior.tamano === 'CAD')
        throw new BadRequestException('Editá este perfil desde Perfiles CAD.');
      if (anterior.version !== version)
        throw new ConflictException(
          'El perfil cambió. Actualizá antes de guardar.',
        );
      if (anterior.bandejaId !== dto.bandejaId)
        throw new BadRequestException(
          'Creá otro perfil para usar una bandeja diferente.',
        );
      const cambia = (
        ['papelMateriaPrimaId', 'gramaje', 'tamano', 'color', 'faz'] as const
      ).some((k) => anterior[k] !== datos[k]);
      return tx.impresionPerfil.update({
        where: { id },
        data: {
          ...datos,
          probado: cambia ? false : datos.probado,
          actualizadoPor: auth.email,
          version: { increment: 1 },
        },
      });
    });
  }

  async prepararBandeja(
    auth: CurrentAuth,
    id: string,
    dto: PreparacionBandejaDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const bandeja = await tx.impresionBandeja.findFirst({
        where: { id, destino: { tenantId: auth.tenantId } },
      });
      if (!bandeja) throw new NotFoundException('Bandeja no encontrada.');
      await tx.$queryRaw`SELECT id FROM "ImpresionDestino" WHERE id = ${bandeja.destinoId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const perfil = dto.perfilId
        ? await tx.impresionPerfil.findFirst({
            where: {
              id: dto.perfilId,
              bandejaId: id,
              probado: true,
              activo: true,
              modo: 'AUTOMATICO',
            },
          })
        : null;
      if (dto.perfilId && !perfil)
        throw new BadRequestException(
          'Elegí un perfil automático probado de esta bandeja.',
        );
      const result = await tx.impresionBandeja.updateMany({
        where: { id, version: dto.version },
        data: {
          papelPreparadoId: perfil?.papelMateriaPrimaId ?? null,
          gramajePreparado: perfil?.gramaje ?? null,
          preparadoPor: perfil ? auth.email : null,
          preparadoEl: perfil ? new Date() : null,
          version: { increment: 1 },
        },
      });
      if (!result.count)
        throw new ConflictException(
          'La preparación cambió. Actualizá la bandeja.',
        );
      return { ok: true };
    });
  }

  async prueba(auth: CurrentAuth, id: string) {
    const perfil = (await this.perfiles(auth.tenantId)).find(
      (p) => p.id === id,
    );
    if (!perfil || !perfil.activo || !perfil.bandeja.destino.activo)
      throw new NotFoundException('Perfil no disponible.');
    if (perfil.bandeja.destino.cad)
      throw new BadRequestException(
        'Usá Imprimir prueba CAD para este destino.',
      );
    const params = {
      printer: { name: perfil.bandeja.destino.impresora },
      options: {
        copies: 1,
        jobName: `Grafo prueba ${perfil.nombre}`,
        units: 'mm',
        size: { width: 210, height: 297 },
        colorType: perfil.color === 'COLOR' ? 'color' : 'grayscale',
        duplex: perfil.faz === 2 ? 'long-edge' : 'one-sided',
        printerTray: perfil.bandeja.codigo,
        orientation: null,
        rasterize: false,
        scaleContent: true,
      },
      data: [
        {
          type: 'pixel',
          format: 'pdf',
          flavor: 'base64',
          data: pdfPruebaA4(perfil.color === 'COLOR').toString('base64'),
        },
      ],
    };
    return {
      ...this.impresion.firmarDocumento(params),
      params,
      totalPaginas: 2,
    };
  }
}
