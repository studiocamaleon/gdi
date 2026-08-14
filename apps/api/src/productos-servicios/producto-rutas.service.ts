import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ActualizarProductoRutaAlternativaDto,
  CrearProductoRutaAlternativaDto,
  DuplicarProductoRutaAlternativaDto,
} from './dto/producto-ruta.dto';

@Injectable()
export class ProductoRutasService {
  constructor(private readonly prisma: PrismaService) {}

  async crearProductoRutaAlternativa(
    tenantId: string,
    productoId: string,
    dto: CrearProductoRutaAlternativaDto,
  ) {
    const [producto, ruta, rutaVersion] = await Promise.all([
      this.prisma.producto.findFirst({ where: { id: productoId, tenantId } }),
      this.prisma.ruta.findFirst({ where: { id: dto.rutaId, tenantId } }),
      this.prisma.rutaVersion.findFirst({
        where: { tenantId, rutaId: dto.rutaId, version: dto.rutaVersion },
      }),
    ]);
    if (!producto)
      throw new NotFoundException(`Producto ${productoId} no encontrado`);
    if (!ruta) throw new NotFoundException(`Ruta ${dto.rutaId} no encontrada`);
    if (!rutaVersion) {
      throw new BadRequestException(
        `La versión ${dto.rutaVersion} de la ruta seleccionada no existe`,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.esPreferida) {
          await tx.productoRutaAlternativa.updateMany({
            where: { tenantId, productoId, esPreferida: true },
            data: { esPreferida: false },
          });
        }

        return tx.productoRutaAlternativa.create({
          data: {
            tenantId,
            productoId,
            rutaId: dto.rutaId,
            rutaVersion: dto.rutaVersion,
            nombre: dto.nombre,
            esPreferida: dto.esPreferida ?? false,
            reglaAutoSeleccionJson: (dto.reglaAutoSeleccionJson ??
              Prisma.JsonNull) as Prisma.InputJsonValue,
            orden: dto.orden ?? 0,
            activo: true,
          },
        });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Este producto ya tiene esa ruta como alternativa`,
        );
      }
      throw err;
    }
  }

  async actualizarProductoRutaAlternativa(
    tenantId: string,
    rutaAltId: string,
    dto: ActualizarProductoRutaAlternativaDto,
  ) {
    const existente = await this.prisma.productoRutaAlternativa.findFirst({
      where: { id: rutaAltId, tenantId },
    });
    if (!existente)
      throw new NotFoundException(
        `Ruta alternativa ${rutaAltId} no encontrada`,
      );

    const data: Prisma.ProductoRutaAlternativaUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.esPreferida !== undefined) data.esPreferida = dto.esPreferida;
    if (dto.reglaAutoSeleccionJson !== undefined) {
      data.reglaAutoSeleccionJson =
        dto.reglaAutoSeleccionJson as Prisma.InputJsonValue;
    }
    if (dto.orden !== undefined) data.orden = dto.orden;
    if (dto.activo !== undefined) data.activo = dto.activo;

    return this.prisma.$transaction(async (tx) => {
      if (dto.esPreferida === true) {
        await tx.productoRutaAlternativa.updateMany({
          where: {
            tenantId,
            productoId: existente.productoId,
            esPreferida: true,
            id: { not: rutaAltId },
          },
          data: { esPreferida: false },
        });
      }

      return tx.productoRutaAlternativa.update({
        where: { id: rutaAltId },
        data,
      });
    });
  }

  async duplicarProductoRutaAlternativa(
    tenantId: string,
    rutaAltId: string,
    dto: DuplicarProductoRutaAlternativaDto,
  ) {
    const origen = await this.prisma.productoRutaAlternativa.findFirst({
      where: { id: rutaAltId, tenantId },
      include: {
        ruta: {
          include: {
            pasos: { orderBy: { orden: 'asc' } },
          },
        },
        configPasos: {
          include: {
            slotsMateriales: {
              include: {
                candidatos: {
                  include: { variantes: { orderBy: { orden: 'asc' } } },
                  orderBy: { orden: 'asc' },
                },
              },
              orderBy: { slotCodigo: 'asc' },
            },
            maquinasCandidatas: { orderBy: { orden: 'asc' } },
            cargosDirectosPaso: true,
          },
        },
      },
    });
    if (!origen)
      throw new NotFoundException(
        `Ruta alternativa ${rutaAltId} no encontrada`,
      );

    const nombre = dto.nombre?.trim() || `${origen.nombre} copia`;
    const pasosOrigen = origen.ruta.pasos.filter(
      (paso) => paso.version === origen.rutaVersion,
    );
    if (pasosOrigen.length === 0) {
      throw new BadRequestException(
        `La ruta "${origen.ruta.nombre}" no tiene pasos para la versión ${origen.rutaVersion}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const ordenMax = await tx.productoRutaAlternativa.aggregate({
        where: { tenantId, productoId: origen.productoId },
        _max: { orden: true },
      });

      const alternativaDuplicada = await tx.productoRutaAlternativa.create({
        data: {
          tenantId,
          productoId: origen.productoId,
          rutaId: origen.rutaId,
          rutaVersion: origen.rutaVersion,
          nombre,
          esPreferida: false,
          reglaAutoSeleccionJson: this.jsonOrNull(
            origen.reglaAutoSeleccionJson,
          ),
          orden: (ordenMax._max.orden ?? origen.orden) + 1,
          activo: true,
        },
      });

      for (const config of origen.configPasos) {
        if (!pasosOrigen.some((paso) => paso.id === config.rutaPasoId)) continue;
        const configDuplicada = await tx.productoConfigPaso.create({
          data: {
            tenantId,
            productoRutaAlternativaId: alternativaDuplicada.id,
            rutaPasoId: config.rutaPasoId,
            modoActivacion: config.modoActivacion,
            condicionActivacionJson: this.jsonOrNull(
              config.condicionActivacionJson,
            ),
            modoTiempo: config.modoTiempo,
            mecanismoCantidad: config.mecanismoCantidad,
            mecanismoCantidadConfigJson: this.jsonOrNull(
              config.mecanismoCantidadConfigJson,
            ),
            multiplicadoresActivos: config.multiplicadoresActivos,
            paramsPasoJson: this.jsonOrNull(config.paramsPasoJson),
            nombreVisible: config.nombreVisible,
            maquinaM1Id: config.maquinaM1Id,
            perfilM1Id: config.perfilM1Id,
            centroCostoId: config.centroCostoId,
            setupOverrideMin: config.setupOverrideMin,
            cleanupOverrideMin: config.cleanupOverrideMin,
            tiempoFijoOverrideMin: config.tiempoFijoOverrideMin,
            dotacionOperarios: config.dotacionOperarios,
            requiereRutaPasoIds: config.requiereRutaPasoIds,
            activo: config.activo,
          },
        });

        for (const slot of config.slotsMateriales) {
          const slotDuplicado = await tx.productoConfigPasoSlotMaterial.create({
            data: {
              tenantId,
              productoConfigPasoId: configDuplicada.id,
              slotCodigo: slot.slotCodigo,
              slotNombre: slot.slotNombre,
              slotRol: slot.slotRol,
              modoSeleccion: slot.modoSeleccion,
              criterioMotorAuto: slot.criterioMotorAuto,
              criterioInputCampo: slot.criterioInputCampo,
              criterioMaterialCampo: slot.criterioMaterialCampo,
              materialVarianteId: slot.materialVarianteId,
              estrategiaCosto: slot.estrategiaCosto,
              formula: slot.formula,
              cantidadFactor: slot.cantidadFactor,
              cantidadBase: slot.cantidadBase,
              fuenteMedida: slot.fuenteMedida,
              aplicaMultiCaras: slot.aplicaMultiCaras,
              activo: slot.activo,
            },
          });

          for (const candidato of slot.candidatos) {
            const candidatoDuplicado =
              await tx.productoConfigPasoSlotMaterialCandidato.create({
                data: {
                  tenantId,
                  slotMaterialId: slotDuplicado.id,
                  materiaPrimaId: candidato.materiaPrimaId,
                  defaultVarianteId: candidato.defaultVarianteId,
                  orden: candidato.orden,
                },
              });
            if (candidato.variantes.length > 0) {
              await tx.productoConfigPasoSlotMaterialCandidatoVariante.createMany({
                data: candidato.variantes.map((variante) => ({
                  tenantId,
                  candidatoId: candidatoDuplicado.id,
                  varianteId: variante.varianteId,
                  orden: variante.orden,
                })),
              });
            }
          }
        }

        if (config.maquinasCandidatas.length > 0) {
          await tx.productoConfigPasoMaquinaCandidata.createMany({
            data: config.maquinasCandidatas.map((maquina) => ({
              tenantId,
              productoConfigPasoId: configDuplicada.id,
              maquinaId: maquina.maquinaId,
              perfilDefaultId: maquina.perfilDefaultId,
              modoColorAllowedModes: maquina.modoColorAllowedModes,
              esPreferida: maquina.esPreferida,
              orden: maquina.orden,
              activo: maquina.activo,
            })),
          });
        }

        if (config.cargosDirectosPaso.length > 0) {
          await tx.productoCargoDirectoPaso.createMany({
            data: config.cargosDirectosPaso.map((cargo) => ({
              tenantId,
              productoConfigPasoId: configDuplicada.id,
              cargoDirectoCatalogoId: cargo.cargoDirectoCatalogoId,
              modoActivacion: cargo.modoActivacion,
              condicionActivacionJson: this.jsonOrNull(
                cargo.condicionActivacionJson,
              ),
              configOverrideJson: this.jsonOrNull(cargo.configOverrideJson),
              activo: cargo.activo,
            })),
          });
        }
      }

      return alternativaDuplicada;
    });
  }

  async eliminarProductoRutaAlternativa(tenantId: string, rutaAltId: string) {
    const existente = await this.prisma.productoRutaAlternativa.findFirst({
      where: { id: rutaAltId, tenantId },
    });
    if (!existente)
      throw new NotFoundException(
        `Ruta alternativa ${rutaAltId} no encontrada`,
      );
    return this.prisma.productoRutaAlternativa.delete({
      where: { id: rutaAltId },
    });
  }

  private jsonOrNull(value: Prisma.JsonValue | null) {
    return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }

}
