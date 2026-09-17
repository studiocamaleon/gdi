import {
  agregarContextoComponentesVinculados,
  consolidarEtapasCompuestas,
} from '../etapas-compuestas';
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
  it('agrega las piezas de todas las ocurrencias de las plantillas vinculadas', () => {
    const contexto = agregarContextoComponentesVinculados({
      contextoPadre: { cantidad: 10, referencia: 'OT' },
      codigosPlantilla: ['estampa-frente', 'estampa-espalda'],
      componentes: [
        {
          codigo: 'estampa-frente',
          plantillaCodigo: 'estampa-frente',
          cantidad: 10,
          jobContext: {
            cantidad: 10,
            piezas: [{ cantidad: 10, anchoMm: 200, altoMm: 200 }],
          },
        },
        {
          codigo: 'estampa-espalda',
          plantillaCodigo: 'estampa-espalda',
          cantidad: 10,
          jobContext: {
            cantidad: 10,
            piezas: [{ cantidad: 10, anchoMm: 200, altoMm: 200 }],
          },
        },
        {
          codigo: 'estampa-frente__manga',
          plantillaCodigo: 'estampa-frente',
          cantidad: 10,
          jobContext: {
            cantidad: 10,
            piezas: [{ cantidad: 10, anchoMm: 80, altoMm: 120 }],
          },
        },
      ],
    });

    expect(contexto).toMatchObject({
      cantidad: 10,
      cantidadPiezasComponentes: 30,
      piezaAreaTotalM2: 0.896,
      componentesVinculados: [
        'estampa-frente',
        'estampa-espalda',
        'estampa-frente__manga',
      ],
    });
    expect(contexto.piezas).toHaveLength(3);
  });

  it('expone un único paso operativo y conserva el desglose calculado', () => {
    const tensado = paso('tensado', 'Tensado de lona', 40, 100);
    tensado.tiempo!.costo = 90;
    tensado.cargosDirectosPaso = [
      {
        cargoDirectoCatalogoId: 'cargo-1',
        cargoCodigo: 'control-calidad',
        cargoNombre: 'Control de calidad',
        modoCalculo: 'MONTO_FIJO_PLANO',
        monto: 10,
        aplicaMargen: true,
      },
    ];
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
      tiempo: { totalMin: 60, tarifaHora: 100, costo: 140 },
    });
    expect(resultado[0].operacionesInternas).toHaveLength(2);
    expect(resultado[0].operacionesInternas?.[0]).toMatchObject({
      configPasoId: 'tensado',
      rutaPasoId: 'ruta:ensamble:interno:tensado',
      tiempo: {
        totalMin: 40,
        centroCostoNombre: 'Terminación',
        costo: 90,
      },
      cargosDirectosPaso: [
        {
          cargoCodigo: 'control-calidad',
          monto: 10,
        },
      ],
      nestingResult: {
        algorithm: 'grid-2d-single',
        cantidadCalculada: 1,
      },
    });
  });
});
