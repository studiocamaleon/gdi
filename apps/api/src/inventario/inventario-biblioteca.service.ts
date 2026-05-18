import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FamiliaMateriaPrima,
  Prisma,
  SubfamiliaMateriaPrima,
  UnidadMateriaPrima,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  InstallMaterialPresetDto,
  ModoDuplicadoMaterialPresetDto,
} from './dto/install-material-preset.dto';

type PresetEntity = Prisma.MaterialPresetGetPayload<{
  include: {
    variantes: {
      orderBy: [{ orden: 'asc' }, { espesor: 'asc' }, { skuSugerido: 'asc' }];
    };
  };
}>;

@Injectable()
export class InventarioBibliotecaService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(auth: CurrentAuth) {
    const presets = await this.prisma.materialPreset.findMany({
      where: { activo: true },
      include: {
        variantes: {
          where: { activo: true },
          orderBy: [{ orden: 'asc' }, { espesor: 'asc' }, { skuSugerido: 'asc' }],
        },
      },
      orderBy: [{ orden: 'asc' }, { nombreCanonico: 'asc' }],
    });

    return this.withTenantState(auth, presets);
  }

  async obtener(auth: CurrentAuth, key: string) {
    const preset = await this.prisma.materialPreset.findUnique({
      where: { key },
      include: {
        variantes: {
          where: { activo: true },
          orderBy: [{ orden: 'asc' }, { espesor: 'asc' }, { skuSugerido: 'asc' }],
        },
      },
    });
    if (!preset || !preset.activo) {
      throw new NotFoundException(`Preset ${key} no encontrado`);
    }
    const [item] = await this.withTenantState(auth, [preset]);
    return item;
  }

  async instalar(
    auth: CurrentAuth,
    key: string,
    payload: InstallMaterialPresetDto,
  ) {
    const preset = await this.prisma.materialPreset.findUnique({
      where: { key },
      include: {
        variantes: {
          where: { activo: true },
          orderBy: [{ orden: 'asc' }, { espesor: 'asc' }, { skuSugerido: 'asc' }],
        },
      },
    });
    if (!preset || !preset.activo) {
      throw new NotFoundException(`Preset ${key} no encontrado`);
    }

    const selectedVariantIds = Array.from(new Set(payload.variantPresetIds ?? []));
    const variantsById = new Map(preset.variantes.map((variant) => [variant.id, variant]));
    const selectedVariants = selectedVariantIds.map((id) => {
      const variant = variantsById.get(id);
      if (!variant) {
        throw new BadRequestException(
          'Una de las variantes seleccionadas no pertenece al preset.',
        );
      }
      return variant;
    });
    const customVariants = payload.customVariants ?? [];
    if (selectedVariants.length === 0 && customVariants.length === 0) {
      throw new BadRequestException('Seleccioná al menos una variante.');
    }

    const existingMaterials = await this.prisma.materiaPrima.findMany({
      where: { tenantId: auth.tenantId, materialPresetId: preset.id },
      include: { variantes: true },
      orderBy: { createdAt: 'asc' },
    });
    const targetExisting =
      payload.modoDuplicado === ModoDuplicadoMaterialPresetDto.agregar_faltantes
        ? existingMaterials[0]
        : null;

    const selectedSkus = [
      ...selectedVariants.map((variant) => variant.skuSugerido),
      ...customVariants.map((variant) => variant.sku),
    ].map((sku) => sku.trim());
    await this.assertSkusDisponibles(
      auth.tenantId,
      selectedSkus,
      targetExisting?.id ?? null,
    );

    try {
      const materiaPrimaId = await this.prisma.$transaction(async (tx) => {
        const materiaPrima =
          targetExisting ??
          (await tx.materiaPrima.create({
            data: {
              tenantId: auth.tenantId,
              materialPresetId: preset.id,
              canonicalMaterialKey: preset.key,
              canonicalMaterialName: preset.nombreCanonico,
              canonicalAliasUsado:
                payload.aliasUsado?.trim() || payload.visibleName.trim(),
              codigo: payload.codigo.trim(),
              nombre: payload.visibleName.trim(),
              descripcion:
                payload.descripcion?.trim() || preset.descripcionCorta,
              familia: preset.familia,
              subfamilia: preset.subfamilia,
              tipoTecnico: preset.tipoTecnico,
              templateId: preset.templateId,
              unidadStock: UnidadMateriaPrima.UNIDAD,
              unidadCompra: UnidadMateriaPrima.UNIDAD,
              esConsumible: false,
              esRepuesto: false,
              activo: true,
              atributosTecnicosJson: this.toInputJson({
                ancho: 1.22,
                alto: 2.44,
                espesor: 3,
                colorBase: 'blanco',
              }),
            },
            select: { id: true },
          }));

        const existingVariantPresetIds = new Set(
          targetExisting?.variantes
            .map((variant) => variant.materialPresetVarianteId)
            .filter((id): id is string => Boolean(id)) ?? [],
        );

        for (const variant of selectedVariants) {
          if (targetExisting && existingVariantPresetIds.has(variant.id)) {
            continue;
          }
          await tx.materiaPrimaVariante.create({
            data: {
              tenantId: auth.tenantId,
              materiaPrimaId: materiaPrima.id,
              materialPresetVarianteId: variant.id,
              sku: variant.skuSugerido.trim(),
              nombreVariante: variant.nombreVarianteSugerido,
              activo: true,
              atributosVarianteJson: this.toInputJson(
                variant.atributosVarianteJson,
              ),
              unidadStock: variant.unidadStock,
              unidadCompra: variant.unidadCompra,
              precioReferencia: variant.precioReferencia,
              moneda: variant.moneda,
            },
          });
        }

        for (const variant of customVariants) {
          await tx.materiaPrimaVariante.create({
            data: {
              tenantId: auth.tenantId,
              materiaPrimaId: materiaPrima.id,
              sku: variant.sku.trim(),
              nombreVariante: variant.nombreVariante?.trim() || null,
              activo: true,
              atributosVarianteJson: this.toInputJson(
                variant.atributosVariante,
              ),
              unidadStock: variant.unidadStock
                ? (variant.unidadStock.toUpperCase() as UnidadMateriaPrima)
                : null,
              unidadCompra: variant.unidadCompra
                ? (variant.unidadCompra.toUpperCase() as UnidadMateriaPrima)
                : null,
            },
          });
        }

        return materiaPrima.id;
      });

      const presetActualizado = await this.obtener(auth, key);
      return { materiaPrimaId, preset: presetActualizado };
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una materia prima o variante con ese código/SKU.',
        );
      }
      throw error;
    }
  }

  private async withTenantState(auth: CurrentAuth, presets: PresetEntity[]) {
    const presetIds = presets.map((preset) => preset.id);
    const materias = await this.prisma.materiaPrima.findMany({
      where: {
        tenantId: auth.tenantId,
        materialPresetId: { in: presetIds },
      },
      include: { variantes: true },
      orderBy: { createdAt: 'asc' },
    });
    const materiasByPreset = new Map<string, typeof materias>();
    for (const materia of materias) {
      const key = materia.materialPresetId ?? '';
      materiasByPreset.set(key, [...(materiasByPreset.get(key) ?? []), materia]);
    }

    return presets.map((preset) => {
      const installed = materiasByPreset.get(preset.id) ?? [];
      const installedVariantIds = new Set(
        installed.flatMap((materia) =>
          materia.variantes
            .map((variant) => variant.materialPresetVarianteId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const installedCount = preset.variantes.filter((variant) =>
        installedVariantIds.has(variant.id),
      ).length;
      const totalSuggested = preset.variantes.length;
      const status =
        installedCount === 0
          ? 'not-installed'
          : installedCount >= totalSuggested
            ? 'installed'
            : 'partial';
      const mainMateria = installed[0] ?? null;
      return {
        id: preset.id,
        canonicalKey: preset.key,
        nombreCanonico: preset.nombreCanonico,
        descripcionCorta: preset.descripcionCorta,
        familia: this.toApiEnum(preset.familia),
        subfamilia: this.toApiEnum(preset.subfamilia),
        tipoTecnico: preset.tipoTecnico,
        templateId: preset.templateId,
        iconKind: preset.iconKind,
        aliasDisponibles: this.asStringArray(preset.aliasDisponiblesJson),
        usosRecomendados: this.asStringArray(preset.usosRecomendadosJson),
        procesosCompatibles: this.asStringArray(preset.procesosCompatiblesJson),
        advertencias: this.asStringArray(preset.advertenciasJson),
        installState: {
          status,
          visibleName: mainMateria?.nombre ?? null,
          materiaPrimaId: mainMateria?.id ?? null,
          installedCount,
          totalSuggested,
        },
        variantes: preset.variantes.map((variant) => ({
          id: variant.id,
          skuSugerido: variant.skuSugerido,
          nombreVarianteSugerido: variant.nombreVarianteSugerido,
          formato: variant.formato,
          espesor: variant.espesor ? Number(variant.espesor) : null,
          color: variant.color,
          recomendada: variant.recomendada,
          atributosVariante: variant.atributosVarianteJson,
          unidadStock: variant.unidadStock
            ? this.toApiEnum(variant.unidadStock)
            : null,
          unidadCompra: variant.unidadCompra
            ? this.toApiEnum(variant.unidadCompra)
            : null,
          precioReferencia: variant.precioReferencia
            ? Number(variant.precioReferencia)
            : null,
          moneda: variant.moneda,
          instalada: installedVariantIds.has(variant.id),
        })),
      };
    });
  }

  private async assertSkusDisponibles(
    tenantId: string,
    skus: string[],
    materiaPrimaPermitidaId: string | null,
  ) {
    const normalized = Array.from(new Set(skus.filter(Boolean)));
    if (normalized.length !== skus.length) {
      throw new BadRequestException('Hay SKUs duplicados en la instalación.');
    }
    const existentes = await this.prisma.materiaPrimaVariante.findMany({
      where: {
        tenantId,
        sku: { in: normalized },
        ...(materiaPrimaPermitidaId
          ? { materiaPrimaId: { not: materiaPrimaPermitidaId } }
          : {}),
      },
      select: { sku: true },
    });
    if (existentes.length > 0) {
      throw new ConflictException(
        `Ya existen variantes con SKU: ${existentes
          .map((item) => item.sku)
          .join(', ')}`,
      );
    }
  }

  private asStringArray(value: Prisma.JsonValue) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private toApiEnum(value: string) {
    return value.toLowerCase();
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
