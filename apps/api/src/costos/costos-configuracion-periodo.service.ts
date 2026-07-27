import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EstadoTarifaCentroCostoPeriodo,
  ImputacionPreferidaCentroCosto,
  Prisma,
} from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CostosCatalogoService } from './costos-catalogo.service';
import { CostosMapper } from './costos.mapper';
import { CostosRepartoService } from './costos-reparto.service';
import { CostosTarifasService } from './costos-tarifas.service';
import { CostosValidacionesService } from './costos-validaciones.service';
import { ReplaceCentroLineasDto } from './dto/replace-centro-lineas.dto';
import { UpsertCentroCapacidadDto } from './dto/upsert-centro-capacidad.dto';
import { UpsertCentroConfiguracionBaseDto } from './dto/upsert-centro-configuracion-base.dto';

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
    const [centro, repartoPeriodo] = await Promise.all([
      this.tarifas.getCentroConfiguracionEntity(auth, id, normalizedPeriodo),
      this.reparto.computeRepartoPeriodo(auth, normalizedPeriodo),
    ]);
    const tarifaBorrador =
      centro.tarifasPeriodo.find(
        (tarifa) => tarifa.estado === EstadoTarifaCentroCostoPeriodo.BORRADOR,
      ) ?? null;
    const tarifaPublicada =
      centro.tarifasPeriodo.find(
        (tarifa) => tarifa.estado === EstadoTarifaCentroCostoPeriodo.PUBLICADA,
      ) ?? null;
    const costoMensualAbsorbidoReparto =
      repartoPeriodo.absorbidoByCentroId.get(id) ?? new Prisma.Decimal(0);

    return {
      periodo: normalizedPeriodo,
      centro: this.mapper.toCentroResponse(centro),
      /** La planilla del período: lo que edita la ficha y lo que costea el motor. */
      lineas: centro.lineas.map((linea) => this.mapper.toLineaResponse(linea)),
      capacidad: centro.capacidadesPeriodo[0]
        ? this.mapper.toCapacidadResponse(centro.capacidadesPeriodo[0])
        : null,
      tarifaBorrador: tarifaBorrador
        ? this.mapper.toTarifaResponse(tarifaBorrador)
        : null,
      tarifaPublicada: tarifaPublicada
        ? this.mapper.toTarifaResponse(tarifaPublicada)
        : null,
      repartoAbsorbido: {
        total: this.mapper.decimalToNumber(costoMensualAbsorbidoReparto),
        desglose: repartoPeriodo.desgloseByCentroId.get(id) ?? [],
      },
      advertencias: this.tarifas.buildAdvertencias(
        centro,
        normalizedPeriodo,
        costoMensualAbsorbidoReparto,
      ),
    };
  }

  updateCentroConfiguracionBase(
    auth: CurrentAuth,
    id: string,
    payload: UpsertCentroConfiguracionBaseDto,
  ) {
    return this.catalogo.updateCentro(auth, id, payload);
  }

  async getResumenCentros(auth: CurrentAuth, periodo: string) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    const [centros, reparto] = await Promise.all([
      this.prisma.centroCosto.findMany({
        where: { tenantId: auth.tenantId, activo: true },
        include: {
          lineas: { where: { periodo: normalizedPeriodo } },
          capacidadesPeriodo: {
            where: { periodo: normalizedPeriodo },
            take: 1,
          },
        },
        orderBy: [{ nombre: 'asc' }],
      }),
      this.reparto.computeRepartoPeriodo(auth, normalizedPeriodo),
    ]);

    const filas = centros.map((centro) => {
      const gastos = centro.lineas.reduce(
        (acc, linea) => acc.plus(linea.importeMensual),
        new Prisma.Decimal(0),
      );
      const absorbido =
        reparto.absorbidoByCentroId.get(centro.id) ?? new Prisma.Decimal(0);
      const prorrateado =
        reparto.distribuidoByCentroId.get(centro.id) ?? new Prisma.Decimal(0);
      // El gasto total NO le resta lo prorrateado: "Prorrateado" es informativo
      // —cuánto mandó a los productivos— y el total sigue siendo lo que el
      // centro cuesta. Para un centro de estructura las dos columnas coinciden.
      const gastoTotal = gastos.plus(absorbido);
      // Un centro que reparte su costo entero no tiene valor hora: lo que cuesta
      // ya se cobra dentro de los productivos que lo absorbieron. Mostrarle una
      // tarifa invitaría a cobrarlo dos veces.
      const esFuenteDeReparto =
        centro.imputacionPreferida === ImputacionPreferidaCentroCosto.REPARTO;
      const horas = centro.capacidadesPeriodo[0]?.horasProductivas ?? null;
      const tieneHoras = !esFuenteDeReparto && horas != null && horas.gt(0);

      return {
        id: centro.id,
        codigo: centro.codigo,
        nombre: centro.nombre,
        tipoCentro: this.mapper.fromPrismaTipoCentro(centro.tipoCentro),
        unidadBase: this.mapper.fromPrismaUnidadBase(centro.unidadBaseFutura),
        horasProductivas: tieneHoras
          ? this.mapper.decimalToNumber(horas)
          : null,
        gastos: this.mapper.decimalToNumber(gastos),
        absorbido: this.mapper.decimalToNumber(absorbido),
        prorrateado: this.mapper.decimalToNumber(prorrateado),
        gastoTotal: this.mapper.decimalToNumber(gastoTotal),
        valorHora: tieneHoras
          ? this.mapper.decimalToNumber(gastoTotal.div(horas))
          : null,
        lineas: centro.lineas.length,
      };
    });

    return {
      periodo: normalizedPeriodo,
      centros: filas,
      totales: {
        gastos: filas.reduce((acc, fila) => acc + fila.gastos, 0),
        absorbido: filas.reduce((acc, fila) => acc + fila.absorbido, 0),
        prorrateado: filas.reduce((acc, fila) => acc + fila.prorrateado, 0),
        gastoTotal: filas.reduce((acc, fila) => acc + fila.gastoTotal, 0),
      },
    };
  }

  /**
   * Reemplaza la planilla entera del período. Es una sola operación y no un
   * CRUD fila por fila porque eso es lo que hace el usuario: abre el centro,
   * toca lo que sea de las tres secciones y aprieta Guardar una vez.
   *
   * El importe de cada línea se calcula acá, nunca se toma del cliente: si el
   * total viajara, la planilla podría mostrar una cosa y costear otra.
   */
  async replaceCentroLineas(
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: ReplaceCentroLineasDto,
  ) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    await this.validaciones.findCentroOrThrow(auth, id);
    this.validaciones.validateLineas(payload.lineas);

    const data = payload.lineas.map((linea, index) =>
      this.mapper.buildLineaData(
        auth,
        id,
        normalizedPeriodo,
        linea,
        index,
      ),
    );

    const lineas = await this.prisma.$transaction(async (tx) => {
      await tx.centroCostoLinea.deleteMany({
        where: {
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo: normalizedPeriodo,
        },
      });
      if (data.length > 0) {
        await tx.centroCostoLinea.createMany({ data });
      }
      return tx.centroCostoLinea.findMany({
        where: {
          tenantId: auth.tenantId,
          centroCostoId: id,
          periodo: normalizedPeriodo,
        },
        orderBy: [{ orden: 'asc' }],
      });
    });

    return lineas.map((linea) => this.mapper.toLineaResponse(linea));
  }

  /**
   * Las horas productivas del período. Se cargan a mano: la fórmula de
   * días × horas − % no productivo se retiró con el modelo derivado.
   */
  async upsertCentroCapacidad(
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: UpsertCentroCapacidadDto,
  ) {
    const normalizedPeriodo = this.validaciones.normalizePeriodo(periodo);
    const centro = await this.validaciones.findCentroOrThrow(auth, id);
    const horasProductivas = new Prisma.Decimal(payload.horasProductivas ?? 0);

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
        horasProductivas,
      },
      update: {
        unidadBase: centro.unidadBaseFutura,
        horasProductivas,
      },
    });

    return this.mapper.toCapacidadResponse(result);
  }

}
