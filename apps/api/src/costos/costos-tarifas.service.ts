import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoTarifaCentroCostoPeriodo,
  ImputacionPreferidaCentroCosto,
  Prisma,
  TipoCentroCosto,
  TipoRecursoCentroCosto,
  UnidadBaseCentroCosto,
} from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CentroConfiguracionCompleta,
  TarifaSnapshot,
} from './costos.types';
import { CostosMapper } from './costos.mapper';
import { CostosRepartoService } from './costos-reparto.service';
import { CostosValidacionesService } from './costos-validaciones.service';

@Injectable()
export class CostosTarifasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: CostosMapper,
    private readonly reparto: CostosRepartoService,
    private readonly validaciones: CostosValidacionesService,
  ) {}

  async calcularTarifaCentro(auth: CurrentAuth, id: string, periodo: string) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
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
      tarifaBorrador: this.mapper.toTarifaResponse(tarifa),
      advertencias: snapshot.advertencias,
    };
  }

  async publicarTarifaCentro(auth: CurrentAuth, id: string, periodo: string) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
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

    if (
      snapshot.centro.imputacionPreferida ===
      ImputacionPreferidaCentroCosto.REPARTO
    ) {
      await this.republishTarifasCentrosProductivos(auth, normalizedPeriodo);
    }

    return this.mapper.toTarifaResponse(publicada);
  }

  async getCentroTarifas(auth: CurrentAuth, id: string) {
    await this.validaciones.findCentroOrThrow(auth, id);

    const tarifas = await this.prisma.centroCostoTarifaPeriodo.findMany({
      where: {
        tenantId: auth.tenantId,
        centroCostoId: id,
      },
      orderBy: [{ periodo: 'desc' }, { createdAt: 'desc' }],
    });

    return tarifas.map((tarifa) => this.mapper.toTarifaResponse(tarifa));
  }

  async buildTarifaSnapshot(
    auth: CurrentAuth,
    centroCostoId: string,
    periodo: string,
  ): Promise<TarifaSnapshot> {
    const repartoPeriodo = await this.reparto.computeRepartoPeriodo(
      auth,
      periodo,
    );
    const centro = await this.getCentroConfiguracionEntity(
      auth,
      centroCostoId,
      periodo,
    );
    const costoMensualBase = centro.componentesCostoPeriodo.reduce(
      (acc, item) => acc.plus(item.importeMensual),
      new Prisma.Decimal(0),
    );
    const costoMensualMaquinaria = centro.recursos
      .filter(
        (recurso) =>
          recurso.activo &&
          recurso.tipoRecurso === TipoRecursoCentroCosto.MAQUINARIA,
      )
      .reduce(
        (acc, recurso) =>
          acc.plus(recurso.maquinariaPeriodo[0]?.costoMensualTotalCalc ?? 0),
        new Prisma.Decimal(0),
      );
    const costoMensualGastosGenerales = centro.recursos
      .filter(
        (recurso) =>
          recurso.activo &&
          recurso.tipoRecurso === TipoRecursoCentroCosto.GASTO_GENERAL,
      )
      .reduce(
        (acc, recurso) => acc.plus(recurso.valorMensual ?? 0),
        new Prisma.Decimal(0),
      );
    const costoMensualActivosFijos = centro.recursos
      .filter(
        (recurso) =>
          recurso.activo &&
          recurso.tipoRecurso === TipoRecursoCentroCosto.ACTIVO_FIJO,
      )
      .reduce(
        (acc, recurso) => acc.plus(recurso.depreciacionMensualCalc ?? 0),
        new Prisma.Decimal(0),
      );
    const costoMensualTotal = costoMensualBase
      .plus(costoMensualMaquinaria)
      .plus(costoMensualGastosGenerales)
      .plus(costoMensualActivosFijos);
    const costoMensualAbsorbidoReparto =
      repartoPeriodo.absorbidoByCentroId.get(centroCostoId) ??
      new Prisma.Decimal(0);
    const advertencias = this.buildAdvertencias(
      centro,
      periodo,
      costoMensualAbsorbidoReparto,
    );
    const desgloseRepartoAbsorbido =
      repartoPeriodo.desgloseByCentroId.get(centroCostoId) ?? [];
    const costoMensualTotalConReparto = costoMensualTotal.plus(
      costoMensualAbsorbidoReparto,
    );
    const capacidadPractica =
      centro.capacidadesPeriodo[0]?.capacidadPractica ?? new Prisma.Decimal(0);
    const tarifaCalculada =
      costoMensualTotalConReparto.gt(0) && capacidadPractica.gt(0)
        ? costoMensualTotalConReparto.div(capacidadPractica)
        : new Prisma.Decimal(0);
    const tarifaDirectaSinReparto =
      costoMensualTotal.gt(0) && capacidadPractica.gt(0)
        ? costoMensualTotal.div(capacidadPractica)
        : new Prisma.Decimal(0);
    const tarifaAbsorbidaReparto =
      costoMensualAbsorbidoReparto.gt(0) && capacidadPractica.gt(0)
        ? costoMensualAbsorbidoReparto.div(capacidadPractica)
        : new Prisma.Decimal(0);
    const validaParaPublicar =
      costoMensualTotalConReparto.gt(0) && capacidadPractica.gt(0);

    return {
      centro,
      periodo,
      costoMensualTotal: costoMensualTotalConReparto,
      capacidadPractica,
      tarifaCalculada,
      advertencias,
      validaParaPublicar,
      resumenJson: {
        periodo,
        centroCodigo: centro.codigo,
        centroNombre: centro.nombre,
        unidadBase: this.mapper.fromPrismaUnidadBase(centro.unidadBaseFutura),
        costoMensualBase: this.mapper.decimalToNumber(costoMensualBase),
        costoMensualMaquinaria: this.mapper.decimalToNumber(
          costoMensualMaquinaria,
        ),
        costoMensualGastosGenerales: this.mapper.decimalToNumber(
          costoMensualGastosGenerales,
        ),
        costoMensualActivosFijos: this.mapper.decimalToNumber(
          costoMensualActivosFijos,
        ),
        costoMensualSinReparto: this.mapper.decimalToNumber(costoMensualTotal),
        costoMensualAbsorbidoReparto: this.mapper.decimalToNumber(
          costoMensualAbsorbidoReparto,
        ),
        desgloseRepartoAbsorbido,
        costoMensualTotal: this.mapper.decimalToNumber(
          costoMensualTotalConReparto,
        ),
        tarifaDirectaSinReparto: this.mapper.decimalToNumber(
          tarifaDirectaSinReparto,
        ),
        tarifaAbsorbidaReparto: this.mapper.decimalToNumber(
          tarifaAbsorbidaReparto,
        ),
        capacidadPractica: this.mapper.decimalToNumber(capacidadPractica),
        tarifaCalculada: this.mapper.decimalToNumber(tarifaCalculada),
        advertencias,
      },
    };
  }

  async getCentroConfiguracionEntity(
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
        recursos: {
          where: { periodo },
          include: {
            empleado: true,
            maquina: true,
            maquinariaPeriodo: {
              where: { periodo },
              orderBy: [{ createdAt: 'desc' }],
              take: 1,
            },
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

  buildAdvertencias(
    centro: CentroConfiguracionCompleta,
    periodo: string,
    costoMensualAbsorbidoReparto: Prisma.Decimal = new Prisma.Decimal(0),
  ) {
    const advertencias: string[] = [];
    const recursosActivos = centro.recursos.filter((recurso) => recurso.activo);
    const costoMensualTotal = this.reparto
      .computeCostoMensualDirectoCentro(centro)
      .plus(costoMensualAbsorbidoReparto);
    const capacidad = centro.capacidadesPeriodo[0] ?? null;
    const recursosMaquinariaActivos = centro.recursos.filter(
      (recurso) =>
        recurso.activo &&
        recurso.tipoRecurso === TipoRecursoCentroCosto.MAQUINARIA,
    );

    if (centro.unidadBaseFutura === UnidadBaseCentroCosto.NINGUNA) {
      advertencias.push(
        'Conviene definir como queres medir este centro para que la tarifa sea util despues.',
      );
    }

    if (
      centro.tipoCentro === TipoCentroCosto.PRODUCTIVO &&
      centro.imputacionPreferida === ImputacionPreferidaCentroCosto.REPARTO
    ) {
      advertencias.push(
        'Este centro productivo esta configurado como fuente de reparto; no se repartira a si mismo.',
      );
    }

    if (recursosActivos.length === 0) {
      advertencias.push(
        'Todavia no cargaste que personas, maquinas, gastos generales o activos fijos usa este sector para trabajar.',
      );
    }

    if (centro.componentesCostoPeriodo.length === 0) {
      advertencias.push(
        `Todavia no cargaste costos mensuales para ${periodo}.`,
      );
    }

    if (
      recursosMaquinariaActivos.some((recurso) => !recurso.maquinariaPeriodo[0])
    ) {
      advertencias.push(
        'Hay maquinaria activa en recursos sin parámetros de amortización/energía para este período.',
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

    return advertencias;
  }

  private async republishTarifasCentrosProductivos(
    auth: CurrentAuth,
    periodo: string,
  ) {
    const centrosProductivos = await this.prisma.centroCosto.findMany({
      where: {
        tenantId: auth.tenantId,
        activo: true,
        tipoCentro: TipoCentroCosto.PRODUCTIVO,
      },
      select: { id: true },
    });

    for (const centro of centrosProductivos) {
      const snapshot = await this.buildTarifaSnapshot(auth, centro.id, periodo);

      if (!snapshot.validaParaPublicar) {
        continue;
      }

      await this.prisma.centroCostoTarifaPeriodo.upsert({
        where: {
          tenantId_centroCostoId_periodo_estado: {
            tenantId: auth.tenantId,
            centroCostoId: centro.id,
            periodo,
            estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
          },
        },
        create: {
          tenantId: auth.tenantId,
          centroCostoId: centro.id,
          periodo,
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

      await this.prisma.centroCostoTarifaPeriodo.upsert({
        where: {
          tenantId_centroCostoId_periodo_estado: {
            tenantId: auth.tenantId,
            centroCostoId: centro.id,
            periodo,
            estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
          },
        },
        create: {
          tenantId: auth.tenantId,
          centroCostoId: centro.id,
          periodo,
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
    }
  }
}
