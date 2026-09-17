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

type MotorMateriales = {
  calcularMateriales: (
    tenantId: string,
    paso: PasoCargado,
    contexto: JobContext,
    nesting: NestingDispatchResult | null,
    errores: ErrorMotor[],
  ) => Promise<MaterialEjecutado[]>;
};

async function cotizarRollo(
  options: {
    algorithm?: 'shelf-rollo' | 'maxrects-rollo' | 'secuencial-rollo';
    unidadStock?: string;
    precio?: number;
    formula?: string;
    anchoMm?: number;
    pieza?: { anchoMm: number; altoMm: number; cantidad: number };
    merma?: number;
    cantidadBase?: string;
    cantidadFactor?: number;
    atributos?: Record<string, unknown>;
    templateId?: string;
  } = {},
) {
  const material = {
    id: 'vinilo',
    sku: 'VINILO-152',
    materiaPrimaNombre: 'Vinilo Ritrama PM80',
    materiaPrimaTemplateId: options.templateId ?? 'sustrato_rollo_flexible_v1',
    precioReferencia: options.precio ?? 2000,
    unidadStock: options.unidadStock ?? 'M2',
    subfamilia: 'SUSTRATO_ROLLO_FLEXIBLE',
    atributosVarianteJson: options.atributos ?? {
      anchoMm: options.anchoMm ?? 1520,
      largoRolloMm: 50_000,
    },
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
        algorithm: options.algorithm ?? 'maxrects-rollo',
        margins: {
          topMm: 100,
          bottomMm: 100,
          startMm: 100,
          endMm: 100,
          leftMm: 10,
          rightMm: 10,
        },
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
        cantidadBase: options.cantidadBase,
        cantidadFactor: options.cantidadFactor,
        materialVariante: material,
      },
    ],
    maquina: {
      id: 'uv',
      nombre: 'Impresora UV',
      plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
      parametrosTecnicosJson: { geometria: 'ROLLO', anchoMaxRolloMm: 1800 },
      consumibles: [],
      componentesDesgaste: [],
    },
    cargosDirectosPaso: [],
  } as unknown as PasoCargado;
  const pieza = options.pieza ?? { anchoMm: 1500, altoMm: 800, cantidad: 1 };
  const contexto: JobContext = {
    'modoColor_config-impresion': 'SIN_IMPRESION',
    cantidad: pieza.cantidad,
    piezas: [pieza],
  };
  const nesting = await runNestingForPaso(paso, contexto, material);
  expect(nesting?.unidad).toBe('m_lineales');
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
  return { lineas, nesting: nesting!, errores };
}

describe('Costeo del rollo en la unidad de uso del material', () => {
  it.each(['shelf-rollo', 'maxrects-rollo', 'secuencial-rollo'] as const)(
    '%s: 150 × 80 cm consume 1 m lineal × 1,52 m = 1,52 m²',
    async (algorithm) => {
      const { lineas, nesting, errores } = await cotizarRollo({ algorithm });
      expect(errores).toEqual([]);
      expect(nesting.cantidadCalculada).toBe(1);
      expect(lineas[0]).toMatchObject({
        cantidad: 1.52,
        unidad: 'm2',
        precioUnitario: 2000,
        costoTotal: 3040,
      });
    },
  );

  it.each([
    { unidadStock: 'M2', precio: 2000, cantidad: 1.52 },
    { unidadStock: 'METRO_LINEAL', precio: 3040, cantidad: 1 },
    { unidadStock: 'ROLLO', precio: 152000, cantidad: 0.02 },
  ])(
    'el costo es el mismo usando $unidadStock',
    async ({ unidadStock, precio, cantidad }) => {
      const { lineas, errores } = await cotizarRollo({ unidadStock, precio });
      expect(errores).toEqual([]);
      expect(lineas[0].cantidad).toBeCloseTo(cantidad, 8);
      expect(lineas[0].costoTotal).toBeCloseTo(3040, 6);
    },
  );

  it.each(['por_m2', 'por_metro_lineal'])(
    'coincide con la fórmula explícita %s',
    async (formula) => {
      const { lineas, errores } = await cotizarRollo({ formula });
      expect(errores).toEqual([]);
      expect(lineas[0].costoTotal).toBeCloseTo(3040, 6);
    },
  );

  it('conserva decimales y usa el ancho físico completo, con márgenes y varias piezas', async () => {
    const { lineas, nesting, errores } = await cotizarRollo({
      anchoMm: 1370,
      pieza: { anchoMm: 1250, altoMm: 375, cantidad: 3 },
    });
    expect(errores).toEqual([]);
    const area = (nesting.consumedLengthMm! / 1000) * 1.37;
    expect(lineas[0].cantidad).toBeCloseTo(area, 8);
    expect(lineas[0].costoTotal).toBeCloseTo(area * 2000, 6);
  });

  it('agrega la merma una sola vez luego de convertir a m²', async () => {
    const { lineas, errores } = await cotizarRollo({ merma: 10 });
    expect(errores).toEqual([]);
    expect(lineas[0].cantidad).toBeCloseTo(1.672, 8);
    expect(lineas[0].costoTotal).toBeCloseTo(3344, 6);
    expect(lineas[0].mermaAdicional).toEqual({
      porcentaje: 10,
      cantidadTrabajo: 1.52,
      cantidadMerma: 0.152,
    });
  });

  it('mantiene las reglas explícitas de base × factor', async () => {
    const { lineas, errores } = await cotizarRollo({
      cantidadBase: 'cantidad_pedida',
      cantidadFactor: 2,
    });
    expect(errores).toEqual([]);
    expect(lineas[0].cantidad).toBe(2);
    expect(lineas[0].costoTotal).toBe(4000);
  });

  it('no cobra un rollo completo si falta el largo necesario para convertir', async () => {
    const { lineas, errores } = await cotizarRollo({
      unidadStock: 'ROLLO',
      atributos: { anchoMm: 1520 },
    });
    expect(lineas).toHaveLength(0);
    expect(errores).toEqual([
      expect.objectContaining({ codigo: 'costeo_material_invalido' }),
    ]);
  });
});
