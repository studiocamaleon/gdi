/**
 * Bloques de tiempo extra del paso (preparación, traslado): la lectura de la
 * config es la puerta del motor, así que tiene que ser estricta con lo que
 * cuenta y tolerante con la basura — un bloque roto se ignora, no rompe la
 * cotización. Ver docs/cargos-por-paso-analisis-y-plan.md §7.
 */
import { centrosDeTiemposExtra, leerTiemposExtra } from '../tiempo-extra';

describe('leerTiemposExtra', () => {
  it('devuelve vacío cuando el paso no declara nada', () => {
    expect(leerTiemposExtra(null)).toEqual([]);
    expect(leerTiemposExtra({})).toEqual([]);
    expect(leerTiemposExtra({ tiemposExtra: 'no-es-lista' })).toEqual([]);
  });

  it('lee un bloque completo tal cual', () => {
    expect(
      leerTiemposExtra({
        tiemposExtra: [
          {
            id: 'traslado',
            etiqueta: 'Traslado ida y vuelta',
            minutos: 90,
            centroCostoId: 'cc-instalacion',
            dotacion: 2,
          },
        ],
      }),
    ).toEqual([
      {
        id: 'traslado',
        etiqueta: 'Traslado ida y vuelta',
        minutos: 90,
        centroCostoId: 'cc-instalacion',
        dotacion: 2,
      },
    ]);
  });

  it('hereda centro y dotación cuando el bloque no los declara', () => {
    const [bloque] = leerTiemposExtra({
      tiemposExtra: [{ id: 'prep', etiqueta: 'Preparar', minutos: 30 }],
    });
    expect(bloque.centroCostoId).toBeNull();
    expect(bloque.dotacion).toBeNull();
  });

  it('ignora los bloques sin minutos útiles en vez de cotizar cero', () => {
    expect(
      leerTiemposExtra({
        tiemposExtra: [
          { etiqueta: 'Sin minutos' },
          { etiqueta: 'Cero', minutos: 0 },
          { etiqueta: 'Negativo', minutos: -10 },
          { etiqueta: 'Texto', minutos: 'mucho' },
          { etiqueta: 'Válido', minutos: 15 },
        ],
      }),
    ).toHaveLength(1);
  });

  it('completa id y etiqueta faltantes sin perder el bloque', () => {
    const [bloque] = leerTiemposExtra({ tiemposExtra: [{ minutos: 45 }] });
    expect(bloque.id).toBe('extra_0');
    expect(bloque.etiqueta).toBe('Tiempo extra');
    expect(bloque.minutos).toBe(45);
  });
});

describe('centrosDeTiemposExtra', () => {
  it('junta sólo los centros propios: los heredados ya están en el mapa', () => {
    expect(
      centrosDeTiemposExtra({
        tiemposExtra: [
          { id: 'prep', etiqueta: 'Preparar', minutos: 30 },
          {
            id: 'traslado',
            etiqueta: 'Traslado',
            minutos: 90,
            centroCostoId: 'cc-instalacion',
          },
        ],
      }),
    ).toEqual(['cc-instalacion']);
  });
});
