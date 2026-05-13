import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UnidadBaseCentroCosto } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertProductoConfigPasoDto } from './dto/producto-ruta.dto';
import { FamiliasPasosService } from './familias-pasos.service';

const UNIDADES_CENTRO_COSTO_HORARIAS = [
  UnidadBaseCentroCosto.HORA_HOMBRE,
  UnidadBaseCentroCosto.HORA_MAQUINA,
];

@Injectable()
export class ConfigPasosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familias: FamiliasPasosService,
  ) {}

  async upsertConfigPaso(
    tenantId: string,
    rutaAltId: string,
    dto: UpsertProductoConfigPasoDto,
  ) {
    const rutaAlt = await this.prisma.productoRutaAlternativa.findFirst({
      where: { id: rutaAltId, tenantId },
    });
    if (!rutaAlt)
      throw new NotFoundException(
        `Ruta alternativa ${rutaAltId} no encontrada`,
      );

    const rutaPaso = await this.prisma.rutaPaso.findFirst({
      where: {
        id: dto.rutaPasoId,
        tenantId,
        rutaId: rutaAlt.rutaId,
        version: rutaAlt.rutaVersion,
      },
    });
    if (!rutaPaso) {
      throw new BadRequestException(
        'El paso configurado no pertenece a la ruta y versión de esta alternativa.',
      );
    }
    this.familias.validarConfigPasoContraFamilia(rutaPaso.familiaCodigo, dto);

    const centroCostoId = dto.maquinaM1Id ? null : (dto.centroCostoId ?? null);
    if (centroCostoId) {
      const centro = await this.prisma.centroCosto.findFirst({
        where: {
          id: centroCostoId,
          tenantId,
          activo: true,
          unidadBaseFutura: { in: UNIDADES_CENTRO_COSTO_HORARIAS },
        },
      });
      if (!centro) {
        throw new BadRequestException(
          'El centro de costo del paso debe estar activo y usar una unidad horaria.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const existente = await tx.productoConfigPaso.findFirst({
        where: {
          tenantId,
          productoRutaAlternativaId: rutaAltId,
          rutaPasoId: dto.rutaPasoId,
        },
      });

      const data: Prisma.ProductoConfigPasoUncheckedCreateInput = {
        tenantId,
        productoRutaAlternativaId: rutaAltId,
        rutaPasoId: dto.rutaPasoId,
        modoActivacion: dto.modoActivacion ?? null,
        condicionActivacionJson: (dto.condicionActivacionJson ??
          Prisma.JsonNull) as Prisma.InputJsonValue,
        modoTiempo: dto.modoTiempo ?? null,
        mecanismoCantidad: dto.mecanismoCantidad ?? null,
        mecanismoCantidadConfigJson: (dto.mecanismoCantidadConfigJson ??
          Prisma.JsonNull) as Prisma.InputJsonValue,
        multiplicadoresActivos: dto.multiplicadoresActivos ?? [],
        paramsPasoJson: (dto.paramsPasoJson ??
          Prisma.JsonNull) as Prisma.InputJsonValue,
        maquinaM1Id: dto.maquinaM1Id ?? null,
        perfilM1Id: dto.perfilM1Id ?? null,
        centroCostoId,
        setupOverrideMin:
          dto.setupOverrideMin != null
            ? new Prisma.Decimal(dto.setupOverrideMin)
            : null,
        cleanupOverrideMin:
          dto.cleanupOverrideMin != null
            ? new Prisma.Decimal(dto.cleanupOverrideMin)
            : null,
        tiempoFijoOverrideMin:
          dto.tiempoFijoOverrideMin != null
            ? new Prisma.Decimal(dto.tiempoFijoOverrideMin)
            : null,
        activo: true,
      };

      let configPaso;
      if (existente) {
        configPaso = await tx.productoConfigPaso.update({
          where: { id: existente.id },
          data,
        });
      } else {
        configPaso = await tx.productoConfigPaso.create({ data });
      }

      if (dto.slotsMateriales) {
        await tx.productoConfigPasoSlotMaterial.deleteMany({
          where: { productoConfigPasoId: configPaso.id },
        });
        if (dto.slotsMateriales.length > 0) {
          await tx.productoConfigPasoSlotMaterial.createMany({
            data: dto.slotsMateriales.map((s) => ({
              tenantId,
              productoConfigPasoId: configPaso.id,
              slotCodigo: s.slotCodigo,
              modoSeleccion: s.modoSeleccion,
              criterioMotorAuto: s.criterioMotorAuto ?? null,
              criterioInputCampo: s.criterioInputCampo ?? null,
              criterioMaterialCampo: s.criterioMaterialCampo ?? null,
              materialVarianteId: s.materialVarianteId ?? null,
              materialesCandidatosJson: (s.materialesCandidatosJson ??
                Prisma.JsonNull) as Prisma.InputJsonValue,
              estrategiaCosto: s.estrategiaCosto ?? 'simple',
              formula: s.formula ?? 'por_unidad_productiva',
              aplicaMultiCaras: s.aplicaMultiCaras ?? false,
              activo: true,
            })),
          });
        }
      }

      return configPaso;
    });
  }
}
