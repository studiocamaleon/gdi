import { unzipSync } from 'fflate';
import type { GeometriaVectorialCanonica } from '../motor-universal/geometria-vectorial/tipos';
import { crearPlantillaInstalacion } from './plantilla-instalacion';
import {
  crearDxfPlantillaRigida,
  crearEpsPlantillaVinilo,
  crearPaqueteInstalacion,
  crearPlanoGeneralAcotadoPdf,
  crearPlantillaPapelMosaicoPdf,
  crearPlantillaPapelPlotterPdf,
} from './plantilla-instalacion-export';

const geometria: GeometriaVectorialCanonica = {
  schemaVersion: 1,
  anchoMm: 300,
  altoMm: 120,
  areaTotalMm2: 20_000,
  perimetroTotalMm: 900,
  hashFuente: 'fixture',
  piezas: [
    {
      id: 'letra-a',
      origenXmm: 20,
      origenYmm: 10,
      anchoMm: 80,
      altoMm: 90,
      areaMm2: 6_500,
      perimetroMm: 420,
      contornos: [
        {
          esHueco: false,
          puntos: [
            { x: 0, y: 90 },
            { x: 40, y: 0 },
            { x: 80, y: 90 },
          ],
        },
        {
          esHueco: true,
          puntos: [
            { x: 32, y: 55 },
            { x: 40, y: 35 },
            { x: 48, y: 55 },
          ],
        },
      ],
    },
    {
      id: 'barra',
      origenXmm: 160,
      origenYmm: 20,
      anchoMm: 100,
      altoMm: 40,
      areaMm2: 4_000,
      perimetroMm: 280,
      contornos: [
        {
          esHueco: false,
          puntos: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 40 },
            { x: 0, y: 40 },
          ],
        },
      ],
    },
  ],
};

const plantilla = crearPlantillaInstalacion({
  geometria,
  nombre: 'Cartel prueba',
  configuracion: {
    bordeMm: 50,
    anchoPanelMm: 250,
    altoPanelMm: 220,
    solapeMm: 20,
  },
});

const input = {
  nombre: 'Cartel prueba',
  nombreFuente: 'cartel-prueba.svg',
  geometria,
  plantilla,
  uniones: [],
};

describe('exportadores del paquete de instalación', () => {
  it('genera los dos PDF con cabecera válida', () => {
    for (const pdf of [
      crearPlanoGeneralAcotadoPdf(input),
      crearPlantillaPapelPlotterPdf(input),
      crearPlantillaPapelMosaicoPdf(input),
    ]) {
      expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(1_000);
    }
  });

  it('genera DXF R14 en milímetros y con capas operativas', () => {
    const dxf = crearDxfPlantillaRigida(input);
    expect(dxf).toContain('AC1014');
    expect(dxf).toContain('$INSUNITS\n70\n4');
    expect(dxf).toContain('LAYER\n2\nCORTE');
    expect(dxf).toContain('LAYER\n2\nMARCAS');
    expect(dxf).toContain('LWPOLYLINE');
  });

  it('genera un EPS con bounding box físico', () => {
    const eps = crearEpsPlantillaVinilo(input);
    expect(eps.startsWith('%!PS-Adobe-3.0 EPSF-3.0')).toBe(true);
    expect(eps).toContain('%%HiResBoundingBox:');
    expect(eps).toContain('closepath stroke');
  });

  it('empaqueta documentos generales y paneles DXF/SVG', () => {
    const files = unzipSync(crearPaqueteInstalacion(input));
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        '01-plano-general-acotado.pdf',
        '02-plantilla-papel-plotter-1a1.pdf',
        '02-plantilla-papel-mosaico-a4-1a1.pdf',
        '03-plantilla-rigida-completa.dxf',
        '04-plantilla-vinilo.eps',
        '05-patron-pounce.dxf',
        '03-paneles-rigidos/panel-01.dxf',
        '03-paneles-rigidos/panel-01.svg',
        'LEEME.txt',
      ]),
    );
  });
});
