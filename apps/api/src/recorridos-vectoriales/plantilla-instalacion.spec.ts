import type { GeometriaVectorialCanonica } from '../motor-universal/geometria-vectorial/tipos';
import { crearPlantillaInstalacion } from './plantilla-instalacion';

const geometria: GeometriaVectorialCanonica = {
  schemaVersion: 1,
  anchoMm: 300,
  altoMm: 100,
  areaTotalMm2: 12_000,
  perimetroTotalMm: 1_000,
  hashFuente: 'test',
  piezas: [
    {
      id: 'pieza-1',
      origenXmm: 10,
      origenYmm: 20,
      anchoMm: 80,
      altoMm: 60,
      areaMm2: 4_400,
      perimetroMm: 360,
      contornos: [
        {
          esHueco: false,
          puntos: [
            { x: 0, y: 0 },
            { x: 80, y: 0 },
            { x: 80, y: 60 },
            { x: 0, y: 60 },
          ],
        },
        {
          esHueco: true,
          puntos: [
            { x: 20, y: 20 },
            { x: 40, y: 20 },
            { x: 40, y: 40 },
            { x: 20, y: 40 },
          ],
        },
      ],
    },
    {
      id: 'pieza-2',
      origenXmm: 220,
      origenYmm: 10,
      anchoMm: 70,
      altoMm: 70,
      areaMm2: 4_900,
      perimetroMm: 280,
      contornos: [
        {
          esHueco: false,
          puntos: [
            { x: 0, y: 0 },
            { x: 70, y: 0 },
            { x: 70, y: 70 },
            { x: 0, y: 70 },
          ],
        },
      ],
    },
  ],
};

describe('crearPlantillaInstalacion', () => {
  it('conserva las coordenadas originales e ignora huecos interiores', () => {
    const result = crearPlantillaInstalacion({
      geometria,
      nombre: 'Cartel prueba',
      configuracion: { bordeMm: 50, anchoPanelMm: 1200, altoPanelMm: 600 },
    });

    expect(result.anchoPlantillaMm).toBe(400);
    expect(result.altoPlantillaMm).toBe(200);
    expect(result.paneles).toHaveLength(1);
    expect(result.svg).toContain('width="400mm"');
    expect(result.svg).toContain('GUIAS-NO-CORTAR');
    expect(result.svg).toContain('rotulo-pieza-1');
    expect(result.svg).toContain('Control 100 mm');
    expect(result.previewSvg).toContain('VISTA-EXPLICATIVA');
    expect(result.previewSvg).toContain('P1');
    expect(result.previewSvg).toContain('400 mm');
    // El hueco interno no se transforma en un tercer vaciado del negativo.
    expect(result.cantidadPiezas).toBe(2);
  });

  it('paneliza sin volver a nestear ni cambiar la medida final', () => {
    const result = crearPlantillaInstalacion({
      geometria: { ...geometria, anchoMm: 3000 },
      nombre: 'Cartel grande',
      configuracion: {
        bordeMm: 50,
        anchoPanelMm: 1200,
        altoPanelMm: 600,
        solapeMm: 20,
      },
    });

    expect(result.anchoPlantillaMm).toBe(3100);
    expect(result.paneles).toHaveLength(3);
    expect(result.paneles.map((panel) => panel.origenXmm)).toEqual([
      0, 1180, 2360,
    ]);
    expect(result.paneles.map((panel) => panel.anchoMm)).toEqual([
      1200, 1200, 740,
    ]);
    expect(result.previewSvg).toContain('Panel 1');
    expect(result.previewSvg).toContain('Panel 3');
  });

  it('dibuja como guía las uniones de una pieza segmentada', () => {
    const result = crearPlantillaInstalacion({
      geometria,
      nombre: 'Con unión',
      uniones: [
        {
          id: 'pieza-1-U1',
          piezaOrigenId: 'pieza-1',
          tipoEncastre: 'cola_milano',
          eje: 'vertical',
          posicionMm: 40,
          largoMm: 60,
          cantidadEncastres: 1,
          anchoEncastreMm: 30,
          profundidadEncastreMm: 30,
          kerfMm: 0.3,
        },
      ],
    });

    expect(result.cantidadUniones).toBe(1);
    expect(result.svg).toContain('union-pieza-1-U1');
    expect(result.svg).toContain('stroke="#ff9900"');
  });
});
