import { calcularPrecio } from '../calculador-precio';

describe('calcularPrecio — Tab Precio en backend', () => {
  describe('por_margen', () => {
    it('costo $100 + margen 100% → precio $200', () => {
      const r = calcularPrecio(100, 10, {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 100 },
      });
      expect(r.precioUnitario).toBe(200);
      expect(r.precioTotal).toBe(2000);
      expect(r.margenAplicadoPct).toBe(100);
      expect(r.margenNegativo).toBe(false);
    });

    it('margen 0% → precio = costo', () => {
      const r = calcularPrecio(50, 1, {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 0 },
      });
      expect(r.precioUnitario).toBe(50);
    });

    it('margen negativo → margenNegativo=true', () => {
      const r = calcularPrecio(100, 1, {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: -10 },
      });
      expect(r.margenNegativo).toBe(true);
    });
  });

  describe('precio_fijo', () => {
    it('precio definido manualmente', () => {
      const r = calcularPrecio(80, 5, {
        metodoCalculo: 'precio_fijo',
        detalle: { price: 150 },
      });
      expect(r.precioUnitario).toBe(150);
      expect(r.precioTotal).toBe(750);
    });

    it('precio < costo → margenNegativo=true', () => {
      const r = calcularPrecio(200, 1, {
        metodoCalculo: 'precio_fijo',
        detalle: { price: 100 },
      });
      expect(r.margenNegativo).toBe(true);
    });
  });

  describe('precio_fijo_para_margen_minimo', () => {
    it('precio base supera margen mínimo → usa precio base', () => {
      const r = calcularPrecio(50, 1, {
        metodoCalculo: 'precio_fijo_para_margen_minimo',
        detalle: { price: 200, minimumMarginPct: 100 }, // mín = $100
      });
      expect(r.precioUnitario).toBe(200);
    });

    it('precio base NO alcanza margen mínimo → ajusta hacia arriba', () => {
      const r = calcularPrecio(100, 1, {
        metodoCalculo: 'precio_fijo_para_margen_minimo',
        detalle: { price: 110, minimumMarginPct: 50 }, // mín = $150
      });
      expect(r.precioUnitario).toBe(150);
      expect(r.mensaje).toContain('margen mínimo');
    });
  });

  describe('margen_variable (por tramos)', () => {
    it('cantidad 50 cae en primer tramo (≤100) con margen 80%', () => {
      const r = calcularPrecio(10, 50, {
        metodoCalculo: 'margen_variable',
        detalle: {
          tiers: [
            { quantityUntil: 100, marginPct: 80 },
            { quantityUntil: 1000, marginPct: 50 },
            { quantityUntil: 99999, marginPct: 30 },
          ],
        },
      });
      expect(r.margenAplicadoPct).toBe(80);
      expect(r.precioUnitario).toBe(18);
    });

    it('cantidad 5000 cae en último tramo con margen 30%', () => {
      const r = calcularPrecio(10, 5000, {
        metodoCalculo: 'margen_variable',
        detalle: {
          tiers: [
            { quantityUntil: 100, marginPct: 80 },
            { quantityUntil: 1000, marginPct: 50 },
            { quantityUntil: 99999, marginPct: 30 },
          ],
        },
      });
      expect(r.margenAplicadoPct).toBe(30);
      expect(r.precioUnitario).toBe(13);
    });
  });

  describe('fijado_por_cantidad', () => {
    it('cantidad exacta encontrada en tier', () => {
      const r = calcularPrecio(50, 100, {
        metodoCalculo: 'fijado_por_cantidad',
        detalle: {
          tiers: [
            { quantity: 100, price: 1500 },
            { quantity: 500, price: 6500 },
          ],
        },
      });
      expect(r.precioUnitario).toBe(1500);
    });

    it('cantidad sin tier → mensaje de error', () => {
      const r = calcularPrecio(50, 250, {
        metodoCalculo: 'fijado_por_cantidad',
        detalle: { tiers: [{ quantity: 100, price: 1500 }] },
      });
      expect(r.mensaje).toContain('250');
    });
  });

  describe('config null', () => {
    it('sin config → precio = costo', () => {
      const r = calcularPrecio(100, 10, null);
      expect(r.precioUnitario).toBe(100);
      expect(r.precioTotal).toBe(1000);
    });
  });
});
