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

      // Productividad: usa la engine existente.
      // cantidadObjetivoSalida = cantidad pedida (simplificación inicial;
      // en SM.1.b usa nesting para pliegos/piezas por placa).
      const cantidadObjetivoSalida = cantidad;
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

      const familia = op.familiaV2 ? FAMILIAS_PASO[op.familiaV2] ?? null : null;

      pasos.push({
        id: `P-${String(op.orden).padStart(2, '0')}-${op.codigo}`,
        tipo: op.familiaV2 ?? 'operacion_manual',
        nombre: op.nombre,
        costoCentroCosto,
        costoMateriasPrimas: 0, // SM.2: plantillas por familia
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
          // SM.2: aquí irán los detalles de materiales consumidos
          materiales: [],
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
      },
    };
  }
}
