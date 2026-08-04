/**
 * Impresión 3D — el tiempo sale del CAUDAL del perfil (g/h) aplicado a los
 * GRAMOS de la pieza, no del área ni de la caja.
 *
 * Estos tests cubren las dos piezas puras de esa cadena: la conversión
 * caudal→minutos y la declaración de la familia. El armado end-to-end vive en
 * motor.spec.
 */
import { runMinPorProductividad } from '../productividad-tiempo';
import { FAMILIAS } from '../../productos-servicios/pasos/familias';

describe('Impresión 3D — tiempo por caudal de material', () => {
  it('G_H: gramos ÷ (g/h) × 60 = minutos', () => {
    // 250 g de pieza a 25 g/h = 10 h = 600 min.
    expect(runMinPorProductividad(250, 25, 'G_H')).toBeCloseTo(600, 4);
  });

  it('escala con la cantidad de piezas (la magnitud son los gramos totales)', () => {
    // 4 piezas × 50 g = 200 g a 20 g/h = 10 h.
    expect(runMinPorProductividad(200, 20, 'G_H')).toBeCloseTo(600, 4);
  });

  it('sin caudal cargado no inventa tiempo', () => {
    expect(runMinPorProductividad(250, 0, 'G_H')).toBe(0);
  });

  it('un caudal mayor baja el tiempo proporcionalmente', () => {
    const lento = runMinPorProductividad(100, 10, 'G_H');
    const rapido = runMinPorProductividad(100, 20, 'G_H');
    expect(rapido).toBeCloseTo(lento / 2, 4);
  });
});

describe('Impresión 3D — declaración de la familia', () => {
  const familia = FAMILIAS.impresion_3d;

  it('existe y usa la plantilla IMPRESORA_3D', () => {
    expect(familia).toBeDefined();
    expect(familia.plantillasCompatibles).toEqual(['IMPRESORA_3D']);
  });

  it('mide el tiempo en gramos de material, no en área ni cantidad', () => {
    expect(familia.magnitudTiempoDefault).toBe('gramos_material');
  });

  it('soporta el perfil de la máquina (T-3) y el dato del slicer (T-4)', () => {
    expect(familia.modosTiempoSoportados).toEqual(
      expect.arrayContaining(['T-3', 'T-4']),
    );
  });

  it('pide filamento o resina como material', () => {
    const slot = familia.slotsRequeridos.find((s) => s.codigo === 'material_3d');
    expect(slot?.requerido).toBe(true);
    expect(slot?.compatibilidadMaterial?.familiasMateriaPrima).toEqual([
      'ADITIVA_3D',
    ]);
  });

  it('declara los gramos por pieza como param del paso', () => {
    const campos = familia.paramsPasoSchema.map((p) => p.campo);
    expect(campos).toContain('gramosPorPieza');
    expect(campos).toContain('rellenoPct');
  });
});
