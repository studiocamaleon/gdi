import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ControlTrabajosGeometriaService } from '../control-trabajos-geometria.service';
import type { CapacidadGeometriaService } from './capacidad-geometria.service';
import {
  VERSION_POLITICA_BUSQUEDA_GRAFONEST,
  VERSION_POLITICA_ORIENTACION_GRAFONEST,
  type NestingIrregularOpenNestData,
} from '../colas';
import { BibliotecaPatronesService } from './biblioteca-patrones.service';
import { materializarPatrones, type Patron } from './cartera-patrones';
import { contarPatronesResultado } from './calidad-nesting';
import { GeometriaJobsService } from './geometria-jobs.service';
import {
  NestingsGuardadosService,
  satisfaceBusqueda,
} from './nestings-guardados.service';
import { OpenNestService } from './opennest.service';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';

function entrada(tenantId: string, cantidad = 4): NestingIrregularOpenNestData {
  return {
    schemaVersion: 1,
    tenantId,
    correlationId: randomUUID(),
    solicitadoEl: new Date().toISOString(),
    motor: 'collision',
    semilla: 1,
    timeoutMs: 120000,
    separacionMm: 5,
    placa: { anchoMm: 500, altoMm: 100, margenMm: 5, maxPlacas: 30 },
    piezas: [80, 70].map((ancho, i) => ({
      id: `pieza-${i}`,
      cantidad,
      rotaciones: 1,
      contorno: [
        { x: 0, y: 0 },
        { x: ancho, y: 0 },
        { x: ancho, y: 60 },
        { x: 0, y: 60 },
      ],
    })),
  };
}

function patron(input: NestingIrregularOpenNestData, counts: number[]): Patron {
  let index = 0;
  return {
    counts,
    origen: 'fixture',
    placements: counts.flatMap((cantidad, tipo) =>
      Array.from({ length: cantidad }, () => ({
        pieceId: input.piezas[tipo].id,
        xMm: 5 + 90 * index++,
        yMm: 5,
        widthMm: input.piezas[tipo].contorno[1].x,
        heightMm: 60,
        rotated: false,
      })),
    ),
  };
}

function resultado(
  input: NestingIrregularOpenNestData,
  patrones: Patron[],
  repeticiones: number[],
) {
  return {
    ...validarResultadoNestingOpenNest(
      input,
      materializarPatrones(input, patrones, {
        seleccion: repeticiones.map((n, patron) => ({
          patron,
          repeticiones: n,
        })),
        optimoPlacasDentroCartera: false,
        optimoPatronesDentroCartera: false,
      }),
    ),
    versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
    versionPoliticaBusqueda: VERSION_POLITICA_BUSQUEDA_GRAFONEST,
    presupuestoExploradoMs: 120000,
    busqueda: {
      motivoFin: 'PRESUPUESTO_AGOTADO' as const,
      presupuestoMs: 120000,
      intentos: 1,
      candidatosValidos: 1,
      minimoTeoricoPlacas: 1,
    },
  };
}

describe('reutilización exacta consulta lo aprendido con otras cantidades', () => {
  const db = new PrismaClient();
  const guardados = new NestingsGuardadosService(db as PrismaService);
  const biblioteca = new BibliotecaPatronesService(db as PrismaService);
  let tenantId: string;
  beforeEach(async () => {
    tenantId = randomUUID();
    await db.tenant.create({
      data: {
        id: tenantId,
        nombre: 'Reutilización entre cantidades',
        slug: tenantId,
      },
    });
  });
  afterEach(async () => {
    await db.tenant.delete({ where: { id: tenantId } });
  });
  afterAll(() => db.$disconnect());

  async function prepararMejora() {
    const chica = entrada(tenantId),
      grande = entrada(tenantId, 8);
    const previo = resultado(chica, [patron(chica, [1, 1])], [4]);
    await guardados.guardar(chica, previo);
    // El doble de demanda enseña dos patrones cuya mitad requiere menos placas,
    // aunque aumente la cantidad de patrones respecto del guardado de la chica.
    await biblioteca.aprender(
      grande,
      resultado(
        grande,
        [patron(grande, [4, 0]), patron(grande, [0, 4])],
        [2, 2],
      ),
    );
    return { chica, previo };
  }

  it.each(['api', 'worker'])(
    'mejora y persiste desde %s sin cola ni solver',
    async (via) => {
      const { chica, previo } = await prepararMejora();
      const input = {
        ...chica,
        piezas: chica.piezas
          .map((p) => ({ ...p, id: `renombrada-${p.id}` }))
          .reverse(),
      };
      let r;
      if (via === 'api') {
        const registrar = jest.fn();
        const service = new GeometriaJobsService(
          {} as ControlTrabajosGeometriaService,
          { registrar } as unknown as CapacidadGeometriaService,
          { exigirTodas: jest.fn().mockResolvedValue(undefined), exigir: jest.fn().mockResolvedValue(undefined) } as never, guardados,
          biblioteca,
        );
        const vista = await service.crear({
          tenantId,
          dto: {
            ...input,
            piezas: input.piezas.map((p) => ({ ...p, huecos: undefined })),
          },
        });
        expect(vista.estado).toBe('completado');
        expect(registrar).not.toHaveBeenCalled();
        r = vista.resultado!;
      } else {
        const service = new OpenNestService(guardados, biblioteca);
        const spies = [
          'ejecutarRunner',
          'ejecutarSelector',
          'ejecutarPackingSolver',
        ].map((metodo) =>
          jest
            .spyOn(
              service as unknown as Record<string, () => Promise<never>>,
              metodo,
            )
            .mockRejectedValue(new Error('No debe arrancar procesos')),
        );
        r = await service.resolver(input);
        spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
      }
      expect(r.placasUsadas).toBe(2);
      expect(contarPatronesResultado(r)).toBe(2);
      expect(r.cantidadColocada).toBe(8);
      expect(r.origenSolucion?.etapa).toBe('biblioteca');
      expect(r.versionPoliticaBusqueda).toBe(previo.versionPoliticaBusqueda);
      expect(r.presupuestoExploradoMs).toBe(previo.presupuestoExploradoMs);
      expect(r.busqueda).toEqual(previo.busqueda);
      expect(
        satisfaceBusqueda(
          { ...input, buscarMejora: true, timeoutMs: 300000 },
          r,
        ),
      ).toBe(false);
      const persistido = await new NestingsGuardadosService(
        db as PrismaService,
      ).obtener(input);
      expect(persistido?.placasUsadas).toBe(2);
      expect(contarPatronesResultado(persistido!)).toBe(2);
      validarResultadoNestingOpenNest(input, persistido!);
    },
  );

  it('con igual cantidad de placas reduce patrones y después conserva al ganador', async () => {
    const chica = entrada(tenantId),
      grande = entrada(tenantId, 8);
    await guardados.guardar(
      chica,
      resultado(chica, [patron(chica, [4, 0]), patron(chica, [0, 4])], [1, 1]),
    );
    await biblioteca.aprender(
      grande,
      resultado(grande, [patron(grande, [2, 2])], [4]),
    );
    const mejorado = await guardados.obtener(chica, { biblioteca });
    expect(mejorado?.placasUsadas).toBe(2);
    expect(contarPatronesResultado(mejorado!)).toBe(1);
    // Aprender después algo peor no puede degradar el resultado exacto.
    await biblioteca.aprender(
      grande,
      resultado(grande, [patron(grande, [1, 1])], [8]),
    );
    expect(await guardados.obtener(chica, { biblioteca })).toEqual(mejorado);
  });

  it('no redondea repeticiones fraccionarias ni reutiliza otra configuración o cuenta', async () => {
    const chica = entrada(tenantId),
      otraCantidad = entrada(tenantId, 3);
    const previo = resultado(chica, [patron(chica, [1, 1])], [4]);
    await guardados.guardar(chica, previo);
    await biblioteca.aprender(
      otraCantidad,
      resultado(
        otraCantidad,
        [patron(otraCantidad, [2, 2]), patron(otraCantidad, [1, 1])],
        [1, 1],
      ),
    );
    expect((await biblioteca.obtenerFamilia(chica)).planes).toEqual([]);
    expect((await guardados.obtener(chica, { biblioteca }))?.placasUsadas).toBe(
      4,
    );
    expect(
      await guardados.obtener({ ...chica, separacionMm: 6 }, { biblioteca }),
    ).toBeNull();
    expect(
      await guardados.obtener(
        { ...chica, tenantId: randomUUID() },
        { biblioteca },
      ),
    ).toBeNull();
  });

  it('mantiene la cotización disponible si no se puede leer la biblioteca', async () => {
    const { chica } = await prepararMejora();
    const leer = jest
      .spyOn(biblioteca, 'obtenerFamilia')
      .mockRejectedValueOnce(
        new Error('Biblioteca temporalmente no disponible'),
      );
    const r = await guardados.obtener(chica, { biblioteca });
    expect(r?.placasUsadas).toBe(4);
    leer.mockRestore();
  });

  it('descarta una combinación inválida y sigue comprobando las demás', async () => {
    const { chica } = await prepararMejora();
    const familia = await biblioteca.obtenerFamilia(chica);
    const plan = familia.planes[0];
    const leer = jest
      .spyOn(biblioteca, 'obtenerFamilia')
      .mockResolvedValueOnce({
        ...familia,
        planes: [{ ...plan, seleccion: plan.seleccion.slice(1) }, plan],
      });
    const r = await guardados.obtener(chica, { biblioteca });
    expect(r?.placasUsadas).toBe(2);
    expect(r?.cantidadColocada).toBe(8);
    leer.mockRestore();
  });

  it('respeta cancelación antes de publicar la mejora', async () => {
    const { chica } = await prepararMejora();
    const familia = await biblioteca.obtenerFamilia(chica);
    const abort = new AbortController();
    const leer = jest
      .spyOn(biblioteca, 'obtenerFamilia')
      .mockImplementationOnce(async () => {
        abort.abort();
        return familia;
      });
    await expect(
      guardados.obtener(chica, { biblioteca, signal: abort.signal }),
    ).rejects.toThrow();
    expect((await guardados.obtener(chica))?.placasUsadas).toBe(4);
    leer.mockRestore();
  });

  it('deja la comparación de una preparación pendiente en el flujo de búsqueda', async () => {
    const { chica } = await prepararMejora();
    const leer = jest.spyOn(biblioteca, 'obtenerFamilia');
    const r = await guardados.obtener(
      { ...chica, buscarMejora: true, timeoutMs: 300000 },
      { biblioteca },
    );
    expect(r?.placasUsadas).toBe(4);
    expect(leer).not.toHaveBeenCalled();
    leer.mockRestore();
  });
});
