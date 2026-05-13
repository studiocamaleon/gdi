import { Injectable } from '@nestjs/common';
import {
  ImputacionPreferidaCentroCosto,
  Prisma,
  TipoCentroCosto,
  TipoRecursoCentroCosto,
} from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { RepartoAbsorbidoItem, RepartoPeriodo } from './costos.types';
import { CostosMapper } from './costos.mapper';

@Injectable()
export class CostosRepartoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: CostosMapper,
  ) {}

  async computeRepartoPeriodo(
    auth: CurrentAuth,
    periodo: string,
  ): Promise<RepartoPeriodo> {
    const centros = await this.prisma.centroCosto.findMany({
      where: {
        tenantId: auth.tenantId,
        activo: true,
      },
      include: {
        recursos: {
          where: { periodo, activo: true },
          include: {
            maquinariaPeriodo: {
              where: { periodo },
              orderBy: [{ createdAt: 'desc' }],
              take: 1,
            },
          },
        },
        componentesCostoPeriodo: {
          where: { periodo },
        },
        capacidadesPeriodo: {
          where: { periodo },
          take: 1,
        },
      },
    });

    const centrosObjetivo = centros.filter(
      (item) => item.tipoCentro === TipoCentroCosto.PRODUCTIVO,
    );
    if (centrosObjetivo.length === 0) {
      return {
        absorbidoByCentroId: new Map(),
        desgloseByCentroId: new Map(),
      };
    }

    const fuentes = centros
      .filter(
        (item) =>
          item.imputacionPreferida === ImputacionPreferidaCentroCosto.REPARTO,
      )
      .map((item) => ({
        ...item,
        costoMensualDirecto: this.computeCostoMensualDirectoCentro(item),
      }))
      .filter((item) => item.costoMensualDirecto.gt(0));

    if (fuentes.length === 0) {
      return {
        absorbidoByCentroId: new Map(),
        desgloseByCentroId: new Map(),
      };
    }

    const baseByTarget = new Map<string, Prisma.Decimal>();
    for (const target of centrosObjetivo) {
      const capacidad = target.capacidadesPeriodo[0]?.capacidadPractica;
      baseByTarget.set(
        target.id,
        capacidad && capacidad.gt(0) ? capacidad : new Prisma.Decimal(0),
      );
    }

    const absorbidoByCentroId = new Map<string, Prisma.Decimal>();
    const desgloseByCentroId = new Map<string, RepartoAbsorbidoItem[]>();

    for (const fuente of fuentes) {
      const targets = centrosObjetivo.filter(
        (target) => target.id !== fuente.id,
      );
      if (targets.length === 0) {
        continue;
      }

      const totalBaseFuente = targets.reduce(
        (acc, target) =>
          acc.plus(baseByTarget.get(target.id) ?? new Prisma.Decimal(0)),
        new Prisma.Decimal(0),
      );
      const usarPesosIgualesFuente = !totalBaseFuente.gt(0);
      const divisor = usarPesosIgualesFuente
        ? new Prisma.Decimal(targets.length)
        : totalBaseFuente;
      if (!divisor.gt(0)) {
        continue;
      }

      let asignadoAcumulado = new Prisma.Decimal(0);

      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        const esUltimo = index === targets.length - 1;
        const peso = usarPesosIgualesFuente
          ? new Prisma.Decimal(1)
          : (baseByTarget.get(target.id) ?? new Prisma.Decimal(0));

        let monto = esUltimo
          ? fuente.costoMensualDirecto.minus(asignadoAcumulado)
          : fuente.costoMensualDirecto.mul(peso).div(divisor);
        if (monto.lt(0)) {
          monto = new Prisma.Decimal(0);
        }

        asignadoAcumulado = asignadoAcumulado.plus(monto);
        absorbidoByCentroId.set(
          target.id,
          (absorbidoByCentroId.get(target.id) ?? new Prisma.Decimal(0)).plus(
            monto,
          ),
        );
        const desgloseActual = desgloseByCentroId.get(target.id) ?? [];
        desgloseActual.push({
          desdeCentroCostoId: fuente.id,
          desdeCentroCodigo: fuente.codigo,
          desdeCentroNombre: fuente.nombre,
          monto: this.mapper.decimalToNumber(monto),
        });
        desgloseByCentroId.set(target.id, desgloseActual);
      }
    }

    return {
      absorbidoByCentroId,
      desgloseByCentroId,
    };
  }

  computeCostoMensualDirectoCentro(
    centro: Prisma.CentroCostoGetPayload<{
      include: {
        recursos: {
          include: { maquinariaPeriodo: true };
        };
        componentesCostoPeriodo: true;
      };
    }>,
  ) {
    const costoMensualBase = centro.componentesCostoPeriodo.reduce(
      (acc, item) => acc.plus(item.importeMensual),
      new Prisma.Decimal(0),
    );
    const costoMensualMaquinaria = centro.recursos
      .filter(
        (recurso) => recurso.tipoRecurso === TipoRecursoCentroCosto.MAQUINARIA,
      )
      .reduce(
        (acc, recurso) =>
          acc.plus(recurso.maquinariaPeriodo[0]?.costoMensualTotalCalc ?? 0),
        new Prisma.Decimal(0),
      );
    const costoMensualGastosGenerales = centro.recursos
      .filter(
        (recurso) =>
          recurso.tipoRecurso === TipoRecursoCentroCosto.GASTO_GENERAL,
      )
      .reduce(
        (acc, recurso) => acc.plus(recurso.valorMensual ?? 0),
        new Prisma.Decimal(0),
      );
    const costoMensualActivosFijos = centro.recursos
      .filter(
        (recurso) => recurso.tipoRecurso === TipoRecursoCentroCosto.ACTIVO_FIJO,
      )
      .reduce(
        (acc, recurso) => acc.plus(recurso.depreciacionMensualCalc ?? 0),
        new Prisma.Decimal(0),
      );

    return costoMensualBase
      .plus(costoMensualMaquinaria)
      .plus(costoMensualGastosGenerales)
      .plus(costoMensualActivosFijos);
  }
}
