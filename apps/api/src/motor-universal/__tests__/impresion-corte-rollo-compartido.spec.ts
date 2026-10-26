import { MotorUniversalService } from '../motor.service';
import { runNestingForPaso } from '../nesting-dispatcher';
import { calcularOutputsCanonicos } from '../outputs-canonicos';
import type { JobContext, PasoCargado } from '../tipos';

const motor = Object.create(MotorUniversalService.prototype) as any;
const material = {
  id: 'vinilo-ficticio',
  sku: 'VINILO-FICTICIO',
  subfamilia: 'SUSTRATO_ROLLO_FLEXIBLE',
  unidadStock: 'M2',
  precioReferencia: 100,
  atributosVarianteJson: { anchoMm: 610, largoRolloMm: 50000 },
};
function pasos(): { impresion: PasoCargado; corte: PasoCargado } {
  const base = {
    rutaPasoOrden: 1,
    modoActivacion: 'OBLIGATORIO',
    modoTiempo: 'T-3',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    multiplicadoresActivos: [],
    cargosDirectosPaso: [],
    paramsPasoJson: { nestingConfig: { algorithm: 'shelf-rollo' } },
  };
  return {
    impresion: {
      ...base,
      rutaPasoId: 'impresion',
      configPasoId: 'impresion',
      familiaCodigo: 'impresion_por_area',
      slots: [
        {
          slotCodigo: 'sustrato_principal',
          slotRol: 'SUSTRATO',
          modoSeleccion: 'HARDCODED',
          formula: 'por_unidad_productiva',
          aplicaMultiCaras: false,
          mermaAdicionalPct: 0,
          materialVariante: material,
        },
      ],
      maquina: {
        id: 'impresora-ficticia',
        nombre: 'Impresora ficticia',
        plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
        parametrosTecnicosJson: {
          geometria: 'ROLLO',
          anchoMaxRolloMm: 1600,
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 },
        },
        consumibles: [],
        componentesDesgaste: [],
      },
    } as unknown as PasoCargado,
    corte: {
      ...base,
      rutaPasoOrden: 2,
      rutaPasoId: 'troquelado',
      configPasoId: 'troquelado',
      familiaCodigo: 'plotter_corte',
      slots: [
        {
          slotCodigo: 'sustrato_corte',
          slotRol: 'SUSTRATO',
          modoSeleccion: 'HEREDA_DE_PASO',
          heredaDeRutaPasoId: 'impresion',
        },
      ],
      maquina: {
        id: 'plotter-ficticio',
        nombre: 'Plotter ficticio',
        plantilla: 'PLOTTER_DE_CORTE',
        parametrosTecnicosJson: {
          geometria: 'ROLLO',
          anchoMaxRolloMm: 700,
          margenesNoImprimiblesMm: { izq: 15, der: 20, sup: 30, inf: 40 },
        },
      },
    } as unknown as PasoCargado,
  };
}
function contexto(modoColor = 'SIN_IMPRESION'): JobContext {
  return {
    cantidad: 5000,
    piezas: [{ anchoMm: 40, altoMm: 40, cantidad: 5000 }],
    modoColor_impresion: modoColor,
  };
}
async function ejecutarMaterial(
  impresion: PasoCargado,
  posteriores: PasoCargado[],
) {
  const errores: any[] = [];
  const resultado = await motor.ejecutarPaso(
    'tenant-ficticio',
    impresion,
    contexto(),
    errores,
    new Map(),
    '2026-10',
    new Set(),
    posteriores,
  );
  expect(errores.filter((e) => e.severidad === 'ERROR')).toEqual([]);
  return resultado;
}

describe('Vinilo y troquelado comparten un rollo compatible', () => {
  it('cotiza 5.000 piezas de 4 × 4 cm sin impresión y conserva el acomodo en el plotter', async () => {
    const { impresion, corte } = pasos();
    const resultado = await ejecutarMaterial(impresion, [corte]);
    const layout = resultado.outputsCanonicos.layout_produccion;
    const cortado = (await runNestingForPaso(
      corte,
      { ...contexto(), ...resultado.outputsCanonicos },
      material,
    ))!;
    expect(layout.placements).toHaveLength(5000);
    expect(cortado.placements).toEqual(layout.placements);
    expect(cortado.substrates).toEqual(layout.substrates);
    const rollo = layout.substrates[0];
    expect(
      layout.placements.every(
        (p: any) =>
          p.xMm >= 15 &&
          p.xMm + p.widthMm <= 590 &&
          p.yMm >= 30 &&
          p.yMm + p.heightMm <= rollo.lengthMm - 40,
      ),
    ).toBe(true);
    expect(resultado.tiempo.totalMin).toBe(0);
    expect(resultado.tiempo.costo).toBe(0);
    expect(resultado.materiales).toHaveLength(1);
    expect(resultado.materiales[0].cantidad).toBeCloseTo(
      (0.61 * rollo.lengthMm) / 1000,
      8,
    );
    expect(resultado.materiales[0].costoTotal).toBeCloseTo(
      (100 * 0.61 * rollo.lengthMm) / 1000,
      6,
    );
  });

  it('sin troquelado conserva el aprovechamiento sin márgenes de impresión', async () => {
    const { impresion } = pasos();
    const resultado = await ejecutarMaterial(impresion, []);
    const layout = resultado.outputsCanonicos.layout_produccion;
    expect(Math.min(...layout.placements.map((p: any) => p.xMm))).toBe(0);
    expect(Math.min(...layout.placements.map((p: any) => p.yMm))).toBe(0);
    expect(layout.substrates[0].lengthMm).toBe(Math.ceil(5000 / 15) * 40);
  });

  it('también anticipa el margen del plotter cuando hay impresión CMYK', async () => {
    const { impresion, corte } = pasos();
    const ctx = contexto('CMYK');
    const cortes = await motor.resolverCortesDelLayout(
      impresion,
      [corte],
      ctx,
      material,
      'tenant-ficticio',
    );
    const n = (await runNestingForPaso(impresion, ctx, material, {
      pasosCortePosteriores: cortes,
    }))!;
    const outputs = calcularOutputsCanonicos(
      { outputsCanonicos: ['layout_produccion'] } as any,
      {
        paso: impresion,
        jobContext: ctx,
        nestingDispatch: n,
        cantidadEfectiva: n.cantidadCalculada,
        materiales: [
          { slotRol: 'SUSTRATO', materialVarianteId: material.id },
        ] as any,
      },
    );
    const c = (await runNestingForPaso(
      corte,
      { ...ctx, ...outputs },
      material,
    ))!;
    expect(c.placements).toEqual(n.placements);
    expect(c.substrates).toEqual(n.substrates);
  });

  it('el extra opcional sólo limita el rollo cuando se activa', async () => {
    const { impresion, corte } = pasos();
    corte.modoActivacion = 'OPCIONAL';
    const resolver = (ctx: JobContext) =>
      motor.resolverCortesDelLayout(
        impresion,
        [corte],
        ctx,
        material,
        'tenant-ficticio',
      );
    expect(await resolver(contexto())).toEqual([]);
    expect(
      await resolver({
        ...contexto(),
        opcionalesActivados: { troquelado: true },
      }),
    ).toHaveLength(1);
  });

  it('contempla el corte heredado a través de un laminado', async () => {
    const { impresion, corte } = pasos();
    const laminado = {
      ...structuredClone(corte),
      familiaCodigo: 'laminado',
      rutaPasoId: 'laminado',
      configPasoId: 'laminado',
    };
    corte.slots[0].heredaDeRutaPasoId = 'laminado';
    const resultado = await ejecutarMaterial(impresion, [laminado, corte]);
    const c = (await runNestingForPaso(
      corte,
      { ...contexto(), ...resultado.outputsCanonicos },
      material,
    ))!;
    expect(c.placements).toEqual(
      resultado.outputsCanonicos.layout_produccion.placements,
    );
  });

  it('no aplica límites de rollo al papel ni al plotter con material propio', async () => {
    const { impresion, corte } = pasos();
    const resolver = (sustrato: typeof material) =>
      motor.resolverCortesDelLayout(
        impresion,
        [corte],
        contexto(),
        sustrato,
        'tenant-ficticio',
      );
    expect(
      await resolver({
        ...material,
        subfamilia: 'SUSTRATO_HOJA',
        atributosVarianteJson: { anchoMm: 610, altoMm: 430 },
      } as any),
    ).toEqual([]);
    corte.slots[0].modoSeleccion = 'HARDCODED';
    corte.slots[0].materialVariante = material as any;
    expect(await resolver(material)).toEqual([]);
  });

  it('rechaza un rollo físicamente más ancho que la boca del plotter', async () => {
    const { impresion, corte } = pasos();
    corte.maquina!.parametrosTecnicosJson = {
      geometria: 'ROLLO',
      anchoMaxRolloMm: 600,
    };
    await expect(
      runNestingForPaso(impresion, contexto(), material, {
        pasosCortePosteriores: [corte],
      }),
    ).rejects.toThrow('supera el ancho admitido');
  });

  it('no cotiza por área cruda si una pieza no entra entre los márgenes del corte', async () => {
    const { impresion, corte } = pasos();
    const ctx = motor.getJobContextParaNesting(impresion, {
      ...contexto(),
      cantidad: 1,
      piezas: [{ anchoMm: 600, altoMm: 600, cantidad: 1 }],
    });
    await expect(
      runNestingForPaso(impresion, ctx, material, {
        pasosCortePosteriores: [corte],
      }),
    ).rejects.toThrow('ancho útil compartido');
  });
});
