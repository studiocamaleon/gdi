import { fuentesInstalacion } from './fuentes-instalacion';
import {
  inspeccionarVector,
  interpretarVector,
} from '../productos-servicios/geometrias/interpretar-vector';

function diseno(id: string, x: number, y: number, archivoId = 'logo') {
  const svg = `<svg viewBox="0 0 200 100"><path d="M${x} ${y}h20v10h-20z"/></svg>`;
  const inspeccion = inspeccionarVector(svg, `${archivoId}.svg`);
  const diseno = {
    id,
    nombre: id,
    cantidadPorUnidad: 3,
    fuente: interpretarVector(
      inspeccion,
      {
        exteriorId: inspeccion.sugeridaId,
        unidad: 'mm',
        cerrarExterior: false,
        operaciones: [],
      },
      {
        archivoId,
        geometriaId: id,
        hash: archivoId,
        nombreArchivo: `${archivoId}.svg`,
      },
    ),
  };
  // Posición conservada al separar esta pieza de la composición del archivo.
  diseno.fuente.fabricacion.origen = { minX: x, minY: y, factorMm: 1 };
  return diseno;
}

describe('composición original para instalación', () => {
  it('reúne las piezas del mismo archivo en su posición original, sin multiplicarlas por las cantidades', () => {
    const disenosVectoriales = [
      diseno('letra-a', 20, 30),
      diseno('letra-b', 80, 50),
    ];
    const copia = JSON.stringify(disenosVectoriales);
    const fuentes = fuentesInstalacion({ cantidad: 50, disenosVectoriales });
    expect(fuentes).toHaveLength(1);
    const g = fuentes[0].geometria;
    expect(g.piezas).toHaveLength(2);
    expect(g.anchoMm).toBeCloseTo(80);
    expect(g.altoMm).toBeCloseTo(30);
    expect(g.piezas.map((p) => [p.origenXmm, p.origenYmm])).toEqual([
      [0, 0],
      [60, 20],
    ]);
    expect(JSON.stringify(disenosVectoriales)).toBe(copia);
  });

  it('separa archivos independientes aunque tengan el mismo nombre', () => {
    const a = diseno('a', 10, 20, 'archivo-1');
    const b = diseno('b', 150, 50, 'archivo-2');
    b.fuente.nombreArchivo = a.fuente.nombreArchivo;
    const fuentes = fuentesInstalacion({ disenosVectoriales: [a, b] });
    expect(fuentes.map((f) => f.id)).toEqual(['archivo-1', 'archivo-2']);
    expect(fuentes.every((f) => f.geometria.anchoMm === 20)).toBe(true);
  });

  it('preserva posiciones en unidades distintas de milímetros', () => {
    const a = diseno('a', 20, 30);
    const b = diseno('b', 80, 50);
    for (const d of [a, b]) d.fuente.fabricacion.origen.factorMm = 2;
    const fuentes = fuentesInstalacion({ disenosVectoriales: [a, b] });
    expect(fuentes[0].geometria.piezas[1].origenXmm).toBeCloseTo(120);
    expect(fuentes[0].geometria.piezas[1].origenYmm).toBeCloseTo(40);
  });

  it('no duplica en la plantilla una interpretación cargada dos veces', () => {
    const a = diseno('a', 20, 30);
    const fuentes = fuentesInstalacion({
      disenosVectoriales: [a, { ...a, id: 'copia' }],
    });
    expect(fuentes[0].geometria.piezas).toHaveLength(1);
  });
});
