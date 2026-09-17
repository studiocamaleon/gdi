import type { PrismaService } from '../../prisma/prisma.service';
import type { NestingIrregularOpenNestData } from '../colas';
import { NestingsGuardadosService } from './nestings-guardados.service';
import { resolverNestingBaseSeguro } from './nesting-base-seguro';
import { OpenNestService } from './opennest.service';
import { GeometriaJobsService } from './geometria-jobs.service';
import type { ControlTrabajosGeometriaService } from '../control-trabajos-geometria.service';
import type { CapacidadGeometriaService } from './capacidad-geometria.service';

const input: NestingIrregularOpenNestData = {
  schemaVersion: 1,
  tenantId: 'empresa',
  correlationId: 'calculo',
  solicitadoEl: '',
  motor: 'collision',
  semilla: 30,
  timeoutMs: 120000,
  separacionMm: 5,
  placa: { anchoMm: 500, altoMm: 500, margenMm: 5, maxPlacas: 10 },
  piezas: [
    {
      id: 'pieza',
      cantidad: 5,
      rotaciones: 4,
      contorno: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 80 },
        { x: 0, y: 80 },
      ],
    },
  ],
};

function repositorio() {
  const servicio = new NestingsGuardadosService({} as PrismaService);
  jest.spyOn(servicio, 'obtenerCheckpoint').mockResolvedValue(null);
  jest.spyOn(servicio, 'guardarCheckpoint').mockResolvedValue();
  const guardar = jest
    .spyOn(servicio, 'guardar')
    .mockRejectedValue(new Error('Transaction already closed'));
  const obtener = jest.spyOn(servicio, 'obtener').mockResolvedValue(null);
  return { servicio, guardar, obtener };
}

it('devuelve el nesting validado aunque fallen tanto el guardado como su relectura', async () => {
  const { servicio, obtener } = repositorio();
  obtener.mockRejectedValue(new Error('Base temporalmente no disponible'));
  const resultado = resolverNestingBaseSeguro(input);
  const conservado = await servicio.conservarResultado(input, resultado);
  expect(conservado.placements).toEqual(resultado.placements);
  expect(conservado.cantidadColocada).toBe(5);
});

it.each([false, true])(
  'conserva la mejor geometría ante un commit ambiguo (cache mejor: %s)',
  async (cacheMejor) => {
    const { servicio, obtener } = repositorio();
    const mejor = resolverNestingBaseSeguro(input);
    const peor = {
      ...mejor,
      placasUsadas: 5,
      placements: mejor.placements.map((p, placa) => ({ ...p, placa })),
    };
    obtener.mockResolvedValue(cacheMejor ? mejor : peor);
    const conservado = await servicio.conservarResultado(
      input,
      cacheMejor ? peor : mejor,
    );
    expect(conservado.placasUsadas).toBe(1);
    expect(conservado.placements).toEqual(mejor.placements);
  },
);

it('rechaza piezas faltantes antes de tolerar cualquier fallo de persistencia', async () => {
  const { servicio, guardar } = repositorio();
  const resultado = resolverNestingBaseSeguro(input);
  await expect(
    servicio.conservarResultado(input, {
      ...resultado,
      placements: resultado.placements.slice(1),
    }),
  ).rejects.toThrow();
  expect(guardar).not.toHaveBeenCalled();
});

it('el worker finaliza con éxito aunque no pueda guardar el nesting calculado', async () => {
  const { servicio, guardar } = repositorio();
  const resultado = await new OpenNestService(servicio).resolver(input);
  expect(resultado.placasUsadas).toBe(1);
  expect(resultado.cantidadColocada).toBe(5);
  expect(guardar).toHaveBeenCalled();
});

it('el API entrega el resultado completado de Redis aunque falle el guardado durable', async () => {
  const { servicio } = repositorio();
  const resultado = resolverNestingBaseSeguro(input);
  const job = {
    id: 'nest-00000000-0000-0000-0000-000000000001',
    data: input,
    returnvalue: resultado,
    timestamp: Date.now(),
    progress: 100,
    getState: async () => 'completed',
  };
  const jobs = new GeometriaJobsService(
    {
      leerCancelacion: jest.fn().mockResolvedValue(null),
    } as unknown as ControlTrabajosGeometriaService,
    {
      cancelar: jest.fn().mockResolvedValue(undefined),
    } as unknown as CapacidadGeometriaService,
    servicio,
  );
  jest
    .spyOn(jobs as unknown as { buscarJob(): unknown }, 'buscarJob')
    .mockResolvedValue(job as never);
  const vista = await jobs.consultar(input.tenantId, job.id);
  expect(vista.estado).toBe('completado');
  expect(vista.resultado?.placements).toEqual(resultado.placements);
});
