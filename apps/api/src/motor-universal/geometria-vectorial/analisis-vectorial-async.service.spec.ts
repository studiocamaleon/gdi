import { MotorCotizacionError } from '../motor-error';
import { NestingIrregularError } from './nesting-irregular';
import { AnalisisVectorialAsyncService } from './analisis-vectorial-async.service';
import { GeometriaVectorialCacheService } from './geometria-vectorial-cache.service';
import type { ProblemaNesting } from './contrato-nesting';
import { GeometriaJobsService } from '../../workers/geometria/geometria-jobs.service';
import { resolverNestingBaseSeguro } from '../../workers/geometria/nesting-base-seguro';
import type { CrearTrabajoNestingOpenNestDto } from '../../workers/geometria/geometria-jobs.dto';
import type { NestingIrregularOpenNestData } from '../../workers/colas';
import { conPreparacionNesting } from '../../workers/geometria/politica-busqueda';

it('separa las cantidades y comparte sólo la misma demanda, conservando el corte común', async () => {
  const crear = jest.fn(({ dto }: { dto: CrearTrabajoNestingOpenNestDto }) => {
    const data: NestingIrregularOpenNestData = {
      schemaVersion: 1,
      tenantId: 'tenant',
      solicitadoEl: '',
      correlationId: '',
      motor: dto.motor ?? 'collision',
      semilla: dto.semilla ?? 30,
      timeoutMs: dto.timeoutMs ?? 120000,
      placa: dto.placa,
      separacionMm: dto.separacionMm,
      commonLine: dto.commonLine,
      piezas: dto.piezas.map((p) => ({
        ...p,
        huecos: p.huecos?.map((h) => h.puntos),
      })),
    };
    return Promise.resolve({
      estado: 'completado',
      resultado: resolverNestingBaseSeguro(data),
    });
  });
  const servicio = new AnalisisVectorialAsyncService(
    { crear, crearParaCotizacion: crear } as unknown as GeometriaJobsService,
    {} as GeometriaVectorialCacheService,
    {
      exigirTodas: jest.fn().mockResolvedValue(undefined),
      exigir: jest.fn().mockResolvedValue(undefined),
    } as never,
  );
  const problema: ProblemaNesting = {
    schemaVersion: 1,
    superficie: { tipo: 'PLACA', anchoMm: 500, altoMm: 500 },
    demandas: [
      {
        schemaVersion: 1,
        id: 'pieza',
        cantidad: 1,
        geometria: { tipo: 'RECTANGULO', anchoMm: 100, altoMm: 80 },
      },
    ],
    configuracion: {
      margenMm: 5,
      separacionMm: 5,
      permitirRotacion: true,
      permitirSegmentacion: false,
      preservarComposicionOriginalSiEntra: false,
      commonLine: {
        habilitado: false,
        anchoCorteMm: 1,
        longitudMinimaMm: 10,
        toleranciaMm: 0.01,
      },
    },
  };
  const resolver = (p: ProblemaNesting) =>
    servicio.resolverProblemaParaCotizacion({
      tenantId: 'tenant',
      problema: p,
      claveSolicitud: 'mismo-producto',
    });
  await resolver(problema);
  await conPreparacionNesting(() => resolver(problema));
  await resolver({
    ...problema,
    demandas: [{ ...problema.demandas[0], cantidad: 10 }],
  });
  await resolver(problema);
  const llamadas = crear.mock.calls.map(([i]) => i.dto);
  expect(llamadas[0].claveSolicitud).not.toBe(llamadas[2].claveSolicitud);
  expect(llamadas[0].claveSolicitud).toBe(llamadas[3].claveSolicitud);
  expect(llamadas[0].timeoutMs).toBe(120000);
  expect(llamadas[1].timeoutMs).toBe(300000);
  expect(llamadas[0].commonLine).toEqual(problema.configuracion.commonLine);
});

it('materializa inmediatamente un SVG con el resultado persistido sin quedar atado al análisis anterior', async () => {
  const cache = new GeometriaVectorialCacheService();
  const guardar = jest.spyOn(cache, 'guardarCompartido').mockResolvedValue();
  const leerL2 = jest.spyOn(cache, 'obtenerCompartido').mockResolvedValue(null);
  const crear = jest.fn(({ dto }: { dto: CrearTrabajoNestingOpenNestDto }) =>
    Promise.resolve({
      estado: 'completado',
      resultado: resolverNestingBaseSeguro({
        schemaVersion: 1,
        tenantId: 'tenant',
        solicitadoEl: '',
        correlationId: '',
        ...dto,
        motor: dto.motor ?? 'collision',
        semilla: dto.semilla ?? 30,
        timeoutMs: dto.timeoutMs ?? 120000,
        piezas: dto.piezas.map((p) => ({
          ...p,
          huecos: p.huecos?.map((h) => h.puntos),
        })),
      }),
    }),
  );
  const service = new AnalisisVectorialAsyncService(
    { crear, crearParaCotizacion: crear } as unknown as GeometriaJobsService,
    cache,
    {
      exigirTodas: jest.fn().mockResolvedValue(undefined),
      exigir: jest.fn().mockResolvedValue(undefined),
    } as never,
  );
  const vista = await conPreparacionNesting(() =>
    service.iniciar({
      tenantId: 'tenant',
      dto: {
        nombreArchivo: 'prueba.svg',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0H100V100H0Z"/></svg>',
        anchoFinalMm: 100,
        cantidad: 2,
        anchoPlacaMm: 300,
        altoPlacaMm: 300,
      },
    }),
  );
  expect(vista.estado).toBe('completado');
  expect(vista.resultado?.solucionNesting.resultado.piezasOriginales).toBe(2);
  expect(crear.mock.calls[0][0].dto.timeoutMs).toBe(300000);
  expect(guardar).toHaveBeenCalledTimes(1);
  expect(leerL2).not.toHaveBeenCalled();
});

it.each(['fallido', 'cancelado', 'timeout'])(
  'distingue un cálculo %s de una pieza que no entra, para SVG y colecciones',
  async (estado) => {
    const vista = {
      id: 'nest-fallido',
      estado: estado === 'cancelado' ? 'cancelado' : 'fallido',
      error:
        estado === 'cancelado'
          ? undefined
          : {
              codigo: estado === 'timeout' ? 'TIMEOUT' : 'CALCULO_FALLIDO',
              mensaje: 'No se pudo completar el nesting irregular.',
            },
    };
    const service = new AnalisisVectorialAsyncService(
      {
        crear: jest.fn().mockResolvedValue(vista),
        crearParaCotizacion: jest.fn().mockResolvedValue(vista),
      } as unknown as GeometriaJobsService,
      {} as GeometriaVectorialCacheService,
      {
        exigirTodas: jest.fn().mockResolvedValue(undefined),
        exigir: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
    jest
      .spyOn(
        service as unknown as {
          calcular(input: unknown, interno: boolean): Promise<unknown>;
        },
        'calcular',
      )
      .mockResolvedValue(vista);
    const problema: ProblemaNesting = {
      schemaVersion: 1,
      superficie: { tipo: 'PLACA', anchoMm: 500, altoMm: 500 },
      demandas: [
        {
          schemaVersion: 1,
          id: 'pieza',
          cantidad: 2,
          geometria: { tipo: 'RECTANGULO', anchoMm: 100, altoMm: 80 },
        },
      ],
      configuracion: {
        margenMm: 5,
        separacionMm: 5,
        permitirRotacion: true,
        permitirSegmentacion: false,
        preservarComposicionOriginalSiEntra: false,
      },
    };
    const codigo = `nesting_calculo_${estado === 'timeout' ? 'tiempo_agotado' : estado}`;
    for (const resolver of [
      () =>
        service.resolverProblemaParaCotizacion({
          tenantId: 'tenant',
          problema,
        }),
      () =>
        service.resolverParaCotizacion({
          tenantId: 'tenant',
          dto: {} as never,
        }),
    ]) {
      const error = await resolver().catch((e) => e);
      expect(error).toBeInstanceOf(MotorCotizacionError);
      expect(error).not.toBeInstanceOf(NestingIrregularError);
      expect(error.toErrorMotor()).toMatchObject({
        codigo,
        severidad: 'ERROR',
        sugerencia: expect.stringContaining('Reintentá'),
      });
    }
  },
);
