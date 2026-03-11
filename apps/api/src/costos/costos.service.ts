import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AreaCosto,
  CategoriaComponenteCostoCentro,
  CategoriaGraficaCentroCosto,
  EstadoTarifaCentroCostoPeriodo,
  ImputacionPreferidaCentroCosto,
  OrigenComponenteCostoCentro,
  Planta,
  Prisma,
  TipoCentroCosto,
  TipoRecursoCentroCosto,
  UnidadBaseCentroCosto,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAreaCostoDto } from './dto/upsert-area-costo.dto';
import {
  CategoriaGraficaCentroCostoDto,
  ImputacionPreferidaCentroCostoDto,
  TipoCentroCostoDto,
  UnidadBaseCentroCostoDto,
  UpsertCentroCostoDto,
} from './dto/upsert-centro-costo.dto';
import { UpsertPlantaDto } from './dto/upsert-planta.dto';
import { UpsertCentroConfiguracionBaseDto } from './dto/upsert-centro-configuracion-base.dto';
import {
  ReplaceCentroRecursosDto,
  TipoRecursoCentroCostoDto,
} from './dto/replace-centro-recursos.dto';
import {
  CategoriaComponenteCostoCentroDto,
  OrigenComponenteCostoCentroDto,
  ReplaceCentroComponentesCostoDto,
} from './dto/replace-centro-componentes-costo.dto';
import { UpsertCentroCapacidadDto } from './dto/upsert-centro-capacidad.dto';

type AreaCompleta = AreaCosto & { planta: Planta };
type CentroCompleto = Prisma.CentroCostoGetPayload<{
  include: {
    planta: true;
    areaCosto: true;
    responsableEmpleado: true;
    proveedorDefault: true;
    tarifasPeriodo: true;
  };
}>;
type CentroConfiguracionCompleta = Prisma.CentroCostoGetPayload<{
  include: {
    planta: true;
    areaCosto: true;
    responsableEmpleado: true;
    proveedorDefault: true;
    recursos: {
      include: {
        empleado: true;
        proveedor: true;
      };
    };
    componentesCostoPeriodo: true;
    capacidadesPeriodo: true;
    tarifasPeriodo: true;
  };
}>;

type TarifaSnapshot = {
  centro: CentroConfiguracionCompleta;
  periodo: string;
  costoMensualTotal: Prisma.Decimal;
  capacidadPractica: Prisma.Decimal;
  tarifaCalculada: Prisma.Decimal;
  advertencias: string[];
  validaParaPublicar: boolean;
  resumenJson: Prisma.JsonObject;
};

const DEFAULT_PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

@Injectable()
export class CostosService {
  constructor(private readonly prisma: PrismaService) {}

  async findPlantas(auth: CurrentAuth) {
    const plantas = await this.prisma.planta.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { nombre: 'asc' },
    });

    return plantas.map((planta) => this.toPlantaResponse(planta));
  }

  async createPlanta(auth: CurrentAuth, payload: UpsertPlantaDto) {
    let planta: Planta;

    try {
      planta = await this.prisma.planta.create({
        data: {
          tenantId: auth.tenantId,
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion?.trim() || null,
        },
      });
    } catch (error) {
      this.handleWriteError(error, 'planta');
    }

    return this.toPlantaResponse(planta);
  }

  async updatePlanta(auth: CurrentAuth, id: string, payload: UpsertPlantaDto) {
    await this.findPlantaOrThrow(auth, id);

    let planta: Planta;

    try {
      planta = await this.prisma.planta.update({
        where: { id },
        data: {
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion?.trim() || null,
        },
      });
    } catch (error) {
      this.handleWriteError(error, 'planta');
    }

    return this.toPlantaResponse(planta);
  }

  async togglePlanta(auth: CurrentAuth, id: string) {
    const planta = await this.findPlantaOrThrow(auth, id);

    return this.prisma.planta.update({
      where: { id },
      data: { activa: !planta.activa },
    });
  }

  async findAreas(auth: CurrentAuth) {
    const areas = await this.prisma.areaCosto.findMany({
      where: { tenantId: auth.tenantId },
      include: { planta: true },
      orderBy: [{ planta: { nombre: 'asc' } }, { nombre: 'asc' }],
    });

    return areas.map((area) => this.toAreaResponse(area));
  }

  async createArea(auth: CurrentAuth, payload: UpsertAreaCostoDto) {
    await this.findPlantaOrThrow(auth, payload.plantaId);

    let area: AreaCompleta;

    try {
      area = await this.prisma.areaCosto.create({
        data: {
          tenantId: auth.tenantId,
          plantaId: payload.plantaId,
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion?.trim() || null,
        },
        include: { planta: true },
      });
    } catch (error) {
      this.handleWriteError(error, 'area');
    }

    return this.toAreaResponse(area);
  }

  async updateArea(auth: CurrentAuth, id: string, payload: UpsertAreaCostoDto) {
    await this.findPlantaOrThrow(auth, payload.plantaId);
    await this.findAreaOrThrow(auth, id);

    let area: AreaCompleta;

    try {
      area = await this.prisma.areaCosto.update({
        where: { id },
        data: {
          plantaId: payload.plantaId,
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion?.trim() || null,
        },
        include: { planta: true },
      });
    } catch (error) {
      this.handleWriteError(error, 'area');
    }

    return this.toAreaResponse(area);
  }

  async toggleArea(auth: CurrentAuth, id: string) {
    const area = await this.findAreaOrThrow(auth, id);

    return this.prisma.areaCosto.update({
      where: { id },
      data: { activa: !area.activa },
    });
  }

  async findCentros(auth: CurrentAuth) {
    const centros = await this.prisma.centroCosto.findMany({
      where: { tenantId: auth.tenantId },
      include: {
        planta: true,
        areaCosto: true,
        responsableEmpleado: true,
        proveedorDefault: true,
        tarifasPeriodo: {
          orderBy: [{ periodo: 'desc' }, { createdAt: 'desc' }],
          take: 8,
        },
      },
      orderBy: [{ nombre: 'asc' }],
    });

    return centros.map((centro) => this.toCentroResponse(centro));
  }

  async createCentro(auth: CurrentAuth, payload: UpsertCentroCostoDto) {
    await this.validateCentroReferences(auth, payload);

    let centro: CentroCompleto;

    try {
      centro = await this.prisma.centroCosto.create({
        data: this.buildCreateCentroData(auth, payload),
        include: {
          planta: true,
          areaCosto: true,
          responsableEmpleado: true,
          proveedorDefault: true,
          tarifasPeriodo: true,
        },
      });
    } catch (error) {
      this.handleWriteError(error, 'centro');
    }

    return this.toCentroResponse(centro);
  }

  async updateCentro(
    auth: CurrentAuth,
    id: string,
    payload: UpsertCentroCostoDto,
  ) {
    await this.findCentroOrThrow(auth, id);
    await this.validateCentroReferences(auth, payload);

    let centro: CentroCompleto;

    try {
      centro = await this.prisma.centroCosto.update({
        where: { id },
        data: this.buildUpdateCentroData(payload),
        include: {
          planta: true,
          areaCosto: true,
          responsableEmpleado: true,
          proveedorDefault: true,
          tarifasPeriodo: true,
        },
      });
    } catch (error) {
      this.handleWriteError(error, 'centro');
    }

    return this.toCentroResponse(centro);
  }

  async toggleCentro(auth: CurrentAuth, id: string) {
    const centro = await this.findCentroOrThrow(auth, id);

    return this.prisma.centroCosto.update({
      where: { id },
      data: { activo: !centro.activo },
    });
  }

  async getCentroConfiguracion(auth: CurrentAuth, id: string, periodo: string) {
    const normalizedPeriodo = this.normalizePeriodo(periodo);
    const [centro, empleadosDisponibilidad] = await Promise.all([
      this.getCentroConfiguracionEntity(auth, id, normalizedPeriodo),
      this.buildEmpleadosDisponibilidad(auth, normalizedPeriodo, id),
    ]);
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
      centro: this.toCentroResponse(centro),
      recursos: centro.recursos.map((recurso) =>
        this.toRecursoResponse(recurso),
      ),
      componentesCosto: centro.componentesCostoPeriodo.map((componente) =>
        this.toComponenteCostoResponse(componente),
      ),
      capacidad: centro.capacidadesPeriodo[0]
        ? this.toCapacidadResponse(centro.capacidadesPeriodo[0])
        : null,
      tarifaBorrador: tarifaBorrador
        ? this.toTarifaResponse(tarifaBorrador)
        : null,
      tarifaPublicada: tarifaPublicada
        ? this.toTarifaResponse(tarifaPublicada)
        : null,
      advertencias: this.buildAdvertencias(centro, normalizedPeriodo),
      empleadosDisponibilidad,
    };
  }

  async updateCentroConfiguracionBase(
    auth: CurrentAuth,
    id: string,
    payload: UpsertCentroConfiguracionBaseDto,
  ) {
    return this.updateCentro(auth, id, payload);
  }

  async replaceCentroRecursos(
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: ReplaceCentroRecursosDto,
  ) {
    const normalizedPeriodo = this.normalizePeriodo(periodo);
    await this.findCentroOrThrow(auth, id);
    await this.validateRecursos(auth, id, normalizedPeriodo, payload.recursos);

    const recursos = await this.prisma.$transaction(async (tx) => {
      await tx.centroCostoRecurso.deleteMany({
        where: {
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo: normalizedPeriodo,
        },
      });

      if (payload.recursos.length > 0) {
        await tx.centroCostoRecurso.createMany({
          data: payload.recursos.map((recurso) => ({
            tenantId: auth.tenantId,
            centroCostoId: id,
            periodo: normalizedPeriodo,
            tipoRecurso: this.toPrismaTipoRecurso(recurso.tipoRecurso),
            empleadoId:
              recurso.tipoRecurso === TipoRecursoCentroCostoDto.empleado
                ? (recurso.empleadoId ?? null)
                : null,
            proveedorId:
              recurso.tipoRecurso === TipoRecursoCentroCostoDto.proveedor
                ? (recurso.proveedorId ?? null)
                : null,
            nombreManual:
              recurso.tipoRecurso === TipoRecursoCentroCostoDto.maquinaria ||
              recurso.tipoRecurso === TipoRecursoCentroCostoDto.gasto_manual
                ? recurso.nombreManual?.trim() || null
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
          periodo: normalizedPeriodo,
        },
        include: {
          empleado: true,
          proveedor: true,
        },
        orderBy: [{ createdAt: 'asc' }],
      });
    });

    return recursos.map((recurso) => this.toRecursoResponse(recurso));
  }

  async replaceCentroComponentesCosto(
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: ReplaceCentroComponentesCostoDto,
  ) {
    const normalizedPeriodo = this.normalizePeriodo(periodo);
    await this.findCentroOrThrow(auth, id);

    const componentes = await this.prisma.$transaction(async (tx) => {
      await tx.centroCostoComponenteCostoPeriodo.deleteMany({
        where: {
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo: normalizedPeriodo,
        },
      });

      if (payload.componentes.length > 0) {
        await tx.centroCostoComponenteCostoPeriodo.createMany({
          data: payload.componentes.map((componente) => ({
            tenantId: auth.tenantId,
            centroCostoId: id,
            periodo: normalizedPeriodo,
            categoria: this.toPrismaCategoriaComponente(componente.categoria),
            nombre: componente.nombre.trim(),
            origen: this.toPrismaOrigenComponente(componente.origen),
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
          periodo: normalizedPeriodo,
        },
        orderBy: [{ createdAt: 'asc' }],
      });
    });

    return componentes.map((componente) =>
      this.toComponenteCostoResponse(componente),
    );
  }

  async upsertCentroCapacidad(
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: UpsertCentroCapacidadDto,
  ) {
    const normalizedPeriodo = this.normalizePeriodo(periodo);
    const centro = await this.findCentroOrThrow(auth, id);
    const capacidad = this.computeCapacidad(payload);

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
        porcentajeNoProductivo: capacidad.porcentajeNoProductivo,
        capacidadTeorica: capacidad.capacidadTeorica,
        capacidadPractica: capacidad.capacidadPractica,
        overrideManualCapacidad: capacidad.overrideManualCapacidad,
      },
      update: {
        unidadBase: centro.unidadBaseFutura,
        diasPorMes: capacidad.diasPorMes,
        horasPorDia: capacidad.horasPorDia,
        porcentajeNoProductivo: capacidad.porcentajeNoProductivo,
        capacidadTeorica: capacidad.capacidadTeorica,
        capacidadPractica: capacidad.capacidadPractica,
        overrideManualCapacidad: capacidad.overrideManualCapacidad,
      },
    });

    return this.toCapacidadResponse(result);
  }

  async calcularTarifaCentro(auth: CurrentAuth, id: string, periodo: string) {
    const normalizedPeriodo = this.normalizePeriodo(periodo);
    const snapshot = await this.buildTarifaSnapshot(
      auth,
      id,
      normalizedPeriodo,
    );

    const tarifa = await this.prisma.centroCostoTarifaPeriodo.upsert({
      where: {
        tenantId_centroCostoId_periodo_estado: {
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo: normalizedPeriodo,
          estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
        },
      },
      create: {
        tenantId: auth.tenantId,
        centroCostoId: id,
        periodo: normalizedPeriodo,
        costoMensualTotal: snapshot.costoMensualTotal,
        capacidadPractica: snapshot.capacidadPractica,
        tarifaCalculada: snapshot.tarifaCalculada,
        estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
        resumenJson: snapshot.resumenJson,
      },
      update: {
        costoMensualTotal: snapshot.costoMensualTotal,
        capacidadPractica: snapshot.capacidadPractica,
        tarifaCalculada: snapshot.tarifaCalculada,
        resumenJson: snapshot.resumenJson,
      },
    });

    return {
      tarifaBorrador: this.toTarifaResponse(tarifa),
      advertencias: snapshot.advertencias,
    };
  }

  async publicarTarifaCentro(auth: CurrentAuth, id: string, periodo: string) {
    const normalizedPeriodo = this.normalizePeriodo(periodo);
    const snapshot = await this.buildTarifaSnapshot(
      auth,
      id,
      normalizedPeriodo,
    );

    if (!snapshot.validaParaPublicar) {
      throw new BadRequestException(snapshot.advertencias.join(' '));
    }

    await this.prisma.centroCostoTarifaPeriodo.upsert({
      where: {
        tenantId_centroCostoId_periodo_estado: {
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo: normalizedPeriodo,
          estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
        },
      },
      create: {
        tenantId: auth.tenantId,
        centroCostoId: id,
        periodo: normalizedPeriodo,
        costoMensualTotal: snapshot.costoMensualTotal,
        capacidadPractica: snapshot.capacidadPractica,
        tarifaCalculada: snapshot.tarifaCalculada,
        estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
        resumenJson: snapshot.resumenJson,
      },
      update: {
        costoMensualTotal: snapshot.costoMensualTotal,
        capacidadPractica: snapshot.capacidadPractica,
        tarifaCalculada: snapshot.tarifaCalculada,
        resumenJson: snapshot.resumenJson,
      },
    });

    const publicada = await this.prisma.centroCostoTarifaPeriodo.upsert({
      where: {
        tenantId_centroCostoId_periodo_estado: {
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo: normalizedPeriodo,
          estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
        },
      },
      create: {
        tenantId: auth.tenantId,
        centroCostoId: id,
        periodo: normalizedPeriodo,
        costoMensualTotal: snapshot.costoMensualTotal,
        capacidadPractica: snapshot.capacidadPractica,
        tarifaCalculada: snapshot.tarifaCalculada,
        estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
        resumenJson: snapshot.resumenJson,
      },
      update: {
        costoMensualTotal: snapshot.costoMensualTotal,
        capacidadPractica: snapshot.capacidadPractica,
        tarifaCalculada: snapshot.tarifaCalculada,
        resumenJson: snapshot.resumenJson,
      },
    });

    return this.toTarifaResponse(publicada);
  }

  async getCentroTarifas(auth: CurrentAuth, id: string) {
    await this.findCentroOrThrow(auth, id);

    const tarifas = await this.prisma.centroCostoTarifaPeriodo.findMany({
      where: {
        tenantId: auth.tenantId,
        centroCostoId: id,
      },
      orderBy: [{ periodo: 'desc' }, { createdAt: 'desc' }],
    });

    return tarifas.map((tarifa) => this.toTarifaResponse(tarifa));
  }

  private async buildTarifaSnapshot(
    auth: CurrentAuth,
    centroCostoId: string,
    periodo: string,
  ): Promise<TarifaSnapshot> {
    const centro = await this.getCentroConfiguracionEntity(
      auth,
      centroCostoId,
      periodo,
    );
    const advertencias = this.buildAdvertencias(centro, periodo);
    const costoMensualTotal = centro.componentesCostoPeriodo.reduce(
      (acc, item) => acc.plus(item.importeMensual),
      new Prisma.Decimal(0),
    );
    const capacidadPractica =
      centro.capacidadesPeriodo[0]?.capacidadPractica ?? new Prisma.Decimal(0);
    const tarifaCalculada =
      costoMensualTotal.gt(0) && capacidadPractica.gt(0)
        ? costoMensualTotal.div(capacidadPractica)
        : new Prisma.Decimal(0);
    const tieneProveedorVigente =
      Boolean(centro.proveedorDefaultId) ||
      centro.recursos.some(
        (recurso) =>
          recurso.tipoRecurso === TipoRecursoCentroCosto.PROVEEDOR &&
          Boolean(recurso.proveedorId) &&
          recurso.activo,
      );
    const validaParaPublicar =
      costoMensualTotal.gt(0) &&
      capacidadPractica.gt(0) &&
      !(
        centro.tipoCentro === TipoCentroCosto.TERCERIZADO &&
        !tieneProveedorVigente
      );

    return {
      centro,
      periodo,
      costoMensualTotal,
      capacidadPractica,
      tarifaCalculada,
      advertencias,
      validaParaPublicar,
      resumenJson: {
        periodo,
        centroCodigo: centro.codigo,
        centroNombre: centro.nombre,
        unidadBase: this.fromPrismaUnidadBase(centro.unidadBaseFutura),
        costoMensualTotal: this.decimalToNumber(costoMensualTotal),
        capacidadPractica: this.decimalToNumber(capacidadPractica),
        tarifaCalculada: this.decimalToNumber(tarifaCalculada),
        advertencias,
      },
    };
  }

  private async getCentroConfiguracionEntity(
    auth: CurrentAuth,
    id: string,
    periodo: string,
  ) {
    const centro = await this.prisma.centroCosto.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      include: {
        planta: true,
        areaCosto: true,
        responsableEmpleado: true,
        proveedorDefault: true,
        recursos: {
          where: { periodo },
          include: {
            empleado: true,
            proveedor: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        componentesCostoPeriodo: {
          where: { periodo },
          orderBy: [{ createdAt: 'asc' }],
        },
        capacidadesPeriodo: {
          where: { periodo },
        },
        tarifasPeriodo: {
          where: { periodo },
          orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!centro) {
      throw new NotFoundException(`No existe el centro de costo ${id}`);
    }

    return centro;
  }

  private buildAdvertencias(
    centro: CentroConfiguracionCompleta,
    periodo: string,
  ) {
    const advertencias: string[] = [];
    const recursosActivos = centro.recursos.filter((recurso) => recurso.activo);
    const costoMensualTotal = centro.componentesCostoPeriodo.reduce(
      (acc, item) => acc.plus(item.importeMensual),
      new Prisma.Decimal(0),
    );
    const capacidad = centro.capacidadesPeriodo[0] ?? null;
    const tieneProveedorVigente =
      Boolean(centro.proveedorDefaultId) ||
      centro.recursos.some(
        (recurso) =>
          recurso.tipoRecurso === TipoRecursoCentroCosto.PROVEEDOR &&
          Boolean(recurso.proveedorId) &&
          recurso.activo,
      );

    if (centro.unidadBaseFutura === UnidadBaseCentroCosto.NINGUNA) {
      advertencias.push(
        'Conviene definir como queres medir este centro para que la tarifa sea util despues.',
      );
    }

    if (recursosActivos.length === 0) {
      advertencias.push(
        'Todavia no cargaste que personas, maquinas o apoyos usa este sector para trabajar.',
      );
    }

    if (centro.componentesCostoPeriodo.length === 0) {
      advertencias.push(
        `Todavia no cargaste costos mensuales para ${periodo}.`,
      );
    }

    if (!costoMensualTotal.gt(0)) {
      advertencias.push(
        'El costo mensual total debe ser mayor a 0 para calcular una tarifa util.',
      );
    }

    if (!capacidad) {
      advertencias.push(
        'Todavia no definiste cuantas horas o unidades reales puede producir este centro por mes.',
      );
    } else if (!capacidad.capacidadPractica.gt(0)) {
      advertencias.push(
        'La capacidad practica debe ser mayor a 0 para poder publicar una tarifa.',
      );
    }

    if (
      centro.tipoCentro === TipoCentroCosto.TERCERIZADO &&
      !tieneProveedorVigente
    ) {
      advertencias.push(
        'Los centros tercerizados necesitan un proveedor asignado como referencia o recurso activo.',
      );
    }

    return advertencias;
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

  private computeCapacidad(payload: UpsertCentroCapacidadDto) {
    const diasPorMes = new Prisma.Decimal(payload.diasPorMes);
    const horasPorDia = new Prisma.Decimal(payload.horasPorDia);
    const porcentajeNoProductivo = new Prisma.Decimal(
      payload.porcentajeNoProductivo,
    );
    const capacidadTeorica = diasPorMes.mul(horasPorDia);
    const overrideManualCapacidad =
      payload.overrideManualCapacidad === undefined
        ? null
        : new Prisma.Decimal(payload.overrideManualCapacidad);
    const capacidadPractica =
      overrideManualCapacidad ??
      capacidadTeorica.mul(
        new Prisma.Decimal(1).minus(
          porcentajeNoProductivo.div(new Prisma.Decimal(100)),
        ),
      );

    return {
      diasPorMes,
      horasPorDia,
      porcentajeNoProductivo,
      capacidadTeorica,
      capacidadPractica,
      overrideManualCapacidad,
    };
  }

  private buildCreateCentroData(
    auth: CurrentAuth,
    payload: UpsertCentroCostoDto,
  ): Prisma.CentroCostoUncheckedCreateInput {
    return {
      tenantId: auth.tenantId,
      plantaId: payload.plantaId,
      areaCostoId: payload.areaCostoId,
      codigo: payload.codigo.trim().toUpperCase(),
      nombre: payload.nombre.trim(),
      descripcion: payload.descripcion?.trim() || null,
      tipoCentro: this.toPrismaTipoCentro(payload.tipoCentro),
      categoriaGrafica: this.toPrismaCategoria(payload.categoriaGrafica),
      imputacionPreferida: this.toPrismaImputacion(payload.imputacionPreferida),
      unidadBaseFutura: this.toPrismaUnidadBase(payload.unidadBaseFutura),
      responsableEmpleadoId: payload.responsableEmpleadoId ?? null,
      proveedorDefaultId: payload.proveedorDefaultId ?? null,
      activo: payload.activo,
    };
  }

  private buildUpdateCentroData(
    payload: UpsertCentroCostoDto,
  ): Prisma.CentroCostoUncheckedUpdateInput {
    return {
      plantaId: payload.plantaId,
      areaCostoId: payload.areaCostoId,
      codigo: payload.codigo.trim().toUpperCase(),
      nombre: payload.nombre.trim(),
      descripcion: payload.descripcion?.trim() || null,
      tipoCentro: this.toPrismaTipoCentro(payload.tipoCentro),
      categoriaGrafica: this.toPrismaCategoria(payload.categoriaGrafica),
      imputacionPreferida: this.toPrismaImputacion(payload.imputacionPreferida),
      unidadBaseFutura: this.toPrismaUnidadBase(payload.unidadBaseFutura),
      responsableEmpleadoId: payload.responsableEmpleadoId ?? null,
      proveedorDefaultId: payload.proveedorDefaultId ?? null,
      activo: payload.activo,
    };
  }

  private async validateCentroReferences(
    auth: CurrentAuth,
    payload: UpsertCentroCostoDto,
  ) {
    const [planta, area] = await Promise.all([
      this.prisma.planta.findFirst({
        where: { id: payload.plantaId, tenantId: auth.tenantId },
      }),
      this.prisma.areaCosto.findFirst({
        where: { id: payload.areaCostoId, tenantId: auth.tenantId },
      }),
    ]);

    if (!planta) {
      throw new NotFoundException('La planta no existe.');
    }

    if (!area) {
      throw new NotFoundException('El area no existe.');
    }

    if (area.plantaId !== planta.id) {
      throw new BadRequestException(
        'El area no pertenece a la planta seleccionada.',
      );
    }

    if (payload.responsableEmpleadoId) {
      const empleado = await this.prisma.empleado.findFirst({
        where: {
          id: payload.responsableEmpleadoId,
          tenantId: auth.tenantId,
        },
      });

      if (!empleado) {
        throw new NotFoundException('El responsable seleccionado no existe.');
      }
    }

    if (payload.proveedorDefaultId) {
      const proveedor = await this.prisma.proveedor.findFirst({
        where: {
          id: payload.proveedorDefaultId,
          tenantId: auth.tenantId,
        },
      });

      if (!proveedor) {
        throw new NotFoundException('El proveedor seleccionado no existe.');
      }
    }

    if (
      payload.tipoCentro !== TipoCentroCostoDto.tercerizado &&
      payload.proveedorDefaultId
    ) {
      throw new BadRequestException(
        'Solo los centros tercerizados pueden tener proveedor por defecto.',
      );
    }
  }

  private async validateRecursos(
    auth: CurrentAuth,
    centroCostoId: string,
    periodo: string,
    recursos: ReplaceCentroRecursosDto['recursos'],
  ) {
    const recursosActivos = recursos.filter((recurso) => recurso.activo);
    const employeeAssignments = new Map<string, number>();
    const employeeIds = new Set<string>();
    const providerIds = new Set<string>();

    for (const recurso of recursos) {
      if (
        recurso.tipoRecurso === TipoRecursoCentroCostoDto.empleado &&
        !recurso.empleadoId
      ) {
        throw new BadRequestException(
          'Los recursos de tipo empleado necesitan un empleado asociado.',
        );
      }

      if (
        recurso.tipoRecurso === TipoRecursoCentroCostoDto.proveedor &&
        !recurso.proveedorId
      ) {
        throw new BadRequestException(
          'Los recursos de tipo proveedor necesitan un proveedor asociado.',
        );
      }

      if (
        (recurso.tipoRecurso === TipoRecursoCentroCostoDto.maquinaria ||
          recurso.tipoRecurso === TipoRecursoCentroCostoDto.gasto_manual) &&
        !recurso.nombreManual?.trim()
      ) {
        throw new BadRequestException(
          'Las maquinas y gastos manuales necesitan un nombre descriptivo.',
        );
      }

      if (recurso.tipoRecurso === TipoRecursoCentroCostoDto.empleado) {
        if (recurso.porcentajeAsignacion === undefined) {
          throw new BadRequestException(
            'Cada persona asignada necesita un porcentaje de dedicacion para este mes.',
          );
        }

        if (
          recurso.porcentajeAsignacion <= 0 ||
          recurso.porcentajeAsignacion > 100
        ) {
          throw new BadRequestException(
            'El porcentaje de dedicacion de una persona debe estar entre 0,01 y 100.',
          );
        }

        if (!recurso.empleadoId) {
          throw new BadRequestException(
            'Los recursos de tipo empleado necesitan un empleado asociado.',
          );
        }

        if (employeeAssignments.has(recurso.empleadoId)) {
          throw new BadRequestException(
            'No puedes asignar la misma persona dos veces en el mismo centro y mes.',
          );
        }

        employeeAssignments.set(
          recurso.empleadoId,
          recurso.activo ? recurso.porcentajeAsignacion : 0,
        );
        employeeIds.add(recurso.empleadoId);
      } else if (recurso.porcentajeAsignacion !== undefined) {
        throw new BadRequestException(
          'Solo las personas pueden llevar porcentaje de dedicacion en esta version.',
        );
      }

      if (recurso.proveedorId) {
        providerIds.add(recurso.proveedorId);
      }
    }

    if (employeeIds.size > 0) {
      const existingEmployees = await this.prisma.empleado.findMany({
        where: {
          tenantId: auth.tenantId,
          id: { in: Array.from(employeeIds) },
        },
        select: { id: true },
      });
      const existingEmployeeIds = new Set(
        existingEmployees.map((item) => item.id),
      );

      for (const empleadoId of employeeIds) {
        if (!existingEmployeeIds.has(empleadoId)) {
          throw new NotFoundException(
            'Uno de los empleados asignados no existe en la empresa actual.',
          );
        }
      }

      const allocations = await this.prisma.centroCostoRecurso.groupBy({
        by: ['empleadoId'],
        where: {
          tenantId: auth.tenantId,
          periodo,
          tipoRecurso: TipoRecursoCentroCosto.EMPLEADO,
          activo: true,
          empleadoId: { in: Array.from(employeeIds) },
          NOT: { centroCostoId },
        },
        _sum: {
          porcentajeAsignacion: true,
        },
      });
      const allocationMap = new Map(
        allocations.map((allocation) => [
          allocation.empleadoId ?? '',
          Number(allocation._sum.porcentajeAsignacion?.toFixed(2) ?? 0),
        ]),
      );

      for (const [empleadoId, porcentajeActual] of employeeAssignments) {
        const porcentajeEnOtrosCentros = allocationMap.get(empleadoId) ?? 0;
        if (porcentajeEnOtrosCentros + porcentajeActual > 100) {
          throw new BadRequestException(
            `La persona seleccionada supera el 100% de dedicacion para ${periodo}.`,
          );
        }
      }
    }

    if (providerIds.size > 0) {
      const existingProviders = await this.prisma.proveedor.findMany({
        where: {
          tenantId: auth.tenantId,
          id: { in: Array.from(providerIds) },
        },
        select: { id: true },
      });
      const existingProviderIds = new Set(
        existingProviders.map((item) => item.id),
      );

      for (const proveedorId of providerIds) {
        if (!existingProviderIds.has(proveedorId)) {
          throw new NotFoundException(
            'Uno de los proveedores asignados no existe en la empresa actual.',
          );
        }
      }
    }

    if (
      recursosActivos.length === 0 &&
      recursos.length > 0 &&
      recursos.some(
        (recurso) => recurso.tipoRecurso === TipoRecursoCentroCostoDto.empleado,
      )
    ) {
      throw new BadRequestException(
        'Si asignas personas al centro, al menos una debe quedar activa para el mes.',
      );
    }
  }

  private normalizePeriodo(periodo?: string) {
    if (!periodo || !DEFAULT_PERIOD_REGEX.test(periodo)) {
      throw new BadRequestException('El periodo debe tener formato YYYY-MM.');
    }

    return periodo;
  }

  private async findPlantaOrThrow(
    auth: CurrentAuth,
    id: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const planta = await db.planta.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
    });

    if (!planta) {
      throw new NotFoundException(`No existe la planta ${id}`);
    }

    return planta;
  }

  private async findAreaOrThrow(auth: CurrentAuth, id: string) {
    const area = await this.prisma.areaCosto.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      include: { planta: true },
    });

    if (!area) {
      throw new NotFoundException(`No existe el area ${id}`);
    }

    return area;
  }

  private async findCentroOrThrow(auth: CurrentAuth, id: string) {
    const centro = await this.prisma.centroCosto.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      include: {
        planta: true,
        areaCosto: true,
        responsableEmpleado: true,
        proveedorDefault: true,
        tarifasPeriodo: true,
      },
    });

    if (!centro) {
      throw new NotFoundException(`No existe el centro de costo ${id}`);
    }

    return centro;
  }

  private toPlantaResponse(planta: Planta) {
    return {
      id: planta.id,
      codigo: planta.codigo,
      nombre: planta.nombre,
      descripcion: planta.descripcion ?? '',
      activa: planta.activa,
    };
  }

  private toAreaResponse(area: AreaCompleta) {
    return {
      id: area.id,
      plantaId: area.plantaId,
      plantaNombre: area.planta.nombre,
      codigo: area.codigo,
      nombre: area.nombre,
      descripcion: area.descripcion ?? '',
      activa: area.activa,
    };
  }

  private toCentroResponse(centro: CentroCompleto) {
    const tarifas = centro.tarifasPeriodo ?? [];
    const ultimaTarifaPublicada = tarifas.find(
      (tarifa) => tarifa.estado === EstadoTarifaCentroCostoPeriodo.PUBLICADA,
    );
    const ultimaTarifaBorrador = tarifas.find(
      (tarifa) => tarifa.estado === EstadoTarifaCentroCostoPeriodo.BORRADOR,
    );
    const estadoConfiguracion = ultimaTarifaPublicada
      ? 'publicado'
      : ultimaTarifaBorrador
        ? 'borrador'
        : 'sin_configurar';
    const ultimoPeriodoConfigurado =
      ultimaTarifaPublicada?.periodo ?? ultimaTarifaBorrador?.periodo ?? '';

    return {
      id: centro.id,
      plantaId: centro.plantaId,
      plantaNombre: centro.planta.nombre,
      areaCostoId: centro.areaCostoId,
      areaCostoNombre: centro.areaCosto.nombre,
      codigo: centro.codigo,
      nombre: centro.nombre,
      descripcion: centro.descripcion ?? '',
      tipoCentro: this.fromPrismaTipoCentro(centro.tipoCentro),
      categoriaGrafica: this.fromPrismaCategoria(centro.categoriaGrafica),
      imputacionPreferida: this.fromPrismaImputacion(
        centro.imputacionPreferida,
      ),
      unidadBaseFutura: this.fromPrismaUnidadBase(centro.unidadBaseFutura),
      responsableEmpleadoId: centro.responsableEmpleadoId ?? '',
      responsableEmpleadoNombre:
        centro.responsableEmpleado?.nombreCompleto ?? '',
      proveedorDefaultId: centro.proveedorDefaultId ?? '',
      proveedorDefaultNombre: centro.proveedorDefault?.nombre ?? '',
      activo: centro.activo,
      estadoConfiguracion,
      ultimoPeriodoConfigurado,
      ultimaTarifaPublicada: ultimaTarifaPublicada
        ? this.decimalToNumber(ultimaTarifaPublicada.tarifaCalculada)
        : null,
      unidadTarifaPublicada: ultimaTarifaPublicada
        ? this.fromPrismaUnidadBase(centro.unidadBaseFutura)
        : '',
    };
  }

  private toRecursoResponse(
    recurso: Prisma.CentroCostoRecursoGetPayload<{
      include: { empleado: true; proveedor: true };
    }>,
  ) {
    return {
      id: recurso.id,
      periodo: recurso.periodo,
      tipoRecurso: this.fromPrismaTipoRecurso(recurso.tipoRecurso),
      empleadoId: recurso.empleadoId ?? '',
      empleadoNombre: recurso.empleado?.nombreCompleto ?? '',
      proveedorId: recurso.proveedorId ?? '',
      proveedorNombre: recurso.proveedor?.nombre ?? '',
      nombreManual: recurso.nombreManual ?? '',
      descripcion: recurso.descripcion ?? '',
      porcentajeAsignacion: recurso.porcentajeAsignacion
        ? this.decimalToNumber(recurso.porcentajeAsignacion)
        : null,
      activo: recurso.activo,
    };
  }

  private toComponenteCostoResponse(
    componente: Prisma.CentroCostoComponenteCostoPeriodoGetPayload<object>,
  ) {
    return {
      id: componente.id,
      periodo: componente.periodo,
      categoria: this.fromPrismaCategoriaComponente(componente.categoria),
      nombre: componente.nombre,
      origen: this.fromPrismaOrigenComponente(componente.origen),
      importeMensual: this.decimalToNumber(componente.importeMensual),
      notas: componente.notas ?? '',
      detalle:
        (componente.detalleJson as Record<string, unknown> | null) ?? null,
    };
  }

  private toCapacidadResponse(
    capacidad: Prisma.CentroCostoCapacidadPeriodoGetPayload<object>,
  ) {
    return {
      id: capacidad.id,
      periodo: capacidad.periodo,
      unidadBase: this.fromPrismaUnidadBase(capacidad.unidadBase),
      diasPorMes: this.decimalToNumber(capacidad.diasPorMes),
      horasPorDia: this.decimalToNumber(capacidad.horasPorDia),
      porcentajeNoProductivo: this.decimalToNumber(
        capacidad.porcentajeNoProductivo,
      ),
      capacidadTeorica: this.decimalToNumber(capacidad.capacidadTeorica),
      capacidadPractica: this.decimalToNumber(capacidad.capacidadPractica),
      overrideManualCapacidad: capacidad.overrideManualCapacidad
        ? this.decimalToNumber(capacidad.overrideManualCapacidad)
        : null,
    };
  }

  private toTarifaResponse(
    tarifa: Prisma.CentroCostoTarifaPeriodoGetPayload<object>,
  ) {
    return {
      id: tarifa.id,
      periodo: tarifa.periodo,
      costoMensualTotal: this.decimalToNumber(tarifa.costoMensualTotal),
      capacidadPractica: this.decimalToNumber(tarifa.capacidadPractica),
      tarifaCalculada: this.decimalToNumber(tarifa.tarifaCalculada),
      estado: this.fromPrismaEstadoTarifa(tarifa.estado),
      resumen: tarifa.resumenJson,
      createdAt: tarifa.createdAt.toISOString(),
      updatedAt: tarifa.updatedAt.toISOString(),
    };
  }

  private decimalToNumber(value: Prisma.Decimal) {
    return Number(value.toFixed(2));
  }

  private toPrismaTipoCentro(tipo: TipoCentroCostoDto) {
    const mapping: Record<TipoCentroCostoDto, TipoCentroCosto> = {
      [TipoCentroCostoDto.productivo]: TipoCentroCosto.PRODUCTIVO,
      [TipoCentroCostoDto.apoyo]: TipoCentroCosto.APOYO,
      [TipoCentroCostoDto.administrativo]: TipoCentroCosto.ADMINISTRATIVO,
      [TipoCentroCostoDto.comercial]: TipoCentroCosto.COMERCIAL,
      [TipoCentroCostoDto.logistico]: TipoCentroCosto.LOGISTICO,
      [TipoCentroCostoDto.tercerizado]: TipoCentroCosto.TERCERIZADO,
    };

    return mapping[tipo];
  }

  private fromPrismaTipoCentro(tipo: TipoCentroCosto) {
    const mapping: Record<TipoCentroCosto, TipoCentroCostoDto> = {
      [TipoCentroCosto.PRODUCTIVO]: TipoCentroCostoDto.productivo,
      [TipoCentroCosto.APOYO]: TipoCentroCostoDto.apoyo,
      [TipoCentroCosto.ADMINISTRATIVO]: TipoCentroCostoDto.administrativo,
      [TipoCentroCosto.COMERCIAL]: TipoCentroCostoDto.comercial,
      [TipoCentroCosto.LOGISTICO]: TipoCentroCostoDto.logistico,
      [TipoCentroCosto.TERCERIZADO]: TipoCentroCostoDto.tercerizado,
    };

    return mapping[tipo];
  }

  private toPrismaCategoria(categoria: CategoriaGraficaCentroCostoDto) {
    const mapping: Record<
      CategoriaGraficaCentroCostoDto,
      CategoriaGraficaCentroCosto
    > = {
      [CategoriaGraficaCentroCostoDto.preprensa]:
        CategoriaGraficaCentroCosto.PREPRENSA,
      [CategoriaGraficaCentroCostoDto.impresion]:
        CategoriaGraficaCentroCosto.IMPRESION,
      [CategoriaGraficaCentroCostoDto.terminacion]:
        CategoriaGraficaCentroCosto.TERMINACION,
      [CategoriaGraficaCentroCostoDto.empaque]:
        CategoriaGraficaCentroCosto.EMPAQUE,
      [CategoriaGraficaCentroCostoDto.logistica]:
        CategoriaGraficaCentroCosto.LOGISTICA,
      [CategoriaGraficaCentroCostoDto.calidad]:
        CategoriaGraficaCentroCosto.CALIDAD,
      [CategoriaGraficaCentroCostoDto.mantenimiento]:
        CategoriaGraficaCentroCosto.MANTENIMIENTO,
      [CategoriaGraficaCentroCostoDto.administracion]:
        CategoriaGraficaCentroCosto.ADMINISTRACION,
      [CategoriaGraficaCentroCostoDto.comercial]:
        CategoriaGraficaCentroCosto.COMERCIAL,
      [CategoriaGraficaCentroCostoDto.tercerizado]:
        CategoriaGraficaCentroCosto.TERCERIZADO,
    };

    return mapping[categoria];
  }

  private fromPrismaCategoria(categoria: CategoriaGraficaCentroCosto) {
    const mapping: Record<
      CategoriaGraficaCentroCosto,
      CategoriaGraficaCentroCostoDto
    > = {
      [CategoriaGraficaCentroCosto.PREPRENSA]:
        CategoriaGraficaCentroCostoDto.preprensa,
      [CategoriaGraficaCentroCosto.IMPRESION]:
        CategoriaGraficaCentroCostoDto.impresion,
      [CategoriaGraficaCentroCosto.TERMINACION]:
        CategoriaGraficaCentroCostoDto.terminacion,
      [CategoriaGraficaCentroCosto.EMPAQUE]:
        CategoriaGraficaCentroCostoDto.empaque,
      [CategoriaGraficaCentroCosto.LOGISTICA]:
        CategoriaGraficaCentroCostoDto.logistica,
      [CategoriaGraficaCentroCosto.CALIDAD]:
        CategoriaGraficaCentroCostoDto.calidad,
      [CategoriaGraficaCentroCosto.MANTENIMIENTO]:
        CategoriaGraficaCentroCostoDto.mantenimiento,
      [CategoriaGraficaCentroCosto.ADMINISTRACION]:
        CategoriaGraficaCentroCostoDto.administracion,
      [CategoriaGraficaCentroCosto.COMERCIAL]:
        CategoriaGraficaCentroCostoDto.comercial,
      [CategoriaGraficaCentroCosto.TERCERIZADO]:
        CategoriaGraficaCentroCostoDto.tercerizado,
    };

    return mapping[categoria];
  }

  private toPrismaImputacion(imputacion: ImputacionPreferidaCentroCostoDto) {
    const mapping: Record<
      ImputacionPreferidaCentroCostoDto,
      ImputacionPreferidaCentroCosto
    > = {
      [ImputacionPreferidaCentroCostoDto.directa]:
        ImputacionPreferidaCentroCosto.DIRECTA,
      [ImputacionPreferidaCentroCostoDto.indirecta]:
        ImputacionPreferidaCentroCosto.INDIRECTA,
      [ImputacionPreferidaCentroCostoDto.reparto]:
        ImputacionPreferidaCentroCosto.REPARTO,
    };

    return mapping[imputacion];
  }

  private fromPrismaImputacion(imputacion: ImputacionPreferidaCentroCosto) {
    const mapping: Record<
      ImputacionPreferidaCentroCosto,
      ImputacionPreferidaCentroCostoDto
    > = {
      [ImputacionPreferidaCentroCosto.DIRECTA]:
        ImputacionPreferidaCentroCostoDto.directa,
      [ImputacionPreferidaCentroCosto.INDIRECTA]:
        ImputacionPreferidaCentroCostoDto.indirecta,
      [ImputacionPreferidaCentroCosto.REPARTO]:
        ImputacionPreferidaCentroCostoDto.reparto,
    };

    return mapping[imputacion];
  }

  private toPrismaUnidadBase(unidad: UnidadBaseCentroCostoDto) {
    const mapping: Record<UnidadBaseCentroCostoDto, UnidadBaseCentroCosto> = {
      [UnidadBaseCentroCostoDto.ninguna]: UnidadBaseCentroCosto.NINGUNA,
      [UnidadBaseCentroCostoDto.hora_maquina]:
        UnidadBaseCentroCosto.HORA_MAQUINA,
      [UnidadBaseCentroCostoDto.hora_hombre]: UnidadBaseCentroCosto.HORA_HOMBRE,
      [UnidadBaseCentroCostoDto.pliego]: UnidadBaseCentroCosto.PLIEGO,
      [UnidadBaseCentroCostoDto.unidad]: UnidadBaseCentroCosto.UNIDAD,
      [UnidadBaseCentroCostoDto.m2]: UnidadBaseCentroCosto.M2,
      [UnidadBaseCentroCostoDto.kg]: UnidadBaseCentroCosto.KG,
    };

    return mapping[unidad];
  }

  private fromPrismaUnidadBase(unidad: UnidadBaseCentroCosto) {
    const mapping: Record<UnidadBaseCentroCosto, UnidadBaseCentroCostoDto> = {
      [UnidadBaseCentroCosto.NINGUNA]: UnidadBaseCentroCostoDto.ninguna,
      [UnidadBaseCentroCosto.HORA_MAQUINA]:
        UnidadBaseCentroCostoDto.hora_maquina,
      [UnidadBaseCentroCosto.HORA_HOMBRE]: UnidadBaseCentroCostoDto.hora_hombre,
      [UnidadBaseCentroCosto.PLIEGO]: UnidadBaseCentroCostoDto.pliego,
      [UnidadBaseCentroCosto.UNIDAD]: UnidadBaseCentroCostoDto.unidad,
      [UnidadBaseCentroCosto.M2]: UnidadBaseCentroCostoDto.m2,
      [UnidadBaseCentroCosto.KG]: UnidadBaseCentroCostoDto.kg,
    };

    return mapping[unidad];
  }

  private toPrismaTipoRecurso(tipo: TipoRecursoCentroCostoDto) {
    const mapping: Record<TipoRecursoCentroCostoDto, TipoRecursoCentroCosto> = {
      [TipoRecursoCentroCostoDto.empleado]: TipoRecursoCentroCosto.EMPLEADO,
      [TipoRecursoCentroCostoDto.maquinaria]: TipoRecursoCentroCosto.MAQUINARIA,
      [TipoRecursoCentroCostoDto.proveedor]: TipoRecursoCentroCosto.PROVEEDOR,
      [TipoRecursoCentroCostoDto.gasto_manual]:
        TipoRecursoCentroCosto.GASTO_MANUAL,
    };

    return mapping[tipo];
  }

  private fromPrismaTipoRecurso(tipo: TipoRecursoCentroCosto) {
    const mapping: Record<TipoRecursoCentroCosto, TipoRecursoCentroCostoDto> = {
      [TipoRecursoCentroCosto.EMPLEADO]: TipoRecursoCentroCostoDto.empleado,
      [TipoRecursoCentroCosto.MAQUINARIA]: TipoRecursoCentroCostoDto.maquinaria,
      [TipoRecursoCentroCosto.PROVEEDOR]: TipoRecursoCentroCostoDto.proveedor,
      [TipoRecursoCentroCosto.GASTO_MANUAL]:
        TipoRecursoCentroCostoDto.gasto_manual,
    };

    return mapping[tipo];
  }

  private toPrismaCategoriaComponente(
    categoria: CategoriaComponenteCostoCentroDto,
  ) {
    const mapping: Record<
      CategoriaComponenteCostoCentroDto,
      CategoriaComponenteCostoCentro
    > = {
      [CategoriaComponenteCostoCentroDto.sueldos]:
        CategoriaComponenteCostoCentro.SUELDOS,
      [CategoriaComponenteCostoCentroDto.cargas]:
        CategoriaComponenteCostoCentro.CARGAS,
      [CategoriaComponenteCostoCentroDto.mantenimiento]:
        CategoriaComponenteCostoCentro.MANTENIMIENTO,
      [CategoriaComponenteCostoCentroDto.energia]:
        CategoriaComponenteCostoCentro.ENERGIA,
      [CategoriaComponenteCostoCentroDto.alquiler]:
        CategoriaComponenteCostoCentro.ALQUILER,
      [CategoriaComponenteCostoCentroDto.amortizacion]:
        CategoriaComponenteCostoCentro.AMORTIZACION,
      [CategoriaComponenteCostoCentroDto.tercerizacion]:
        CategoriaComponenteCostoCentro.TERCERIZACION,
      [CategoriaComponenteCostoCentroDto.insumos_indirectos]:
        CategoriaComponenteCostoCentro.INSUMOS_INDIRECTOS,
      [CategoriaComponenteCostoCentroDto.otros]:
        CategoriaComponenteCostoCentro.OTROS,
    };

    return mapping[categoria];
  }

  private fromPrismaCategoriaComponente(
    categoria: CategoriaComponenteCostoCentro,
  ) {
    const mapping: Record<
      CategoriaComponenteCostoCentro,
      CategoriaComponenteCostoCentroDto
    > = {
      [CategoriaComponenteCostoCentro.SUELDOS]:
        CategoriaComponenteCostoCentroDto.sueldos,
      [CategoriaComponenteCostoCentro.CARGAS]:
        CategoriaComponenteCostoCentroDto.cargas,
      [CategoriaComponenteCostoCentro.MANTENIMIENTO]:
        CategoriaComponenteCostoCentroDto.mantenimiento,
      [CategoriaComponenteCostoCentro.ENERGIA]:
        CategoriaComponenteCostoCentroDto.energia,
      [CategoriaComponenteCostoCentro.ALQUILER]:
        CategoriaComponenteCostoCentroDto.alquiler,
      [CategoriaComponenteCostoCentro.AMORTIZACION]:
        CategoriaComponenteCostoCentroDto.amortizacion,
      [CategoriaComponenteCostoCentro.TERCERIZACION]:
        CategoriaComponenteCostoCentroDto.tercerizacion,
      [CategoriaComponenteCostoCentro.INSUMOS_INDIRECTOS]:
        CategoriaComponenteCostoCentroDto.insumos_indirectos,
      [CategoriaComponenteCostoCentro.OTROS]:
        CategoriaComponenteCostoCentroDto.otros,
    };

    return mapping[categoria];
  }

  private toPrismaOrigenComponente(origen: OrigenComponenteCostoCentroDto) {
    const mapping: Record<
      OrigenComponenteCostoCentroDto,
      OrigenComponenteCostoCentro
    > = {
      [OrigenComponenteCostoCentroDto.manual]:
        OrigenComponenteCostoCentro.MANUAL,
      [OrigenComponenteCostoCentroDto.sugerido]:
        OrigenComponenteCostoCentro.SUGERIDO,
    };

    return mapping[origen];
  }

  private fromPrismaOrigenComponente(origen: OrigenComponenteCostoCentro) {
    const mapping: Record<
      OrigenComponenteCostoCentro,
      OrigenComponenteCostoCentroDto
    > = {
      [OrigenComponenteCostoCentro.MANUAL]:
        OrigenComponenteCostoCentroDto.manual,
      [OrigenComponenteCostoCentro.SUGERIDO]:
        OrigenComponenteCostoCentroDto.sugerido,
    };

    return mapping[origen];
  }

  private fromPrismaEstadoTarifa(estado: EstadoTarifaCentroCostoPeriodo) {
    const mapping: Record<
      EstadoTarifaCentroCostoPeriodo,
      'borrador' | 'publicada'
    > = {
      [EstadoTarifaCentroCostoPeriodo.BORRADOR]: 'borrador',
      [EstadoTarifaCentroCostoPeriodo.PUBLICADA]: 'publicada',
    };

    return mapping[estado];
  }

  private handleWriteError(
    error: unknown,
    entity: 'planta' | 'area' | 'centro',
  ): never {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const messages = {
        planta: 'Ya existe una planta con ese codigo en la empresa actual.',
        area: 'Ya existe un area con ese codigo en la planta seleccionada.',
        centro:
          'Ya existe un centro de costo con ese codigo en la empresa actual.',
      } as const;

      throw new ConflictException(messages[entity]);
    }

    throw error;
  }
}
