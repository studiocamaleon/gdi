import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Traduce un evento de suscripción de una pasarela a NUESTRO estado.
 *
 * El punto de todo esto: `Suscripcion.estado` es nuestro y es lo único que
 * mira el gate por plan; el estado de la pasarela se guarda aparte, crudo. Así
 * el día que entre MercadoPago, el gate no se entera de nada.
 *
 * Regla de negocio que NO es obvia: `past_due` abre una gracia propia de siete
 * días. Durante esa ventana sigue activa y ve un aviso; vencida la gracia queda
 * en solo lectura. Un `active` posterior la desbloquea en el acto.
 * Ver docs/suscripciones-cobro-diseno.md
 */

/** Estado crudo de Paddle → nuestro estado normalizado. */
const ESTADO: Record<string, 'activa' | 'suspendida' | 'baja'> = {
  active: 'activa',
  trialing: 'activa',
  past_due: 'activa', // acceso con banner: hay ventana de dunning
  paused: 'suspendida',
  canceled: 'baja',
};

export const DIAS_GRACIA_COBRO = 7;
const DIA_MS = 86_400_000;

export type SuscripcionExterna = {
  /** subscription_id en la pasarela. */
  referencia: string;
  estadoProveedor: string;
  clienteExterno: string | null;
  proximoCobro: Date | null;
  /** Inicio del período en curso. Con `proximoCobro` da el largo real del
   *  ciclo, que es lo que permite contar los días sin asumir que son 30. */
  periodoDesde: Date | null;
  /** price_ids del evento, para resolver a qué plan corresponde. */
  precios: string[];
  /** tenantId que viajó en custom_data (lo pone nuestro checkout). */
  tenantId: string | null;
  /** Cambio programado ('cancel' | 'pause' | 'resume') y cuándo se hace
   *  efectivo. Al cancelar, Paddle deja la suscripción en `active` con esto
   *  puesto hasta el fin del período: si sólo miráramos `status`, el cliente
   *  vería "Activa" y no sabría que se termina. */
  cambioProgramado: string | null;
  cambioProgramadoEl: Date | null;
};

export type ResultadoSync =
  | {
      aplicado: true;
      tenantId: string;
      estado: string;
      planCodigo: string | null;
    }
  | { aplicado: false; motivo: string };

export type OpcionesSync = {
  /** occurred_at del webhook. Null en una consulta directa a la API. */
  ocurridoEl?: Date | null;
  /** La reconciliación registra cuándo obtuvo una respuesta autoritativa. */
  origen?: 'webhook' | 'reconciliacion' | 'accion';
  ahora?: Date;
};

@Injectable()
export class SuscripcionSyncService {
  private readonly logger = new Logger(SuscripcionSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lee lo que necesitamos del payload del evento. El payload es dato externo:
   * se navega defensivamente y se devuelve null si no tiene la forma esperada,
   * en vez de romper el webhook.
   */
  extraer(data: unknown): SuscripcionExterna | null {
    if (typeof data !== 'object' || data === null) return null;
    const d = data as Record<string, unknown>;

    // Se aceptan las dos convenciones a propósito: el SDK entrega camelCase,
    // pero si su deserialización falla caemos al JSON crudo de Paddle, que es
    // snake_case. Un solo lector para los dos caminos.
    const campo = (camel: string, snake: string): unknown =>
      d[camel] ?? d[snake];
    const texto = (camel: string, snake: string): string | null => {
      const v = campo(camel, snake);
      return typeof v === 'string' ? v : null;
    };

    const referencia = typeof d.id === 'string' ? d.id : null;
    const estadoProveedor = typeof d.status === 'string' ? d.status : null;
    if (!referencia || !estadoProveedor) return null;

    const items = Array.isArray(d.items) ? d.items : [];
    const precios = items
      .map((item) => {
        const price = (item as Record<string, unknown> | null)?.price;
        const id = (price as Record<string, unknown> | null)?.id;
        return typeof id === 'string' ? id : null;
      })
      .filter((id): id is string => id !== null);

    const custom = campo('customData', 'custom_data') as
      | Record<string, unknown>
      | null
      | undefined;
    const tenantIdCrudo = custom?.tenantId ?? custom?.tenant_id;
    const tenantId =
      typeof tenantIdCrudo === 'string' && tenantIdCrudo ? tenantIdCrudo : null;

    const proximo = texto('nextBilledAt', 'next_billed_at');
    const proximoCobro =
      proximo && !Number.isNaN(Date.parse(proximo)) ? new Date(proximo) : null;

    const periodo = campo('currentBillingPeriod', 'current_billing_period') as
      | Record<string, unknown>
      | null
      | undefined;
    const inicio =
      periodo && typeof (periodo.startsAt ?? periodo.starts_at) === 'string'
        ? String(periodo.startsAt ?? periodo.starts_at)
        : null;

    const programado = campo('scheduledChange', 'scheduled_change') as
      | Record<string, unknown>
      | null
      | undefined;
    const accion =
      programado && typeof programado.action === 'string'
        ? programado.action
        : null;
    const efectivo =
      programado &&
      typeof (programado.effectiveAt ?? programado.effective_at) === 'string'
        ? String(programado.effectiveAt ?? programado.effective_at)
        : null;

    return {
      referencia,
      estadoProveedor,
      clienteExterno: texto('customerId', 'customer_id'),
      proximoCobro,
      periodoDesde:
        inicio && !Number.isNaN(Date.parse(inicio)) ? new Date(inicio) : null,
      precios,
      tenantId,
      cambioProgramado: accion,
      cambioProgramadoEl:
        efectivo && !Number.isNaN(Date.parse(efectivo))
          ? new Date(efectivo)
          : null,
    };
  }

  /**
   * Aplica el estado externo a la suscripción del tenant.
   *
   * Resolución del tenant, en orden: primero por la referencia externa (ya
   * vinculada), y si no, por el tenantId que viajó en custom_data (primer
   * evento tras el checkout). Si no se puede resolver, NO es un error del
   * webhook: se deja constancia y se sigue — puede ser una suscripción de
   * Paddle que no corresponde a este entorno.
   */
  async aplicar(
    externa: SuscripcionExterna,
    opciones: OpcionesSync = {},
  ): Promise<ResultadoSync> {
    const estadoBase = ESTADO[externa.estadoProveedor];
    if (!estadoBase) {
      return {
        aplicado: false,
        motivo: `Estado desconocido de la pasarela: ${externa.estadoProveedor}`,
      };
    }

    const existente = await this.prisma.suscripcion.findFirst({
      where: { referenciaExterna: externa.referencia },
      select: {
        id: true,
        tenantId: true,
        moraDesde: true,
        graciaHasta: true,
        ultimoEventoProveedorEl: true,
      },
    });

    // Paddle no garantiza orden de entrega. Un evento viejo se audita, pero no
    // puede regresar una suscripción que ya fue activada por uno más nuevo.
    if (
      opciones.ocurridoEl &&
      existente?.ultimoEventoProveedorEl &&
      opciones.ocurridoEl < existente.ultimoEventoProveedorEl
    ) {
      return {
        aplicado: false,
        motivo: `Evento anterior al último aplicado (${existente.ultimoEventoProveedorEl.toISOString()}).`,
      };
    }

    const tenantId = existente?.tenantId ?? externa.tenantId;
    if (!tenantId) {
      return {
        aplicado: false,
        motivo:
          'No se pudo resolver el tenant: la suscripción no está vinculada y el evento no trae tenantId en custom_data.',
      };
    }

    // El plan sale del price_id: si el tenant hizo un upgrade en Paddle, el
    // cambio de plan se refleja solo, sin que nadie lo toque a mano acá.
    const plan = externa.precios.length
      ? await this.prisma.plan.findFirst({
          where: {
            OR: [
              { paddlePriceId: { in: externa.precios } },
              { paddlePriceIdAnual: { in: externa.precios } },
              {
                preciosLegacy: {
                  some: { priceId: { in: externa.precios } },
                },
              },
            ],
          },
          select: { id: true, codigo: true },
        })
      : null;

    const ahora = opciones.ahora ?? new Date();
    const iniciaMora =
      externa.estadoProveedor === 'past_due' && !existente?.moraDesde;
    const moraDesde =
      externa.estadoProveedor === 'past_due'
        ? (existente?.moraDesde ?? opciones.ocurridoEl ?? ahora)
        : null;
    const graciaHasta =
      externa.estadoProveedor === 'past_due'
        ? (existente?.graciaHasta ??
          new Date((moraDesde as Date).getTime() + DIAS_GRACIA_COBRO * DIA_MS))
        : null;
    const estado =
      externa.estadoProveedor === 'past_due' &&
      graciaHasta &&
      graciaHasta <= ahora
        ? 'suspendida'
        : estadoBase;

    const datos = {
      estado,
      proveedor: 'paddle',
      // El Trial es local y termina en cuanto Paddle confirma una suscripción.
      // Dejar la fecha viva haría que el cron pudiera suspender un plan pago.
      trialHasta: null,
      referenciaExterna: externa.referencia,
      clienteExternoId: externa.clienteExterno,
      estadoProveedor: externa.estadoProveedor,
      proximoCobro: externa.proximoCobro,
      periodoDesde: externa.periodoDesde,
      cambioProgramado: externa.cambioProgramado,
      cambioProgramadoEl: externa.cambioProgramadoEl,
      moraDesde,
      graciaHasta,
      ...(opciones.origen !== 'webhook'
        ? { ultimaSyncProveedorEl: ahora }
        : {}),
      ...(opciones.ocurridoEl
        ? { ultimoEventoProveedorEl: opciones.ocurridoEl }
        : {}),
      ...(plan ? { planId: plan.id } : {}),
      ...(estado === 'baja' ? { hasta: new Date() } : { hasta: null }),
    };

    const suscripcion = await this.prisma.suscripcion.findFirst({
      where: { tenantId },
      select: { id: true },
    });

    if (suscripcion) {
      await this.prisma.suscripcion.update({
        where: { id: suscripcion.id },
        data: datos,
      });
    } else {
      // Alta: sin plan resoluble no hay suscripción posible (planId es
      // obligatorio), así que se rechaza con un motivo claro en vez de
      // inventar un plan.
      if (!plan) {
        return {
          aplicado: false,
          motivo: `Alta sin plan: ningún Plan tiene paddlePriceId en [${externa.precios.join(', ')}].`,
        };
      }
      await this.prisma.suscripcion.create({
        data: { tenantId, planId: plan.id, ...datos },
      });
    }

    this.logger.log(
      `Suscripción de ${tenantId} → ${estado} (${externa.estadoProveedor})${
        iniciaMora ? `, gracia hasta ${graciaHasta?.toISOString()}` : ''
      }`,
    );
    return {
      aplicado: true,
      tenantId,
      estado,
      planCodigo: plan?.codigo ?? null,
    };
  }
}
