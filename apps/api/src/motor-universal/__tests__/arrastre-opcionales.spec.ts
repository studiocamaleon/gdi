import {
  type PasoParaArrastre,
  resolverArrastreOpcionales,
} from '../arrastre-opcionales';

/** Ruta de lona: refuerzo (1) → impresión (2) → ojales (3). */
function ruta(over: Partial<Record<string, Partial<PasoParaArrastre>>> = {}) {
  const base: Record<string, PasoParaArrastre> = {
    refuerzo: {
      rutaPasoId: 'rp-refuerzo',
      configPasoId: 'cfg-refuerzo',
      nombreVisible: 'Refuerzo perimetral',
      familiaCodigo: 'modificacion_pre',
      modoActivacion: 'OPCIONAL',
      requiereRutaPasoIds: [],
    },
    impresion: {
      rutaPasoId: 'rp-impresion',
      configPasoId: 'cfg-impresion',
      nombreVisible: 'Impresión',
      familiaCodigo: 'impresion_por_area',
      modoActivacion: 'OBLIGATORIO',
      requiereRutaPasoIds: [],
    },
    ojales: {
      rutaPasoId: 'rp-ojales',
      configPasoId: 'cfg-ojales',
      nombreVisible: 'Colocación de ojales',
      familiaCodigo: 'colocacion_ojales',
      modoActivacion: 'OPCIONAL',
      requiereRutaPasoIds: ['rp-refuerzo'],
    },
  };
  for (const [clave, cambios] of Object.entries(over)) {
    base[clave] = { ...base[clave], ...cambios } as PasoParaArrastre;
  }
  return Object.values(base);
}

describe('resolverArrastreOpcionales', () => {
  it('activar ojales enciende el refuerzo', () => {
    const r = resolverArrastreOpcionales(ruta(), { 'cfg-ojales': true });

    expect(r.opcionalesActivados['cfg-refuerzo']).toBe(true);
    expect(r.arrastres).toEqual([
      {
        configPasoId: 'cfg-refuerzo',
        rutaPasoId: 'rp-refuerzo',
        requeridoPorConfigPasoId: 'cfg-ojales',
        requeridoPorNombre: 'Colocación de ojales',
      },
    ]);
  });

  /** El caso que hacía inviable usar CONDICIONAL: refuerzo por su cuenta. */
  it('se puede pedir refuerzo SIN ojales', () => {
    const r = resolverArrastreOpcionales(ruta(), { 'cfg-refuerzo': true });

    expect(r.opcionalesActivados['cfg-refuerzo']).toBe(true);
    expect(r.opcionalesActivados['cfg-ojales']).toBeUndefined();
    expect(r.arrastres).toEqual([]);
  });

  it('sin nada activado no enciende nada', () => {
    const r = resolverArrastreOpcionales(ruta(), {});
    expect(r.arrastres).toEqual([]);
    expect(r.opcionalesActivados).toEqual({});
  });

  it('si el refuerzo ya estaba tildado no lo cuenta como arrastre', () => {
    const r = resolverArrastreOpcionales(ruta(), {
      'cfg-ojales': true,
      'cfg-refuerzo': true,
    });
    expect(r.opcionalesActivados['cfg-refuerzo']).toBe(true);
    expect(r.arrastres).toEqual([]);
  });

  it('un paso OBLIGATORIO también arrastra', () => {
    const r = resolverArrastreOpcionales(
      ruta({ impresion: { requiereRutaPasoIds: ['rp-refuerzo'] } }),
      {},
    );
    expect(r.opcionalesActivados['cfg-refuerzo']).toBe(true);
  });

  it('el arrastre es transitivo', () => {
    const pasos = ruta({
      refuerzo: { requiereRutaPasoIds: ['rp-impresion'] },
      impresion: { modoActivacion: 'OPCIONAL' },
    });
    const r = resolverArrastreOpcionales(pasos, { 'cfg-ojales': true });

    expect(r.opcionalesActivados['cfg-refuerzo']).toBe(true);
    expect(r.opcionalesActivados['cfg-impresion']).toBe(true);
  });

  it('un ciclo no cuelga', () => {
    const pasos = ruta({
      refuerzo: { requiereRutaPasoIds: ['rp-ojales'] },
    });
    const r = resolverArrastreOpcionales(pasos, { 'cfg-ojales': true });

    expect(r.opcionalesActivados['cfg-refuerzo']).toBe(true);
    expect(r.opcionalesActivados['cfg-ojales']).toBe(true);
  });

  /**
   * NO_EJECUTAR lo puso el modelador a propósito para esta ruta: encenderlo
   * por la ventana sería peor que avisar.
   */
  it('no fuerza un paso en NO EJECUTAR, lo reporta', () => {
    const pasos = ruta({ refuerzo: { modoActivacion: 'NO_EJECUTAR' } });
    const r = resolverArrastreOpcionales(pasos, { 'cfg-ojales': true });

    expect(r.opcionalesActivados['cfg-refuerzo']).toBeUndefined();
    expect(r.conflictos).toHaveLength(1);
    expect(r.conflictos[0].motivo).toContain('NO EJECUTAR');
    expect(r.conflictos[0].requeridoPorNombre).toBe('Colocación de ojales');
  });

  it('sin nombre visible, humaniza el código de familia', () => {
    const pasos = ruta({ ojales: { nombreVisible: null } });
    const r = resolverArrastreOpcionales(pasos, { 'cfg-ojales': true });
    expect(r.arrastres[0].requeridoPorNombre).toBe('Colocacion ojales');
  });

  it('reporta una dependencia que no está en la ruta', () => {
    const pasos = ruta({ ojales: { requiereRutaPasoIds: ['rp-fantasma'] } });
    const r = resolverArrastreOpcionales(pasos, { 'cfg-ojales': true });

    expect(r.conflictos).toHaveLength(1);
    expect(r.conflictos[0].motivo).toContain('no está en esta ruta');
  });

  it('no muta el objeto que recibe', () => {
    const original = { 'cfg-ojales': true };
    resolverArrastreOpcionales(ruta(), original);
    expect(original).toEqual({ 'cfg-ojales': true });
  });
});
