import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { finDeDia, type Rango } from './periodo';

/**
 * Embudo comercial — la salud del pipeline cotización → producción, no la
 * performance de ventas cerradas (eso vive en Ventas). Mide una COHORTE de
 * presupuestos formales emitidos en el rango y hasta dónde avanzó cada uno,
 * con semántica "alcanzó al menos" para que el funnel decrezca de forma
 * monótona. Cierra en Entregadas (el eje fiscal queda en Finanzas).
 * Ver docs/embudo-comercial-panel-diseno.md
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const MS_DIA = 86_400_000;

/** OrdenTrabajo.estado es lineal: rank para "alcanzó al menos esta etapa". */
const RANK_OT: Record<string, number> = {
  borrador: 0,
  pendiente: 1,
  produccion: 2,
  finalizada: 3,
  entregada: 4,
};
const rankOt = (estado: string): number => RANK_OT[estado] ?? 0;

/** Presupuesto aprobado = llegó a aprobado o ya se convirtió en OT. */
const ESTADOS_APROBADO = ['aprobado', 'convertido'];

export type EmbudoEtapa = {
  clave: 'emitidas' | 'aprobadas' | 'produccion' | 'entregadas';
  label: string;
  cantidad: number;
  monto: number;
  sharePct: number;
  conversionPct: number | null;
};
export type EmbudoFuga = { motivo: string; cantidad: number; monto: number };
export type EmbudoVelocidad = { tramo: string; diasPromedio: number | null };

type CotizacionCohorte = {
  id: string;
  estado: string;
  subtotal: unknown;
  fechaEnvio: Date | null;
  fechaResuelto: Date | null;
  motivoPerdida: string | null;
  convertidaOrdenId: string | null;
};
type OrdenCohorte = {
  id: string;
  estado: string;
  subtotal: unknown;
  fechaEmision: Date | null;
  fechaFinalizada: Date | null;
};

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const dias = (desde: Date, hasta: Date): number =>
  (hasta.getTime() - desde.getTime()) / MS_DIA;

/** Promedio de una lista de días; null si no hay muestras. */
function promedio(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return r2(valores.reduce((a, b) => a + b, 0) / valores.length);
}

/** Etiqueta humana de cada bucket de fuga. */
const LABEL_FUGA: Record<string, string> = {
  precio: 'Precio',
  plazo: 'Plazo',
  sin_respuesta: 'Sin respuesta',
  competencia: 'Competencia',
  otro: 'Otro',
  vencido: 'Vencidas',
  en_gestion: 'En gestión (sin resolver)',
};

@Injectable()
export class EmbudoService {
  constructor(private readonly prisma: PrismaService) {}

  async embudo(tenantId: string, rango: Rango, anterior: Rango) {
    const hasta = finDeDia(rango);

    // 1) Cohorte: presupuestos FORMALES (con número) enviados en el rango.
    const cotizaciones = (await this.prisma.cotizacion.findMany({
      where: {
        tenantId,
        numero: { not: null },
        fechaEnvio: { gte: rango.desde, lte: hasta },
      },
      select: {
        id: true,
        estado: true,
        subtotal: true,
        fechaEnvio: true,
        fechaResuelto: true,
        motivoPerdida: true,
        convertidaOrdenId: true,
      },
    })) as CotizacionCohorte[];

    // 2) OTs de la cohorte (una lectura, sin N+1).
    const ordenIds = cotizaciones
      .map((c) => c.convertidaOrdenId)
      .filter((id): id is string => id != null);
    const ordenes = ordenIds.length
      ? ((await this.prisma.ordenTrabajo.findMany({
          where: { tenantId, id: { in: ordenIds } },
          select: {
            id: true,
            estado: true,
            subtotal: true,
            fechaEmision: true,
            fechaFinalizada: true,
          },
        })) as OrdenCohorte[])
      : [];
    const otPorId = new Map(ordenes.map((o) => [o.id, o]));
    const otDe = (c: CotizacionCohorte): OrdenCohorte | undefined =>
      c.convertidaOrdenId ? otPorId.get(c.convertidaOrdenId) : undefined;

    // 3) Pipeline abierto HOY (KPI, independiente de la cohorte del rango).
    const pipeline = await this.prisma.cotizacion.aggregate({
      where: { tenantId, numero: { not: null }, estado: 'enviado' },
      _count: { _all: true },
      _sum: { subtotal: true },
    });

    // 4) Comparativa (tasa de aprobación anterior) + OTs manuales sin
    //    presupuesto emitidas en el rango (quedan fuera del embudo → límite).
    const [emitidasAnt, aprobadasAnt, otManualesFuera] = await Promise.all([
      this.prisma.cotizacion.count({
        where: {
          tenantId,
          numero: { not: null },
          fechaEnvio: { gte: anterior.desde, lte: finDeDia(anterior) },
        },
      }),
      this.prisma.cotizacion.count({
        where: {
          tenantId,
          numero: { not: null },
          estado: { in: ESTADOS_APROBADO },
          fechaEnvio: { gte: anterior.desde, lte: finDeDia(anterior) },
        },
      }),
      this.prisma.ordenTrabajo.count({
        where: {
          tenantId,
          cotizacionId: null,
          estado: { not: 'borrador' },
          fechaEmision: { gte: rango.desde, lte: hasta },
        },
      }),
    ]);

    // ── Etapas (montos: presupuesto en emitidas/aprobadas; OT en prod/entrega) ──
    const emitidas = cotizaciones;
    const aprobadas = cotizaciones.filter((c) =>
      ESTADOS_APROBADO.includes(c.estado),
    );
    const enProduccion = cotizaciones.filter((c) => {
      const ot = otDe(c);
      return ot != null && rankOt(ot.estado) >= RANK_OT.produccion;
    });
    const entregadas = cotizaciones.filter((c) => {
      const ot = otDe(c);
      return ot != null && ot.estado === 'entregada';
    });

    // Montos NETOS (subtotal, sin IVA) para hablar el mismo idioma que el
    // resto del Panel (Ventas = SUM(subtotal)).
    const sumCot = (xs: CotizacionCohorte[]) =>
      r2(xs.reduce((a, c) => a + num(c.subtotal), 0));
    // Monto por la OT si existe (refleja lo que entró a producir); si no, el
    // presupuesto. Ver decisión B del diseño.
    const sumOt = (xs: CotizacionCohorte[]) =>
      r2(xs.reduce((a, c) => a + num(otDe(c)?.subtotal ?? c.subtotal), 0));

    const crudas: Array<Omit<EmbudoEtapa, 'sharePct' | 'conversionPct'>> = [
      { clave: 'emitidas', label: 'Cotizaciones emitidas', cantidad: emitidas.length, monto: sumCot(emitidas) },
      { clave: 'aprobadas', label: 'Aprobadas', cantidad: aprobadas.length, monto: sumCot(aprobadas) },
      { clave: 'produccion', label: 'En producción', cantidad: enProduccion.length, monto: sumOt(enProduccion) },
      { clave: 'entregadas', label: 'Entregadas', cantidad: entregadas.length, monto: sumOt(entregadas) },
    ];
    const base = crudas[0].cantidad;
    const funnel: EmbudoEtapa[] = crudas.map((e, i) => ({
      ...e,
      sharePct: base > 0 ? r2((e.cantidad / base) * 100) : 0,
      conversionPct:
        i === 0
          ? null
          : crudas[i - 1].cantidad > 0
            ? r2((e.cantidad / crudas[i - 1].cantidad) * 100)
            : 0,
    }));

    // ── Dónde se pierde: no aprobados, por motivo (reconcilia a emitidas−aprobadas) ──
    const fugasMap = new Map<string, { cantidad: number; monto: number }>();
    for (const c of cotizaciones) {
      if (ESTADOS_APROBADO.includes(c.estado)) continue;
      const motivo =
        c.estado === 'vencido'
          ? 'vencido'
          : c.estado === 'enviado'
            ? 'en_gestion'
            : (c.motivoPerdida ?? 'otro');
      const acc = fugasMap.get(motivo) ?? { cantidad: 0, monto: 0 };
      acc.cantidad += 1;
      acc.monto += num(c.subtotal);
      fugasMap.set(motivo, acc);
    }
    const fugas: EmbudoFuga[] = [...fugasMap.entries()]
      .map(([motivo, v]) => ({
        motivo: LABEL_FUGA[motivo] ?? motivo,
        cantidad: v.cantidad,
        monto: r2(v.monto),
      }))
      .sort((a, b) => b.cantidad - a.cantidad);

    // ── Velocidad del ciclo (sólo sobre los que completaron cada tramo) ──
    const tEmitidaAprobada = aprobadas
      .filter((c) => c.fechaEnvio && c.fechaResuelto)
      .map((c) => dias(c.fechaEnvio as Date, c.fechaResuelto as Date));
    const tAprobadaProduccion = enProduccion
      .map((c) => ({ c, ot: otDe(c) }))
      .filter((x) => x.c.fechaResuelto && x.ot?.fechaEmision)
      .map((x) => dias(x.c.fechaResuelto as Date, x.ot!.fechaEmision as Date));
    const tProduccionEntrega = ordenes
      .filter((o) => o.fechaEmision && o.fechaFinalizada)
      .map((o) => dias(o.fechaEmision as Date, o.fechaFinalizada as Date));
    const velocidad: EmbudoVelocidad[] = [
      { tramo: 'Emitida → aprobada', diasPromedio: promedio(tEmitidaAprobada) },
      { tramo: 'Aprobada → producción', diasPromedio: promedio(tAprobadaProduccion) },
      { tramo: 'Producción → entrega', diasPromedio: promedio(tProduccionEntrega) },
    ];

    // Ciclo total: emitida → entrega (sobre los que llegaron a finalizar).
    const tCicloTotal = cotizaciones
      .map((c) => ({ c, ot: otDe(c) }))
      .filter((x) => x.c.fechaEnvio && x.ot?.fechaFinalizada)
      .map((x) => dias(x.c.fechaEnvio as Date, x.ot!.fechaFinalizada as Date));

    const tasaAprobacion = base > 0 ? r2((aprobadas.length / base) * 100) : 0;
    const tasaAprobacionAnt =
      emitidasAnt > 0 ? (aprobadasAnt / emitidasAnt) * 100 : null;

    return {
      sinComparativa: emitidasAnt === 0,
      otManualesFuera,
      kpis: {
        tasaAprobacion,
        tasaAprobacionDeltaPct:
          tasaAprobacionAnt == null ? null : r2(tasaAprobacion - tasaAprobacionAnt),
        tasaEntrega: base > 0 ? r2((entregadas.length / base) * 100) : 0,
        pipelineAbiertoCantidad: pipeline._count._all,
        pipelineAbiertoMonto: r2(num(pipeline._sum.subtotal)),
        cicloPromedioDias: promedio(tCicloTotal),
      },
      funnel,
      fugas,
      velocidad,
    };
  }

  /** Límites que viajan en la `meta` — honestidad del embudo. */
  limites(otManualesFuera: number): string[] {
    const l = [
      'Cohorte: presupuestos formales enviados en el rango; se mide hasta dónde llegó cada uno.',
      'Cohortes recientes tienen menos tiempo de madurar: su conversión sube con el tiempo.',
      'Velocidad: promedio sólo sobre los presupuestos que completaron cada tramo.',
      'Pipeline abierto: valor a hoy, no de la cohorte del rango.',
    ];
    if (otManualesFuera > 0) {
      l.push(
        `${otManualesFuera} OT sin presupuesto de origen quedan fuera del embudo.`,
      );
    }
    return l;
  }
}
