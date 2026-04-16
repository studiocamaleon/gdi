import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EstadoConfiguracionProceso,
  EstadoTarifaCentroCostoPeriodo,
  ModoProductividadProceso,
  PlantillaMaquinaria,
  Prisma,
  TipoOperacionProceso,
  UnidadBaseCentroCosto,
  UnidadProduccionMaquina,
  UnidadProceso,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { CurrentAuth } from '../auth/auth.types';
import { PaginationDto, paginatedResponse } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  BaseCalculoProductividadDto,
  EstadoConfiguracionProcesoDto,
  ModoProductividadProcesoDto,
  type PlantillaMaquinariaDto,
  type ProcesoOperacionItemDto,
  TipoOperacionProcesoDto,
  UnidadProcesoDto,
  UpsertProcesoDto,
} from './dto/upsert-proceso.dto';
import { UpsertProcesoOperacionPlantillaDto } from './dto/upsert-proceso-operacion-plantilla.dto';
import { BulkAssignEstacionPlantillasDto } from './dto/bulk-assign-estacion-plantillas.dto';
import {
  EvaluarProcesoCostoDto,
} from './dto/evaluar-proceso-costo.dto';
import {
  evaluateProductividad,
} from './proceso-productividad.engine';

type ProcesoCompleto = Prisma.ProcesoDefinicionGetPayload<{
  include: {
    operaciones: {
      include: {
        centroCosto: true;
        maquina: true;
        perfilOperativo: true;
      };
      orderBy: {
        orden: 'asc';
      };
    };
  };
}>;

type ProcesoOperacionPlantillaEntity = Prisma.ProcesoOperacionPlantillaGetPayload<{
  include: {
    centroCosto: true;
    maquina: true;
    perfilOperativo: true;
    estacion: true;
  };
}>;

type CentroRef = {
  id: string;
  nombre: string;
  unidadBaseFutura: UnidadBaseCentroCosto;
};

type MaquinaRef = {
  id: string;
  nombre: string;
  plantilla: PlantillaMaquinaria;
  centroCostoPrincipalId: string | null;
  unidadProduccionPrincipal: UnidadProduccionMaquina;
};

type PerfilRef = {
  id: string;
  nombre: string;
  maquinaId: string;
  productivityValue: Prisma.Decimal | null;
  productivityUnit: UnidadProduccionMaquina | null;
  setupMin: Prisma.Decimal | null;
  cleanupMin: Prisma.Decimal | null;
  detalleJson: Prisma.JsonValue | null;
};

type ReferenceContext = {
  centrosById: Map<string, CentroRef>;
  maquinasById: Map<string, MaquinaRef>;
  perfilesById: Map<string, PerfilRef>;
};

const DEFAULT_PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

@Injectable()
export class ProcesosService {
  private static readonly CODIGO_PREFIX = 'PRO';
  private static readonly CODIGO_MAX_RETRIES = 5;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(auth: CurrentAuth, pagination: PaginationDto) {
    const where = { tenantId: auth.tenantId };

    const [procesos, total] = await this.prisma.$transaction([
      this.prisma.procesoDefinicion.findMany({
        where,
        include: {
          operaciones: {
            include: {
              centroCosto: true,
              maquina: true,
              perfilOperativo: true,
            },
            orderBy: { orden: 'asc' },
          },
        },
        orderBy: [{ nombre: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.procesoDefinicion.count({ where }),
    ]);

    return paginatedResponse(
      procesos.map((proceso) => this.toProcesoResponse(proceso)),
      total,
      pagination,
    );
  }

  async findAllBibliotecaOperaciones(auth: CurrentAuth) {
    try {
      const plantillas = await this.prisma.procesoOperacionPlantilla.findMany({
        where: {
          tenantId: auth.tenantId,
        },
        include: {
          centroCosto: true,
          maquina: true,
          perfilOperativo: true,
          estacion: true,
        },
        orderBy: [{ nombre: 'asc' }],
      });

      return plantillas.map((item) => this.toBibliotecaOperacionResponse(item));
    } catch (error) {
      if (this.isBibliotecaStorageMissingError(error)) {
        return [];
      }
      throw error;
    }
  }

  async createBibliotecaOperacion(
    auth: CurrentAuth,
    payload: UpsertProcesoOperacionPlantillaDto,
  ) {
    this.validateBibliotecaOperacionPayload(payload);
    await this.validateBibliotecaOperacionNivelReferences(auth, payload.niveles ?? []);
    const refs = await this.resolveBibliotecaOperacionReferences(auth, payload);

    let created: { id: string };
    try {
      created = await this.prisma.procesoOperacionPlantilla.create({
        data: this.buildBibliotecaOperacionData(auth.tenantId, payload, refs),
        select: { id: true },
      });
    } catch (error) {
      this.handleBibliotecaWriteError(error);
    }

    const saved = await this.findBibliotecaOperacionOrThrow(auth, created.id);
    return this.toBibliotecaOperacionResponse(saved);
  }

  async updateBibliotecaOperacion(
    auth: CurrentAuth,
    id: string,
    payload: UpsertProcesoOperacionPlantillaDto,
  ) {
    await this.findBibliotecaOperacionOrThrow(auth, id);
    this.validateBibliotecaOperacionPayload(payload);
    await this.validateBibliotecaOperacionNivelReferences(auth, payload.niveles ?? []);
    const refs = await this.resolveBibliotecaOperacionReferences(auth, payload);

    let updated: { id: string };
    try {
      updated = await this.prisma.procesoOperacionPlantilla.update({
        where: { id },
        data: this.buildBibliotecaOperacionData(auth.tenantId, payload, refs),
        select: { id: true },
      });
    } catch (error) {
      this.handleBibliotecaWriteError(error);
    }

    const saved = await this.findBibliotecaOperacionOrThrow(auth, updated.id);
    return this.toBibliotecaOperacionResponse(saved);
  }

  async toggleBibliotecaOperacion(auth: CurrentAuth, id: string) {
    const item = await this.findBibliotecaOperacionOrThrow(auth, id);

    let updated: { id: string };
    try {
      updated = await this.prisma.procesoOperacionPlantilla.update({
        where: { id },
        data: {
          activo: !item.activo,
        },
        select: { id: true },
      });
    } catch (error) {
      this.handleBibliotecaWriteError(error);
    }

    const saved = await this.findBibliotecaOperacionOrThrow(auth, updated.id);
    return this.toBibliotecaOperacionResponse(saved);
  }

  async bulkAssignEstacionPlantillas(
    auth: CurrentAuth,
    dto: BulkAssignEstacionPlantillasDto,
  ) {
    if (dto.estacionId) {
      const estacion = await this.prisma.estacion.findFirst({
        where: { id: dto.estacionId, tenantId: auth.tenantId },
      });
      if (!estacion) {
        throw new BadRequestException('La estacion seleccionada no existe.');
      }
    }

    await this.prisma.procesoOperacionPlantilla.updateMany({
      where: {
        id: { in: dto.ids },
        tenantId: auth.tenantId,
      },
      data: {
        estacionId: dto.estacionId ?? null,
      },
    });

    return this.findAllBibliotecaOperaciones(auth);
  }

  async findOne(auth: CurrentAuth, id: string) {
    const proceso = await this.findProcesoOrThrow(auth, id);
    return this.toProcesoResponse(proceso);
  }

  async getVersiones(auth: CurrentAuth, id: string) {
    await this.findProcesoBaseOrThrow(auth, id);

    const versiones = await this.prisma.procesoVersion.findMany({
      where: {
        tenantId: auth.tenantId,
        procesoDefinicionId: id,
      },
      orderBy: [{ version: 'desc' }],
    });

    return versiones.map((version) => ({
      id: version.id,
      version: version.version,
      data: version.dataJson,
      createdAt: version.createdAt.toISOString(),
    }));
  }

  async snapshotCosto(auth: CurrentAuth, id: string, periodo: string) {
    return this.evaluarCostoInterno(auth, id, {
      periodo,
      cantidadObjetivo: 1,
      contexto: {},
    });
  }

  async evaluarCosto(
    auth: CurrentAuth,
    id: string,
    payload: EvaluarProcesoCostoDto,
  ) {
    return this.evaluarCostoInterno(auth, id, payload);
  }

  private async evaluarCostoInterno(
    auth: CurrentAuth,
    id: string,
    payload: EvaluarProcesoCostoDto,
  ) {
    const normalizedPeriodo = this.normalizePeriodo(payload.periodo);
    const cantidadObjetivo = Number(payload.cantidadObjetivo);
    if (!Number.isFinite(cantidadObjetivo) || cantidadObjetivo <= 0) {
      throw new BadRequestException('La cantidad objetivo debe ser mayor a 0.');
    }

    const contexto = payload.contexto ?? {};
    const proceso = await this.findProcesoOrThrow(auth, id);

    const centroIds = Array.from(
      new Set(proceso.operaciones.map((operacion) => operacion.centroCostoId)),
    );

    const tarifas = await this.prisma.centroCostoTarifaPeriodo.findMany({
      where: {
        tenantId: auth.tenantId,
        estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
        periodo: normalizedPeriodo,
        centroCostoId: {
          in: centroIds,
        },
      },
      select: {
        centroCostoId: true,
        tarifaCalculada: true,
      },
    });

    const tarifaByCentroId = new Map(
      tarifas.map((tarifa) => [tarifa.centroCostoId, tarifa.tarifaCalculada]),
    );

    const operationSnapshots = proceso.operaciones.map((operacion) => {
      const derived = this.deriveOperationDefaultsFromPersisted(operacion);
      const setupMin = this.decimalToNumber(derived.setupMin);
      const cleanupMin = this.decimalToNumber(operacion.cleanupMin);
      const tiempoFijoMin = this.decimalToNumber(operacion.tiempoFijoMin);
      const tarifa = tarifaByCentroId.get(operacion.centroCostoId);
      const tarifaNumero = tarifa ? Number(tarifa) : null;
      const usarTiempoFijoManual =
        operacion.modoProductividad === ModoProductividadProceso.FIJA &&
        tiempoFijoMin > 0;
      let runMin = this.decimalToNumber(operacion.runMin);
      const productividadWarnings: string[] = [];
      let productividadAplicada: number | null = null;
      let cantidadRun = 0;
      let mermaSetupAplicada = this.decimalToNumber(operacion.mermaSetup);
      let mermaRunPctAplicada = this.decimalToNumber(operacion.mermaRunPct);
      if (!usarTiempoFijoManual) {
        const productividad = evaluateProductividad({
          modoProductividad: ModoProductividadProceso.FIJA,
          productividadBase: derived.productividadBase,
          reglaVelocidadJson: null,
          reglaMermaJson: operacion.reglaMermaJson,
          runMin: operacion.runMin,
          unidadTiempo: derived.unidadTiempo,
          mermaRunPct: operacion.mermaRunPct,
          mermaSetup: operacion.mermaSetup,
          cantidadObjetivoSalida: cantidadObjetivo,
          contexto,
        });
        runMin = productividad.runMin;
        productividadAplicada = productividad.productividadAplicada;
        cantidadRun = productividad.cantidadRun;
        mermaSetupAplicada = productividad.mermaSetupAplicada;
        mermaRunPctAplicada = productividad.mermaRunPctAplicada;
        productividadWarnings.push(...productividad.warnings);
      }
      const totalMin = setupMin + runMin + cleanupMin + tiempoFijoMin;
      const horasEfectivas = totalMin / 60;
      const costoTiempo = tarifa
        ? Number(tarifa.mul(horasEfectivas).toFixed(2))
        : 0;

      const warnings: string[] = [
        ...productividadWarnings,
        ...derived.warnings,
      ];
      if (!tarifa) {
        warnings.push(
          `No hay tarifa PUBLICADA para ${operacion.centroCosto.nombre} en ${normalizedPeriodo}.`,
        );
      }

      if (
        operacion.maquina?.centroCostoPrincipalId &&
        operacion.maquina.centroCostoPrincipalId !== operacion.centroCostoId
      ) {
        warnings.push(
          `La maquina ${operacion.maquina.nombre} tiene otro centro principal; se usa el centro configurado en la operacion.`,
        );
      }

      const unitWarning = this.getCentroUnidadCompatibilityWarning(operacion);
      if (unitWarning) {
        warnings.push(unitWarning);
      }

      return {
        operacionId: operacion.id,
        orden: operacion.orden,
        codigo: operacion.codigo,
        nombre: operacion.nombre,
        centroCostoId: operacion.centroCostoId,
        centroCostoNombre: operacion.centroCosto.nombre,
        maquinaId: operacion.maquinaId,
        maquinaNombre: operacion.maquina?.nombre ?? '',
        setupMin,
        runMin,
        cleanupMin,
        tiempoFijoMin,
        totalMin: Number(totalMin.toFixed(2)),
        horasEfectivas: Number(horasEfectivas.toFixed(2)),
        tarifaCentro: tarifaNumero,
        costoTiempo,
        productividadAplicada,
        cantidadRun,
        mermaSetupAplicada,
        mermaRunPctAplicada,
        modoProductividad: this.toApiModoProductividad(
          operacion.modoProductividad,
        ),
        warnings: Array.from(new Set(warnings)),
      };
    });

    const totalCostoTiempo = Number(
      operationSnapshots
        .reduce((acc, item) => acc + item.costoTiempo, 0)
        .toFixed(2),
    );

    const advertencias = Array.from(
      new Set(operationSnapshots.flatMap((item) => item.warnings)),
    );

    return {
      procesoId: proceso.id,
      procesoCodigo: proceso.codigo,
      procesoNombre: proceso.nombre,
      version: proceso.currentVersion,
      periodo: normalizedPeriodo,
      cantidadObjetivo,
      contexto,
      costoTiempoTotal: totalCostoTiempo,
      operaciones: operationSnapshots,
      advertencias,
      validaParaCotizar: advertencias.length === 0,
    };
  }

  async create(auth: CurrentAuth, payload: UpsertProcesoDto) {
    const references = await this.resolveReferenceContext(auth, payload);
    this.validateBusinessRules(payload, references);

    for (
      let attempt = 0;
      attempt < ProcesosService.CODIGO_MAX_RETRIES;
      attempt += 1
    ) {
      const generatedCodigo = this.generateCodigoProceso();

      try {
        const proceso = await this.createWithCodigo(
          auth,
          payload,
          references,
          generatedCodigo,
        );
        return this.toProcesoResponse(proceso);
      } catch (error) {
        if (this.isCodigoConflictError(error)) {
          continue;
        }

        this.handleWriteError(error);
      }
    }

    throw new ConflictException(
      'No se pudo generar un codigo unico para el proceso.',
    );
  }

  async update(auth: CurrentAuth, id: string, payload: UpsertProcesoDto) {
    const base = await this.findProcesoBaseOrThrow(auth, id);
    const references = await this.resolveReferenceContext(auth, payload);
    this.validateBusinessRules(payload, references);

    try {
      const proceso = await this.prisma.$transaction(async (tx) => {
        const codigoToPersist = base.codigo;
        const nextVersion = base.currentVersion + 1;

        await tx.procesoDefinicion.update({
          where: { id },
          data: this.buildProcesoWriteData(
            auth,
            payload,
            references,
            codigoToPersist,
            nextVersion,
          ),
        });

        await this.replaceOperaciones(
          tx,
          auth.tenantId,
          id,
          payload.operaciones,
          references,
        );

        const updated = await tx.procesoDefinicion.findUniqueOrThrow({
          where: { id },
          include: {
            operaciones: {
              include: {
                centroCosto: true,
                maquina: true,
                perfilOperativo: true,
              },
              orderBy: {
                orden: 'asc',
              },
            },
          },
        });

        await tx.procesoVersion.create({
          data: {
            tenantId: auth.tenantId,
            procesoDefinicionId: id,
            version: nextVersion,
            dataJson: this.toVersionSnapshot(updated),
          },
        });

        return updated;
      });

      return this.toProcesoResponse(proceso);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async toggle(auth: CurrentAuth, id: string) {
    const proceso = await this.findProcesoBaseOrThrow(auth, id);

    const updated = await this.prisma.procesoDefinicion.update({
      where: { id },
      data: {
        activo: !proceso.activo,
      },
      include: {
        operaciones: {
          include: {
            centroCosto: true,
            maquina: true,
            perfilOperativo: true,
          },
          orderBy: {
            orden: 'asc',
          },
        },
      },
    });

    return this.toProcesoResponse(updated);
  }

  private async createWithCodigo(
    auth: CurrentAuth,
    payload: UpsertProcesoDto,
    references: ReferenceContext,
    codigo: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.procesoDefinicion.create({
        data: this.buildProcesoWriteData(auth, payload, references, codigo, 1),
      });

      await this.replaceOperaciones(
        tx,
        auth.tenantId,
        created.id,
        payload.operaciones,
        references,
      );

      const hydrated = await tx.procesoDefinicion.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          operaciones: {
            include: {
              centroCosto: true,
              maquina: true,
              perfilOperativo: true,
            },
            orderBy: {
              orden: 'asc',
            },
          },
        },
      });

      await tx.procesoVersion.create({
        data: {
          tenantId: auth.tenantId,
          procesoDefinicionId: created.id,
          version: 1,
          dataJson: this.toVersionSnapshot(hydrated),
        },
      });

      return hydrated;
    });
  }

  private async replaceOperaciones(
    tx: Prisma.TransactionClient,
    tenantId: string,
    procesoId: string,
    operaciones: ProcesoOperacionItemDto[],
    references: ReferenceContext,
  ) {
    await tx.procesoOperacion.deleteMany({
      where: {
        tenantId,
        procesoDefinicionId: procesoId,
      },
    });

    await Promise.all(
      operaciones.map((operacion, index) =>
        tx.procesoOperacion.create({
          data: this.buildOperacionData(
            tenantId,
            procesoId,
            operacion,
            index + 1,
            references,
          ),
        }),
      ),
    );
  }

  private buildProcesoWriteData(
    auth: CurrentAuth,
    payload: UpsertProcesoDto,
    references: ReferenceContext,
    forcedCodigo: string,
    forcedVersion: number,
  ) {
    const estadoConfiguracion = this.getDerivedEstadoConfiguracion(
      payload,
      references,
    );

    return {
      tenantId: auth.tenantId,
      codigo: forcedCodigo,
      nombre: payload.nombre.trim(),
      descripcion: payload.descripcion?.trim() || null,
      currentVersion: forcedVersion,
      estadoConfiguracion:
        this.toPrismaEnum<EstadoConfiguracionProceso>(estadoConfiguracion),
      activo: payload.activo,
      observaciones: payload.observaciones?.trim() || null,
    };
  }

  private buildOperacionData(
    tenantId: string,
    procesoId: string,
    payload: ProcesoOperacionItemDto,
    orden: number,
    references: ReferenceContext,
  ) {
    const codigo = `OP-${String(orden).padStart(3, '0')}`;
    const centroCostoId = this.resolveCentroCostoIdForOperation(
      payload,
      references,
    );
    const derived = this.deriveOperationDefaultsFromPayload(
      payload,
      references,
    );

    return {
      tenantId,
      procesoDefinicionId: procesoId,
      orden,
      codigo,
      nombre: payload.nombre.trim(),
      tipoOperacion: this.toPrismaTipoOperacion(payload.tipoOperacion),
      centroCostoId,
      maquinaId: payload.maquinaId ?? null,
      perfilOperativoId: payload.perfilOperativoId ?? null,
      setupMin: derived.setupMin,
      runMin: this.toDecimal(payload.runMin),
      cleanupMin: derived.cleanupMin,
      tiempoFijoMin: this.toDecimal(payload.tiempoFijoMin),
      multiplicadorDobleFaz: this.toDecimal(payload.multiplicadorDobleFaz),
      modoProductividad: this.resolveModoProductividadFromPayload(payload),
      productividadBase: derived.productividadBase,
      unidadEntrada: this.toPrismaEnum<UnidadProceso>(
        payload.unidadEntrada ?? UnidadProcesoDto.ninguna,
      ),
      unidadSalida: derived.unidadSalida,
      unidadTiempo: derived.unidadTiempo,
      mermaSetup: this.toDecimal(payload.mermaSetup),
      mermaRunPct: this.toDecimal(payload.mermaRunPct),
      reglaVelocidadJson: undefined,
      reglaMermaJson: this.toNullableJson(payload.reglaMerma),
      detalleJson: this.buildOperacionDetalleJson(
        payload.detalle,
        payload.niveles,
        payload.baseCalculoProductividad,
      ),
      activo: payload.activo,
    };
  }

  private buildBibliotecaOperacionData(
    tenantId: string,
    payload: UpsertProcesoOperacionPlantillaDto,
    refs: {
      centroCostoId: string | null;
      maquinaId: string | null;
      perfilOperativoId: string | null;
      estacionId: string | null;
    },
  ) {
    return {
      tenantId,
      nombre: payload.nombre.trim(),
      tipoOperacion: this.toPrismaTipoOperacion(payload.tipoOperacion),
      centroCostoId: refs.centroCostoId,
      maquinaId: refs.maquinaId,
      perfilOperativoId: refs.perfilOperativoId,
      estacionId: refs.estacionId,
      setupMin: this.toDecimal(payload.setupMin),
      cleanupMin: this.toDecimal(payload.cleanupMin),
      tiempoFijoMin: this.toDecimal(payload.tiempoFijoMin),
      modoProductividad: this.resolveModoProductividadFromBibliotecaPayload(
        payload,
      ),
      productividadBase: this.toDecimal(payload.productividadBase),
      unidadEntrada: this.toPrismaEnum<UnidadProceso>(
        payload.unidadEntrada ?? UnidadProcesoDto.ninguna,
      ),
      unidadSalida: this.toPrismaEnum<UnidadProceso>(
        payload.unidadSalida ?? UnidadProcesoDto.ninguna,
      ),
      unidadTiempo: this.toPrismaEnum<UnidadProceso>(
        payload.unidadTiempo ?? UnidadProcesoDto.minuto,
      ),
      mermaRunPct: this.toDecimal(payload.mermaRunPct),
      reglaVelocidadJson: undefined,
      reglaMermaJson: this.toNullableJson(payload.reglaMerma),
      detalleJson: this.buildOperacionDetalleJson(
        undefined,
        payload.niveles,
        payload.baseCalculoProductividad,
      ),
      observaciones: payload.observaciones?.trim() || null,
      activo: payload.activo,
    };
  }

  private toPrismaTipoOperacion(value: TipoOperacionProcesoDto): TipoOperacionProceso {
    switch (value) {
      case TipoOperacionProcesoDto.preprensa:
      case TipoOperacionProcesoDto.servicio: // legacy → preprensa
        return TipoOperacionProceso.PREPRENSA;
      case TipoOperacionProcesoDto.prensa:
        return TipoOperacionProceso.IMPRESION;
      case TipoOperacionProcesoDto.postprensa:
      case TipoOperacionProcesoDto.acabado: // legacy → postprensa
        return TipoOperacionProceso.TERMINACION;
      case TipoOperacionProcesoDto.instalacion:
        return TipoOperacionProceso.LOGISTICA;
      case TipoOperacionProcesoDto.entrega_despacho:
        return TipoOperacionProceso.EMPAQUE;
      default:
        return TipoOperacionProceso.PREPRENSA;
    }
  }

  private fromPrismaTipoOperacion(value: TipoOperacionProceso): TipoOperacionProcesoDto {
    switch (value) {
      case TipoOperacionProceso.PREPRENSA:
        return TipoOperacionProcesoDto.preprensa;
      case TipoOperacionProceso.IMPRESION:
        return TipoOperacionProcesoDto.prensa;
      case TipoOperacionProceso.TERMINACION:
        return TipoOperacionProcesoDto.postprensa;
      case TipoOperacionProceso.LOGISTICA:
        return TipoOperacionProcesoDto.instalacion;
      case TipoOperacionProceso.EMPAQUE:
        return TipoOperacionProcesoDto.entrega_despacho;
      default:
        return TipoOperacionProcesoDto.preprensa;
    }
  }

  private buildOperacionDetalleJson(
    detalle: Record<string, unknown> | undefined,
    niveles: Array<{
      id?: string;
      nombre: string;
      orden?: number;
      activo?: boolean;
      modoProductividadNivel?: string;
      tiempoFijoMin?: number;
      productividadBase?: number;
      unidadSalida?: string;
      unidadTiempo?: string;
      maquinaId?: string;
      perfilOperativoId?: string;
      setupMin?: number;
      cleanupMin?: number;
      detalle?: Record<string, unknown>;
    }> = [],
    baseCalculoProductividad?: BaseCalculoProductividadDto,
  ) {
    const base = detalle && typeof detalle === 'object' && !Array.isArray(detalle) ? { ...detalle } : {};
    if (baseCalculoProductividad) {
      base.baseCalculoProductividad = baseCalculoProductividad;
    }
    const nivelesSanitizados = niveles
      .filter((nivel) => nivel.nombre?.trim())
      .map((nivel, index) => {
        const modoProductividadNivel =
          nivel.modoProductividadNivel === 'variable_manual' ||
          nivel.modoProductividadNivel === 'variable_perfil'
            ? nivel.modoProductividadNivel
            : 'fija';
        const sanitized = {
          id: nivel.id?.trim() || randomUUID(),
          nombre: nivel.nombre.trim(),
          orden: nivel.orden ?? index + 1,
          activo: nivel.activo ?? true,
          modoProductividadNivel,
          tiempoFijoMin:
            nivel.tiempoFijoMin === undefined || nivel.tiempoFijoMin === null
              ? null
              : Number(nivel.tiempoFijoMin),
          productividadBase:
            nivel.productividadBase === undefined || nivel.productividadBase === null
              ? null
              : Number(nivel.productividadBase),
          unidadSalida: nivel.unidadSalida?.trim() || null,
          unidadTiempo: nivel.unidadTiempo?.trim() || null,
          maquinaId: nivel.maquinaId?.trim() || null,
          perfilOperativoId: nivel.perfilOperativoId?.trim() || null,
          setupMin:
            nivel.setupMin === undefined || nivel.setupMin === null
              ? null
              : Number(nivel.setupMin),
          cleanupMin:
            nivel.cleanupMin === undefined || nivel.cleanupMin === null
              ? null
              : Number(nivel.cleanupMin),
          resumen: this.buildNivelResumen({
            nombre: nivel.nombre.trim(),
            modoProductividadNivel,
            tiempoFijoMin:
              nivel.tiempoFijoMin === undefined || nivel.tiempoFijoMin === null
                ? null
                : Number(nivel.tiempoFijoMin),
            productividadBase:
              nivel.productividadBase === undefined || nivel.productividadBase === null
                ? null
                : Number(nivel.productividadBase),
            unidadSalida: nivel.unidadSalida?.trim() || null,
            unidadTiempo: nivel.unidadTiempo?.trim() || null,
            perfilOperativoNombre: '',
          }),
          detalle:
            nivel.detalle && typeof nivel.detalle === 'object' && !Array.isArray(nivel.detalle)
              ? nivel.detalle
              : null,
        };
        return sanitized;
      });
    return this.toNullableJson({
      ...base,
      niveles: nivelesSanitizados,
    });
  }

  private getOperacionDetalle(detalleJson: Prisma.JsonValue | null) {
    if (!detalleJson || typeof detalleJson !== 'object' || Array.isArray(detalleJson)) {
      return null;
    }
    const detalle = { ...(detalleJson as Record<string, unknown>) };
    delete detalle.niveles;
    return Object.keys(detalle).length > 0 ? detalle : null;
  }

  private getOperacionNiveles(detalleJson: Prisma.JsonValue | null) {
    if (!detalleJson || typeof detalleJson !== 'object' || Array.isArray(detalleJson)) {
      return [];
    }
    const raw = (detalleJson as Record<string, unknown>).niveles;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null;
        }
        const nivel = item as Record<string, unknown>;
        const nombre = String(nivel.nombre ?? '').trim();
        if (!nombre) {
          return null;
        }
        return {
          id: String(nivel.id ?? randomUUID()),
          nombre,
          orden: Number(nivel.orden ?? index + 1),
          activo: nivel.activo !== false,
          modoProductividadNivel:
            nivel.modoProductividadNivel === 'variable_manual' ||
            nivel.modoProductividadNivel === 'variable_perfil'
              ? nivel.modoProductividadNivel
              : 'fija',
          tiempoFijoMin:
            typeof nivel.tiempoFijoMin === 'number'
              ? nivel.tiempoFijoMin
              : nivel.tiempoFijoMin == null
                ? null
                : Number(nivel.tiempoFijoMin),
          productividadBase:
            typeof nivel.productividadBase === 'number'
              ? nivel.productividadBase
              : nivel.productividadBase == null
                ? null
                : Number(nivel.productividadBase),
          unidadSalida:
            typeof nivel.unidadSalida === 'string' && nivel.unidadSalida.trim().length
              ? nivel.unidadSalida.trim()
              : null,
          unidadTiempo:
            typeof nivel.unidadTiempo === 'string' && nivel.unidadTiempo.trim().length
              ? nivel.unidadTiempo.trim()
              : null,
          maquinaId:
            typeof nivel.maquinaId === 'string' && nivel.maquinaId.trim().length
              ? nivel.maquinaId.trim()
              : null,
          maquinaNombre:
            typeof nivel.maquinaNombre === 'string' && nivel.maquinaNombre.trim().length
              ? nivel.maquinaNombre.trim()
              : '',
          perfilOperativoId:
            typeof nivel.perfilOperativoId === 'string' && nivel.perfilOperativoId.trim().length
              ? nivel.perfilOperativoId.trim()
              : null,
          perfilOperativoNombre:
            typeof nivel.perfilOperativoNombre === 'string' && nivel.perfilOperativoNombre.trim().length
              ? nivel.perfilOperativoNombre.trim()
              : '',
          setupMin:
            typeof nivel.setupMin === 'number'
              ? nivel.setupMin
              : nivel.setupMin == null
                ? null
                : Number(nivel.setupMin),
          cleanupMin:
            typeof nivel.cleanupMin === 'number'
              ? nivel.cleanupMin
              : nivel.cleanupMin == null
                ? null
                : Number(nivel.cleanupMin),
          resumen:
            typeof nivel.resumen === 'string' && nivel.resumen.trim().length
              ? nivel.resumen.trim()
              : this.buildNivelResumen({
                  nombre,
                  modoProductividadNivel:
                    nivel.modoProductividadNivel === 'variable_manual' ||
                    nivel.modoProductividadNivel === 'variable_perfil'
                      ? nivel.modoProductividadNivel
                      : 'fija',
                  tiempoFijoMin:
                    typeof nivel.tiempoFijoMin === 'number'
                      ? nivel.tiempoFijoMin
                      : nivel.tiempoFijoMin == null
                        ? null
                        : Number(nivel.tiempoFijoMin),
                  productividadBase:
                    typeof nivel.productividadBase === 'number'
                      ? nivel.productividadBase
                      : nivel.productividadBase == null
                        ? null
                        : Number(nivel.productividadBase),
                  unidadSalida:
                    typeof nivel.unidadSalida === 'string' ? nivel.unidadSalida : null,
                  unidadTiempo:
                    typeof nivel.unidadTiempo === 'string' ? nivel.unidadTiempo : null,
                  perfilOperativoNombre:
                    typeof nivel.perfilOperativoNombre === 'string'
                      ? nivel.perfilOperativoNombre
                      : '',
                }),
          detalle:
            nivel.detalle && typeof nivel.detalle === 'object' && !Array.isArray(nivel.detalle)
              ? (nivel.detalle as Record<string, unknown>)
              : null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.orden - b.orden);
  }

  private validateBibliotecaOperacionPayload(
    payload: UpsertProcesoOperacionPlantillaDto,
  ) {
    if (!payload.nombre?.trim()) {
      throw new BadRequestException(
        'La plantilla de operacion requiere nombre.',
      );
    }

    if (payload.setupMin !== undefined && payload.setupMin < 0) {
      throw new BadRequestException('Setup no puede ser negativo.');
    }

    if (payload.cleanupMin !== undefined && payload.cleanupMin < 0) {
      throw new BadRequestException('Cleanup no puede ser negativo.');
    }

    if (payload.tiempoFijoMin !== undefined && payload.tiempoFijoMin < 0) {
      throw new BadRequestException('Tiempo fijo no puede ser negativo.');
    }

    if (
      payload.productividadBase !== undefined &&
      payload.productividadBase < 0
    ) {
      throw new BadRequestException(
        'Productividad base no puede ser negativa.',
      );
    }

    if (
      payload.mermaRunPct !== undefined &&
      (payload.mermaRunPct < 0 || payload.mermaRunPct > 100)
    ) {
      throw new BadRequestException('Merma debe estar entre 0 y 100.');
    }

    if (!payload.maquinaId && payload.perfilOperativoId) {
      throw new BadRequestException(
        'No se puede definir perfil operativo sin maquina.',
      );
    }

    if (!payload.maquinaId && !payload.centroCostoId) {
      throw new BadRequestException(
        'Define un centro de costo cuando la plantilla no tiene maquina.',
      );
    }

    this.validateBaseCalculoProductividad({
      operationName: payload.nombre.trim(),
      baseCalculoProductividad: payload.baseCalculoProductividad,
      unidadSalida: payload.unidadSalida ?? UnidadProcesoDto.ninguna,
    });

    this.validateOperacionNivelesPayload(payload.niveles ?? [], payload.nombre.trim());
  }

  private validateBaseCalculoProductividad(input: {
    operationName: string;
    baseCalculoProductividad?: BaseCalculoProductividadDto;
    unidadSalida: UnidadProcesoDto;
  }) {
    const baseCalculoProductividad = input.baseCalculoProductividad;
    if (!baseCalculoProductividad) {
      return;
    }

    const requiereMetroLineal =
      baseCalculoProductividad === BaseCalculoProductividadDto.metro_lineal_total ||
      baseCalculoProductividad === BaseCalculoProductividadDto.perimetro_total_ml;

    if (
      requiereMetroLineal &&
      input.unidadSalida !== UnidadProcesoDto.metro_lineal
    ) {
      throw new BadRequestException(
        `La operacion ${input.operationName} usa Base de calculo lineal y requiere Unidad de productividad en metro lineal.`,
      );
    }

    if (
      baseCalculoProductividad === BaseCalculoProductividadDto.area_total_m2 &&
      input.unidadSalida !== UnidadProcesoDto.m2
    ) {
      throw new BadRequestException(
        `La operacion ${input.operationName} usa Base de calculo por area y requiere Unidad de productividad en m2.`,
      );
    }
  }

  private resolveModoProductividadFromPayload(
    payload: ProcesoOperacionItemDto,
  ): ModoProductividadProceso {
    if (payload.modoProductividad === ModoProductividadProcesoDto.fija) {
      return ModoProductividadProceso.FIJA;
    }
    return ModoProductividadProceso.FORMULA;
  }

  private resolveModoProductividadFromBibliotecaPayload(
    payload: UpsertProcesoOperacionPlantillaDto,
  ): ModoProductividadProceso {
    if (payload.modoProductividad === ModoProductividadProcesoDto.fija) {
      return ModoProductividadProceso.FIJA;
    }
    return ModoProductividadProceso.FORMULA;
  }

  private deriveOperationDefaultsFromPayload(
    payload: ProcesoOperacionItemDto,
    references: ReferenceContext,
  ) {
    const maquina = payload.maquinaId
      ? (references.maquinasById.get(payload.maquinaId) ?? null)
      : null;
    const perfil = payload.perfilOperativoId
      ? (references.perfilesById.get(payload.perfilOperativoId) ?? null)
      : null;
    const perfilDetalle =
      perfil?.detalleJson && typeof perfil.detalleJson === 'object' && !Array.isArray(perfil.detalleJson)
        ? (perfil.detalleJson as Record<string, unknown>)
        : null;
    const velocidadTrabajoMmSegPerfil =
      typeof perfilDetalle?.velocidadTrabajoMmSeg === 'number' &&
      Number.isFinite(perfilDetalle.velocidadTrabajoMmSeg)
        ? perfilDetalle.velocidadTrabajoMmSeg
        : null;
    const machineUnit = this.mapProfileProductivityUnitToProceso(
      perfil?.productivityUnit ?? maquina?.unidadProduccionPrincipal ?? null,
    );

    const explicitUnidadSalida = this.toPrismaEnum<UnidadProceso>(
      payload.unidadSalida ?? UnidadProcesoDto.ninguna,
    );
    const explicitUnidadTiempo = this.toPrismaEnum<UnidadProceso>(
      payload.unidadTiempo ?? UnidadProcesoDto.minuto,
    );

    const shouldAbsorbUnits =
      Boolean(machineUnit) && explicitUnidadSalida === UnidadProceso.NINGUNA;

    const unidadSalida = shouldAbsorbUnits
      ? (machineUnit?.unidadSalida ?? explicitUnidadSalida)
      : explicitUnidadSalida;
    const unidadTiempo = shouldAbsorbUnits
      ? (machineUnit?.unidadTiempo ?? explicitUnidadTiempo)
      : explicitUnidadTiempo;

    const setupMin =
      this.toDecimal(payload.setupMin) ??
      this.getSetupFromPerfilReference(perfil) ??
      null;
    const cleanupMin =
      this.toDecimal(payload.cleanupMin) ??
      perfil?.cleanupMin ??
      null;

    const productividadBase =
      this.toDecimal(payload.productividadBase) ??
      perfil?.productivityValue ??
      (maquina?.plantilla === PlantillaMaquinaria.LAMINADORA_BOPP_ROLLO &&
      velocidadTrabajoMmSegPerfil !== null
        ? new Prisma.Decimal(velocidadTrabajoMmSegPerfil)
        : null) ??
      null;

    return {
      perfil,
      unidadSalida,
      unidadTiempo,
      setupMin,
      cleanupMin,
      productividadBase,
    };
  }

  private deriveOperationDefaultsFromPersisted(
    operacion: ProcesoCompleto['operaciones'][number],
  ) {
    const perfilDetalle =
      operacion.perfilOperativo?.detalleJson &&
      typeof operacion.perfilOperativo.detalleJson === 'object' &&
      !Array.isArray(operacion.perfilOperativo.detalleJson)
        ? (operacion.perfilOperativo.detalleJson as Record<string, unknown>)
        : null;
    const velocidadTrabajoMmSegPerfil =
      typeof perfilDetalle?.velocidadTrabajoMmSeg === 'number' &&
      Number.isFinite(perfilDetalle.velocidadTrabajoMmSeg)
        ? perfilDetalle.velocidadTrabajoMmSeg
        : null;
    const machineUnit = this.mapProfileProductivityUnitToProceso(
      operacion.perfilOperativo?.productivityUnit ??
        operacion.maquina?.unidadProduccionPrincipal ??
        null,
    );

    const shouldAbsorbUnits =
      Boolean(machineUnit) && operacion.unidadSalida === UnidadProceso.NINGUNA;

    const unidadSalida = shouldAbsorbUnits
      ? (machineUnit?.unidadSalida ?? operacion.unidadSalida)
      : operacion.unidadSalida;
    const unidadTiempo = shouldAbsorbUnits
      ? (machineUnit?.unidadTiempo ?? operacion.unidadTiempo)
      : operacion.unidadTiempo;

    const productividadBase =
      operacion.productividadBase ??
      operacion.perfilOperativo?.productivityValue ??
      (operacion.maquina?.plantilla === PlantillaMaquinaria.LAMINADORA_BOPP_ROLLO &&
      velocidadTrabajoMmSegPerfil !== null
        ? new Prisma.Decimal(velocidadTrabajoMmSegPerfil)
        : null) ??
      null;
    const fallbackSetup = this.getSetupFromPerfilPersisted(
      operacion.perfilOperativo,
    );
    const setupMin = operacion.setupMin ?? fallbackSetup ?? null;
    const cleanupMin = operacion.cleanupMin ?? operacion.perfilOperativo?.cleanupMin ?? null;

    const absorptionWarnings: string[] = [];
    if (
      !operacion.productividadBase &&
      (operacion.perfilOperativo?.productivityValue ||
        (operacion.maquina?.plantilla === PlantillaMaquinaria.LAMINADORA_BOPP_ROLLO &&
          velocidadTrabajoMmSegPerfil !== null &&
          velocidadTrabajoMmSegPerfil > 0))
    ) {
      absorptionWarnings.push(
        `Se uso productividad del perfil operativo ${operacion.perfilOperativo?.nombre ?? 'sin nombre'}.`,
      );
    }
    if (
      operacion.setupMin === null &&
      fallbackSetup !== null &&
      operacion.perfilOperativo
    ) {
      absorptionWarnings.push(
        `Se uso setup del perfil operativo ${operacion.perfilOperativo.nombre}.`,
      );
    }
    if (
      operacion.cleanupMin === null &&
      cleanupMin !== null &&
      operacion.perfilOperativo
    ) {
      absorptionWarnings.push(
        `Se uso cleanup del perfil operativo ${operacion.perfilOperativo.nombre}.`,
      );
    }
    if (shouldAbsorbUnits && operacion.perfilOperativo?.productivityUnit) {
      absorptionWarnings.push(
        `Se usaron unidades del perfil operativo ${operacion.perfilOperativo.nombre}.`,
      );
    } else if (
      shouldAbsorbUnits &&
      operacion.maquina?.unidadProduccionPrincipal
    ) {
      absorptionWarnings.push(
        `Se usaron unidades de la maquina ${operacion.maquina.nombre}.`,
      );
    }

    return {
      unidadSalida,
      unidadTiempo,
      productividadBase,
      setupMin,
      cleanupMin,
      warnings: absorptionWarnings,
    };
  }

  private mapProfileProductivityUnitToProceso(
    unit?: UnidadProduccionMaquina | null,
  ): { unidadSalida: UnidadProceso; unidadTiempo: UnidadProceso } | null {
    if (!unit) {
      return null;
    }

    if (unit === UnidadProduccionMaquina.PPM) {
      return {
        unidadSalida: UnidadProceso.COPIA,
        unidadTiempo: UnidadProceso.MINUTO,
      };
    }

    if (unit === UnidadProduccionMaquina.M2_H) {
      return {
        unidadSalida: UnidadProceso.M2,
        unidadTiempo: UnidadProceso.HORA,
      };
    }

    if (unit === UnidadProduccionMaquina.PIEZAS_H) {
      return {
        unidadSalida: UnidadProceso.PIEZA,
        unidadTiempo: UnidadProceso.HORA,
      };
    }

    if (unit === UnidadProduccionMaquina.CORTES_MIN) {
      return {
        unidadSalida: UnidadProceso.CORTE,
        unidadTiempo: UnidadProceso.MINUTO,
      };
    }

    if (unit === UnidadProduccionMaquina.GOLPES_MIN) {
      return {
        unidadSalida: UnidadProceso.CICLO,
        unidadTiempo: UnidadProceso.MINUTO,
      };
    }

    if (unit === UnidadProduccionMaquina.PLIEGOS_MIN) {
      return {
        unidadSalida: UnidadProceso.HOJA,
        unidadTiempo: UnidadProceso.MINUTO,
      };
    }

    if (unit === UnidadProduccionMaquina.M_MIN) {
      return {
        unidadSalida: UnidadProceso.METRO_LINEAL,
        unidadTiempo: UnidadProceso.MINUTO,
      };
    }

    return null;
  }

  private getSetupFromPerfilReference(perfil: PerfilRef | null) {
    if (!perfil) {
      return null;
    }

    const timeParts = [
      ...this.collectSetupDetailParts(perfil.detalleJson),
      perfil.setupMin,
    ].filter(
      (value): value is Prisma.Decimal => value !== null && value !== undefined,
    );

    if (!timeParts.length) {
      return null;
    }

    return timeParts.reduce(
      (acc, value) => acc.add(value),
      new Prisma.Decimal(0),
    );
  }

  private getSetupFromPerfilPersisted(
    perfil: ProcesoCompleto['operaciones'][number]['perfilOperativo'] | null,
  ) {
    if (!perfil) {
      return null;
    }

    const timeParts = [
      ...this.collectSetupDetailParts(perfil.detalleJson),
      perfil.setupMin,
    ].filter(
      (value): value is Prisma.Decimal => value !== null && value !== undefined,
    );

    if (!timeParts.length) {
      return null;
    }

    return timeParts.reduce(
      (acc, value) => acc.add(value),
      new Prisma.Decimal(0),
    );
  }

  private collectSetupDetailParts(detalleJson: Prisma.JsonValue | null) {
    if (!detalleJson || typeof detalleJson !== 'object' || Array.isArray(detalleJson)) {
      return [] as Prisma.Decimal[];
    }

    const detalle = detalleJson as Record<string, unknown>;
    const values: number[] = [];
    const pushIfFinite = (value: unknown) => {
      const parsed = this.parseFiniteNumber(value);
      if (parsed !== null && parsed > 0) {
        values.push(parsed);
      }
    };

    const objectCandidates = [
      detalle.setupComponentesMin,
      detalle.setupExtraComponentesMin,
      detalle.tiemposSetupExtraMin,
    ];
    for (const candidate of objectCandidates) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        continue;
      }
      for (const value of Object.values(candidate as Record<string, unknown>)) {
        pushIfFinite(value);
      }
    }

    const arrayCandidates = [detalle.setupExtrasMin, detalle.tiemposExtraSetupMin];
    for (const candidate of arrayCandidates) {
      if (!Array.isArray(candidate)) {
        continue;
      }
      for (const value of candidate) {
        pushIfFinite(value);
      }
    }

    return values.map((item) => new Prisma.Decimal(item));
  }

  private getDerivedEstadoConfiguracion(
    payload: UpsertProcesoDto,
    references: ReferenceContext,
  ): EstadoConfiguracionProcesoDto {
    if (!payload.nombre?.trim()) {
      return EstadoConfiguracionProcesoDto.borrador;
    }

    if (!payload.operaciones.length) {
      return EstadoConfiguracionProcesoDto.incompleta;
    }

    const hasAllCenters = payload.operaciones.every((operacion) => {
      if (operacion.centroCostoId) {
        return true;
      }

      if (!operacion.maquinaId) {
        return false;
      }

      const maquina = references.maquinasById.get(operacion.maquinaId);
      return Boolean(maquina?.centroCostoPrincipalId);
    });

    if (!hasAllCenters) {
      return EstadoConfiguracionProcesoDto.incompleta;
    }

    const hasAllOperationsCostingSignals = payload.operaciones.every(
      (operacion) => {
        const derived = this.deriveOperationDefaultsFromPayload(
          operacion,
          references,
        );
        return (
          derived.setupMin !== null ||
          operacion.runMin !== undefined ||
          operacion.tiempoFijoMin !== undefined ||
          derived.productividadBase !== null
        );
      },
    );

    if (!hasAllOperationsCostingSignals) {
      return EstadoConfiguracionProcesoDto.incompleta;
    }

    return EstadoConfiguracionProcesoDto.lista;
  }

  private resolveCentroCostoIdForOperation(
    operacion: ProcesoOperacionItemDto,
    references: ReferenceContext,
  ) {
    if (operacion.centroCostoId) {
      return operacion.centroCostoId;
    }

    if (!operacion.maquinaId) {
      throw new BadRequestException(
        `La operacion ${operacion.nombre.trim()} requiere centro de costo o maquina con centro principal.`,
      );
    }

    const maquina = references.maquinasById.get(operacion.maquinaId);
    if (!maquina?.centroCostoPrincipalId) {
      throw new BadRequestException(
        `La maquina seleccionada para ${operacion.nombre.trim()} no tiene centro de costo principal configurado.`,
      );
    }

    return maquina.centroCostoPrincipalId;
  }

  private validateBusinessRules(
    payload: UpsertProcesoDto,
    references: ReferenceContext,
  ) {
    const operaciones = payload.operaciones ?? [];

    const operationOrders = new Set<number>();
    for (const [index, operacion] of operaciones.entries()) {
      if (!operacion.nombre?.trim()) {
        throw new BadRequestException(
          'Todas las operaciones requieren nombre.',
        );
      }

      const orden = operacion.orden ?? index + 1;
      if (operationOrders.has(orden)) {
        throw new BadRequestException(
          `El orden ${orden} esta repetido dentro del proceso.`,
        );
      }
      operationOrders.add(orden);
    }

    for (const operacion of operaciones) {
      this.validateOperacionNivelesBusinessRules(
        operacion.nombre.trim(),
        operacion.niveles ?? [],
        references,
      );

      if (!operacion.perfilOperativoId) {
        continue;
      }

      if (!operacion.maquinaId) {
        throw new BadRequestException(
          `La operacion ${operacion.nombre.trim()} no puede tener perfil operativo sin maquina asociada.`,
        );
      }

      const perfil = references.perfilesById.get(operacion.perfilOperativoId);
      if (!perfil) {
        throw new BadRequestException(
          `El perfil operativo seleccionado para ${operacion.nombre.trim()} no existe.`,
        );
      }

      if (perfil.maquinaId !== operacion.maquinaId) {
        throw new BadRequestException(
          `El perfil operativo de ${operacion.nombre.trim()} no pertenece a la maquina seleccionada.`,
        );
      }
    }

    for (const operacion of operaciones) {
      if (
        operacion.centroCostoId &&
        !references.centrosById.has(operacion.centroCostoId)
      ) {
        throw new BadRequestException(
          `El centro de costo de ${operacion.nombre.trim()} no existe.`,
        );
      }

      if (
        operacion.maquinaId &&
        !references.maquinasById.has(operacion.maquinaId)
      ) {
        throw new BadRequestException(
          `La maquina seleccionada para ${operacion.nombre.trim()} no existe.`,
        );
      }

      const modoProductividad = this.resolveModoProductividadFromPayload(
        operacion,
      );
      const derived = this.deriveOperationDefaultsFromPayload(
        operacion,
        references,
      );
      if (
        modoProductividad === ModoProductividadProceso.FIJA &&
        (!operacion.tiempoFijoMin || operacion.tiempoFijoMin <= 0)
      ) {
        throw new BadRequestException(
          `La operacion ${operacion.nombre.trim()} en modo fija requiere Tiempo fijo (min) mayor a 0.`,
        );
      }

      if (
        modoProductividad === ModoProductividadProceso.FORMULA &&
        (!derived.productividadBase || Number(derived.productividadBase) <= 0)
      ) {
        throw new BadRequestException(
          `La operacion ${operacion.nombre.trim()} en modo variable requiere Productividad base mayor a 0 (manual o desde perfil).`,
        );
      }

      this.validateBaseCalculoProductividad({
        operationName: operacion.nombre.trim(),
        baseCalculoProductividad: operacion.baseCalculoProductividad,
        unidadSalida: this.toApiEnum(derived.unidadSalida) as UnidadProcesoDto,
      });

      const centroRef = this.getCentroRefForOperacionPayload(
        operacion,
        references,
      );
      if (centroRef) {
        const unidadError = this.getCentroUnidadCompatibilityErrorForPayload(
          {
            unidadEntrada: this.toPrismaEnum<UnidadProceso>(
              operacion.unidadEntrada ?? UnidadProcesoDto.ninguna,
            ),
            unidadSalida: derived.unidadSalida,
            unidadTiempo: derived.unidadTiempo,
          },
          centroRef,
        );
        if (unidadError) {
          throw new BadRequestException(unidadError);
        }
      }
    }
  }

  private async resolveReferenceContext(
    auth: CurrentAuth,
    payload: UpsertProcesoDto,
  ): Promise<ReferenceContext> {
    const operaciones = payload.operaciones ?? [];

    const centerIds = Array.from(
      new Set(
        operaciones
          .map((operacion) => operacion.centroCostoId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const machineIds = Array.from(
      new Set(
        operaciones
          .flatMap((operacion) => [
            operacion.maquinaId,
            ...(operacion.niveles ?? []).map((nivel) => nivel.maquinaId),
          ])
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const perfilIds = Array.from(
      new Set(
        operaciones
          .flatMap((operacion) => [
            operacion.perfilOperativoId,
            ...(operacion.niveles ?? []).map((nivel) => nivel.perfilOperativoId),
          ])
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const [centros, maquinas, perfiles] = await Promise.all([
      centerIds.length
        ? this.prisma.centroCosto.findMany({
            where: {
              tenantId: auth.tenantId,
              id: { in: centerIds },
            },
            select: {
              id: true,
              nombre: true,
              unidadBaseFutura: true,
            },
          })
        : Promise.resolve([] as CentroRef[]),
      machineIds.length
        ? this.prisma.maquina.findMany({
            where: {
              tenantId: auth.tenantId,
              id: { in: machineIds },
            },
            select: {
              id: true,
              nombre: true,
              plantilla: true,
              centroCostoPrincipalId: true,
              unidadProduccionPrincipal: true,
            },
          })
        : Promise.resolve([] as MaquinaRef[]),
      perfilIds.length
        ? this.prisma.maquinaPerfilOperativo.findMany({
            where: {
              tenantId: auth.tenantId,
              id: { in: perfilIds },
            },
            select: {
              id: true,
              nombre: true,
              maquinaId: true,
              productivityValue: true,
              productivityUnit: true,
              setupMin: true,
              cleanupMin: true,
              detalleJson: true,
            },
          })
        : Promise.resolve([] as PerfilRef[]),
    ]);

    const centroPrincipalIds = Array.from(
      new Set(
        maquinas
          .map((maquina) => maquina.centroCostoPrincipalId)
          .filter((value): value is string => Boolean(value)),
      ),
    ).filter((id) => !centros.some((centro) => centro.id === id));

    const centrosPrincipales = centroPrincipalIds.length
      ? await this.prisma.centroCosto.findMany({
          where: {
            tenantId: auth.tenantId,
            id: { in: centroPrincipalIds },
          },
          select: {
            id: true,
            nombre: true,
            unidadBaseFutura: true,
          },
        })
      : ([] as CentroRef[]);

    const centrosConsolidados = [...centros, ...centrosPrincipales];

    if (centros.length !== centerIds.length) {
      throw new BadRequestException(
        'Al menos un centro de costo asociado al proceso no existe.',
      );
    }

    if (maquinas.length !== machineIds.length) {
      throw new BadRequestException(
        'Al menos una maquina asociada al proceso no existe.',
      );
    }

    if (perfiles.length !== perfilIds.length) {
      throw new BadRequestException(
        'Al menos un perfil operativo asociado al proceso no existe.',
      );
    }
    return {
      centrosById: new Map(
        centrosConsolidados.map((centro) => [centro.id, centro]),
      ),
      maquinasById: new Map(maquinas.map((maquina) => [maquina.id, maquina])),
      perfilesById: new Map(perfiles.map((perfil) => [perfil.id, perfil])),
    };
  }

  private async findBibliotecaOperacionOrThrow(
    auth: CurrentAuth,
    id: string,
  ) {
    const item = await this.prisma.procesoOperacionPlantilla.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      include: {
        centroCosto: true,
        maquina: true,
        perfilOperativo: true,
        estacion: true,
      },
    });

    if (!item) {
      throw new NotFoundException('La plantilla de operacion no existe.');
    }

    return item;
  }

  private async resolveBibliotecaOperacionReferences(
    auth: CurrentAuth,
    payload: UpsertProcesoOperacionPlantillaDto,
  ) {
    const resolveCentro = async (centroCostoId?: string) => {
      if (!centroCostoId) {
        return null;
      }

      const centro = await this.prisma.centroCosto.findFirst({
        where: {
          id: centroCostoId,
          tenantId: auth.tenantId,
        },
        select: {
          id: true,
        },
      });

      if (!centro) {
        throw new BadRequestException(
          'El centro de costo seleccionado no existe para este tenant.',
        );
      }

      return centro.id;
    };

    const resolveEstacion = async (estacionId?: string) => {
      if (!estacionId) {
        return null;
      }

      const estacion = await this.prisma.estacion.findFirst({
        where: {
          id: estacionId,
          tenantId: auth.tenantId,
        },
        select: { id: true },
      });

      if (!estacion) {
        throw new BadRequestException(
          'La estacion seleccionada no existe para este tenant.',
        );
      }

      return estacion.id;
    };

    const estacionId = await resolveEstacion(payload.estacionId);

    if (!payload.maquinaId) {
      const centroCostoId = await resolveCentro(payload.centroCostoId);
      return {
        centroCostoId,
        maquinaId: null,
        perfilOperativoId: null,
        estacionId,
      };
    }

    const maquina = await this.prisma.maquina.findFirst({
      where: {
        id: payload.maquinaId,
        tenantId: auth.tenantId,
      },
      select: {
        id: true,
        centroCostoPrincipalId: true,
      },
    });

    if (!maquina) {
      throw new BadRequestException(
        'La maquina seleccionada no existe para este tenant.',
      );
    }

    const centroCostoId = maquina.centroCostoPrincipalId
      ? maquina.centroCostoPrincipalId
      : await resolveCentro(payload.centroCostoId);

    if (!payload.perfilOperativoId) {
      return {
        centroCostoId,
        maquinaId: payload.maquinaId,
        perfilOperativoId: null,
        estacionId,
      };
    }

    const perfil = await this.prisma.maquinaPerfilOperativo.findFirst({
      where: {
        id: payload.perfilOperativoId,
        maquinaId: payload.maquinaId,
        tenantId: auth.tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!perfil) {
      throw new BadRequestException(
        'El perfil operativo no existe o no pertenece a la maquina seleccionada.',
      );
    }

    return {
      centroCostoId,
      maquinaId: payload.maquinaId,
      perfilOperativoId: payload.perfilOperativoId,
      estacionId,
    };
  }

  private validateOperacionNivelesPayload(
    niveles: Array<{
      nombre?: string;
      modoProductividadNivel?: string;
      tiempoFijoMin?: number;
      productividadBase?: number;
      unidadSalida?: string;
      unidadTiempo?: string;
      maquinaId?: string;
      perfilOperativoId?: string;
      setupMin?: number;
      cleanupMin?: number;
    }>,
    operationName: string,
  ) {
    for (const nivel of niveles) {
      const nombre = nivel.nombre?.trim();
      if (!nombre) {
        throw new BadRequestException(`Todos los niveles de ${operationName} requieren nombre.`);
      }
      const modo =
        nivel.modoProductividadNivel === 'variable_manual' ||
        nivel.modoProductividadNivel === 'variable_perfil'
          ? nivel.modoProductividadNivel
          : 'fija';
      if (nivel.setupMin !== undefined && nivel.setupMin < 0) {
        throw new BadRequestException(`El setup del nivel ${nombre} no puede ser negativo.`);
      }
      if (nivel.cleanupMin !== undefined && nivel.cleanupMin < 0) {
        throw new BadRequestException(`El cleanup del nivel ${nombre} no puede ser negativo.`);
      }
      if (modo === 'fija') {
        if (nivel.tiempoFijoMin === undefined || Number(nivel.tiempoFijoMin) <= 0) {
          throw new BadRequestException(`El nivel ${nombre} debe definir Tiempo total (min).`);
        }
        if (nivel.maquinaId || nivel.perfilOperativoId) {
          throw new BadRequestException(`El nivel ${nombre} en modo fija no puede usar máquina ni perfil.`);
        }
      }
      if (modo === 'variable_manual') {
        if (nivel.productividadBase === undefined || Number(nivel.productividadBase) <= 0) {
          throw new BadRequestException(`El nivel ${nombre} debe definir Valor productividad.`);
        }
        if (!nivel.unidadSalida || !nivel.unidadTiempo) {
          throw new BadRequestException(`El nivel ${nombre} debe definir Unidad de productividad.`);
        }
        if (nivel.maquinaId || nivel.perfilOperativoId) {
          throw new BadRequestException(`El nivel ${nombre} en modo variable manual no puede usar máquina ni perfil.`);
        }
      }
      if (modo === 'variable_perfil') {
        if (!nivel.maquinaId || !nivel.perfilOperativoId) {
          throw new BadRequestException(`El nivel ${nombre} debe definir máquina y perfil operativo.`);
        }
      }
    }
  }

  private validateOperacionNivelesBusinessRules(
    operationName: string,
    niveles: Array<{
      nombre?: string;
      maquinaId?: string;
      perfilOperativoId?: string;
      modoProductividadNivel?: string;
    }>,
    references: ReferenceContext,
  ) {
    for (const nivel of niveles) {
      const modo =
        nivel.modoProductividadNivel === 'variable_manual' ||
        nivel.modoProductividadNivel === 'variable_perfil'
          ? nivel.modoProductividadNivel
          : 'fija';
      if (modo !== 'variable_perfil') {
        continue;
      }
      const nivelNombre = nivel.nombre?.trim() || 'sin nombre';
      const maquina = nivel.maquinaId ? references.maquinasById.get(nivel.maquinaId) : null;
      if (!maquina) {
        throw new BadRequestException(`La máquina del nivel ${nivelNombre} (${operationName}) no existe.`);
      }
      const perfil = nivel.perfilOperativoId
        ? references.perfilesById.get(nivel.perfilOperativoId)
        : null;
      if (!perfil) {
        throw new BadRequestException(`El perfil operativo del nivel ${nivelNombre} (${operationName}) no existe.`);
      }
      if (perfil.maquinaId !== maquina.id) {
        throw new BadRequestException(`El perfil operativo del nivel ${nivelNombre} (${operationName}) no pertenece a la máquina seleccionada.`);
      }
    }
  }

  private async validateBibliotecaOperacionNivelReferences(
    auth: CurrentAuth,
    niveles: Array<{
      nombre?: string;
      maquinaId?: string;
      perfilOperativoId?: string;
      modoProductividadNivel?: string;
    }>,
  ) {
    const machineIds = Array.from(
      new Set(
        niveles
          .filter((nivel) => nivel.modoProductividadNivel === 'variable_perfil')
          .map((nivel) => nivel.maquinaId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const perfilIds = Array.from(
      new Set(
        niveles
          .filter((nivel) => nivel.modoProductividadNivel === 'variable_perfil')
          .map((nivel) => nivel.perfilOperativoId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    if (!machineIds.length && !perfilIds.length) {
      return;
    }
    const [maquinas, perfiles] = await Promise.all([
      machineIds.length
        ? this.prisma.maquina.findMany({
            where: { tenantId: auth.tenantId, id: { in: machineIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
      perfilIds.length
        ? this.prisma.maquinaPerfilOperativo.findMany({
            where: { tenantId: auth.tenantId, id: { in: perfilIds } },
            select: { id: true, maquinaId: true },
          })
        : Promise.resolve([]),
    ]);
    const machineSet = new Set(maquinas.map((item) => item.id));
    const perfilesMap = new Map(perfiles.map((item) => [item.id, item.maquinaId]));
    for (const nivel of niveles) {
      if (nivel.modoProductividadNivel !== 'variable_perfil') {
        continue;
      }
      const nivelNombre = nivel.nombre?.trim() || 'sin nombre';
      if (!nivel.maquinaId || !machineSet.has(nivel.maquinaId)) {
        throw new BadRequestException(`La máquina del nivel ${nivelNombre} no existe para este tenant.`);
      }
      const perfilMaquinaId = nivel.perfilOperativoId ? perfilesMap.get(nivel.perfilOperativoId) : null;
      if (!perfilMaquinaId) {
        throw new BadRequestException(`El perfil operativo del nivel ${nivelNombre} no existe para este tenant.`);
      }
      if (perfilMaquinaId !== nivel.maquinaId) {
        throw new BadRequestException(`El perfil operativo del nivel ${nivelNombre} no pertenece a la máquina seleccionada.`);
      }
    }
  }

  private buildNivelResumen(input: {
    nombre: string;
    modoProductividadNivel: 'fija' | 'variable_manual' | 'variable_perfil';
    tiempoFijoMin: number | null;
    productividadBase: number | null;
    unidadSalida: string | null;
    unidadTiempo: string | null;
    perfilOperativoNombre: string;
  }) {
    if (input.modoProductividadNivel === 'fija') {
      return `${input.nombre} · Fija · ${input.tiempoFijoMin ?? 0} min`;
    }
    if (input.modoProductividadNivel === 'variable_manual') {
      const unidad = [input.unidadSalida, input.unidadTiempo].filter(Boolean).join('/');
      return `${input.nombre} · Variable manual · ${input.productividadBase ?? 0} ${unidad}`.trim();
    }
    return `${input.nombre} · Variable por perfil${input.perfilOperativoNombre ? ` · ${input.perfilOperativoNombre}` : ''}`;
  }

  private async findProcesoOrThrow(auth: CurrentAuth, id: string) {
    const proceso = await this.prisma.procesoDefinicion.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      include: {
        operaciones: {
          include: {
            centroCosto: true,
            maquina: true,
            perfilOperativo: true,
          },
          orderBy: {
            orden: 'asc',
          },
        },
      },
    });

    if (!proceso) {
      throw new NotFoundException('El proceso no existe.');
    }

    return proceso;
  }

  private async findProcesoBaseOrThrow(auth: CurrentAuth, id: string) {
    const proceso = await this.prisma.procesoDefinicion.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      select: {
        id: true,
        codigo: true,
        activo: true,
        currentVersion: true,
      },
    });

    if (!proceso) {
      throw new NotFoundException('El proceso no existe.');
    }

    return proceso;
  }

  private toProcesoResponse(proceso: ProcesoCompleto) {
    return {
      id: proceso.id,
      codigo: proceso.codigo,
      nombre: proceso.nombre,
      descripcion: proceso.descripcion ?? '',
      plantillaMaquinaria: proceso.plantillaMaquinaria
        ? (this.toApiEnum(
            proceso.plantillaMaquinaria,
          ) as PlantillaMaquinariaDto)
        : null,
      currentVersion: proceso.currentVersion,
      estadoConfiguracion: this.toApiEnum(
        proceso.estadoConfiguracion,
      ) as EstadoConfiguracionProcesoDto,
      activo: proceso.activo,
      observaciones: proceso.observaciones ?? '',
      advertencias: this.getProcessWarnings(proceso),
      operaciones: proceso.operaciones.map((operacion) => ({
        id: operacion.id,
        orden: operacion.orden,
        codigo: operacion.codigo,
        nombre: operacion.nombre,
        tipoOperacion: this.fromPrismaTipoOperacion(operacion.tipoOperacion),
        centroCostoId: operacion.centroCostoId,
        centroCostoNombre: operacion.centroCosto.nombre,
        maquinaId: operacion.maquinaId ?? '',
        maquinaNombre: operacion.maquina?.nombre ?? '',
        perfilOperativoId: operacion.perfilOperativoId ?? '',
        perfilOperativoNombre: operacion.perfilOperativo?.nombre ?? '',
        setupMin: this.decimalToNumberOrNull(operacion.setupMin),
        runMin: this.decimalToNumberOrNull(operacion.runMin),
        cleanupMin: this.decimalToNumberOrNull(operacion.cleanupMin),
        tiempoFijoMin: this.decimalToNumberOrNull(operacion.tiempoFijoMin),
        multiplicadorDobleFaz: this.decimalToNumberOrNull(operacion.multiplicadorDobleFaz),
        modoProductividad: this.toApiModoProductividad(
          operacion.modoProductividad,
        ),
        productividadBase: this.decimalToNumberOrNull(
          operacion.productividadBase,
        ),
        unidadEntrada: this.toApiEnum(
          operacion.unidadEntrada,
        ) as UnidadProcesoDto,
        unidadSalida: this.toApiEnum(
          operacion.unidadSalida,
        ) as UnidadProcesoDto,
        unidadTiempo: this.toApiEnum(
          operacion.unidadTiempo,
        ) as UnidadProcesoDto,
        mermaSetup: this.decimalToNumberOrNull(operacion.mermaSetup),
        mermaRunPct: this.decimalToNumberOrNull(operacion.mermaRunPct),
        reglaVelocidad:
          (operacion.reglaVelocidadJson as Record<string, unknown> | null) ??
          null,
        reglaMerma:
          (operacion.reglaMermaJson as Record<string, unknown> | null) ?? null,
        detalle: this.getOperacionDetalle(operacion.detalleJson),
        baseCalculoProductividad:
          this.getOperacionDetalle(operacion.detalleJson)?.baseCalculoProductividad ??
          null,
        niveles: this.getOperacionNiveles(operacion.detalleJson),
        activo: operacion.activo,
        warnings: this.getOperationWarnings(operacion),
      })),
      createdAt: proceso.createdAt.toISOString(),
      updatedAt: proceso.updatedAt.toISOString(),
    };
  }

  private toBibliotecaOperacionResponse(item: ProcesoOperacionPlantillaEntity) {
    const detalleJson =
      (item as ProcesoOperacionPlantillaEntity & {
        detalleJson?: Prisma.JsonValue | null;
      }).detalleJson ?? null;
    return {
      id: item.id,
      nombre: item.nombre,
      tipoOperacion: this.fromPrismaTipoOperacion(item.tipoOperacion),
      centroCostoId: item.centroCostoId ?? null,
      centroCostoNombre: item.centroCosto?.nombre ?? '',
      maquinaId: item.maquinaId ?? null,
      maquinaNombre: item.maquina?.nombre ?? '',
      maquinaPlantilla: item.maquina?.plantilla ?? null,
      perfilOperativoId: item.perfilOperativoId ?? null,
      perfilOperativoNombre: item.perfilOperativo?.nombre ?? '',
      setupMin: this.decimalToNumberOrNull(item.setupMin),
      cleanupMin: this.decimalToNumberOrNull(item.cleanupMin),
      tiempoFijoMin: this.decimalToNumberOrNull(item.tiempoFijoMin),
      modoProductividad: this.toApiModoProductividad(item.modoProductividad),
      productividadBase: this.decimalToNumberOrNull(item.productividadBase),
      unidadEntrada: this.toApiEnum(item.unidadEntrada) as UnidadProcesoDto,
      unidadSalida: this.toApiEnum(item.unidadSalida) as UnidadProcesoDto,
      unidadTiempo: this.toApiEnum(item.unidadTiempo) as UnidadProcesoDto,
      mermaRunPct: this.decimalToNumberOrNull(item.mermaRunPct),
      reglaVelocidad:
        (item.reglaVelocidadJson as Record<string, unknown> | null) ?? null,
      reglaMerma: (item.reglaMermaJson as Record<string, unknown> | null) ?? null,
      detalle: this.getOperacionDetalle(detalleJson),
      baseCalculoProductividad:
        this.getOperacionDetalle(detalleJson)?.baseCalculoProductividad ?? null,
      observaciones: item.observaciones ?? '',
      niveles: this.getOperacionNiveles(detalleJson),
      estacionId: item.estacionId ?? null,
      estacionNombre: item.estacion?.nombre ?? '',
      activo: item.activo,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private getCentroRefForOperacionPayload(
    operacion: ProcesoOperacionItemDto,
    references: ReferenceContext,
  ) {
    if (operacion.centroCostoId) {
      return references.centrosById.get(operacion.centroCostoId) ?? null;
    }

    if (!operacion.maquinaId) {
      return null;
    }

    const maquina = references.maquinasById.get(operacion.maquinaId);
    if (!maquina?.centroCostoPrincipalId) {
      return null;
    }

    return references.centrosById.get(maquina.centroCostoPrincipalId) ?? null;
  }

  private getCentroUnidadCompatibilityErrorForPayload(
    unidades: {
      unidadEntrada: UnidadProceso;
      unidadSalida: UnidadProceso;
      unidadTiempo: UnidadProceso;
    },
    centro: CentroRef,
  ) {
    return this.getCentroUnidadCompatibilityMessage({
      centroNombre: centro.nombre,
      unidadBaseCentro: centro.unidadBaseFutura,
      unidadEntrada: unidades.unidadEntrada,
      unidadSalida: unidades.unidadSalida,
      unidadTiempo: unidades.unidadTiempo,
      mode: 'error',
    });
  }

  private getCentroUnidadCompatibilityWarning(
    operacion: ProcesoCompleto['operaciones'][number],
  ) {
    return this.getCentroUnidadCompatibilityMessage({
      centroNombre: operacion.centroCosto.nombre,
      unidadBaseCentro: operacion.centroCosto.unidadBaseFutura,
      unidadEntrada: operacion.unidadEntrada,
      unidadSalida: operacion.unidadSalida,
      unidadTiempo: operacion.unidadTiempo,
      mode: 'warning',
    });
  }

  private getCentroUnidadCompatibilityMessage(args: {
    centroNombre: string;
    unidadBaseCentro: UnidadBaseCentroCosto;
    unidadEntrada: UnidadProceso;
    unidadSalida: UnidadProceso;
    unidadTiempo: UnidadProceso;
    mode: 'error' | 'warning';
  }) {
    if (args.unidadBaseCentro === UnidadBaseCentroCosto.NINGUNA) {
      return null;
    }

    const unidadesProceso = [args.unidadEntrada, args.unidadSalida];
    const hasUnidad = (allowed: UnidadProceso[]) =>
      unidadesProceso.some((item) => allowed.includes(item));

    let isCompatible = true;

    if (
      args.unidadBaseCentro === UnidadBaseCentroCosto.HORA_HOMBRE ||
      args.unidadBaseCentro === UnidadBaseCentroCosto.HORA_MAQUINA
    ) {
      isCompatible =
        args.unidadTiempo === UnidadProceso.HORA ||
        args.unidadTiempo === UnidadProceso.MINUTO;
    } else if (args.unidadBaseCentro === UnidadBaseCentroCosto.PLIEGO) {
      isCompatible = hasUnidad([UnidadProceso.HOJA, UnidadProceso.A4_EQUIV]);
    } else if (args.unidadBaseCentro === UnidadBaseCentroCosto.UNIDAD) {
      isCompatible = hasUnidad([
        UnidadProceso.UNIDAD,
        UnidadProceso.PIEZA,
        UnidadProceso.CORTE,
        UnidadProceso.LOTE,
        UnidadProceso.CICLO,
      ]);
    } else if (args.unidadBaseCentro === UnidadBaseCentroCosto.M2) {
      isCompatible = hasUnidad([UnidadProceso.M2]);
    } else if (args.unidadBaseCentro === UnidadBaseCentroCosto.KG) {
      isCompatible = hasUnidad([UnidadProceso.KG]);
    }

    if (isCompatible) {
      return null;
    }

    if (args.mode === 'error') {
      return `La unidad del centro ${args.centroNombre} no es compatible con la unidad de la operacion.`;
    }

    return `Advertencia: la unidad del centro ${args.centroNombre} no coincide con la unidad operativa configurada.`;
  }

  private getOperationWarnings(
    operacion: ProcesoCompleto['operaciones'][number],
  ) {
    const warnings: string[] = [];

    if (
      operacion.maquina?.centroCostoPrincipalId &&
      operacion.maquina.centroCostoPrincipalId !== operacion.centroCostoId
    ) {
      warnings.push(
        `La maquina ${operacion.maquina.nombre} tiene otro centro principal; se usa el centro configurado en la operacion.`,
      );
    }

    const unitWarning = this.getCentroUnidadCompatibilityWarning(operacion);
    if (unitWarning) {
      warnings.push(unitWarning);
    }

    return warnings;
  }

  private getProcessWarnings(proceso: ProcesoCompleto) {
    return Array.from(
      new Set(
        proceso.operaciones.flatMap((operacion) =>
          this.getOperationWarnings(operacion),
        ),
      ),
    );
  }

  private toVersionSnapshot(proceso: ProcesoCompleto): Prisma.InputJsonObject {
    return {
      proceso: {
        id: proceso.id,
        codigo: proceso.codigo,
        nombre: proceso.nombre,
        descripcion: proceso.descripcion,
        plantillaMaquinaria: proceso.plantillaMaquinaria,
        currentVersion: proceso.currentVersion,
        estadoConfiguracion: proceso.estadoConfiguracion,
        activo: proceso.activo,
        observaciones: proceso.observaciones,
      },
      operaciones: proceso.operaciones.map((operacion) => ({
        id: operacion.id,
        orden: operacion.orden,
        codigo: operacion.codigo,
        nombre: operacion.nombre,
        tipoOperacion: this.fromPrismaTipoOperacion(operacion.tipoOperacion),
        centroCostoId: operacion.centroCostoId,
        maquinaId: operacion.maquinaId,
        perfilOperativoId: operacion.perfilOperativoId,
        setupMin: this.decimalToNumberOrNull(operacion.setupMin),
        runMin: this.decimalToNumberOrNull(operacion.runMin),
        cleanupMin: this.decimalToNumberOrNull(operacion.cleanupMin),
        tiempoFijoMin: this.decimalToNumberOrNull(operacion.tiempoFijoMin),
        multiplicadorDobleFaz: this.decimalToNumberOrNull(operacion.multiplicadorDobleFaz),
        modoProductividad: operacion.modoProductividad,
        productividadBase: this.decimalToNumberOrNull(
          operacion.productividadBase,
        ),
        unidadEntrada: operacion.unidadEntrada,
        unidadSalida: operacion.unidadSalida,
        unidadTiempo: operacion.unidadTiempo,
        mermaSetup: this.decimalToNumberOrNull(operacion.mermaSetup),
        mermaRunPct: this.decimalToNumberOrNull(operacion.mermaRunPct),
        reglaVelocidadJson: operacion.reglaVelocidadJson,
        reglaMermaJson: operacion.reglaMermaJson,
        detalleJson: operacion.detalleJson,
        activo: operacion.activo,
      })),
      createdAt: new Date().toISOString(),
    };
  }

  private handleWriteError(error: unknown): never {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Ya existe un proceso con ese codigo.');
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

    throw error;
  }

  private handleBibliotecaWriteError(error: unknown): never {
    if (this.isBibliotecaStorageMissingError(error)) {
      throw new BadRequestException(
        'La base actual no tiene la estructura de Biblioteca de operaciones. Ejecuta las migraciones pendientes del API.',
      );
    }

    this.handleWriteError(error);
  }

  private isBibliotecaStorageMissingError(error: unknown) {
    return (
      error instanceof PrismaClientKnownRequestError &&
      (error.code === 'P2021' || error.code === 'P2022')
    );
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

  private generateCodigoProceso() {
    const randomChunk = randomUUID()
      .replace(/-/g, '')
      .slice(0, 8)
      .toUpperCase();
    return `${ProcesosService.CODIGO_PREFIX}-${randomChunk}`;
  }

  private normalizePeriodo(periodo?: string) {
    if (!periodo || !DEFAULT_PERIOD_REGEX.test(periodo)) {
      throw new BadRequestException('El periodo debe tener formato YYYY-MM.');
    }

    return periodo;
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

  private decimalToNumber(value?: Prisma.Decimal | null) {
    return value === null || value === undefined ? 0 : Number(value);
  }

  private decimalToNumberOrNull(value?: Prisma.Decimal | null) {
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

  private toApiModoProductividad(
    value: ModoProductividadProceso,
  ): ModoProductividadProcesoDto {
    if (value === ModoProductividadProceso.FIJA) {
      return ModoProductividadProcesoDto.fija;
    }
    return ModoProductividadProcesoDto.variable;
  }

  private parseFiniteNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }
}
