import { MotorUniversalService } from '../motor.service';
import {
  debeEjecutarNestingRectangularCorte,
  resolveNestingConfig,
} from '../nesting-config';
import {
  geometriaDispatchValida,
  runNestingForPaso,
} from '../nesting-dispatcher';
import { calcularOutputsCanonicos } from '../outputs-canonicos';
import { resolverFamilia } from '../../productos-servicios/pasos/familias';
import type { ErrorMotor, JobContext, PasoCargado } from '../tipos';

const material = {
  id: 'acrilico',
  sku: 'ACR-8',
  materiaPrimaNombre: 'Acrílico',
  materiaPrimaTemplateId: 'sustrato_rigido_v1',
  subfamilia: 'SUSTRATO_RIGIDO',
  unidadStock: 'M2',
  precioReferencia: 170_000 / (1.22 * 1.22),
  contextoUnidades: {
    unidadStock: 'M2',
    unidadUso: 'M2',
    unidadCompra: 'PLACA',
    unidadPrecio: 'PLACA',
    templateId: 'sustrato_rigido_v1',
    atributos: { anchoMm: 1220, altoMm: 1220 },
  },
  atributosVarianteJson: { anchoMm: 1220, altoMm: 1220 },
};
function paso(familiaCodigo = 'corte_laser'): PasoCargado {
  return {
    rutaPasoId: 'corte',
    rutaPasoOrden: 1,
    configPasoId: 'corte',
    familiaCodigo,
    mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
    modoActivacion: 'OBLIGATORIO',
    modoTiempo: 'T-4',
    condicionActivacionJson: null,
    mecanismoCantidadConfigJson: null,
    maquinaM1Id: 'laser',
    perfilM1Id: null,
    setupOverrideMin: 0,
    cleanupOverrideMin: 0,
    tiempoFijoOverrideMin: 0,
    paramsPasoJson: {
      usarDisenoVectorial: true,
      nestingConfig: {
        margins: { leftMm: 5, rightMm: 5, topMm: 5, bottomMm: 5 },
        separationHMm: 3,
        separationVMm: 3,
        allowRotation: true,
      },
    },
    multiplicadoresActivos: [],
    cargosDirectosPaso: [],
    maquinasCandidatas: [],
    slots: [
      {
        slotCodigo: 'sustrato_corte',
        modoSeleccion: 'HARDCODED',
        formula: 'por_unidad_productiva',
        aplicaMultiCaras: false,
        mermaAdicionalPct: 0,
        materialVariante: material,
      },
    ],
    maquina: {
      id: 'laser',
      nombre: 'Láser',
      plantilla: 'CORTE_LASER',
      anchoUtil: 1300,
      largoUtil: 1000,
      parametrosTecnicosJson: {
        placaSobresalientePermitida: true,
        ejeSobresalientePlaca: 'Y',
      },
      consumibles: [],
      componentesDesgaste: [],
    },
  } as unknown as PasoCargado;
}
function contexto(): JobContext {
  return {
    cantidad: 33,
    modoCotizacionVectorial: 'medidas',
    medidaCustomMm: { anchoMm: 90, altoMm: 40 },
    piezas: [{ anchoMm: 90, altoMm: 40, cantidad: 33 }],
  };
}
const motor = Object.create(MotorUniversalService.prototype) as any;
async function ejecutar(p = paso(), jc = contexto()) {
  const errores: ErrorMotor[] = [];
  const resultado = await motor.ejecutarPaso(
    'tenant',
    p,
    jc,
    errores,
    new Map(),
    '2026-09',
  );
  return { resultado, errores };
}
async function cotizarMaterial(p = paso(), jc = contexto()) {
  const nesting = await runNestingForPaso(p, jc, material);
  const errores: ErrorMotor[] = [];
  const lineas = await motor.calcularMateriales(
    'tenant',
    p,
    jc,
    nesting,
    errores,
  );
  expect(errores).toEqual([]);
  return { nesting: nesting!, lineas };
}

describe('Corte rectangular: acomodo, cantidad y costo independientes', () => {
  it.each(['corte_laser', 'cnc', 'troquelado_digital'])(
    '%s ejecuta el nesting desde el paso con cantidad directa',
    async (familia) => {
      const { resultado, errores } = await ejecutar(paso(familia));
      expect(errores.filter((e) => e.severidad === 'ERROR')).toEqual([]);
      expect(resultado.nestingResult).toMatchObject({
        cantidadCalculada: 1,
        piezasAcomodadas: 33,
      });
      expect(resultado.nestingResult.placements).toHaveLength(33);
      expect(resultado.materiales[0].cantidad).toBeCloseTo(0.1188, 10);
      expect(resultado.materiales[0].costoTotal).toBeCloseTo(13568.93, 2);
      expect(
        resultado.outputsCanonicos[
          familia === 'troquelado_digital'
            ? 'piezas_troqueladas'
            : 'piezas_cortadas'
        ],
      ).toBe(33);
    },
  );

  it('conserva la placa física y limita todos los cortes a la zona útil, con margen', async () => {
    const jc = contexto();
    jc.piezaPerimetroTotalM = 999;
    const n = (await runNestingForPaso(paso(), jc, material))!;
    expect(geometriaDispatchValida(n)).toBe(true);
    expect(n.substrates[0]).toMatchObject({ widthMm: 1220, heightMm: 1220 });
    expect(n.visualConfig?.manejoPlaca).toMatchObject({
      eje: 'y',
      excedenteMm: 220,
    });
    expect(n.aprovechamientoPct).toBeCloseTo((0.1188 / 1.4884) * 100, 6);
    expect(jc.piezaPerimetroTotalM).toBeCloseTo(8.58, 8);
    for (const p of n.placements) {
      expect(p.xMm).toBeGreaterThanOrEqual(5);
      expect(p.yMm).toBeGreaterThanOrEqual(5);
      expect(p.xMm + p.widthMm).toBeLessThanOrEqual(1215);
      expect(p.yMm + p.heightMm).toBeLessThanOrEqual(995);
    }
  });

  it('mantiene el precio por superficie con receta antigua y respeta placa completa explícita', async () => {
    expect(
      resolveNestingConfig(paso(), contexto(), material).costing.strategy,
    ).toBe('m2-exact');
    const p = paso();
    (p.paramsPasoJson as any).nestingConfig.costing = { strategy: 'simple' };
    const { lineas } = await cotizarMaterial(p);
    expect(lineas[0]).toMatchObject({
      cantidad: 1,
      unidad: 'placa',
      costoTotal: 170000,
      estrategiaCosto: 'simple',
    });
  });

  it.each(['plate-segments', 'consumed-length', 'm2-exact'])(
    'aplica la estrategia explícita %s',
    async (strategy) => {
      const p = paso();
      (p.paramsPasoJson as any).nestingConfig.costing = {
        strategy,
        segmentSteps: [25, 50, 75, 100],
      };
      const { lineas } = await cotizarMaterial(p);
      expect(lineas[0].estrategiaCosto).toBe(strategy);
      expect(lineas[0].costoTotal).toBeGreaterThan(0);
      expect(lineas[0].costoTotal).toBeLessThan(170000);
    },
  );

  it('conserva una regla explícita base por factor al agregar el acomodo', async () => {
    const p = paso();
    p.slots[0].cantidadBase = 'cantidad_pedida';
    p.slots[0].cantidadFactor = 0.01;
    const { nesting, lineas } = await cotizarMaterial(p);
    expect(nesting.piezasAcomodadas).toBe(33);
    expect(lineas[0].cantidad).toBeCloseTo(0.33, 8);
  });

  it('mantiene el mecanismo calculado y su estrategia predeterminada por placa', async () => {
    const p = paso();
    p.mecanismoCantidad = 'CALCULADO_POR_PASO';
    const { lineas } = await cotizarMaterial(p);
    expect(lineas[0]).toMatchObject({
      cantidad: 1,
      costoTotal: 170000,
      estrategiaCosto: 'simple',
    });
  });

  it('suma las áreas de medidas distintas aunque exista una medida comercial principal', async () => {
    const jc = contexto();
    jc.piezas = [
      { anchoMm: 90, altoMm: 40, cantidad: 10 },
      { anchoMm: 200, altoMm: 100, cantidad: 23 },
    ];
    const { nesting, lineas } = await cotizarMaterial(paso(), jc);
    expect(nesting.piezasAcomodadas).toBe(33);
    expect(nesting.metricasRaw.areaUtilMm2).toBe(496000);
    expect(lineas[0].cantidad).toBeCloseTo(0.496, 10);
  });

  it('abre varias placas y conserva la cantidad de piezas en outputs', async () => {
    const jc = contexto();
    jc.cantidad = 10;
    jc.piezas = [{ anchoMm: 600, altoMm: 600, cantidad: 10 }];
    const n = (await runNestingForPaso(paso(), jc, material))!;
    expect(n.cantidadCalculada).toBe(5);
    expect(n.placements).toHaveLength(10);
    const outputs = calcularOutputsCanonicos(resolverFamilia('corte_laser')!, {
      paso: paso(),
      jobContext: jc,
      nestingDispatch: n,
      cantidadEfectiva: 5,
    } as any);
    expect(outputs.piezas_cortadas).toBe(10);
  });

  it('usa medidaCustomMm cuando no hay lista y admite recetas rectangulares anteriores', async () => {
    const jc = contexto();
    delete jc.piezas;
    delete jc.modoCotizacionVectorial;
    const p = paso();
    p.paramsPasoJson = {};
    expect((await runNestingForPaso(p, jc, material))?.piezasAcomodadas).toBe(
      33,
    );
  });

  it('no reemplaza el modo SVG ni la estimación por placas con rectángulos', () => {
    for (const modo of ['svg', 'placas'] as const)
      expect(
        debeEjecutarNestingRectangularCorte(paso(), {
          ...contexto(),
          modoCotizacionVectorial: modo,
        }),
      ).toBe(false);
    expect(
      debeEjecutarNestingRectangularCorte(
        paso('corte_hilo_caliente'),
        contexto(),
      ),
    ).toBe(false);
  });

  it('ignora geometría vectorial residual al volver a medidas', async () => {
    const jc = contexto();
    jc.geometriaVectorial = { piezas: [{ id: 'residual' }] } as any;
    const n = (await runNestingForPaso(paso(), jc, material))!;
    expect(n.piezasAcomodadas).toBe(33);
    expect(n.layoutVinculadoGeometriaVectorial).toBeUndefined();
  });

  it('rechaza placa que no entra en una cama cerrada y pieza fuera de la zona de corte', async () => {
    const p = paso();
    p.maquina!.parametrosTecnicosJson = {};
    await expect(runNestingForPaso(p, contexto(), material)).rejects.toThrow(
      'supera el área útil',
    );
    const jc = contexto();
    jc.piezas = [{ anchoMm: 1100, altoMm: 1100, cantidad: 1 }];
    const { resultado, errores } = await ejecutar(paso(), jc);
    expect(resultado.nestingResult).toBeUndefined();
    expect(errores).toEqual(
      expect.arrayContaining([expect.objectContaining({ severidad: 'ERROR' })]),
    );
  });

  it('respeta rotación deshabilitada', async () => {
    const jc = contexto();
    jc.piezas = [{ anchoMm: 800, altoMm: 1100, cantidad: 1 }];
    expect(
      (await runNestingForPaso(paso(), jc, material))?.placements[0].rotated,
    ).toBe(true);
    const p = paso();
    (p.paramsPasoJson as any).nestingConfig.allowRotation = false;
    await expect(runNestingForPaso(p, jc, material)).rejects.toThrow(
      'no entran',
    );
  });

  it('conserva posiciones impresas y no vuelve a cobrar un sustrato heredado', async () => {
    const jc = contexto();
    const p = paso();
    const base = (await runNestingForPaso(p, jc, material))!;
    jc.layout_produccion = {
      schemaVersion: 1,
      sourceFamiliaCodigo: 'impresion_por_area',
      sourceRutaPasoId: 'impresion',
      sourceConfigPasoId: 'impresion',
      materialVarianteId: material.id,
      algorithm: base.algorithm,
      substrates: base.substrates,
      placements: base.placements.map((p) => ({ ...p, yMm: p.yMm + 10 })),
      visualConfig: base.visualConfig,
    };
    p.slots = [
      {
        ...p.slots[0],
        modoSeleccion: 'HEREDA_DE_PASO',
        materialHeredado: { paso: paso(), slot: paso().slots[0] },
      } as any,
    ];
    const { nesting, lineas } = await cotizarMaterial(p, jc);
    expect(nesting.placements).toEqual(jc.layout_produccion.placements);
    expect(lineas).toEqual([]);
    jc.layout_produccion.placements[0] = {
      ...jc.layout_produccion.placements[0],
      yMm: 1100,
    };
    await expect(runNestingForPaso(p, jc, material)).rejects.toThrow(
      'fuera del área de corte',
    );
  });
});
