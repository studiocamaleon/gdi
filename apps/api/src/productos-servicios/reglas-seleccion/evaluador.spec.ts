/**
 * A.5 — Tests del evaluador de expresiones JsonLogic.
 *
 * Cubre los 10 casos mínimos que el plan A.5 requiere + la función resolverRegla
 * que es la forma en que el motor de reglas va a consumir el evaluador.
 */
import { evaluarCondicion, evaluarBool, resolverRegla } from './evaluador';

describe('Evaluador JsonLogic (A.5)', () => {
  describe('operadores básicos', () => {
    it('comparación numérica: >=', () => {
      expect(evaluarCondicion({ '>=': [{ var: 'cantidad' }, 500] }, { cantidad: 500 })).toBe(true);
      expect(evaluarCondicion({ '>=': [{ var: 'cantidad' }, 500] }, { cantidad: 499 })).toBe(false);
    });

    it('comparación numérica: <=', () => {
      expect(evaluarCondicion({ '<=': [{ var: 'paginas' }, 60] }, { paginas: 45 })).toBe(true);
      expect(evaluarCondicion({ '<=': [{ var: 'paginas' }, 60] }, { paginas: 61 })).toBe(false);
    });

    it('igualdad y desigualdad', () => {
      expect(evaluarCondicion({ '==': [{ var: 'caras' }, 'doble_faz'] }, { caras: 'doble_faz' })).toBe(true);
      expect(evaluarCondicion({ '!=': [{ var: 'caras' }, 'simple_faz'] }, { caras: 'doble_faz' })).toBe(true);
    });

    it('lógico AND/OR', () => {
      const and = { and: [{ '>': [{ var: 'cantidad' }, 100] }, { '<=': [{ var: 'cantidad' }, 500] }] };
      expect(evaluarBool(and, { cantidad: 250 })).toBe(true);
      expect(evaluarBool(and, { cantidad: 501 })).toBe(false);

      const or = { or: [{ '==': [{ var: 'tipoCopia' }, 'duplicado'] }, { '==': [{ var: 'tipoCopia' }, 'triplicado'] }] };
      expect(evaluarBool(or, { tipoCopia: 'triplicado' })).toBe(true);
      expect(evaluarBool(or, { tipoCopia: 'copia_simple' })).toBe(false);
    });

    it('lookup anidado con var', () => {
      const ctx = { componente: { letras: { cantidad: 10, material: 'PVC' } } };
      expect(evaluarCondicion({ var: 'componente.letras.cantidad' }, ctx)).toBe(10);
      expect(evaluarCondicion({ var: 'componente.letras.material' }, ctx)).toBe('PVC');
    });

    it('negación (!)', () => {
      expect(evaluarBool({ '!': [{ var: 'laminado' }] }, { laminado: false })).toBe(true);
      expect(evaluarBool({ '!': [{ var: 'laminado' }] }, { laminado: true })).toBe(false);
    });

    it('operador in', () => {
      const ctx = { tipo: 'offset' };
      expect(evaluarBool({ in: [{ var: 'tipo' }, ['laser', 'offset', 'digital']] }, ctx)).toBe(true);
      expect(evaluarBool({ in: [{ var: 'tipo' }, ['flexografia', 'serigrafia']] }, ctx)).toBe(false);
    });

    it('if ternario', () => {
      const expr = { if: [{ '>': [{ var: 'cantidad' }, 500] }, 'offset', 'digital'] };
      expect(evaluarCondicion(expr, { cantidad: 100 })).toBe('digital');
      expect(evaluarCondicion(expr, { cantidad: 1000 })).toBe('offset');
    });

    it('aritmético simple', () => {
      // hojas = ceil(cantidad / piezasPorPliego) — sin ceil usamos +/*
      expect(evaluarCondicion({ '*': [{ var: 'colores' }, { var: 'caras' }] }, { colores: 4, caras: 2 })).toBe(8);
    });

    it('evaluarBool casteo de truthy', () => {
      expect(evaluarBool({ var: 'algo' }, { algo: 1 })).toBe(true);
      expect(evaluarBool({ var: 'algo' }, { algo: 0 })).toBe(false);
      expect(evaluarBool({ var: 'algo' }, { algo: 'texto' })).toBe(true);
      expect(evaluarBool({ var: 'algo' }, { algo: '' })).toBe(false);
    });
  });

  describe('resolverRegla (uso real por el motor de reglas)', () => {
    it('aplica el primer caso que matchea (anillado por páginas)', () => {
      const casos = [
        { condicion: { '<=': [{ var: 'paginas' }, 30] }, decision: { espiral: '6mm' } },
        { condicion: { '<=': [{ var: 'paginas' }, 60] }, decision: { espiral: '10mm' } },
        { condicion: { '<=': [{ var: 'paginas' }, 120] }, decision: { espiral: '16mm' } },
      ];
      expect(resolverRegla(casos, { rechazar: true }, { paginas: 25 })).toEqual({ espiral: '6mm' });
      expect(resolverRegla(casos, { rechazar: true }, { paginas: 50 })).toEqual({ espiral: '10mm' });
      expect(resolverRegla(casos, { rechazar: true }, { paginas: 100 })).toEqual({ espiral: '16mm' });
    });

    it('cae al default si ningún caso matchea', () => {
      const casos = [
        { condicion: { '<=': [{ var: 'paginas' }, 120] }, decision: { espiral: '16mm' } },
      ];
      expect(resolverRegla(casos, { rechazar: true }, { paginas: 200 })).toEqual({ rechazar: true });
    });

    it('retorna undefined si no matchea ni hay default', () => {
      const casos = [
        { condicion: { '<=': [{ var: 'x' }, 10] }, decision: 'ok' },
      ];
      expect(resolverRegla(casos, undefined, { x: 100 })).toBeUndefined();
    });

    it('gana el primer caso aunque otro posterior también matchee (orden importa)', () => {
      const casos = [
        { condicion: { '>=': [{ var: 'cantidad' }, 100] }, decision: 'caso A' },
        { condicion: { '>=': [{ var: 'cantidad' }, 50] }, decision: 'caso B' }, // también matchearía
      ];
      expect(resolverRegla(casos, null, { cantidad: 200 })).toBe('caso A');
    });
  });
});
