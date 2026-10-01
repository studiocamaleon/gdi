import {
  runNestingForPaso,
  geometriaDispatchValida,
} from '../nesting-dispatcher';
import { calcularOutputsCanonicos } from '../outputs-canonicos';
import { MotorUniversalService } from '../motor.service';
import type { JobContext, PasoCargado } from '../tipos';

const motor = Object.create(MotorUniversalService.prototype) as any;

const material = {
  id: 'acrilico-ficticio',
  subfamilia: 'SUSTRATO_RIGIDO',
  atributosVarianteJson: { anchoMm: 1220, altoMm: 1220, espesorMm: 3 },
};
function pasos(): { impresion: PasoCargado; corte: PasoCargado } {
  const base = {
    rutaPasoOrden: 1,
    modoActivacion: 'OBLIGATORIO',
    modoTiempo: 'T-3',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    multiplicadoresActivos: [],
    slots: [],
    cargosDirectosPaso: [],
  };
  return {
    impresion: {
      ...base,
      rutaPasoId: 'impresion',
      configPasoId: 'impresion',
      familiaCodigo: 'impresion_por_area',
      paramsPasoJson: {
        nestingConfig: {
          margins: { leftMm: 5, rightMm: 5, topMm: 5, bottomMm: 5 },
          pieceBleedMm: 0,
          allowRotation: true,
        },
      },
      maquina: {
        id: 'uv',
        nombre: 'UV ficticia',
        anchoUtil: 1800,
        largoUtil: 3000,
        parametrosTecnicosJson: {
          geometria: 'MESA_EXTENSORA',
          anchoMesaMm: 1850,
          largoMesaMm: 3000,
        },
      },
    } as unknown as PasoCargado,
    corte: {
      ...base,
      rutaPasoOrden: 2,
      rutaPasoId: 'laser',
      configPasoId: 'laser',
      familiaCodigo: 'corte_laser',
      paramsPasoJson: {
        usarDisenoVectorial: true,
        permitirIngresoPorMedidas: true,
      },
      maquina: {
        id: 'laser',
        nombre: 'Láser ficticio',
        anchoUtil: 1300,
        largoUtil: 1000,
        parametrosTecnicosJson: {
          placaSobresalientePermitida: true,
          ejeSobresalientePlaca: 'Y',
        },
      },
    } as unknown as PasoCargado,
  };
}
function contexto(cantidad = 9): JobContext {
  return {
    cantidad,
    modoCotizacionVectorial: 'medidas',
    piezas: [{ anchoMm: 400, altoMm: 400, cantidad }],
  };
}
async function calcular(
  impresion: PasoCargado,
  corte: PasoCargado,
  ctx = contexto(),
) {
  const n = (await runNestingForPaso(impresion, ctx, material, {
    pasosCortePosteriores: [corte],
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
  const c = (await runNestingForPaso(corte, { ...ctx, ...outputs }, material))!;
  return { n, c };
}
describe('Impresión rígida y corte sobre un único layout compatible', () => {
  it('distribuye nueve piezas en dos placas, respetando el láser antes de imprimir', async () => {
    const { impresion, corte } = pasos();
    const { n, c } = await calcular(impresion, corte);
    expect(n.substrates).toHaveLength(2);
    expect(n.piezasAcomodadas).toBe(9);
    expect(
      n.substrates.every(
        (s) => s.kind === 'sheet' && s.widthMm === 1220 && s.heightMm === 1220,
      ),
    ).toBe(true);
    expect(n.placements.every((p) => p.yMm + p.heightMm <= 1000)).toBe(true);
    expect(
      c.placements.map((p) => [
        p.substrateIndex,
        p.xMm,
        p.yMm,
        p.widthMm,
        p.heightMm,
      ]),
    ).toEqual(
      n.placements.map((p) => [
        p.substrateIndex,
        p.xMm,
        p.yMm,
        p.widthMm,
        p.heightMm,
      ]),
    );
    expect(geometriaDispatchValida(n)).toBe(true);
    expect(geometriaDispatchValida(c)).toBe(true);
  });
  it('no cobra el excedente inaccesible como largo impreso', async () => {
    const { impresion, corte } = pasos();
    const { n } = await calcular(impresion, corte);
    n.metricasRaw.perSubstrate!.forEach((m, index) => {
      const piezas = n.placements.filter((p) => p.substrateIndex === index);
      expect(m.consumedLengthMm).toBe(
        Math.max(...piezas.map((p) => p.yMm + p.heightMm)) + 5,
      );
    });
    expect(n.metricasRaw.areaTotalMm2).toBe(2 * 1220 * 1220);
  });
  it('también conserva el registro cuando el corte viene de un vector', async () => {
    const { impresion, corte } = pasos();
    const ctx = contexto();
    delete ctx.modoCotizacionVectorial;
    ctx.geometriaVectorial = {
      schemaVersion: 1,
      anchoMm: 400,
      altoMm: 400,
      areaTotalMm2: 160000,
      perimetroTotalMm: 1600,
      hashFuente: 'ficticio',
      piezas: [
        {
          id: 'cuadrado',
          anchoMm: 400,
          altoMm: 400,
          areaMm2: 160000,
          perimetroMm: 1600,
          contornos: [
            {
              esHueco: false,
              puntos: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 400 },
                { x: 0, y: 400 },
              ],
            },
          ],
        },
      ],
    } as any;
    const { n, c } = await calcular(impresion, corte, ctx);
    expect(n.substrates).toHaveLength(2);
    expect(c.piezasAcomodadas).toBe(9);
    expect(c.placements.map((p) => [p.xMm, p.yMm])).toEqual(
      n.placements.map((p) => [p.xMm, p.yMm]),
    );
  });
  it('mantiene una placa cuando las seis piezas caben', async () => {
    const { impresion, corte } = pasos();
    expect(
      (await calcular(impresion, corte, contexto(6))).n.substrates,
    ).toHaveLength(1);
  });
  it('rechaza una pieza mayor que el área común y una placa que no entra en una mesa cerrada', async () => {
    const { impresion, corte } = pasos();
    await expect(
      calcular(impresion, corte, {
        cantidad: 1,
        modoCotizacionVectorial: 'medidas',
        piezas: [{ anchoMm: 1050, altoMm: 1050, cantidad: 1 }],
      }),
    ).rejects.toThrow(/área común/);
    corte.maquina!.parametrosTecnicosJson = {};
    await expect(calcular(impresion, corte)).rejects.toThrow(
      /supera el área útil/,
    );
  });
  it('sin corte conserva el aprovechamiento original de la impresión', async () => {
    const { impresion } = pasos();
    const n = (await runNestingForPaso(impresion, contexto(), material))!;
    expect(n.substrates).toHaveLength(1);
    expect(n.piezasAcomodadas).toBe(9);
  });
  it('combina márgenes, separación y rotación de las dos máquinas', async () => {
    const { impresion, corte } = pasos();
    (corte.paramsPasoJson as Record<string, unknown>).nestingConfig = {
      margins: { leftMm: 20, rightMm: 30, topMm: 40, bottomMm: 50 },
      separationHMm: 12,
      separationVMm: 16,
      allowRotation: false,
    };
    const { n, c } = await calcular(impresion, corte);
    expect(n.visualConfig).toMatchObject({
      allowRotation: false,
      spacing: { horizontalMm: 16, verticalMm: 16 },
    });
    expect(
      n.placements.every(
        (p) =>
          p.xMm >= 20 &&
          p.yMm >= 40 &&
          p.xMm + p.widthMm <= 1190 &&
          p.yMm + p.heightMm <= 950,
      ),
    ).toBe(true);
    expect(c.piezasAcomodadas).toBe(9);
  });
  it('respeta la orientación física al cargar una placa rectangular girada', async () => {
    const { impresion, corte } = pasos();
    const stock = {
      ...material,
      atributosVarianteJson: { anchoMm: 1600, altoMm: 900 },
    };
    const n = (await runNestingForPaso(impresion, contexto(), stock, {
      pasosCortePosteriores: [corte],
    }))!;
    expect(
      n.substrates.every(
        (s) => s.kind === 'sheet' && s.widthMm === 1600 && s.heightMm === 900,
      ),
    ).toBe(true);
    expect(n.placements.every((p) => p.xMm + p.widthMm <= 1000)).toBe(true);
  });
  it('no aplica un corte opcional apagado y sí lo aplica al seleccionarlo', async () => {
    const { impresion, corte } = pasos();
    corte.modoActivacion = 'OPCIONAL';
    const ctx = contexto();
    expect(
      await motor.resolverCortesDelLayout(
        impresion,
        [corte],
        ctx,
        material,
        'tenant-ficticio',
      ),
    ).toEqual([]);
    ctx.opcionalesActivados = { laser: true };
    expect(
      await motor.resolverCortesDelLayout(
        impresion,
        [corte],
        ctx,
        material,
        'tenant-ficticio',
      ),
    ).toHaveLength(1);
  });
  it('sólo condiciona el mismo sustrato y termina la cadena ante otra impresión', async () => {
    const { impresion, corte } = pasos();
    corte.slots = [
      { slotCodigo: 'sustrato_corte', modoSeleccion: 'HARDCODED' },
    ] as any;
    expect(
      await motor.resolverCortesDelLayout(
        impresion,
        [corte],
        contexto(),
        material,
        'tenant-ficticio',
      ),
    ).toEqual([]);
    corte.slots = [
      {
        slotCodigo: 'sustrato_corte',
        modoSeleccion: 'HEREDA_DE_PASO',
        heredaDeRutaPasoId: 'impresion',
      },
    ] as any;
    expect(
      await motor.resolverCortesDelLayout(
        impresion,
        [corte],
        contexto(),
        material,
        'tenant-ficticio',
      ),
    ).toHaveLength(1);
    expect(
      await motor.resolverCortesDelLayout(
        impresion,
        [{ ...impresion, rutaPasoId: 'otra' }, corte],
        contexto(),
        material,
        'tenant-ficticio',
      ),
    ).toEqual([]);
    corte.tercerizado = true;
    expect(
      await motor.resolverCortesDelLayout(
        impresion,
        [corte],
        contexto(),
        material,
        'tenant-ficticio',
      ),
    ).toEqual([]);
  });
  it('usa la máquina elegida comercialmente en el extra, no siempre la preferida', async () => {
    const { impresion, corte } = pasos();
    corte.maquinasCandidatas = [
      {
        id: 'a',
        maquinaId: 'laser',
        maquina: corte.maquina,
        perfilesOperativos: [],
      },
      {
        id: 'b',
        maquinaId: 'laser-grande',
        maquina: { ...corte.maquina, id: 'laser-grande', largoUtil: 1400 },
        perfilesOperativos: [],
      },
    ] as any;
    const ctx = { ...contexto(), maquinaSeleccionada_laser: 'laser-grande' };
    const resueltos = await motor.resolverCortesDelLayout(
      impresion,
      [corte],
      ctx,
      material,
      'tenant-ficticio',
    );
    expect(resueltos[0].maquina.id).toBe('laser-grande');
    const n = (await runNestingForPaso(impresion, ctx, material, {
      pasosCortePosteriores: resueltos,
    }))!;
    expect(n.substrates).toHaveLength(1);
  });
  it('incluye el mismo acrílico elegido comercialmente en ambos pasos de una receta existente', async () => {
    const { impresion, corte } = pasos();
    corte.slots = [
      {
        slotCodigo: 'sustrato_corte',
        modoSeleccion: 'COMERCIAL_ELIGE',
        candidatos: [
          {
            defaultVarianteId: material.id,
            variantes: [{ varianteId: material.id }],
          },
        ],
      },
    ] as any;
    motor.cargarVariantePorId = jest
      .fn()
      .mockResolvedValue({
        ...material,
        sku: 'FICTICIO',
        precioReferencia: 100,
      });
    try {
      const ctx = {
        ...contexto(),
        slotMateriales: { laser_sustrato_corte: material.id },
      };
      const resueltos = await motor.resolverCortesDelLayout(
        impresion,
        [corte],
        ctx,
        material,
        'tenant-ficticio',
      );
      expect(resueltos).toHaveLength(1);
      expect(motor.cargarVariantePorId).toHaveBeenCalledWith(
        'tenant-ficticio',
        material.id,
      );
      expect(
        (await runNestingForPaso(impresion, ctx, material, {
          pasosCortePosteriores: resueltos,
        }))!.substrates,
      ).toHaveLength(2);
    } finally {
      delete motor.cargarVariantePorId;
    }
  });
  it('el paso productivo recibe los límites del extra antes de calcular sus costos', async () => {
    const { impresion, corte } = pasos();
    impresion.slots = [
      {
        slotCodigo: 'sustrato_principal',
        slotRol: 'SUSTRATO',
        modoSeleccion: 'HARDCODED',
        formula: 'por_unidad_productiva',
        aplicaMultiCaras: false,
        mermaAdicionalPct: 0,
        materialVariante: {
          ...material,
          sku: 'FICTICIO',
          precioReferencia: 100,
          unidadStock: 'M2',
        },
      },
    ] as any;
    const errores: any[] = [];
    const resultado = await motor.ejecutarPaso(
      'tenant-ficticio',
      impresion,
      contexto(),
      errores,
      new Map(),
      '2026-10',
      new Set(),
      [corte],
    );
    expect(errores.filter((e) => e.severidad === 'ERROR')).toEqual([]);
    expect(resultado.nestingResult.substrates).toHaveLength(2);
    expect(
      resultado.outputsCanonicos.layout_produccion.placements,
    ).toHaveLength(9);
  });
});
