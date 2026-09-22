import { Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleService } from './paddle.service';
import { resolverContratoOferta } from './contrato-oferta-paddle';

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
  actualizadoEl?: Date | null;
  estadoProveedor: string;
  clienteExterno: string | null;
  proximoCobro: Date | null;
  /** Inicio del período en curso. Con `proximoCobro` da el largo real del
   *  ciclo, que es lo que permite contar los días sin asumir que son 30. */
  periodoDesde: Date | null;
  /** price_ids del evento, para resolver a qué plan corresponde. */
  precios: string[];
  /** Cantidades confirmadas por el proveedor. Null si el payload es incompleto. */
  items?: { priceId: string; quantity: number }[] | null;
  /** tenantId que viajó en custom_data (lo pone nuestro checkout). */
  tenantId: string | null;
  contratacionId?: string | null;
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
      advertencia?: string;
    }
  | { aplicado: false; motivo: string };

export type OpcionesSync = {
  /** occurred_at del webhook. Null en una consulta directa a la API. */
  ocurridoEl?: Date | null;
  /** La reconciliación registra cuándo obtuvo una respuesta autoritativa. */
  origen?: 'webhook' | 'reconciliacion' | 'accion';
  ahora?: Date;
  consultadaDesde?: Date;
  suscripcionEsperada?: { id: string; tenantId: string; referencia: string };
};

@Injectable()
export class SuscripcionSyncService {
  private readonly logger = new Logger(SuscripcionSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly paddle?: PaddleService,
  ) {}

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
      actualizadoEl: (() => {
        const v = texto('updatedAt', 'updated_at');
        return v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null;
      })(),
      estadoProveedor,
      clienteExterno: texto('customerId', 'customer_id'),
      proximoCobro,
      periodoDesde:
        inicio && !Number.isNaN(Date.parse(inicio)) ? new Date(inicio) : null,
      precios,
      items: items.every((item) => {
        const i = item as {
          price?: { id?: unknown };
          quantity?: unknown;
        } | null;
        return (
          typeof i?.price?.id === 'string' &&
          typeof i.quantity === 'number' &&
          Number.isInteger(i.quantity) &&
          i.quantity > 0
        );
      })
        ? items.map((item) => {
            const i = item as { price: { id: string }; quantity: number };
            return { priceId: i.price.id, quantity: i.quantity };
          })
        : null,
      tenantId,
      contratacionId:
        typeof custom?.contratacionId === 'string'
          ? custom.contratacionId
          : null,
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
    return this.prisma.$transaction((tx) =>
      this.aplicarEnTransaccion(tx, externa, opciones),
    );
  }

  /** Estado y auditoría del solicitante pueden confirmarse en la misma transacción. */
  async aplicarEnTransaccion(
    tx: Prisma.TransactionClient,
    externa: SuscripcionExterna,
    opciones: OpcionesSync = {},
  ): Promise<ResultadoSync> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`paddle:${externa.referencia}`}, 0))::text`;
    const estadoBase = ESTADO[externa.estadoProveedor];
    if (!estadoBase) {
      return {
        aplicado: false,
        motivo: `Estado desconocido de la pasarela: ${externa.estadoProveedor}`,
      };
    }

    let existente = await tx.suscripcion.findFirst({
      where: { referenciaExterna: externa.referencia },
      select: {
        id: true,
        tenantId: true,
        moraDesde: true,
        graciaHasta: true,
        ultimoEventoProveedorEl: true,
        actualizadoProveedorEl: true,
      },
    });

    const tenantId = existente?.tenantId ?? externa.tenantId;
    if (!tenantId) {
      return {
        aplicado: false,
        motivo:
          'No se pudo resolver el tenant: la suscripción no está vinculada y el evento no trae tenantId en custom_data.',
      };
    }

    // Serializa también altas de dos referencias distintas para una empresa.
    // Deja una versión de la fila para invalidar fotos SERIALIZABLE anteriores
    // sin cambiar el timestamp comercial de la empresa.
    await tx.$queryRaw`UPDATE "Tenant" SET "updatedAt" = "updatedAt" WHERE id = ${tenantId}::uuid RETURNING id`;
    existente = await tx.suscripcion.findFirst({
      where: { referenciaExterna: externa.referencia },
      select: {
        id: true,
        tenantId: true,
        moraDesde: true,
        graciaHasta: true,
        ultimoEventoProveedorEl: true,
        actualizadoProveedorEl: true,
      },
    });
    const versionRemota = externa.actualizadoEl ?? opciones.ocurridoEl;
    const versionLocal = existente?.actualizadoProveedorEl;
    if (
      (versionRemota && versionLocal && versionRemota < versionLocal) ||
      (opciones.ocurridoEl &&
        existente?.ultimoEventoProveedorEl &&
        opciones.ocurridoEl < existente.ultimoEventoProveedorEl) ||
      (!versionRemota &&
        opciones.consultadaDesde &&
        existente?.ultimoEventoProveedorEl &&
        existente.ultimoEventoProveedorEl > opciones.consultadaDesde)
    )
      return {
        aplicado: false,
        motivo:
          'El estado recibido es anterior al último aplicado. Se conserva el estado más reciente.',
      };

    const suscripcionDelTenant = await tx.suscripcion.findFirst({
      where: { tenantId },
      select: {
        id: true,
        referenciaExterna: true,
        estado: true,
        proveedor: true,
        planVersionId: true,
        ofertaId: true,
        cicloFacturacion: true,
        usuariosAdicionales: true,
        implementacionResueltaEl: true,
      },
    });

    if (
      opciones.suscripcionEsperada &&
      (suscripcionDelTenant?.id !== opciones.suscripcionEsperada.id ||
        tenantId !== opciones.suscripcionEsperada.tenantId ||
        suscripcionDelTenant.referenciaExterna !==
          opciones.suscripcionEsperada.referencia ||
        suscripcionDelTenant.proveedor !== 'paddle')
    )
      return {
        aplicado: false,
        motivo:
          'El vínculo cambió durante la consulta; se conserva la suscripción actual.',
      };

    // Un doble click, un reintento mientras Paddle terminaba el alta o un
    // webhook demorado no pueden reemplazar silenciosamente una suscripción
    // viva por otra distinta. Eso ocultaría un segundo cobro recurrente. Una
    // referencia nueva sólo es válida si la anterior ya está dada de baja.
    if (
      !existente &&
      suscripcionDelTenant?.referenciaExterna &&
      suscripcionDelTenant.referenciaExterna !== externa.referencia &&
      suscripcionDelTenant.estado !== 'baja'
    ) {
      return {
        aplicado: false,
        motivo: `El tenant ya tiene otra suscripción activa (${suscripcionDelTenant.referenciaExterna}).`,
      };
    }

    // El plan sale del price_id: si el tenant hizo un upgrade en Paddle, el
    // cambio de plan se refleja solo, sin que nadie lo toque a mano acá.
    const contrato = await resolverContratoOferta(tx, externa);
    // Una cancelación, pausa o mora de una referencia ya vinculada sigue
    // siendo válida aunque falten ítems. Cierra acceso sin inventar derechos.
    const conservarContrato =
      (contrato.tipo !== 'version' ||
        contrato.ofertaId !== suscripcionDelTenant?.ofertaId ||
        contrato.cicloFacturacion !== suscripcionDelTenant?.cicloFacturacion ||
        contrato.usuariosAdicionales !==
          suscripcionDelTenant?.usuariosAdicionales) &&
      !!existente &&
      !!suscripcionDelTenant?.ofertaId &&
      ['canceled', 'paused', 'past_due'].includes(externa.estadoProveedor);
    if (contrato.tipo === 'invalido' && !conservarContrato)
      return { aplicado: false, motivo: contrato.motivo };
    if (
      contrato.tipo === 'legacy' &&
      suscripcionDelTenant?.ofertaId &&
      !conservarContrato
    )
      return {
        aplicado: false,
        motivo:
          'Los precios recibidos no identifican la oferta contratada. Se conserva su versión hasta reconciliar el cobro.',
      };
    const plan =
      contrato.tipo === 'version' && !conservarContrato
        ? contrato.plan
        : externa.precios.length && !conservarContrato
          ? await tx.plan.findFirst({
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

    // Un precio público no autoriza por sí solo a contratar para cualquier
    // tenant usando custom_data desde el navegador. El intento lo crea el
    // servidor tras revisar cupos y confirmar con el administrador.
    const cambiaOferta =
      !conservarContrato &&
      contrato.tipo === 'version' &&
      (!existente ||
        contrato.ofertaId !== suscripcionDelTenant?.ofertaId ||
        contrato.cicloFacturacion !== suscripcionDelTenant?.cicloFacturacion ||
        contrato.usuariosAdicionales !==
          suscripcionDelTenant?.usuariosAdicionales);
    const contratacion =
      cambiaOferta && contrato.tipo === 'version'
        ? await tx.planContratacion.findFirst({
            where: {
              tenantId,
              ofertaId: contrato.ofertaId,
              ciclo: contrato.cicloFacturacion,
              adicionales: contrato.usuariosAdicionales,
              estado: { in: ['enviando', 'checkout', 'verificar'] },
              OR: [
                { tipo: 'cambio', referencia: externa.referencia },
                ...(externa.contratacionId &&
                /^[0-9a-f-]{36}$/i.test(externa.contratacionId)
                  ? [{ tipo: 'checkout', id: externa.contratacionId }]
                  : []),
              ],
            },
          })
        : null;
    if (cambiaOferta && !contratacion)
      return {
        aplicado: false,
        motivo:
          'La contratación no corresponde a una revisión confirmada en Grafo.',
      };

    const cargo = contratacion?.revisionJson as
      | { implementacion?: number; implementacionPriceId?: string | null }
      | undefined;
    if (contratacion?.tipo === 'checkout' && (cargo?.implementacion ?? 0) > 0) {
      const t =
        this.paddle &&
        (contratacion.transaccionId
          ? await this.paddle.leerCheckoutContratacion(
              contratacion.transaccionId,
            )
          : await this.paddle.buscarCheckoutContratacion(
              contratacion.id,
              contratacion.enviadaEl ?? contratacion.creadaEl,
            ));
      const item = t?.items.find(
        (i) => i.price?.id === cargo!.implementacionPriceId,
      );
      if (
        !t ||
        t.status !== 'completed' ||
        t.subscriptionId !== externa.referencia ||
        t.customData?.tenantId !== tenantId ||
        t.customData?.contratacionId !== contratacion.id ||
        !item?.price ||
        item.quantity !== 1 ||
        item.price.billingCycle !== null ||
        item.price.unitPrice.currencyCode !== 'USD' ||
        Number(item.price.unitPrice.amount) !==
          Math.round(cargo!.implementacion! * 100)
      )
        return {
          aplicado: false,
          motivo:
            'Esperando la confirmación del pago inicial con implementación.',
        };
    }

    if (suscripcionDelTenant?.planVersionId && !plan && !conservarContrato) {
      return {
        aplicado: false,
        motivo:
          'El precio recibido no corresponde a un plan conocido. Se conserva la versión interna hasta resolver el contrato de Paddle.',
      };
    }

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
      ...(contratacion?.tipo === 'checkout' &&
      !suscripcionDelTenant?.implementacionResueltaEl &&
      (externa.estadoProveedor === 'active' || (cargo?.implementacion ?? 0) > 0)
        ? {
            implementacionResueltaEl: ahora,
            implementacionImporte: cargo?.implementacion ?? 0,
          }
        : {}),
      estado,
      proveedor: 'paddle',
      // El precio remoto es autoritativo al pasar de contrato manual a Paddle.
      ...(!conservarContrato
        ? {
            planVersionId:
              contrato.tipo === 'version' ? contrato.planVersionId : null,
            ofertaId: contrato.tipo === 'version' ? contrato.ofertaId : null,
            cicloFacturacion:
              contrato.tipo === 'version' ? contrato.cicloFacturacion : null,
          }
        : {}),
      // Sólo Paddle concede plazas pagas; retirar el ítem las lleva a cero.
      ...(contrato.tipo === 'version' && !conservarContrato
        ? { usuariosAdicionales: contrato.usuariosAdicionales }
        : {}),
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
      ...(versionRemota ? { actualizadoProveedorEl: versionRemota } : {}),
      ...(opciones.ocurridoEl
        ? { ultimoEventoProveedorEl: opciones.ocurridoEl }
        : {}),
      ...(plan ? { planId: plan.id } : {}),
      ...(estado === 'baja' ? { hasta: new Date() } : { hasta: null }),
    };

    const suscripcion = suscripcionDelTenant;

    if (suscripcion) {
      await tx.suscripcion.update({
        where: { id: suscripcion.id },
        data: { ...datos, revisionContrato: { increment: 1 } },
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
      await tx.suscripcion.create({
        data: { tenantId, planId: plan.id, ...datos },
      });
    }

    this.logger.log(
      `Suscripción de ${tenantId} → ${estado} (${externa.estadoProveedor})${
        iniciaMora ? `, gracia hasta ${graciaHasta?.toISOString()}` : ''
      }`,
    );
    if (contratacion)
      await tx.planContratacion.update({
        where: { id: contratacion.id, tenantId },
        data: {
          estado: 'aplicada',
          referencia: externa.referencia,
          finalizadaEl: ahora,
          detalle: 'Contrato confirmado por Paddle.',
        },
      });
    return {
      aplicado: true,
      tenantId,
      estado,
      planCodigo: plan?.codigo ?? null,
      ...(conservarContrato
        ? {
            advertencia:
              'Se aplicó el estado de cobro conservando el contrato anterior: los ítems recibidos requieren revisión.',
          }
        : {}),
    };
  }
}
