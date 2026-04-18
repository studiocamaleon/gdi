/**
 * Smoke tests del catálogo de familias de paso (A.2).
 *
 * Garantizan integridad del metadata antes de que los motores v2 lo consuman.
 */
import { FAMILIAS_PASO, FAMILIAS_CODIGOS, getFamilia, getFamiliasPorCategoria } from './familias';
import { OUTPUTS_CANONICOS, isOutputCanonico } from './outputs-canonicos';

describe('Catálogo de familias de paso (A.2)', () => {
  it('incluye las 23 familias del modelo universal', () => {
    expect(FAMILIAS_CODIGOS).toHaveLength(23);
  });

  it('cada código de familia coincide con la key del record', () => {
    for (const [key, familia] of Object.entries(FAMILIAS_PASO)) {
      expect(familia.codigo).toBe(key);
    }
  });

  it('todos los outputsCanonicos declarados por las familias existen en el catálogo', () => {
    for (const familia of Object.values(FAMILIAS_PASO)) {
      for (const output of familia.outputsCanonicos) {
        expect(isOutputCanonico(output)).toBe(true);
      }
    }
  });

  it('cada familia tiene nombre, descripción y al menos un ejemplo', () => {
    for (const familia of Object.values(FAMILIAS_PASO)) {
      expect(familia.nombre.length).toBeGreaterThan(0);
      expect(familia.descripcion.length).toBeGreaterThan(0);
      expect(familia.ejemplos.length).toBeGreaterThan(0);
    }
  });

  it('agrupación por categoría cubre las 23 familias', () => {
    const categorias: Array<Parameters<typeof getFamiliasPorCategoria>[0]> = [
      'produccion',
      'corte_y_formado',
      'terminaciones',
      'estructural',
      'servicios',
      'operaciones_manuales',
    ];
    const total = categorias.reduce((acc, c) => acc + getFamiliasPorCategoria(c).length, 0);
    expect(total).toBe(23);
  });

  it('outputs canónicos no tienen duplicados en valores', () => {
    const valores = Object.values(OUTPUTS_CANONICOS);
    const unicos = new Set(valores);
    expect(unicos.size).toBe(valores.length);
  });

  it('outputs canónicos tienen clave === valor (convención estable)', () => {
    for (const [key, value] of Object.entries(OUTPUTS_CANONICOS)) {
      expect(value).toBe(key);
    }
  });

  it('getFamilia retorna undefined para código inexistente', () => {
    expect(getFamilia('no_existe_esta_familia')).toBeUndefined();
  });

  it('getFamilia retorna la familia correcta para código válido', () => {
    const f = getFamilia('impresion_por_hoja');
    expect(f).toBeDefined();
    expect(f?.nombre).toMatch(/Impresión por hoja/);
  });

  // ─── Tests de modoNesting + nestingAlgoritmo (C.2.5) ────────────

  it('toda familia tiene modoNesting definido', () => {
    for (const familia of Object.values(FAMILIAS_PASO)) {
      expect(['produce', 'consume', 'none']).toContain(familia.modoNesting);
    }
  });

  it('familias con modoNesting=produce tienen nestingAlgoritmo válido', () => {
    const algoritmosValidos = ['nesting-hoja', 'nesting-rollo', 'nesting-placa-rigida'];
    for (const familia of Object.values(FAMILIAS_PASO)) {
      if (familia.modoNesting === 'produce') {
        expect(familia.nestingAlgoritmo).not.toBeNull();
        expect(algoritmosValidos).toContain(familia.nestingAlgoritmo);
      }
    }
  });

  it('familias con modoNesting=consume o none tienen nestingAlgoritmo null', () => {
    for (const familia of Object.values(FAMILIAS_PASO)) {
      if (familia.modoNesting === 'consume' || familia.modoNesting === 'none') {
        expect(familia.nestingAlgoritmo).toBeNull();
      }
    }
  });

  it('asignaciones correctas de algoritmo por familia de impresión', () => {
    expect(FAMILIAS_PASO.impresion_por_hoja.nestingAlgoritmo).toBe('nesting-hoja');
    expect(FAMILIAS_PASO.impresion_por_area.nestingAlgoritmo).toBe('nesting-rollo');
    expect(FAMILIAS_PASO.impresion_por_pieza.nestingAlgoritmo).toBe('nesting-placa-rigida');
  });

  it('familias que consumen layout del paso previo', () => {
    const consumidoras = Object.values(FAMILIAS_PASO).filter((f) => f.modoNesting === 'consume');
    // Al menos corte, corte_volumetrico, grabado, troquelado, laminado, acabado_decorativo
    const codigos = consumidoras.map((f) => f.codigo);
    expect(codigos).toContain('corte');
    expect(codigos).toContain('corte_volumetrico');
    expect(codigos).toContain('grabado');
    expect(codigos).toContain('troquelado');
    expect(codigos).toContain('laminado');
    expect(codigos).toContain('acabado_decorativo');
  });
});
