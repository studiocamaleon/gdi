import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoTarifaCentroCostoPeriodo,
  Prisma,
  SeccionCentroCostoLinea,
  TipoCentroCosto,
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
        costoMensualManoObra: snapshot.costoMensualManoObra,
        tarifaManoObra: snapshot.tarifaManoObra,
        estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
        resumenJson: snapshot.resumenJson,
      },
      update: {
        costoMensualTotal: snapshot.costoMensualTotal,
        capacidadPractica: snapshot.capacidadPractica,
        tarifaCalculada: snapshot.tarifaCalculada,
        costoMensualManoObra: snapshot.costoMensualManoObra,
        tarifaManoObra: snapshot.tarifaManoObra,
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
        costoMensualManoObra: snapshot.costoMensualManoObra,
        tarifaManoObra: snapshot.tarifaManoObra,
        estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
        resumenJson: snapshot.resumenJson,
      },
      update: {
        costoMensualTotal: snapshot.costoMensualTotal,
        capacidadPractica: snapshot.capacidadPractica,
        tarifaCalculada: snapshot.tarifaCalculada,
        costoMensualManoObra: snapshot.costoMensualManoObra,
        tarifaManoObra: snapshot.tarifaManoObra,
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
        costoMensualManoObra: snapshot.costoMensualManoObra,
        tarifaManoObra: snapshot.tarifaManoObra,
        estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
        resumenJson: snapshot.resumenJson,
      },
      update: {
        costoMensualTotal: snapshot.costoMensualTotal,
        capacidadPractica: snapshot.capacidadPractica,
        tarifaCalculada: snapshot.tarifaCalculada,
        costoMensualManoObra: snapshot.costoMensualManoObra,
        tarifaManoObra: snapshot.tarifaManoObra,
        resumenJson: snapshot.resumenJson,
      },
    });

    if (snapshot.centro.tipoCentro === TipoCentroCosto.NO_PRODUCTIVO) {
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
    // Una sola planilla, tres secciones. Antes esto sumaba cuatro orígenes
    // distintos —componentes, maquinaria, gastos generales y activos fijos—,
    // cada uno con su propia forma de derivar el importe.
    const sumar = (seccion: SeccionCentroCostoLinea) =>
      centro.lineas
        .filter((linea) => linea.seccion === seccion)
        .reduce((acc, linea) => acc.plus(linea.importeMensual), new Prisma.Decimal(0));

    const costoMensualGastosGenerales = sumar(
      SeccionCentroCostoLinea.GASTO_GENERAL,
    );
    // Mano de obra = las líneas de empleado. Se persiste aparte para poder
    // cobrar la hora hombre sólo sobre setup/cleanup y no sobre el runtime de
    // máquina. Detectarla por sección es más firme que por categoría, que
    // dependía de que la nómina hubiera etiquetado bien.
    // Ver docs/hora-hombre-setup-cleanup-diseno.md
    const costoMensualManoObra = sumar(SeccionCentroCostoLinea.EMPLEADO);
    const costoMensualActivosFijos = sumar(
      SeccionCentroCostoLinea.ACTIVO_FIJO,
    );
    const costoMensualTotal = costoMensualGastosGenerales
      .plus(costoMensualManoObra)
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
    // Las horas del período, cargadas a mano. `capacidadPractica` se conserva
    // como nombre en el snapshot porque es el contrato con el motor y el ETA.
    const capacidad = centro.capacidadesPeriodo[0];
    const capacidadPractica = capacidad?.horasProductivas ?? new Prisma.Decimal(0);
    const tarifaCalculada =
      costoMensualTotalConReparto.gt(0) && capacidadPractica.gt(0)
        ? costoMensualTotalConReparto.div(capacidadPractica)
        : new Prisma.Decimal(0);
    const tarifaManoObra =
      costoMensualManoObra.gt(0) && capacidadPractica.gt(0)
        ? costoMensualManoObra.div(capacidadPractica)
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
      costoMensualManoObra,
      tarifaManoObra,
      advertencias,
      validaParaPublicar,
      resumenJson: {
        periodo,
        centroCodigo: centro.codigo,
        centroNombre: centro.nombre,
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
        costoMensualManoObra:
          this.mapper.decimalToNumber(costoMensualManoObra),
        tarifaManoObra: this.mapper.decimalToNumber(tarifaManoObra),
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
        lineas: {
          where: { periodo },
          orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
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
    const costoMensualTotal = this.reparto
      .computeCostoMensualDirectoCentro(centro)
      .plus(costoMensualAbsorbidoReparto);
    const capacidad = centro.capacidadesPeriodo[0] ?? null;

    if (centro.lineas.length === 0) {
      advertencias.push(
        `Todavia no cargaste gastos, empleados ni activos fijos para ${periodo}.`,
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
    } else if (!capacidad.horasProductivas.gt(0)) {
      advertencias.push(
        'Las horas productivas deben ser mayores a 0 para poder publicar una tarifa.',
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
