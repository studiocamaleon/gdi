/**
 * Tests del ruta-validator (C.2.7).
 */
import { validateRuta, type PasoRutaParaValidar } from './ruta-validator';
import { FAMILIAS_PASO } from '../pasos/familias';

describe('validateRuta — validación al upsert del producto', () => {
  describe('R1 — familia existe', () => {
    it('familia válida: no error', () => {
      const result = validateRuta(
        [{ id: 'p1', orden: 1, familiaCodigo: 'impresion_por_area' }],
        FAMILIAS_PASO,
      );
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('familia desconocida: error R1', () => {
      const result = validateRuta(
        [{ id: 'p1', orden: 1, familiaCodigo: 'no_existe_esta_familia' }],
        FAMILIAS_PASO,
      );
      expect(result.ok).toBe(false);
      expect(result.errors[0].codigo).toBe('R1_familia_desconocida');
    });
  });

  describe('R3 — consume sin produce previo', () => {
    it('consume primero en la ruta: error R3', () => {
      const result = validateRuta(
        [{ id: 'p1-corte', orden: 1, familiaCodigo: 'corte' }],
        FAMILIAS_PASO,
      );
      expect(result.ok).toBe(false);
      expect(result.errors[0].codigo).toBe('R3_consume_sin_produce');
    });

    it('produce → consume: OK', () => {
      const result = validateRuta(
        [
          { id: 'p1-impresion', orden: 1, familiaCodigo: 'impresion_por_area' },
          { id: 'p2-corte', orden: 2, familiaCodigo: 'corte' },
        ],
        FAMILIAS_PASO,
      );
      expect(result.ok).toBe(true);
    });

    it('múltiples consume después de un produce: todos OK', () => {
      const result = validateRuta(
        [
          { id: 'p1', orden: 1, familiaCodigo: 'impresion_por_area' },
          { id: 'p2', orden: 2, familiaCodigo: 'corte' },
          { id: 'p3', orden: 3, familiaCodigo: 'laminado' },
          { id: 'p4', orden: 4, familiaCodigo: 'acabado_decorativo' },
        ],
        FAMILIAS_PASO,
      );
      expect(result.ok).toBe(true);
    });

    it('ruta de 2 grupos produce→consume: OK', () => {
      const result = validateRuta(
        [
          { id: 'p1-uv', orden: 1, familiaCodigo: 'impresion_por_pieza' },
          { id: 'p2-cnc', orden: 2, familiaCodigo: 'corte_volumetrico' },
          { id: 'p3-latex', orden: 3, familiaCodigo: 'impresion_por_area' },
          { id: 'p4-plotter', orden: 4, familiaCodigo: 'corte' },
        ],
        FAMILIAS_PASO,
      );
      expect(result.ok).toBe(true);
    });

    it('orden de pasos desorganizado: valida por campo orden, no posición del array', () => {
      const result = validateRuta(
        [
          { id: 'p2-corte', orden: 2, familiaCodigo: 'corte' },
          { id: 'p1-impresion', orden: 1, familiaCodigo: 'impresion_por_area' },
        ],
        FAMILIAS_PASO,
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('R4 — coherencia de capacidades (warning, no error)', () => {
    it('máquina consume menor que máquina produce: warning', () => {
      const result = validateRuta(
        [
          {
            id: 'p1',
            orden: 1,
            familiaCodigo: 'impresion_por_pieza',
            maquinaPrintableWidthMm: 2000,
          },
          {
            id: 'p2',
            orden: 2,
            familiaCodigo: 'corte_volumetrico',
            maquinaPrintableWidthMm: 900, // mucho más chico
          },
        ],
        FAMILIAS_PASO,
      );
      expect(result.ok).toBe(true); // es warning, no error
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toMatch(/900mm.*2000mm/);
    });

    it('máquinas coherentes: sin warning', () => {
      const result = validateRuta(
        [
          {
            id: 'p1',
            orden: 1,
            familiaCodigo: 'impresion_por_pieza',
            maquinaPrintableWidthMm: 900,
          },
          {
            id: 'p2',
            orden: 2,
            familiaCodigo: 'corte_volumetrico',
            maquinaPrintableWidthMm: 1000,
          },
        ],
        FAMILIAS_PASO,
      );
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('R5 — config de nesting válida', () => {
    it('separaciones negativas: error', () => {
      const result = validateRuta(
        [
          {
            id: 'p1',
            orden: 1,
            familiaCodigo: 'impresion_por_area',
            configNesting: { separacionHorizontalMm: -5 },
          },
        ],
        FAMILIAS_PASO,
      );
      expect(result.ok).toBe(false);
      expect(result.errors[0].codigo).toBe('R5_config_invalida');
      expect(result.errors[0].mensaje).toMatch(/separacionHorizontalMm/);
    });

    it('panelizado activo sin maxPanelWidthMm: error', () => {
      const result = validateRuta(
        [
          {
            id: 'p1',
            orden: 1,
            familiaCodigo: 'impresion_por_area',
            configNesting: {
              panelizado: { activo: true, axis: 'vertical' },
            },
          },
        ],
        FAMILIAS_PASO,
      );
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.mensaje.includes('maxPanelWidthMm'))).toBe(true);
    });

    it('criterio inválido para nesting-hoja: error', () => {
      const result = validateRuta(
        [
          {
            id: 'p1',
            orden: 1,
            familiaCodigo: 'impresion_por_hoja',
            configNesting: { criterio: 'criterio_inventado' },
          },
        ],
        FAMILIAS_PASO,
      );
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.mensaje.match(/Criterio inválido/))).toBe(true);
    });

    it('config válida: OK', () => {
      const result = validateRuta(
        [
          {
            id: 'p1',
            orden: 1,
            familiaCodigo: 'impresion_por_hoja',
            configNesting: {
              criterio: 'menor_cantidad_pliegos',
              separacionHMm: 3,
              margenMm: 5,
            },
          },
        ],
        FAMILIAS_PASO,
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('Múltiples errores simultáneos', () => {
    it('recolecta todos los errores sin cortar en el primero', () => {
      const result = validateRuta(
        [
          { id: 'p1', orden: 1, familiaCodigo: 'inexistente' }, // R1
          { id: 'p2', orden: 2, familiaCodigo: 'corte' }, // R3 (no hay produce)
        ],
        FAMILIAS_PASO,
      );
      expect(result.ok).toBe(false);
      expect(result.errors).toHaveLength(2);
      const codigos = result.errors.map((e) => e.codigo);
      expect(codigos).toContain('R1_familia_desconocida');
      expect(codigos).toContain('R3_consume_sin_produce');
    });
  });
});
