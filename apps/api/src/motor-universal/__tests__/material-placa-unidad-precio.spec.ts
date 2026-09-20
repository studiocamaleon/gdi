import type { MaterialUnitContext } from '../../inventario/material-units';
import { MotorUniversalService } from '../motor.service';
import {
  runNestingForPaso,
  type NestingDispatchResult,
} from '../nesting-dispatcher';
import type {
  ErrorMotor,
  JobContext,
  MaterialEjecutado,
  PasoCargado,
} from '../tipos';
import type { CostingStrategyKind } from '../../productos-servicios/nesting/costing';
import { calcularMaterialesOrden } from '../../ordenes-trabajo/materiales-orden';

type MotorMateriales = {
  calcularMateriales: (
    tenantId: string,
    paso: PasoCargado,
    contexto: JobContext,
    nesting: NestingDispatchResult | null,
    errores: ErrorMotor[],
  ) => Promise<MaterialEjecutado[]>;
};

const PRECIO_M2 = 8264.46281;
const AREA_PLACA = 1.22 * 2.44;
const PRECIO_PLACA = PRECIO_M2 * AREA_PLACA;

async function cotizarMaterial(
  strategy: CostingStrategyKind,
  options: {
    unidadStock?: string;
    contextoUnidades?: MaterialUnitContext;
    precioReferencia?: number;
    formula?: string;
    merma?: number;
    cantidad?: number;
    rollo?: boolean;
  } = {},
) {
  const material = {
    id: 'pvc-3mm',
    sku: 'PVC-1220-3-B',
    materiaPrimaNombre: 'PVC espumado',
    precioReferencia: options.precioReferencia ?? PRECIO_M2,
    unidadStock: options.unidadStock ?? 'M2',
    contextoUnidades: options.contextoUnidades,
    subfamilia: options.rollo ? 'SUSTRATO_ROLLO_FLEXIBLE' : 'SUSTRATO_RIGIDO',
    atributosVarianteJson: options.rollo
      ? { anchoMm: 1220, largoRolloMm: 50_000 }
      : { anchoMm: 1220, altoMm: 2440, largoMm: 2440 },
  };
  const paso = {
    rutaPasoId: 'ruta-impresion',
    rutaPasoOrden: 1,
    familiaCodigo: 'impresion_por_area',
    configPasoId: 'config-impresion',
    modoActivacion: 'OBLIGATORIO',
    modoTiempo: 'T-3',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    multiplicadoresActivos: [],
    paramsPasoJson: {
      nestingConfig: {
        costing: { strategy, segmentSteps: [15, 30, 45, 60, 75, 90, 100] },
        margins: { topMm: 5, bottomMm: 5, leftMm: 5, rightMm: 5 },
        pieceBleedMm: 0,
      },
    },
    slots: [
      {
        slotCodigo: 'sustrato_principal',
        modoSeleccion: 'HARDCODED',
        formula: options.formula ?? 'por_unidad_productiva',
        aplicaMultiCaras: false,
        mermaAdicionalPct: options.merma ?? 0,
        materialVariante: material,
      },
    ],
    maquina: {
      id: 'uv',
      nombre: 'Impresora UV',
      plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
      parametrosTecnicosJson: {
        geometria: options.rollo ? 'ROLLO' : 'MESA_EXTENSORA',
        anchoMaxRolloMm: 1220,
        anchoMesaMm: 1220,
        largoMesaMm: 2440,
      },
      consumibles: [],
      componentesDesgaste: [],
    },
    cargosDirectosPaso: [],
  } as unknown as PasoCargado;
  const contexto: JobContext = {
    'modoColor_config-impresion': 'SIN_IMPRESION',
    cantidad: options.cantidad ?? 1,
    piezas: [{ cantidad: options.cantidad ?? 1, anchoMm: 500, altoMm: 500 }],
  };
  const nesting = await runNestingForPaso(paso, contexto, material);
  expect(nesting).not.toBeNull();
  const motor = Object.create(
    MotorUniversalService.prototype,
  ) as MotorMateriales;
  const errores: ErrorMotor[] = [];
  const lineas = await motor.calcularMateriales(
    'tenant',
    paso,
    contexto,
    nesting,
    errores,
  );
  expect(errores).toEqual([]);
  expect(lineas).toHaveLength(1);
  return { material: lineas[0], nesting: nesting! };
}

describe('Precio de placas y unidad de la línea de material', () => {
  it('guarda la unidad real de stock y demanda la placa completa sin modificar el precio parcial', async () => {
    const contextoUnidades: MaterialUnitContext = {
      unidadCompra: 'kg',
      unidadStock: 'placa',
      unidadUso: 'kg',
      unidadPrecio: 'kg',
      equivalencias: [{ origen: 'placa', destino: 'kg', factor: 2.5 }],
    };
    const { material, nesting } = await cotizarMaterial('plate-segments', {
      unidadStock: 'KG',
      precioReferencia: 4,
      contextoUnidades,
    });
    expect(material.contextoUnidadesSnapshot).toEqual(contextoUnidades);
    expect(material.costoTotal).toBe(3);
    const result = calcularMaterialesOrden('orden', [
      {
        id: 'item',
        nombre: 'Cartel',
        parentItemId: null,
        contieneLotesEntrega: false,
        cotizacionItem: null,
        pasos: [],
        trazabilidadSnapshotJson: {
          pasos: [
            {
              rutaPasoId: 'ruta',
              materiales: [material],
              nestingResult: nesting,
            },
          ],
        },
      },
    ]);
    expect(result.necesidades[0]).toMatchObject({
      cantidad: 1,
      unidad: 'placa',
      estado: 'calculada',
    });
  });
  it.each(['simple', 'plate-segments', 'consumed-length', 'm2-exact'] as const)(
    '%s conserva el costo y muestra placa cuando se elige esa unidad',
    async (strategy) => {
      const porHoja = await cotizarMaterial(strategy, {
        unidadStock: 'HOJA',
        precioReferencia: PRECIO_PLACA,
      });
      const porPlaca = await cotizarMaterial(strategy, {
        unidadStock: 'PLACA',
        precioReferencia: PRECIO_PLACA,
      });
      expect(porPlaca.material.costoTotal).toBe(porHoja.material.costoTotal);
      expect(porPlaca.material.cantidad).toBe(porHoja.material.cantidad);
      expect(porPlaca.material.precioUnitario).toBe(
        porHoja.material.precioUnitario,
      );
      expect(porPlaca.material.unidad).toBe(
        strategy === 'm2-exact' ? 'm2' : 'placa',
      );
    },
  );
  it('PAI comprado por kg: el nesting costea el peso equivalente de la placa', async () => {
    const { material } = await cotizarMaterial('plate-segments', {
      unidadStock: 'KG',
      precioReferencia: 4,
      contextoUnidades: {
        unidadCompra: 'kg',
        unidadStock: 'hoja',
        unidadUso: 'kg',
        unidadPrecio: 'kg',
        equivalencias: [{ origen: 'hoja', destino: 'kg', factor: 2.5 }],
      },
    });
    expect(material.precioUnitario).toBe(10);
    expect(material.cantidad).toBeCloseTo(0.3, 6);
    expect(material.costoTotal).toBe(3);
  });

  it('PVC de 50 × 50 cm: cobra el tramo de 30% del precio de la placa, no del m²', async () => {
    const { material } = await cotizarMaterial('plate-segments');
    expect(material.costoTotal).toBe(7380.5);
    expect(material.cantidad).toBeCloseTo(0.3, 6);
    expect(material.unidad).toBe('pliego');
    expect(material.precioUnitario).toBeCloseTo(PRECIO_PLACA, 6);
    expect(material.detalleCosteoNesting).toMatchObject({
      pricePerM2: 8264.46,
      lastUnit: { segmentApplied: 30, cost: 7380.5 },
    });
  });

  it.each(['simple', 'plate-segments', 'consumed-length', 'm2-exact'] as const)(
    '%s cuesta lo mismo si el precio se carga por m² o por placa',
    async (strategy) => {
      const porM2 = await cotizarMaterial(strategy);
      const porPlaca = await cotizarMaterial(strategy, {
        unidadStock: 'HOJA',
        precioReferencia: PRECIO_PLACA,
      });
      expect(porM2.material.costoTotal).toBe(porPlaca.material.costoTotal);
      expect(porM2.material.precioUnitario).toBeCloseTo(
        porPlaca.material.precioUnitario,
        6,
      );
      expect(porM2.material.cantidad).toBeCloseTo(
        porPlaca.material.cantidad,
        6,
      );
      expect(porM2.material.unidad).toBe(porPlaca.material.unidad);
    },
  );

  it('placa completa consume una unidad física al precio de sus 2,9768 m²', async () => {
    const { material } = await cotizarMaterial('simple');
    expect(material.cantidad).toBe(1);
    expect(material.precioUnitario).toBeCloseTo(24601.652893, 6);
    expect(material.costoTotal).toBeCloseTo(PRECIO_PLACA, 6);
  });

  it.each(['por_m2', 'por_unidad_productiva'])(
    'área exacta siempre informa m² y precio por m² con fórmula %s',
    async (formula) => {
      const { material } = await cotizarMaterial('m2-exact', {
        unidadStock: 'HOJA',
        precioReferencia: PRECIO_PLACA,
        formula,
      });
      expect(material.unidad).toBe('m2');
      // El costo monetario se redondea a centavos antes de derivar la cantidad.
      expect(material.cantidad).toBeCloseTo(0.25, 5);
      expect(material.precioUnitario).toBeCloseTo(PRECIO_M2, 6);
      expect(material.costoTotal).toBe(2066.12);
    },
  );

  it('aplica merma operativa una vez sobre el costo convertido', async () => {
    const { material } = await cotizarMaterial('plate-segments', { merma: 10 });
    expect(material.costoTotal).toBeCloseTo(8118.55, 6);
    expect(material.cantidad).toBeCloseTo(0.33, 6);
    expect(material.mermaAdicional?.cantidadMerma).toBeCloseTo(0.03, 6);
  });

  it('conserva el precio de los rollos por m² sin multiplicarlo por una placa', async () => {
    const { material, nesting } = await cotizarMaterial('consumed-length', {
      rollo: true,
      formula: 'por_m2',
    });
    const rollo = nesting.substrates[0];
    expect(rollo.kind).toBe('roll');
    if (rollo.kind !== 'roll') throw new Error('Se esperaba un rollo');
    expect(material.unidad).toBe('m2');
    expect(material.precioUnitario).toBe(PRECIO_M2);
    expect(material.costoTotal).toBeCloseTo(
      ((rollo.widthMm * rollo.lengthMm) / 1_000_000) * PRECIO_M2,
      6,
    );
  });
});
