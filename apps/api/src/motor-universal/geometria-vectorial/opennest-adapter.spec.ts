import { CONFIGURACION_ENCASTRES_DEFAULT } from './segmentacion-encastres';
import {
  finalizarAnalisisOpenNest,
  prepararAnalisisOpenNest,
} from './opennest-adapter';

const SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M 0 0 L 100 0 L 100 100 L 0 100 Z" />
  </svg>`;

function preparar(preservarComposicionOriginalSiEntra = false) {
  return prepararAnalisisOpenNest({
    tenantId: 'tenant-a',
    nombreArchivo: 'cuadrado.svg',
    cacheKey: 'a'.repeat(64),
    sourceHash: 'b'.repeat(64),
    svg: SVG,
    anchoFinalMm: 100,
    parametros: {
      cantidad: 2,
      anchoPlacaMm: 300,
      altoPlacaMm: 200,
      margenMm: 5,
      separacionMm: 5,
      permitirRotacion: true,
      permitirSegmentacion: true,
      preservarComposicionOriginalSiEntra,
      configuracionEncastres: CONFIGURACION_ENCASTRES_DEFAULT,
    },
  });
}

describe('adaptador OpenNest del análisis vectorial', () => {
  it('convierte el resultado validado en el contrato que consumen vista y costeo', () => {
    const preparacion = preparar();
    expect(preparacion.trabajo?.piezas).toHaveLength(1);
    const entry = finalizarAnalisisOpenNest({
      contexto: preparacion.contexto,
      resultado: {
        schemaVersion: 1,
        algoritmo: 'opennest-v1',
        motor: 'collision',
        versionMotor: 'test',
        cantidadSolicitada: 2,
        cantidadColocada: 2,
        placasUsadas: 1,
        duracionMs: 123,
        placements: [
          {
            piezaId: 'pieza-1',
            copia: 0,
            placa: 0,
            rotacionGrados: 0,
            traslacion: { x: 5, y: 5 },
            contorno: [
              { x: 5, y: 5 },
              { x: 105, y: 5 },
              { x: 105, y: 105 },
              { x: 5, y: 105 },
            ],
            huecos: [],
          },
          {
            piezaId: 'pieza-1',
            copia: 1,
            placa: 0,
            rotacionGrados: 0,
            traslacion: { x: 110, y: 5 },
            contorno: [
              { x: 110, y: 5 },
              { x: 210, y: 5 },
              { x: 210, y: 105 },
              { x: 110, y: 105 },
            ],
            huecos: [],
          },
        ],
        validacion: {
          completa: true,
          dentroDePlaca: true,
          sinSolapamientos: true,
          separacionRespetada: true,
        },
      },
    });

    expect(entry.nesting.motorNesting).toBe('opennest-v1');
    expect(entry.nesting.versionMotor).toBe('test');
    expect(entry.nesting.placements).toHaveLength(2);
    expect(entry.nesting.placas).toBe(1);
    expect(entry.nesting.piezasOriginales).toBe(2);
    expect(entry.nesting.areaPiezasMm2).toBe(20_000);
    expect(entry.solucionNesting.resultado).toBe(entry.nesting);
  });

  it('no encola cuando debe conservar la composición original', () => {
    const preparacion = preparar(true);

    expect(preparacion.trabajo).toBeUndefined();
    expect(preparacion.solucionInmediata?.resultado.estrategiaDisposicion).toBe(
      'composicion_original',
    );
  });
});
