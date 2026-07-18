import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FAMILIAS } from '../productos-servicios/pasos/familias';
import type { FamiliaCodigo } from '../productos-servicios/pasos/types';
import { etiquetaMotivoFin } from '../ordenes-trabajo/ordenes-trabajo.types';
import type { Rango } from './periodo';

/**
 * Equipo — métricas por PERSONA con las guardas del estudio
 * docs/metricas-equipo-operarios-estudio.md: nada de rankings de
 * producción (orden alfabético), eficiencia sólo con muestra mínima y
 * como desvío vs. cotizado, y disciplina de registro como métrica
 * emparejada. Producción se atribuye a User (tramos + completadoPor);
 * ventas a Empleado (vendedor), con comisión devengada ESTIMADA según
 * las reglas de EmpleadoComision.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Guardas del estudio §4: sin esta muestra, la eficiencia no se muestra. */
export const MUESTRA_MINIMA_EFICIENCIA = 20;

function finExclusivo(rango: Rango): Date {
  return new Date(
    rango.hasta.getFullYear(),
    rango.hasta.getMonth(),
    rango.hasta.getDate() + 1,
  );
}

function nombreFamilia(codigo: string): string {
  return FAMILIAS[codigo as FamiliaCodigo]?.nombre ?? codigo;
}

function claveFecha(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

export type PersonaProduccion = {
  id: string | null;
  nombre: string;
  minutos: number;
  pasos: number;
  /** Días distintos con al menos un tramo de trabajo. */
  dias: number;
  familias: number;
  autoPausas: number;
};

export type PersonaEficiencia = {
  id: string | null;
  nombre: string;
  muestras: number;
  /** Sólo con muestras >= MUESTRA_MINIMA_EFICIENCIA; si no, null. */
  desvioPct: number | null;
  /** Serie semanal del desvío propio (tendencia contra sí mismo). */
  serie: Array<{ semana: string; desvioPct: number; muestras: number }>;
};

export type PersonaDisciplina = {
  id: string | null;
  nombre: string;
  pasos: number;
  medidos: number;
  declarados: number;
  estimados: number;
  invalidos: number;
  medidoPct: number;
  autoPausas: number;
};

export type CeldaPolivalencia = { nombre: string; familia: string; minutos: number; pasos: number };

export type VendedorEquipo = {
  empleadoId: string | null;
  nombre: string;
  ordenes: number;
  facturado: number;
  ticketPromedio: number;
  margen: number | null;
  margenPct: number | null;
  itemsSinCosto: number;
  /** Estimada: reglas de EmpleadoComision aplicadas a la venta del período. */
  comisionEstimada: number | null;
};

@Injectable()
export class EquipoService {
  constructor(private readonly prisma: PrismaService) {}

  async equipo(tenantId: string, rango: Rango) {
    const desde = rango.desde;
    const hastaExcl = finExclusivo(rango);

    const [personas, eficienciaRows, eficienciaSerieRows, disciplinaRows, polivalencia, vendedores] =
      await Promise.all([
        this.personas(tenantId, desde, hastaExcl),
        this.eficienciaPorPersona(tenantId, desde, hastaExcl),
        this.eficienciaSerie(tenantId, desde, hastaExcl),
        this.disciplina(tenantId, desde, hastaExcl),
        this.polivalencia(tenantId, desde, hastaExcl),
        this.vendedores(tenantId, desde, hastaExcl),
      ]);

    // Eficiencia con guardas: desvío sólo con muestra suficiente; la serie
    // semanal (tendencia contra sí mismo) se adjunta a quien la tiene.
    const seriePorPersona = new Map<string, PersonaEficiencia['serie']>();
    for (const s of eficienciaSerieRows) {
      const clave = s.nombre;
      const lista = seriePorPersona.get(clave) ?? [];
      lista.push({ semana: s.semana, desvioPct: r2((s.real / s.estimado - 1) * 100), muestras: s.muestras });
      seriePorPersona.set(clave, lista);
    }
    const eficiencia: PersonaEficiencia[] = eficienciaRows
      .map((row) => ({
        id: row.id,
        nombre: row.nombre,
        muestras: row.muestras,
        desvioPct:
          row.muestras >= MUESTRA_MINIMA_EFICIENCIA && row.estimado > 0
            ? r2((row.real / row.estimado - 1) * 100)
            : null,
        serie:
          row.muestras >= MUESTRA_MINIMA_EFICIENCIA
            ? (seriePorPersona.get(row.nombre) ?? [])
            : [],
      }))
      // Orden alfabético a propósito: esto NO es un ranking (estudio §4).
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const totalPasos = disciplinaRows.reduce((a, p) => a + p.pasos, 0);
    const totalMedidos = disciplinaRows.reduce((a, p) => a + p.medidos, 0);

    // Cobertura: familias donde trabajó una sola persona (riesgo de taller).
    const personasPorFamilia = new Map<string, Set<string>>();
    for (const c of polivalencia) {
      const set = personasPorFamilia.get(c.familia) ?? new Set<string>();
      set.add(c.nombre);
      personasPorFamilia.set(c.familia, set);
    }
    const familiasSinRespaldo = [...personasPorFamilia.entries()]
      .filter(([, set]) => set.size === 1)
      .map(([familia, set]) => ({ familia, persona: [...set][0] }));

    return {
      kpis: {
        personasActivas: personas.length,
        minutosProductivos: r2(personas.reduce((a, p) => a + p.minutos, 0)),
        pasosCompletados: totalPasos,
        medidoPct: totalPasos > 0 ? r2((totalMedidos / totalPasos) * 100) : null,
        vendedoresActivos: vendedores.length,
      },
      personas,
      eficiencia,
      muestraMinima: MUESTRA_MINIMA_EFICIENCIA,
      disciplina: disciplinaRows,
      polivalencia,
      familiasSinRespaldo,
      vendedores,
    };
  }

  /** Horas, pasos, días activos y familias por persona (tramos cerrados). */
  private async personas(
    tenantId: string,
    desde: Date,
    hastaExcl: Date,
  ): Promise<PersonaProduccion[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string | null;
        nombre: string;
        minutos: number;
        pasos: number;
        dias: number;
        familias: number;
        autopausas: number;
      }>
    >`
      SELECT t."usuarioId" AS id, t."usuarioNombre" AS nombre,
             COALESCE(SUM(EXTRACT(EPOCH FROM (t."finEl" - t."inicioEl")) / 60.0), 0)::float8 AS minutos,
             COUNT(DISTINCT t."pasoId")::int AS pasos,
             COUNT(DISTINCT date_trunc('day', t."inicioEl"))::int AS dias,
             COUNT(DISTINCT p."familiaCodigo")::int AS familias,
             COUNT(*) FILTER (WHERE t."motivoFin" = 'auto_pausa')::int AS autopausas
      FROM "OrdenTrabajoPasoTramo" t
      JOIN "OrdenTrabajoItemPaso" p ON p.id = t."pasoId"
      WHERE t."tenantId" = ${tenantId}::uuid AND t."finEl" IS NOT NULL
        AND t."motivoFin" <> 'migracion'
        AND t."finEl" >= ${desde} AND t."finEl" < ${hastaExcl}
      GROUP BY 1, 2
      ORDER BY nombre
    `;
    return rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      minutos: r2(row.minutos),
      pasos: row.pasos,
      dias: row.dias,
      familias: row.familias,
      autoPausas: row.autopausas,
    }));
  }

  /**
   * Real vs. cotizado por persona (mismos filtros que la eficiencia
   * oficial de producción: sólo fuentes medidas + filtro de atípicos).
   */
  private async eficienciaPorPersona(tenantId: string, desde: Date, hastaExcl: Date) {
    return this.prisma.$queryRaw<
      Array<{ id: string | null; nombre: string; muestras: number; estimado: number; real: number }>
    >`
      SELECT p."completadoPorId" AS id, COALESCE(p."completadoPorNombre", 'Sin atribución') AS nombre,
             COUNT(*)::int AS muestras,
             COALESCE(SUM(p."duracionEstimadaMin"), 0)::float8 AS estimado,
             COALESCE(SUM(p."tiempoRealMin"), 0)::float8 AS real
      FROM "OrdenTrabajoItemPaso" p
      WHERE p."tenantId" = ${tenantId}::uuid AND p.estado = 'hecho'
        AND p."tiempoRealMin" IS NOT NULL AND p."duracionEstimadaMin" IS NOT NULL
        AND p."tiempoFuente" IN ('medido', 'medido_lote')
        AND p."tiempoRealMin" <= 480 AND p."tiempoRealMin" <= 5 * p."duracionEstimadaMin"
        AND p."completadoEl" >= ${desde} AND p."completadoEl" < ${hastaExcl}
      GROUP BY 1, 2
    `;
  }

  /** Serie semanal del desvío por persona (tendencia contra sí mismo). */
  private async eficienciaSerie(tenantId: string, desde: Date, hastaExcl: Date) {
    return this.prisma.$queryRaw<
      Array<{ nombre: string; semana: string; muestras: number; estimado: number; real: number }>
    >`
      SELECT COALESCE(p."completadoPorNombre", 'Sin atribución') AS nombre,
             to_char(date_trunc('week', p."completadoEl"), 'YYYY-MM-DD') AS semana,
             COUNT(*)::int AS muestras,
             COALESCE(SUM(p."duracionEstimadaMin"), 0)::float8 AS estimado,
             COALESCE(SUM(p."tiempoRealMin"), 0)::float8 AS real
      FROM "OrdenTrabajoItemPaso" p
      WHERE p."tenantId" = ${tenantId}::uuid AND p.estado = 'hecho'
        AND p."tiempoRealMin" IS NOT NULL AND p."duracionEstimadaMin" IS NOT NULL
        AND p."tiempoFuente" IN ('medido', 'medido_lote')
        AND p."tiempoRealMin" <= 480 AND p."tiempoRealMin" <= 5 * p."duracionEstimadaMin"
        AND p."completadoEl" >= ${desde} AND p."completadoEl" < ${hastaExcl}
      GROUP BY 1, 2
      HAVING SUM(p."duracionEstimadaMin") > 0
      ORDER BY 1, 2
    `;
  }

  /** Disciplina de registro por persona: calidad del tiempo de SUS pasos. */
  private async disciplina(
    tenantId: string,
    desde: Date,
    hastaExcl: Date,
  ): Promise<PersonaDisciplina[]> {
    const [fuentes, autoPausas] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          id: string | null;
          nombre: string;
          pasos: number;
          medidos: number;
          declarados: number;
          estimados: number;
          invalidos: number;
        }>
      >`
        SELECT p."completadoPorId" AS id, COALESCE(p."completadoPorNombre", 'Sin atribución') AS nombre,
               COUNT(*)::int AS pasos,
               COUNT(*) FILTER (WHERE p."tiempoFuente" IN ('medido', 'medido_lote'))::int AS medidos,
               COUNT(*) FILTER (WHERE p."tiempoFuente" = 'declarado')::int AS declarados,
               COUNT(*) FILTER (WHERE p."tiempoFuente" = 'estimado')::int AS estimados,
               COUNT(*) FILTER (WHERE COALESCE(p."tiempoFuente", 'invalido') = 'invalido')::int AS invalidos
        FROM "OrdenTrabajoItemPaso" p
        WHERE p."tenantId" = ${tenantId}::uuid AND p.estado = 'hecho'
          AND p."completadoEl" >= ${desde} AND p."completadoEl" < ${hastaExcl}
        GROUP BY 1, 2
        ORDER BY 2
      `,
      this.prisma.$queryRaw<Array<{ nombre: string; veces: number }>>`
        SELECT t."usuarioNombre" AS nombre, COUNT(*)::int AS veces
        FROM "OrdenTrabajoPasoTramo" t
        WHERE t."tenantId" = ${tenantId}::uuid AND t."motivoFin" = 'auto_pausa'
          AND t."finEl" >= ${desde} AND t."finEl" < ${hastaExcl}
        GROUP BY 1
      `,
    ]);
    const autoPorNombre = new Map(autoPausas.map((a) => [a.nombre, a.veces] as const));
    return fuentes.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      pasos: row.pasos,
      medidos: row.medidos,
      declarados: row.declarados,
      estimados: row.estimados,
      invalidos: row.invalidos,
      medidoPct: row.pasos > 0 ? r2((row.medidos / row.pasos) * 100) : 0,
      autoPausas: autoPorNombre.get(row.nombre) ?? 0,
    }));
  }

  /** Matriz persona × familia (minutos de tramos) — polivalencia observada. */
  private async polivalencia(
    tenantId: string,
    desde: Date,
    hastaExcl: Date,
  ): Promise<CeldaPolivalencia[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ nombre: string; familia: string; minutos: number; pasos: number }>
    >`
      SELECT t."usuarioNombre" AS nombre, p."familiaCodigo" AS familia,
             COALESCE(SUM(EXTRACT(EPOCH FROM (t."finEl" - t."inicioEl")) / 60.0), 0)::float8 AS minutos,
             COUNT(DISTINCT t."pasoId")::int AS pasos
      FROM "OrdenTrabajoPasoTramo" t
      JOIN "OrdenTrabajoItemPaso" p ON p.id = t."pasoId"
      WHERE t."tenantId" = ${tenantId}::uuid AND t."finEl" IS NOT NULL
        AND t."motivoFin" <> 'migracion'
        AND t."finEl" >= ${desde} AND t."finEl" < ${hastaExcl}
      GROUP BY 1, 2
    `;
    return rows.map((row) => ({
      nombre: row.nombre,
      familia: nombreFamilia(row.familia),
      minutos: r2(row.minutos),
      pasos: row.pasos,
    }));
  }

  /**
   * Vendedores: venta, margen (sólo items con costo snapshoteado) y
   * comisión devengada ESTIMADA según EmpleadoComision (PORCENTAJE sobre
   * el neto vendido; FIJO por orden). Sin reglas → null.
   */
  private async vendedores(
    tenantId: string,
    desde: Date,
    hastaExcl: Date,
  ): Promise<VendedorEquipo[]> {
    const [ventas, reglas] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          id: string | null;
          nombre: string;
          ordenes: number;
          facturado: number;
          ventasconcosto: number;
          costo: number;
          sincosto: number;
        }>
      >`
        SELECT ot."vendedorEmpleadoId" AS id, COALESCE(e."nombreCompleto", 'Sin vendedor') AS nombre,
               COUNT(DISTINCT ot.id)::int AS ordenes,
               COALESCE(SUM(oti.subtotal), 0)::float8 AS facturado,
               COALESCE(SUM(oti.subtotal) FILTER (WHERE ci.id IS NOT NULL), 0)::float8 AS ventasconcosto,
               COALESCE(SUM(ci."costoTotal"), 0)::float8 AS costo,
               COUNT(*) FILTER (WHERE ci.id IS NULL)::int AS sincosto
        FROM "OrdenTrabajoItem" oti
        JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
        LEFT JOIN "CotizacionItem" ci ON ci.id = oti."cotizacionItemId"
        LEFT JOIN "Empleado" e ON e.id = ot."vendedorEmpleadoId"
        WHERE oti."tenantId" = ${tenantId}::uuid AND ot.estado <> 'borrador'
          AND ot."fechaEmision" >= ${desde} AND ot."fechaEmision" < ${hastaExcl}
        GROUP BY 1, 2
        ORDER BY facturado DESC
      `,
      this.prisma.empleadoComision.findMany({
        where: { tenantId },
        select: { empleadoId: true, tipo: true, valor: true },
      }),
    ]);

    const reglasPorEmpleado = new Map<string, Array<{ tipo: string; valor: number }>>();
    for (const regla of reglas) {
      const lista = reglasPorEmpleado.get(regla.empleadoId) ?? [];
      lista.push({ tipo: regla.tipo, valor: Number(regla.valor) });
      reglasPorEmpleado.set(regla.empleadoId, lista);
    }

    return ventas.map((v) => {
      const margen = v.ventasconcosto > 0 ? v.ventasconcosto - v.costo : null;
      const reglasVendedor = v.id ? (reglasPorEmpleado.get(v.id) ?? []) : [];
      const comision = reglasVendedor.reduce(
        (acc, regla) =>
          acc + (regla.tipo === 'PORCENTAJE' ? (v.facturado * regla.valor) / 100 : regla.valor * v.ordenes),
        0,
      );
      return {
        empleadoId: v.id,
        nombre: v.nombre,
        ordenes: v.ordenes,
        facturado: r2(v.facturado),
        ticketPromedio: v.ordenes > 0 ? r2(v.facturado / v.ordenes) : 0,
        margen: margen != null ? r2(margen) : null,
        margenPct: margen != null && v.ventasconcosto > 0 ? r2((margen / v.ventasconcosto) * 100) : null,
        itemsSinCosto: v.sincosto,
        comisionEstimada: reglasVendedor.length > 0 ? r2(comision) : null,
      };
    });
  }

  /**
   * "Mi desempeño" (F2 del estudio): la vista del PROPIO operario, con
   * exactamente los mismos números y guardas que ve el supervisor en el
   * tab Equipo, pero scoped a auth.userId. Ventana fija: hoy, la semana
   * en curso y las últimas 8 semanas — tendencia contra uno mismo, sin
   * comparación con compañeros.
   */
  async miDesempeno(tenantId: string, userId: string, hoy: Date = new Date()) {
    const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const maniana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
    // Lunes de la semana en curso (getDay(): 0=domingo).
    const lunes = new Date(hoyMid);
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
    // 8 semanas: la actual + las 7 anteriores completas.
    const desde = new Date(lunes);
    desde.setDate(desde.getDate() - 7 * 7);

    const [tramos, hoyRows, eficienciaRows, eficienciaSerie, disciplinaRows, familiasRows, pausasRows] =
      await Promise.all([
        // Serie semanal de trabajo propio (constancia).
        this.prisma.$queryRaw<Array<{ semana: string; minutos: number; pasos: number; dias: number }>>`
          SELECT to_char(date_trunc('week', t."inicioEl"), 'YYYY-MM-DD') AS semana,
                 COALESCE(SUM(EXTRACT(EPOCH FROM (t."finEl" - t."inicioEl")) / 60.0), 0)::float8 AS minutos,
                 COUNT(DISTINCT t."pasoId")::int AS pasos,
                 COUNT(DISTINCT date_trunc('day', t."inicioEl"))::int AS dias
          FROM "OrdenTrabajoPasoTramo" t
          WHERE t."tenantId" = ${tenantId}::uuid AND t."usuarioId" = ${userId}::uuid
            AND t."finEl" IS NOT NULL AND t."motivoFin" <> 'migracion'
            AND t."inicioEl" >= ${desde} AND t."inicioEl" < ${maniana}
          GROUP BY 1 ORDER BY 1
        `,
        this.prisma.$queryRaw<Array<{ minutos: number; pasos: number }>>`
          SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (t."finEl" - t."inicioEl")) / 60.0), 0)::float8 AS minutos,
                 COUNT(DISTINCT t."pasoId")::int AS pasos
          FROM "OrdenTrabajoPasoTramo" t
          WHERE t."tenantId" = ${tenantId}::uuid AND t."usuarioId" = ${userId}::uuid
            AND t."finEl" IS NOT NULL AND t."motivoFin" <> 'migracion'
            AND t."inicioEl" >= ${hoyMid} AND t."inicioEl" < ${maniana}
        `,
        // Eficiencia propia: mismos filtros y guarda que el tab Equipo.
        this.prisma.$queryRaw<Array<{ muestras: number; estimado: number; real: number }>>`
          SELECT COUNT(*)::int AS muestras,
                 COALESCE(SUM(p."duracionEstimadaMin"), 0)::float8 AS estimado,
                 COALESCE(SUM(p."tiempoRealMin"), 0)::float8 AS real
          FROM "OrdenTrabajoItemPaso" p
          WHERE p."tenantId" = ${tenantId}::uuid AND p."completadoPorId" = ${userId}::uuid
            AND p.estado = 'hecho'
            AND p."tiempoRealMin" IS NOT NULL AND p."duracionEstimadaMin" IS NOT NULL
            AND p."tiempoFuente" IN ('medido', 'medido_lote')
            AND p."tiempoRealMin" <= 480 AND p."tiempoRealMin" <= 5 * p."duracionEstimadaMin"
            AND p."completadoEl" >= ${desde} AND p."completadoEl" < ${maniana}
        `,
        this.prisma.$queryRaw<Array<{ semana: string; muestras: number; estimado: number; real: number }>>`
          SELECT to_char(date_trunc('week', p."completadoEl"), 'YYYY-MM-DD') AS semana,
                 COUNT(*)::int AS muestras,
                 COALESCE(SUM(p."duracionEstimadaMin"), 0)::float8 AS estimado,
                 COALESCE(SUM(p."tiempoRealMin"), 0)::float8 AS real
          FROM "OrdenTrabajoItemPaso" p
          WHERE p."tenantId" = ${tenantId}::uuid AND p."completadoPorId" = ${userId}::uuid
            AND p.estado = 'hecho'
            AND p."tiempoRealMin" IS NOT NULL AND p."duracionEstimadaMin" IS NOT NULL
            AND p."tiempoFuente" IN ('medido', 'medido_lote')
            AND p."tiempoRealMin" <= 480 AND p."tiempoRealMin" <= 5 * p."duracionEstimadaMin"
            AND p."completadoEl" >= ${desde} AND p."completadoEl" < ${maniana}
          GROUP BY 1 HAVING SUM(p."duracionEstimadaMin") > 0 ORDER BY 1
        `,
        this.prisma.$queryRaw<
          Array<{ pasos: number; medidos: number; declarados: number; estimados: number; invalidos: number }>
        >`
          SELECT COUNT(*)::int AS pasos,
                 COUNT(*) FILTER (WHERE p."tiempoFuente" IN ('medido', 'medido_lote'))::int AS medidos,
                 COUNT(*) FILTER (WHERE p."tiempoFuente" = 'declarado')::int AS declarados,
                 COUNT(*) FILTER (WHERE p."tiempoFuente" = 'estimado')::int AS estimados,
                 COUNT(*) FILTER (WHERE COALESCE(p."tiempoFuente", 'invalido') = 'invalido')::int AS invalidos
          FROM "OrdenTrabajoItemPaso" p
          WHERE p."tenantId" = ${tenantId}::uuid AND p."completadoPorId" = ${userId}::uuid
            AND p.estado = 'hecho'
            AND p."completadoEl" >= ${desde} AND p."completadoEl" < ${maniana}
        `,
        // Familias propias: trabajo de la ventana + PRIMERA vez histórica
        // (para marcar "nueva" = polivalencia como progreso).
        this.prisma.$queryRaw<
          Array<{ familia: string; minutos: number; pasos: number; primera: Date }>
        >`
          SELECT p."familiaCodigo" AS familia,
                 COALESCE(SUM(EXTRACT(EPOCH FROM (t."finEl" - t."inicioEl")) / 60.0)
                   FILTER (WHERE t."inicioEl" >= ${desde}), 0)::float8 AS minutos,
                 COUNT(DISTINCT t."pasoId") FILTER (WHERE t."inicioEl" >= ${desde})::int AS pasos,
                 MIN(t."inicioEl") AS primera
          FROM "OrdenTrabajoPasoTramo" t
          JOIN "OrdenTrabajoItemPaso" p ON p.id = t."pasoId"
          WHERE t."tenantId" = ${tenantId}::uuid AND t."usuarioId" = ${userId}::uuid
            AND t."finEl" IS NOT NULL AND t."motivoFin" <> 'migracion'
          GROUP BY 1
        `,
        this.prisma.$queryRaw<Array<{ motivo: string; veces: number }>>`
          SELECT t."motivoFin" AS motivo, COUNT(*)::int AS veces
          FROM "OrdenTrabajoPasoTramo" t
          WHERE t."tenantId" = ${tenantId}::uuid AND t."usuarioId" = ${userId}::uuid
            AND t."finEl" IS NOT NULL
            AND t."finEl" >= ${desde} AND t."finEl" < ${maniana}
            AND t."motivoFin" NOT IN ('completado', 'bloqueo', 'migracion')
          GROUP BY 1 ORDER BY veces DESC
        `,
      ]);

    const claveLunes = `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`;
    const semanaActual = tramos.find((s) => s.semana === claveLunes) ?? { semana: claveLunes, minutos: 0, pasos: 0, dias: 0 };
    const previas = tramos.filter((s) => s.semana !== claveLunes && s.minutos > 0);
    const promedioMinutos = previas.length > 0 ? previas.reduce((a, s) => a + s.minutos, 0) / previas.length : null;

    const ef = eficienciaRows[0] ?? { muestras: 0, estimado: 0, real: 0 };
    const disc = disciplinaRows[0] ?? { pasos: 0, medidos: 0, declarados: 0, estimados: 0, invalidos: 0 };
    const autoPausas = pausasRows.find((p) => p.motivo === 'auto_pausa')?.veces ?? 0;

    const familias = familiasRows
      .filter((f) => f.pasos > 0)
      .map((f) => ({
        familia: nombreFamilia(f.familia),
        minutos: r2(f.minutos),
        pasos: f.pasos,
        /** Primera vez que trabajó esa familia dentro de la ventana. */
        nueva: f.primera >= desde,
      }))
      .sort((a, b) => b.minutos - a.minutos);

    return {
      ventana: { desde: claveFecha(desde), hasta: claveFecha(hoyMid), semanas: 8 },
      hoy: {
        minutos: r2(hoyRows[0]?.minutos ?? 0),
        pasos: hoyRows[0]?.pasos ?? 0,
      },
      semanaActual: {
        minutos: r2(semanaActual.minutos),
        pasos: semanaActual.pasos,
        dias: semanaActual.dias,
        /** vs. el promedio de TUS semanas previas con actividad; null sin historia. */
        vsPromedioPct:
          promedioMinutos != null && promedioMinutos > 0
            ? r2(((semanaActual.minutos - promedioMinutos) / promedioMinutos) * 100)
            : null,
      },
      serieSemanal: tramos.map((s) => ({
        semana: s.semana,
        minutos: r2(s.minutos),
        pasos: s.pasos,
        dias: s.dias,
      })),
      eficiencia: {
        muestras: ef.muestras,
        muestraMinima: MUESTRA_MINIMA_EFICIENCIA,
        desvioPct:
          ef.muestras >= MUESTRA_MINIMA_EFICIENCIA && ef.estimado > 0
            ? r2((ef.real / ef.estimado - 1) * 100)
            : null,
        serie: eficienciaSerie.map((s) => ({
          semana: s.semana,
          desvioPct: r2((s.real / s.estimado - 1) * 100),
          muestras: s.muestras,
        })),
      },
      disciplina: {
        pasos: disc.pasos,
        medidos: disc.medidos,
        declarados: disc.declarados,
        estimados: disc.estimados,
        invalidos: disc.invalidos,
        medidoPct: disc.pasos > 0 ? r2((disc.medidos / disc.pasos) * 100) : null,
        autoPausas,
      },
      familias,
      pausas: pausasRows.map((p) => ({
        motivo: etiquetaMotivoFin(p.motivo, null) ?? p.motivo,
        veces: p.veces,
      })),
    };
  }

  limitesMiDesempeno(): string[] {
    return [
      'Tus números, los mismos que ve tu supervisor — acá no hay comparación con compañeros.',
      `Tu precisión vs. cotizado aparece recién con ${MUESTRA_MINIMA_EFICIENCIA}+ pasos cronometrados: con menos, el número no dice nada de vos.`,
      'El tiempo es trabajo cronometrado en pasos, no tu jornada.',
    ];
  }

  limites(): string[] {
    return [
      `Eficiencia por persona: sólo con ${MUESTRA_MINIMA_EFICIENCIA}+ pasos medidos en el período y sin atípicos — con menos muestra el número es ruido, no desempeño.`,
      'El tiempo por persona es trabajo cronometrado en pasos, no asistencia: las esperas y el trabajo sin cronómetro no se cuentan.',
      'Comisión de vendedores: estimada con las reglas configuradas (porcentaje sobre neto; fijo por orden), no liquidada.',
      'Producción y ventas usan ejes distintos (usuario vs. empleado): una persona puede aparecer en uno solo.',
    ];
  }
}
