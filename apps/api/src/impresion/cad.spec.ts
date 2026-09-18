import { PDFDocument } from 'pdf-lib';
import { validate } from 'class-validator';
import {
  esConfiguracionCad,
  planPruebaCad,
  type ConfiguracionCad,
} from './cad.domain';
import { pdfPruebaCad } from './prueba-cad';
import { ConfiguracionCadDto, PruebaCadDto } from './perfiles-impresion.dto';

const cad: ConfiguracionCad = {
  anchoRolloMm: 914,
  margenMm: 5,
  origenPapel: 'roll',
  usarOrigenPredeterminado: false,
};
describe('piloto CAD a tamaño real', () => {
  it('gira A1 en rollo 914 y conserva ambos lados, más margen exterior', () => {
    expect(planPruebaCad(cad, 'A1')).toMatchObject({
      giro: 90,
      anchoMm: 841,
      altoMm: 594,
      anchoSalidaMm: 914,
      largoSalidaMm: 604,
      escala: 100,
    });
  });
  it('con rollo 610 conserva A1 sin giro; no reduce para ahorrar largo', () => {
    expect(planPruebaCad({ ...cad, anchoRolloMm: 610 }, 'A1')).toMatchObject({
      giro: 0,
      anchoMm: 594,
      altoMm: 841,
      largoSalidaMm: 851,
      escala: 100,
    });
  });
  it('admite medidas personalizadas y diferencia el ancho nominal de 36 pulgadas', () => {
    expect(
      planPruebaCad({ ...cad, anchoRolloMm: 914.4 }, 'PERSONALIZADO'),
    ).toMatchObject({ giro: 0, anchoSalidaMm: 914.4, largoSalidaMm: 360 });
  });
  it('bloquea si no cabe y rechaza origen implícito, márgenes alterados y valores inválidos', () => {
    expect(() => planPruebaCad({ ...cad, anchoRolloMm: 300 }, 'A1')).toThrow(
      'No se reducirá',
    );
    for (const patch of [
      { anchoRolloMm: NaN },
      { anchoRolloMm: Infinity },
      { margenMm: 0 },
      { origenPapel: '' },
      { origenPapel: 'roll\ncomando' },
    ]) {
      expect(esConfiguracionCad({ ...cad, ...patch })).toBe(false);
    }
    expect(
      esConfiguracionCad({
        ...cad,
        origenPapel: '',
        usarOrigenPredeterminado: true,
      }),
    ).toBe(true);
  });
  it('los DTO no permiten formatos arbitrarios, versiones faltantes ni ancho fuera del piloto', async () => {
    expect(
      await validate(
        Object.assign(new PruebaCadDto(), { version: 1, formato: 'A0' }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        Object.assign(new ConfiguracionCadDto(), {
          ...cad,
          habilitado: true,
          version: 1,
        }),
      ),
    ).toHaveLength(0);
    expect(
      await validate(
        Object.assign(new ConfiguracionCadDto(), {
          ...cad,
          habilitado: true,
          version: 1,
          anchoRolloMm: 1200,
        }),
      ),
    ).not.toHaveLength(0);
  });
  it('admite B/N, Color y clientes anteriores; rechaza modos de color no soportados', async () => {
    for (const color of [undefined, 'BN', 'COLOR']) {
      expect(
        await validate(
          Object.assign(new PruebaCadDto(), {
            version: 1,
            formato: 'A1',
            color,
          }),
        ),
      ).toHaveLength(0);
    }
    for (const color of [null, '', 'draft', 'blackwhite']) {
      expect(
        await validate(
          Object.assign(new PruebaCadDto(), {
            version: 1,
            formato: 'A1',
            color,
          }),
        ),
      ).not.toHaveLength(0);
    }
  });
  it.each(['A1', 'PERSONALIZADO'] as const)(
    'genera una página vectorial %s del tamaño de salida, con original a escala 1',
    async (formato) => {
      const { pdf, plan } = await pdfPruebaCad(cad, formato);
      const doc = await PDFDocument.load(pdf);
      expect(doc.getPageCount()).toBe(1);
      const p = doc.getPage(0);
      expect((p.getWidth() * 25.4) / 72).toBeCloseTo(plan.anchoSalidaMm, 5);
      expect((p.getHeight() * 25.4) / 72).toBeCloseTo(plan.largoSalidaMm, 5);
      // Un original embebido vectorial conserva la caja original en puntos.
      const objects = doc.context
        .enumerateIndirectObjects()
        .map(([, o]) => o.toString());
      expect(objects.some((o) => o.includes('/Subtype /Form'))).toBe(true);
      expect(objects.some((o) => o.includes('/Subtype /Image'))).toBe(false);
    },
  );
});
