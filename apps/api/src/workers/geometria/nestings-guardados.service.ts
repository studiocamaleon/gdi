import { Injectable, Logger, Module } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { BibliotecaPatronesService } from './biblioteca-patrones.service';
import { materializarPatrones } from './cartera-patrones';
import { compactarCheckpoint, restaurarCheckpoint } from './checkpoint-poses';
import {
  VERSION_POLITICA_ORIENTACION_GRAFONEST,
  VERSION_POLITICA_BUSQUEDA_GRAFONEST,
  type NestingIrregularOpenNestData,
  type NestingIrregularOpenNestResult,
} from '../colas';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';
import {
  esMejorResultado,
  contarPatronesResultado,
  minimoTeoricoPatrones,
} from './calidad-nesting';
import {
  OPENNEST_PRESUPUESTO_DEFAULT_MS,
  timeoutMaximoOpenNestMs,
} from './politica-busqueda';
import { presupuestoPackingSolver } from './packingsolver';

/** Excluye identidad comercial y semilla; conserva todas las restricciones del solver. */
export function firmaNesting(
  input: NestingIrregularOpenNestData,
  version: 1 | 2 = 2,
) {
  const piezas = input.piezas
    .map(({ id, ...geometria }) => ({
      id,
      geometria,
      firma: JSON.stringify(geometria),
    }))
    .sort((a, b) => a.firma.localeCompare(b.firma) || a.id.localeCompare(b.id));
  const ids = new Map(piezas.map((p, i) => [p.id, `pieza-${i}`]));
  const clave = createHash('sha256')
    .update(
      JSON.stringify({
        version,
        politica: VERSION_POLITICA_ORIENTACION_GRAFONEST,
        motor: input.motor,
        ...(version === 1
          ? {
              presupuestoMs: Math.min(
                input.timeoutMs,
                timeoutMaximoOpenNestMs(),
              ),
            }
          : {}),
        placa: input.placa,
        separacionMm: input.separacionMm,
        commonLine: input.commonLine,
        piezas: piezas.map((p) => p.geometria),
      }),
    )
    .digest('hex');
  return { clave, ids };
}

export function presupuestoExplorado(
  resultado: NestingIrregularOpenNestResult,
): number {
  if (
    resultado.busqueda?.motivoFin === 'MOTOR_NO_DISPONIBLE' ||
    resultado.busqueda?.motivoFin === 'PLAN_REUTILIZADO'
  )
    return resultado.presupuestoExploradoMs ?? 0;
  return Math.max(
    resultado.presupuestoExploradoMs ?? 0,
    resultado.busqueda?.presupuestoMs ?? 0,
  );
}

export function satisfaceBusqueda(
  input: NestingIrregularOpenNestData,
  resultado: NestingIrregularOpenNestResult,
): boolean {
  return (
    !input.buscarMejora ||
    (resultado.versionPoliticaBusqueda ===
      VERSION_POLITICA_BUSQUEDA_GRAFONEST &&
      ((resultado.busqueda?.motivoFin === 'MINIMO_PLACAS' &&
        contarPatronesResultado(resultado) <=
          minimoTeoricoPatrones(input, resultado.placasUsadas)) ||
        (presupuestoExplorado(resultado) >=
          Math.min(input.timeoutMs, timeoutMaximoOpenNestMs()) &&
          (process.env.GRAFONEST_PACKINGSOLVER_ENABLED !== '1' ||
            presupuestoPackingSolver(
              input,
              Math.min(input.timeoutMs, timeoutMaximoOpenNestMs()),
            ) === 0 ||
            resultado.busqueda?.motoresExplorados?.includes('packingsolver') ===
              true))))
  );
}

export function remapearResultado(
  result: NestingIrregularOpenNestResult,
  ids: Map<string, string>,
): NestingIrregularOpenNestResult {
  const id = (value: string) => {
    const mapped = ids.get(value);
    if (!mapped)
      throw new Error('El nesting guardado contiene una pieza desconocida.');
    return mapped;
  };
  return {
    ...result,
    placements: result.placements.map((p) => ({
      ...p,
      piezaId: id(p.piezaId),
    })),
    ...(result.commonLine
      ? {
          commonLine: {
            ...result.commonLine,
            tramos: result.commonLine.tramos.map((t) => ({
              ...t,
              segmentosOrigen: t.segmentosOrigen.map((s) => ({
                ...s,
                piezaId: id(s.piezaId),
              })) as typeof t.segmentosOrigen,
            })),
          },
        }
      : {}),
  };
}

@Injectable()
export class NestingsGuardadosService {
  private readonly logger = new Logger(NestingsGuardadosService.name);
  constructor(private readonly db: PrismaService) {}

  async obtenerCheckpoint(
    input: NestingIrregularOpenNestData,
  ): Promise<NestingIrregularOpenNestResult | null> {
    const { clave, ids } = firmaNesting(input);
    const row = await this.db.nestingCheckpoint.findUnique({
      where: { tenantId_clave: { tenantId: input.tenantId, clave } },
    });
    if (!row) return null;
    try {
      const result = validarResultadoNestingOpenNest(
        input,
        remapearResultado(
          restaurarCheckpoint(entradaCanonica(input, ids), row.resultadoJson),
          new Map([...ids].map(([a, b]) => [b, a])),
        ),
      );
      this.logger.log({
        event: 'nesting_checkpoint_recuperado',
        tenantId: input.tenantId,
        clave,
        placas: result.placasUsadas,
        solicitudAnterior: row.solicitudId,
      });
      return result;
    } catch {
      this.logger.warn({
        event: 'nesting_checkpoint_invalido',
        tenantId: input.tenantId,
        clave,
      });
      await this.db.nestingCheckpoint.deleteMany({
        where: { tenantId: input.tenantId, clave, updatedAt: row.updatedAt },
      });
      return null;
    }
  }

  async guardarCheckpoint(
    input: NestingIrregularOpenNestData,
    resultado: NestingIrregularOpenNestResult,
  ): Promise<void> {
    const { clave, ids } = firmaNesting(input);
    const {
      busqueda: _busqueda,
      presupuestoExploradoMs: _presupuesto,
      ...candidato
    } = resultado;
    // Nunca atribuir a un avance una búsqueda finalizada ni un presupuesto
    // completo. Su geometría puede recuperarse; el esfuerzo debe continuar.
    const canonico = remapearResultado(
      validarResultadoNestingOpenNest(input, {
        ...candidato,
        presupuestoExploradoMs: 0,
        optimizacionAgotada: false,
        versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
      }),
      ids,
    );
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${input.tenantId + clave}, 0))`;
      const where = { tenantId_clave: { tenantId: input.tenantId, clave } };
      const final = await tx.nestingGuardado.findUnique({ where });
      const anterior = await tx.nestingCheckpoint.findUnique({ where });
      if (
        final &&
        !mejoraGeometrica(
          canonico,
          final.resultadoJson as unknown as NestingIrregularOpenNestResult,
        )
      )
        return;
      if (anterior) {
        try {
          if (
            !mejoraGeometrica(
              canonico,
              restaurarCheckpoint(
                entradaCanonica(input, ids),
                anterior.resultadoJson,
              ),
            )
          )
            return;
        } catch {
          this.logger.warn({
            event: 'nesting_checkpoint_reemplazado_invalido',
            tenantId: input.tenantId,
            clave,
          });
        }
      }
      const data = {
        resultadoJson: JSON.parse(
          JSON.stringify(compactarCheckpoint(canonico)),
        ) as Prisma.InputJsonValue,
        solicitudId: input.correlationId,
        transcurridoMs: Math.max(
          0,
          Math.min(2147483647, Math.round(resultado.duracionMs)),
        ),
      };
      await tx.nestingCheckpoint.upsert({
        where,
        create: { tenantId: input.tenantId, clave, ...data },
        update: data,
        select: { clave: true },
      });
      this.logger.log({
        event: 'nesting_checkpoint_guardado',
        tenantId: input.tenantId,
        clave,
        placas: canonico.placasUsadas,
        patrones: contarPatronesResultado(canonico),
      });
    });
  }

  async obtener(
    input: NestingIrregularOpenNestData,
    opciones?: {
      biblioteca?: BibliotecaPatronesService;
      signal?: AbortSignal;
    },
  ): Promise<NestingIrregularOpenNestResult | null> {
    opciones?.signal?.throwIfAborted();
    const { clave, ids } = firmaNesting(input);
    let row = await this.db.nestingGuardado.findUnique({
      where: { tenantId_clave: { tenantId: input.tenantId, clave } },
    });
    // Recupera también los cálculos de la primera versión, que separaba las
    // claves por duración. Se promueven sin volver a ejecutar el solver.
    if (!row) {
      const anteriores = [
        ...new Set([input.timeoutMs, OPENNEST_PRESUPUESTO_DEFAULT_MS]),
      ];
      for (const timeoutMs of anteriores) {
        row = await this.db.nestingGuardado.findUnique({
          where: {
            tenantId_clave: {
              tenantId: input.tenantId,
              clave: firmaNesting({ ...input, timeoutMs }, 1).clave,
            },
          },
        });
        if (row) break;
      }
    }
    if (!row) return null;
    let validado: NestingIrregularOpenNestResult;
    try {
      const resultado = remapearResultado(
        row.resultadoJson as unknown as NestingIrregularOpenNestResult,
        new Map([...ids].map(([a, b]) => [b, a])),
      );
      validado = validarResultadoNestingOpenNest(input, resultado);
    } catch {
      this.logger.warn({
        event: 'nesting_guardado_invalido',
        clave,
        tenantId: input.tenantId,
      });
      await this.db.nestingGuardado.deleteMany({
        where: {
          tenantId: input.tenantId,
          clave: row.clave,
          updatedAt: row.updatedAt,
        },
      });
      return null;
    }
    if (row.clave !== clave) await this.guardar(input, validado);
    // Un resultado exacto puede quedar superado al aprender otra cantidad.
    // Sólo probamos planes completos ya conocidos; no arrancamos un solver.
    // Una preparación que aún debe explorar consulta la biblioteca en buscar().
    if (opciones?.biblioteca && satisfaceBusqueda(input, validado)) {
      validado = await this.mejorarDesdeBiblioteca(
        input,
        validado,
        opciones.biblioteca,
        opciones.signal,
      );
    }
    this.logger.log({
      event: 'nesting_reutilizado',
      clave,
      tenantId: input.tenantId,
      placas: validado.placasUsadas,
    });
    return validado;
  }

  private async mejorarDesdeBiblioteca(
    input: NestingIrregularOpenNestData,
    actual: NestingIrregularOpenNestResult,
    biblioteca: BibliotecaPatronesService,
    signal?: AbortSignal,
  ): Promise<NestingIrregularOpenNestResult> {
    const inicio = Date.now();
    let mejor = actual;
    try {
      const familia = await biblioteca.obtenerFamilia(input);
      signal?.throwIfAborted();
      for (const seleccion of familia.planes) {
        signal?.throwIfAborted();
        const placas = seleccion.seleccion.reduce(
          (total, p) => total + p.repeticiones,
          0,
        );
        if (
          placas > mejor.placasUsadas ||
          (placas === mejor.placasUsadas &&
            seleccion.seleccion.length > contarPatronesResultado(mejor))
        )
          continue;
        try {
          const candidato = validarResultadoNestingOpenNest(
            input,
            materializarPatrones(input, familia.patrones, seleccion),
          );
          if (esMejorResultado(candidato, mejor)) mejor = candidato;
        } catch (error) {
          this.logger.warn({
            event: 'plan_biblioteca_descartado_al_reutilizar',
            tenantId: input.tenantId,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      signal?.throwIfAborted();
      if (mejor === actual) return actual;
      const actualizado: NestingIrregularOpenNestResult = {
        ...mejor,
        versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
        // La nueva geometría no acredita otra búsqueda ni más presupuesto.
        // El diagnóstico sigue describiendo la última búsqueda de esta demanda.
        versionPoliticaBusqueda: actual.versionPoliticaBusqueda,
        presupuestoExploradoMs: presupuestoExplorado(actual),
        busqueda: actual.busqueda,
        duracionMs: actual.duracionMs,
        origenSolucion: {
          etapa: 'biblioteca',
          encontradaEl: new Date().toISOString(),
          transcurridoMs: Date.now() - inicio,
        },
      };
      return await this.conservarResultado(input, actualizado);
    } catch (error) {
      signal?.throwIfAborted();
      this.logger.warn({
        event: 'biblioteca_no_disponible_al_reutilizar',
        tenantId: input.tenantId,
        message: error instanceof Error ? error.message : String(error),
      });
      return actual;
    }
  }

  /** La persistencia permite reutilizar el cálculo, pero su indisponibilidad
   * no invalida una solución completa que ya pasó las verificaciones geométricas. */
  async conservarResultado(
    input: NestingIrregularOpenNestData,
    resultado: NestingIrregularOpenNestResult,
  ): Promise<NestingIrregularOpenNestResult> {
    // Fuera del catch: nunca devolver una solución inválida como fallback.
    const candidato = validarResultadoNestingOpenNest(input, resultado);
    try {
      await this.guardar(input, candidato);
    } catch (error) {
      this.logger.warn({
        event: 'nesting_validado_no_persistido',
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    try {
      // Otra solicitud pudo mejorar el plan, o el commit pudo completarse aunque
      // se perdiera su confirmación. Recuperar el ganador sin repetir el solver.
      const persistido = await this.obtener(input);
      if (persistido && !esMejorResultado(candidato, persistido))
        return persistido;
    } catch (error) {
      this.logger.warn({
        event: 'nesting_validado_sin_relectura',
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return candidato;
  }

  async guardar(
    input: NestingIrregularOpenNestData,
    resultado: NestingIrregularOpenNestResult,
  ): Promise<void> {
    // Una indisponibilidad del motor no debe convertirse en el resultado permanente.
    if (
      (resultado.busqueda?.motivoFin === 'MOTOR_NO_DISPONIBLE' &&
        resultado.calidadSolucion !== 'OPTIMIZADA') ||
      resultado.versionPoliticaOrientacion !==
        VERSION_POLITICA_ORIENTACION_GRAFONEST
    )
      return;
    const { clave, ids } = firmaNesting(input);
    const canonico = remapearResultado(
      validarResultadoNestingOpenNest(input, resultado),
      ids,
    );
    await this.db.$transaction(
      async (tx) => {
        // Serializa sólo la escritura breve. No mantiene transacciones durante el nesting.
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${input.tenantId + clave}, 0))`;
        const where = { tenantId_clave: { tenantId: input.tenantId, clave } };
        const anterior = await tx.nestingGuardado.findUnique({ where });
        const previo = anterior?.resultadoJson as unknown as
          | NestingIrregularOpenNestResult
          | undefined;
        const mejor =
          previo && !esMejorResultado(canonico, previo) ? previo : canonico;
        const checkpoint = await tx.nestingCheckpoint.findUnique({ where });
        if (checkpoint) {
          let conservar = false;
          try {
            conservar = mejoraGeometrica(
              restaurarCheckpoint(
                entradaCanonica(input, ids),
                checkpoint.resultadoJson,
              ),
              mejor,
            );
          } catch {
            this.logger.warn({
              event: 'nesting_checkpoint_descartado_al_publicar',
              tenantId: input.tenantId,
              clave,
            });
          }
          if (!conservar) await tx.nestingCheckpoint.delete({ where });
        }
        const diagnostico =
          previo &&
          (previo.versionPoliticaBusqueda ?? 0) >
            (canonico.versionPoliticaBusqueda ?? 0)
            ? previo
            : canonico;
        const presupuestoExploradoMs = Math.max(
          presupuestoExplorado(diagnostico),
          previo &&
            previo.versionPoliticaBusqueda === canonico.versionPoliticaBusqueda
            ? presupuestoExplorado(previo)
            : 0,
        );
        if (
          mejor === previo &&
          presupuestoExploradoMs === previo.presupuestoExploradoMs &&
          diagnostico.versionPoliticaBusqueda ===
            previo.versionPoliticaBusqueda &&
          JSON.stringify(diagnostico.busqueda) ===
            JSON.stringify(previo.busqueda)
        )
          return;
        const resultadoJson = JSON.parse(
          JSON.stringify({
            ...mejor,
            presupuestoExploradoMs,
            versionPoliticaBusqueda: diagnostico.versionPoliticaBusqueda,
            // Diagnóstico de la última búsqueda, aunque gane una geometría anterior.
            ...(diagnostico.busqueda
              ? {
                  busqueda: diagnostico.busqueda,
                  duracionMs: diagnostico.duracionMs,
                }
              : {}),
          }),
        ) as Prisma.InputJsonValue;
        await tx.nestingGuardado.upsert({
          where,
          create: { tenantId: input.tenantId, clave, resultadoJson },
          update: { resultadoJson },
          // El JSON puede contener miles de piezas; no volver a transferirlo
          // desde Postgres como respuesta de una escritura cuyo valor no usamos.
          select: { clave: true },
        });
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  }
}

/** Para durabilidad interesa una mejora del acomodo, no el desempate de
 * etiqueta BASE_SEGURA utilizado al comparar candidatos de distintos motores. */
function mejoraGeometrica(
  candidato: NestingIrregularOpenNestResult,
  actual: NestingIrregularOpenNestResult,
): boolean {
  return esMejorResultado(
    { ...candidato, calidadSolucion: 'OPTIMIZADA' },
    { ...actual, calidadSolucion: 'OPTIMIZADA' },
  );
}

function entradaCanonica(
  input: NestingIrregularOpenNestData,
  ids: Map<string, string>,
): NestingIrregularOpenNestData {
  return {
    ...input,
    piezas: input.piezas.map((p) => ({ ...p, id: ids.get(p.id)! })),
  };
}

@Module({
  imports: [PrismaModule],
  providers: [NestingsGuardadosService, BibliotecaPatronesService],
  exports: [NestingsGuardadosService, BibliotecaPatronesService],
})
export class NestingsGuardadosModule {}
