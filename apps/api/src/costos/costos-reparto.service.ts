import { Injectable } from '@nestjs/common';
import { Prisma, TipoCentroCosto } from '@prisma/client';
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
        lineas: {
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
        distribuidoByCentroId: new Map(),
      };
    }

    // Todo lo que no produce es estructura, y la estructura se reparte entre
    // los que producen. Antes hacía falta un segundo campo para decir esto.
    const fuentes = centros
      .filter((item) => item.tipoCentro === TipoCentroCosto.NO_PRODUCTIVO)
      .map((item) => ({
        ...item,
        costoMensualDirecto: this.computeCostoMensualDirectoCentro(item),
      }))
      .filter((item) => item.costoMensualDirecto.gt(0));

    if (fuentes.length === 0) {
      return {
        absorbidoByCentroId: new Map(),
        desgloseByCentroId: new Map(),
        distribuidoByCentroId: new Map(),
      };
    }

    // El peso del reparto es el gasto propio de cada centro productivo, no sus
    // horas. Un centro que gasta el doble absorbe el doble de la estructura,
    // sin depender de que las horas estén bien cargadas para no distorsionar.
    // Ver docs/centros-de-costo-carga-manual-diseno.md, decisión 4.
    const baseByTarget = new Map<string, Prisma.Decimal>();
    for (const target of centrosObjetivo) {
      const gastoPropio = this.computeCostoMensualDirectoCentro(target);
      baseByTarget.set(
        target.id,
        gastoPropio.gt(0) ? gastoPropio : new Prisma.Decimal(0),
      );
    }

    const absorbidoByCentroId = new Map<string, Prisma.Decimal>();
    const desgloseByCentroId = new Map<string, RepartoAbsorbidoItem[]>();
    const distribuidoByCentroId = new Map<string, Prisma.Decimal>();

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

      // Lo efectivamente asignado, no el costo de la fuente: si algún monto se
      // hubiera recortado a cero, el total del listado seguiría cuadrando.
      distribuidoByCentroId.set(fuente.id, asignadoAcumulado);
    }

    return {
      absorbidoByCentroId,
      desgloseByCentroId,
      distribuidoByCentroId,
    };
  }

  /**
   * El gasto propio del centro: la suma de su planilla, sin lo que absorbe de
   * los centros de estructura. Antes había que sumar cuatro orígenes distintos
   * (componentes, maquinaria, gastos generales y activos fijos); ahora es una
   * sola lista de líneas cargadas a mano.
   */
  computeCostoMensualDirectoCentro(
    centro: Prisma.CentroCostoGetPayload<{ include: { lineas: true } }>,
  ) {
    return centro.lineas.reduce(
      (acc, linea) => acc.plus(linea.importeMensual),
      new Prisma.Decimal(0),
    );
  }
}
