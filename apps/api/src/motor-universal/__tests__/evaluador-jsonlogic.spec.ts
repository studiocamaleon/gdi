import { evaluarRegla, evaluarReglaBoolean } from '../evaluador-jsonlogic';

describe('evaluarRegla — JsonLogic wrapper', () => {
  describe('reglas vacías o nulas', () => {
    it('regla null → resultado true (sin restricciones)', () => {
      const r = evaluarRegla(null, { tipoCopia: 2 });
      expect(r.resultado).toBe(true);
    });

    it('regla undefined → resultado true', () => {
      const r = evaluarRegla(undefined, { tipoCopia: 2 });
      expect(r.resultado).toBe(true);
    });

    it('regla objeto vacío {} → resultado true', () => {
      const r = evaluarRegla({}, { tipoCopia: 2 });
      expect(r.resultado).toBe(true);
    });
  });

  describe('reglas básicas de comparación', () => {
    it('">=": [{var: tipoCopia}, 2] con tipoCopia=2 → true', () => {
      const r = evaluarRegla(
        { '>=': [{ var: 'tipoCopia' }, 2] },
        { tipoCopia: 2 },
      );
      expect(r.resultado).toBe(true);
    });

    it('">=": [{var: tipoCopia}, 3] con tipoCopia=2 → false', () => {
      const r = evaluarRegla(
        { '>=': [{ var: 'tipoCopia' }, 3] },
        { tipoCopia: 2 },
      );
      expect(r.resultado).toBe(false);
    });

    it('"==": comparación de igualdad', () => {
      const r = evaluarRegla(
        { '==': [{ var: 'tecnologia' }, 'latex'] },
        { tecnologia: 'latex' },
      );
      expect(r.resultado).toBe(true);
    });

    it('"in": chequear pertenencia a lista', () => {
      const r = evaluarRegla(
        { in: ['barniz', { var: 'tintasAdicionales' }] },
        { tintasAdicionales: ['barniz', 'blanco'] },
      );
      expect(r.resultado).toBe(true);
    });

    it('"and" con múltiples condiciones', () => {
      const r = evaluarRegla(
        {
          and: [
            { '>=': [{ var: 'cantidad' }, 100] },
            { '==': [{ var: 'caras' }, 2] },
          ],
        },
        { cantidad: 200, caras: 2 },
      );
      expect(r.resultado).toBe(true);
    });
  });

  describe('contexto faltante', () => {
    it('var de campo inexistente devuelve null → false en >=', () => {
      const r = evaluarRegla(
        { '>=': [{ var: 'campo_que_no_existe' }, 1] },
        { otro: 5 },
      );
      expect(r.resultado).toBe(false);
    });
  });

  describe('detalles del resultado', () => {
    it('devuelve detalle con valor crudo cuando aplica', () => {
      const r = evaluarRegla(
        { '>': [{ var: 'cantidad' }, 50] },
        { cantidad: 100 },
      );
      expect(r.detalle).toBeDefined();
      expect(r.detalle!.valorCrudo).toBe(true);
    });
  });

  describe('evaluarReglaBoolean — wrapper simple', () => {
    it('devuelve true para regla que se cumple', () => {
      expect(evaluarReglaBoolean({ '>': [{ var: 'x' }, 0] }, { x: 5 })).toBe(
        true,
      );
    });
    it('devuelve false para regla que no se cumple', () => {
      expect(evaluarReglaBoolean({ '>': [{ var: 'x' }, 0] }, { x: -1 })).toBe(
        false,
      );
    });
    it('devuelve true para regla null', () => {
      expect(evaluarReglaBoolean(null, {})).toBe(true);
    });
  });
});
