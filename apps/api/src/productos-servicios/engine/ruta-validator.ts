/**
 * Ruta Validator (C.2.7) — valida coherencia de una ruta del modelo universal.
 *
 * Ejecutado al upsert del producto (NO al cotizar). La idea es fallar rápido
 * al configurar el producto si hay inconsistencias, no descubrirlas cuando
 * un vendedor intenta cotizar.
 *
 * Validaciones:
 *   R1 — Familia existe: cada paso referencia una familia del catálogo.
 *   R2 — Produce tiene algoritmo: familia `produce` declara `nestingAlgoritmo`
 *         (ya garantizado por el tipo; lo re-validamos por robustez).
 *   R3 — Consumers con produce previo: cada paso `consume` tiene al menos
 *         un paso `produce` aguas arriba en la ruta.
 *   R4 — Coherencia de capacidades (si hay máquinas asignadas): el ancho
 *         de la máquina del paso `consume` ≥ ancho de máquina del `produce`
 *         aguas arriba. Esto es opcional y solo corre si las capacidades
 *         están informadas.
 *   R5 — Config de nesting válida para el algoritmo (validación estructural
 *         mínima; los detalles se validan en runtime).
 *
 * NO valida:
 *   - Que la cotización dé un resultado razonable (eso es business validation).
 *   - Que las máquinas/materiales existan en la DB (responsabilidad del upsert).
 *   - Que los outputs canónicos estén bien declarados (responsabilidad del runtime).
 */
import type { FamiliaPaso } from '../pasos/familias';

export type PasoRutaParaValidar = {
  id: string;
  orden: number;
  familiaCodigo: string;
  /** Opcional: ancho imprimible de la máquina asignada (para R4). */
  maquinaPrintableWidthMm?: number | null;
  /** Opcional: config específica del nesting (para R5). */
  configNesting?: Record<string, unknown> | null;
};

export type RutaValidationError = {
  codigo: 'R1_familia_desconocida' | 'R2_produce_sin_algoritmo' | 'R3_consume_sin_produce' | 'R4_capacidad_incompatible' | 'R5_config_invalida';
  pasoId: string;
  mensaje: string;
};

export type RutaValidationResult = {
  ok: boolean;
  errors: RutaValidationError[];
  warnings: string[];
};

// ─── Validación principal ───────────────────────────────────────

export function validateRuta(
  pasos: PasoRutaParaValidar[],
  familiasMap: Record<string, FamiliaPaso>,
): RutaValidationResult {
  const errors: RutaValidationError[] = [];
  const warnings: string[] = [];

  // Ordenar por orden para procesar topológicamente
  const pasosOrdenados = [...pasos].sort((a, b) => a.orden - b.orden);

  let lastProduce: PasoRutaParaValidar | null = null;
  let lastProduceFamilia: FamiliaPaso | null = null;

  for (const paso of pasosOrdenados) {
    const familia = familiasMap[paso.familiaCodigo];

    // R1: familia existe
    if (!familia) {
      errors.push({
        codigo: 'R1_familia_desconocida',
        pasoId: paso.id,
        mensaje: `El paso ${paso.id} referencia familia '${paso.familiaCodigo}' que no existe en el catálogo.`,
      });
      continue;
    }

    // R2: produce tiene algoritmo
    if (familia.modoNesting === 'produce' && !familia.nestingAlgoritmo) {
      errors.push({
        codigo: 'R2_produce_sin_algoritmo',
        pasoId: paso.id,
        mensaje: `La familia '${familia.codigo}' es 'produce' pero no declara nestingAlgoritmo.`,
      });
    }

    if (familia.modoNesting === 'produce') {
      // R5: validar config de nesting mínimamente si está presente
      const configErrors = validateConfigNesting(
        paso.id,
        familia.nestingAlgoritmo,
        paso.configNesting ?? null,
      );
      errors.push(...configErrors);

      lastProduce = paso;
      lastProduceFamilia = familia;
      continue;
    }

    if (familia.modoNesting === 'consume') {
      // R3: debe haber produce previo
      if (!lastProduce) {
        errors.push({
          codigo: 'R3_consume_sin_produce',
          pasoId: paso.id,
          mensaje:
            `El paso ${paso.id} (familia '${familia.codigo}') consume layout pero ` +
            `no hay ningún paso 'produce' aguas arriba en la ruta.`,
        });
        continue;
      }

      // R4: coherencia de capacidades (opcional)
      if (
        lastProduce.maquinaPrintableWidthMm != null &&
        paso.maquinaPrintableWidthMm != null &&
        paso.maquinaPrintableWidthMm < lastProduce.maquinaPrintableWidthMm
      ) {
        const producePorNombre = lastProduceFamilia?.nombre ?? lastProduce.familiaCodigo;
        warnings.push(
          `Paso ${paso.id} (${familia.nombre}) tiene máquina de ${paso.maquinaPrintableWidthMm}mm ` +
            `pero el paso produce ${lastProduce.id} (${producePorNombre}) puede generar layouts ` +
            `hasta ${lastProduce.maquinaPrintableWidthMm}mm. El nesting del paso produce ` +
            `debería limitarse al mínimo común (${paso.maquinaPrintableWidthMm}mm) para evitar ` +
            `piezas que no entren en la máquina posterior.`,
        );
      }
    }

    // 'none' → no valida nada específico
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── Validación de config de nesting por algoritmo ──────────────

function validateConfigNesting(
  pasoId: string,
  algoritmo: string | null,
  config: Record<string, unknown> | null,
): RutaValidationError[] {
  if (!config) return []; // sin config → usa defaults, válido

  const errors: RutaValidationError[] = [];

  // Validaciones estructurales mínimas: separaciones y márgenes no negativos
  const numericFields = [
    'separacionMm',
    'separacionHMm',
    'separacionVMm',
    'separacionHorizontalMm',
    'separacionVerticalMm',
    'margenMm',
    'margenLateralMm',
    'marginLeftMm',
    'marginStartMm',
    'marginEndMm',
  ];
  for (const field of numericFields) {
    if (field in config) {
      const value = Number(config[field]);
      if (Number.isFinite(value) && value < 0) {
        errors.push({
          codigo: 'R5_config_invalida',
          pasoId,
          mensaje: `configNesting.${field} no puede ser negativo (paso ${pasoId}).`,
        });
      }
    }
  }

  // Validación específica de nesting-rollo: panelizado bien formado
  if (algoritmo === 'nesting-rollo' && config.panelizado && typeof config.panelizado === 'object') {
    const panel = config.panelizado as Record<string, unknown>;
    if (panel.activo === true) {
      if (typeof panel.maxPanelWidthMm !== 'number' || panel.maxPanelWidthMm <= 0) {
        errors.push({
          codigo: 'R5_config_invalida',
          pasoId,
          mensaje: `Panelizado activo requiere maxPanelWidthMm > 0 (paso ${pasoId}).`,
        });
      }
      if (panel.axis !== 'vertical' && panel.axis !== 'horizontal') {
        errors.push({
          codigo: 'R5_config_invalida',
          pasoId,
          mensaje: `Panelizado activo requiere axis 'vertical' o 'horizontal' (paso ${pasoId}).`,
        });
      }
    }
  }

  // Validación específica de nesting-hoja: criterio válido si está presente
  if (algoritmo === 'nesting-hoja' && config.criterio !== undefined) {
    const criteriosValidos = ['menor_cantidad_pliegos', 'mayor_aprovechamiento', 'mayor_piezas_por_pliego'];
    if (typeof config.criterio !== 'string' || !criteriosValidos.includes(config.criterio)) {
      errors.push({
        codigo: 'R5_config_invalida',
        pasoId,
        mensaje: `Criterio inválido '${config.criterio}'. Válidos: ${criteriosValidos.join(', ')}.`,
      });
    }
  }

  return errors;
}
