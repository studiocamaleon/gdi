/**
 * Tests del nesting-runner (C.2.6).
 *
 * Valida la lógica produce→consume del modelo universal sobre el catálogo
 * real de familias.
 */
import { runNestingPipeline, getLayoutHeredado, type PasoRuntime } from './nesting-runner';
import { FAMILIAS_PASO } from '../pasos/familias';

const TRABAJO_VINILO = {
  medidas: [{ anchoMm: 1000, altoMm: 500, cantidad: 1 }],
};

const MATERIAL_ROLLO = {
  maquinaPrintableWidthMm: 1360, // vinilo adhesivo 1.37m - 10mm márgenes
  maquinaMarginLeftMm: 5,
  maquinaMarginStartMm: 0,
  maquinaMarginEndMm: 0,
};

const MATERIAL_PLACA = {
  placaAnchoMm: 1220,  // MDF 1.22m
  placaAltoMm: 2440,
};

describe('runNestingPipeline — produce / consume / none', () => {
  it('paso produce (impresion_por_area) ejecuta nesting-rollo', () => {
    const pasos: PasoRuntime[] = [
      { id: 'p1', familiaCodigo: 'impresion_por_area', configNesting: null },
    ];
    const output = runNestingPipeline({
      pasos,
      familiasMap: FAMILIAS_PASO,
      trabajo: TRABAJO_VINILO,
      materialMaquina: MATERIAL_ROLLO,
    });

    expect(output.layoutsPorPasoId.size).toBe(1);
    const layout = output.layoutsPorPasoId.get('p1');
    expect(layout).toBeDefined();
    expect(layout!.algoritmo).toBe('nesting-rollo');
  });

  it('paso produce (impresion_por_pieza) ejecuta nesting-placa-rigida', () => {
    const pasos: PasoRuntime[] = [
      { id: 'p1', familiaCodigo: 'impresion_por_pieza', configNesting: null },
    ];
    const output = runNestingPipeline({
      pasos,
      familiasMap: FAMILIAS_PASO,
      trabajo: { medidas: [{ anchoMm: 400, altoMm: 300, cantidad: 2 }] },
      materialMaquina: MATERIAL_PLACA,
    });

    const layout = output.layoutsPorPasoId.get('p1');
    expect(layout?.algoritmo).toBe('nesting-placa-rigida');
  });

  it('paso produce (impresion_por_hoja) ejecuta nesting-hoja', () => {
    const pasos: PasoRuntime[] = [
      { id: 'p1', familiaCodigo: 'impresion_por_hoja', configNesting: null },
    ];
    const output = runNestingPipeline({
      pasos,
      familiasMap: FAMILIAS_PASO,
      trabajo: { medidas: [{ anchoMm: 90, altoMm: 50, cantidad: 500 }] },
    });

    const layout = output.layoutsPorPasoId.get('p1');
    expect(layout?.algoritmo).toBe('nesting-hoja');
  });

  it('ruta produce → consume: el consume hereda el layout del produce', () => {
    const pasos: PasoRuntime[] = [
      { id: 'p1-impresion', familiaCodigo: 'impresion_por_area', configNesting: null },
      { id: 'p2-corte', familiaCodigo: 'corte', configNesting: null },
      { id: 'p3-laminado', familiaCodigo: 'laminado', configNesting: null },
    ];
    const output = runNestingPipeline({
      pasos,
      familiasMap: FAMILIAS_PASO,
      trabajo: TRABAJO_VINILO,
      materialMaquina: MATERIAL_ROLLO,
    });

    // Solo p1 tiene layout propio
    expect(output.layoutsPorPasoId.size).toBe(1);
    expect(output.layoutsPorPasoId.has('p1-impresion')).toBe(true);

    // p2 y p3 heredan del p1
    expect(output.consumeMap.get('p2-corte')).toBe('p1-impresion');
    expect(output.consumeMap.get('p3-laminado')).toBe('p1-impresion');

    // getLayoutHeredado devuelve el layout del paso produce
    const heredado = getLayoutHeredado(output, 'p2-corte');
    expect(heredado).toBeDefined();
    expect(heredado?.algoritmo).toBe('nesting-rollo');
  });

  it('pasos con modoNesting=none se ignoran (no aparecen en layouts ni consumeMap)', () => {
    const pasos: PasoRuntime[] = [
      { id: 'p1-preprensa', familiaCodigo: 'pre_prensa', configNesting: null },
      { id: 'p2-impresion', familiaCodigo: 'impresion_por_area', configNesting: null },
      { id: 'p3-embalaje', familiaCodigo: 'operacion_manual', configNesting: null },
    ];
    const output = runNestingPipeline({
      pasos,
      familiasMap: FAMILIAS_PASO,
      trabajo: TRABAJO_VINILO,
      materialMaquina: MATERIAL_ROLLO,
    });

    // Solo p2 (impresion) tiene layout
    expect(output.layoutsPorPasoId.size).toBe(1);
    expect(output.layoutsPorPasoId.has('p2-impresion')).toBe(true);

    // Ni p1 (pre_prensa) ni p3 (operacion_manual) están en consumeMap
    expect(output.consumeMap.has('p1-preprensa')).toBe(false);
    expect(output.consumeMap.has('p3-embalaje')).toBe(false);
  });

  it('ruta con 2 produce → cada consume apunta al último produce anterior', () => {
    // Caso del análisis: rígido impreso en UV + corte láser + vinilo impreso + corte plotter
    const pasos: PasoRuntime[] = [
      { id: 'p1-impresion-uv', familiaCodigo: 'impresion_por_pieza', configNesting: null },
      { id: 'p2-corte-cnc', familiaCodigo: 'corte_volumetrico', configNesting: null },
      { id: 'p3-impresion-latex', familiaCodigo: 'impresion_por_area', configNesting: null },
      { id: 'p4-corte-plotter', familiaCodigo: 'corte', configNesting: null },
    ];
    const output = runNestingPipeline({
      pasos,
      familiasMap: FAMILIAS_PASO,
      trabajo: { medidas: [{ anchoMm: 400, altoMm: 300, cantidad: 1 }] },
      materialMaquina: { ...MATERIAL_ROLLO, ...MATERIAL_PLACA },
    });

    // 2 layouts produce
    expect(output.layoutsPorPasoId.size).toBe(2);

    // p2 consume del p1 (último produce antes)
    expect(output.consumeMap.get('p2-corte-cnc')).toBe('p1-impresion-uv');

    // p4 consume del p3 (último produce antes — cambió de sustrato en p3)
    expect(output.consumeMap.get('p4-corte-plotter')).toBe('p3-impresion-latex');
  });

  it('consume sin produce previo cae a consumersSinProduce', () => {
    const pasos: PasoRuntime[] = [
      { id: 'p1-corte-huerfano', familiaCodigo: 'corte', configNesting: null },
    ];
    const output = runNestingPipeline({
      pasos,
      familiasMap: FAMILIAS_PASO,
      trabajo: TRABAJO_VINILO,
    });

    expect(output.consumersSinProduce).toContain('p1-corte-huerfano');
    expect(output.consumeMap.has('p1-corte-huerfano')).toBe(false);
  });

  it('familia desconocida lanza error', () => {
    const pasos: PasoRuntime[] = [
      { id: 'p1', familiaCodigo: 'familia_inexistente', configNesting: null },
    ];
    expect(() =>
      runNestingPipeline({
        pasos,
        familiasMap: FAMILIAS_PASO,
        trabajo: TRABAJO_VINILO,
      }),
    ).toThrow(/familia desconocida/);
  });

  it('configNesting del paso override defaults (para nesting-rollo)', () => {
    const pasos: PasoRuntime[] = [
      {
        id: 'p1',
        familiaCodigo: 'impresion_por_area',
        configNesting: {
          separacionHorizontalMm: 20,
          separacionVerticalMm: 20,
          permitirRotacion: false,
        },
      },
    ];
    const output = runNestingPipeline({
      pasos,
      familiasMap: FAMILIAS_PASO,
      trabajo: TRABAJO_VINILO,
      materialMaquina: MATERIAL_ROLLO,
    });

    const layout = output.layoutsPorPasoId.get('p1');
    expect(layout?.algoritmo).toBe('nesting-rollo');
    // El nesting se ejecutó sin rotación — layout aún válido porque 1000 < 1360
  });

  it('produce que no genera layout (pieza no encaja) deja el paso sin entry', () => {
    const pasos: PasoRuntime[] = [
      { id: 'p1', familiaCodigo: 'impresion_por_area', configNesting: null },
    ];
    const output = runNestingPipeline({
      pasos,
      familiasMap: FAMILIAS_PASO,
      trabajo: {
        medidas: [{ anchoMm: 3000, altoMm: 3000, cantidad: 1 }], // no entra en ancho útil
      },
      materialMaquina: MATERIAL_ROLLO,
    });

    // Sin layout producido
    expect(output.layoutsPorPasoId.has('p1')).toBe(false);
  });
});
