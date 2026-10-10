import { MotorUniversalService } from '../motor.service';
import {
  runNestingForPaso,
  type NestingDispatchResult,
} from '../nesting-dispatcher';
import { resolveNestingConfig } from '../nesting-config';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import type {
  ErrorMotor,
  JobContext,
  MaterialEjecutado,
  PasoCargado,
} from '../tipos';

const material = {
  id: 'vinilo-ficticio',
  sku: 'VINILO-PRUEBA',
  materiaPrimaNombre: 'Vinilo de prueba',
  precioReferencia: 4000,
  unidadStock: 'METRO_LINEAL',
  subfamilia: 'VINILO_CORTE',
  atributosVarianteJson: { anchoMm: 600, largoRolloMm: 50000 },
};

function pasoRollo(familiaCodigo = 'plotter_corte'): PasoCargado {
  return {
    rutaPasoId: 'corte',
    rutaPasoOrden: 1,
    configPasoId: 'corte',
    familiaCodigo,
    modoActivacion: 'OBLIGATORIO',
    modoTiempo: 'T-3',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    multiplicadoresActivos: [],
    paramsPasoJson: {
      nestingConfig: {
        margins: { topMm: 10, bottomMm: 10, leftMm: 10, rightMm: 10 },
        allowRotation: true,
      },
    },
    slots: [
      {
        slotCodigo: 'sustrato_corte',
        modoSeleccion: 'HARDCODED',
        formula: 'por_unidad_productiva',
        aplicaMultiCaras: false,
        cantidadFactor: 1,
        mermaAdicionalPct: 0,
        materialVariante: material,
      },
    ],
    cargosDirectosPaso: [],
    dotacionOperarios: 1,
    maquina: {
      id: 'plotter',
      nombre: 'Plotter ficticio',
      plantilla: 'PLOTTER_DE_CORTE',
      centroCostoPrincipalId: 'taller',
      anchoUtil: 1600,
      parametrosTecnicosJson: {
        geometria: 'ROLLO',
        operacionMaquina: 'autonoma',
      },
      consumibles: [],
      componentesDesgaste: [],
    },
    perfil: {
      id: 'perfil',
      nombre: 'Corte',
      tipoPerfil: 'CORTE',
      productivityValue: 10,
      productivityUnit: 'M2_H',
      setupMin: 5,
      cleanupMin: 0,
    },
  } as unknown as PasoCargado;
}

function contexto(metros: number): JobContext {
  return {
    cantidad: 1,
    modoCotizacionLineal: 'directo',
    metrosLineales: metros,
    cantidadComercial: metros,
    cantidadComercialPricing: metros,
    piezas: [{ cantidad: 1, anchoMm: 580, altoMm: metros * 1000 }],
    piezaAreaTotalM2: 0.58 * metros,
  };
}

type MotorCalculo = {
  calcularMateriales: (
    tenant: string,
    paso: PasoCargado,
    job: JobContext,
    nesting: NestingDispatchResult | null,
    errores: ErrorMotor[],
  ) => Promise<MaterialEjecutado[]>;
  calcularTiempo: (
    paso: PasoCargado,
    job: JobContext,
    errores: ErrorMotor[],
    tarifas: Map<string, unknown>,
    periodo: string,
    nesting: NestingDispatchResult | null,
    material: unknown,
  ) => { costo: number; setupMin: number; totalMin: number };
};

async function cotizar(metros: number) {
  const paso = pasoRollo(),
    job = contexto(metros);
  const nesting = await runNestingForPaso(paso, job, material);
  const motor = Object.create(MotorUniversalService.prototype) as MotorCalculo;
  const errores: ErrorMotor[] = [];
  const materiales = await motor.calcularMateriales(
    'empresa-ficticia',
    paso,
    job,
    nesting,
    errores,
  );
  const tiempo = motor.calcularTiempo(
    paso,
    job,
    errores,
    new Map([['taller', { tarifa: 6000, manoObra: 2000 }]]),
    '2026-10',
    nesting,
    material,
  );
  expect(errores).toEqual([]);
  // Una preparación fija se cobra una vez, incluso con fracciones de metro.
  const costoPreparacion = 1500;
  const costo =
    costoPreparacion +
    tiempo.costo +
    materiales.reduce((s, m) => s + m.costoTotal, 0);
  const precio = new AplicarPrecioService().aplicar({
    costoUnitario: costo / metros,
    cantidad: metros,
    precioConfig: {
      metodoCalculo: 'margen_variable',
      detalle: { tiers: [{ quantityUntil: 100, marginPct: 40 }] },
    },
    impuestos: [],
    comisiones: [],
  });
  return { nesting, materiales, tiempo, precio };
}

describe('Cotización de rollo por metros lineales', () => {
  it.each([0.25, 0.5, 1, 1.5, 2])(
    'conserva el largo de %s m sin girar la franja',
    async (metros) => {
      const r = await cotizar(metros);
      expect(r.nesting?.cantidadCalculada).toBeCloseTo(metros + 0.02);
      expect(r.nesting?.placements).toHaveLength(1);
      expect(r.nesting?.placements[0]).toMatchObject({
        widthMm: 580,
        heightMm: metros * 1000,
        rotated: false,
      });
      expect(r.nesting?.visualConfig?.allowRotation).toBe(false);
      expect(r.materiales[0].cantidad).toBeCloseTo(metros + 0.02);
      expect(r.materiales[0].costoTotal).toBeCloseTo((metros + 0.02) * 4000);
      expect(r.tiempo.setupMin).toBe(5);
    },
  );

  it('material, tiempo y precio crecen con el largo; medio metro conserva la preparación fija', async () => {
    const a = await cotizar(0.25),
      b = await cotizar(0.5),
      c = await cotizar(1),
      d = await cotizar(1.5);
    const precios = [a, b, c, d].map((r) => r.precio.precioNetoTotal);
    expect(precios[0]).toBeLessThan(precios[1]);
    expect(precios[1]).toBeLessThan(precios[2]);
    expect(precios[2]).toBeLessThan(precios[3]);
    expect(precios[1]).toBeGreaterThan(precios[2] / 2);
    expect(b.tiempo.totalMin).toBeLessThan(c.tiempo.totalMin);
  });

  it('aplica la misma franja a impresión por área sobre rollo', async () => {
    const r = await runNestingForPaso(
      pasoRollo('impresion_por_area'),
      contexto(0.5),
      material,
    );
    expect(r?.cantidadCalculada).toBeCloseTo(0.52);
    expect(r?.placements[0].rotated).toBe(false);
  });

  it('mantiene el acomodo por piezas y su demasía automática', async () => {
    const r = await runNestingForPaso(
      pasoRollo(),
      { ...contexto(0.5), modoCotizacionLineal: 'nesting' },
      material,
    );
    expect(r?.cantidadCalculada).toBeCloseTo(0.605);
    expect(r?.placements[0].rotated).toBe(true);
  });

  it.each(['directo', 'nesting'])(
    'rechaza un corte que no entra sin convertir área en metros (%s)',
    async (modo) => {
      await expect(
        runNestingForPaso(
          pasoRollo(),
          {
            ...contexto(1),
            modoCotizacionLineal: modo,
            piezas: [{ cantidad: 1, anchoMm: 900, altoMm: 1000 }],
          },
          material,
        ),
      ).rejects.toMatchObject({ codigo: 'corte_rollo_sin_layout' });
    },
  );

  it('respeta las demasías explícitas del paso y de su familia', () => {
    const paso = pasoRollo();
    paso.defaultsFamilia = { demasiaMm: 3 } as PasoCargado['defaultsFamilia'];
    expect(
      resolveNestingConfig(paso, contexto(0.5), material).pieceBleedMm,
    ).toBe(3);
    paso.paramsPasoJson = { nestingConfig: { pieceBleedMm: 2 } };
    expect(
      resolveNestingConfig(paso, contexto(0.5), material).pieceBleedMm,
    ).toBe(2);
  });
});
