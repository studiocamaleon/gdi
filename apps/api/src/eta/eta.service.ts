import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProduccionService } from '../produccion/produccion.service';
import { descomponerCiclo, resumirPrecision } from './metricas';
import type { Estacion } from './motor/estaciones-tipos';
import {
  simularFlujo,
  type ResultadoSimulacion,
} from './motor/flujo-produccion';
import type {
  TableroItemData,
  TableroPasoData,
  TableroPasoEstado,
} from './motor/tablero-tipos';

/** Órdenes que viven en el Tablero: emitidas y todavía no terminadas. */
const ESTADOS_TABLERO = ['pendiente', 'produccion'];

/**
 * Captura y explotación de las métricas históricas del ETA (F1: promesa +
 * cierre). Corre el motor de flujo EN EL BACKEND — el mismo scheduler que el
 * front, portado en ./motor — y congela la predicción en los hitos, para que
 * después se pueda medir contra la realidad.
 * Ver docs/eta-metricas-historicas-diseno.md
 */
@Injectable()
export class EtaService {
  private readonly logger = new Logger(EtaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly produccion: ProduccionService,
  ) {}

  // ── Ensamblado de entradas + corrida del motor ─────────────────────────

  /** Arma las 5 entradas desde la DB y corre la simulación de todo el taller. */
  async correr(auth: CurrentAuth): Promise<ResultadoSimulacion> {
    const [items, estaciones, duraciones, dias, config] = await Promise.all([
      this.assembleItems(auth.tenantId),
      this.produccion.findEstaciones(auth),
      this.produccion.findDuracionesFamilias(auth),
      this.produccion.findDiasNoLaborables(auth),
      this.produccion.getConfiguracion(auth),
    ]);
    const medianas = new Map(
      duraciones.map((d) => [d.familiaCodigo, d.medianaMin]),
    );
    const noLaborables = new Set(dias.map((d) => d.fecha));
    return simularFlujo({
      items,
      estaciones: estaciones as Estacion[],
      medianas,
      ahora: new Date(),
      noLaborables,
      tiempoEntrePasosMin: config.tiempoEntrePasosMin,
    });
  }

  /** El subconjunto de `TableroItemData` que el motor necesita, desde Prisma. */
  private async assembleItems(tenantId: string): Promise<TableroItemData[]> {
    const ordenes = await this.prisma.ordenTrabajo.findMany({
      where: { tenantId, estado: { in: ESTADOS_TABLERO } },
      select: {
        id: true,
        numero: true,
        estado: true,
        fechaEntrega: true,
        items: {
          orderBy: { ordenIndice: 'asc' },
          select: {
            id: true,
            pasos: {
              orderBy: { indice: 'asc' },
              select: {
                id: true,
                indice: true,
                nombre: true,
                familiaCodigo: true,
                centroCostoId: true,
                duracionEstimadaMin: true,
                estado: true,
                iniciadoEl: true,
                tipoEjecucion: true,
                plazoProveedorDias: true,
              },
            },
          },
        },
      },
    });
    const fechaEntregaIso = (f: Date | null) =>
      f ? f.toISOString().slice(0, 10) : null;
    return ordenes.flatMap((orden) =>
      orden.items.map((item) => ({
        id: item.id,
        ordenId: orden.id,
        ordenNumero: orden.numero,
        ordenEstado: orden.estado,
        fechaEntrega: fechaEntregaIso(orden.fechaEntrega),
        sinRuta: item.pasos.length === 0,
        pasos: item.pasos.map(
          (paso): TableroPasoData => ({
            id: paso.id,
            indice: paso.indice,
            nombre: paso.nombre,
            familiaCodigo: paso.familiaCodigo,
            centroCostoId: paso.centroCostoId,
            duracionEstimadaMin:
              paso.duracionEstimadaMin === null
                ? null
                : Number(paso.duracionEstimadaMin),
            estado: paso.estado as TableroPasoEstado,
            iniciadoEl: paso.iniciadoEl ? paso.iniciadoEl.toISOString() : null,
            tipoEjecucion: paso.tipoEjecucion,
            plazoProveedorDias: paso.plazoProveedorDias,
          }),
        ),
      })),
    );
  }

  // ── Hito de emisión ────────────────────────────────────────────────────

  /**
   * Congela el ETA de los items de una orden recién emitida. Best-effort: la
   * emisión NUNCA se bloquea ni falla por esto (se llama post-commit). Un
   * fallo del motor deja una fila con `sinEstimar` para no perder cobertura.
   */
  async capturarEmision(auth: CurrentAuth, ordenId: string): Promise<void> {
    const items = await this.prisma.ordenTrabajoItem.findMany({
      where: { tenantId: auth.tenantId, ordenId },
      select: { id: true, orden: { select: { fechaEntrega: true } } },
    });
    if (items.length === 0) return;

    let porItem: ResultadoSimulacion['porItem'] | null = null;
    try {
      porItem = (await this.correr(auth)).porItem;
    } catch (error) {
      this.logger.error(
        `No se pudo correr el motor para la promesa de emisión (orden ${ordenId}).`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    await this.prisma.etaPromesa.createMany({
      data: items.map((item) => {
        const eta = porItem?.get(item.id) ?? null;
        return {
          tenantId: auth.tenantId,
          ordenId,
          itemId: item.id,
          hito: 'emision',
          finEstimado: eta?.finEstimado ?? null,
          sinEstimar: eta ? eta.sinEstimar : true,
          parcial: eta?.parcial ?? false,
          fechaEntrega: item.orden.fechaEntrega,
        };
      }),
    });
  }

  // ── Cierre del item ──────────────────────────────────────────────────────

  /**
   * Al finalizar una orden: descompone el ciclo real de cada item y completa
   * las promesas abiertas con `finReal`/`errorMin`. Post-commit, best-effort.
   * Idempotente: sólo toca promesas con `finReal` nulo y recomputa el ciclo.
   */
  async capturarCierre(tenantId: string, ordenId: string): Promise<void> {
    const items = await this.prisma.ordenTrabajoItem.findMany({
      where: { tenantId, ordenId },
      select: {
        id: true,
        pasos: {
          select: {
            iniciadoEl: true,
            completadoEl: true,
            tiempoRealMin: true,
            tipoEjecucion: true,
          },
        },
      },
    });

    for (const item of items) {
      const ciclo = descomponerCiclo(
        item.pasos.map((p) => ({
          iniciadoEl: p.iniciadoEl,
          completadoEl: p.completadoEl,
          tiempoRealMin: p.tiempoRealMin === null ? null : Number(p.tiempoRealMin),
          tipoEjecucion: p.tipoEjecucion,
        })),
      );
      const { finReal, ...campos } = ciclo;
      await this.prisma.ordenTrabajoItem.update({
        where: { id: item.id },
        data: campos,
      });
      if (!finReal) continue;

      const abiertas = await this.prisma.etaPromesa.findMany({
        where: { tenantId, itemId: item.id, finReal: null },
        select: { id: true, finEstimado: true },
      });
      for (const promesa of abiertas) {
        const errorMin = promesa.finEstimado
          ? Math.round(
              (finReal.getTime() - promesa.finEstimado.getTime()) / 60000,
            )
          : null;
        await this.prisma.etaPromesa.update({
          where: { id: promesa.id },
          data: { finReal, errorMin },
        });
      }
    }
  }

  // ── Reporte: precisión de las promesas ───────────────────────────────────

  /**
   * Precisión del pronóstico sobre las promesas ya cerradas (finReal). MAE,
   * mediana y p90 del error absoluto; sesgo con signo (+ = tiende a terminar
   * tarde); % dentro de ±4 h y ±1 día; cobertura (qué fracción de lo cerrado
   * tenía un ETA estimable). Rango opcional por `congeladaEl`.
   */
  async precision(
    auth: CurrentAuth,
    rango?: { desde?: string; hasta?: string },
  ) {
    const congeladaEl: Prisma.DateTimeFilter = {};
    if (rango?.desde) congeladaEl.gte = new Date(`${rango.desde}T00:00:00.000Z`);
    if (rango?.hasta) congeladaEl.lte = new Date(`${rango.hasta}T23:59:59.999Z`);
    const promesas = await this.prisma.etaPromesa.findMany({
      where: {
        tenantId: auth.tenantId,
        finReal: { not: null },
        ...(rango?.desde || rango?.hasta ? { congeladaEl } : {}),
      },
      select: { errorMin: true, sinEstimar: true },
    });
    return resumirPrecision(promesas);
  }
}
