/**
 * Etapa A (anilladora): MENOR_CAPACIDAD_QUE_CUMPLA debe leer la capacidad
 * (capacidadMaxHojas) de atributosVarianteJson y elegir la variante de MENOR
 * capacidad que igual cubre el requerimiento. Antes leía sólo top-level ⇒ cap=0 ⇒
 * no auto-seleccionaba el anillo. Ver docs/anilladora-encuadernacion-espiral-diseno.md.
 */
import {
  capacidadDeVariante,
  seleccionarMenorCapacidadQueCumpla,
} from '../seleccion-capacidad';

// Biblioteca mínima de espirales (Ø → capacidadMaxHojas a 80g), como la sembraría
// la Etapa B; la capacidad vive en atributosVarianteJson (no aplanada).
const espirales = [
  { id: '6mm', atributosVarianteJson: { diametro: 6, capacidadMaxHojas: 35 } },
  {
    id: '10mm',
    atributosVarianteJson: { diametro: 10, capacidadMaxHojas: 80 },
  },
  {
    id: '16mm',
    atributosVarianteJson: { diametro: 16, capacidadMaxHojas: 140 },
  },
  {
    id: '25mm',
    atributosVarianteJson: { diametro: 25, capacidadMaxHojas: 230 },
  },
];

describe('capacidadDeVariante', () => {
  it('lee la capacidad de atributosVarianteJson', () => {
    expect(capacidadDeVariante(espirales[0], 'capacidadMaxHojas')).toBe(35);
  });

  it('acepta el valor aplanado top-level (fallback)', () => {
    const v = { capacidadMaxHojas: 99, atributosVarianteJson: {} };
    expect(capacidadDeVariante(v, 'capacidadMaxHojas')).toBe(99);
  });

  it('sin el campo → 0', () => {
    expect(
      capacidadDeVariante({ atributosVarianteJson: {} }, 'capacidadMaxHojas'),
    ).toBe(0);
    expect(capacidadDeVariante(espirales[0], '')).toBe(0);
  });
});

describe('seleccionarMenorCapacidadQueCumpla', () => {
  const elegir = (hojas: number) =>
    seleccionarMenorCapacidadQueCumpla(espirales, 'capacidadMaxHojas', hojas)
      ?.id ?? null;

  it('elige el Ø de MENOR capacidad que cubre las hojas del libro', () => {
    expect(elegir(30)).toBe('6mm'); // 35 ≥ 30, el más chico
    expect(elegir(35)).toBe('6mm'); // límite exacto
    expect(elegir(36)).toBe('10mm'); // 35 no alcanza → sube a 80
    expect(elegir(100)).toBe('16mm'); // 80 no alcanza → 140
    expect(elegir(140)).toBe('16mm');
    expect(elegir(200)).toBe('25mm');
  });

  it('ninguna cubre → null (lo destraba el aviso del motor)', () => {
    expect(elegir(500)).toBeNull();
  });

  it('lista vacía → null', () => {
    expect(
      seleccionarMenorCapacidadQueCumpla([], 'capacidadMaxHojas', 10),
    ).toBeNull();
  });
});
