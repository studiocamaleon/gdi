import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EstadoTarifaCentroCostoPeriodo,
  Prisma,
  TipoRecursoCentroCosto,
  UnidadBaseCentroCosto,
} from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CostosCatalogoService } from './costos-catalogo.service';
import { CostosMapper } from './costos.mapper';
import { CostosRepartoService } from './costos-reparto.service';
import { CostosTarifasService } from './costos-tarifas.service';
import { CostosValidacionesService } from './costos-validaciones.service';
import { ReplaceCentroComponentesCostoDto } from './dto/replace-centro-componentes-costo.dto';
import {
  ReplaceCentroRecursosDto,
  TipoRecursoCentroCostoDto,
} from './dto/replace-centro-recursos.dto';
import { UpsertCentroCapacidadDto } from './dto/upsert-centro-capacidad.dto';
import { UpsertCentroConfiguracionBaseDto } from './dto/upsert-centro-configuracion-base.dto';
import { UpsertCentroConfiguracionPeriodoDto } from './dto/upsert-centro-configuracion-periodo.dto';
import { UpsertCentroRecursosMaquinariaDto } from './dto/upsert-centro-recursos-maquinaria.dto';

@Injectable()
export class CostosConfiguracionPeriodoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: CostosMapper,
    private readonly validaciones: CostosValidacionesService,
    private readonly reparto: CostosRepartoService,
    private readonly tarifas: CostosTarifasService,
    private readonly catalogo: CostosCatalogoService,
  ) {}

  async getCentroConfiguracion(auth: CurrentAuth, id: string, periodo: string) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    const [centro, empleadosDisponibilidad, repartoPeriodo] = await Promise.all(
      [
        this.tarifas.getCentroConfiguracionEntity(auth, id, normalizedPeriodo),
        this.buildEmpleadosDisponibilidad(auth, normalizedPeriodo, id),
        this.reparto.computeRepartoPeriodo(auth, normalizedPeriodo),
      ],
    );
    const tarifaBorrador =
      centro.tarifasPeriodo.find(
        (tarifa) => tarifa.estado === EstadoTarifaCentroCostoPeriodo.BORRADOR,
      ) ?? null;
    const tarifaPublicada =
      centro.tarifasPeriodo.find(
        (tarifa) => tarifa.estado === EstadoTarifaCentroCostoPeriodo.PUBLICADA,
      ) ?? null;

    return {
      periodo: normalizedPeriodo,
      centro: this.mapper.toCentroResponse(centro),
      recursos: centro.recursos.map((recurso) =>
        this.mapper.toRecursoResponse(recurso),
      ),
      recursosMaquinaria: centro.recursos
        .filter(
          (recurso) =>
            recurso.tipoRecurso === TipoRecursoCentroCosto.MAQUINARIA &&
            Boolean(recurso.maquinaId),
        )
        .map((recurso) =>
          this.mapper.toRecursoMaquinariaResponse(
            recurso.maquinariaPeriodo[0],
            recurso,
          ),
        )
        .filter((item) => Boolean(item)),
      componentesCosto: centro.componentesCostoPeriodo.map((componente) =>
        this.mapper.toComponenteCostoResponse(componente),
      ),
      capacidad: centro.capacidadesPeriodo[0]
        ? this.mapper.toCapacidadResponse(centro.capacidadesPeriodo[0])
        : null,
      tarifaBorrador: tarifaBorrador
        ? this.mapper.toTarifaResponse(tarifaBorrador)
        : null,
      tarifaPublicada: tarifaPublicada
        ? this.mapper.toTarifaResponse(tarifaPublicada)
        : null,
      advertencias: this.tarifas.buildAdvertencias(
        centro,
        normalizedPeriodo,
        repartoPeriodo.absorbidoByCentroId.get(id),
      ),
      empleadosDisponibilidad,
    };
  }

  updateCentroConfiguracionBase(
    auth: CurrentAuth,
    id: string,
    payload: UpsertCentroConfiguracionBaseDto,
  ) {
    return this.catalogo.updateCentro(auth, id, payload);
  }

  async upsertCentroConfiguracionPeriodo(
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: UpsertCentroConfiguracionPeriodoDto,
  ) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    await this.validaciones.findCentroOrThrow(auth, id);
    await this.validaciones.validateCentroReferences(auth, payload.centro);
    await this.validaciones.validateRecursos(
      auth,
      id,
      normalizedPeriodo,
      payload.recursos.recursos,
    );

    await this.prisma.$transaction(async (tx) => {
      const centro = await tx.centroCosto.update({
        where: { id },
        data: this.mapper.buildUpdateCentroData(payload.centro),
      });

      const recursos = await this.replaceCentroRecursosInTx(
        tx,
        auth,
        id,
        normalizedPeriodo,
        payload.recursos,
      );
      await this.upsertCentroRecursosMaquinariaInTx(
        tx,
        auth,
        normalizedPeriodo,
        recursos,
        payload.recursosMaquinaria,
      );
      await this.replaceCentroComponentesCostoInTx(
        tx,
        auth,
        id,
        normalizedPeriodo,
        payload.componentesCosto,
      );

      const recursosConMaquinaria = await tx.centroCostoRecurso.findMany({
        where: {
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo: normalizedPeriodo,
          activo: true,
        },
        include: {
          maquinariaPeriodo: {
            where: { periodo: normalizedPeriodo },
            orderBy: [{ createdAt: 'desc' }],
            take: 1,
          },
        },
      });
      const capacidad = this.computeCapacidad(
        payload.capacidad,
        centro.unidadBaseFutura,
        recursosConMaquinaria,
      );

      await tx.centroCostoCapacidadPeriodo.upsert({
        where: {
          tenantId_centroCostoId_periodo: {
            tenantId: auth.tenantId,
            centroCostoId: id,
            periodo: normalizedPeriodo,
          },
        },
        create: {
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo: normalizedPeriodo,
          unidadBase: centro.unidadBaseFutura,
          diasPorMes: capacidad.diasPorMes,
          horasPorDia: capacidad.horasPorDia,
          porcentajeNoProductivo: new Prisma.Decimal(0),
          capacidadTeorica: capacidad.capacidadTeorica,
          capacidadPractica: capacidad.capacidadPractica,
          overrideManualCapacidad: capacidad.overrideManualCapacidad,
        },
        update: {
          unidadBase: centro.unidadBaseFutura,
          diasPorMes: capacidad.diasPorMes,
          horasPorDia: capacidad.horasPorDia,
          porcentajeNoProductivo: new Prisma.Decimal(0),
          capacidadTeorica: capacidad.capacidadTeorica,
          capacidadPractica: capacidad.capacidadPractica,
          overrideManualCapacidad: capacidad.overrideManualCapacidad,
        },
      });
    });

    return this.getCentroConfiguracion(auth, id, normalizedPeriodo);
  }

  async replaceCentroRecursos(
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: ReplaceCentroRecursosDto,
  ) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    await this.validaciones.findCentroOrThrow(auth, id);
    await this.validaciones.validateRecursos(
      auth,
      id,
      normalizedPeriodo,
      payload.recursos,
    );

    const recursos = await this.prisma.$transaction(async (tx) => {
      return this.replaceCentroRecursosInTx(
        tx,
        auth,
        id,
        normalizedPeriodo,
        payload,
      );
    });

    return recursos.map((recurso) => this.mapper.toRecursoResponse(recurso));
  }

  async getCentroRecursosMaquinaria(
    auth: CurrentAuth,
    id: string,
    periodo: string,
  ) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    await this.validaciones.findCentroOrThrow(auth, id);

    const recursos = await this.prisma.centroCostoRecurso.findMany({
      where: {
        tenantId: auth.tenantId,
        centroCostoId: id,
        periodo: normalizedPeriodo,
        tipoRecurso: TipoRecursoCentroCosto.MAQUINARIA,
        maquinaId: { not: null },
      },
      include: {
        maquina: true,
        maquinariaPeriodo: {
          where: { periodo: normalizedPeriodo },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return recursos
      .map((recurso) =>
        this.mapper.toRecursoMaquinariaResponse(
          recurso.maquinariaPeriodo[0],
          recurso,
        ),
      )
      .filter((item) => Boolean(item));
  }

  async upsertCentroRecursosMaquinaria(
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: UpsertCentroRecursosMaquinariaDto,
  ) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    await this.validaciones.findCentroOrThrow(auth, id);

    const recursos = await this.prisma.centroCostoRecurso.findMany({
      where: {
        tenantId: auth.tenantId,
        centroCostoId: id,
        periodo: normalizedPeriodo,
        tipoRecurso: TipoRecursoCentroCosto.MAQUINARIA,
      },
      include: {
        maquina: true,
      },
    });
    const recursoById = new Map(recursos.map((item) => [item.id, item]));

    for (const item of payload.recursos) {
      const recurso = recursoById.get(item.centroCostoRecursoId);
      if (!recurso) {
        throw new BadRequestException(
          'Uno de los recursos de maquinaria no pertenece al centro/período seleccionado.',
        );
      }

      if (!recurso.maquinaId) {
        throw new BadRequestException(
          'El recurso de maquinaria debe tener una máquina vinculada antes de cargar costeo.',
        );
      }
    }

    await this.prisma.$transaction((tx) =>
      this.upsertCentroRecursosMaquinariaInTx(
        tx,
        auth,
        normalizedPeriodo,
        recursos,
        payload,
      ),
    );

    return this.getCentroRecursosMaquinaria(auth, id, normalizedPeriodo);
  }

  async replaceCentroComponentesCosto(
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: ReplaceCentroComponentesCostoDto,
  ) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    await this.validaciones.findCentroOrThrow(auth, id);

    const componentes = await this.prisma.$transaction(async (tx) => {
      return this.replaceCentroComponentesCostoInTx(
        tx,
        auth,
        id,
        normalizedPeriodo,
        payload,
      );
    });

    return componentes.map((componente) =>
      this.mapper.toComponenteCostoResponse(componente),
    );
  }

  async upsertCentroCapacidad(
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: UpsertCentroCapacidadDto,
  ) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    const centro = await this.validaciones.findCentroOrThrow(auth, id);
    const recursos = await this.prisma.centroCostoRecurso.findMany({
      where: {
        tenantId: auth.tenantId,
        centroCostoId: id,
        periodo: normalizedPeriodo,
        activo: true,
      },
      include: {
        maquinariaPeriodo: {
          where: { periodo: normalizedPeriodo },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
        },
      },
    });
    const capacidad = this.computeCapacidad(
      payload,
      centro.unidadBaseFutura,
      recursos,
    );

    const result = await this.prisma.centroCostoCapacidadPeriodo.upsert({
      where: {
        tenantId_centroCostoId_periodo: {
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo: normalizedPeriodo,
        },
      },
      create: {
        tenantId: auth.tenantId,
        centroCostoId: id,
        periodo: normalizedPeriodo,
        unidadBase: centro.unidadBaseFutura,
        diasPorMes: capacidad.diasPorMes,
        horasPorDia: capacidad.horasPorDia,
        porcentajeNoProductivo: new Prisma.Decimal(0),
        capacidadTeorica: capacidad.capacidadTeorica,
        capacidadPractica: capacidad.capacidadPractica,
        overrideManualCapacidad: capacidad.overrideManualCapacidad,
      },
      update: {
        unidadBase: centro.unidadBaseFutura,
        diasPorMes: capacidad.diasPorMes,
        horasPorDia: capacidad.horasPorDia,
        porcentajeNoProductivo: new Prisma.Decimal(0),
        capacidadTeorica: capacidad.capacidadTeorica,
        capacidadPractica: capacidad.capacidadPractica,
        overrideManualCapacidad: capacidad.overrideManualCapacidad,
      },
    });

    return this.mapper.toCapacidadResponse(result);
  }

  private async replaceCentroRecursosInTx(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: ReplaceCentroRecursosDto,
  ) {
    await tx.centroCostoRecurso.deleteMany({
      where: {
        tenantId: auth.tenantId,
        centroCostoId: id,
        periodo,
      },
    });

    if (payload.recursos.length > 0) {
      await tx.centroCostoRecurso.createMany({
        data: payload.recursos.map((recurso) => ({
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo,
          tipoRecurso: this.mapper.toPrismaTipoRecurso(recurso.tipoRecurso),
          empleadoId:
            recurso.tipoRecurso === TipoRecursoCentroCostoDto.empleado
              ? (recurso.empleadoId ?? null)
              : null,
          maquinaId:
            recurso.tipoRecurso === TipoRecursoCentroCostoDto.maquinaria
              ? (recurso.maquinaId ?? null)
              : null,
          nombreRecurso:
            recurso.tipoRecurso === TipoRecursoCentroCostoDto.gasto_general ||
            recurso.tipoRecurso === TipoRecursoCentroCostoDto.activo_fijo
              ? recurso.nombreRecurso?.trim() || null
              : null,
          tipoGastoGeneral:
            recurso.tipoRecurso === TipoRecursoCentroCostoDto.gasto_general
              ? this.mapper.toPrismaTipoGastoGeneral(recurso.tipoGastoGeneral!)
              : null,
          valorMensual:
            recurso.tipoRecurso === TipoRecursoCentroCostoDto.gasto_general
              ? new Prisma.Decimal(recurso.valorMensual!)
              : null,
          vidaUtilRestanteMeses:
            recurso.tipoRecurso === TipoRecursoCentroCostoDto.activo_fijo
              ? recurso.vidaUtilRestanteMeses!
              : null,
          valorActual:
            recurso.tipoRecurso === TipoRecursoCentroCostoDto.activo_fijo
              ? new Prisma.Decimal(recurso.valorActual!)
              : null,
          valorFinalVida:
            recurso.tipoRecurso === TipoRecursoCentroCostoDto.activo_fijo
              ? new Prisma.Decimal(recurso.valorFinalVida!)
              : null,
          depreciacionMensualCalc:
            recurso.tipoRecurso === TipoRecursoCentroCostoDto.activo_fijo
              ? this.computeDepreciacionMensual(
                  recurso.valorActual!,
                  recurso.valorFinalVida!,
                  recurso.vidaUtilRestanteMeses!,
                )
              : null,
          descripcion: recurso.descripcion?.trim() || null,
          porcentajeAsignacion:
            recurso.tipoRecurso === TipoRecursoCentroCostoDto.empleado &&
            recurso.porcentajeAsignacion !== undefined
              ? new Prisma.Decimal(recurso.porcentajeAsignacion)
              : null,
          activo: recurso.activo,
        })),
      });
    }

    return tx.centroCostoRecurso.findMany({
      where: {
        tenantId: auth.tenantId,
        centroCostoId: id,
        periodo,
      },
      include: {
        empleado: true,
        maquina: true,
        maquinariaPeriodo: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  private async upsertCentroRecursosMaquinariaInTx(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    periodo: string,
    recursos: Array<
      Prisma.CentroCostoRecursoGetPayload<{
        include: { maquina: true };
      }>
    >,
    payload: UpsertCentroRecursosMaquinariaDto,
  ) {
    const recursosMaquinaria = recursos.filter(
      (recurso) =>
        recurso.tipoRecurso === TipoRecursoCentroCosto.MAQUINARIA &&
        Boolean(recurso.maquinaId),
    );
    const recursoById = new Map(
      recursosMaquinaria.map((item) => [item.id, item]),
    );
    const recursoByMaquinaId = new Map(
      recursosMaquinaria
        .filter((item) => item.maquinaId)
        .map((item) => [item.maquinaId!, item]),
    );
    const payloadResourceIds: string[] = [];

    for (const item of payload.recursos) {
      const recurso =
        recursoById.get(item.centroCostoRecursoId) ??
        (item.maquinaId ? recursoByMaquinaId.get(item.maquinaId) : undefined);
      if (!recurso) {
        throw new BadRequestException(
          'Uno de los recursos de maquinaria no pertenece al centro/período seleccionado.',
        );
      }
      if (!recurso.maquinaId) {
        throw new BadRequestException(
          'El recurso de maquinaria debe tener una máquina vinculada antes de cargar costeo.',
        );
      }
      payloadResourceIds.push(recurso.id);
    }

    await tx.centroCostoRecursoMaquinaPeriodo.deleteMany({
      where: {
        tenantId: auth.tenantId,
        periodo,
        centroCostoRecursoId: {
          in: Array.from(recursoById.keys()),
          ...(payloadResourceIds.length > 0
            ? { notIn: payloadResourceIds }
            : {}),
        },
      },
    });

    for (const item of payload.recursos) {
      const recurso =
        recursoById.get(item.centroCostoRecursoId) ??
        (item.maquinaId ? recursoByMaquinaId.get(item.maquinaId) : undefined);
      if (!recurso) continue;
      const calculado = this.computeMaquinariaCosteo(item);

      await tx.centroCostoRecursoMaquinaPeriodo.upsert({
        where: {
          tenantId_centroCostoRecursoId_periodo: {
            tenantId: auth.tenantId,
            centroCostoRecursoId: recurso.id,
            periodo,
          },
        },
        create: {
          tenantId: auth.tenantId,
          centroCostoRecursoId: recurso.id,
          maquinaId: recurso.maquinaId!,
          periodo,
          metodoDepreciacion: this.mapper.toPrismaMetodoDepreciacionMaquina(
            item.metodoDepreciacion,
          ),
          valorCompra: calculado.valorCompra,
          valorResidual: calculado.valorResidual,
          vidaUtilMeses: calculado.vidaUtilMeses,
          potenciaNominalKw: calculado.potenciaNominalKw,
          factorCargaPct: calculado.factorCargaPct,
          tarifaEnergiaKwh: calculado.tarifaEnergiaKwh,
          horasProgramadasMes: calculado.horasProgramadasMes,
          disponibilidadPct: calculado.disponibilidadPct,
          eficienciaPct: calculado.eficienciaPct,
          mantenimientoMensual: calculado.mantenimientoMensual,
          segurosMensual: calculado.segurosMensual,
          otrosFijosMensual: calculado.otrosFijosMensual,
          amortizacionMensualCalc: calculado.amortizacionMensual,
          energiaMensualCalc: calculado.energiaMensual,
          costoMensualTotalCalc: calculado.costoMensualTotal,
          tarifaHoraCalc: calculado.tarifaHora,
        },
        update: {
          maquinaId: recurso.maquinaId!,
          metodoDepreciacion: this.mapper.toPrismaMetodoDepreciacionMaquina(
            item.metodoDepreciacion,
          ),
          valorCompra: calculado.valorCompra,
          valorResidual: calculado.valorResidual,
          vidaUtilMeses: calculado.vidaUtilMeses,
          potenciaNominalKw: calculado.potenciaNominalKw,
          factorCargaPct: calculado.factorCargaPct,
          tarifaEnergiaKwh: calculado.tarifaEnergiaKwh,
          horasProgramadasMes: calculado.horasProgramadasMes,
          disponibilidadPct: calculado.disponibilidadPct,
          eficienciaPct: calculado.eficienciaPct,
          mantenimientoMensual: calculado.mantenimientoMensual,
          segurosMensual: calculado.segurosMensual,
          otrosFijosMensual: calculado.otrosFijosMensual,
          amortizacionMensualCalc: calculado.amortizacionMensual,
          energiaMensualCalc: calculado.energiaMensual,
          costoMensualTotalCalc: calculado.costoMensualTotal,
          tarifaHoraCalc: calculado.tarifaHora,
        },
      });
    }
  }

  private async replaceCentroComponentesCostoInTx(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: ReplaceCentroComponentesCostoDto,
  ) {
    await tx.centroCostoComponenteCostoPeriodo.deleteMany({
      where: {
        tenantId: auth.tenantId,
        centroCostoId: id,
        periodo,
      },
    });

    if (payload.componentes.length > 0) {
      await tx.centroCostoComponenteCostoPeriodo.createMany({
        data: payload.componentes.map((componente) => ({
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo,
          categoria: this.mapper.toPrismaCategoriaComponente(
            componente.categoria,
          ),
          nombre: componente.nombre.trim(),
          origen: this.mapper.toPrismaOrigenComponente(componente.origen),
          importeMensual: new Prisma.Decimal(componente.importeMensual),
          notas: componente.notas?.trim() || null,
          detalleJson: componente.detalle
            ? (componente.detalle as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        })),
      });
    }

    return tx.centroCostoComponenteCostoPeriodo.findMany({
      where: {
        tenantId: auth.tenantId,
        centroCostoId: id,
        periodo,
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  private async buildEmpleadosDisponibilidad(
    auth: CurrentAuth,
    periodo: string,
    centroCostoId: string,
  ) {
    const [empleados, asignaciones] = await Promise.all([
      this.prisma.empleado.findMany({
        where: { tenantId: auth.tenantId },
        orderBy: { nombreCompleto: 'asc' },
        select: {
          id: true,
          nombreCompleto: true,
        },
      }),
      this.prisma.centroCostoRecurso.findMany({
        where: {
          tenantId: auth.tenantId,
          periodo,
          tipoRecurso: TipoRecursoCentroCosto.EMPLEADO,
          activo: true,
          empleadoId: { not: null },
        },
        include: {
          centroCosto: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
            },
          },
        },
      }),
    ]);

    const groupedAssignments = new Map<
      string,
      Array<{
        centroCostoId: string;
        centroCodigo: string;
        centroNombre: string;
        porcentajeAsignacion: number;
      }>
    >();

    for (const asignacion of asignaciones) {
      if (!asignacion.empleadoId) {
        continue;
      }

      const currentAssignments =
        groupedAssignments.get(asignacion.empleadoId) ?? [];
      currentAssignments.push({
        centroCostoId: asignacion.centroCostoId,
        centroCodigo: asignacion.centroCosto.codigo,
        centroNombre: asignacion.centroCosto.nombre,
        porcentajeAsignacion: Number(
          asignacion.porcentajeAsignacion?.toFixed(2) ?? 0,
        ),
      });
      groupedAssignments.set(asignacion.empleadoId, currentAssignments);
    }

    return empleados.map((empleado) => {
      const asignacionesEmpleado = groupedAssignments.get(empleado.id) ?? [];
      const asignadoEnEsteCentro = asignacionesEmpleado
        .filter((item) => item.centroCostoId === centroCostoId)
        .reduce((total, item) => total + item.porcentajeAsignacion, 0);
      const asignacionesOtrosCentros = asignacionesEmpleado.filter(
        (item) => item.centroCostoId !== centroCostoId,
      );
      const porcentajeAsignadoEnOtrosCentros = asignacionesOtrosCentros.reduce(
        (total, item) => total + item.porcentajeAsignacion,
        0,
      );

      return {
        empleadoId: empleado.id,
        empleadoNombre: empleado.nombreCompleto,
        porcentajeAsignadoEnEsteCentro: Number(asignadoEnEsteCentro.toFixed(2)),
        porcentajeAsignadoEnOtrosCentros: Number(
          porcentajeAsignadoEnOtrosCentros.toFixed(2),
        ),
        porcentajeDisponible: Number(
          Math.max(0, 100 - porcentajeAsignadoEnOtrosCentros).toFixed(2),
        ),
        asignacionesOtrosCentros,
      };
    });
  }

  private computeCapacidad(
    payload: UpsertCentroCapacidadDto,
    unidadBase: UnidadBaseCentroCosto,
    recursos: Array<
      Prisma.CentroCostoRecursoGetPayload<{
        include: { maquinariaPeriodo: true };
      }>
    >,
  ) {
    const diasPorMes = new Prisma.Decimal(payload.diasPorMes);
    const horasPorDia = new Prisma.Decimal(payload.horasPorDia);
    const horasBaseMes = diasPorMes.mul(horasPorDia);
    const capacidadTeorica = horasBaseMes;
    const capacidadHoraMaquina = recursos
      .filter(
        (recurso) => recurso.tipoRecurso === TipoRecursoCentroCosto.MAQUINARIA,
      )
      .reduce((acc, recurso) => {
        const item = recurso.maquinariaPeriodo[0];
        if (!item) {
          return acc;
        }
        const horasProductivas = item.horasProgramadasMes
          .mul(item.disponibilidadPct)
          .mul(item.eficienciaPct)
          .div(new Prisma.Decimal(10000));
        return acc.plus(horasProductivas);
      }, new Prisma.Decimal(0));
    const capacidadHoraHombre = recursos
      .filter(
        (recurso) => recurso.tipoRecurso === TipoRecursoCentroCosto.EMPLEADO,
      )
      .reduce((acc, recurso) => {
        const porcentaje =
          recurso.porcentajeAsignacion ?? new Prisma.Decimal(0);
        return acc.plus(
          horasBaseMes.mul(porcentaje).div(new Prisma.Decimal(100)),
        );
      }, new Prisma.Decimal(0));
    const capacidadAuto =
      unidadBase === UnidadBaseCentroCosto.HORA_MAQUINA
        ? capacidadHoraMaquina
        : unidadBase === UnidadBaseCentroCosto.HORA_HOMBRE
          ? capacidadHoraHombre
          : capacidadTeorica;
    const overrideManualCapacidad =
      payload.overrideManualCapacidad === undefined
        ? null
        : new Prisma.Decimal(payload.overrideManualCapacidad);
    const capacidadPractica = overrideManualCapacidad ?? capacidadAuto;

    return {
      diasPorMes,
      horasPorDia,
      capacidadTeorica,
      capacidadPractica,
      overrideManualCapacidad,
    };
  }

  private computeDepreciacionMensual(
    valorActual: number,
    valorFinalVida: number,
    vidaUtilRestanteMeses: number,
  ) {
    const depreciable = Math.max(0, valorActual - valorFinalVida);
    return new Prisma.Decimal(
      (depreciable / Math.max(1, vidaUtilRestanteMeses)).toFixed(2),
    );
  }

  private computeMaquinariaCosteo(
    item: UpsertCentroRecursosMaquinariaDto['recursos'][number],
  ) {
    const valorCompra = new Prisma.Decimal(item.valorCompra);
    const valorResidual = new Prisma.Decimal(item.valorResidual);
    const vidaUtilMeses = Math.max(1, Math.round(item.vidaUtilMeses));
    const potenciaNominalKw = new Prisma.Decimal(item.potenciaNominalKw);
    const factorCargaPct = new Prisma.Decimal(item.factorCargaPct);
    const tarifaEnergiaKwh = new Prisma.Decimal(item.tarifaEnergiaKwh);
    const horasProgramadasMes = new Prisma.Decimal(item.horasProgramadasMes);
    const disponibilidadPct = new Prisma.Decimal(item.disponibilidadPct);
    const eficienciaPct = new Prisma.Decimal(item.eficienciaPct);
    const mantenimientoMensual = new Prisma.Decimal(item.mantenimientoMensual);
    const segurosMensual = new Prisma.Decimal(item.segurosMensual);
    const otrosFijosMensual = new Prisma.Decimal(item.otrosFijosMensual);

    const rawBaseDepreciable = valorCompra.minus(valorResidual);
    const baseDepreciable = rawBaseDepreciable.gt(0)
      ? rawBaseDepreciable
      : new Prisma.Decimal(0);
    const amortizacionMensual = baseDepreciable.div(
      new Prisma.Decimal(vidaUtilMeses),
    );
    const horasProductivas = horasProgramadasMes
      .mul(disponibilidadPct.div(new Prisma.Decimal(100)))
      .mul(eficienciaPct.div(new Prisma.Decimal(100)));
    const energiaMensual = potenciaNominalKw
      .mul(factorCargaPct.div(new Prisma.Decimal(100)))
      .mul(horasProductivas)
      .mul(tarifaEnergiaKwh);
    const costoMensualTotal = amortizacionMensual
      .plus(energiaMensual)
      .plus(mantenimientoMensual)
      .plus(segurosMensual)
      .plus(otrosFijosMensual);
    const tarifaHora = horasProductivas.gt(0)
      ? costoMensualTotal.div(horasProductivas)
      : new Prisma.Decimal(0);

    return {
      valorCompra,
      valorResidual,
      vidaUtilMeses,
      potenciaNominalKw,
      factorCargaPct,
      tarifaEnergiaKwh,
      horasProgramadasMes,
      disponibilidadPct,
      eficienciaPct,
      mantenimientoMensual,
      segurosMensual,
      otrosFijosMensual,
      amortizacionMensual,
      energiaMensual,
      costoMensualTotal,
      tarifaHora,
    };
  }
}
