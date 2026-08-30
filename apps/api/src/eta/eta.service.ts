import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProduccionService } from '../produccion/produccion.service';
import { regionalDelTenant } from '../common/regional';
import { resolverTecnologiaMaquina } from '../common/tecnologia-maquina';
import { claveFechaEnZona } from '../common/zona';
import { finExclusivo, type Rango } from '../reportes/periodo';
import { resolverFamilia } from '../productos-servicios/pasos/familias';
import {
  descomponerCiclo,
  evaluarSesgoFamilias,
  resumirPrecision,
  type FilaSesgo,
} from './metricas';
import {
  construirSnapshotsEstacion,
  construirSnapshotsItem,
  type EstacionInfo,
} from './snapshots';
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
  async correr(tenantId: string): Promise<ResultadoSimulacion> {
    const [items, estaciones, duraciones, dias, config, regional] =
      await Promise.all([
        this.assembleItems(tenantId),
        this.produccion.findEstaciones(tenantId),
        this.produccion.findDuracionesFamilias(tenantId),
        this.produccion.findDiasNoLaborables(tenantId),
        this.produccion.getConfiguracion(tenantId),
        regionalDelTenant(this.prisma, tenantId),
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
      // El calendario de las estaciones es hora de pared del TALLER, y este
      // proceso corre en UTC: sin la zona, las franjas se corren 3 horas.
      zona: regional.zonaHoraria,
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
                nodoClave: true,
                esTerminal: true,
                nombre: true,
                familiaCodigo: true,
                centroCostoId: true,
                maquinaId: true,
                duracionEstimadaMin: true,
                estado: true,
                iniciadoEl: true,
                tipoEjecucion: true,
                plazoProveedorDias: true,
                dependenciasEntrantes: {
                  where: { obligatoria: true },
                  select: { predecesorPasoId: true },
                },
                dependenciasSalientes: {
                  where: { obligatoria: true },
                  select: { sucesorPasoId: true },
                },
              },
            },
          },
        },
      },
    });
    const fechaEntregaIso = (f: Date | null) =>
      f ? f.toISOString().slice(0, 10) : null;
    // Tecnología por máquina (derivada, no persistida): habilita el ruteo a
    // estación "por tecnología" en el motor de flujo. Espejo del tablero.
    const tecnologias = await this.tecnologiaPorMaquina(
      tenantId,
      ordenes.flatMap((orden) =>
        orden.items.flatMap((item) => item.pasos.map((p) => p.maquinaId)),
      ),
    );
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
            nodoClave: paso.nodoClave,
            esTerminal: paso.esTerminal,
            predecesorPasoIds: paso.dependenciasEntrantes.map(
              (dependencia) => dependencia.predecesorPasoId,
            ),
            sucesorPasoIds: paso.dependenciasSalientes.map(
              (dependencia) => dependencia.sucesorPasoId,
            ),
            nombre: paso.nombre,
            familiaCodigo: paso.familiaCodigo,
            plantillaCodigo:
              resolverFamilia(paso.familiaCodigo)?.plantillaCodigo ?? null,
            centroCostoId: paso.centroCostoId,
            maquinaId: paso.maquinaId,
            tecnologia: paso.maquinaId
              ? (tecnologias.get(paso.maquinaId) ?? null)
              : null,
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

  /**
   * Mapa `maquinaId → tecnología` para un lote de pasos. La tecnología se
   * deriva de `Maquina` en lectura (no se persiste). Una query por corrida.
   */
  private async tecnologiaPorMaquina(
    tenantId: string,
    maquinaIds: Array<string | null>,
  ): Promise<Map<string, string | null>> {
    const ids = Array.from(
      new Set(maquinaIds.filter((id): id is string => id !== null)),
    );
    if (ids.length === 0) return new Map();
    const maquinas = await this.prisma.maquina.findMany({
      where: { tenantId, id: { in: ids } },
      select: {
        id: true,
        plantilla: true,
        parametrosTecnicosJson: true,
        capacidadesAvanzadasJson: true,
      },
    });
    return new Map(
      maquinas.map((m) => [m.id, resolverTecnologiaMaquina(m)] as const),
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
      porItem = (await this.correr(auth.tenantId)).porItem;
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
          tiempoRealMin:
            p.tiempoRealMin === null ? null : Number(p.tiempoRealMin),
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

  /**
   * Borra las promesas todavía abiertas de una orden que se canceló.
   *
   * Una promesa sin `finReal` es "esto todavía se está haciendo". Si la orden
   * se cancela, esa fila no se va a cerrar nunca y quedaría contando como
   * atraso infinito en la precisión del pronóstico. Las ya cerradas se
   * conservan: ahí sí hubo entrega real que medir.
   */
  async descartarPromesasAbiertas(
    tenantId: string,
    ordenId: string,
  ): Promise<number> {
    const { count } = await this.prisma.etaPromesa.deleteMany({
      where: { tenantId, finReal: null, item: { ordenId } },
    });
    return count;
  }

  // ── Foto diaria (F2): cron por tenant ──────────────────────────────────

  /** Tenants con algo que snapshotear (órdenes vivas en el tablero). */
  async tenantsConActividad(): Promise<string[]> {
    const filas = await this.prisma.ordenTrabajo.groupBy({
      by: ['tenantId'],
      where: { estado: { in: ESTADOS_TABLERO } },
    });
    return filas.map((f) => f.tenantId);
  }

  /**
   * Corre el motor una vez y escribe las fotos del día por estación y por
   * item. Idempotente: upsert por (tenant, fecha, clave) — re-correr el mismo
   * día pisa, no duplica.
   */
  async snapshotDiario(tenantId: string, ahora = new Date()): Promise<void> {
    const [{ porItem, traza }, estaciones, dias, entregas, regional] =
      await Promise.all([
        this.correr(tenantId),
        this.produccion.findEstaciones(tenantId),
        this.produccion.findDiasNoLaborables(tenantId),
        this.prisma.ordenTrabajoItem.findMany({
          where: {
            tenantId,
            orden: { estado: { in: ESTADOS_TABLERO } },
          },
          select: { id: true, orden: { select: { fechaEntrega: true } } },
        }),
        regionalDelTenant(this.prisma, tenantId),
      ]);
    const noLaborables = new Set(dias.map((d) => d.fecha));
    // "El día" del snapshot es el día LOCAL del taller (misma convención que
    // DiaNoLaborable — cierra la D8 de eta-metricas-historicas): antes se
    // usaba el día local del proceso, que en UTC coincidía de casualidad por
    // el horario del cron.
    const fecha = new Date(
      `${claveFechaEnZona(ahora, regional.zonaHoraria)}T00:00:00.000Z`,
    );

    const estacionesInfo: EstacionInfo[] = estaciones.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      calendario: e.calendario,
      capacidadConcurrente: e.capacidadConcurrente,
    }));
    const fotosEstacion = construirSnapshotsEstacion(
      traza.map((p) => ({
        estacionKey: p.estacionKey,
        duracionMin: p.duracionMin,
        esperaMin: p.esperaMin,
        candidatos: p.candidatos,
        inicio: p.inicio,
        tercerizado: p.tercerizado,
      })),
      estacionesInfo,
      ahora,
      noLaborables,
      regional.zonaHoraria,
    );
    const entregaPorItem = new Map(
      entregas.map((e) => [
        e.id,
        e.orden.fechaEntrega
          ? e.orden.fechaEntrega.toISOString().slice(0, 10)
          : null,
      ]),
    );
    const fotosItem = construirSnapshotsItem(
      porItem,
      entregaPorItem,
      regional.zonaHoraria,
    );

    for (const foto of fotosEstacion) {
      const { estacionKey, ...campos } = foto;
      await this.prisma.etaSnapshotEstacion.upsert({
        where: {
          tenantId_fecha_estacionKey: { tenantId, fecha, estacionKey },
        },
        create: { tenantId, fecha, estacionKey, ...campos },
        update: campos,
      });
    }
    for (const foto of fotosItem) {
      const { itemId, ...campos } = foto;
      await this.prisma.etaSnapshotItem.upsert({
        where: { tenantId_fecha_itemId: { tenantId, fecha, itemId } },
        create: { tenantId, fecha, itemId, ...campos },
        update: campos,
      });
    }
  }

  /** Serie diaria de la cola por estación (opcional: una estación / rango). */
  async seriesColas(
    tenantId: string,
    filtro?: { estacionKey?: string; desde?: string; hasta?: string },
  ) {
    const fecha: Prisma.DateTimeFilter = {};
    if (filtro?.desde) fecha.gte = new Date(`${filtro.desde}T00:00:00.000Z`);
    if (filtro?.hasta) fecha.lte = new Date(`${filtro.hasta}T00:00:00.000Z`);
    return this.prisma.etaSnapshotEstacion.findMany({
      where: {
        tenantId,
        ...(filtro?.estacionKey ? { estacionKey: filtro.estacionKey } : {}),
        ...(filtro?.desde || filtro?.hasta ? { fecha } : {}),
      },
      orderBy: [{ fecha: 'asc' }, { estacionNombre: 'asc' }],
    });
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
    if (rango?.desde)
      congeladaEl.gte = new Date(`${rango.desde}T00:00:00.000Z`);
    if (rango?.hasta)
      congeladaEl.lte = new Date(`${rango.hasta}T23:59:59.999Z`);
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

  /** Variante usada por Reportes: recibe los bordes ya resueltos en la zona del tenant. */
  async precisionEnRango(tenantId: string, rango: Rango) {
    const promesas = await this.prisma.etaPromesa.findMany({
      where: {
        tenantId,
        finReal: { not: null },
        congeladaEl: { gte: rango.desde, lt: finExclusivo(rango) },
      },
      select: { errorMin: true, sinEstimar: true },
    });
    return resumirPrecision(promesas);
  }

  // ── Reporte: salud del modelo (F3) ───────────────────────────────────────

  /**
   * Salud del pronóstico: cobertura (qué fracción de las promesas tuvo ETA y
   * cuánta corrió con supuestos) + sesgo de duración por familia con el
   * sugeridor de correcciones. El sugeridor sólo PROPONE (D9): aplicar la
   * corrección sigue siendo decisión humana.
   */
  async saludModelo(tenantId: string, rango?: Rango) {
    const borde = rango
      ? { gte: rango.desde, lt: finExclusivo(rango) }
      : undefined;
    const promesas = await this.prisma.etaPromesa.findMany({
      where: { tenantId, ...(borde ? { congeladaEl: borde } : {}) },
      select: { sinEstimar: true, parcial: true },
    });
    const total = promesas.length;
    const sinEstimar = promesas.filter((p) => p.sinEstimar).length;
    const parcial = promesas.filter((p) => p.parcial).length;
    const un = (n: number) => Math.round(n * 10) / 10;
    const cobertura = {
      promesas: total,
      conEtaPct: total > 0 ? un(((total - sinEstimar) / total) * 100) : 0,
      sinEstimarPct: total > 0 ? un((sinEstimar / total) * 100) : 0,
      parcialPct: total > 0 ? un((parcial / total) * 100) : 0,
    };

    // Estimado vs real por familia, sólo tiempos MEDIDOS (mismo filtro que la
    // mediana de duraciones): el sugeridor se apoya en medición, no percepción.
    const filas = await this.prisma.$queryRaw<FilaSesgo[]>`
      SELECT "familiaCodigo",
             COUNT(*)::int AS "muestras",
             percentile_cont(0.5) WITHIN GROUP (
               ORDER BY "duracionEstimadaMin"
             ) AS "medianaEstimadoMin",
             percentile_cont(0.5) WITHIN GROUP (
               ORDER BY "tiempoRealMin"
             ) AS "medianaRealMin"
      FROM "OrdenTrabajoItemPaso"
      WHERE "tenantId" = ${tenantId}::uuid
        AND "estado" = 'hecho'
        AND "tiempoRealMin" IS NOT NULL
        AND "duracionEstimadaMin" IS NOT NULL
        AND "tiempoFuente" IN ('medido', 'medido_lote')
        ${
          rango
            ? Prisma.sql`AND "completadoEl" >= ${rango.desde} AND "completadoEl" < ${finExclusivo(rango)}`
            : Prisma.empty
        }
      GROUP BY "familiaCodigo"
      HAVING COUNT(*) >= 3
    `;
    const sesgoFamilias = evaluarSesgoFamilias(
      filas.map((f) => ({
        familiaCodigo: f.familiaCodigo,
        muestras: Number(f.muestras),
        medianaEstimadoMin: Number(f.medianaEstimadoMin),
        medianaRealMin: Number(f.medianaRealMin),
      })),
    ).map((fila) => ({
      ...fila,
      familiaNombre: resolverFamilia(fila.familiaCodigo)?.nombre ?? null,
    }));

    return { cobertura, sesgoFamilias };
  }
}
