/**
 * Etapa B (anilladora): la biblioteca de espirales sembrada (MaterialPreset
 * ESPIRAL_PLASTICO) es compatible con el slot `anillo` (TERMINACION_EDITORIAL /
 * ANILLADO_ENCUADERNACION) y trae `capacidadMaxHojas` por variante, de modo que la
 * selección MENOR_CAPACIDAD_QUE_CUMPLA (Etapa A) elige el Ø correcto.
 *
 * Importar el módulo de seed es seguro: sólo define datos (lo destructivo vive en
 * seed.js, que NO se importa). Ver docs/anilladora-encuadernacion-espiral-diseno.md.
 */
import { seleccionarMenorCapacidadQueCumpla } from '../../motor-universal/seleccion-capacidad';

// El módulo de seed es CommonJS y sólo define datos (nada destructivo se importa).
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment */
const {
  materialPresets,
} = require('../../../prisma/seed-modulos/material-presets');
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment */

type Preset = {
  key: string;
  familia: string;
  subfamilia: string;
  tipoTecnico: string;
  templateId: string;
  variantes: Array<{
    skuSugerido: string;
    atributosVarianteJson: Record<string, unknown>;
  }>;
};

const espiral: Preset = (materialPresets as Preset[]).find(
  (p) => p.key === 'ESPIRAL_PLASTICO',
)!;

describe('biblioteca ESPIRAL_PLASTICO (seed)', () => {
  it('existe y matchea la compat del slot anillo', () => {
    expect(espiral).toBeTruthy();
    // Debe cruzar con anillo: familia TERMINACION_EDITORIAL + subfamilia ANILLADO_ENCUADERNACION.
    expect(espiral.familia).toBe('TERMINACION_EDITORIAL');
    expect(espiral.subfamilia).toBe('ANILLADO_ENCUADERNACION');
    expect(espiral.tipoTecnico).toBe('anillado_encuadernacion');
    expect(espiral.templateId).toBe('anillado_encuadernacion_v1');
  });

  it('cada variante trae tipoAnillo, diámetro y capacidadMaxHojas', () => {
    expect(espiral.variantes.length).toBeGreaterThanOrEqual(6);
    for (const v of espiral.variantes) {
      const a = v.atributosVarianteJson;
      expect(a.tipoAnillo).toBe('ESPIRAL_PLASTICO');
      expect(typeof a.diametro).toBe('number');
      expect(Number(a.capacidadMaxHojas)).toBeGreaterThan(0);
    }
  });

  it('la capacidad crece con el diámetro (monótona)', () => {
    const ord = [...espiral.variantes].sort(
      (x, y) =>
        Number(x.atributosVarianteJson.diametro) -
        Number(y.atributosVarianteJson.diametro),
    );
    for (let i = 1; i < ord.length; i += 1) {
      expect(
        Number(ord[i].atributosVarianteJson.capacidadMaxHojas),
      ).toBeGreaterThan(
        Number(ord[i - 1].atributosVarianteJson.capacidadMaxHojas),
      );
    }
  });
});

describe('selección de espiral sobre la biblioteca real', () => {
  // El slot usa criterioMaterialCampo = capacidadMaxHojas (vive en atributosVarianteJson).
  const elegirDiametro = (hojas: number) => {
    const v = seleccionarMenorCapacidadQueCumpla(
      espiral.variantes,
      'capacidadMaxHojas',
      hojas,
    );
    return v ? Number(v.atributosVarianteJson.diametro) : null;
  };

  it('elige el Ø de menor capacidad que aguanta las hojas del libro', () => {
    expect(elegirDiametro(30)).toBe(6); // 35 hojas
    expect(elegirDiametro(80)).toBe(10); // exacto
    expect(elegirDiametro(90)).toBe(12); // 80 no alcanza → 100
    expect(elegirDiametro(200)).toBe(25); // 180 no alcanza → 230
    expect(elegirDiametro(440)).toBe(50); // tope
  });

  it('libro más grande que el mayor espiral → null (aviso del motor)', () => {
    expect(elegirDiametro(999)).toBeNull();
  });
});
