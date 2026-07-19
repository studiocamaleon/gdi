import {
  resolverCostoTercerizado,
  construirClaveMatch,
  resolverMagnitud,
} from '../tercerizado-costo';

/**
 * Costeo de pasos tercerizados — puro, sin DB. Refleja los casos reales que
 * validamos antes de implementar (docs/productos-tercerizados-diseno.md §8).
 */
describe('resolverCostoTercerizado', () => {
  describe('matriz (offset)', () => {
    const config = {
      ejes: [
        { clave: 'medida', orden: 1 },
        { clave: 'faz', orden: 2 },
        { clave: 'papel', orden: 3 },
        { clave: 'cantidad', orden: 4 },
      ],
    };
    const entradas = [
      { claveMatch: '10x15|4/0|ilus150|1000', cantidad: 1000, costo: 100 },
      { claveMatch: '10x15|4/0|ilus150|2000', cantidad: 2000, costo: 200 },
    ];

    it('encuentra la fila exacta y devuelve su costo', () => {
      const r = resolverCostoTercerizado({
        fuente: 'matriz',
        config,
        magnitudes: {},
        seleccionMatriz: { medida: '10x15', faz: '4/0', papel: 'ilus150', cantidad: '1000' },
        entradas,
      });
      expect(r).toEqual({
        ok: true,
        costo: 100,
        detalle: { fuente: 'matriz', entradaClave: '10x15|4/0|ilus150|1000' },
      });
    });

    it('rechaza una cantidad fuera de la lista (caso 6: sólo listadas)', () => {
      const r = resolverCostoTercerizado({
        fuente: 'matriz',
        config,
        magnitudes: {},
        seleccionMatriz: { medida: '10x15', faz: '4/0', papel: 'ilus150', cantidad: '1500' },
        entradas,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/no está en la lista/);
    });

    it('rechaza si falta un valor de eje', () => {
      const r = resolverCostoTercerizado({
        fuente: 'matriz',
        config,
        magnitudes: {},
        seleccionMatriz: { medida: '10x15', faz: '4/0', cantidad: '1000' },
        entradas,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/Faltan valores/);
    });

    it('construye la clave en orden de eje sin importar el orden de selección', () => {
      const clave = construirClaveMatch(config.ejes, {
        cantidad: '1000',
        papel: 'ilus150',
        medida: '10x15',
        faz: '4/0',
      });
      expect(clave).toBe('10x15|4/0|ilus150|1000');
    });
  });

  describe('tarifa_magnitud', () => {
    it('área m² (UV): tarifa × área', () => {
      const r = resolverCostoTercerizado({
        fuente: 'tarifa_magnitud',
        config: { magnitud: 'area_m2', tarifa: 8000 },
        magnitudes: { area_m2: 0.96 },
        seleccionMatriz: {},
        entradas: [],
      });
      expect(r).toMatchObject({ ok: true, costo: 7680 });
    });

    it('perímetro (confección, caso 7): tarifa × perímetro_ml', () => {
      const r = resolverCostoTercerizado({
        fuente: 'tarifa_magnitud',
        config: { magnitud: 'perimetro_ml', tarifa: 500 },
        magnitudes: { perimetro_ml: 6 },
        seleccionMatriz: {},
        entradas: [],
      });
      expect(r).toMatchObject({ ok: true, costo: 3000 });
    });

    it('minimoCosto (caso 12): piso del costo por pedido', () => {
      const r = resolverCostoTercerizado({
        fuente: 'tarifa_magnitud',
        config: { magnitud: 'area_m2', tarifa: 8000, minimoCosto: 20000 },
        magnitudes: { area_m2: 1.5 }, // 12.000 < 20.000
        seleccionMatriz: {},
        entradas: [],
      });
      expect(r).toMatchObject({ ok: true, costo: 20000 });
    });

    it('minimoMagnitud: piso de la magnitud (mínimo 1 m²)', () => {
      const r = resolverCostoTercerizado({
        fuente: 'tarifa_magnitud',
        config: { magnitud: 'area_m2', tarifa: 8000, minimoMagnitud: 1 },
        magnitudes: { area_m2: 0.3 }, // sube a 1 m²
        seleccionMatriz: {},
        entradas: [],
      });
      expect(r).toMatchObject({ ok: true, costo: 8000 });
    });

    it('metros lineales (ml)', () => {
      const r = resolverCostoTercerizado({
        fuente: 'tarifa_magnitud',
        config: { magnitud: 'ml', tarifa: 300 },
        magnitudes: { ml: 12 },
        seleccionMatriz: {},
        entradas: [],
      });
      expect(r).toMatchObject({ ok: true, costo: 3600 });
    });

    it('falla si no se puede resolver la magnitud', () => {
      const r = resolverCostoTercerizado({
        fuente: 'tarifa_magnitud',
        config: { magnitud: 'area_m2', tarifa: 8000 },
        magnitudes: { area_m2: null },
        seleccionMatriz: {},
        entradas: [],
      });
      expect(r.ok).toBe(false);
    });
  });

  describe('fijo', () => {
    it('por trabajo (troquel, caso 5): costo fijo, no escala con cantidad', () => {
      const r = resolverCostoTercerizado({
        fuente: 'fijo',
        config: { costo: 15000, por: 'trabajo' },
        magnitudes: { cantidad: 5000 },
        seleccionMatriz: {},
        entradas: [],
      });
      expect(r).toMatchObject({ ok: true, costo: 15000 });
    });

    it('por unidad: costo × cantidad', () => {
      const r = resolverCostoTercerizado({
        fuente: 'fijo',
        config: { costo: 1200, por: 'unidad' },
        magnitudes: { cantidad: 50 },
        seleccionMatriz: {},
        entradas: [],
      });
      expect(r).toMatchObject({ ok: true, costo: 60000 });
    });
  });

  it('rechaza una fuente no soportada', () => {
    const r = resolverCostoTercerizado({
      fuente: 'inventada',
      config: {},
      magnitudes: {},
      seleccionMatriz: {},
      entradas: [],
    });
    expect(r.ok).toBe(false);
  });

  it('resolverMagnitud: cantidad se sanea a mínimo 1', () => {
    expect(resolverMagnitud('cantidad', { cantidad: 0 })).toBe(1);
    expect(resolverMagnitud('cantidad', { cantidad: 50 })).toBe(50);
    expect(resolverMagnitud('inexistente', {})).toBeNull();
  });
});
