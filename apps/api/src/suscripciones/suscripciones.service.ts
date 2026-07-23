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
}
