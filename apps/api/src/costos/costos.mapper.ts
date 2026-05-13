import { Injectable } from '@nestjs/common';
import {
  CategoriaComponenteCostoCentro,
  CategoriaGraficaCentroCosto,
  EstadoTarifaCentroCostoPeriodo,
  ImputacionPreferidaCentroCosto,
  MetodoDepreciacionMaquina,
  OrigenComponenteCostoCentro,
  Prisma,
  TipoCentroCosto,
  TipoGastoGeneralCentroCosto,
  TipoRecursoCentroCosto,
  UnidadBaseCentroCosto,
} from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import {
  CategoriaGraficaCentroCostoDto,
  ImputacionPreferidaCentroCostoDto,
  TipoCentroCostoDto,
  UnidadBaseCentroCostoDto,
  UpsertCentroCostoDto,
} from './dto/upsert-centro-costo.dto';
import {
  TipoGastoGeneralCentroCostoDto,
  TipoRecursoCentroCostoDto,
} from './dto/replace-centro-recursos.dto';
import {
  CategoriaComponenteCostoCentroDto,
  OrigenComponenteCostoCentroDto,
} from './dto/replace-centro-componentes-costo.dto';
import { UpsertCentroRecursosMaquinariaDto } from './dto/upsert-centro-recursos-maquinaria.dto';
import type { AreaCompleta, CentroCompleto } from './costos.types';

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

  toAreaResponse(area: AreaCompleta) {
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
      ? this.decimalToNumber(centro.capacidadesPeriodo[0].capacidadPractica)
      : null;

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

  toRecursoResponse(
    recurso: Prisma.CentroCostoRecursoGetPayload<{
      include: { empleado: true; maquina: true };
    }>,
  ) {
    return {
      id: recurso.id,
      periodo: recurso.periodo,
      tipoRecurso: this.fromPrismaTipoRecurso(recurso.tipoRecurso),
      empleadoId: recurso.empleadoId ?? '',
      empleadoNombre: recurso.empleado?.nombreCompleto ?? '',
      maquinaId: recurso.maquinaId ?? '',
      maquinaNombre: recurso.maquina?.nombre ?? '',
      nombreRecurso: recurso.nombreRecurso ?? '',
      tipoGastoGeneral: recurso.tipoGastoGeneral
        ? this.fromPrismaTipoGastoGeneral(recurso.tipoGastoGeneral)
        : '',
      valorMensual: recurso.valorMensual
        ? this.decimalToNumber(recurso.valorMensual)
        : null,
      vidaUtilRestanteMeses: recurso.vidaUtilRestanteMeses ?? null,
      valorActual: recurso.valorActual
        ? this.decimalToNumber(recurso.valorActual)
        : null,
      valorFinalVida: recurso.valorFinalVida
        ? this.decimalToNumber(recurso.valorFinalVida)
        : null,
      depreciacionMensualCalc: recurso.depreciacionMensualCalc
        ? this.decimalToNumber(recurso.depreciacionMensualCalc)
        : null,
      descripcion: recurso.descripcion ?? '',
      porcentajeAsignacion: recurso.porcentajeAsignacion
        ? this.decimalToNumber(recurso.porcentajeAsignacion)
        : null,
      activo: recurso.activo,
    };
  }

  toComponenteCostoResponse(
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

  toCapacidadResponse(
    capacidad: Prisma.CentroCostoCapacidadPeriodoGetPayload<object>,
  ) {
    return {
      id: capacidad.id,
      periodo: capacidad.periodo,
      unidadBase: this.fromPrismaUnidadBase(capacidad.unidadBase),
      diasPorMes: this.decimalToNumber(capacidad.diasPorMes),
      horasPorDia: this.decimalToNumber(capacidad.horasPorDia),
      capacidadTeorica: this.decimalToNumber(capacidad.capacidadTeorica),
      capacidadPractica: this.decimalToNumber(capacidad.capacidadPractica),
      overrideManualCapacidad: capacidad.overrideManualCapacidad
        ? this.decimalToNumber(capacidad.overrideManualCapacidad)
        : null,
    };
  }

  toTarifaResponse(tarifa: Prisma.CentroCostoTarifaPeriodoGetPayload<object>) {
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

  toRecursoMaquinariaResponse(
    item: Prisma.CentroCostoRecursoMaquinaPeriodoGetPayload<object> | undefined,
    recurso: {
      id: string;
      periodo: string;
      maquinaId: string | null;
      maquina?: { nombre: string } | null;
    },
  ) {
    const metodoDepreciacion = item
      ? this.fromPrismaMetodoDepreciacionMaquina(item.metodoDepreciacion)
      : 'lineal';
    const valorCompra = item ? this.decimalToNumber(item.valorCompra) : 0;
    const valorResidual = item ? this.decimalToNumber(item.valorResidual) : 0;
    const vidaUtilMeses = item?.vidaUtilMeses ?? 60;
    const potenciaNominalKw = item
      ? Number(item.potenciaNominalKw.toFixed(2))
      : 0;
    const factorCargaPct = item
      ? this.decimalToNumber(item.factorCargaPct)
      : 100;
    const tarifaEnergiaKwh = item
      ? Number(item.tarifaEnergiaKwh.toFixed(2))
      : 0;
    const horasProgramadasMes = item
      ? this.decimalToNumber(item.horasProgramadasMes)
      : 160;
    const disponibilidadPct = item
      ? this.decimalToNumber(item.disponibilidadPct)
      : 85;
    const eficienciaPct = item ? this.decimalToNumber(item.eficienciaPct) : 85;
    const mantenimientoMensual = item
      ? this.decimalToNumber(item.mantenimientoMensual)
      : 0;
    const segurosMensual = item ? this.decimalToNumber(item.segurosMensual) : 0;
    const otrosFijosMensual = item
      ? this.decimalToNumber(item.otrosFijosMensual)
      : 0;
    const horasProductivas = Number(
      (
        horasProgramadasMes *
        (disponibilidadPct / 100) *
        (eficienciaPct / 100)
      ).toFixed(2),
    );

    return {
      id: item?.id ?? '',
      centroCostoRecursoId: recurso.id,
      periodo: recurso.periodo,
      maquinaId: recurso.maquinaId ?? '',
      maquinaNombre: recurso.maquina?.nombre ?? '',
      metodoDepreciacion,
      valorCompra,
      valorResidual,
      vidaUtilMeses,
      potenciaNominalKw,
      factorCargaPct,
      tarifaEnergiaKwh,
      horasProgramadasMes,
      disponibilidadPct,
      eficienciaPct,
      horasProductivas,
      mantenimientoMensual,
      segurosMensual,
      otrosFijosMensual,
      amortizacionMensual: item
        ? this.decimalToNumber(item.amortizacionMensualCalc)
        : Number(
            (
              Math.max(0, valorCompra - valorResidual) /
              Math.max(1, vidaUtilMeses)
            ).toFixed(2),
          ),
      energiaMensual: item ? this.decimalToNumber(item.energiaMensualCalc) : 0,
      costoMensualTotal: item
        ? this.decimalToNumber(item.costoMensualTotalCalc)
        : 0,
      tarifaHora: item ? Number(item.tarifaHoraCalc.toFixed(2)) : 0,
      updatedAt: item?.updatedAt.toISOString() ?? '',
    };
  }

  buildCreateCentroData(
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
      activo: payload.activo,
    };
  }

  buildUpdateCentroData(
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
      activo: payload.activo,
    };
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

  toPrismaCategoria(categoria: CategoriaGraficaCentroCostoDto) {
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

  fromPrismaCategoria(categoria: CategoriaGraficaCentroCosto) {
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

  toPrismaTipoRecurso(tipo: TipoRecursoCentroCostoDto) {
    const mapping: Record<TipoRecursoCentroCostoDto, TipoRecursoCentroCosto> = {
      [TipoRecursoCentroCostoDto.empleado]: TipoRecursoCentroCosto.EMPLEADO,
      [TipoRecursoCentroCostoDto.maquinaria]: TipoRecursoCentroCosto.MAQUINARIA,
      [TipoRecursoCentroCostoDto.gasto_general]:
        TipoRecursoCentroCosto.GASTO_GENERAL,
      [TipoRecursoCentroCostoDto.activo_fijo]:
        TipoRecursoCentroCosto.ACTIVO_FIJO,
    };
    return mapping[tipo];
  }

  fromPrismaTipoRecurso(tipo: TipoRecursoCentroCosto) {
    const mapping: Record<TipoRecursoCentroCosto, TipoRecursoCentroCostoDto> = {
      [TipoRecursoCentroCosto.EMPLEADO]: TipoRecursoCentroCostoDto.empleado,
      [TipoRecursoCentroCosto.MAQUINARIA]: TipoRecursoCentroCostoDto.maquinaria,
      [TipoRecursoCentroCosto.GASTO_GENERAL]:
        TipoRecursoCentroCostoDto.gasto_general,
      [TipoRecursoCentroCosto.ACTIVO_FIJO]:
        TipoRecursoCentroCostoDto.activo_fijo,
    };
    return mapping[tipo];
  }

  toPrismaTipoGastoGeneral(
    tipo: TipoGastoGeneralCentroCostoDto,
  ): TipoGastoGeneralCentroCosto {
    const mapping: Record<
      TipoGastoGeneralCentroCostoDto,
      TipoGastoGeneralCentroCosto
    > = {
      [TipoGastoGeneralCentroCostoDto.limpieza]:
        TipoGastoGeneralCentroCosto.LIMPIEZA,
      [TipoGastoGeneralCentroCostoDto.mantenimiento]:
        TipoGastoGeneralCentroCosto.MANTENIMIENTO,
      [TipoGastoGeneralCentroCostoDto.servicios]:
        TipoGastoGeneralCentroCosto.SERVICIOS,
      [TipoGastoGeneralCentroCostoDto.alquiler]:
        TipoGastoGeneralCentroCosto.ALQUILER,
      [TipoGastoGeneralCentroCostoDto.otro]: TipoGastoGeneralCentroCosto.OTRO,
    };
    return mapping[tipo];
  }

  fromPrismaTipoGastoGeneral(
    tipo: TipoGastoGeneralCentroCosto,
  ): TipoGastoGeneralCentroCostoDto {
    const mapping: Record<
      TipoGastoGeneralCentroCosto,
      TipoGastoGeneralCentroCostoDto
    > = {
      [TipoGastoGeneralCentroCosto.LIMPIEZA]:
        TipoGastoGeneralCentroCostoDto.limpieza,
      [TipoGastoGeneralCentroCosto.MANTENIMIENTO]:
        TipoGastoGeneralCentroCostoDto.mantenimiento,
      [TipoGastoGeneralCentroCosto.SERVICIOS]:
        TipoGastoGeneralCentroCostoDto.servicios,
      [TipoGastoGeneralCentroCosto.ALQUILER]:
        TipoGastoGeneralCentroCostoDto.alquiler,
      [TipoGastoGeneralCentroCosto.OTRO]: TipoGastoGeneralCentroCostoDto.otro,
    };
    return mapping[tipo];
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

  toPrismaOrigenComponente(origen: OrigenComponenteCostoCentroDto) {
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

  fromPrismaOrigenComponente(origen: OrigenComponenteCostoCentro) {
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

  toPrismaMetodoDepreciacionMaquina(
    metodo: UpsertCentroRecursosMaquinariaDto['recursos'][number]['metodoDepreciacion'],
  ) {
    const mapping: Record<string, MetodoDepreciacionMaquina> = {
      lineal: MetodoDepreciacionMaquina.LINEAL,
    };
    return mapping[metodo];
  }

  fromPrismaMetodoDepreciacionMaquina(metodo: MetodoDepreciacionMaquina) {
    const mapping: Record<MetodoDepreciacionMaquina, string> = {
      [MetodoDepreciacionMaquina.LINEAL]: 'lineal',
    };
    return mapping[metodo];
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
