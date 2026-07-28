import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EstadoMaquina,
  EstadoConfiguracionMaquina,
  GeometriaTrabajoMaquina,
  PlantillaMaquinaria,
  Prisma,
  TipoComponenteDesgasteMaquina,
  TipoConsumibleMaquina,
  TipoPerfilOperativoMaquina,
  UnidadConsumoMaquina,
  UnidadDesgasteMaquina,
  UnidadProduccionMaquina,
} from '@prisma/client';
import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
} from '@prisma/client/runtime/library';
import type { CurrentAuth } from '../auth/auth.types';
import { PaginationDto, paginatedResponse } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoConfiguracionMaquinaDto,
  GeometriaTrabajoMaquinaDto,
  PlantillaMaquinariaDto,
  UnidadProduccionMaquinaDto,
  type EstadoMaquinaDto,
  type MaquinaComponenteDesgasteItemDto,
  type MaquinaConsumibleItemDto,
  type MaquinaPerfilOperativoItemDto,
  type TipoComponenteDesgasteMaquinaDto,
  type TipoConsumibleMaquinaDto,
  type TipoPerfilOperativoMaquinaDto,
  type UnidadConsumoMaquinaDto,
  type UnidadDesgasteMaquinaDto,
  UpsertMaquinaDto,
} from './dto/upsert-maquina.dto';
import {
  hasRequiredMachineDataByTemplate,
  validateMachinePayloadByTemplate,
} from './maquinaria-template-machine-rules';
import { validatePerfilOperativoByTemplate } from './maquinaria-template-profile-rules';
import {
  consumableTypeForChannel,
  consumableUnitForTemplate,
  getConsumableChannelFromDetail,
  getPerfilConsumableChannels,
  isConsumableChannel,
  PRINTER_TEMPLATES_WITH_MACHINE_CONSUMABLES,
  requiredConsumableChannelsFromColorMode,
} from './consumibles-impresion';

type MaquinaCompleta = Prisma.MaquinaGetPayload<{
  include: {
    planta: true;
    centroCostoPrincipal: true;
    perfilesOperativos: true;
    consumibles: {
      include: {
        perfilOperativo: true;
        materiaPrimaVariante: {
          include: {
            materiaPrima: true;
          };
        };
      };
    };
    componentesDesgaste: {
      include: {
        materiaPrimaVariante: {
          include: {
            materiaPrima: true;
          };
        };
      };
    };
  };
}>;

type TemplateCatalogRule = {
  geometry: GeometriaTrabajoMaquinaDto;
  allowedGeometries?: GeometriaTrabajoMaquinaDto[];
  defaultProductionUnit: UnidadProduccionMaquinaDto;
  allowedProductionUnits?: UnidadProduccionMaquinaDto[];
};

/**
 * Reglas de geometría + unidad de producción por plantilla — v3.0 (2026-04-26).
 * Doc: `docs/motor-por-pasos-analisis/06-maquinas-y-perfiles.md` §5–§13.
 */
const TEMPLATE_CATALOG_RULES: Record<
  PlantillaMaquinariaDto,
  TemplateCatalogRule
> = {
  impresora_laser: {
    geometry: GeometriaTrabajoMaquinaDto.pliego,
    defaultProductionUnit: UnidadProduccionMaquinaDto.ppm,
  },
  // §6: una sola plantilla unifica LATEX/SOLVENTE/UV/SUBLIMACION/DTF_*.
  // La geometría real (rollo o mesa) viene del paramsTecnicos.geometria.
  // Geometría aquí: rollo por defecto (más común), el modelador puede
  // cambiar en el frontend si declara MESA_EXTENSORA.
  impresora_gran_formato_por_area: {
    geometry: GeometriaTrabajoMaquinaDto.rollo,
    allowedGeometries: [
      GeometriaTrabajoMaquinaDto.rollo,
      GeometriaTrabajoMaquinaDto.plano,
    ],
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2_h,
  },
  guillotina: {
    geometry: GeometriaTrabajoMaquinaDto.pliego,
    defaultProductionUnit: UnidadProduccionMaquinaDto.cortes_min,
    allowedProductionUnits: [
      UnidadProduccionMaquinaDto.cortes_min,
      UnidadProduccionMaquinaDto.ciclo,
    ],
  },
  plotter_de_corte: {
    geometry: GeometriaTrabajoMaquinaDto.rollo,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2_h,
  },
  plotter_cad: {
    geometry: GeometriaTrabajoMaquinaDto.rollo,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2_h,
  },
  laminadora_bopp_rollo: {
    geometry: GeometriaTrabajoMaquinaDto.rollo,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m_min,
  },
  corte_laser: {
    geometry: GeometriaTrabajoMaquinaDto.plano,
    defaultProductionUnit: UnidadProduccionMaquinaDto.hora,
  },
  router_cnc: {
    geometry: GeometriaTrabajoMaquinaDto.volumen,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2_h,
  },
  anilladora: {
    geometry: GeometriaTrabajoMaquinaDto.pliego,
    defaultProductionUnit: UnidadProduccionMaquinaDto.hora,
  },
  soldadora: {
    geometry: GeometriaTrabajoMaquinaDto.volumen,
    defaultProductionUnit: UnidadProduccionMaquinaDto.hora,
  },
  cabina_pintura: {
    geometry: GeometriaTrabajoMaquinaDto.volumen,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2_h,
  },
  mesa_de_corte: {
    geometry: GeometriaTrabajoMaquinaDto.plano,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2,
  },
};

const TEMPLATE_ALLOWED_TECHNICAL_KEYS = new Set([
  'altoMaxHoja',
  'altoMinHoja',
  'alturaMaximaCapa',
  'alturaMaximaObjeto',
  'alturaMinimaCapa',
  'anchoCama',
  'anchoMaxHoja',
  'anchoMinHoja',
  'anchoUtil',
  'areaImprimibleMaxima',
  'bannerSoportado',
  'barnizDisponible',
  'blancoDisponible',
  'cambiadorAutomatico',
  'cantidadExtrusores',
  'cantidadHerramientas',
  'configuracionCanales',
  'configuracionColor',
  'configuracionTintas',
  'controladorRip',
  'despejeZ',
  'diametroBoquilla',
  'diametroMaximo',
  'diametroMaximoBobina',
  'diametroMinimo',
  'duplexSoportado',
  'ejeXUtil',
  'ejeYUtil',
  'ejeZUtil',
  'espesorMaximo',
  'espesorMaximoFilm',
  'espesorMaximoPorMaterial',
  'espesorMaximoMaterial',
  'extraccionAsistida',
  'gramajeMaximo',
  'gramajeMinimo',
  'herramientasCompatibles',
  'largoCama',
  'largoMaximoBanner',
  'largoUtil',
  'margenDerecho',
  'margenFinalNoImprimible',
  'margenInferior',
  'margenInicioNoImprimible',
  'margenLateralDerechoNoImprimible',
  'margenLateralIzquierdoNoImprimible',
  'margenIzquierdo',
  'margenSuperior',
  'materialesCompatibles',
  'objetosCompatibles',
  'pesoMaximoBobina',
  'pesoMaximoObjeto',
  'pesoMaximoSoportado',
  'potenciaLaser',
  'potenciaSpindle',
  'primerDisponible',
  'resolucionNominal',
  'rotacionControlada',
  'rpmMaxima',
  'rpmMinima',
  'sistemaCurado',
  'sistemaSecadoCurado',
  'sistemaLaminacionTransferencia',
  'soportaCorteIntegrado',
  'tecnologia',
  'tipoFilm',
  'tipoLaser',
  'tipoMesa',
  'vacioSujecion',
  'velocidadAvance',
  'velocidadCorte',
  'velocidadDesplazamiento',
  'velocidadGrabado',
  'volumenX',
  'volumenY',
  'volumenZ',
  'zonasVacio',
  'anguloConicidadMaxima',
  'anchoImprimibleMaximo',
  'altoImprimibleMaximo',
  'altoBocaMm',
  'anchoBoca',
  'anchoRolloMm',
  'soportaDobleRollo',
  'velocidadMmSeg',
  'velocidadDobleRolloMmSeg',
  'mermaArranqueMm',
  'mermaCierreMm',
  'golpesMinNominal',
  'maxEspesorPilaMm',
  'pliegosMinNominal',
  'lineasPorPasadaMax',
  'productivityValue',
  'productivityUnit',
  'setupMin',
  'cleanupMin',
  'feedReloadMin',
  'ripMin',
  'gapEntreHojasMm',
  'modoLaminado',
  'velocidadTrabajoMmSeg',
  'velocidadDobleRolloTrabajoMmSeg',
  'warmupMin',
  'esquinasPorPieza',
  'radio',
  'lineasPerforado',
  'tipoPerforado',
  'laserSameConsumptionAllProfiles',
  'alturaMaxCabezalMm',
  'anchoMaxRolloMm',
  'anchoMesaMm',
  'anchoMinRolloMm',
  'coloresSoportados',
  'geometria',
  'largoMesaMm',
  'margenEntrePliegosMm',
  'margenesDesperdicioMm',
  'margenesNoImprimiblesMm',
  'modosOperacionSoportados',
  'operacionesSoportadas',
  'pasosOrificiosSoportados',
  'potenciaHusilloKw',
  'potenciaWatts',
  'soporteDobleFaz',
  'tiempoPorCorteSeg',
  'tieneAspiracionViruta',
  'tiposAnilloSoportados',
  'velocidadMaxRPM',
]);

const ALLOWED_CONSUMABLE_DETAIL_KEYS = new Set([
  'dependePerfilOperativo',
  'color',
  'canal',
]);
const ALLOWED_WEAR_DETAIL_KEYS = new Set<string>();

function isValidTechnicalValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isValidTechnicalValue(item));
  }

  if (typeof value === 'object') {
    return Object.values(value).every((item) => isValidTechnicalValue(item));
  }

  return false;
}

@Injectable()
export class MaquinariaService {
  private static readonly CODIGO_PREFIX = 'MAQ';
  private static readonly CODIGO_MAX_RETRIES = 5;
  private static readonly COMBINED_PRODUCTIVITY_UNITS =
    new Set<UnidadProduccionMaquinaDto>([
      UnidadProduccionMaquinaDto.ppm,
      UnidadProduccionMaquinaDto.m2_h,
      UnidadProduccionMaquinaDto.piezas_h,
      UnidadProduccionMaquinaDto.cortes_min,
      UnidadProduccionMaquinaDto.golpes_min,
      UnidadProduccionMaquinaDto.pliegos_min,
      UnidadProduccionMaquinaDto.m_min,
      UnidadProduccionMaquinaDto.mm_s,
    ]);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(auth: CurrentAuth, pagination: PaginationDto) {
    const where = { tenantId: auth.tenantId };

    const [maquinas, total] = await this.prisma.$transaction([
      this.prisma.maquina.findMany({
        where,
        include: {
          planta: true,
          centroCostoPrincipal: true,
          perfilesOperativos: true,
          consumibles: {
            include: {
              perfilOperativo: true,
              materiaPrimaVariante: {
                include: {
                  materiaPrima: true,
                },
              },
            },
          },
          componentesDesgaste: {
            include: {
              materiaPrimaVariante: {
                include: {
                  materiaPrima: true,
                },
              },
            },
          },
        },
        orderBy: [{ nombre: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.maquina.count({ where }),
    ]);

    return paginatedResponse(
      maquinas.map((maquina) => this.toMaquinaResponse(maquina)),
      total,
      pagination,
    );
  }

  async findOne(auth: CurrentAuth, id: string) {
    const maquina = await this.findMaquinaOrThrow(auth, id);
    return this.toMaquinaResponse(maquina);
  }

  async create(auth: CurrentAuth, payload: UpsertMaquinaDto) {
    await this.validateReferences(auth, payload);

    for (
      let attempt = 0;
      attempt < MaquinariaService.CODIGO_MAX_RETRIES;
      attempt += 1
    ) {
      const generatedCodigo = this.generateCodigoMaquina();

      try {
        const maquina = await this.prisma.$transaction(async (tx) => {
          const created = await tx.maquina.create({
            data: this.buildMaquinaWriteData(auth, payload, generatedCodigo),
          });

          await this.replaceNestedData(tx, auth.tenantId, created.id, payload);

          return tx.maquina.findUniqueOrThrow({
            where: { id: created.id },
            include: {
              planta: true,
              centroCostoPrincipal: true,
              perfilesOperativos: true,
              consumibles: {
                include: {
                  perfilOperativo: true,
                  materiaPrimaVariante: {
                    include: {
                      materiaPrima: true,
                    },
                  },
                },
              },
              componentesDesgaste: {
                include: {
                  materiaPrimaVariante: {
                    include: {
                      materiaPrima: true,
                    },
                  },
                },
              },
            },
          });
        });

        return this.toMaquinaResponse(maquina);
      } catch (error) {
        if (this.isCodigoConflictError(error)) {
          continue;
        }

        this.handleWriteError(error);
      }
    }

    throw new ConflictException(
      'No se pudo generar un codigo unico para la maquina.',
    );
  }

  async update(auth: CurrentAuth, id: string, payload: UpsertMaquinaDto) {
    const existing = await this.findMaquinaOrThrow(auth, id);
    await this.validateReferences(auth, payload);

    try {
      const maquina = await this.prisma.$transaction(async (tx) => {
        await tx.maquina.update({
          where: { id },
          data: this.buildMaquinaWriteData(auth, payload, existing.codigo),
        });

        await this.replaceNestedData(tx, auth.tenantId, id, payload);

        return tx.maquina.findUniqueOrThrow({
          where: { id },
          include: {
            planta: true,
            centroCostoPrincipal: true,
            perfilesOperativos: true,
            consumibles: {
              include: {
                perfilOperativo: true,
                materiaPrimaVariante: {
                  include: {
                    materiaPrima: true,
                  },
                },
              },
            },
            componentesDesgaste: {
              include: {
                materiaPrimaVariante: {
                  include: {
                    materiaPrima: true,
                  },
                },
              },
            },
          },
        });
      });

      return this.toMaquinaResponse(maquina);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async toggle(auth: CurrentAuth, id: string) {
    const maquina = await this.findMaquinaBaseOrThrow(auth, id);

    const updated = await this.prisma.maquina.update({
      where: { id },
      data: {
        activo: !maquina.activo,
      },
      include: {
        planta: true,
        centroCostoPrincipal: true,
        perfilesOperativos: true,
        consumibles: {
          include: {
            perfilOperativo: true,
            materiaPrimaVariante: {
              include: {
                materiaPrima: true,
              },
            },
          },
        },
        componentesDesgaste: {
          include: {
            materiaPrimaVariante: {
              include: {
                materiaPrima: true,
              },
            },
          },
        },
      },
    });

    return this.toMaquinaResponse(updated);
  }

  private async replaceNestedData(
    tx: Prisma.TransactionClient,
    tenantId: string,
    maquinaId: string,
    payload: UpsertMaquinaDto,
  ) {
    const [existingPerfiles, existingConsumibles, existingDesgastes] =
      await Promise.all([
        tx.maquinaPerfilOperativo.findMany({
          where: { tenantId, maquinaId },
          select: { id: true },
        }),
        tx.maquinaConsumible.findMany({
          where: { tenantId, maquinaId },
          select: { id: true },
        }),
        tx.maquinaComponenteDesgaste.findMany({
          where: { tenantId, maquinaId },
          select: { id: true },
        }),
      ]);

    const existingPerfilIds = new Set(existingPerfiles.map((item) => item.id));
    const existingConsumibleIds = new Set(
      existingConsumibles.map((item) => item.id),
    );
    const existingDesgasteIds = new Set(
      existingDesgastes.map((item) => item.id),
    );

    const persistedPerfilIds = new Set<string>();
    const perfilIdMap = new Map<string, string>();

    for (const perfil of payload.perfilesOperativos) {
      if (perfil.id && existingPerfilIds.has(perfil.id)) {
        await tx.maquinaPerfilOperativo.update({
          where: { id: perfil.id },
          data: this.buildPerfilData(tenantId, maquinaId, perfil),
        });
        persistedPerfilIds.add(perfil.id);
        perfilIdMap.set(perfil.id, perfil.id);
        continue;
      }

      const created = await tx.maquinaPerfilOperativo.create({
        data: this.buildPerfilData(tenantId, maquinaId, perfil),
      });
      persistedPerfilIds.add(created.id);
      if (perfil.id) {
        perfilIdMap.set(perfil.id, created.id);
      }
    }

    const consumibleVariantIds = Array.from(
      new Set(payload.consumibles.map((item) => item.materiaPrimaVarianteId)),
    );
    const consumibleVariantes = consumibleVariantIds.length
      ? await tx.materiaPrimaVariante.findMany({
          where: { tenantId, id: { in: consumibleVariantIds } },
          include: { materiaPrima: { select: { nombre: true } } },
        })
      : [];
    const consumibleVarianteById = new Map(
      consumibleVariantes.map((item) => [item.id, item]),
    );

    const persistedConsumibleIds = new Set<string>();
    for (const consumible of payload.consumibles) {
      const perfilOperativoId = consumible.perfilOperativoId
        ? (perfilIdMap.get(consumible.perfilOperativoId) ?? null)
        : null;

      if (consumible.perfilOperativoId && !perfilOperativoId) {
        const consumibleName = this.getConsumibleDisplayName(
          consumible,
          consumibleVarianteById.get(consumible.materiaPrimaVarianteId),
        );
        throw new BadRequestException(
          `El consumible ${consumibleName} referencia un perfil operativo inexistente.`,
        );
      }

      if (consumible.id && existingConsumibleIds.has(consumible.id)) {
        await tx.maquinaConsumible.update({
          where: { id: consumible.id },
          data: this.buildConsumibleData(
            tenantId,
            maquinaId,
            consumible,
            perfilOperativoId ?? undefined,
            payload.plantilla,
            consumibleVarianteById.get(consumible.materiaPrimaVarianteId),
          ),
        });
        persistedConsumibleIds.add(consumible.id);
        continue;
      }

      const created = await tx.maquinaConsumible.create({
        data: this.buildConsumibleData(
          tenantId,
          maquinaId,
          consumible,
          perfilOperativoId ?? undefined,
          payload.plantilla,
          consumibleVarianteById.get(consumible.materiaPrimaVarianteId),
        ),
      });
      persistedConsumibleIds.add(created.id);
    }

    const persistedDesgasteIds = new Set<string>();
    for (const componente of payload.componentesDesgaste) {
      if (componente.id && existingDesgasteIds.has(componente.id)) {
        await tx.maquinaComponenteDesgaste.update({
          where: { id: componente.id },
          data: this.buildComponenteDesgasteData(
            tenantId,
            maquinaId,
            componente,
          ),
        });
        persistedDesgasteIds.add(componente.id);
        continue;
      }

      const created = await tx.maquinaComponenteDesgaste.create({
        data: this.buildComponenteDesgasteData(tenantId, maquinaId, componente),
      });
      persistedDesgasteIds.add(created.id);
    }

    const consumiblesToDelete = existingConsumibles
      .map((item) => item.id)
      .filter((id) => !persistedConsumibleIds.has(id));
    if (consumiblesToDelete.length) {
      await tx.maquinaConsumible.deleteMany({
        where: { tenantId, maquinaId, id: { in: consumiblesToDelete } },
      });
    }

    const desgastesToDelete = existingDesgastes
      .map((item) => item.id)
      .filter((id) => !persistedDesgasteIds.has(id));
    if (desgastesToDelete.length) {
      await tx.maquinaComponenteDesgaste.deleteMany({
        where: { tenantId, maquinaId, id: { in: desgastesToDelete } },
      });
    }

    const perfilesToDelete = existingPerfiles
      .map((item) => item.id)
      .filter((id) => !persistedPerfilIds.has(id));
    if (perfilesToDelete.length) {
      await tx.maquinaPerfilOperativo.deleteMany({
        where: { tenantId, maquinaId, id: { in: perfilesToDelete } },
      });
    }
  }

  private buildMaquinaWriteData(
    auth: CurrentAuth,
    payload: UpsertMaquinaDto,
    forcedCodigo?: string,
  ) {
    const estadoConfiguracion =
      this.resolvePersistedEstadoConfiguracion(payload);
    const parametrosTecnicos = this.withDerivedTemplateParams(payload);
    const dimensionesDerivadas = this.getDerivedMachineDimensions(
      payload,
      parametrosTecnicos,
    );

    return {
      tenantId: auth.tenantId,
      codigo: (forcedCodigo ?? payload.codigo ?? '').trim().toUpperCase(),
      nombre: payload.nombre.trim(),
      plantilla: this.toPrismaEnum<PlantillaMaquinaria>(payload.plantilla),
      plantillaVersion: payload.plantillaVersion ?? 1,
      fabricante: payload.fabricante?.trim() || null,
      modelo: payload.modelo?.trim() || null,
      numeroSerie: payload.numeroSerie?.trim() || null,
      plantaId: payload.plantaId,
      centroCostoPrincipalId: payload.centroCostoPrincipalId ?? null,
      estado: this.toPrismaEnum<EstadoMaquina>(payload.estado),
      estadoConfiguracion:
        this.toPrismaEnum<EstadoConfiguracionMaquina>(estadoConfiguracion),
      geometriaTrabajo: this.toPrismaEnum<GeometriaTrabajoMaquina>(
        payload.geometriaTrabajo,
      ),
      unidadProduccionPrincipal: this.toPrismaEnum<UnidadProduccionMaquina>(
        payload.unidadProduccionPrincipal,
      ),
      anchoUtil: this.toDecimal(dimensionesDerivadas.anchoUtil),
      largoUtil: this.toDecimal(dimensionesDerivadas.largoUtil),
      altoUtil: this.toDecimal(payload.altoUtil),
      espesorMaximo: this.toDecimal(payload.espesorMaximo),
      pesoMaximo: this.toDecimal(payload.pesoMaximo),
      gramajeMaxGr: this.toDecimal(payload.gramajeMaxGr),
      fechaAlta: payload.fechaAlta ? new Date(payload.fechaAlta) : null,
      activo: payload.activo,
      observaciones: payload.observaciones?.trim() || null,
      parametrosTecnicosJson: this.toNullableJson(parametrosTecnicos),
      capacidadesAvanzadasJson: this.toNullableJson(
        payload.capacidadesAvanzadas,
      ),
    };
  }

  private buildPerfilData(
    tenantId: string,
    maquinaId: string,
    payload: MaquinaPerfilOperativoItemDto,
  ) {
    // v3.0 (2026-04-26): solo columnas universales del modelo doc §5–§13.
    // Los discriminantes específicos (caras, colores, formato, gramaje, etc.)
    // viven en `detalleJson`. Si el payload trae estos campos como flat keys
    // los mergeamos al detalle para preservar compat de DTO.
    const detalle: Record<string, unknown> = {
      ...(payload.detalle ?? {}),
    };
    return {
      tenantId,
      maquinaId,
      nombre: payload.nombre.trim(),
      tipoPerfil: this.toPrismaEnum<TipoPerfilOperativoMaquina>(
        payload.tipoPerfil,
      ),
      activo: payload.activo,
      productivityValue: this.toDecimal(payload.productivityValue),
      productivityUnit: payload.productivityUnit
        ? this.toPrismaEnum<UnidadProduccionMaquina>(payload.productivityUnit)
        : null,
      setupMin: this.toDecimal(payload.setupMin),
      cleanupMin: this.toDecimal(payload.cleanupMin),
      feedReloadMin: this.toDecimal(payload.feedReloadMin),
      detalleJson:
        Object.keys(detalle).length > 0 ? (detalle as never) : Prisma.JsonNull,
      reglaSeleccionJson: payload.reglaSeleccionJson
        ? (payload.reglaSeleccionJson as never)
        : Prisma.JsonNull,
    };
  }

  private buildConsumibleData(
    tenantId: string,
    maquinaId: string,
    payload: MaquinaConsumibleItemDto,
    perfilOperativoId?: string,
    plantilla?: PlantillaMaquinariaDto,
    variante?: {
      sku: string;
      nombreVariante: string | null;
      materiaPrima: { nombre: string };
    },
  ) {
    const channel = getConsumableChannelFromDetail(payload.detalle ?? {});
    const tipo =
      payload.tipo ??
      consumableTypeForChannel(plantilla ?? '', channel ?? 'negro');
    const unidad = payload.unidad ?? consumableUnitForTemplate(plantilla ?? '');

    return {
      tenantId,
      maquinaId,
      perfilOperativoId: perfilOperativoId ?? null,
      materiaPrimaVarianteId: payload.materiaPrimaVarianteId,
      nombre: this.getConsumibleDisplayName(payload, variante),
      tipo: this.toPrismaEnum<TipoConsumibleMaquina>(tipo),
      unidad: this.toPrismaEnum<UnidadConsumoMaquina>(unidad),
      rendimientoEstimado: this.toDecimal(payload.rendimientoEstimado),
      consumoBase: this.toDecimal(payload.consumoBase),
      activo: payload.activo,
      detalleJson: this.toNullableJson(payload.detalle),
      observaciones: payload.observaciones?.trim() || null,
    };
  }

  private getConsumibleDisplayName(
    payload: Pick<
      MaquinaConsumibleItemDto,
      'nombre' | 'detalle' | 'materiaPrimaVarianteId'
    >,
    variante?: {
      sku: string;
      nombreVariante: string | null;
      materiaPrima: { nombre: string };
    },
  ) {
    const explicitName = payload.nombre?.trim();
    if (explicitName) return explicitName;

    const channel = getConsumableChannelFromDetail(payload.detalle ?? {});
    const materialName = variante
      ? `${variante.materiaPrima.nombre} · ${variante.nombreVariante ?? variante.sku}`
      : payload.materiaPrimaVarianteId;

    return channel ? `${channel} · ${materialName}` : materialName;
  }

  private buildComponenteDesgasteData(
    tenantId: string,
    maquinaId: string,
    payload: MaquinaComponenteDesgasteItemDto,
  ) {
    return {
      tenantId,
      maquinaId,
      materiaPrimaVarianteId: payload.materiaPrimaVarianteId,
      nombre: payload.nombre.trim(),
      tipo: this.toPrismaEnum<TipoComponenteDesgasteMaquina>(payload.tipo),
      vidaUtilEstimada: this.toDecimal(payload.vidaUtilEstimada),
      unidadDesgaste: this.toPrismaEnum<UnidadDesgasteMaquina>(
        payload.unidadDesgaste,
      ),
      modoProrrateo: payload.modoProrrateo?.trim() || null,
      activo: payload.activo,
      detalleJson: this.toNullableJson(payload.detalle),
      observaciones: payload.observaciones?.trim() || null,
    };
  }

  private getDerivedEstadoConfiguracion(
    payload: UpsertMaquinaDto,
  ): EstadoConfiguracionMaquinaDto {
    if (!this.hasMinimumBaseData(payload)) {
      return EstadoConfiguracionMaquinaDto.borrador;
    }

    if (!this.hasCoreCostingData(payload)) {
      return EstadoConfiguracionMaquinaDto.incompleta;
    }

    if (!this.hasTemplateSpecificData(payload)) {
      return EstadoConfiguracionMaquinaDto.incompleta;
    }

    return EstadoConfiguracionMaquinaDto.lista;
  }

  private resolvePersistedEstadoConfiguracion(
    payload: UpsertMaquinaDto,
  ): EstadoConfiguracionMaquinaDto {
    if (
      payload.estadoConfiguracion === EstadoConfiguracionMaquinaDto.borrador
    ) {
      return EstadoConfiguracionMaquinaDto.borrador;
    }
    return this.getDerivedEstadoConfiguracion(payload);
  }

  private hasMinimumBaseData(payload: UpsertMaquinaDto) {
    return Boolean(
      payload.nombre?.trim() &&
      payload.plantaId &&
      payload.plantilla &&
      payload.estado &&
      payload.unidadProduccionPrincipal,
    );
  }

  private hasCoreCostingData(payload: UpsertMaquinaDto) {
    const hasPerfilValido = payload.perfilesOperativos.some((perfil) => {
      if (!perfil.nombre?.trim()) {
        return false;
      }
      // v3.0 (doc §7): GUILLOTINA usa fórmula no lineal — productividad NULL
      // y `pliegosMaxPorTanda` (ahora en detalleJson) es el dato crítico.
      if (payload.plantilla === PlantillaMaquinariaDto.guillotina) {
        const detalle = perfil.detalle ?? {};
        const pliegosMax = Number(detalle.pliegosMaxPorTanda ?? 0);
        return Number.isFinite(pliegosMax) && pliegosMax > 0;
      }
      return (
        perfil.productivityValue !== undefined &&
        Boolean(perfil.productivityUnit)
      );
    });
    const requireConsumibles = PRINTER_TEMPLATES_WITH_MACHINE_CONSUMABLES.has(
      payload.plantilla,
    );
    const hasConsumibleValido = this.hasRequiredPrinterConsumibles(payload);
    // Gran formato por área no registra piezas de desgaste (decisión
    // 2026-07-28): la plantilla ya no trae la sección y exigirlas dejaría
    // a esas máquinas "incompletas" para siempre.
    // Las plantillas que ya no tienen la sección de desgaste no pueden
    // exigirlo: quedarían "incompletas" sin dónde cargarlo (2026-07-28).
    const SIN_DESGASTE = new Set<PlantillaMaquinariaDto>([
      PlantillaMaquinariaDto.impresora_gran_formato_por_area,
      PlantillaMaquinariaDto.guillotina,
    ]);
    const requireDesgaste = !SIN_DESGASTE.has(payload.plantilla);
    const hasDesgasteValido = payload.componentesDesgaste.some(
      (componente) =>
        Boolean(componente.nombre?.trim()) &&
        Boolean(componente.tipo) &&
        Boolean(componente.unidadDesgaste) &&
        componente.vidaUtilEstimada !== undefined,
    );

    return (
      hasPerfilValido &&
      (!requireConsumibles || hasConsumibleValido) &&
      (!requireDesgaste || hasDesgasteValido)
    );
  }

  private hasTemplateSpecificData(payload: UpsertMaquinaDto) {
    if (!hasRequiredMachineDataByTemplate(payload)) {
      return false;
    }

    if (
      PRINTER_TEMPLATES_WITH_MACHINE_CONSUMABLES.has(payload.plantilla) &&
      !this.hasRequiredPrinterConsumibles(payload)
    ) {
      return false;
    }

    return true;
  }

  private hasRequiredPrinterConsumibles(payload: UpsertMaquinaDto) {
    if (!PRINTER_TEMPLATES_WITH_MACHINE_CONSUMABLES.has(payload.plantilla)) {
      return true;
    }

    const consumiblesActivos = payload.consumibles.filter(
      (item) => item.activo,
    );
    if (consumiblesActivos.length === 0) return false;

    if (payload.plantilla === PlantillaMaquinariaDto.impresora_laser) {
      const channelsFromMachine = requiredConsumableChannelsFromColorMode(
        payload.parametrosTecnicos?.coloresSoportados ??
          payload.parametrosTecnicos?.configuracionColor ??
          payload.parametrosTecnicos?.configuracionCanales,
      );
      const channels =
        channelsFromMachine.length > 0
          ? channelsFromMachine
          : Array.from(
              new Set(
                payload.perfilesOperativos
                  .filter((item) => item.activo)
                  .flatMap((perfil) =>
                    getPerfilConsumableChannels(
                      perfil.detalle ?? {},
                      payload.parametrosTecnicos ?? {},
                    ),
                  ),
              ),
            );

      if (channels.length === 0) return false;
      return channels.every((channel) =>
        consumiblesActivos.some((consumible) => {
          const detalle = consumible.detalle ?? {};
          const channelMatches =
            getConsumableChannelFromDetail(detalle) === channel;
          const hasConsumableData =
            Boolean(consumible.materiaPrimaVarianteId) &&
            Number(consumible.consumoBase ?? 0) > 0;
          return channelMatches && hasConsumableData;
        }),
      );
    }

    for (const perfil of payload.perfilesOperativos.filter(
      (item) => item.activo,
    )) {
      if (!perfil.id) return false;
      const channels = getPerfilConsumableChannels(
        perfil.detalle ?? {},
        payload.parametrosTecnicos ?? {},
      );
      if (channels.length === 0) return false;

      for (const channel of channels) {
        const match = consumiblesActivos.find((consumible) => {
          const detalle = consumible.detalle ?? {};
          return (
            consumible.perfilOperativoId === perfil.id &&
            getConsumableChannelFromDetail(detalle) === channel &&
            Boolean(consumible.materiaPrimaVarianteId) &&
            Number(consumible.consumoBase ?? 0) > 0
          );
        });
        if (!match) return false;
      }
    }

    return true;
  }

  private async validateReferences(
    auth: CurrentAuth,
    payload: UpsertMaquinaDto,
  ) {
    const isDraft =
      this.resolvePersistedEstadoConfiguracion(payload) ===
      EstadoConfiguracionMaquinaDto.borrador;
    const templateRule = TEMPLATE_CATALOG_RULES[payload.plantilla];
    if (!templateRule) {
      throw new BadRequestException(
        `La plantilla ${payload.plantilla} no existe en el catalogo del sistema.`,
      );
    }

    const allowedGeometries = templateRule.allowedGeometries ?? [
      templateRule.geometry,
    ];
    if (!allowedGeometries.includes(payload.geometriaTrabajo)) {
      throw new BadRequestException(
        `La geometria ${payload.geometriaTrabajo} no coincide con la plantilla ${payload.plantilla}. Debe ser una de: ${allowedGeometries.join(', ')}.`,
      );
    }
    this.validateGeometryDiscriminator(payload);

    const allowedProductionUnits = templateRule.allowedProductionUnits ?? [
      templateRule.defaultProductionUnit,
    ];

    if (!allowedProductionUnits.includes(payload.unidadProduccionPrincipal)) {
      throw new BadRequestException(
        `La unidad ${payload.unidadProduccionPrincipal} no coincide con la plantilla ${payload.plantilla}. Debe ser una de: ${allowedProductionUnits.join(', ')}.`,
      );
    }

    this.validateTechnicalPayload(payload);
    if (!isDraft) {
      try {
        validateMachinePayloadByTemplate(payload);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error
            ? error.message
            : `Maquina invalida para la plantilla ${payload.plantilla}.`,
        );
      }
    }

    const planta = await this.prisma.planta.findFirst({
      where: {
        id: payload.plantaId,
        tenantId: auth.tenantId,
      },
      select: { id: true },
    });

    if (!planta) {
      throw new BadRequestException('La planta seleccionada no existe.');
    }

    if (payload.centroCostoPrincipalId) {
      const centro = await this.prisma.centroCosto.findFirst({
        where: {
          id: payload.centroCostoPrincipalId,
          tenantId: auth.tenantId,
        },
        select: {
          id: true,
          plantaId: true,
        },
      });

      if (!centro) {
        throw new BadRequestException(
          'El centro de costo principal no existe.',
        );
      }

      if (centro.plantaId !== payload.plantaId) {
        throw new BadRequestException(
          'La maquina y el centro de costo principal deben pertenecer a la misma planta.',
        );
      }
    }

    const normalizedPerfilNames = new Set<string>();
    const payloadPerfilIds = new Set<string>();
    for (const perfil of payload.perfilesOperativos) {
      const key = perfil.nombre.trim().toLowerCase();
      if (normalizedPerfilNames.has(key)) {
        throw new BadRequestException(
          `El perfil operativo ${perfil.nombre.trim()} esta duplicado.`,
        );
      }
      if (perfil.id) {
        if (payloadPerfilIds.has(perfil.id)) {
          throw new BadRequestException(
            `El perfil operativo ${perfil.nombre.trim()} tiene un id duplicado.`,
          );
        }
        payloadPerfilIds.add(perfil.id);
      }

      try {
        validatePerfilOperativoByTemplate(payload.plantilla, perfil, {
          ...(payload.parametrosTecnicos ?? {}),
          gramajeMaxGr: payload.gramajeMaxGr,
        });
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error
            ? error.message
            : `Perfil operativo invalido para la plantilla ${payload.plantilla}.`,
        );
      }

      normalizedPerfilNames.add(key);
    }

    const varianteIds = Array.from(
      new Set([
        ...payload.consumibles.map((item) => item.materiaPrimaVarianteId),
        ...payload.componentesDesgaste.map(
          (item) => item.materiaPrimaVarianteId,
        ),
      ]),
    );

    const variantesMateriaPrima =
      await this.prisma.materiaPrimaVariante.findMany({
        where: {
          tenantId: auth.tenantId,
          id: { in: varianteIds },
        },
        include: {
          materiaPrima: {
            select: {
              id: true,
              nombre: true,
              activo: true,
              esConsumible: true,
              esRepuesto: true,
            },
          },
        },
      });
    const varianteById = new Map(
      variantesMateriaPrima.map((variante) => [variante.id, variante]),
    );

    for (const consumible of payload.consumibles) {
      const variante = varianteById.get(consumible.materiaPrimaVarianteId);
      const consumibleName = this.getConsumibleDisplayName(
        consumible,
        variante
          ? {
              sku: variante.sku,
              nombreVariante: variante.nombreVariante,
              materiaPrima: { nombre: variante.materiaPrima.nombre },
            }
          : undefined,
      );
      if (!variante) {
        throw new BadRequestException(
          `El consumible ${consumibleName} referencia una variante de materia prima inexistente.`,
        );
      }
      if (!variante.activo || !variante.materiaPrima.activo) {
        throw new BadRequestException(
          `El consumible ${consumibleName} referencia una variante/materia prima inactiva.`,
        );
      }
      if (!variante.materiaPrima.esConsumible) {
        throw new BadRequestException(
          `La materia prima ${variante.materiaPrima.nombre} no esta habilitada como consumible.`,
        );
      }
      if (
        consumible.perfilOperativoId &&
        !payloadPerfilIds.has(consumible.perfilOperativoId)
      ) {
        throw new BadRequestException(
          `El consumible ${consumibleName} referencia un perfil operativo inexistente en la carga actual.`,
        );
      }
      for (const detailKey of Object.keys(consumible.detalle ?? {})) {
        if (!ALLOWED_CONSUMABLE_DETAIL_KEYS.has(detailKey)) {
          throw new BadRequestException(
            `El consumible ${consumibleName} incluye el campo ${detailKey}, que no corresponde a la plantilla ${payload.plantilla}.`,
          );
        }
      }
      const detalle = consumible.detalle ?? {};
      const channel = getConsumableChannelFromDetail(detalle);
      if (
        PRINTER_TEMPLATES_WITH_MACHINE_CONSUMABLES.has(payload.plantilla) &&
        !channel
      ) {
        throw new BadRequestException(
          `El consumible ${consumibleName} debe indicar un canal/color valido en detalle.color.`,
        );
      }
      if (channel && !isConsumableChannel(channel)) {
        throw new BadRequestException(
          `El consumible ${consumibleName} usa un canal/color no soportado.`,
        );
      }
    }

    const consumibleKeys = new Set<string>();
    for (const consumible of payload.consumibles.filter(
      (item) => item.activo,
    )) {
      const channel = getConsumableChannelFromDetail(consumible.detalle ?? {});
      if (!channel) continue;
      const key = `${consumible.perfilOperativoId ?? 'maquina'}::${channel}`;
      if (consumibleKeys.has(key)) {
        throw new BadRequestException(
          `Hay consumibles duplicados para el canal ${channel}. Deja una sola variante activa por perfil/canal.`,
        );
      }
      consumibleKeys.add(key);
    }

    for (const componente of payload.componentesDesgaste) {
      const componenteName = componente.nombre.trim() || 'sin nombre';
      const variante = varianteById.get(componente.materiaPrimaVarianteId);
      if (!variante) {
        throw new BadRequestException(
          `El componente ${componenteName} referencia una variante de materia prima inexistente.`,
        );
      }
      if (!variante.activo || !variante.materiaPrima.activo) {
        throw new BadRequestException(
          `El componente ${componenteName} referencia una variante/materia prima inactiva.`,
        );
      }
      if (!variante.materiaPrima.esRepuesto) {
        throw new BadRequestException(
          `La materia prima ${variante.materiaPrima.nombre} no esta habilitada como repuesto.`,
        );
      }
      const atributosVariante =
        (variante.atributosVarianteJson as Record<string, unknown> | null) ??
        null;
      const tipoComponenteVariante = this.normalizeString(
        atributosVariante?.tipoComponenteDesgaste,
      );
      const tipoComponenteSeleccionado = this.normalizeString(componente.tipo);
      if (
        tipoComponenteVariante &&
        tipoComponenteVariante !== tipoComponenteSeleccionado
      ) {
        throw new BadRequestException(
          `El componente ${componenteName} no coincide con el tipo de repuesto configurado en la variante seleccionada.`,
        );
      }

      const plantillasCompatibles = this.normalizeStringList(
        atributosVariante?.plantillasCompatibles ??
          atributosVariante?.plantillaCompatible,
      );
      if (
        plantillasCompatibles.length > 0 &&
        !plantillasCompatibles.includes(this.normalizeString(payload.plantilla))
      ) {
        throw new BadRequestException(
          `El componente ${componenteName} no es compatible con la plantilla ${payload.plantilla}.`,
        );
      }
      for (const detailKey of Object.keys(componente.detalle ?? {})) {
        if (!ALLOWED_WEAR_DETAIL_KEYS.has(detailKey)) {
          throw new BadRequestException(
            `El componente de desgaste ${componenteName} incluye el campo ${detailKey}, que no corresponde a la plantilla ${payload.plantilla}.`,
          );
        }
      }
    }
  }

  private validateGeometryDiscriminator(payload: UpsertMaquinaDto) {
    if (
      payload.plantilla !==
      PlantillaMaquinariaDto.impresora_gran_formato_por_area
    ) {
      return;
    }

    return;
  }

  private validateTechnicalPayload(payload: UpsertMaquinaDto) {
    if (!payload.parametrosTecnicos) {
      return;
    }

    for (const [key, value] of Object.entries(payload.parametrosTecnicos)) {
      if (!TEMPLATE_ALLOWED_TECHNICAL_KEYS.has(key)) {
        throw new BadRequestException(
          `El parametro tecnico ${key} no corresponde al catalogo de plantillas.`,
        );
      }

      if (!isValidTechnicalValue(value)) {
        throw new BadRequestException(
          `El parametro tecnico ${key} contiene un formato invalido.`,
        );
      }
    }
  }

  private async findMaquinaOrThrow(auth: CurrentAuth, id: string) {
    const maquina = await this.prisma.maquina.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      include: {
        planta: true,
        centroCostoPrincipal: true,
        perfilesOperativos: true,
        consumibles: {
          include: {
            perfilOperativo: true,
            materiaPrimaVariante: {
              include: {
                materiaPrima: true,
              },
            },
          },
        },
        componentesDesgaste: {
          include: {
            materiaPrimaVariante: {
              include: {
                materiaPrima: true,
              },
            },
          },
        },
      },
    });

    if (!maquina) {
      throw new NotFoundException('La maquina no existe.');
    }

    return maquina;
  }

  private async findMaquinaBaseOrThrow(auth: CurrentAuth, id: string) {
    const maquina = await this.prisma.maquina.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
    });

    if (!maquina) {
      throw new NotFoundException('La maquina no existe.');
    }

    return maquina;
  }

  private toMaquinaResponse(maquina: MaquinaCompleta) {
    const parametrosTecnicos =
      (maquina.parametrosTecnicosJson as Record<string, unknown> | null) ??
      null;
    const anchoImprimibleMaximo =
      this.toNumeric(parametrosTecnicos?.anchoImprimibleMaximo) ??
      this.toNumber(maquina.anchoUtil);

    return {
      id: maquina.id,
      codigo: maquina.codigo,
      nombre: maquina.nombre,
      plantilla: this.toApiEnum(maquina.plantilla) as PlantillaMaquinariaDto,
      plantillaVersion: maquina.plantillaVersion,
      fabricante: maquina.fabricante ?? '',
      modelo: maquina.modelo ?? '',
      numeroSerie: maquina.numeroSerie ?? '',
      plantaId: maquina.plantaId,
      plantaNombre: maquina.planta.nombre,
      centroCostoPrincipalId: maquina.centroCostoPrincipalId ?? '',
      centroCostoPrincipalNombre: maquina.centroCostoPrincipal?.nombre ?? '',
      estado: this.toApiEnum(maquina.estado) as EstadoMaquinaDto,
      estadoConfiguracion: this.toApiEnum(
        maquina.estadoConfiguracion,
      ) as EstadoConfiguracionMaquinaDto,
      geometriaTrabajo: this.toApiEnum(
        maquina.geometriaTrabajo,
      ) as GeometriaTrabajoMaquinaDto,
      unidadProduccionPrincipal: this.toApiEnum(
        maquina.unidadProduccionPrincipal,
      ) as UnidadProduccionMaquinaDto,
      anchoUtil: anchoImprimibleMaximo,
      largoUtil: this.toNumber(maquina.largoUtil),
      altoUtil: this.toNumber(maquina.altoUtil),
      espesorMaximo: this.toNumber(maquina.espesorMaximo),
      pesoMaximo: this.toNumber(maquina.pesoMaximo),
      gramajeMaxGr: this.toNumber(maquina.gramajeMaxGr),
      fechaAlta: maquina.fechaAlta?.toISOString().slice(0, 10) ?? '',
      activo: maquina.activo,
      observaciones: maquina.observaciones ?? '',
      parametrosTecnicos,
      capacidadesAvanzadas:
        (maquina.capacidadesAvanzadasJson as Record<string, unknown> | null) ??
        null,
      perfilesOperativos: maquina.perfilesOperativos.map((perfil) => ({
        id: perfil.id,
        nombre: perfil.nombre,
        tipoPerfil: this.toApiEnum(
          perfil.tipoPerfil,
        ) as TipoPerfilOperativoMaquinaDto,
        activo: perfil.activo,
        productivityValue: this.toNumber(perfil.productivityValue),
        productivityUnit: perfil.productivityUnit
          ? (this.toApiEnum(
              perfil.productivityUnit,
            ) as UnidadProduccionMaquinaDto)
          : '',
        setupMin: this.toNumber(perfil.setupMin),
        cleanupMin: this.toNumber(perfil.cleanupMin),
        feedReloadMin: this.toNumber(perfil.feedReloadMin),
        setupEstimadoMin: this.computeSetupEstimadoPerfil(perfil),
        detalle: (perfil.detalleJson as Record<string, unknown> | null) ?? null,
        reglaSeleccionJson:
          (perfil.reglaSeleccionJson as Record<string, unknown> | null) ?? null,
      })),
      consumibles: maquina.consumibles.map((consumible) => ({
        id: consumible.id,
        materiaPrimaVarianteId: consumible.materiaPrimaVarianteId,
        materiaPrimaVarianteSku: consumible.materiaPrimaVariante.sku,
        materiaPrimaVarianteNombre:
          consumible.materiaPrimaVariante.nombreVariante ?? '',
        materiaPrimaNombre: consumible.materiaPrimaVariante.materiaPrima.nombre,
        materiaPrimaPrecioReferencia: this.toNumber(
          consumible.materiaPrimaVariante.precioReferencia,
        ),
        nombre: consumible.nombre,
        tipo: this.toApiEnum(consumible.tipo) as TipoConsumibleMaquinaDto,
        unidad: this.toApiEnum(consumible.unidad) as UnidadConsumoMaquinaDto,
        rendimientoEstimado: this.toNumber(consumible.rendimientoEstimado),
        consumoBase: this.toNumber(consumible.consumoBase),
        perfilOperativoId: consumible.perfilOperativoId ?? null,
        perfilOperativoNombre: consumible.perfilOperativo?.nombre ?? '',
        activo: consumible.activo,
        detalle:
          (consumible.detalleJson as Record<string, unknown> | null) ?? null,
        observaciones: consumible.observaciones ?? '',
      })),
      componentesDesgaste: maquina.componentesDesgaste.map((componente) => ({
        id: componente.id,
        materiaPrimaVarianteId: componente.materiaPrimaVarianteId,
        materiaPrimaVarianteSku: componente.materiaPrimaVariante.sku,
        materiaPrimaVarianteNombre:
          componente.materiaPrimaVariante.nombreVariante ?? '',
        materiaPrimaNombre: componente.materiaPrimaVariante.materiaPrima.nombre,
        materiaPrimaPrecioReferencia: this.toNumber(
          componente.materiaPrimaVariante.precioReferencia,
        ),
        nombre: componente.nombre,
        tipo: this.toApiEnum(
          componente.tipo,
        ) as TipoComponenteDesgasteMaquinaDto,
        vidaUtilEstimada: this.toNumber(componente.vidaUtilEstimada),
        unidadDesgaste: this.toApiEnum(
          componente.unidadDesgaste,
        ) as UnidadDesgasteMaquinaDto,
        modoProrrateo: componente.modoProrrateo ?? '',
        activo: componente.activo,
        detalle:
          (componente.detalleJson as Record<string, unknown> | null) ?? null,
        observaciones: componente.observaciones ?? '',
      })),
      createdAt: maquina.createdAt.toISOString(),
      updatedAt: maquina.updatedAt.toISOString(),
    };
  }

  private handleWriteError(error: unknown): never {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Ya existe una maquina con ese codigo.');
    }

    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2000'
    ) {
      throw new BadRequestException(
        'Al menos un valor cargado supera el formato permitido.',
      );
    }

    if (
      error instanceof PrismaClientKnownRequestError &&
      (error.code === 'P2005' ||
        error.code === 'P2006' ||
        error.code === 'P2009')
    ) {
      throw new BadRequestException(
        'Hay datos invalidos en la carga. Revisa campos numericos y opciones seleccionadas.',
      );
    }

    if (error instanceof PrismaClientUnknownRequestError) {
      throw new BadRequestException(
        'Hay un dato incompatible con la base. Revisa unidades, tipos y campos numericos.',
      );
    }

    throw error;
  }

  private isCodigoConflictError(error: unknown) {
    return (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      error.meta?.target.includes('tenantId') &&
      error.meta?.target.includes('codigo')
    );
  }

  private generateCodigoMaquina() {
    const randomChunk = randomUUID()
      .replace(/-/g, '')
      .slice(0, 8)
      .toUpperCase();
    return `${MaquinariaService.CODIGO_PREFIX}-${randomChunk}`;
  }

  private toDecimal(value?: number | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    return new Prisma.Decimal(numeric);
  }

  private toNumber(value?: Prisma.Decimal | null) {
    return value === null || value === undefined ? null : Number(value);
  }

  private parseFiniteNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    }

    return null;
  }

  private computeSetupEstimadoPerfil(perfil: {
    setupMin: Prisma.Decimal | null;
    cleanupMin: Prisma.Decimal | null;
    detalleJson: Prisma.JsonValue | null;
  }) {
    const detalle =
      perfil.detalleJson &&
      typeof perfil.detalleJson === 'object' &&
      !Array.isArray(perfil.detalleJson)
        ? (perfil.detalleJson as Record<string, unknown>)
        : {};

    const partes = [
      this.toNumber(perfil.setupMin),
      this.toNumber(perfil.cleanupMin),
      ...this.collectExtraSetupMin(detalle),
    ].filter((value): value is number => value !== null && value > 0);

    if (!partes.length) {
      return null;
    }

    return Number(partes.reduce((acc, item) => acc + item, 0).toFixed(2));
  }

  private collectExtraSetupMin(detalle: Record<string, unknown>) {
    const extras: number[] = [];
    const parseNumber = (value: unknown) => this.parseFiniteNumber(value);

    const objectCandidates = [
      detalle.setupComponentesMin,
      detalle.setupExtraComponentesMin,
      detalle.tiemposSetupExtraMin,
    ];
    for (const candidate of objectCandidates) {
      if (
        !candidate ||
        typeof candidate !== 'object' ||
        Array.isArray(candidate)
      ) {
        continue;
      }
      for (const value of Object.values(candidate as Record<string, unknown>)) {
        const parsed = parseNumber(value);
        if (parsed !== null && parsed > 0) {
          extras.push(parsed);
        }
      }
    }

    const arrayCandidates = [
      detalle.setupExtrasMin,
      detalle.tiemposExtraSetupMin,
    ];
    for (const candidate of arrayCandidates) {
      if (!Array.isArray(candidate)) {
        continue;
      }
      for (const value of candidate) {
        const parsed = parseNumber(value);
        if (parsed !== null && parsed > 0) {
          extras.push(parsed);
        }
      }
    }

    return extras;
  }

  private normalizeString(value: unknown) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim().toLowerCase();
  }

  private normalizeStringList(value: unknown) {
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    }
    return [];
  }

  private toNullableJson(value?: Record<string, unknown>) {
    if (!value) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonObject;
  }

  private toPrismaEnum<T extends string>(value: string) {
    return value.toUpperCase() as T;
  }

  private toApiEnum(value: string) {
    return value.toLowerCase();
  }

  private withDerivedTemplateParams(payload: UpsertMaquinaDto) {
    if (!payload.parametrosTecnicos) {
      return undefined;
    }

    const params = { ...(payload.parametrosTecnicos ?? {}) };

    if (!payload.plantilla.startsWith('impresora_')) {
      return params;
    }

    const anchoMaxHoja = this.toNumeric(params.anchoMaxHoja);
    const altoMaxHoja = this.toNumeric(params.altoMaxHoja);
    const margenSuperior = this.toNumeric(params.margenSuperior) ?? 0;
    const margenInferior = this.toNumeric(params.margenInferior) ?? 0;
    const margenIzquierdo = this.toNumeric(params.margenIzquierdo) ?? 0;
    const margenDerecho = this.toNumeric(params.margenDerecho) ?? 0;

    if (anchoMaxHoja === null || altoMaxHoja === null) {
      return params;
    }

    const anchoImprimible = Number(
      (anchoMaxHoja - margenIzquierdo - margenDerecho).toFixed(2),
    );
    const altoImprimible = Number(
      (altoMaxHoja - margenSuperior - margenInferior).toFixed(2),
    );

    if (anchoImprimible <= 0 || altoImprimible <= 0) {
      return params;
    }

    return {
      ...params,
      anchoImprimibleMaximo: anchoImprimible,
      altoImprimibleMaximo: altoImprimible,
      areaImprimibleMaxima: Number(
        ((anchoImprimible * altoImprimible) / 10000).toFixed(2),
      ),
    };
  }

  private toNumeric(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /**
   * v3.0: derivar dimensiones de la máquina desde paramsTecnicos cuando
   * aplica. Solo IMPRESORA_LASER (anchoImprimibleMaximo + altoImprimibleMaximo)
   * y IMPRESORA_GRAN_FORMATO_POR_AREA (anchoMaxRolloMm o anchoMesaMm).
   */
  private getDerivedMachineDimensions(
    payload: UpsertMaquinaDto,
    parametrosTecnicos?: Record<string, unknown>,
  ) {
    if (!parametrosTecnicos) {
      return { anchoUtil: payload.anchoUtil, largoUtil: payload.largoUtil };
    }

    if (
      payload.plantilla ===
      PlantillaMaquinariaDto.impresora_gran_formato_por_area
    ) {
      // El ancho útil viene de anchoMaxRolloMm (geometria=ROLLO) o
      // anchoMesaMm (geometria=MESA_EXTENSORA).
      const ancho =
        this.toNumeric(parametrosTecnicos.anchoMaxRolloMm) ??
        this.toNumeric(parametrosTecnicos.anchoMesaMm);
      const largo = this.toNumeric(parametrosTecnicos.largoMesaMm);
      return {
        anchoUtil: ancho ?? payload.anchoUtil,
        largoUtil: largo ?? payload.largoUtil,
      };
    }

    if (payload.plantilla === PlantillaMaquinariaDto.impresora_laser) {
      const ancho = this.toNumeric(parametrosTecnicos.anchoImprimibleMaximo);
      const largo = this.toNumeric(parametrosTecnicos.altoImprimibleMaximo);
      return {
        anchoUtil: ancho ?? payload.anchoUtil,
        largoUtil: largo ?? payload.largoUtil,
      };
    }

    return { anchoUtil: payload.anchoUtil, largoUtil: payload.largoUtil };
  }
}
