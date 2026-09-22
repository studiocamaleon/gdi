import { MotorUniversalService } from '../motor.service';
import type {
  ErrorMotor,
  JobContext,
  MaterialEjecutado,
  PasoCargado,
} from '../tipos';
import type { NestingDispatchResult } from '../nesting-dispatcher';

type MotorMateriales = {
  calcularMateriales: (
    tenantId: string,
    paso: PasoCargado,
    contexto: JobContext,
    nesting: NestingDispatchResult | null,
    errores: ErrorMotor[],
  ) => Promise<MaterialEjecutado[]>;
};

const AREA_PLACA = 1.22 * 1.22;
const PRECIO_PLACA = 170_000;

async function calcular(
  options: {
    familia?: string;
    unidad?: string;
    formula?: string;
    mecanismo?: string;
    base?: string;
    factor?: number;
    merma?: number;
    heredado?: boolean;
    piezas?: JobContext['piezas'];
  } = {},
) {
  const unidad = options.unidad ?? 'M2';
  const material = {
    id: 'acrilico-8mm',
    sku: 'ACR-8',
    materiaPrimaNombre: 'Acrílico',
    materiaPrimaTemplateId: 'sustrato_rigido_v1',
    subfamilia: 'SUSTRATO_RIGIDO',
    unidadStock: unidad,
    precioReferencia:
      unidad === 'M2' ? PRECIO_PLACA / AREA_PLACA : PRECIO_PLACA,
    contextoUnidades: {
      unidadStock: unidad,
      unidadUso: unidad,
      unidadCompra: 'PLACA',
      unidadPrecio: 'PLACA',
      templateId: 'sustrato_rigido_v1',
      atributos: { anchoMm: 1220, altoMm: 1220 },
    },
    atributosVarianteJson: { anchoMm: 1220, altoMm: 1220 },
  };
  const paso = {
    rutaPasoId: 'corte',
    rutaPasoOrden: 1,
    configPasoId: 'corte',
    familiaCodigo: options.familia ?? 'corte_laser',
    mecanismoCantidad: options.mecanismo ?? 'DIRECT_FROM_JOBCONTEXT',
    paramsPasoJson: {},
    multiplicadoresActivos: [],
    slots: [
      {
        slotCodigo: 'sustrato_corte',
        modoSeleccion: options.heredado ? 'HEREDA_DE_PASO' : 'HARDCODED',
        formula: options.formula ?? 'por_unidad_productiva',
        materialVariante: material,
        cantidadBase: options.base,
        cantidadFactor: options.factor,
        mermaAdicionalPct: options.merma ?? 0,
        aplicaMultiCaras: false,
      },
    ],
    maquina: null,
    cargosDirectosPaso: [],
  } as unknown as PasoCargado;
  const motor = Object.create(
    MotorUniversalService.prototype,
  ) as MotorMateriales;
  const errores: ErrorMotor[] = [];
  const lineas = await motor.calcularMateriales(
    'tenant',
    paso,
    {
      cantidad: 33,
      modoCotizacionVectorial: 'medidas',
      piezas: options.piezas ?? [{ anchoMm: 90, altoMm: 40, cantidad: 33 }],
    },
    null,
    errores,
  );
  return { lineas, errores };
}

describe('Sustrato sin nesting: las piezas no son unidades de material', () => {
  it.each(['corte_laser', 'cnc', 'corte_hilo_caliente', 'troquelado_digital'])(
    '%s: 33 piezas de 9 × 4 cm consumen 0,1188 m², no 33 m²',
    async (familia) => {
      const { lineas, errores } = await calcular({ familia });
      expect(errores).toEqual([]);
      expect(lineas).toHaveLength(1);
      expect(lineas[0]).toMatchObject({
        unidad: 'm2',
        estrategiaCosto: 'm2-exact',
      });
      expect(lineas[0].cantidad).toBeCloseTo(0.1188, 8);
      expect(lineas[0].precioUnitario).toBeCloseTo(
        PRECIO_PLACA / AREA_PLACA,
        6,
      );
      expect(lineas[0].costoTotal).toBeCloseTo(13_568.9330825, 4);
    },
  );

  it.each(['PLACA', 'M2', 'UNIDAD'])(
    'mantiene el costo físico si la unidad de uso es %s',
    async (unidad) => {
      const { lineas, errores } = await calcular({ unidad });
      expect(errores).toEqual([]);
      expect(lineas[0].cantidad).toBeCloseTo(0.1188, 8);
      expect(lineas[0].unidad).toBe('m2');
      expect(lineas[0].costoTotal).toBeCloseTo(
        (0.1188 / AREA_PLACA) * PRECIO_PLACA,
        6,
      );
    },
  );

  it('suma cada medida con su propia cantidad sin volver a multiplicar por 33', async () => {
    const { lineas } = await calcular({
      piezas: [
        { anchoMm: 90, altoMm: 40, cantidad: 10 },
        { anchoMm: 200, altoMm: 100, cantidad: 23 },
      ],
    });
    expect(lineas[0].cantidad).toBeCloseTo(0.496, 8);
  });

  it('aplica la merma adicional una sola vez sobre la superficie', async () => {
    const { lineas } = await calcular({ merma: 10 });
    expect(lineas[0].cantidad).toBeCloseTo(0.13068, 8);
    expect(lineas[0].mermaAdicional).toMatchObject({
      porcentaje: 10,
      cantidadTrabajo: 0.1188,
    });
  });

  it('respeta una regla explícita de consumo base × factor', async () => {
    const { lineas } = await calcular({
      base: 'cantidad_pedida',
      factor: 0.0036,
    });
    expect(lineas[0].cantidad).toBeCloseTo(0.1188, 8);
    expect(lineas[0].unidad).toBe('m2');
  });

  it('no redefine fórmulas explícitas por pieza', async () => {
    const { lineas } = await calcular({ formula: 'por_pieza' });
    expect(lineas[0].cantidad).toBe(33);
  });

  it('no cambia los materiales de un trabajo manual sin contrato geométrico', async () => {
    const { lineas } = await calcular({ familia: 'trabajo_manual' });
    expect(lineas[0].cantidad).toBe(33);
  });

  it('no duplica el sustrato heredado de un paso anterior', async () => {
    const { lineas, errores } = await calcular({ heredado: true });
    expect(errores).toEqual([]);
    expect(lineas).toEqual([]);
  });

  it('requiere medidas en vez de cotizar el sustrato con costo cero', async () => {
    const { lineas, errores } = await calcular({ piezas: [] });
    expect(lineas).toEqual([]);
    expect(errores).toEqual([
      expect.objectContaining({
        codigo: 'medidas_material_requeridas',
        severidad: 'ERROR',
      }),
    ]);
  });
});
