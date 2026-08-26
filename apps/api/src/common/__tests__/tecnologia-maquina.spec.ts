import {
  normalizarTecnologiaMaquina,
  resolverTecnologiaMaquina,
} from '../tecnologia-maquina';

describe('tecnologia-maquina', () => {
  describe('normalizarTecnologiaMaquina', () => {
    it('normaliza sinónimos y acentos al código del catálogo', () => {
      expect(normalizarTecnologiaMaquina('Ultravioleta')).toBe('uv');
      expect(normalizarTecnologiaMaquina('solvente')).toBe('eco_solvente');
      expect(normalizarTecnologiaMaquina('Eco-Solvente')).toBe('eco_solvente');
      expect(normalizarTecnologiaMaquina('Láser')).toBe('laser');
      expect(normalizarTecnologiaMaquina('DTF UV')).toBe('dtf_uv');
      expect(normalizarTecnologiaMaquina('Fotoduplicación')).toBe(
        'fotoduplicacion',
      );
      expect(normalizarTecnologiaMaquina('duplicadora digital')).toBe(
        'fotoduplicacion',
      );
    });

    it('devuelve null para valores desconocidos o vacíos', () => {
      expect(normalizarTecnologiaMaquina('')).toBeNull();
      expect(normalizarTecnologiaMaquina('   ')).toBeNull();
      expect(normalizarTecnologiaMaquina('marciano')).toBeNull();
      expect(normalizarTecnologiaMaquina(42)).toBeNull();
    });
  });

  describe('resolverTecnologiaMaquina', () => {
    it('lee la tecnología explícita de los parámetros técnicos', () => {
      expect(
        resolverTecnologiaMaquina({
          plantilla: 'impresora_gran_formato',
          parametrosTecnicosJson: { tecnologia: 'UV' },
        }),
      ).toBe('uv');
    });

    it('acepta la clave alternativa tecnologiaMaquina y capacidadesAvanzadas', () => {
      expect(
        resolverTecnologiaMaquina({
          parametrosTecnicosJson: { tecnologiaMaquina: 'sublimacion' },
        }),
      ).toBe('sublimacion');
      expect(
        resolverTecnologiaMaquina({
          capacidadesAvanzadasJson: { tecnologiaMaquina: 'latex' },
        }),
      ).toBe('latex');
    });

    it('cae a la tecnología fija por plantilla cuando no hay parámetro', () => {
      expect(resolverTecnologiaMaquina({ plantilla: 'IMPRESORA_LASER' })).toBe(
        'laser',
      );
      expect(resolverTecnologiaMaquina({ plantilla: 'plotter_cad' })).toBe(
        'inkjet',
      );
      expect(
        resolverTecnologiaMaquina({ plantilla: 'DUPLICADORA_DIGITAL' }),
      ).toBe('fotoduplicacion');
    });

    it('devuelve null sin señal alguna', () => {
      expect(resolverTecnologiaMaquina(null)).toBeNull();
      expect(resolverTecnologiaMaquina({ plantilla: 'guillotina' })).toBeNull();
      expect(resolverTecnologiaMaquina({})).toBeNull();
    });
  });
});
