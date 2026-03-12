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
  defaultProductionUnit: UnidadProduccionMaquinaDto;
};

const TEMPLATE_CATALOG_RULES: Record<
  PlantillaMaquinariaDto,
  TemplateCatalogRule
> = {
  router_cnc: {
    geometry: GeometriaTrabajoMaquinaDto.volumen,
    defaultProductionUnit: UnidadProduccionMaquinaDto.hora,
  },
  corte_laser: {
    geometry: GeometriaTrabajoMaquinaDto.plano,
    defaultProductionUnit: UnidadProduccionMaquinaDto.hora,
  },
  impresora_3d: {
    geometry: GeometriaTrabajoMaquinaDto.volumen,
    defaultProductionUnit: UnidadProduccionMaquinaDto.pieza,
  },
  impresora_dtf: {
    geometry: GeometriaTrabajoMaquinaDto.rollo,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2,
  },
  impresora_dtf_uv: {
    geometry: GeometriaTrabajoMaquinaDto.rollo,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2,
  },
  impresora_uv_mesa_extensora: {
    geometry: GeometriaTrabajoMaquinaDto.plano,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2,
  },
  impresora_uv_cilindrica: {
    geometry: GeometriaTrabajoMaquinaDto.cilindrico,
    defaultProductionUnit: UnidadProduccionMaquinaDto.pieza,
  },
  impresora_uv_flatbed: {
    geometry: GeometriaTrabajoMaquinaDto.plano,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2,
  },
  impresora_uv_rollo: {
    geometry: GeometriaTrabajoMaquinaDto.rollo,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2,
  },
  impresora_solvente: {
    geometry: GeometriaTrabajoMaquinaDto.rollo,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2,
  },
  impresora_inyeccion_tinta: {
    geometry: GeometriaTrabajoMaquinaDto.rollo,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2,
  },
  impresora_latex: {
    geometry: GeometriaTrabajoMaquinaDto.rollo,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2,
  },
  impresora_sublimacion_gran_formato: {
    geometry: GeometriaTrabajoMaquinaDto.rollo,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2,
  },
  impresora_laser: {
    geometry: GeometriaTrabajoMaquinaDto.pliego,
    defaultProductionUnit: UnidadProduccionMaquinaDto.copia,
  },
  plotter_cad: {
    geometry: GeometriaTrabajoMaquinaDto.rollo,
    defaultProductionUnit: UnidadProduccionMaquinaDto.metro_lineal,
  },
  mesa_de_corte: {
    geometry: GeometriaTrabajoMaquinaDto.plano,
    defaultProductionUnit: UnidadProduccionMaquinaDto.m2,
  },
  plotter_de_corte: {
    geometry: GeometriaTrabajoMaquinaDto.rollo,
    defaultProductionUnit: UnidadProduccionMaquinaDto.metro_lineal,
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
]);

const ALLOWED_CONSUMABLE_DETAIL_KEYS = new Set(['dependePerfilOperativo']);
const ALLOWED_WEAR_DETAIL_KEYS = new Set<string>();
const PRINTER_TEMPLATES_WITH_INK_CONSUMPTION = new Set<PlantillaMaquinariaDto>([
  PlantillaMaquinariaDto.impresora_dtf,
  PlantillaMaquinariaDto.impresora_dtf_uv,
  PlantillaMaquinariaDto.impresora_uv_mesa_extensora,
  PlantillaMaquinariaDto.impresora_uv_cilindrica,
  PlantillaMaquinariaDto.impresora_uv_flatbed,
  PlantillaMaquinariaDto.impresora_uv_rollo,
  PlantillaMaquinariaDto.impresora_solvente,
  PlantillaMaquinariaDto.impresora_inyeccion_tinta,
  PlantillaMaquinariaDto.impresora_latex,
  PlantillaMaquinariaDto.impresora_sublimacion_gran_formato,
  PlantillaMaquinariaDto.impresora_laser,
]);

@Injectable()
export class MaquinariaService {
  private static readonly CODIGO_PREFIX = 'MAQ';
  private static readonly CODIGO_MAX_RETRIES = 5;
  private static readonly COMBINED_PRODUCTIVITY_UNITS =
    new Set<UnidadProduccionMaquinaDto>([
      UnidadProduccionMaquinaDto.ppm,
      UnidadProduccionMaquinaDto.m2_h,
      UnidadProduccionMaquinaDto.piezas_h,
    ]);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(auth: CurrentAuth) {
    const maquinas = await this.prisma.maquina.findMany({
      where: { tenantId: auth.tenantId },
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
    });

    return maquinas.map((maquina) => this.toMaquinaResponse(maquina));
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
    await this.findMaquinaOrThrow(auth, id);
    await this.validateReferences(auth, payload);
    if (!payload.codigo?.trim()) {
      throw new BadRequestException(
        'El codigo de la maquina es obligatorio para actualizar.',
      );
    }

    try {
      const maquina = await this.prisma.$transaction(async (tx) => {
        await tx.maquina.update({
          where: { id },
          data: this.buildMaquinaWriteData(auth, payload),
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
    await tx.maquinaConsumible.deleteMany({ where: { tenantId, maquinaId } });
    await tx.maquinaComponenteDesgaste.deleteMany({
      where: { tenantId, maquinaId },
    });
    await tx.maquinaPerfilOperativo.deleteMany({
      where: { tenantId, maquinaId },
    });

    const perfiles = await Promise.all(
      payload.perfilesOperativos.map((perfil) =>
        tx.maquinaPerfilOperativo.create({
          data: this.buildPerfilData(tenantId, maquinaId, perfil),
        }),
      ),
    );

    const perfilIdByName = new Map(
      perfiles.map((perfil) => [perfil.nombre, perfil.id]),
    );

    for (const consumible of payload.consumibles) {
      const perfilOperativoId = consumible.perfilOperativoNombre
        ? perfilIdByName.get(consumible.perfilOperativoNombre.trim())
        : undefined;

      if (consumible.perfilOperativoNombre && !perfilOperativoId) {
        throw new BadRequestException(
          `El consumible ${consumible.nombre.trim()} referencia un perfil operativo inexistente.`,
        );
      }

      await tx.maquinaConsumible.create({
        data: this.buildConsumibleData(
          tenantId,
          maquinaId,
          consumible,
          perfilOperativoId,
        ),
      });
    }

    await Promise.all(
      payload.componentesDesgaste.map((componente) =>
        tx.maquinaComponenteDesgaste.create({
          data: this.buildComponenteDesgasteData(
            tenantId,
            maquinaId,
            componente,
          ),
        }),
      ),
    );
  }

  private buildMaquinaWriteData(
    auth: CurrentAuth,
    payload: UpsertMaquinaDto,
    forcedCodigo?: string,
  ) {
    const estadoConfiguracion = this.getDerivedEstadoConfiguracion(payload);
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
    return {
      tenantId,
      maquinaId,
      nombre: payload.nombre.trim(),
      tipoPerfil: this.toPrismaEnum<TipoPerfilOperativoMaquina>(
        payload.tipoPerfil,
      ),
      activo: payload.activo,
      anchoAplicable: this.toDecimal(payload.anchoAplicable),
      altoAplicable: this.toDecimal(payload.altoAplicable),
      modoTrabajo: payload.modoTrabajo?.trim() || null,
      calidad: payload.calidad?.trim() || null,
      productividad: this.toDecimal(payload.productividad),
      unidadProductividad: payload.unidadProductividad
        ? this.toPrismaEnum<UnidadProduccionMaquina>(
            payload.unidadProductividad,
          )
        : null,
      tiempoPreparacionMin: this.toDecimal(payload.tiempoPreparacionMin),
      tiempoCargaMin: this.toDecimal(payload.tiempoCargaMin),
      tiempoDescargaMin: this.toDecimal(payload.tiempoDescargaMin),
      tiempoRipMin: this.toDecimal(payload.tiempoRipMin),
      cantidadPasadas:
        payload.cantidadPasadas !== undefined
          ? Math.round(payload.cantidadPasadas)
          : null,
      dobleFaz: payload.dobleFaz ?? false,
      detalleJson: this.toNullableJson(payload.detalle),
    };
  }

  private buildConsumibleData(
    tenantId: string,
    maquinaId: string,
    payload: MaquinaConsumibleItemDto,
    perfilOperativoId?: string,
  ) {
    return {
      tenantId,
      maquinaId,
      perfilOperativoId: perfilOperativoId ?? null,
      materiaPrimaVarianteId: payload.materiaPrimaVarianteId,
      nombre: payload.nombre.trim(),
      tipo: this.toPrismaEnum<TipoConsumibleMaquina>(payload.tipo),
      unidad: this.toPrismaEnum<UnidadConsumoMaquina>(payload.unidad),
      rendimientoEstimado: this.toDecimal(payload.rendimientoEstimado),
      consumoBase: this.toDecimal(payload.consumoBase),
      activo: payload.activo,
      detalleJson: this.toNullableJson(payload.detalle),
      observaciones: payload.observaciones?.trim() || null,
    };
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
    const hasPerfilValido = payload.perfilesOperativos.some(
      (perfil) =>
        Boolean(perfil.nombre?.trim()) &&
        perfil.productividad !== undefined &&
        Boolean(perfil.unidadProductividad),
    );
    const requireConsumibles = PRINTER_TEMPLATES_WITH_INK_CONSUMPTION.has(
      payload.plantilla,
    );
    const hasConsumibleValido = payload.consumibles.some(
      (consumible) =>
        Boolean(consumible.nombre?.trim()) &&
        Boolean(consumible.tipo) &&
        Boolean(consumible.unidad),
    );
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
      hasDesgasteValido
    );
  }

  private hasTemplateSpecificData(payload: UpsertMaquinaDto) {
    if (!hasRequiredMachineDataByTemplate(payload)) {
      return false;
    }

    return true;
  }

  private async validateReferences(
    auth: CurrentAuth,
    payload: UpsertMaquinaDto,
  ) {
    const templateRule = TEMPLATE_CATALOG_RULES[payload.plantilla];
    if (!templateRule) {
      throw new BadRequestException(
        `La plantilla ${payload.plantilla} no existe en el catalogo del sistema.`,
      );
    }

    if (payload.geometriaTrabajo !== templateRule.geometry) {
      throw new BadRequestException(
        `La geometria ${payload.geometriaTrabajo} no coincide con la plantilla ${payload.plantilla}. Debe ser ${templateRule.geometry}.`,
      );
    }

    if (
      payload.unidadProduccionPrincipal !== templateRule.defaultProductionUnit
    ) {
      throw new BadRequestException(
        `La unidad ${payload.unidadProduccionPrincipal} no coincide con la plantilla ${payload.plantilla}. Debe ser ${templateRule.defaultProductionUnit}.`,
      );
    }

    this.validateTechnicalPayload(payload);
    try {
      validateMachinePayloadByTemplate(payload);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : `Maquina invalida para la plantilla ${payload.plantilla}.`,
      );
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
    for (const perfil of payload.perfilesOperativos) {
      const key = perfil.nombre.trim().toLowerCase();
      if (normalizedPerfilNames.has(key)) {
        throw new BadRequestException(
          `El perfil operativo ${perfil.nombre.trim()} esta duplicado.`,
        );
      }

      if (
        perfil.unidadProductividad &&
        !MaquinariaService.COMBINED_PRODUCTIVITY_UNITS.has(
          perfil.unidadProductividad,
        )
      ) {
        throw new BadRequestException(
          `El perfil operativo ${perfil.nombre.trim()} debe usar una unidad de productividad combinada (pag/min, m2/h o piezas/h).`,
        );
      }

      try {
        validatePerfilOperativoByTemplate(payload.plantilla, perfil);
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

    const variantesMateriaPrima = await this.prisma.materiaPrimaVariante.findMany({
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
      const consumibleName = consumible.nombre.trim() || 'sin nombre';
      const variante = varianteById.get(consumible.materiaPrimaVarianteId);
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

      for (const detailKey of Object.keys(consumible.detalle ?? {})) {
        if (!ALLOWED_CONSUMABLE_DETAIL_KEYS.has(detailKey)) {
          throw new BadRequestException(
            `El consumible ${consumibleName} incluye el campo ${detailKey}, que no corresponde a la plantilla ${payload.plantilla}.`,
          );
        }
      }
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

      for (const detailKey of Object.keys(componente.detalle ?? {})) {
        if (!ALLOWED_WEAR_DETAIL_KEYS.has(detailKey)) {
          throw new BadRequestException(
            `El componente de desgaste ${componenteName} incluye el campo ${detailKey}, que no corresponde a la plantilla ${payload.plantilla}.`,
          );
        }
      }
    }
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

      if (value === null || value === undefined) {
        continue;
      }

      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        continue;
      }

      if (Array.isArray(value)) {
        const isValidArray = value.every(
          (item) =>
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean',
        );
        if (!isValidArray) {
          throw new BadRequestException(
            `El parametro tecnico ${key} contiene un formato invalido.`,
          );
        }
        continue;
      }

      throw new BadRequestException(
        `El parametro tecnico ${key} contiene un formato invalido.`,
      );
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
      anchoUtil: this.toNumber(maquina.anchoUtil),
      largoUtil: this.toNumber(maquina.largoUtil),
      altoUtil: this.toNumber(maquina.altoUtil),
      espesorMaximo: this.toNumber(maquina.espesorMaximo),
      pesoMaximo: this.toNumber(maquina.pesoMaximo),
      fechaAlta: maquina.fechaAlta?.toISOString().slice(0, 10) ?? '',
      activo: maquina.activo,
      observaciones: maquina.observaciones ?? '',
      parametrosTecnicos:
        (maquina.parametrosTecnicosJson as Record<string, unknown> | null) ??
        null,
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
        anchoAplicable: this.toNumber(perfil.anchoAplicable),
        altoAplicable: this.toNumber(perfil.altoAplicable),
        modoTrabajo: perfil.modoTrabajo ?? '',
        calidad: perfil.calidad ?? '',
        productividad: this.toNumber(perfil.productividad),
        unidadProductividad: perfil.unidadProductividad
          ? (this.toApiEnum(
              perfil.unidadProductividad,
            ) as UnidadProduccionMaquinaDto)
          : '',
        tiempoPreparacionMin: this.toNumber(perfil.tiempoPreparacionMin),
        tiempoCargaMin: this.toNumber(perfil.tiempoCargaMin),
        tiempoDescargaMin: this.toNumber(perfil.tiempoDescargaMin),
        tiempoRipMin: this.toNumber(perfil.tiempoRipMin),
        cantidadPasadas: perfil.cantidadPasadas ?? null,
        dobleFaz: perfil.dobleFaz,
        detalle: (perfil.detalleJson as Record<string, unknown> | null) ?? null,
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
        ((anchoImprimible * altoImprimible) / 10000).toFixed(4),
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

  private getDerivedMachineDimensions(
    payload: UpsertMaquinaDto,
    parametrosTecnicos?: Record<string, unknown>,
  ) {
    if (
      payload.plantilla !== PlantillaMaquinariaDto.impresora_laser ||
      !parametrosTecnicos
    ) {
      return {
        anchoUtil: payload.anchoUtil,
        largoUtil: payload.largoUtil,
      };
    }

    const ancho = this.toNumeric(parametrosTecnicos.anchoImprimibleMaximo);
    const largo = this.toNumeric(parametrosTecnicos.altoImprimibleMaximo);

    return {
      anchoUtil: ancho ?? payload.anchoUtil,
      largoUtil: largo ?? payload.largoUtil,
    };
  }
}
