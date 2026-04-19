/**
 * SM.1 — Super motor universal del modelo.
 *
 * Un único motor que cotiza CUALQUIER producto ejecutando su ruta de
 * producción declarativamente. Reemplaza (a futuro) los 5 motores v2
 * específicos (gran_formato@2, vinilo_de_corte@2, impresion_digital_laser@2,
 * rigidos_impresos@2, talonario@2) por una sola implementación genérica.
 *
 * Algoritmo:
 *   1. Carga la ruta efectiva del producto y sus operaciones.
 *   2. Filtra operaciones activas + opcionales seleccionadas.
 *   3. Para cada operación, resuelve: centroCosto → tarifa del período,
 *      máquina, perfil, familia.
 *   4. Calcula el tiempo del paso usando proceso-productividad.engine
 *      (setup + cleanup + tiempoFijo + productivo).
 *   5. Emite un paso canónico por operación, con los 3 buckets
 *      (centroCosto, materiasPrimas, cargosFlat).
 *
 * Scope actual (SM.1):
 *   - Tiempo + tarifa reales por paso.
 *   - Materiales = 0 (se agregan en SM.2 con plantillas por familia).
 *   - Nesting = no ejecutado (se agrega en SM.1.b cuando corresponda).
 */
import { BadRequestException } from '@nestjs/common';
import type { CurrentAuth } from '../../auth/auth.types';
import type {
  CotizarProductoVarianteDto,
  PreviewImposicionProductoVarianteDto,
  UpsertProductoMotorConfigDto,
  UpsertVarianteMotorOverrideDto,
} from '../dto/productos-servicios.dto';
import type { ProductosServiciosService } from '../productos-servicios.service';
import type { ProductMotorDefinition, ProductMotorModule } from './product-motor.contract';
import type {
  CotizacionCanonica,
  PasoCotizado,
} from '../dto/cotizacion-canonica.dto';
import { evaluateProductividad } from '../../procesos/proceso-productividad.engine';
import { ModoProductividadProceso } from '@prisma/client';
import { FAMILIAS_PASO } from '../pasos/familias';
import {
  runNestingPipeline,
  getLayoutHeredado,
  type PasoRuntime,
  type MaterialMaquinaContext,
  type NestingResultUnion,
} from '../engine/nesting-runner';
import { calcularMaterialesDelPaso } from '../pasos/material-plantillas';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export class SuperMotorModule implements ProductMotorModule {
  constructor(private readonly service: ProductosServiciosService) {}

  getDefinition(): ProductMotorDefinition {
    return {
      code: 'universal',
      version: 1,
      label: 'Super motor (modelo universal)',
      category: 'digital_sheet', // TODO: extender enum para 'universal' — por ahora reusa digital_sheet
      capabilities: {
        hasProductConfig: false,
        hasVariantOverride: false,
        hasPreview: false,
        hasQuote: true,
      },
      schema: {},
      exposedInCatalog: false, // no se expone en el catálogo de motores todavía
    };
  }

  async getProductConfig(_auth: CurrentAuth, _productoId: string) {
    throw new BadRequestException('super motor: sin config propia.');
  }

  async upsertProductConfig(
    _auth: CurrentAuth,
    _productoId: string,
    _payload: UpsertProductoMotorConfigDto,
  ) {
    throw new BadRequestException('super motor: sin config propia.');
  }

  async getVariantOverride(_auth: CurrentAuth, _varianteId: string) {
    throw new BadRequestException('super motor: sin overrides.');
  }

  async upsertVariantOverride(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: UpsertVarianteMotorOverrideDto,
  ) {
    throw new BadRequestException('super motor: sin overrides.');
  }

  async previewVariant(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: PreviewImposicionProductoVarianteDto,
  ) {
    throw new BadRequestException('super motor: preview no implementado.');
  }

  async quoteVariant(
    auth: CurrentAuth,
    varianteId: string,
    payload: CotizarProductoVarianteDto,
  ): Promise<CotizacionCanonica> {
    const periodo = String(payload.periodo ?? '2026-04');
    const cantidad = Math.max(1, Math.floor(Number(payload.cantidad ?? 1)));

    const runtime = await this.service.loadSuperMotorRuntime(auth, varianteId, periodo);
    const { variante, proceso, tarifaByCentro } = runtime;

    if (!proceso) {
      throw new BadRequestException(
        'El producto no tiene ruta de producción asignada — el super motor necesita una ruta.',
      );
    }

    const opcionalesSeleccionados = new Set(payload.opcionalesSeleccionados ?? []);
    const operacionesAEjecutar = proceso.operaciones.filter((op) => {
      if (!op.activo) return false;
      if (op.esOpcional && !opcionalesSeleccionados.has(op.id)) return false;
      return true;
    });

    if (operacionesAEjecutar.length === 0) {
      throw new BadRequestException(
        'La ruta no tiene operaciones activas/seleccionadas para cotizar.',
      );
    }

    const pasos: PasoCotizado[] = [];
    const warnings: string[] = [];

    // ──────────────── SM.2: Nesting pipeline ────────────────
    // Ejecuta el nesting una sola vez para toda la ruta. El output se usa
    // para mejorar cantidadObjetivoSalida (pliegos vs piezas) y para
    // exponer placements en la trazabilidad del paso `produce`.
    const trabajoMedidas = this.resolverMedidasTrabajo(payload, variante, cantidad);
    const materialMaquina = this.resolverMaterialMaquinaContext(
      runtime,
      operacionesAEjecutar,
    );
    const pasosRuntime: PasoRuntime[] = operacionesAEjecutar
      .map((op) => ({
        id: op.id,
        familiaCodigo: op.familiaV2 ?? inferirFamiliaDesdeTipo(op.tipoOperacion, op.nombre),
        configNesting: (op.configNestingV2 as Record<string, unknown> | null) ?? null,
      }))
      .filter((p) => FAMILIAS_PASO[p.familiaCodigo] != null);
    const nestingOutput =
      pasosRuntime.length > 0
        ? runNestingPipeline({
            pasos: pasosRuntime,
            familiasMap: FAMILIAS_PASO,
            trabajo: { medidas: trabajoMedidas, cantidadTotal: cantidad },
            materialMaquina,
          })
        : null;

    for (const op of operacionesAEjecutar) {
      const tarifaHora =
        op.centroCostoId && tarifaByCentro.get(op.centroCostoId) != null
          ? tarifaByCentro.get(op.centroCostoId)!
          : 0;
      if (tarifaHora === 0 && op.centroCostoId) {
        warnings.push(
          `Paso "${op.nombre}": el centro de costo ${op.centroCosto?.nombre ?? op.centroCostoId} no tiene tarifa publicada para el período ${periodo}.`,
        );
      }

      // Productividad: `cantidadObjetivoSalida` depende del modoNesting:
      //  - 'produce' → pliegos/placas/largo que el paso efectivamente imprime.
      //  - 'consume' → lo mismo que el produce del que hereda (ej. cortes
      //    sobre los mismos pliegos).
      //  - 'none'    → cantidad de piezas pedidas.
      const familiaCodigo = op.familiaV2 ?? inferirFamiliaDesdeTipo(op.tipoOperacion, op.nombre);
      const familia = FAMILIAS_PASO[familiaCodigo] ?? null;
      const nestingPropio = nestingOutput?.layoutsPorPasoId.get(op.id) ?? null;
      const nestingHeredado =
        nestingOutput && familia?.modoNesting === 'consume'
          ? getLayoutHeredado(nestingOutput, op.id)
          : null;
      const layoutAplicable = nestingPropio ?? nestingHeredado;
      const cantidadObjetivoSalida =
        familia?.modoNesting === 'produce' || familia?.modoNesting === 'consume'
          ? layoutToCantidadObjetivo(layoutAplicable) ?? cantidad
          : cantidad;
      const productividad = evaluateProductividad({
        modoProductividad: op.modoProductividad ?? ModoProductividadProceso.FIJA,
        productividadBase: op.productividadBase,
        reglaVelocidadJson: op.reglaVelocidadJson,
        reglaMermaJson: op.reglaMermaJson,
        runMin: op.runMin,
        unidadTiempo: op.unidadTiempo,
        mermaRunPct: op.mermaRunPct,
        mermaSetup: op.mermaSetup,
        cantidadObjetivoSalida,
        contexto: { cantidad, varianteId },
      });
      if (productividad.warnings.length > 0) {
        warnings.push(
          ...productividad.warnings.map((w) => `Paso "${op.nombre}": ${w}`),
        );
      }

      const setupMin = Number(op.setupMin ?? 0);
      const cleanupMin = Number(op.cleanupMin ?? 0);
      const tiempoFijoMin = Number(op.tiempoFijoMin ?? 0);
      const totalMin = setupMin + cleanupMin + tiempoFijoMin + productividad.runMin;
      const costoCentroCosto = roundMoney((totalMin / 60) * tarifaHora);

      // SM.4: materiales consumidos por el paso según su familia.
      const selecciones = new Map(
        (payload.seleccionesBase ?? []).map((s) => [String(s.dimension), String(s.valor)]),
      );
      const materialesConsumidos = calcularMaterialesDelPaso(familiaCodigo, {
        cantidadPedida: cantidad,
        layout: layoutAplicable,
        configPaso: (op.configNestingV2 as Record<string, unknown> | null) ?? null,
        variante: {
          anchoMm: variante.anchoMm,
          altoMm: variante.altoMm,
          papelVariante: variante.papelVariante
            ? {
                id: variante.papelVariante.id,
                sku: variante.papelVariante.sku,
                precioReferencia: variante.papelVariante.precioReferencia,
                atributosVarianteJson: variante.papelVariante.atributosVarianteJson,
              }
            : null,
        },
        configProducto: runtime.configProducto ?? {},
        selecciones,
      });
      const costoMateriasPrimas = roundMoney(
        materialesConsumidos.reduce((acc, m) => acc + m.costo, 0),
      );

      pasos.push({
        id: `P-${String(op.orden).padStart(2, '0')}-${op.codigo}`,
        tipo: familiaCodigo,
        nombre: op.nombre,
        costoCentroCosto,
        costoMateriasPrimas,
        cargosFlat: 0,
        trazabilidad: {
          operacionId: op.id,
          orden: op.orden,
          codigo: op.codigo,
          familia: familia
            ? { codigo: familia.codigo, nombre: familia.nombre, modoNesting: familia.modoNesting }
            : null,
          esOpcional: op.esOpcional,
          maquina: op.maquina
            ? { id: op.maquina.id, nombre: op.maquina.nombre }
            : null,
          perfilOperativo: op.perfilOperativo
            ? { id: op.perfilOperativo.id, nombre: op.perfilOperativo.nombre }
            : null,
          centroCosto: op.centroCosto
            ? { id: op.centroCosto.id, nombre: op.centroCosto.nombre }
            : null,
          tarifaHora,
          setupMin,
          cleanupMin,
          tiempoFijoMin,
          productivoMin: roundMoney(productividad.runMin),
          totalMin: roundMoney(totalMin),
          cantidadObjetivoSalida,
          productividadAplicada: productividad.productividadAplicada,
          mermaRunPctAplicada: productividad.mermaRunPctAplicada,
          mermaSetupAplicada: productividad.mermaSetupAplicada,
          // SM.2: layout del nesting aplicable al paso (propio o heredado).
          nesting: layoutAplicable
            ? summarizeLayout(layoutAplicable, Boolean(nestingHeredado))
            : null,
          // SM.4: materiales consumidos por la plantilla de la familia.
          materiales: materialesConsumidos,
        },
      });
    }

    const centroCosto = roundMoney(pasos.reduce((a, p) => a + p.costoCentroCosto, 0));
    const materiasPrimas = roundMoney(pasos.reduce((a, p) => a + p.costoMateriasPrimas, 0));
    const cargosFlat = roundMoney(pasos.reduce((a, p) => a + p.cargosFlat, 0));
    const total = roundMoney(centroCosto + materiasPrimas + cargosFlat);
    const unitario = cantidad > 0 ? roundMoney(total / cantidad) : 0;

    // Exponer opcionales disponibles para que la UI arme los checkboxes.
    const opcionalesDisponibles = proceso.operaciones
      .filter((op) => op.activo && op.esOpcional)
      .map((op) => ({
        id: op.id,
        orden: op.orden,
        codigo: op.codigo,
        nombre: op.nombre,
        familiaV2: op.familiaV2 ?? null,
        seleccionado: opcionalesSeleccionados.has(op.id),
      }));

    return {
      motorCodigo: 'universal',
      motorVersion: 1,
      periodo,
      cantidad,
      total,
      unitario,
      subtotales: { centroCosto, materiasPrimas, cargosFlat },
      pasos,
      subProductos: [],
      warnings,
      trazabilidad: {
        varianteId,
        productoServicioId: variante.productoServicioId,
        procesoDefinicionId: proceso.id,
        procesoNombre: proceso.nombre,
        opcionalesDisponibles,
        nestingRuta: nestingOutput
          ? {
              pasosProduce: Array.from(nestingOutput.layoutsPorPasoId.keys()),
              consumeMap: Array.from(nestingOutput.consumeMap.entries()).map(
                ([consumerId, produceId]) => ({ consumerId, produceId }),
              ),
              consumersSinProduce: nestingOutput.consumersSinProduce,
            }
          : null,
      },
    };
  }

  // ──────────────── Helpers privados ────────────────

  /**
   * Resuelve las medidas de piezas a nestar. Prioridad:
   * (a) payload.parametros.medidas (explícito del cliente)
   * (b) payload.parametros.{anchoMm, altoMm} + cantidad
   * (c) variante.{anchoMm, altoMm} + cantidad (default)
   */
  private resolverMedidasTrabajo(
    payload: CotizarProductoVarianteDto,
    variante: { anchoMm: unknown; altoMm: unknown },
    cantidad: number,
  ): Array<{ anchoMm: number; altoMm: number; cantidad: number }> {
    const params = (payload.parametros ?? {}) as Record<string, unknown>;
    if (Array.isArray(params.medidas) && params.medidas.length > 0) {
      return (params.medidas as Array<Record<string, unknown>>)
        .map((m) => ({
          anchoMm: Number(m.anchoMm ?? 0),
          altoMm: Number(m.altoMm ?? 0),
          cantidad: Math.max(1, Math.floor(Number(m.cantidad ?? 1))),
        }))
        .filter((m) => m.anchoMm > 0 && m.altoMm > 0);
    }
    const anchoPayload = Number(params.anchoMm ?? 0);
    const altoPayload = Number(params.altoMm ?? 0);
    if (anchoPayload > 0 && altoPayload > 0) {
      return [{ anchoMm: anchoPayload, altoMm: altoPayload, cantidad }];
    }
    const anchoV = Number(variante.anchoMm ?? 0);
    const altoV = Number(variante.altoMm ?? 0);
    if (anchoV > 0 && altoV > 0) {
      return [{ anchoMm: anchoV, altoMm: altoV, cantidad }];
    }
    return [];
  }

  /**
   * Resuelve el contexto material/máquina para el nesting:
   *  - nesting-hoja: no requiere material context (los pliegos candidatos vienen de configNestingV2).
   *  - nesting-rollo: lee printableWidth y márgenes de la máquina del paso produce.
   *  - nesting-placa-rigida: lee placa ancho/alto del material asignado al paso produce
   *    (en este piloto, si la config del paso tiene placaAnchoMm/placaAltoMm se usa directo).
   */
  private resolverMaterialMaquinaContext(
    _runtime: Awaited<ReturnType<ProductosServiciosService['loadSuperMotorRuntime']>>,
    operacionesAEjecutar: Array<{
      familiaV2: string | null;
      maquina: { parametrosTecnicosJson?: unknown } | null;
    }>,
  ): MaterialMaquinaContext | undefined {
    const opImpresion = operacionesAEjecutar.find((op) => {
      if (!op.familiaV2) return false;
      const f = FAMILIAS_PASO[op.familiaV2];
      return f?.modoNesting === 'produce';
    });
    if (!opImpresion?.maquina?.parametrosTecnicosJson) return undefined;
    const p = opImpresion.maquina.parametrosTecnicosJson as Record<string, unknown>;
    return {
      maquinaPrintableWidthMm: Number(p.printableWidthMm ?? p.anchoMaximo ?? 0) || undefined,
      maquinaMarginLeftMm: Number(p.margenIzquierdo ?? 0) || undefined,
      maquinaMarginStartMm: Number(p.margenSuperior ?? 0) || undefined,
      maquinaMarginEndMm: Number(p.margenInferior ?? 0) || undefined,
    };
  }
}

/**
 * Dado un layout, devuelve el número de "unidades productivas" para usar
 * como cantidadObjetivoSalida en la engine de productividad.
 *   - nesting-hoja: pliegosNecesarios
 *   - nesting-rollo: metros lineales consumidos (⌈ consumedLengthMm / 1000 ⌉)
 *   - nesting-placa-rigida: placas necesarias (piezasPorPlaca=0 → 0)
 */
function layoutToCantidadObjetivo(layout: NestingResultUnion | null): number | null {
  if (!layout) return null;
  if (layout.algoritmo === 'nesting-hoja') return layout.result.pliegosNecesarios;
  if (layout.algoritmo === 'nesting-rollo') {
    return Math.ceil(layout.result.consumedLengthMm / 1000);
  }
  if (layout.algoritmo === 'nesting-placa-rigida') {
    if (layout.result.piezasPorPlaca === 0) return 0;
    return Math.max(1, Math.ceil(1 / layout.result.piezasPorPlaca));
  }
  return null;
}

/**
 * Infere el familiaV2 de una operación a partir de su tipoOperacion +
 * nombre, para productos legacy donde `familiaV2` no está seteado todavía
 * (pre-migración). Permite que el super motor funcione sin backfill de data.
 */
function inferirFamiliaDesdeTipo(tipoOperacion: string, nombre: string): string {
  const low = nombre.toLowerCase();
  switch (tipoOperacion) {
    case 'PREPRENSA':
      return 'pre_prensa';
    case 'IMPRESION':
      if (low.includes('rollo') || low.includes('latex') || low.includes('solvente')) {
        return 'impresion_por_area';
      }
      if (low.includes('uv') || low.includes('pieza') || low.includes('cnc')) {
        return 'impresion_por_pieza';
      }
      return 'impresion_por_hoja';
    case 'TERMINACION':
      if (low.includes('laminado') || low.includes('plastif')) return 'laminado';
      if (low.includes('corte') || low.includes('guillot') || low.includes('plotter'))
        return 'corte';
      if (low.includes('encuadern') || low.includes('anillado') || low.includes('espiral'))
        return 'encuadernado';
      if (low.includes('foil') || low.includes('relieve') || low.includes('hot-stamp'))
        return 'acabado_decorativo';
      if (low.includes('troquelado')) return 'troquelado';
      if (low.includes('perforado')) return 'perforado';
      if (low.includes('plegado')) return 'plegado';
      return 'operacion_manual';
    case 'EMPAQUE':
    case 'LOGISTICA':
      return 'operacion_manual';
    default:
      return 'operacion_manual';
  }
}

/** Sumario compacto del layout para trazabilidad del paso. */
function summarizeLayout(layout: NestingResultUnion, heredado: boolean) {
  const base = { algoritmo: layout.algoritmo, heredado };
  if (layout.algoritmo === 'nesting-hoja') {
    return {
      ...base,
      pliegoElegido: layout.result.pliegoElegido,
      pliegosNecesarios: layout.result.pliegosNecesarios,
      piezasPorPliego: layout.result.piezasPorPliego,
      columnas: layout.result.columnas,
      filas: layout.result.filas,
      aprovechamientoPct: layout.result.aprovechamientoPct,
      placements: layout.result.placements,
    };
  }
  if (layout.algoritmo === 'nesting-rollo') {
    return {
      ...base,
      consumedLengthMm: layout.result.consumedLengthMm,
      usefulAreaM2: layout.result.usefulAreaM2,
      panelCount: layout.result.panelCount,
      orientacion: layout.result.orientacion,
      placements: layout.result.placements,
    };
  }
  return {
    ...base,
    piezasPorPlaca: layout.result.piezasPorPlaca,
    columnas: layout.result.columnas,
    filas: layout.result.filas,
    rotada: layout.result.rotada,
    placements: layout.result.placements,
  };
}
