import { Injectable } from '@nestjs/common';
import {
  CategoriaComponenteCostoCentro,
  type CentroCostoLinea,
  EstadoTarifaCentroCostoPeriodo,
  ImputacionPreferidaCentroCosto,
  Prisma,
  SeccionCentroCostoLinea,
  TipoCentroCosto,
  UnidadBaseCentroCosto,
} from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import {
  ImputacionPreferidaCentroCostoDto,
  TipoCentroCostoDto,
  UnidadBaseCentroCostoDto,
  UpsertCentroCostoDto,
} from './dto/upsert-centro-costo.dto';
import {
  CategoriaComponenteCostoCentroDto,
  CentroCostoLineaItemDto,
  SeccionCentroCostoLineaDto,
} from './dto/replace-centro-lineas.dto';
import type { CentroCompleto } from './costos.types';

@Injectable()
export class CostosMapper {
  toPlantaResponse(planta: {
    id: string;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    activa: boolean;
  }) {
    return {
      id: planta.id,
      codigo: planta.codigo,
      nombre: planta.nombre,
      descripcion: planta.descripcion ?? '',
      activa: planta.activa,
    };
  }


  toCentroResponse(centro: CentroCompleto) {
    const tarifas = centro.tarifasPeriodo ?? [];
    const compareTarifas = (
      a: (typeof tarifas)[number],
      b: (typeof tarifas)[number],
    ) => {
      if (a.periodo !== b.periodo) {
        return a.periodo.localeCompare(b.periodo);
      }
      return a.updatedAt.getTime() - b.updatedAt.getTime();
    };
    const maxTarifa = (items: typeof tarifas) =>
      items.reduce<(typeof tarifas)[number] | null>(
        (max, item) => (!max || compareTarifas(item, max) > 0 ? item : max),
        null,
      );
    const ultimaTarifaPublicada = maxTarifa(
      tarifas.filter(
        (tarifa) => tarifa.estado === EstadoTarifaCentroCostoPeriodo.PUBLICADA,
      ),
    );
    const ultimaTarifaBorrador = maxTarifa(
      tarifas.filter(
        (tarifa) => tarifa.estado === EstadoTarifaCentroCostoPeriodo.BORRADOR,
      ),
    );
    const ultimaTarifa = maxTarifa(tarifas);
    const borradorPendiente =
      ultimaTarifaBorrador &&
      ultimaTarifaPublicada &&
      compareTarifas(ultimaTarifaBorrador, ultimaTarifaPublicada) > 0;
    const estadoConfiguracion = borradorPendiente
      ? 'borrador_pendiente'
      : ultimaTarifa?.estado === EstadoTarifaCentroCostoPeriodo.PUBLICADA
        ? 'publicado'
        : ultimaTarifa?.estado === EstadoTarifaCentroCostoPeriodo.BORRADOR
          ? 'borrador'
          : 'sin_configurar';
    const ultimoPeriodoConfigurado = ultimaTarifa?.periodo ?? '';
    const tarifaReferencia =
      ultimaTarifa ?? ultimaTarifaPublicada ?? ultimaTarifaBorrador;
    const resumen =
      (tarifaReferencia?.resumenJson as Record<string, unknown> | null) ?? null;
    const tarifaDirectaSinReparto =
      typeof resumen?.tarifaDirectaSinReparto === 'number'
        ? resumen.tarifaDirectaSinReparto
        : null;
    const tarifaAbsorbidaReparto =
      typeof resumen?.tarifaAbsorbidaReparto === 'number'
        ? resumen.tarifaAbsorbidaReparto
        : null;
    const tarifaTotalCalculada =
      typeof resumen?.tarifaCalculada === 'number'
        ? resumen.tarifaCalculada
        : ultimaTarifaPublicada
          ? this.decimalToNumber(ultimaTarifaPublicada.tarifaCalculada)
          : null;
    const capacidadPracticaResumen =
      typeof resumen?.capacidadPractica === 'number'
        ? resumen.capacidadPractica
        : null;
    const capacidadPracticaPersistida = centro.capacidadesPeriodo[0]
      ? this.decimalToNumber(centro.capacidadesPeriodo[0].horasProductivas)
      : null;

    return {
      id: centro.id,
      plantaId: centro.plantaId,
      plantaNombre: centro.planta.nombre,
      codigo: centro.codigo,
      nombre: centro.nombre,
      descripcion: centro.descripcion ?? '',
      tipoCentro: this.fromPrismaTipoCentro(centro.tipoCentro),
      imputacionPreferida: this.fromPrismaImputacion(
        centro.imputacionPreferida,
      ),
      unidadBaseFutura: this.fromPrismaUnidadBase(centro.unidadBaseFutura),
      activo: centro.activo,
      estadoConfiguracion,
      ultimoPeriodoConfigurado,
      ultimaTarifaPublicada: ultimaTarifaPublicada
        ? this.decimalToNumber(ultimaTarifaPublicada.tarifaCalculada)
        : null,
      unidadTarifaPublicada: ultimaTarifaPublicada
        ? this.fromPrismaUnidadBase(centro.unidadBaseFutura)
        : '',
      ultimaTarifaBase: tarifaDirectaSinReparto,
      ultimaTarifaAbsorbida: tarifaAbsorbidaReparto,
      ultimaTarifaTotal: tarifaTotalCalculada,
      ultimaCapacidadPractica:
        capacidadPracticaResumen ?? capacidadPracticaPersistida,
    };
  }



  toCapacidadResponse(
    capacidad: Prisma.CentroCostoCapacidadPeriodoGetPayload<object>,
  ) {
    return {
      id: capacidad.id,
      periodo: capacidad.periodo,
      unidadBase: this.fromPrismaUnidadBase(capacidad.unidadBase),
      horasProductivas: this.decimalToNumber(capacidad.horasProductivas),
    };
  }

  toTarifaResponse(tarifa: Prisma.CentroCostoTarifaPeriodoGetPayload<object>) {
    return {
      id: tarifa.id,
      periodo: tarifa.periodo,
      costoMensualTotal: this.decimalToNumber(tarifa.costoMensualTotal),
      capacidadPractica: this.decimalToNumber(tarifa.capacidadPractica),
      tarifaCalculada: this.decimalToNumber(tarifa.tarifaCalculada),
      costoMensualManoObra: this.decimalToNumber(tarifa.costoMensualManoObra),
      tarifaManoObra: this.decimalToNumber(tarifa.tarifaManoObra),
      estado: this.fromPrismaEstadoTarifa(tarifa.estado),
      resumen: tarifa.resumenJson,
      createdAt: tarifa.createdAt.toISOString(),
      updatedAt: tarifa.updatedAt.toISOString(),
    };
  }


  buildCreateCentroData(
    auth: CurrentAuth,
    payload: UpsertCentroCostoDto,
  ): Prisma.CentroCostoUncheckedCreateInput {
    return {
      tenantId: auth.tenantId,
      plantaId: payload.plantaId,
      codigo: payload.codigo.trim().toUpperCase(),
      nombre: payload.nombre.trim(),
      descripcion: payload.descripcion?.trim() || null,
      tipoCentro: this.toPrismaTipoCentro(payload.tipoCentro),
      imputacionPreferida: this.toPrismaImputacion(payload.imputacionPreferida),
      unidadBaseFutura: this.toPrismaUnidadBase(payload.unidadBaseFutura),
      activo: payload.activo,
    };
  }

  buildUpdateCentroData(
    payload: UpsertCentroCostoDto,
  ): Prisma.CentroCostoUncheckedUpdateInput {
    return {
      plantaId: payload.plantaId,
      codigo: payload.codigo.trim().toUpperCase(),
      nombre: payload.nombre.trim(),
      descripcion: payload.descripcion?.trim() || null,
      tipoCentro: this.toPrismaTipoCentro(payload.tipoCentro),
      imputacionPreferida: this.toPrismaImputacion(payload.imputacionPreferida),
      unidadBaseFutura: this.toPrismaUnidadBase(payload.unidadBaseFutura),
      activo: payload.activo,
    };
  }

  /**
   * El importe mensual de una línea, según su sección. Se calcula en el
   * servidor y se persiste: así la suma del centro no depende de recorrer
   * ramas, y el número guardado es el mismo que costea.
   */
  computeImporteLinea(linea: CentroCostoLineaItemDto): Prisma.Decimal {
    if (linea.seccion === SeccionCentroCostoLineaDto.empleado) {
      const salario = new Prisma.Decimal(linea.salarioMensual ?? 0);
      const cargas = new Prisma.Decimal(linea.cargasPct ?? 0).div(100);
      return salario.mul(cargas.plus(1)).toDecimalPlaces(2);
    }
    if (linea.seccion === SeccionCentroCostoLineaDto.activo_fijo) {
      const vida = linea.vidaUtilRestanteMeses ?? 0;
      if (vida <= 0) return new Prisma.Decimal(0);
      return new Prisma.Decimal(linea.valorActual ?? 0)
        .minus(linea.valorFinalVida ?? 0)
        .div(vida)
        .toDecimalPlaces(2);
    }
    return new Prisma.Decimal(linea.valorMensual ?? 0).toDecimalPlaces(2);
  }

  buildLineaData(
    auth: CurrentAuth,
    centroCostoId: string,
    periodo: string,
    linea: CentroCostoLineaItemDto,
    orden: number,
  ): Prisma.CentroCostoLineaUncheckedCreateInput {
    const esEmpleado = linea.seccion === SeccionCentroCostoLineaDto.empleado;
    const esActivoFijo =
      linea.seccion === SeccionCentroCostoLineaDto.activo_fijo;

    return {
      tenantId: auth.tenantId,
      centroCostoId,
      periodo,
      orden,
      seccion: this.toPrismaSeccionLinea(linea.seccion),
      nombre: linea.nombre.trim(),
      categoria: linea.categoria
        ? this.toPrismaCategoriaComponente(linea.categoria)
        : null,
      ocupacion: esEmpleado ? (linea.ocupacion?.trim() || null) : null,
      dedicacionPct: esEmpleado ? (linea.dedicacionPct ?? null) : null,
      salarioMensual: esEmpleado ? (linea.salarioMensual ?? 0) : null,
      cargasPct: esEmpleado ? (linea.cargasPct ?? 0) : null,
      vidaUtilRestanteMeses: esActivoFijo
        ? (linea.vidaUtilRestanteMeses ?? null)
        : null,
      valorActual: esActivoFijo ? (linea.valorActual ?? 0) : null,
      valorFinalVida: esActivoFijo ? (linea.valorFinalVida ?? 0) : null,
      importeMensual: this.computeImporteLinea(linea),
      notas: linea.notas?.trim() || null,
    };
  }

  toLineaResponse(linea: CentroCostoLinea) {
    return {
      id: linea.id,
      periodo: linea.periodo,
      seccion: this.fromPrismaSeccionLinea(linea.seccion),
      nombre: linea.nombre,
      categoria: linea.categoria
        ? this.fromPrismaCategoriaComponente(linea.categoria)
        : null,
      ocupacion: linea.ocupacion,
      dedicacionPct: linea.dedicacionPct
        ? Number(linea.dedicacionPct)
        : null,
      salarioMensual: linea.salarioMensual
        ? this.decimalToNumber(linea.salarioMensual)
        : null,
      cargasPct: linea.cargasPct ? Number(linea.cargasPct) : null,
      vidaUtilRestanteMeses: linea.vidaUtilRestanteMeses,
      valorActual: linea.valorActual
        ? this.decimalToNumber(linea.valorActual)
        : null,
      valorFinalVida: linea.valorFinalVida
        ? this.decimalToNumber(linea.valorFinalVida)
        : null,
      importeMensual: this.decimalToNumber(linea.importeMensual),
      orden: linea.orden,
      notas: linea.notas,
    };
  }

  toPrismaSeccionLinea(
    seccion: SeccionCentroCostoLineaDto,
  ): SeccionCentroCostoLinea {
    return {
      [SeccionCentroCostoLineaDto.gasto_general]:
        SeccionCentroCostoLinea.GASTO_GENERAL,
      [SeccionCentroCostoLineaDto.empleado]: SeccionCentroCostoLinea.EMPLEADO,
      [SeccionCentroCostoLineaDto.activo_fijo]:
        SeccionCentroCostoLinea.ACTIVO_FIJO,
    }[seccion];
  }

  fromPrismaSeccionLinea(
    seccion: SeccionCentroCostoLinea,
  ): SeccionCentroCostoLineaDto {
    return {
      [SeccionCentroCostoLinea.GASTO_GENERAL]:
        SeccionCentroCostoLineaDto.gasto_general,
      [SeccionCentroCostoLinea.EMPLEADO]: SeccionCentroCostoLineaDto.empleado,
      [SeccionCentroCostoLinea.ACTIVO_FIJO]:
        SeccionCentroCostoLineaDto.activo_fijo,
    }[seccion];
  }

  decimalToNumber(value: Prisma.Decimal) {
    return Number(value.toFixed(2));
  }

  toPrismaTipoCentro(tipo: TipoCentroCostoDto) {
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

  fromPrismaTipoCentro(tipo: TipoCentroCosto) {
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



  toPrismaImputacion(imputacion: ImputacionPreferidaCentroCostoDto) {
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

  fromPrismaImputacion(imputacion: ImputacionPreferidaCentroCosto) {
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

  toPrismaUnidadBase(unidad: UnidadBaseCentroCostoDto) {
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

  fromPrismaUnidadBase(unidad: UnidadBaseCentroCosto) {
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





  toPrismaCategoriaComponente(categoria: CategoriaComponenteCostoCentroDto) {
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

  fromPrismaCategoriaComponente(categoria: CategoriaComponenteCostoCentro) {
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




  fromPrismaEstadoTarifa(estado: EstadoTarifaCentroCostoPeriodo) {
    const mapping: Record<
      EstadoTarifaCentroCostoPeriodo,
      'borrador' | 'publicada'
    > = {
      [EstadoTarifaCentroCostoPeriodo.BORRADOR]: 'borrador',
      [EstadoTarifaCentroCostoPeriodo.PUBLICADA]: 'publicada',
    };
    return mapping[estado];
  }
}
