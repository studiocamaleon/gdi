import { huellaDe, RecetasProductoService } from '../recetas-producto.service';

describe('huella canónica de receta', () => {
  it('no cambia por el orden de las claves de un objeto', () => {
    expect(
      huellaDe({
        producto: { nombre: 'Exhibidor', codigo: 'EXH' },
        version: 1,
      }),
    ).toBe(
      huellaDe({
        version: 1,
        producto: { codigo: 'EXH', nombre: 'Exhibidor' },
      }),
    );
  });

  it('detecta cambios productivos reales', () => {
    expect(huellaDe({ material: 'PVC', merma: 5 })).not.toBe(
      huellaDe({ material: 'PVC', merma: 8 }),
    );
  });

  it('conserva el orden significativo de las listas', () => {
    expect(huellaDe({ pasos: ['imprimir', 'cortar'] })).not.toBe(
      huellaDe({ pasos: ['cortar', 'imprimir'] }),
    );
  });
});


describe('política de stock en recetas publicadas', () => {
  const servicio = Object.create(RecetasProductoService.prototype) as any;
  function snapshot(politicaStock?: string) {
    return servicio.snapshotConfiguracion({ id: 'producto', cargosDirectosCotizacion: [], medidasPredefinidasJson: [], atributosComercialesJson: {} }, {
      id: 'ruta', ruta: {}, pasosExtras: [], configPasos: [{ rutaPasoId: 'paso', multiplicadoresActivos: [], requiereRutaPasoIds: [], slotsMateriales: [{ slotCodigo: 'sustrato', modoSeleccion: 'MOTOR_ELIGE_AUTO', ...(politicaStock ? { politicaStock } : {}) }] }],
    });
  }
  it('TODAS no invalida la huella de una receta anterior a la migración', () => {
    expect(huellaDe(snapshot('TODAS'))).toBe(huellaDe(snapshot()));
  });
  it('congela y detecta un cambio real de política', () => {
    const estricto = snapshot('SOLO_DISPONIBLES');
    expect(estricto.pasos[0].slots[0].politicaStock).toBe('SOLO_DISPONIBLES');
    expect(huellaDe(estricto)).not.toBe(huellaDe(snapshot('PREFERIR_DISPONIBLES')));
  });
});
