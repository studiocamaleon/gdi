import type { NestingIrregularOpenNestData } from '../colas';
import {
  clasificarTrabajoGeometria,
  idTrabajo,
  GeometriaJobsService,
} from './geometria-jobs.service';
import { NestingsGuardadosService } from './nestings-guardados.service';
import { ControlTrabajosGeometriaService } from '../control-trabajos-geometria.service';
import { resolverNestingBaseSeguro } from './nesting-base-seguro';
import { conPreparacionNesting } from './politica-busqueda';
import type { CapacidadGeometriaService } from './capacidad-geometria.service';

const capacidad = () =>
  ({
    registrar: jest.fn().mockResolvedValue(undefined),
    confirmar: jest.fn().mockResolvedValue(undefined),
    cancelar: jest.fn().mockResolvedValue(undefined),
  }) as unknown as CapacidadGeometriaService;

function entrada(cantidad: number, tipos = 1): NestingIrregularOpenNestData {
  return {
    schemaVersion: 1,
    tenantId: 'tenant-prueba',
    correlationId: 'correlacion-prueba',
    solicitadoEl: '2026-09-04T00:00:00.000Z',
    motor: 'collision',
    placa: { anchoMm: 1_600, altoMm: 2_440, margenMm: 5, maxPlacas: 100 },
    separacionMm: 5,
    timeoutMs: 30_000,
    semilla: 7,
    piezas: Array.from({ length: tipos }, (_, index) => ({
      id: `pieza-${index}`,
      cantidad,
      rotaciones: 4,
      contorno: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 80 },
        { x: 0, y: 80 },
      ],
    })),
  };
}

describe('planificador de trabajos de geometría', () => {
  it('separa los trabajos interactivos de los intensivos', () => {
    expect(clasificarTrabajoGeometria(entrada(5)).clase).toBe('RAPIDA');
    expect(clasificarTrabajoGeometria(entrada(70)).clase).toBe('ESTANDAR');
    expect(clasificarTrabajoGeometria(entrada(220)).clase).toBe('INTENSIVA');
  });

  it('genera el mismo id para la misma pantalla e input cotizable', () => {
    const data = entrada(5);
    expect(idTrabajo('tenant-prueba', 'sheet-prueba', data)).toBe(
      idTrabajo('tenant-prueba', 'sheet-prueba', {
        ...data,
        correlationId: 'otra-correlacion',
        solicitadoEl: new Date().toISOString(),
      }),
    );
  });

  it('el sheet recupera un resultado de cinco minutos sin esperar turno de worker', async () => {
    const data = entrada(5);
    const resultado = {
      ...resolverNestingBaseSeguro(data),
      presupuestoExploradoMs: 300000,
    };
    const obtener = jest.fn().mockResolvedValue(resultado);
    const service = new GeometriaJobsService(
      {} as ControlTrabajosGeometriaService,
      capacidad(),
      { exigirTodas: jest.fn().mockResolvedValue(undefined), exigir: jest.fn().mockResolvedValue(undefined) } as never, { obtener } as unknown as NestingsGuardadosService,
    );
    const vista = await service.crear({
      tenantId: data.tenantId,
      dto: {
        ...data,
        piezas: data.piezas.map((p) => ({ ...p, huecos: undefined })),
      },
    });
    expect(vista.estado).toBe('completado');
    expect(vista.resultado).toBe(resultado);
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it('encola la ampliación de dos a cinco minutos con un scope independiente del sheet', async () => {
    const data = entrada(5);
    const obtener = jest.fn().mockResolvedValue({
      ...resolverNestingBaseSeguro(data),
      presupuestoExploradoMs: 120000,
    });
    const activarScope = jest.fn().mockResolvedValue(null);
    const service = new GeometriaJobsService(
      {
        leerCancelacion: jest.fn().mockResolvedValue(null),
        activarScope,
      } as unknown as ControlTrabajosGeometriaService,
      capacidad(),
      { exigirTodas: jest.fn().mockResolvedValue(undefined), exigir: jest.fn().mockResolvedValue(undefined) } as never, { obtener } as unknown as NestingsGuardadosService,
    );
    const job = {
      id: 'nest-test',
      timestamp: Date.now(),
      data,
      getState: () => Promise.resolve('waiting'),
    };
    const add = jest
      .fn<
        Promise<typeof job>,
        [string, NestingIrregularOpenNestData, unknown]
      >()
      .mockResolvedValue(job);
    jest
      .spyOn(service as never as { getQueue(): unknown }, 'getQueue')
      .mockReturnValue({ add, getJob: () => Promise.resolve(job) });
    await conPreparacionNesting(() =>
      service.crear({
        tenantId: data.tenantId,
        dto: {
          ...data,
          timeoutMs: undefined,
          claveSolicitud: 'sheet',
          piezas: data.piezas.map((p) => ({ ...p, huecos: undefined })),
        },
      }),
    );
    expect(add.mock.calls[0][1]).toMatchObject({
      timeoutMs: 300000,
      buscarMejora: true,
    });
    expect(activarScope).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'sheet-preparacion-300000' }),
    );
  });
});

it('permite reintentar desde el sheet un trabajo que había fallado, compartiendo el mismo id', async () => {
  const data = entrada(5);
  const service = new GeometriaJobsService(
    {
      leerCancelacion: jest.fn().mockResolvedValue(null),
    } as unknown as ControlTrabajosGeometriaService,
    capacidad(),
    { exigirTodas: jest.fn().mockResolvedValue(undefined), exigir: jest.fn().mockResolvedValue(undefined) } as never, {
      obtener: jest.fn().mockResolvedValue(null),
    } as unknown as NestingsGuardadosService,
  );
  let estado = 'failed';
  const retry = jest.fn().mockImplementation(async () => {
    estado = 'waiting';
  });
  const job = {
    id: 'nest-test',
    timestamp: Date.now(),
    data,
    retry,
    getState: async () => estado,
  };
  jest
    .spyOn(service as unknown as { getQueue(): unknown }, 'getQueue')
    .mockReturnValue({ add: async () => job, getJob: async () => job });
  const vista = await service.crear({
    tenantId: data.tenantId,
    dto: {
      ...data,
      piezas: data.piezas.map((p) => ({ ...p, huecos: undefined })),
    },
  });
  expect(retry).toHaveBeenCalledWith('failed');
  expect(vista.estado).toBe('pendiente');
  expect(vista.error).toBeUndefined();
});
