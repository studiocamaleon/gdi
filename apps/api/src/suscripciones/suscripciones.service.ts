import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleService } from '../cobro/paddle.service';
import { SuscripcionSyncService } from '../cobro/suscripcion-sync.service';
import { estadoDePrueba, type EstadoPrueba } from './trial';

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
  descripcion: string | null;
  precioMensual: number;
  moneda: string;
  features: Record<string, unknown>;
  /** El precio en Paddle: sin esto el plan no se puede contratar. */
  priceId: string;
  esActual: boolean;
  /** Variante anual. Null si el plan sólo se vende mensual. */
  anual: {
    priceId: string;
    precio: number;
    /** Lo que costaría un año pagando mes a mes: la referencia del ahorro. */
    doceMeses: number;
    /** Cuánto se ahorra en el año. */
    ahorro: number;
    ahorroPct: number;
    /** El anual prorrateado, para comparar peras con peras. */
    equivalenteMensual: number;
  } | null;
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
  /** Estado de la prueba gratuita (calculado, nunca guardado). */
  prueba: EstadoPrueba;
  /** Comprobantes que emitió PADDLE (es Merchant of Record, no los emitimos
   *  nosotros). Vacío mientras no haya cobros. */
  facturas: FacturaSuscripcion[];
  /** Hay cliente en la pasarela → se puede abrir el portal de autogestión. */
  puedePortal: boolean;
  /** Ya hay suscripción viva en la pasarela: cambiar de plan NO abre checkout,
   *  se modifica la existente con prorrateo y la tarjeta en archivo. */
  puedeCambiarSinPago: boolean;
};

export type FacturaSuscripcion = {
  id: string;
  numero: string | null;
  fecha: string | null;
  total: number;
  moneda: string;
  estado: string;
};

@Injectable()
export class SuscripcionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleService,
    private readonly sync: SuscripcionSyncService,
  ) {}

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
    email = '',
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

    // Las facturas se piden sólo si el tenant ya es cliente en la pasarela.
    // Si Paddle no responde, la lista viene vacía y la vista lo dice — nunca
    // se rompe la pantalla por una lectura auxiliar.
    const clienteExterno = suscripcion?.clienteExternoId ?? null;
    const facturas = clienteExterno
      ? await this.paddle.listarFacturas(clienteExterno)
      : [];

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
      planes: contratables.map((p) => {
        const mensual = Number(p.precioMensual);
        const anual =
          p.paddlePriceIdAnual && p.precioAnual !== null
            ? this.compararAnual(
                mensual,
                Number(p.precioAnual),
                p.paddlePriceIdAnual,
              )
            : null;
        return {
          codigo: p.codigo,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precioMensual: mensual,
          moneda: p.moneda,
          features: (p.featuresJson ?? {}) as Record<string, unknown>,
          priceId: p.paddlePriceId as string,
          esActual: p.id === suscripcion?.planId,
          anual,
        };
      }),
      // Lo que el front le pasa a Paddle.js. El tenantId sale de la SESIÓN,
      // no de la pantalla: es lo que el webhook usa para saber a quién
      // corresponde la suscripción que se acaba de crear.
      checkout: { tenantId, email },
      facturas,
      puedePortal: clienteExterno !== null,
      puedeCambiarSinPago:
        suscripcion?.proveedor === 'paddle' &&
        !!suscripcion.referenciaExterna &&
        suscripcion.estado !== 'baja',
      prueba: estadoDePrueba(suscripcion?.trialHasta),
    };
  }

  /**
   * El ahorro del ciclo anual contra pagar doce meses sueltos.
   *
   * Se calcula acá y no en el front para que el número sea uno solo: la misma
   * cuenta en dos lugares termina divergiendo. "US$500/año" no dice nada;
   * "ahorrás US$100" sí.
   */
  private compararAnual(mensual: number, anual: number, priceId: string) {
    const doceMeses = mensual * 12;
    const ahorro = doceMeses - anual;
    return {
      priceId,
      precio: anual,
      doceMeses,
      ahorro: Math.round(ahorro * 100) / 100,
      ahorroPct: doceMeses > 0 ? Math.round((ahorro / doceMeses) * 100) : 0,
      equivalenteMensual: Math.round((anual / 12) * 100) / 100,
    };
  }

  /**
   * Cambia el plan de un tenant que YA tiene suscripción en la pasarela.
   *
   * No abre checkout: modifica la suscripción existente con prorrateo y usa la
   * tarjeta en archivo. Abrir un checkout nuevo le crearía una SEGUNDA
   * suscripción y le cobrarían las dos — ese es el bug que esto evita.
   *
   * Aplica el resultado EN EL ACTO (no espera el webhook): el usuario acaba de
   * pedir el cambio y tiene que verlo hecho.
   */
  async cambiarPlanDeTenant(
    tenantId: string,
    planCodigo: string,
    ciclo: 'mensual' | 'anual',
  ): Promise<EstadoSuscripcion> {
    const [suscripcion, plan] = await Promise.all([
      this.prisma.suscripcion.findFirst({
        where: { tenantId },
        select: { referenciaExterna: true, proveedor: true },
      }),
      this.prisma.plan.findFirst({
        where: { codigo: planCodigo, activo: true },
      }),
    ]);
    if (!plan) throw new NotFoundException('El plan no existe.');
    if (!suscripcion?.referenciaExterna || suscripcion.proveedor !== 'paddle') {
      throw new BadRequestException(
        'Todavía no hay una suscripción activa en la pasarela: contratá un plan primero.',
      );
    }
    const priceId =
      ciclo === 'anual' ? plan.paddlePriceIdAnual : plan.paddlePriceId;
    if (!priceId) {
      throw new BadRequestException(
        `El plan ${plan.nombre} no tiene precio ${ciclo} configurado.`,
      );
    }

    const actualizada = await this.paddle.cambiarPlan(
      suscripcion.referenciaExterna,
      priceId,
    );
    if (!actualizada) {
      throw new BadRequestException(
        'La pasarela no pudo aplicar el cambio de plan. Probá de nuevo en un momento.',
      );
    }
    const externa = this.sync.extraer(actualizada);
    if (externa) await this.sync.aplicar(externa);
    return this.estadoParaTenant(tenantId, '');
  }

  /** Qué le van a cobrar ahora por el cambio, antes de confirmarlo. */
  async previsualizarCambio(
    tenantId: string,
    planCodigo: string,
    ciclo: 'mensual' | 'anual',
  ): Promise<{ monto: number; moneda: string } | null> {
    const [s, plan] = await Promise.all([
      this.prisma.suscripcion.findFirst({
        where: { tenantId },
        select: { referenciaExterna: true },
      }),
      this.prisma.plan.findFirst({
        where: { codigo: planCodigo, activo: true },
      }),
    ]);
    const priceId =
      ciclo === 'anual' ? plan?.paddlePriceIdAnual : plan?.paddlePriceId;
    if (!s?.referenciaExterna || !priceId) return null;
    return this.paddle.previsualizarCambio(s.referenciaExterna, priceId);
  }

  /**
   * Trae el alta recién hecha desde la pasarela, sin esperar el webhook.
   *
   * Se llama apenas cierra el checkout: el usuario pagó y tiene que ver el
   * resultado ya. El webhook sigue existiendo como respaldo y es idempotente,
   * así que si llega después no duplica nada.
   */
  async sincronizarDesdeTransaccion(
    tenantId: string,
    transaccionId: string,
  ): Promise<EstadoSuscripcion> {
    const sub = await this.paddle.suscripcionDeTransaccion(transaccionId);
    if (sub) {
      const externa = this.sync.extraer(sub);
      if (externa) await this.sync.aplicar(externa);
    }
    return this.estadoParaTenant(tenantId, '');
  }

  /**
   * Abre el portal de autogestión de Paddle para este tenant: medio de pago,
   * facturas y cancelación. Se delega a propósito — son datos de tarjeta y
   * flujos fiscales que no queremos tocar ni almacenar.
   */
  async portalDeTenant(tenantId: string): Promise<{ url: string } | null> {
    const s = await this.prisma.suscripcion.findFirst({
      where: { tenantId },
      select: { clienteExternoId: true, referenciaExterna: true },
    });
    if (!s?.clienteExternoId) return null;
    const urls = await this.paddle.crearSesionPortal(
      s.clienteExternoId,
      s.referenciaExterna ? [s.referenciaExterna] : [],
    );
    const url = urls?.general || urls?.suscripcion;
    return url ? { url } : null;
  }
}
