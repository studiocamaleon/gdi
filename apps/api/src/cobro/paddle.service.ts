import { Injectable, Logger } from '@nestjs/common';
import { Environment, Paddle } from '@paddle/paddle-node-sdk';

/**
 * Cliente de Paddle. Aísla el SDK del resto del sistema: nadie más importa
 * `@paddle/paddle-node-sdk`, así sumar MercadoPago después es agregar otro
 * service al lado y no tocar nada de esto.
 *
 * Se configura por entorno (nunca en el repo):
 *   PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, PADDLE_ENV=sandbox|production
 *
 * Si falta la config, el service arranca DESHABILITADO en vez de tirar la app
 * abajo: el resto del sistema (que no cobra) tiene que seguir funcionando.
 * El webhook responde 503 y lo dice en el log.
 * Ver docs/suscripciones-cobro-diseno.md
 */
@Injectable()
export class PaddleService {
  private readonly logger = new Logger(PaddleService.name);
  private readonly cliente: Paddle | null;
  private readonly webhookSecret: string | null;

  constructor() {
    const apiKey = process.env.PADDLE_API_KEY?.trim();
    this.webhookSecret = process.env.PADDLE_WEBHOOK_SECRET?.trim() || null;
    const entorno =
      process.env.PADDLE_ENV === 'production'
        ? Environment.production
        : Environment.sandbox;

    if (!apiKey) {
      this.cliente = null;
      this.logger.warn(
        'PADDLE_API_KEY sin definir: el cobro por Paddle queda deshabilitado.',
      );
      return;
    }
    this.cliente = new Paddle(apiKey, { environment: entorno });
    this.logger.log(`Paddle configurado (entorno: ${entorno}).`);
  }

  /** ¿Se puede operar contra Paddle? (hay API key). */
  get habilitado(): boolean {
    return this.cliente !== null;
  }

  /** ¿Se pueden recibir webhooks? (hay secret de firma). */
  get puedeVerificarFirma(): boolean {
    return this.webhookSecret !== null;
  }

  /**
   * Verifica la firma del webhook y devuelve el evento tipado, o `null` si la
   * firma no valida. El body tiene que ser el CRUDO (`req.rawBody`): el SDK
   * calcula el HMAC sobre el texto exacto que llegó.
   *
   * Nunca se procesa un evento sin pasar por acá: el endpoint es público, así
   * que la firma es lo único que distingue a Paddle de cualquiera.
   */
  async verificarEvento(
    bodyCrudo: string,
    firma: string,
  ): Promise<{ eventId: string; eventType: string; data: unknown } | null> {
    if (!this.cliente || !this.webhookSecret) return null;

    // 1) La verificación de firma va SOLA y primero: es la única barrera de
    //    seguridad del endpoint, y separarla del parseo evita confundir dos
    //    fallas muy distintas. Si esto da false, el evento no es de Paddle.
    let firmaOk = false;
    try {
      firmaOk = await this.cliente.webhooks.isSignatureValid(
        bodyCrudo,
        this.webhookSecret,
        firma,
      );
    } catch {
      firmaOk = false;
    }
    if (!firmaOk) {
      this.logger.warn('Webhook de Paddle rechazado: firma inválida.');
      return null;
    }

    // 2) Recién ahora se interpreta el contenido. Si el SDK no puede mapear el
    //    payload a sus tipos (campo nuevo, forma distinta), NO es un problema
    //    de seguridad: la firma ya probó que viene de Paddle. Se cae al JSON
    //    crudo en vez de descartar un evento auténtico — perder un
    //    'subscription.canceled' por un campo inesperado sería mucho peor.
    try {
      const evento = await this.cliente.webhooks.unmarshal(
        bodyCrudo,
        this.webhookSecret,
        firma,
      );
      if (evento) {
        return {
          eventId: evento.eventId,
          eventType: evento.eventType as string,
          data: evento.data,
        };
      }
    } catch (error) {
      this.logger.warn(
        `Evento de Paddle auténtico pero no interpretable por el SDK, se usa el JSON crudo: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }

    try {
      const crudo = JSON.parse(bodyCrudo) as Record<string, unknown>;
      const eventId = crudo.event_id ?? crudo.eventId;
      const eventType = crudo.event_type ?? crudo.eventType;
      if (typeof eventId !== 'string' || typeof eventType !== 'string') {
        return null;
      }
      return { eventId, eventType, data: crudo.data };
    } catch {
      return null;
    }
  }

  /**
   * Lee un precio del catálogo de Paddle. Devuelve null si no existe (o si
   * Paddle no está configurado).
   *
   * Se usa al vincular un plan: valida que el id exista de verdad —un typo se
   * detecta en el acto y no cuando falla un checkout— y trae el monto real
   * para que el espejo local no muestre un número inventado.
   *
   * Paddle expresa los montos en la unidad mínima (centavos) y como string.
   */
  async leerPrecio(priceId: string): Promise<{
    monto: number;
    moneda: string;
    productId: string | null;
    descripcion: string;
  } | null> {
    if (!this.cliente) return null;
    try {
      const precio = await this.cliente.prices.get(priceId);
      const bruto = Number(precio.unitPrice?.amount ?? '0');
      return {
        monto: Number.isFinite(bruto) ? bruto / 100 : 0,
        moneda: precio.unitPrice?.currencyCode ?? 'USD',
        productId: precio.productId ?? null,
        descripcion: precio.description ?? '',
      };
    } catch (error) {
      this.logger.warn(
        `No se pudo leer el precio ${priceId} de Paddle: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      return null;
    }
  }

  /**
   * Las facturas del cliente (transacciones cobradas). Paddle es Merchant of
   * Record: estos comprobantes los emite Paddle, no nosotros — acá sólo se
   * listan para que el tenant las tenga a mano.
   */
  async listarFacturas(
    clienteId: string,
    limite = 12,
  ): Promise<
    Array<{
      id: string;
      numero: string | null;
      fecha: string | null;
      total: number;
      moneda: string;
      estado: string;
    }>
  > {
    if (!this.cliente) return [];
    try {
      const coleccion = this.cliente.transactions.list({
        customerId: [clienteId],
        status: ['completed', 'billed', 'past_due'],
        perPage: limite,
      });
      const filas = await coleccion.next();
      return filas.map((t) => ({
        id: t.id,
        numero: t.invoiceNumber ?? null,
        fecha: t.billedAt ?? t.createdAt ?? null,
        total: Number(t.details?.totals?.total ?? '0') / 100,
        moneda: t.currencyCode ?? 'USD',
        estado: t.status,
      }));
    } catch (error) {
      this.logger.warn(
        `No se pudieron listar las facturas de ${clienteId}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      return [];
    }
  }

  /**
   * Sesión del portal del cliente de Paddle: ahí el tenant cambia el medio de
   * pago, descarga sus facturas y cancela. Se delega a propósito — son datos
   * de tarjeta y flujos fiscales que no queremos tocar ni almacenar.
   *
   * Pasando `subscriptionIds` el portal habilita las acciones sobre esas
   * suscripciones puntuales.
   */
  async crearSesionPortal(
    clienteId: string,
    suscripcionIds: string[] = [],
  ): Promise<{ general: string; suscripcion: string | null } | null> {
    if (!this.cliente) return null;
    try {
      const sesion = await this.cliente.customerPortalSessions.create(
        clienteId,
        suscripcionIds,
      );
      const deSuscripcion =
        sesion.urls?.subscriptions?.[0]?.cancelSubscription ??
        sesion.urls?.subscriptions?.[0]?.updateSubscriptionPaymentMethod ??
        null;
      return {
        general: sesion.urls?.general?.overview ?? '',
        suscripcion: deSuscripcion,
      };
    } catch (error) {
      this.logger.warn(
        `No se pudo abrir el portal de ${clienteId}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      return null;
    }
  }

  /**
   * Cambia el plan de una suscripción EXISTENTE, con prorrateo inmediato.
   *
   * Es la diferencia entre cambiar de plan y contratar: abrir un checkout
   * nuevo le crearía al cliente una SEGUNDA suscripción y le cobrarían las
   * dos. Acá se modifica la que ya tiene, Paddle prorratea contra lo que ya
   * pagó, y usa la tarjeta que está en archivo — sin pedirle nada.
   *
   * Devuelve la suscripción actualizada para aplicarla en el acto, sin
   * esperar el webhook.
   */
  async cambiarPlan(suscripcionId: string, priceId: string): Promise<unknown> {
    if (!this.cliente) return null;
    return this.cliente.subscriptions.update(suscripcionId, {
      items: [{ priceId, quantity: 1 }],
      prorationBillingMode: 'prorated_immediately',
    });
  }

  /**
   * Qué implica el cambio en plata, ANTES de confirmarlo.
   *
   * Son DOS cosas distintas y hay que mostrarlas separadas:
   *  - `aCobrar` (grand_total): lo que se le debita ahora. Upgrade.
   *  - `aCredito` (credit_to_balance): lo que queda a su favor. Downgrade.
   *
   * El crédito NO es una devolución a la tarjeta: queda como saldo del cliente
   * y Paddle lo aplica solo a los cobros siguientes ("credit balances are
   * automatically used to pay for future transactions", su doc). Decirlo bien
   * importa: es plata del cliente y el diálogo se la está prometiendo.
   */
  async previsualizarCambio(
    suscripcionId: string,
    priceId: string,
  ): Promise<{ aCobrar: number; aCredito: number; moneda: string } | null> {
    if (!this.cliente) return null;
    try {
      const p = await this.cliente.subscriptions.previewUpdate(suscripcionId, {
        items: [{ priceId, quantity: 1 }],
        prorationBillingMode: 'prorated_immediately',
      });
      const t = p.immediateTransaction?.details?.totals;
      const moneda = p.currencyCode ?? 'USD';
      if (!t) return { aCobrar: 0, aCredito: 0, moneda };
      return {
        aCobrar: Number(t.grandTotal ?? '0') / 100,
        aCredito: Number(t.creditToBalance ?? '0') / 100,
        moneda,
      };
    } catch (error) {
      this.logger.warn(
        `No se pudo previsualizar el cambio de ${suscripcionId}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      return null;
    }
  }

  /**
   * Lee la suscripción que creó una transacción. Se usa apenas cierra el
   * checkout para reflejar el alta EN EL ACTO en vez de esperar el webhook:
   * el usuario acaba de pagar y merece ver el resultado, no una pantalla de
   * espera. El webhook queda como respaldo para lo que pasa sin nadie
   * mirando (renovaciones, mora, cancelaciones desde el portal).
   */
  async suscripcionDeTransaccion(transaccionId: string): Promise<unknown> {
    if (!this.cliente) return null;
    try {
      const t = await this.cliente.transactions.get(transaccionId);
      if (!t.subscriptionId) return null;
      return await this.cliente.subscriptions.get(t.subscriptionId);
    } catch (error) {
      this.logger.warn(
        `No se pudo resolver la suscripción de ${transaccionId}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      return null;
    }
  }

  /** El SDK crudo, para lo que no valga la pena envolver. */
  get sdk(): Paddle | null {
    return this.cliente;
  }
}
