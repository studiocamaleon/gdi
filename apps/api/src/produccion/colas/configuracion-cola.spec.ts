import { configurarFilaCola, normalizarColorCola, type FuenteConfiguracionCola } from './configuracion-cola';

const fuente = (): FuenteConfiguracionCola => ({ pasoId: 'p', impresionesEnContexto: 2, compartido: null,
  contexto: { modoColor: 'BN', modoColorPorPaso: { frente: 'CMYK+blanco', dorso: 'BN' } },
  original: { familiaCodigo: 'impresion_por_area', configPasoId: 'frente',
    material: { materialVarianteId: 'v', materialDisplayName: 'Vinilo blanco', precioUnitario: 987654 },
    nestingResult: { sustrato: { materialVarianteId: 'v', nombre: 'Vinilo blanco' },
      substrates: [{ kind: 'roll', widthMm: 1370, lengthMm: 1200 }] } },
});

it('obtiene el color del paso y el ancho del plan, sin tomar el modo global de otro componente', () => {
  const r = configurarFilaCola(fuente());
  expect(r).toMatchObject({ modoColor: 'CMYK + blanco', formatos: [{ tipo: 'roll', anchoMm: 1370 }], materialNombre: 'Vinilo blanco' });
  expect(JSON.stringify(r)).not.toContain('987654');
});

it('el layout compartido prevalece sobre ancho, color y material de la porción individual', () => {
  const f = fuente();
  f.compartido = { materialVarianteId: 'pvc', materialNombre: 'PVC 3 mm', nestingResult: {
    modoColor: 'CMYK', substrates: [{ kind: 'sheet', widthMm: 1220, heightMm: 2440, count: 2 }],
  } };
  expect(configurarFilaCola(f)).toMatchObject({ materialId: 'pvc', materialNombre: 'PVC 3 mm', modoColor: 'CMYK',
    formatos: [{ tipo: 'sheet', anchoMm: 1220, altoMm: 2440 }], formatoModificado: true,
    formatosCotizados: [{ tipo: 'roll', anchoMm: 1370 }], ejecucionCompartida: true, layoutConservado: true });
});

it('no ejecuta getters de geometría ni confunde formatos mixtos con un único ancho', () => {
  const f = fuente();
  const nesting = (f.original as { nestingResult: Record<string, unknown> }).nestingResult;
  Object.defineProperty(nesting, 'placements', { enumerable: true, get() { throw new Error('No cargar CAD'); } });
  nesting.substrates = [{ kind: 'roll', widthMm: 1370 }, { kind: 'roll', widthMm: 1050 }, { kind: 'roll', widthMm: 1370 }];
  expect(configurarFilaCola(f).formatos.map(s => s.anchoMm)).toEqual([1050, 1370]);
});

it('no inventa color ni dimensiones con snapshots incompletos o inválidos', () => {
  const f = fuente();
  f.original = { familiaCodigo: 'impresion_por_area', nestingResult: { substrates: [{ kind: 'roll', widthMm: null }, { kind: 'sheet', widthMm: -1 }] } };
  expect(configurarFilaCola(f)).toMatchObject({ modoColor: null, formatos: [] });
  f.impresionesEnContexto = 1;
  expect(configurarFilaCola(f).modoColor).toBe('BN');
});

it('preserva el registro del corte y distingue rollo de placa aunque coincida el ancho', () => {
  const f = fuente();
  f.original = { nestingResult: { layoutRegistradoLoteId: 'origen', substrates: [{ kind: 'sheet', widthMm: 1370, heightMm: 2000 }] } };
  expect(configurarFilaCola(f)).toMatchObject({ layoutConservado: true, formatos: [{ tipo: 'sheet', anchoMm: 1370, altoMm: 2000 }] });
});

it.each([['B/N', 'BN'], ['CMYK+W', 'CMYK + blanco'], ['CMYK+BLANCO+BARNIZ', 'CMYK + blanco + barniz'], ['Tinta especial', 'Tinta especial']])('normaliza %s sin eliminar configuraciones especiales', (entrada, esperado) => {
  expect(normalizarColorCola(entrada)).toBe(esperado);
});
