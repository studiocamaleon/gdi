import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { finExclusivo, fraccionMesEnRango, mesesDelRango, type Rango } from './periodo';
import { FAMILIAS } from '../productos-servicios/pasos/familias';
import type { FamiliaCodigo } from '../productos-servicios/pasos/types';
import { etiquetaMotivoFin } from '../ordenes-trabajo/ordenes-trabajo.types';

/**
 * Producción (mirada de gerencia). OTD (entregas a tiempo), lead time,
 * EFICIENCIA DE TIEMPO (real vs. cotizado — reemplaza al OEE que no
 * podemos medir), utilización por centro vs. capacidad práctica, throughput
 * y bloqueos. Ver docs/reportes-plan-backend.md §4.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const MS_DIA = 86_400_000;

function nombreFamilia(codigo: string): string {
  return FAMILIAS[codigo as FamiliaCodigo]?.nombre ?? codigo;
}

/** "YYYY-MM" del mes actual (para la capacidad vigente). */
function mesActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

type OtdRow = {
  numero: string;
  cliente: string | null;
  fechaEntrega: Date | null;
  fechaEmision: Date | null;
  fin: Date | null;
};

/**
 * Días hábiles de un mes típico. Reemplaza al `diasPorMes` que cada centro
 * declaraba dentro de la fórmula de capacidad, retirada con el modelo derivado.
 * Ver docs/centros-de-costo-carga-manual-diseno.md
 */
const DIAS_HABILES_MES = 22;

@Injectable()
export class ReporteProduccionService {
  constructor(private readonly prisma: PrismaService) {}

  /** OTD + utilización + carga para los KPIs del Resumen. */
  async resumenKpis(tenantId: string, rango: Rango) {
    const [otd, util, carga] = await Promise.all([
      this.otd(tenantId, rango),
      this.utilizacion(tenantId, rango),
      this.carga(tenantId),
    ]);
    return { otdPct: otd.otdPct, utilizacionPct: util.promedioPct, ...carga };
  }

  async produccion(tenantId: string, rango: Rango) {
    const [otd, eficiencia, util, throughput, bloqueos, carga, registro, ahorros] =
      await Promise.all([
        this.otd(tenantId, rango),
        this.eficiencia(tenantId, rango),
        this.utilizacion(tenantId, rango),
        this.throughput(tenantId, rango),
        this.bloqueos(tenantId),
        this.carga(tenantId),
        this.registroTiempos(tenantId, rango),
        this.ahorros(tenantId, rango),
      ]);
    return {
      kpis: {
        otdPct: otd.otdPct,
        atrasoPromedioDias: otd.atrasoPromedioDias,
        leadTimeDias: otd.leadTimeDias,
        eficienciaPct: eficiencia.eficienciaPct,
        bloqueados: bloqueos.total,
        utilizacionPct: util.promedioPct,
        trabajosEnCola: carga.trabajosEnCola,
        diasDeCarga: carga.diasDeCarga,
      },
      otd,
      eficiencia,
      utilizacion: util.centros,
      throughput,
      bloqueos: bloqueos.motivos,
      registroTiempos: registro,
      ahorros,
    };
  }

  /**
   * Carga del taller AHORA: pasos pendientes de órdenes vivas y su tiempo,
   * convertido a DÍAS de carga contra la capacidad diaria de los centros
   * (capacidadPractica del mes / días por mes). Foto operativa, no del rango.
   */
  private async carga(tenantId: string) {
    const [colaRows, capRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ trabajos: number; minutos: number }>>`
        SELECT COUNT(*)::int AS trabajos,
               COALESCE(SUM(p."duracionEstimadaMin"), 0)::float8 AS minutos
        FROM "OrdenTrabajoItemPaso" p
        JOIN "OrdenTrabajo" ot ON ot.id = p."ordenId"
        WHERE p."tenantId" = ${tenantId}::uuid AND p.estado <> 'hecho'
          AND ot.estado IN ('pendiente', 'produccion')
      `,
      this.prisma.centroCostoCapacidadPeriodo.findMany({
        where: { tenantId, periodo: mesActual() },
        select: { horasProductivas: true },
      }),
    ]);
    const trabajosEnCola = colaRows[0]?.trabajos ?? 0;
    const horasCola = (colaRows[0]?.minutos ?? 0) / 60;
    // Capacidad diaria (horas) = Σ horas productivas del mes / días hábiles.
    //
    // Antes cada centro declaraba sus propios `diasPorMes` como parte de la
    // fórmula de capacidad. Esa fórmula se retiró: ahora el centro carga las
    // horas del mes y nada más. Repartirlas sobre una constante es una
    // aproximación, y se nota sobre todo en meses cortos o con feriados; el
    // dato fino vive en el calendario del módulo de Capacidad de estaciones.
    const horasPorDia =
      capRows.reduce((acc, c) => acc + Number(c.horasProductivas), 0) /
      DIAS_HABILES_MES;
    return {
      trabajosEnCola,
      diasDeCarga: horasPorDia > 0 ? r2(horasCola / horasPorDia) : null,
    };
  }

  // ── OTD + lead time ─────────────────────────────────────────────────
  private async otd(tenantId: string, rango: Rango) {
    const rows = await this.prisma.$queryRaw<OtdRow[]>`
      SELECT ot.numero, c.nombre AS cliente, ot."fechaEntrega", ot."fechaEmision",
             MAX(p."completadoEl") AS fin
      FROM "OrdenTrabajo" ot
      JOIN "OrdenTrabajoItem" i ON i."ordenId" = ot.id
      JOIN "OrdenTrabajoItemPaso" p ON p."itemId" = i.id
      LEFT JOIN "Cliente" c ON c.id = ot."clienteId"
      WHERE ot."tenantId" = ${tenantId}::uuid
        AND ot.estado IN ('finalizada', 'entregada')
      GROUP BY ot.id, ot.numero, c.nombre, ot."fechaEntrega", ot."fechaEmision"
      HAVING MAX(p."completadoEl") >= ${rango.desde}
         AND MAX(p."completadoEl") < ${finExclusivo(rango)}
    `;

    let aTiempo = 0;
    let tarde = 0;
    let sinFecha = 0;
    let sumaAtraso = 0;
    let sumaLead = 0;
    let leadN = 0;
    const atrasadas: Array<{ numero: string; cliente: string; fechaEntrega: string; diasAtraso: number }> = [];

    for (const o of rows) {
      if (!o.fin) continue;
      const finDia = new Date(o.fin.getFullYear(), o.fin.getMonth(), o.fin.getDate());
      if (o.fechaEmision) {
        const emi = new Date(o.fechaEmision.getFullYear(), o.fechaEmision.getMonth(), o.fechaEmision.getDate());
        sumaLead += Math.max(0, Math.round((finDia.getTime() - emi.getTime()) / MS_DIA));
        leadN += 1;
      }
      if (!o.fechaEntrega) {
        sinFecha += 1;
        continue;
      }
      const entrega = new Date(o.fechaEntrega.getFullYear(), o.fechaEntrega.getMonth(), o.fechaEntrega.getDate());
      const diasAtraso = Math.round((finDia.getTime() - entrega.getTime()) / MS_DIA);
      if (diasAtraso <= 0) {
        aTiempo += 1;
      } else {
        tarde += 1;
        sumaAtraso += diasAtraso;
        atrasadas.push({
          numero: o.numero,
          cliente: o.cliente ?? 'Sin cliente',
          fechaEntrega: entrega.toISOString().slice(0, 10),
          diasAtraso,
        });
      }
    }
    const evaluadas = aTiempo + tarde;
    atrasadas.sort((a, b) => b.diasAtraso - a.diasAtraso);
    return {
      total: evaluadas,
      aTiempo,
      tarde,
      sinFecha,
      otdPct: evaluadas > 0 ? r2((aTiempo / evaluadas) * 100) : null,
      atrasoPromedioDias: tarde > 0 ? r2(sumaAtraso / tarde) : 0,
      leadTimeDias: leadN > 0 ? r2(sumaLead / leadN) : null,
      atrasadas,
    };
  }

  // ── Eficiencia de tiempo (real vs. cotizado) ───────────────────────
  private async eficiencia(tenantId: string, rango: Rango) {
    // Sólo fuentes MEDIDAS (registro-tiempos D14): comparar el estimado
    // contra sí mismo (fuente 'estimado') o contra percepciones
    // ('declarado') no calibra nada. Filtro de atípicos (plan §5):
    // real <= 8h y <= 5× lo estimado.
    const rows = await this.prisma.$queryRaw<
      Array<{ familia: string; real: number; estimado: number; muestras: number; atipicos: number }>
    >`
      SELECT p."familiaCodigo" AS familia,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY p."tiempoRealMin")
               FILTER (WHERE p."tiempoRealMin" <= 480
                        AND p."tiempoRealMin" <= 5 * p."duracionEstimadaMin") AS real,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY p."duracionEstimadaMin")
               FILTER (WHERE p."tiempoRealMin" <= 480
                        AND p."tiempoRealMin" <= 5 * p."duracionEstimadaMin") AS estimado,
             COUNT(*) FILTER (WHERE p."tiempoRealMin" <= 480
                        AND p."tiempoRealMin" <= 5 * p."duracionEstimadaMin")::int AS muestras,
             COUNT(*) FILTER (WHERE p."tiempoRealMin" > 480
                        OR p."tiempoRealMin" > 5 * p."duracionEstimadaMin")::int AS atipicos
      FROM "OrdenTrabajoItemPaso" p
      WHERE p."tenantId" = ${tenantId}::uuid AND p.estado = 'hecho'
        AND p."tiempoRealMin" IS NOT NULL
        AND p."tiempoFuente" IN ('medido', 'medido_lote')
        AND p."duracionEstimadaMin" IS NOT NULL
        AND p."completadoEl" >= ${rango.desde} AND p."completadoEl" < ${finExclusivo(rango)}
      GROUP BY p."familiaCodigo"
    `;

    let realTotal = 0;
    let estTotal = 0;
    let atipicosTotal = 0;
    const porFamilia = rows
      .filter((row) => row.muestras > 0 && row.real !== null && row.estimado !== null)
      .map((row) => {
        realTotal += row.real * row.muestras;
        estTotal += row.estimado * row.muestras;
        atipicosTotal += row.atipicos;
        return {
          familia: nombreFamilia(row.familia),
          estimadoMin: r2(row.estimado),
          realMin: r2(row.real),
          razon: row.estimado > 0 ? r2(row.real / row.estimado) : null,
          muestras: row.muestras,
        };
      })
      .sort((a, b) => (b.razon ?? 0) - (a.razon ?? 0));

    return {
      // >100% = tarda MÁS que lo cotizado.
      eficienciaPct: estTotal > 0 ? r2((realTotal / estTotal) * 100) : null,
      porFamilia,
      atipicosExcluidos: atipicosTotal,
    };
  }

  // ── Utilización por centro vs. capacidad práctica ──────────────────
  private async utilizacion(tenantId: string, rango: Rango) {
    const [reales, capacidades] = await Promise.all([
      // Tiempo asentado por paso (cualquier fuente): los pasos de máquina
      // asientan su estimado (D10) y también son carga real del centro —
      // con timestamps quedaban en 0 y la utilización subcontaba.
      this.prisma.$queryRaw<Array<{ centroId: string; centro: string; minReales: number }>>`
        SELECT p."centroCostoId" AS "centroId", cc.nombre AS centro,
               COALESCE(SUM(p."tiempoRealMin"), 0)::float8 AS "minReales"
        FROM "OrdenTrabajoItemPaso" p
        JOIN "CentroCosto" cc ON cc.id = p."centroCostoId"
        WHERE p."tenantId" = ${tenantId}::uuid AND p.estado = 'hecho'
          AND p."tiempoRealMin" IS NOT NULL
          AND p."completadoEl" >= ${rango.desde} AND p."completadoEl" < ${finExclusivo(rango)}
        GROUP BY p."centroCostoId", cc.nombre
      `,
      this.prisma.centroCostoCapacidadPeriodo.findMany({
        where: { tenantId, periodo: { in: mesesDelRango(rango) } },
        select: { centroCostoId: true, periodo: true, horasProductivas: true },
      }),
    ]);

    // Capacidad práctica (horas) prorrateada al rango, por centro.
    const capPorCentro = new Map<string, number>();
    for (const c of capacidades) {
      const horas = Number(c.horasProductivas);
      const proporcion = horas * fraccionMesEnRango(c.periodo, rango);
      capPorCentro.set(c.centroCostoId, (capPorCentro.get(c.centroCostoId) ?? 0) + proporcion);
    }

    const centros = reales
      .map((row) => {
        const horasReales = row.minReales / 60;
        const capacidad = capPorCentro.get(row.centroId) ?? 0;
        return {
          centro: row.centro,
          horasReales: r2(horasReales),
          capacidadPractica: r2(capacidad),
          pct: capacidad > 0 ? r2((horasReales / capacidad) * 100) : null,
        };
      })
      .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));

    const totalReales = reales.reduce((a, r) => a + r.minReales / 60, 0);
    const totalCap = [...capPorCentro.values()].reduce((a, c) => a + c, 0);
    return {
      centros,
      promedioPct: totalCap > 0 ? r2((totalReales / totalCap) * 100) : null,
    };
  }

  // ── Throughput (pasos completados por día) ─────────────────────────
  private async throughput(tenantId: string, rango: Rango) {
    // El "día" del bucket es el de la pared del tenant (la columna guarda UTC).
    const rows = await this.prisma.$queryRaw<Array<{ fecha: string; cantidad: number }>>`
      SELECT to_char(date_trunc('day', (p."completadoEl" AT TIME ZONE 'UTC') AT TIME ZONE ${rango.zona}), 'YYYY-MM-DD') AS fecha,
             COUNT(*)::int AS cantidad
      FROM "OrdenTrabajoItemPaso" p
      WHERE p."tenantId" = ${tenantId}::uuid AND p.estado = 'hecho'
        AND p."completadoEl" >= ${rango.desde} AND p."completadoEl" < ${finExclusivo(rango)}
      GROUP BY 1 ORDER BY 1
    `;
    return rows.map((r) => ({ fecha: r.fecha, cantidad: r.cantidad }));
  }

  // ── Registro de tiempos (calidad, pausas y operadores) ─────────────
  // Métricas del módulo registro-tiempos (§9 del doc): con qué calidad se
  // están registrando los tiempos, por qué se pausa el taller y cuánto
  // tiempo de trabajo asentó cada operador en el período.
  private async registroTiempos(tenantId: string, rango: Rango) {
    const [fuentesRows, pausasRows, operadoresRows] = await Promise.all([
      // Calidad del tiempo de cada paso completado del período (D3).
      this.prisma.$queryRaw<Array<{ fuente: string; pasos: number }>>`
        SELECT COALESCE(p."tiempoFuente", 'invalido') AS fuente,
               COUNT(*)::int AS pasos
        FROM "OrdenTrabajoItemPaso" p
        WHERE p."tenantId" = ${tenantId}::uuid AND p.estado = 'hecho'
          AND p."completadoEl" >= ${rango.desde} AND p."completadoEl" < ${finExclusivo(rango)}
        GROUP BY 1 ORDER BY pasos DESC
      `,
      // Pareto de pausas: cierres de tramo que NO son fin normal de trabajo
      // (se excluyen 'completado', 'bloqueo' —ya tiene su card— y el
      // backfill de migración).
      this.prisma.$queryRaw<Array<{ motivo: string; veces: number }>>`
        SELECT t."motivoFin" AS motivo, COUNT(*)::int AS veces
        FROM "OrdenTrabajoPasoTramo" t
        WHERE t."tenantId" = ${tenantId}::uuid
          AND t."finEl" IS NOT NULL
          AND t."finEl" >= ${rango.desde} AND t."finEl" < ${finExclusivo(rango)}
          AND t."motivoFin" NOT IN ('completado', 'bloqueo', 'migracion')
        GROUP BY 1 ORDER BY veces DESC
      `,
      // Tiempo de trabajo asentado por operador (suma de tramos cerrados).
      this.prisma.$queryRaw<
        Array<{ operador: string; minutos: number; pasos: number }>
      >`
        SELECT t."usuarioNombre" AS operador,
               COALESCE(SUM(EXTRACT(EPOCH FROM (t."finEl" - t."inicioEl")) / 60.0), 0)::float8 AS minutos,
               COUNT(DISTINCT t."pasoId")::int AS pasos
        FROM "OrdenTrabajoPasoTramo" t
        WHERE t."tenantId" = ${tenantId}::uuid
          AND t."finEl" IS NOT NULL
          AND t."finEl" >= ${rango.desde} AND t."finEl" < ${finExclusivo(rango)}
          AND t."motivoFin" <> 'migracion'
        GROUP BY 1 ORDER BY minutos DESC
        LIMIT 8
      `,
    ]);

    const totalPasos = fuentesRows.reduce((acc, row) => acc + row.pasos, 0);
    const confiables = fuentesRows
      .filter((row) => row.fuente === 'medido' || row.fuente === 'medido_lote')
      .reduce((acc, row) => acc + row.pasos, 0);

    return {
      totalPasos,
      /** % de pasos del período cuyo tiempo es una medición real. */
      confiablePct: totalPasos > 0 ? r2((confiables / totalPasos) * 100) : null,
      fuentes: fuentesRows.map((row) => ({
        fuente: row.fuente,
        pasos: row.pasos,
        pct: totalPasos > 0 ? r2((row.pasos / totalPasos) * 100) : 0,
      })),
      pausas: pausasRows.map((row) => ({
        motivo: etiquetaMotivoFin(row.motivo, null) ?? row.motivo,
        veces: row.veces,
      })),
      operadores: operadoresRows.map((row) => ({
        operador: row.operador,
        minutos: r2(row.minutos),
        pasos: row.pasos,
      })),
    };
  }

  // ── Ahorro por consolidación (simulador gran formato) ──────────────
  // El argumento de valor del sistema: cuánto material y dinero se ahorró
  // consolidando tandas vs. imprimir cada trabajo por separado (baseline
  // del motor al cotizar). Período + ACUMULADO histórico.
  private async ahorros(tenantId: string, rango: Rango) {
    const [periodoRows, historicoRows, porMaterialRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ tandas: number; jobs: number; ml: number; pesos: number }>
      >`
        SELECT COUNT(*)::int AS tandas,
               COALESCE(SUM(a.jobs), 0)::int AS jobs,
               COALESCE(SUM(a."ahorroMl"), 0)::float8 AS ml,
               COALESCE(SUM(a."ahorroPesos"), 0)::float8 AS pesos
        FROM "AhorroConsolidacion" a
        WHERE a."tenantId" = ${tenantId}::uuid
          AND a."createdAt" >= ${rango.desde} AND a."createdAt" < ${finExclusivo(rango)}
      `,
      this.prisma.$queryRaw<
        Array<{ tandas: number; jobs: number; ml: number; pesos: number }>
      >`
        SELECT COUNT(*)::int AS tandas,
               COALESCE(SUM(a.jobs), 0)::int AS jobs,
               COALESCE(SUM(a."ahorroMl"), 0)::float8 AS ml,
               COALESCE(SUM(a."ahorroPesos"), 0)::float8 AS pesos
        FROM "AhorroConsolidacion" a
        WHERE a."tenantId" = ${tenantId}::uuid
      `,
      // Desglose ACUMULADO por material (el pitch de valor completo).
      this.prisma.$queryRaw<
        Array<{ material: string; tecnologia: string | null; tandas: number; ml: number; pesos: number }>
      >`
        SELECT a."materiaPrimaNombre" AS material,
               a.tecnologia,
               COUNT(*)::int AS tandas,
               COALESCE(SUM(a."ahorroMl"), 0)::float8 AS ml,
               COALESCE(SUM(a."ahorroPesos"), 0)::float8 AS pesos
        FROM "AhorroConsolidacion" a
        WHERE a."tenantId" = ${tenantId}::uuid
        GROUP BY 1, 2 ORDER BY pesos DESC, ml DESC
        LIMIT 10
      `,
    ]);
    const resumen = (row?: { tandas: number; jobs: number; ml: number; pesos: number }) => ({
      tandas: row?.tandas ?? 0,
      jobs: row?.jobs ?? 0,
      ahorroMl: r2(row?.ml ?? 0),
      ahorroPesos: r2(row?.pesos ?? 0),
    });
    return {
      periodo: resumen(periodoRows[0]),
      historico: resumen(historicoRows[0]),
      porMaterial: porMaterialRows.map((row) => ({
        material: row.material,
        tecnologia: row.tecnologia,
        tandas: row.tandas,
        ahorroMl: r2(row.ml),
        ahorroPesos: r2(row.pesos),
      })),
    };
  }

  // ── Bloqueos (foto actual por motivo) ──────────────────────────────
  private async bloqueos(tenantId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ motivo: string; veces: number }>>`
      SELECT COALESCE(NULLIF(p."motivoBloqueo", ''), 'Sin detalle') AS motivo,
             COUNT(*)::int AS veces
      FROM "OrdenTrabajoItemPaso" p
      WHERE p."tenantId" = ${tenantId}::uuid AND p.estado = 'bloqueado'
      GROUP BY 1 ORDER BY veces DESC
    `;
    return {
      total: rows.reduce((a, r) => a + r.veces, 0),
      motivos: rows,
    };
  }

  limites(prod: Awaited<ReturnType<ReporteProduccionService['produccion']>>): string[] {
    const l = [
      'Utilización según el tiempo asentado por paso (medido o estimado); la eficiencia usa sólo tiempos medidos.',
    ];
    if (prod.registroTiempos.confiablePct !== null && prod.registroTiempos.confiablePct < 50) {
      l.push(
        'Menos de la mitad de los pasos del período tienen tiempo medido: la eficiencia se apoya en pocas muestras.',
      );
    }
    if (prod.otd.sinFecha > 0) {
      l.push(`${prod.otd.sinFecha} orden(es) finalizada(s) sin fecha de entrega, fuera del OTD.`);
    }
    if (prod.eficiencia.atipicosExcluidos > 0) {
      l.push(`${prod.eficiencia.atipicosExcluidos} tiempo(s) atípico(s) excluido(s) de la eficiencia.`);
    }
    return l;
  }
}
