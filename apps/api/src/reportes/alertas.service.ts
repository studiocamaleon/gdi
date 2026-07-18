import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RentabilidadService } from './rentabilidad.service';
import { diasDelRango, type Rango } from './periodo';
import type { ActualizarUmbralesDto } from './dto/actualizar-umbrales.dto';

/**
 * Alertas — la capa de INTELIGENCIA del Panel: lee los agregados de los
 * reportes y los traduce a avisos accionables en lenguaje de dueño, con
 * severidad y link al reporte que los fundamenta. Umbrales configurables
 * por tenant. Ver docs/reportes-plan-backend.md §5.
 *
 * v1: las 5 reglas robustas con datos actuales. Las que dependen de
 * historia (margen de categoría cae N pts) o de marcado fino de tiempos
 * (eficiencia/utilización) llegan cuando esos datos maduren.
 */

const MS_DIA = 86_400_000;

export type Severidad = 'critico' | 'atencion' | 'info';
const ORDEN: Record<Severidad, number> = { critico: 0, atencion: 1, info: 2 };

export type Alerta = {
  id: string;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  /** Tab del Panel que fundamenta la alerta. */
  reporte: 'finanzas' | 'comercial' | 'produccion' | 'producto';
};

export type Umbrales = {
  diasClienteDormido: number;
  deudaVencidaPctMax: number;
  concentracionPctMax: number;
  mesesTarifaVieja: number;
  razonTiemposPctMax: number;
  utilizacionPctMin: number;
  margenPctMin: number;
};

const DEFAULTS: Umbrales = {
  diasClienteDormido: 60,
  deudaVencidaPctMax: 20,
  concentracionPctMax: 50,
  mesesTarifaVieja: 3,
  razonTiemposPctMax: 150,
  utilizacionPctMin: 40,
  margenPctMin: 25,
};

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

@Injectable()
export class AlertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rentabilidad: RentabilidadService,
  ) {}

  async getUmbrales(tenantId: string): Promise<Umbrales> {
    const row = await this.prisma.configuracionInsights.findUnique({ where: { tenantId } });
    if (!row) return { ...DEFAULTS };
    return {
      diasClienteDormido: row.diasClienteDormido,
      deudaVencidaPctMax: row.deudaVencidaPctMax,
      concentracionPctMax: row.concentracionPctMax,
      mesesTarifaVieja: row.mesesTarifaVieja,
      razonTiemposPctMax: row.razonTiemposPctMax,
      utilizacionPctMin: row.utilizacionPctMin,
      margenPctMin: row.margenPctMin,
    };
  }

  async actualizarUmbrales(tenantId: string, dto: ActualizarUmbralesDto): Promise<Umbrales> {
    const actual = await this.getUmbrales(tenantId);
    const merged = { ...actual, ...limpiar(dto) };
    await this.prisma.configuracionInsights.upsert({
      where: { tenantId },
      create: { tenantId, ...merged },
      update: merged,
    });
    return merged;
  }

  /** Evalúa todas las reglas y devuelve las alertas activas, más severas primero. */
  async activas(tenantId: string, rango: Rango, hoy: Date = new Date()): Promise<Alerta[]> {
    const umbrales = await this.getUmbrales(tenantId);
    const grupos = await Promise.all([
      this.deudaVencida(tenantId, rango, umbrales),
      this.clientesDormidos(tenantId, umbrales, hoy),
      this.concentracion(tenantId, rango, umbrales),
      this.puntoEquilibrio(tenantId, rango, hoy),
      this.tarifasViejas(tenantId, umbrales, hoy),
    ]);
    return grupos.flat().sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad]);
  }

  // 1. Deuda vencida > N% de la facturación del período. Deuda COMERCIAL:
  // órdenes finalizadas hace +30 días con saldo sin cobrar, contra lo
  // vendido finalizado del período.
  private async deudaVencida(tenantId: string, rango: Rango, u: Umbrales): Promise<Alerta[]> {
    const [row] = await this.prisma.$queryRaw<Array<{ vencido: number; facturado: number }>>`
      SELECT
        (SELECT COALESCE(SUM(GREATEST(0, total - "cobradoTotal")), 0)::float8 FROM "OrdenTrabajo"
          WHERE "tenantId" = ${tenantId}::uuid
            AND estado IN ('finalizada', 'entregada')
            AND "fechaFinalizada" < (CURRENT_DATE - 30)) AS vencido,
        (SELECT COALESCE(SUM(total), 0)::float8 FROM "OrdenTrabajo"
          WHERE "tenantId" = ${tenantId}::uuid
            AND estado IN ('finalizada', 'entregada')
            AND "fechaFinalizada" >= ${rango.desde} AND "fechaFinalizada" < ${finExclusivo(rango)}) AS facturado
    `;
    const vencido = row?.vencido ?? 0;
    const facturado = row?.facturado ?? 0;
    if (vencido <= 0) return [];
    const pct = facturado > 0 ? (vencido / facturado) * 100 : Infinity;
    if (pct <= u.deudaVencidaPctMax) return [];
    return [
      {
        id: 'deuda-vencida',
        severidad: pct > u.deudaVencidaPctMax * 2 ? 'critico' : 'atencion',
        titulo: 'Deuda vencida alta',
        detalle:
          facturado > 0
            ? `${pesos(vencido)} vencidos (+30 días): ${Math.round(pct)}% de la facturación del período.`
            : `${pesos(vencido)} vencidos (+30 días) sin facturación en el período.`,
        reporte: 'finanzas',
      },
    ];
  }

  // 2. Clientes recurrentes que dejaron de comprar.
  private async clientesDormidos(tenantId: string, u: Umbrales, hoy: Date): Promise<Alerta[]> {
    const rows = await this.prisma.$queryRaw<Array<{ ordenes: number; ultima: Date }>>`
      SELECT COUNT(DISTINCT ot.id)::int AS ordenes, MAX(ot."fechaEmision") AS ultima
      FROM "OrdenTrabajo" ot
      WHERE ot."tenantId" = ${tenantId}::uuid AND ot.estado <> 'borrador'
        AND ot."clienteId" IS NOT NULL AND ot."fechaEmision" IS NOT NULL
      GROUP BY ot."clienteId"
    `;
    const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const dormidos = rows.filter(
      (r) =>
        r.ordenes >= 2 &&
        Math.floor((hoyMid.getTime() - r.ultima.getTime()) / MS_DIA) > u.diasClienteDormido,
    ).length;
    if (dormidos === 0) return [];
    return [
      {
        id: 'clientes-dormidos',
        severidad: 'atencion',
        titulo: `${dormidos} cliente${dormidos > 1 ? 's' : ''} recurrente${dormidos > 1 ? 's' : ''} sin comprar`,
        detalle: `Dejaron de ordenar hace más de ${u.diasClienteDormido} días teniendo historial. Reactivá el contacto.`,
        reporte: 'comercial',
      },
    ];
  }

  // 3. Concentración de cartera en el top-3.
  private async concentracion(tenantId: string, rango: Rango, u: Umbrales): Promise<Alerta[]> {
    const rows = await this.prisma.$queryRaw<Array<{ facturado: number }>>`
      SELECT COALESCE(SUM(oti.subtotal), 0)::float8 AS facturado
      FROM "OrdenTrabajoItem" oti
      JOIN "OrdenTrabajo" ot ON ot.id = oti."ordenId"
      WHERE oti."tenantId" = ${tenantId}::uuid AND ot.estado <> 'borrador'
        AND ot."fechaEmision" >= ${rango.desde} AND ot."fechaEmision" < ${finExclusivo(rango)}
      GROUP BY ot."clienteId"
      ORDER BY facturado DESC
    `;
    const total = rows.reduce((a, r) => a + r.facturado, 0);
    if (total <= 0 || rows.length < 3) return [];
    const top3 = rows.slice(0, 3).reduce((a, r) => a + r.facturado, 0);
    const pct = (top3 / total) * 100;
    if (pct <= u.concentracionPctMax) return [];
    return [
      {
        id: 'concentracion',
        severidad: pct > 70 ? 'atencion' : 'info',
        titulo: 'Cartera concentrada',
        detalle: `Tus 3 clientes principales concentran el ${Math.round(pct)}% de la facturación del período.`,
        reporte: 'comercial',
      },
    ];
  }

  // 4. Por debajo del punto de equilibrio para lo transcurrido del período.
  private async puntoEquilibrio(tenantId: string, rango: Rango, hoy: Date): Promise<Alerta[]> {
    const p = await this.rentabilidad.periodo(tenantId, rango);
    if (p.puntoEquilibrio === null || p.avancePct === null) return [];
    // Progreso esperado: fracción del período ya transcurrida (100% si es pasado).
    const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const total = diasDelRango(rango);
    const transcurridos =
      hoyMid >= rango.hasta
        ? total
        : Math.max(0, Math.round((hoyMid.getTime() - rango.desde.getTime()) / MS_DIA) + 1);
    const esperadoPct = total > 0 ? Math.min(100, (transcurridos / total) * 100) : 100;
    if (p.avancePct >= esperadoPct) return [];
    return [
      {
        id: 'punto-equilibrio',
        severidad: p.avancePct < esperadoPct / 2 ? 'critico' : 'atencion',
        titulo: 'Por debajo del punto de equilibrio',
        detalle: `Vas al ${Math.round(p.avancePct)}% del punto de equilibrio (${pesos(p.puntoEquilibrio)}); para lo transcurrido del período deberías ir cerca del ${Math.round(esperadoPct)}%.`,
        reporte: 'finanzas',
      },
    ];
  }

  // 5. Centros con tarifas sin actualizar hace muchos meses.
  private async tarifasViejas(tenantId: string, u: Umbrales, hoy: Date): Promise<Alerta[]> {
    const rows = await this.prisma.$queryRaw<Array<{ centro: string; ultimo: string }>>`
      SELECT cc.nombre AS centro, MAX(t.periodo) AS ultimo
      FROM "CentroCostoTarifaPeriodo" t
      JOIN "CentroCosto" cc ON cc.id = t."centroCostoId"
      WHERE t."tenantId" = ${tenantId}::uuid
      GROUP BY cc.nombre
    `;
    const mesActual = hoy.getFullYear() * 12 + hoy.getMonth();
    const viejos = rows.filter((r) => {
      const [y, m] = r.ultimo.split('-').map(Number);
      return mesActual - (y * 12 + (m - 1)) > u.mesesTarifaVieja;
    });
    if (viejos.length === 0) return [];
    return [
      {
        id: 'tarifas-viejas',
        severidad: 'atencion',
        titulo: 'Tarifas desactualizadas',
        detalle: `${viejos.length} centro(s) con tarifas de hace más de ${u.mesesTarifaVieja} meses: ${viejos
          .map((v) => v.centro)
          .slice(0, 4)
          .join(', ')}. Con inflación, estás subvaluando el costo.`,
        reporte: 'finanzas',
      },
    ];
  }
}

function finExclusivo(rango: Rango): Date {
  return new Date(
    rango.hasta.getFullYear(),
    rango.hasta.getMonth(),
    rango.hasta.getDate() + 1,
  );
}

function limpiar(dto: ActualizarUmbralesDto): Partial<Umbrales> {
  const out: Partial<Umbrales> = {};
  for (const [k, v] of Object.entries(dto)) {
    if (typeof v === 'number') (out as Record<string, number>)[k] = v;
  }
  return out;
}
