import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Lecturas de la suscripción de un tenant — el ÚNICO lugar que interpreta
 * `Plan.featuresJson`. Los services de negocio preguntan `feature(tenantId,
 * 'afip')` y nunca leen el JSON directo: un solo lugar decide qué incluye un
 * plan (docs/control-plane-diseno.md).
 *
 * Sin suscripción = tenant LEGACY (anterior a los planes): se lo trata como
 * ilimitado a propósito — grandfathered. Los gates recién muerden cuando el
 * control plane le asigna un plan; así la llegada de los planes no apaga
 * nada que hoy funciona.
 *
 * Las escrituras NO viven acá: cambiar el plan de un tenant es un acto del
 * control plane, auditado en PlataformaEvento (plataforma.service).
 */

export type FeaturePlan = 'afip' | 'whatsapp';

export type LimitesPlan = {
  usuariosMax: number | null;
  ordenesMesMax: number | null;
  storageGb: number | null;
};

type Features = {
  afip?: boolean;
  whatsapp?: boolean;
  usuariosMax?: number;
  ordenesMesMax?: number;
  storageGb?: number;
};

export type SuscripcionDe = {
  planCodigo: string;
  planNombre: string;
  precioMensual: number;
  estado: string;
  desde: string;
} | null;

export type PlanContratable = {
  codigo: string;
  nombre: string;
  precioMensual: number;
  moneda: string;
  features: Record<string, unknown>;
  /** El precio en Paddle: sin esto el plan no se puede contratar. */
  priceId: string;
  esActual: boolean;
};

export type EstadoSuscripcion = {
  actual: {
    planCodigo: string;
    planNombre: string;
    precioMensual: number;
    moneda: string;
    /** Nuestro estado normalizado: el que manda para el acceso. */
    estado: string;
    /** El crudo de la pasarela — 'past_due' enciende el aviso de pago. */
    estadoProveedor: string | null;
    proveedor: string;
    proximoCobro: string | null;
    desde: string;
  } | null;
  planes: PlanContratable[];
  checkout: { tenantId: string; email: string };
};

@Injectable()
export class SuscripcionesService {
  constructor(private readonly prisma: PrismaService) {}

  /** La suscripción del tenant con su plan, o null (legacy, sin plan). */
  async de(tenantId: string): Promise<SuscripcionDe> {
    const s = await this.prisma.suscripcion.findFirst({
      where: { tenantId },
      include: { plan: true },
    });
    if (!s) return null;
    return {
      planCodigo: s.plan.codigo,
      planNombre: s.plan.nombre,
      precioMensual: Number(s.plan.precioMensual),
      estado: s.estado,
      desde: s.desde.toISOString(),
    };
  }

  /**
   * ¿El plan del tenant incluye este feature? Sin suscripción → true
   * (grandfathered); con suscripción suspendida → false (no se paga, no hay
   * feature); con plan → lo que diga el plan.
   */
  async feature(tenantId: string, clave: FeaturePlan): Promise<boolean> {
    const s = await this.prisma.suscripcion.findFirst({
      where: { tenantId },
      include: { plan: { select: { featuresJson: true } } },
    });
    if (!s) return true;
    if (s.estado !== 'activa') return false;
    const features = (s.plan.featuresJson ?? {}) as Features;
    return features[clave] === true;
  }

  /** Los topes del plan, o todos null (legacy / sin límite). */
  async limites(tenantId: string): Promise<LimitesPlan> {
    const s = await this.prisma.suscripcion.findFirst({
      where: { tenantId },
      include: { plan: { select: { featuresJson: true } } },
    });
    const f = (s?.plan.featuresJson ?? {}) as Features;
    return {
      usuariosMax: f.usuariosMax ?? null,
      ordenesMesMax: f.ordenesMesMax ?? null,
      storageGb: f.storageGb ?? null,
    };
  }

  /**
   * Todo lo que la vista de suscripción del tenant necesita: su plan actual y
   * a cuáles puede pasarse.
   *
   * Sólo se ofrecen los planes VINCULADOS a Paddle (`paddlePriceId`): sin
   * precio en la pasarela no hay checkout posible. Por eso el plan "trial",
   * que es gratis y se asigna desde el control plane, no aparece como opción
   * contratable — aparece sólo si es el actual.
   */
  async estadoParaTenant(
    tenantId: string,
    email: string,
  ): Promise<EstadoSuscripcion> {
    const [suscripcion, planes] = await Promise.all([
      this.prisma.suscripcion.findFirst({
        where: { tenantId },
        include: { plan: true },
      }),
      this.prisma.plan.findMany({
        where: { activo: true },
        orderBy: { orden: 'asc' },
      }),
    ]);

    const contratables = planes.filter((p) => p.paddlePriceId !== null);

    return {
      actual: suscripcion
        ? {
            planCodigo: suscripcion.plan.codigo,
            planNombre: suscripcion.plan.nombre,
            precioMensual: Number(suscripcion.plan.precioMensual),
            moneda: suscripcion.plan.moneda,
            estado: suscripcion.estado,
            estadoProveedor: suscripcion.estadoProveedor,
            proveedor: suscripcion.proveedor,
            proximoCobro: suscripcion.proximoCobro?.toISOString() ?? null,
            desde: suscripcion.desde.toISOString(),
          }
        : null,
      planes: contratables.map((p) => ({
        codigo: p.codigo,
        nombre: p.nombre,
        precioMensual: Number(p.precioMensual),
        moneda: p.moneda,
        features: (p.featuresJson ?? {}) as Record<string, unknown>,
        priceId: p.paddlePriceId as string,
        esActual: p.id === suscripcion?.planId,
      })),
      // Lo que el front le pasa a Paddle.js. El tenantId sale de la SESIÓN,
      // no de la pantalla: es lo que el webhook usa para saber a quién
      // corresponde la suscripción que se acaba de crear.
      checkout: { tenantId, email },
    };
  }
}
