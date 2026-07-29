import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoCentroCosto } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertProductoConfigPasoDto } from './dto/producto-ruta.dto';
import { FamiliasPasosService } from './familias-pasos.service';
import { construirClaveMatch } from '../motor-universal/tercerizado-costo';
import {
  FAMILIAS,
  formulaEfectivaSlot,
  perfilCompatibleConFamilia,
} from './pasos/familias';
import type { FamiliaCodigo } from './pasos/types';

// [Etapa A] Ambas reglas viven ahora en la declaración de la familia
// (tiposPerfilCompatibles / formulaForzada del slot). Estos alias quedan por
// los call-sites; la lógica única está en pasos/familias.ts.
const tipoPerfilCompatibleConFamilia = perfilCompatibleConFamilia;
const normalizarFormulaSlotMaterial = formulaEfectivaSlot;

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
    await this.validarSlotsMaterialesCompatibles(
      tenantId,
      rutaPaso.familiaCodigo,
      dto,
    );
    const maquinasCandidatas = await this.validarMaquinasCandidatasCompatibles(
      tenantId,
      rutaPaso.familiaCodigo,
      dto,
    );

    if (dto.maquinaM1Id) {
      const maquina = await this.prisma.maquina.findFirst({
        where: { id: dto.maquinaM1Id, tenantId, activo: true },
        include: {
          perfilesOperativos: {
            where: { activo: true },
            select: { id: true, tipoPerfil: true },
          },
        },
      });
      if (!maquina) {
        throw new BadRequestException(
          'La máquina M-1 seleccionada no existe o no está activa.',
        );
      }

      const familia = FAMILIAS[rutaPaso.familiaCodigo as FamiliaCodigo];
      if (
        familia?.plantillasCompatibles.length &&
        !familia.plantillasCompatibles.includes(maquina.plantilla)
      ) {
        throw new BadRequestException(
          `La máquina ${maquina.nombre} no es compatible con la familia ${rutaPaso.familiaCodigo}.`,
        );
      }

      // FRONTERA-PRIMITIVA: la exigencia de corte integrado + perfil de corte
      // es propia de la primitiva plotter sobre impresora híbrida — Tipo B.
      if (
        rutaPaso.familiaCodigo === 'plotter_corte' &&
        maquina.plantilla === 'IMPRESORA_GRAN_FORMATO_POR_AREA'
      ) {
        const params = (maquina.parametrosTecnicosJson ?? {}) as Record<
          string,
          unknown
        >;
        const tienePerfilCorte = maquina.perfilesOperativos.some((perfil) =>
          tipoPerfilCompatibleConFamilia(
            rutaPaso.familiaCodigo,
            perfil.tipoPerfil,
          ),
        );
        if (params.soportaCorteIntegrado !== true || !tienePerfilCorte) {
          throw new BadRequestException(
            'La impresora gran formato seleccionada debe tener corte integrado activo y al menos un perfil operativo de corte.',
          );
        }
      }

      if (dto.perfilM1Id) {
        const perfil = maquina.perfilesOperativos.find(
          (item) => item.id === dto.perfilM1Id,
        );
        if (!perfil) {
          throw new BadRequestException(
            'El perfil M-1 seleccionado no pertenece a la máquina o no está activo.',
          );
        }
        if (
          !tipoPerfilCompatibleConFamilia(
            rutaPaso.familiaCodigo,
            perfil.tipoPerfil,
          )
        ) {
          throw new BadRequestException(
            `El perfil M-1 seleccionado no es compatible con la familia ${rutaPaso.familiaCodigo}.`,
          );
        }
      }
    }

    const centroCostoId = dto.maquinaM1Id ? null : (dto.centroCostoId ?? null);
    if (centroCostoId) {
      const centro = await this.prisma.centroCosto.findFirst({
        where: {
          id: centroCostoId,
          tenantId,
          activo: true,
          tipoCentro: TipoCentroCosto.PRODUCTIVO,
        },
      });
      if (!centro) {
        throw new BadRequestException(
          'El centro de costo del paso debe estar activo y ser productivo.',
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
        nombreVisible: dto.nombreVisible?.trim() || null,
        maquinaM1Id: dto.maquinaM1Id ?? null,
        // El perfil M-1 solo se valida (y tiene sentido) junto a su máquina.
        // Sin maquinaM1Id no se persiste, para no guardar un perfil ajeno.
        perfilM1Id: dto.maquinaM1Id ? (dto.perfilM1Id ?? null) : null,
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
        dotacionOperarios: Math.max(1, Math.round(dto.dotacionOperarios ?? 1)),
        // Un paso no puede requerirse a sí mismo: sería un arrastre trivial que
        // sólo confunde al leer la config.
        requiereRutaPasoIds: (dto.requiereRutaPasoIds ?? []).filter(
          (id) => id !== dto.rutaPasoId,
        ),
        tercerizado: dto.tercerizado ?? false,
        proveedorId: dto.tercerizado ? (dto.proveedorId ?? null) : null,
        fuenteCostoTercerizado: dto.tercerizado
          ? (dto.fuenteCostoTercerizado ?? null)
          : null,
        tercerizadoConfigJson: (dto.tercerizado
          ? (dto.tercerizadoConfigJson ?? Prisma.JsonNull)
          : Prisma.JsonNull) as Prisma.InputJsonValue,
        plazoProveedorDias: dto.tercerizado
          ? (dto.plazoProveedorDias ?? null)
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
        for (const s of dto.slotsMateriales) {
          const slot = await tx.productoConfigPasoSlotMaterial.create({
            data: {
              tenantId,
              productoConfigPasoId: configPaso.id,
              slotCodigo: s.slotCodigo,
              slotNombre: s.slotNombre ?? null,
              slotRol: s.slotRol ?? null,
              modoSeleccion: s.modoSeleccion,
              criterioMotorAuto: s.criterioMotorAuto ?? null,
              criterioInputCampo: s.criterioInputCampo ?? null,
              criterioMaterialCampo: s.criterioMaterialCampo ?? null,
              materialVarianteId: s.materialVarianteId ?? null,
              estrategiaCosto: s.estrategiaCosto ?? 'simple',
              formula: normalizarFormulaSlotMaterial(
                rutaPaso.familiaCodigo,
                s.slotCodigo,
                s.formula,
              ),
              cantidadFactor:
                s.cantidadFactor === null || s.cantidadFactor === undefined
                  ? 1
                  : s.cantidadFactor,
              cantidadBase: s.cantidadBase ?? null,
              aplicaMultiCaras: s.aplicaMultiCaras ?? false,
              activo: true,
            },
          });
          for (const [candidateIndex, candidate] of (
            s.candidatos ?? []
          ).entries()) {
            const createdCandidate =
              await tx.productoConfigPasoSlotMaterialCandidato.create({
                data: {
                  tenantId,
                  slotMaterialId: slot.id,
                  materiaPrimaId: candidate.materiaPrimaId,
                  defaultVarianteId: candidate.defaultVarianteId ?? null,
                  orden: candidate.orden ?? candidateIndex,
                },
              });
            if (candidate.varianteIds.length > 0) {
              await tx.productoConfigPasoSlotMaterialCandidatoVariante.createMany({
                data: candidate.varianteIds.map((varianteId, index) => ({
                  tenantId,
                  candidatoId: createdCandidate.id,
                  varianteId,
                  orden: index,
                })),
              });
            }
          }
        }
      }

      if (dto.maquinasCandidatas) {
        await tx.productoConfigPasoMaquinaCandidata.deleteMany({
          where: { productoConfigPasoId: configPaso.id },
        });
        if (maquinasCandidatas.length > 0) {
          await tx.productoConfigPasoMaquinaCandidata.createMany({
            data: maquinasCandidatas.map((maquina, index) => ({
              tenantId,
              productoConfigPasoId: configPaso.id,
              maquinaId: maquina.maquinaId,
              perfilDefaultId: maquina.perfilDefaultId ?? null,
              modoColorAllowedModes: maquina.modoColorAllowedModes ?? [],
              esPreferida: maquina.esPreferida,
              orden: maquina.orden ?? index,
              activo: true,
            })),
          });
        }
      }

      // Matriz del paso tercerizado (fuente 'matriz'): reemplaza las filas.
      // El claveMatch se deriva server-side con la MISMA función del motor.
      const ejes =
        (
          dto.tercerizadoConfigJson as
            | { ejes?: Array<{ clave: string; orden?: number }> }
            | null
            | undefined
        )?.ejes ?? [];
      if (dto.tercerizado && dto.fuenteCostoTercerizado === 'matriz') {
        await tx.pasoTercerizadoEntrada.deleteMany({
          where: { productoConfigPasoId: configPaso.id },
        });
        const porClave = new Map<
          string,
          { claveMatch: string; valores: Record<string, unknown>; cantidad: number; costo: number }
        >();
        for (const e of dto.tercerizadoEntradas ?? []) {
          const claveMatch = construirClaveMatch(ejes, e.valores);
          if (!claveMatch) continue;
          porClave.set(claveMatch, {
            claveMatch,
            valores: e.valores,
            cantidad: e.cantidad,
            costo: e.costo,
          });
        }
        if (porClave.size > 0) {
          await tx.pasoTercerizadoEntrada.createMany({
            data: [...porClave.values()].map((f) => ({
              tenantId,
              productoConfigPasoId: configPaso.id,
              valoresJson: f.valores as Prisma.InputJsonValue,
              claveMatch: f.claveMatch,
              cantidad: f.cantidad,
              costo: new Prisma.Decimal(f.costo),
              activo: true,
            })),
          });
        }
      } else if (existente) {
        // Dejó de ser matriz (o de ser tercerizado): limpiar filas viejas.
        await tx.pasoTercerizadoEntrada.deleteMany({
          where: { productoConfigPasoId: configPaso.id },
        });
      }

      return configPaso;
    });
  }

  private async validarMaquinasCandidatasCompatibles(
    tenantId: string,
    familiaCodigo: string,
    dto: UpsertProductoConfigPasoDto,
  ) {
    if (!dto.maquinasCandidatas) return [];
    const unique = new Map<
      string,
      {
        maquinaId: string;
        perfilDefaultId?: string | null;
        modoColorAllowedModes?: string[];
        esPreferida?: boolean;
        orden?: number;
      }
    >();
    for (const [index, candidate] of dto.maquinasCandidatas.entries()) {
      if (!unique.has(candidate.maquinaId)) {
        unique.set(candidate.maquinaId, {
          maquinaId: candidate.maquinaId,
          perfilDefaultId: candidate.perfilDefaultId ?? null,
          modoColorAllowedModes: candidate.modoColorAllowedModes ?? [],
          esPreferida: candidate.esPreferida,
          orden: candidate.orden ?? index,
        });
      }
    }
    const candidates = Array.from(unique.values()).sort(
      (a, b) => (a.orden ?? 0) - (b.orden ?? 0),
    );
    if (candidates.length === 0) return [];

    const maquinas = await this.prisma.maquina.findMany({
      where: {
        tenantId,
        activo: true,
        id: { in: candidates.map((candidate) => candidate.maquinaId) },
      },
      include: {
        perfilesOperativos: {
          where: { activo: true },
          select: { id: true, tipoPerfil: true },
        },
      },
    });
    const maquinasById = new Map(maquinas.map((maquina) => [maquina.id, maquina]));
    const familia = FAMILIAS[familiaCodigo as FamiliaCodigo];

    for (const candidate of candidates) {
      const maquina = maquinasById.get(candidate.maquinaId);
      if (!maquina) {
        throw new BadRequestException(
          'Una máquina candidata no existe o no está activa.',
        );
      }
      if (
        familia?.plantillasCompatibles.length &&
        !familia.plantillasCompatibles.includes(maquina.plantilla)
      ) {
        throw new BadRequestException(
          `La máquina candidata ${maquina.nombre} no es compatible con la familia ${familiaCodigo}.`,
        );
      }
      const tienePerfilCompatible = maquina.perfilesOperativos.some((perfil) =>
        tipoPerfilCompatibleConFamilia(
          familiaCodigo,
          String(perfil.tipoPerfil ?? ''),
        ),
      );
      if (!tienePerfilCompatible) {
        throw new BadRequestException(
          `La máquina candidata ${maquina.nombre} no tiene perfiles operativos compatibles con ${familiaCodigo}.`,
        );
      }
      if (candidate.perfilDefaultId) {
        const perfilDefault = maquina.perfilesOperativos.find(
          (perfil) => perfil.id === candidate.perfilDefaultId,
        );
        if (!perfilDefault) {
          throw new BadRequestException(
            `El perfil default de la candidata ${maquina.nombre} no pertenece a la máquina o no está activo.`,
          );
        }
        if (
          !tipoPerfilCompatibleConFamilia(
            familiaCodigo,
            String(perfilDefault.tipoPerfil ?? ''),
          )
        ) {
          throw new BadRequestException(
            `El perfil default ${perfilDefault.id} no es compatible con ${familiaCodigo}.`,
          );
        }
      }

      // FRONTERA-PRIMITIVA: misma exigencia que arriba, para candidatas M-2.
      if (
        familiaCodigo === 'plotter_corte' &&
        maquina.plantilla === 'IMPRESORA_GRAN_FORMATO_POR_AREA'
      ) {
        const params = (maquina.parametrosTecnicosJson ?? {}) as Record<
          string,
          unknown
        >;
        if (params.soportaCorteIntegrado !== true) {
          throw new BadRequestException(
            'La impresora gran formato candidata debe tener corte integrado activo.',
          );
        }
      }
    }

    const preferredId =
      candidates.find((candidate) => candidate.esPreferida)?.maquinaId ??
      candidates[0]?.maquinaId;
    return candidates.map((candidate, index) => ({
      maquinaId: candidate.maquinaId,
      perfilDefaultId: candidate.perfilDefaultId ?? null,
      modoColorAllowedModes: candidate.modoColorAllowedModes ?? [],
      esPreferida: candidate.maquinaId === preferredId,
      orden: candidate.orden ?? index,
    }));
  }

  private async validarSlotsMaterialesCompatibles(
    tenantId: string,
    familiaCodigo: string,
    dto: UpsertProductoConfigPasoDto,
  ) {
    const familia = FAMILIAS[familiaCodigo as FamiliaCodigo];
    if (!familia || !dto.slotsMateriales) return;
    const variants = new Map<string, { materiaPrimaId: string }>();
    const materialIds = new Set<string>();
    for (const slot of dto.slotsMateriales) {
      if (slot.materialVarianteId) variants.set(slot.materialVarianteId, { materiaPrimaId: '' });
      for (const candidate of slot.candidatos ?? []) {
        materialIds.add(candidate.materiaPrimaId);
        for (const variantId of candidate.varianteIds) {
          variants.set(variantId, { materiaPrimaId: candidate.materiaPrimaId });
        }
        if (candidate.defaultVarianteId) {
          variants.set(candidate.defaultVarianteId, {
            materiaPrimaId: candidate.materiaPrimaId,
          });
        }
      }
    }
    const [materias, variantes] = await Promise.all([
      this.prisma.materiaPrima.findMany({
        where: { tenantId, id: { in: [...materialIds] } },
        select: {
          id: true,
          familia: true,
          subfamilia: true,
          templateId: true,
          tipoTecnico: true,
        },
      }),
      this.prisma.materiaPrimaVariante.findMany({
        where: { tenantId, id: { in: [...variants.keys()] } },
        select: { id: true, materiaPrimaId: true },
      }),
    ]);
    const materiaById = new Map(materias.map((m) => [m.id, m]));
    const varianteById = new Map(variantes.map((v) => [v.id, v]));

    // Scope por tenant obligatorio para TODO id referenciado, incluso en slots
    // que luego saltean la validación de compatibilidad (no declarados o
    // CONSUMIBLE_MAQUINA). Sin esto, un slotCodigo arbitrario permitiría
    // persistir materiales/variantes de otro tenant y filtrarlos al leer.
    for (const materiaId of materialIds) {
      if (!materiaById.has(materiaId)) {
        throw new BadRequestException(
          'Una materia prima referenciada no existe o no pertenece a tu empresa.',
        );
      }
    }
    for (const variantId of variants.keys()) {
      if (!varianteById.has(variantId)) {
        throw new BadRequestException(
          'Una variante referenciada no existe o no pertenece a tu empresa.',
        );
      }
    }
    const compatible = (
      materia: {
        familia: string;
        subfamilia: string;
        templateId: string;
        tipoTecnico: string;
      },
      compat?: NonNullable<
        (typeof familia.slotsRequeridos)[number]['compatibilidadMaterial']
      >,
    ) => {
      if (!compat) return false;
      if (
        compat.familiasMateriaPrima?.length &&
        !compat.familiasMateriaPrima.includes(materia.familia as never)
      ) {
        return false;
      }
      if (
        compat.subfamiliasMateriaPrima?.length &&
        !compat.subfamiliasMateriaPrima.includes(materia.subfamilia as never)
      ) {
        return false;
      }
      if (
        compat.templateIds?.length &&
        !compat.templateIds.includes(materia.templateId)
      ) {
        return false;
      }
      if (
        compat.tipoTecnico?.length &&
        !compat.tipoTecnico.includes(materia.tipoTecnico)
      ) {
        return false;
      }
      return true;
    };
    for (const slot of dto.slotsMateriales) {
      const slotDecl = familia.slotsRequeridos.find(
        (decl) => decl.codigo === slot.slotCodigo,
      );
      if (!slotDecl || slotDecl.tipo === 'CONSUMIBLE_MAQUINA') continue;
      const assertMateria = (materiaId: string) => {
        const materia = materiaById.get(materiaId);
        if (!materia || !compatible(materia, slotDecl.compatibilidadMaterial)) {
          throw new BadRequestException(
            `El material configurado no es compatible con el slot ${slot.slotCodigo} de ${familiaCodigo}.`,
          );
        }
      };
      if (slot.materialVarianteId) {
        const variante = varianteById.get(slot.materialVarianteId);
        if (!variante) {
          throw new BadRequestException(
            `La variante fija del slot ${slot.slotCodigo} no existe.`,
          );
        }
        const materia = await this.prisma.materiaPrima.findFirst({
          where: { tenantId, id: variante.materiaPrimaId },
          select: {
            id: true,
            familia: true,
            subfamilia: true,
            templateId: true,
            tipoTecnico: true,
          },
        });
        if (!materia || !compatible(materia, slotDecl.compatibilidadMaterial)) {
          throw new BadRequestException(
            `La variante fija no es compatible con el slot ${slot.slotCodigo}.`,
          );
        }
      }
      for (const candidate of slot.candidatos ?? []) {
        assertMateria(candidate.materiaPrimaId);
        for (const variantId of [
          ...candidate.varianteIds,
          candidate.defaultVarianteId,
        ].filter((value): value is string => Boolean(value))) {
          const variante = varianteById.get(variantId);
          if (!variante || variante.materiaPrimaId !== candidate.materiaPrimaId) {
            throw new BadRequestException(
              `La variante candidata no pertenece a la materia prima configurada en ${slot.slotCodigo}.`,
            );
          }
        }
      }
    }
  }
}
