/**
 * Imposición de cuadernillo a caballete — integración a nivel dispatcher
 * (sin DB): un paso de impresion_por_hoja con imposición activada convierte
 * páginas + ejemplares en pliegos y publica el plan.
 */
import { runNestingForPaso } from '../nesting-dispatcher';
import type { JobContext, PasoCargado } from '../tipos';
import { FAMILIAS } from '../../productos-servicios/pasos/familias';

function pasoImpresion(
  overrides: Partial<Record<string, unknown>> = {},
): PasoCargado {
  return {
    rutaPasoId: 'rp-1',
    configPasoId: 'cp-1',
    rutaPasoOrden: 1,
    familiaCodigo: 'impresion_por_hoja',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    paramsPasoJson: {
      nestingConfig: {
        imposicion: { esquema: 'caballete' },
        // SRA3 como pliego de impresión fijo.
        pliegoImpresion: { anchoMm: 450, altoMm: 320 },
        ...((overrides.nestingConfig as object) ?? {}),
      },
      ...overrides,
    },
  } as unknown as PasoCargado;
}

function jobContext(extra: Partial<JobContext> = {}): JobContext {
  return {
    cantidad: 200,
    paginas: 32,
    medidaCustomMm: { anchoMm: 148, altoMm: 210 }, // página A5
    ...extra,
  } as JobContext;
}

describe('Imposición caballete en el dispatcher', () => {
  it('revista A5 32 páginas × 200 en SRA3 → K=2 pares por cara, 800 pliegos', async () => {
    const r = await runNestingForPaso(pasoImpresion(), jobContext(), null);
    expect(r).not.toBeNull();
    expect(r!.unidad).toBe('pliegos');
    expect(r!.piezasPorPliego).toBe(2);
    expect(r!.cantidadCalculada).toBe(800);
    const c = r!.imposicionCuadernillo!;
    expect(c.hojasPorLibro).toBe(8);
    expect(c.librosPorJuego).toBe(2);
    expect(c.plan[0]).toEqual({ hoja: 1, frente: [32, 1], dorso: [2, 31] });
  });

  it('sin páginas devuelve null (el guard del motor pone el diagnóstico)', async () => {
    const r = await runNestingForPaso(
      pasoImpresion(),
      jobContext({ paginas: undefined }),
      null,
    );
    expect(r).toBeNull();
  });

  it('paginasDefault del paso alimenta la imposición cuando el comercial no cargó', async () => {
    const paso = pasoImpresion({
      nestingConfig: {
        imposicion: { esquema: 'caballete', paginasDefault: 16 },
        pliegoImpresion: { anchoMm: 450, altoMm: 320 },
      },
    });
    const r = await runNestingForPaso(paso, jobContext({ paginas: undefined }), null);
    expect(r).not.toBeNull();
    expect(r!.imposicionCuadernillo!.hojasPorLibro).toBe(4);
  });

  it('excede el tope de hojas → null (corta con diagnóstico, no cotiza en silencio)', async () => {
    const r = await runNestingForPaso(
      pasoImpresion(),
      jobContext({ paginas: 200 }),
      null,
    );
    expect(r).toBeNull();
  });

  it('en impresora láser el acomodo se dibuja centrado (mismo criterio que las tarjetas)', async () => {
    const paso = pasoImpresion();
    (paso as unknown as Record<string, unknown>).maquina = {
      id: 'm1',
      codigo: 'LASER-1',
      nombre: 'Láser',
      plantilla: 'impresora_laser',
    };
    const r = await runNestingForPaso(paso, jobContext(), null);
    expect(r?.visualConfig?.centerPlacements).toBe(true);
  });

  it('paso de TAPA: 1 hoja por libro → 100 pliegos (tapa en otro papel)', async () => {
    const paso = pasoImpresion({
      nestingConfig: {
        imposicion: { esquema: 'caballete', hojas: 'tapa' },
        pliegoImpresion: { anchoMm: 450, altoMm: 320 },
      },
    });
    const r = await runNestingForPaso(paso, jobContext(), null);
    expect(r!.cantidadCalculada).toBe(100);
    const c = r!.imposicionCuadernillo!;
    expect(c.hojasDelPaso).toBe(1);
    expect(c.hojasPorLibro).toBe(8); // el LIBRO sigue teniendo 8
    expect(c.paginasDelPaso).toEqual([1, 2, 31, 32]);
  });

  it('paso de INTERIOR: 7 hojas por libro → 700 pliegos', async () => {
    const paso = pasoImpresion({
      nestingConfig: {
        imposicion: { esquema: 'caballete', hojas: 'interior' },
        pliegoImpresion: { anchoMm: 450, altoMm: 320 },
      },
    });
    const r = await runNestingForPaso(paso, jobContext(), null);
    expect(r!.cantidadCalculada).toBe(700);
    expect(r!.imposicionCuadernillo!.hojasDelPaso).toBe(7);
  });

  it('tapa + interior suman exactamente el libro completo', async () => {
    const mk = (hojas: string) =>
      pasoImpresion({
        nestingConfig: {
          imposicion: { esquema: 'caballete', hojas },
          pliegoImpresion: { anchoMm: 450, altoMm: 320 },
        },
      });
    const tapa = await runNestingForPaso(mk('tapa'), jobContext(), null);
    const interior = await runNestingForPaso(mk('interior'), jobContext(), null);
    expect(tapa!.cantidadCalculada + interior!.cantidadCalculada).toBe(800);
  });

  it('rango de hojas: el paso publica las páginas que arrastra', async () => {
    const paso = pasoImpresion({
      nestingConfig: {
        imposicion: {
          esquema: 'caballete',
          hojas: { modo: 'rango', desde: 1, hasta: 4 },
        },
        pliegoImpresion: { anchoMm: 450, altoMm: 320 },
      },
    });
    const r = await runNestingForPaso(paso, jobContext(), null);
    const c = r!.imposicionCuadernillo!;
    expect(c.hojasDelPaso).toBe(4);
    // "las primeras 8 a color" también arrastra las últimas 8
    expect(c.paginasDelPaso).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 25, 26, 27, 28, 29, 30, 31, 32,
    ]);
  });

  it('interior sobre un documento de 4 páginas devuelve null (no hay interior)', async () => {
    const paso = pasoImpresion({
      nestingConfig: {
        imposicion: { esquema: 'caballete', hojas: 'interior' },
        pliegoImpresion: { anchoMm: 450, altoMm: 320 },
      },
    });
    const r = await runNestingForPaso(paso, jobContext({ paginas: 4 }), null);
    expect(r).toBeNull();
  });

  it('sin imposición configurada sigue el camino grid de siempre', async () => {
    const paso = pasoImpresion();
    (paso.paramsPasoJson as Record<string, unknown>).nestingConfig = {
      pliegoImpresion: { anchoMm: 450, altoMm: 320 },
    };
    const r = await runNestingForPaso(paso, jobContext(), null);
    expect(r).not.toBeNull();
    expect(r!.imposicionCuadernillo).toBeUndefined();
  });
});

describe('Familia abrochado_caballete', () => {
  const familia = FAMILIAS.abrochado_caballete;

  it('existe, es de encuadernación y exige la imposición previa', () => {
    expect(familia.categoria).toBe('encuadernacion_armado');
    const v = familia.validaciones.find(
      (x) => x.codigo === 'existe_imposicion_cuadernillo',
    );
    expect(v?.tipo).toBe('EXISTS_OUTPUT');
    expect((v as { outputCanonico?: string }).outputCanonico).toBe(
      'hojas_por_libro',
    );
  });

  it('declara los broches por libro como param', () => {
    expect(familia.paramsPasoSchema.map((p) => p.campo)).toContain(
      'brochesPorLibro',
    );
  });
});
