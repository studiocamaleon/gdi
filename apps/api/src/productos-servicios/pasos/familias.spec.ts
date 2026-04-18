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
});
