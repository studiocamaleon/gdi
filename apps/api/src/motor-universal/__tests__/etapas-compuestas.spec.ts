import { consolidarEtapasCompuestas } from '../etapas-compuestas';
import type { PasoEjecutado } from '../tipos';

function paso(
  codigo: string,
  nombre: string,
  minutos: number,
  costo: number,
): PasoEjecutado {
  return {
    rutaPasoId: `ruta:ensamble:interno:${codigo}`,
    rutaPasoOrden: codigo === 'tensado' ? 2.001 : 2.002,
    familiaCodigo: codigo,
    nombreVisible: nombre,
    contenedorClave: 'ruta:ensamble',
    contenedorNombre: 'Ensamble final',
    pasoInternoCodigo: codigo,
    componentesCodigos: ['lona'],
    configPasoId: codigo,
    activado: true,
    tiempo: {
      setupMin: 0,
      runMin: minutos,
      cleanupMin: 0,
      tiempoFijoMin: 0,
      totalMin: minutos,
      centroCostoId: 'terminacion',
      centroCostoNombre: 'Terminación',
      tarifaHora: 100,
      costo,
    },
    materiales: [],
    costoTotal: costo,
  };
}

describe('consolidarEtapasCompuestas', () => {
  it('expone un único paso operativo y conserva el desglose calculado', () => {
    const tensado = paso('tensado', 'Tensado de lona', 40, 100);
    tensado.nestingResult = {
      algorithm: 'grid-2d-single',
      cantidadCalculada: 1,
      unidad: 'pliegos',
      aprovechamientoPct: 80,
      substrates: [{ kind: 'sheet', count: 1, widthMm: 1000, heightMm: 700 }],
      placements: [],
    };
    const resultado = consolidarEtapasCompuestas([
      tensado,
      paso('cenefas', 'Colocación de cenefas', 20, 50),
    ]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      rutaPasoId: 'ensamble',
      nombreVisible: 'Ensamble final',
      contenedorClave: null,
      activado: true,
      costoTotal: 150,
      tiempo: { totalMin: 60, costo: 150 },
    });
    expect(resultado[0].operacionesInternas).toHaveLength(2);
    expect(resultado[0].operacionesInternas?.[0].nestingResult).toMatchObject({
      algorithm: 'grid-2d-single',
      cantidadCalculada: 1,
    });
  });
});
