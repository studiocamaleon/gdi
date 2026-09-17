import { OpenNestService, OpenNestSubprocessError } from './opennest.service';
import * as packing from './packingsolver';
import * as patrones from './cartera-patrones';
import type { NestingIrregularOpenNestData } from '../colas';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';

describe('portafolio nativo integrado en GrafoNest', () => {
  let now = 0;
  const input: NestingIrregularOpenNestData = {
    schemaVersion: 1,
    tenantId: 'test',
    correlationId: 'test',
    solicitadoEl: '2026-09-09',
    motor: 'collision',
    semilla: 7,
    timeoutMs: 20000,
    separacionMm: 0,
    placa: { anchoMm: 100, altoMm: 100, margenMm: 0, maxPlacas: 2 },
    piezas: ['a', 'b'].map((id) => ({
      id,
      cantidad: 1,
      rotaciones: 4,
      contorno: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ],
    })),
  };
  const certificado = (): packing.CertificadoPackingSolver => ({
    duracionMs: 10,
    certificado: {
      bins: [
        {
          copies: 1,
          items: [
            { id: 0, x: 0, y: 0, angle: 0 },
            { id: 1, x: 100, y: 100, angle: 180 },
          ],
        },
      ],
    },
  });
  beforeEach(() => {
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.spyOn(packing, 'configuracionPackingSolver').mockReturnValue({
      ejecutable: 'test',
      version: 'packingsolver:fixture',
      memoriaMb: 64,
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('conserva un candidato antes del timeout y para al demostrar ambos mínimos', async () => {
    let giro: number | undefined;
    class Service extends OpenNestService {
      protected async ejecutarPackingSolver(
        options: Parameters<OpenNestService['ejecutarPackingSolver']>[0],
      ) {
        giro = (
          options.entrada as {
            instancia: ReturnType<typeof packing.instanciaPackingSolver>;
          }
        ).instancia.item_types[0].allowed_rotations.length;
        now = 200;
        options.onCandidate?.(certificado());
        expect(options.signal?.aborted).toBe(true);
        options.onExit?.({
          codigo: 0,
          signal: null,
          stderr: JSON.stringify({
            motor: 'packingsolver',
            fin: 'cancelado',
            rssObservadoMb: 40,
          }),
        });
        throw new OpenNestSubprocessError('Fin externo', 'TIMEOUT');
      }
      protected ejecutarRunner(): Promise<never> {
        throw new Error('No debe volver a optimizar un mínimo demostrado');
      }
    }
    const r = await new Service().resolver(input);
    expect(giro).toBe(4);
    expect(r).toMatchObject({
      placasUsadas: 1,
      motorEjecutor: 'packingsolver',
      algoritmo: 'grafonest-packingsolver-v1',
      busqueda: {
        motivoFin: 'MINIMO_PLACAS',
        motoresExplorados: ['packingsolver'],
        recursosNativos: [{ rssMaxObservadoMb: 40 }],
      },
    });
    expect(() => validarResultadoNestingOpenNest(input, r)).not.toThrow();
  });

  it('descarta un candidato fuera de placa y conserva una base completa', async () => {
    class Service extends OpenNestService {
      protected async ejecutarPackingSolver(
        options: Parameters<OpenNestService['ejecutarPackingSolver']>[0],
      ) {
        now = input.timeoutMs;
        const c = certificado();
        c.certificado.bins[0].items[0].x = -1;
        options.onCandidate?.(c);
        return c;
      }
    }
    const r = await new Service().resolver(input);
    expect(r.placasUsadas).toBe(2);
    expect(r.busqueda?.descartes?.resultadoInvalido).toBe(1);
    expect(() => validarResultadoNestingOpenNest(input, r)).not.toThrow();
  });

  it('sigue con el motor existente si el alternativo no puede iniciarse', async () => {
    let llamadas = 0;
    class Service extends OpenNestService {
      protected async ejecutarPackingSolver(): Promise<never> {
        now += 1000;
        throw new Error('No disponible');
      }
      protected async ejecutarRunner(): Promise<never> {
        llamadas++;
        now += 5000;
        throw new Error('Sin mejora');
      }
    }
    const r = await new Service().resolver(input);
    expect(llamadas).toBeGreaterThan(0);
    expect(r.placasUsadas).toBe(2);
  });

  it('reserva tiempo para generar patrones después de una fase nativa larga', async () => {
    const lote = {
      ...input,
      timeoutMs: 120000,
      placa: { ...input.placa, maxPlacas: 30 },
      piezas: input.piezas.map((p) => ({ ...p, cantidad: 10 })),
    };
    const generacion = jest
      .spyOn(patrones, 'generarCarteraPatrones')
      .mockImplementation(async (_input, options) => {
        expect(now).toBe(40000);
        expect(options.plazo).toBe(46000);
        // La ampliación debe poder representar el plan que ya tenemos.
        expect(options.semillas?.length).toBeGreaterThan(0);
        expect(new Set(options.semillas!.flatMap((p) => p.placements.map((x) => x.pieceId))))
          .toEqual(new Set(lote.piezas.map((p) => p.id)));
        return [];
      });
    class Service extends OpenNestService {
      protected async ejecutarPackingSolver(): Promise<never> {
        now = 40000;
        throw new OpenNestSubprocessError('Plazo nativo', 'TIMEOUT');
      }
      protected async ejecutarRunner(): Promise<never> {
        now = 120000;
        throw new OpenNestSubprocessError('Plazo global', 'TIMEOUT');
      }
    }
    const r = await new Service().resolver(lote);
    expect(generacion).toHaveBeenCalledTimes(1);
    expect(r.cantidadColocada).toBe(20);
  });
});
