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

  get entorno(): 'sandbox' | 'production' {
    return process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox';
  }

  /** Lectura completa para activar ofertas: ciclo, moneda y cantidad forman
   * parte de la comprobación, no basta con que el price_id exista. */
  async leerPrecioOferta(priceId: string) {
    if (!this.cliente) return null;
    return this.cliente.prices.get(priceId, { include: ['product'] });
  }

  async buscarRecursoPlan(versionId: string, clave: string) {
    if (!this.cliente) throw new Error('Paddle no disponible');
    const lista = clave.startsWith('producto:')
      ? this.cliente.products.list({ perPage: 100 })
      : this.cliente.prices.list({ perPage: 100 });
    const coincidencias: string[] = [];
    for await (const recurso of lista) {
      if (
        recurso.customData?.grafoVersionId === versionId &&
        recurso.customData?.grafoClave === clave
      )
        coincidencias.push(recurso.id);
    }
    if (coincidencias.length > 1)
      throw new Error('Hay recursos duplicados en Paddle; requieren revisión.');
    return coincidencias[0] ?? null;
  }

  async crearProductoPlan(versionId: string, clave: string, nombre: string) {
    if (!this.cliente) throw new Error('Paddle no disponible');
    return this.cliente.products.create({
      name: nombre,
      type: 'standard',
      taxCategory: 'saas',
      customData: { grafoVersionId: versionId, grafoClave: clave },
    });
  }

  async crearPrecioPlan(args: {
    versionId: string;
    clave: string;
    productId: string;
    nombre: string;
    importe: number;
    ciclo: 'mensual' | 'anual' | 'unico';
    cantidadMaxima: number;
  }) {
    if (!this.cliente) throw new Error('Paddle no disponible');
    return this.cliente.prices.create({
      productId: args.productId,
      name: args.nombre,
      description: args.nombre,
      type: 'standard',
      taxMode: 'external',
      trialPeriod: null,
      billingCycle:
        args.ciclo === 'unico'
          ? null
          : {
              interval: args.ciclo === 'mensual' ? 'month' : 'year',
              frequency: 1,
            },
      unitPrice: {
        amount: String(Math.round(args.importe * 100)),
        currencyCode: 'USD',
      },
      unitPriceOverrides: [],
      quantity: { minimum: 1, maximum: args.cantidadMaxima },
      customData: { grafoVersionId: args.versionId, grafoClave: args.clave },
    });
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
  ): Promise<{
    eventId: string;
    eventType: string;
    data: unknown;
    occurredAt: Date | null;
  } | null> {
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
        const occurredAt = (evento as unknown as Record<string, unknown>)[
          'occurredAt'
        ];
        return {
          eventId: evento.eventId,
          eventType: evento.eventType as string,
          data: evento.data,
          occurredAt:
            typeof occurredAt === 'string' &&
            !Number.isNaN(Date.parse(occurredAt))
              ? new Date(occurredAt)
              : null,
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
      const occurredAt = crudo.occurred_at ?? crudo.occurredAt;
      return {
        eventId,
        eventType,
        data: crudo.data,
        occurredAt:
          typeof occurredAt === 'string' &&
          !Number.isNaN(Date.parse(occurredAt))
            ? new Date(occurredAt)
            : null,
      };
    } catch {
      return null;
    }
  }

  /** Estado autoritativo de una suscripción, usado por la reconciliación. */
  async obtenerSuscripcion(suscripcionId: string): Promise<unknown> {
    if (!this.cliente) return null;
    try {
      return await this.cliente.subscriptions.get(suscripcionId);
    } catch (error) {
      this.logger.warn(
        `No se pudo leer la suscripción ${suscripcionId} de Paddle: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
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
   * URL del PDF de una factura. Es FIRMADA Y TEMPORAL, así que se pide en el
   * momento y no se guarda: un link almacenado se vence y deja al cliente con
   * un botón roto.
   */
  async urlFacturaPdf(transaccionId: string): Promise<string | null> {
    if (!this.cliente) return null;
    try {
      const r = await this.cliente.transactions.getInvoicePDF(transaccionId);
      return r.url ?? null;
    } catch (error) {
      this.logger.warn(
        `No se pudo obtener el PDF de ${transaccionId}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      return null;
    }
  }

  /**
   * La tarjeta con la que se cobró la última vez: marca, últimos 4 y
   * vencimiento.
   *
   * Sale del pago de la última transacción cobrada, NO de
   * /customers/:id/payment-methods — ese endpoint necesita el permiso
   * `payment_method.read`, que deliberadamente no le dimos a la API key. El
   * dato es el mismo y por acá no hace falta ampliar permisos.
   *
   * Es informativo: el cliente necesita saber qué tarjeta tiene registrada.
   * Cambiarla se hace en el portal de Paddle, no acá.
   */
  async tarjetaDelCliente(clienteId: string): Promise<{
    marca: string;
    ultimos4: string;
    vence: string;
  } | null> {
    if (!this.cliente) return null;
    try {
      // No alcanza con mirar la última transacción: un cambio de plan que se
      // salda con el saldo a favor queda "completed" pero SIN pagos, y la
      // tarjeta desaparecía de la vista. Se recorren las últimas y se toma la
      // primera que haya pasado de verdad por la tarjeta.
      const col = this.cliente.transactions.list({
        customerId: [clienteId],
        status: ['completed'],
        orderBy: 'billed_at[DESC]',
        perPage: 20,
      });
      const recientes = await col.next();
      const tarjeta = recientes
        .flatMap((t) => t.payments ?? [])
        .find((p) => p.methodDetails?.card?.last4)?.methodDetails?.card;
      if (!tarjeta?.last4) return null;
      const mes = String(tarjeta.expiryMonth ?? '').padStart(2, '0');
      const anio = String(tarjeta.expiryYear ?? '').slice(-2);
      return {
        marca: tarjeta.type ?? 'card',
        ultimos4: tarjeta.last4,
        vence: mes && anio ? `${mes}/${anio}` : '',
      };
    } catch (error) {
      this.logger.warn(
        `No se pudo leer la tarjeta de ${clienteId}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      return null;
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

  /** Lista completa: omitir un adicional lo elimina en Paddle. */
  async cambiarItems(
    suscripcionId: string,
    items: { priceId: string; quantity: number }[],
  ) {
    if (!this.cliente) throw new Error('Paddle no disponible');
    return this.cliente.subscriptions.update(suscripcionId, {
      items,
      prorationBillingMode: 'prorated_immediately',
      onPaymentFailure: 'prevent_change',
    });
  }

  async previsualizarItems(
    suscripcionId: string,
    items: { priceId: string; quantity: number }[],
  ) {
    if (!this.cliente) throw new Error('Paddle no disponible');
    const p = await this.cliente.subscriptions.previewUpdate(suscripcionId, {
      items,
      prorationBillingMode: 'prorated_immediately',
      onPaymentFailure: 'prevent_change',
    });
    const t = p.immediateTransaction?.details?.totals;
    return {
      aCobrar: Number(t?.grandTotal ?? 0) / 100,
      aCredito: Number(t?.creditToBalance ?? 0) / 100,
      moneda: p.currencyCode,
      impuestosEnCheckout: false,
    };
  }

  async crearCheckoutContratacion(
    items: { priceId: string; quantity: number }[],
    tenantId: string,
    contratacionId: string,
  ) {
    if (!this.cliente) throw new Error('Paddle no disponible');
    return this.cliente.transactions.create({
      items,
      collectionMode: 'automatic',
      currencyCode: 'USD',
      customData: { tenantId, contratacionId },
    });
  }

  /** Recuperación por lectura: nunca repetir un POST si se perdió su respuesta. */
  async buscarCheckoutContratacion(contratacionId: string, desde: Date) {
    if (!this.cliente) return null;
    const coleccion = this.cliente.transactions.list({
      'createdAt[GTE]': new Date(desde.getTime() - 300000).toISOString(),
      perPage: 100,
    });
    for (let pagina = 0; pagina < 5; pagina++) {
      const filas = await coleccion.next();
      const encontrada = filas.find(
        (t) => t.customData?.contratacionId === contratacionId,
      );
      if (encontrada) return encontrada;
      if (filas.length < 100) break;
    }
    return null;
  }

  async leerCheckoutContratacion(id: string) {
    if (!this.cliente) return null;
    return this.cliente.transactions.get(id);
  }

  async cancelarCheckoutContratacion(id: string) {
    if (!this.cliente) throw new Error('Paddle no está disponible.');
    return this.cliente.transactions.update(id, { status: 'canceled' });
  }

  esRechazoDefinitivo(error: unknown) {
    return (
      error instanceof Error &&
      'type' in error &&
      error.type === 'request_error'
    );
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

  /**
   * Quita el cambio programado (típicamente una cancelación pendiente).
   *
   * Recuperar a alguien que se arrepintió es lo más barato que hay: mientras
   * no llegue la fecha efectiva, la cancelación se deshace con esto y el
   * cliente sigue como si nada.
   */
  async quitarCambioProgramado(suscripcionId: string): Promise<unknown> {
    if (!this.cliente) return null;
    return this.cliente.subscriptions.update(suscripcionId, {
      scheduledChange: null,
    });
  }

  /** El SDK crudo, para lo que no valga la pena envolver. */
  get sdk(): Paddle | null {
    return this.cliente;
  }
}
