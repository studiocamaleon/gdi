import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ActualizarRutaDto,
  CrearRutaDto,
  DuplicarRutaDto,
} from './dto/ruta.dto';
import { FamiliasPasosService } from './familias-pasos.service';

@Injectable()
export class RutasProduccionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familias: FamiliasPasosService,
  ) {}

  async listarRutas(tenantId: string) {
    const rutas = await this.prisma.ruta.findMany({
      where: { tenantId, activo: true },
      orderBy: { nombre: 'asc' },
      include: {
        pasos: {
          orderBy: { orden: 'asc' },
          select: {
            id: true,
            version: true,
            orden: true,
            familiaCodigo: true,
            icono: true,
          },
        },
        _count: { select: { productosAlternativas: true } },
      },
    });

    return rutas.map((ruta) => ({
      ...ruta,
      pasos: ruta.pasos.filter((paso) => paso.version === ruta.versionActual),
    }));
  }

  async crearRuta(tenantId: string, dto: CrearRutaDto) {
    this.familias.validarFamiliasDePasos(dto.pasos);
    const baseCodigo = dto.codigo?.trim() || this.codigoFromNombre(dto.nombre);
    const codigo = await this.nextCopyCode(tenantId, baseCodigo);
    try {
      const ruta = await this.prisma.ruta.create({
        data: {
          tenantId,
          codigo,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          versionActual: 1,
          activo: true,
          pasos: {
            create: dto.pasos.map((p) => ({
              tenantId,
              version: 1,
              orden: p.orden,
              familiaCodigo: p.familiaCodigo,
              icono: p.icono ?? 'Layout',
              activo: true,
            })),
          },
        },
        include: { pasos: true },
      });
      await this.prisma.rutaVersion.create({
        data: {
          tenantId,
          rutaId: ruta.id,
          version: 1,
          snapshotJson: this.buildRutaSnapshot(ruta.pasos),
          cambios: 'Versión inicial',
        },
      });
      return ruta;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Ya existe una ruta con código "${codigo}"`,
        );
      }
      throw err;
    }
  }

  async duplicarRuta(tenantId: string, id: string, dto: DuplicarRutaDto = {}) {
    const origen = await this.prisma.ruta.findFirst({
      where: { id, tenantId },
      include: {
        pasos: { orderBy: { orden: 'asc' } },
      },
    });
    if (!origen) throw new NotFoundException(`Ruta ${id} no encontrada`);

    const pasosActuales = origen.pasos.filter(
      (paso) => paso.version === origen.versionActual,
    );
    if (pasosActuales.length === 0) {
      throw new BadRequestException(
        `Ruta "${origen.nombre}" no tiene pasos para duplicar.`,
      );
    }

    const nombre = dto.nombre?.trim() || `${origen.nombre} copia`;
    const baseCodigo = dto.codigo?.trim() || this.codigoFromNombre(nombre);
    const codigo = await this.nextCopyCode(tenantId, baseCodigo);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const rutaDuplicada = await tx.ruta.create({
          data: {
            tenantId,
            codigo,
            nombre,
            descripcion: origen.descripcion,
            versionActual: 1,
            activo: dto.activo ?? true,
            pasos: {
              create: pasosActuales.map((paso) => ({
                tenantId,
                version: 1,
                orden: paso.orden,
                familiaCodigo: paso.familiaCodigo,
                icono: paso.icono,
                activo: paso.activo,
              })),
            },
          },
          include: { pasos: true },
        });

        await tx.rutaVersion.create({
          data: {
            tenantId,
            rutaId: rutaDuplicada.id,
            version: 1,
            snapshotJson: this.buildRutaSnapshot(rutaDuplicada.pasos),
            cambios: 'Versión inicial',
          },
        });

        return rutaDuplicada;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Ya existe una ruta con código "${codigo}"`,
        );
      }
      throw err;
    }
  }

  async actualizarRuta(tenantId: string, id: string, dto: ActualizarRutaDto) {
    const existente = await this.prisma.ruta.findFirst({
      where: { id, tenantId },
      include: {
        pasos: { orderBy: { orden: 'asc' } },
        productosAlternativas: true,
      },
    });
    if (!existente) throw new NotFoundException(`Ruta ${id} no encontrada`);

    if (dto.pasos) {
      this.familias.validarFamiliasDePasos(dto.pasos);
    }

    const cambioEstructural = dto.pasos !== undefined;
    const debeSerNuevaVersion =
      dto.nuevaVersion === true ||
      (cambioEstructural && dto.nuevaVersion !== false);

    return this.prisma.$transaction(async (tx) => {
      const dataBase: Prisma.RutaUpdateInput = {};
      if (dto.nombre !== undefined) dataBase.nombre = dto.nombre;
      if (dto.descripcion !== undefined) dataBase.descripcion = dto.descripcion;
      if (dto.activo !== undefined) dataBase.activo = dto.activo;

      if (dto.pasos) {
        if (debeSerNuevaVersion && existente.productosAlternativas.length > 0) {
          const maxVersion = await tx.rutaPaso.aggregate({
            where: { tenantId, rutaId: id },
            _max: { version: true },
          });
          const nuevaVersion =
            Math.max(
              existente.versionActual,
              maxVersion._max.version ?? existente.versionActual,
            ) + 1;
          dataBase.versionActual = nuevaVersion;
          await tx.rutaPaso.createMany({
            data: dto.pasos.map((p) => ({
              tenantId,
              rutaId: id,
              version: nuevaVersion,
              orden: p.orden,
              familiaCodigo: p.familiaCodigo,
              icono: p.icono ?? 'Layout',
              activo: true,
            })),
          });
          const nuevosPasos = await tx.rutaPaso.findMany({
            where: { tenantId, rutaId: id, version: nuevaVersion },
            orderBy: { orden: 'asc' },
          });
          await tx.rutaVersion.create({
            data: {
              tenantId,
              rutaId: id,
              version: nuevaVersion,
              snapshotJson: this.buildRutaSnapshot(nuevosPasos),
              cambios: dto.cambios ?? 'Actualización de pasos',
            },
          });
        } else {
          const version = existente.versionActual;
          await this.reconciliarPasosVersionInPlace(tx, {
            tenantId,
            rutaId: id,
            version,
            pasos: dto.pasos,
          });
          const pasosActualizados = await tx.rutaPaso.findMany({
            where: { tenantId, rutaId: id, version },
            orderBy: { orden: 'asc' },
          });
          await tx.rutaVersion.upsert({
            where: {
              tenantId_rutaId_version: {
                tenantId,
                rutaId: id,
                version,
              },
            },
            create: {
              tenantId,
              rutaId: id,
              version,
              snapshotJson: this.buildRutaSnapshot(pasosActualizados),
              cambios: dto.cambios ?? 'Actualización de pasos',
            },
            update: {
              snapshotJson: this.buildRutaSnapshot(pasosActualizados),
              cambios: dto.cambios ?? 'Actualización de pasos',
            },
          });
        }
      }

      const ruta = await tx.ruta.update({
        where: { id },
        data: dataBase,
        include: { pasos: { orderBy: { orden: 'asc' } } },
      });
      return {
        ...ruta,
        pasos: ruta.pasos.filter((paso) => paso.version === ruta.versionActual),
      };
    });
  }

  private async reconciliarPasosVersionInPlace(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      rutaId: string;
      version: number;
      pasos: Array<{ orden: number; familiaCodigo: string; icono?: string }>;
    },
  ) {
    const actuales = await tx.rutaPaso.findMany({
      where: {
        tenantId: args.tenantId,
        rutaId: args.rutaId,
        version: args.version,
      },
      orderBy: { orden: 'asc' },
    });
    const usados = new Set<string>();
    const matches = args.pasos.map((paso) => {
      const sameFamily = actuales
        .filter(
          (actual) =>
            !usados.has(actual.id) &&
            actual.familiaCodigo === paso.familiaCodigo,
        )
        .sort(
          (a, b) =>
            Math.abs(a.orden - paso.orden) - Math.abs(b.orden - paso.orden),
        )[0];
      const fallbackSameOrder = actuales.find(
        (actual) => !usados.has(actual.id) && actual.orden === paso.orden,
      );
      const actual = sameFamily ?? fallbackSameOrder ?? null;
      if (actual) usados.add(actual.id);
      return { paso, actual };
    });

    for (const actual of actuales) {
      if (usados.has(actual.id)) continue;
      await tx.productoConfigPaso.deleteMany({
        where: { tenantId: args.tenantId, rutaPasoId: actual.id },
      });
      await tx.rutaPaso.delete({ where: { id: actual.id } });
    }

    for (const [index, match] of matches.entries()) {
      if (!match.actual) continue;
      if (match.actual.familiaCodigo !== match.paso.familiaCodigo) {
        await tx.productoConfigPaso.deleteMany({
          where: { tenantId: args.tenantId, rutaPasoId: match.actual.id },
        });
      }
      await tx.rutaPaso.update({
        where: { id: match.actual.id },
        data: { orden: -10_000 - index },
      });
    }

    for (const match of matches) {
      if (match.actual) {
        await tx.rutaPaso.update({
          where: { id: match.actual.id },
          data: {
            orden: match.paso.orden,
            familiaCodigo: match.paso.familiaCodigo,
            icono: match.paso.icono ?? match.actual.icono,
            activo: true,
          },
        });
        continue;
      }

      await tx.rutaPaso.create({
        data: {
          tenantId: args.tenantId,
          rutaId: args.rutaId,
          version: args.version,
          orden: match.paso.orden,
          familiaCodigo: match.paso.familiaCodigo,
          icono: match.paso.icono ?? 'Layout',
          activo: true,
        },
      });
    }
  }

  async eliminarRuta(tenantId: string, id: string) {
    const existente = await this.prisma.ruta.findFirst({
      where: { id, tenantId },
      include: { productosAlternativas: { take: 1 } },
    });
    if (!existente) throw new NotFoundException(`Ruta ${id} no encontrada`);

    if (existente.productosAlternativas.length > 0) {
      throw new BadRequestException(
        `Ruta "${existente.nombre}" está siendo usada por ${existente.productosAlternativas.length} producto(s). Marcala como inactiva en vez de eliminarla.`,
      );
    }

    return this.prisma.ruta.delete({ where: { id } });
  }

  private async nextCopyCode(tenantId: string, codigoBase: string) {
    const base = codigoBase.slice(0, 100);
    for (let index = 1; index < 1000; index += 1) {
      const suffix = `-${index}`;
      const candidate =
        index === 1 ? base : `${base.slice(0, 100 - suffix.length)}${suffix}`;
      const exists = await this.prisma.ruta.findFirst({
        where: { tenantId, codigo: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    throw new BadRequestException(
      'No se pudo generar un código de copia único.',
    );
  }

  private codigoFromNombre(nombre: string) {
    const codigo = nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .toUpperCase();
    return codigo || 'RUTA-COPIA';
  }

  async obtenerRuta(tenantId: string, id: string) {
    const ruta = await this.prisma.ruta.findFirst({
      where: { id, tenantId },
      include: {
        pasos: { orderBy: { orden: 'asc' } },
        versiones: { orderBy: { version: 'desc' }, take: 5 },
        productosAlternativas: {
          include: {
            producto: { select: { id: true, codigo: true, nombre: true } },
          },
        },
      },
    });
    if (!ruta) throw new NotFoundException(`Ruta ${id} no encontrada`);
    return {
      ...ruta,
      pasos: ruta.pasos.filter((paso) => paso.version === ruta.versionActual),
    };
  }

  buildRutaSnapshot(
    pasos: Array<{
      id: string;
      orden: number;
      familiaCodigo: string;
      icono?: string;
      version?: number;
      activo?: boolean;
    }>,
  ): Prisma.InputJsonObject {
    return {
      pasos: pasos
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((paso) => ({
          id: paso.id,
          orden: paso.orden,
          familiaCodigo: paso.familiaCodigo,
          familia: paso.familiaCodigo,
          icono: paso.icono ?? 'Layout',
          version: paso.version ?? 1,
          activo: paso.activo ?? true,
        })),
    };
  }
}
