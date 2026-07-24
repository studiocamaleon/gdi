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

  /** El SDK crudo, para las operaciones de las fases siguientes (checkout,
   *  portal del cliente, sincronización de precios). */
  get sdk(): Paddle | null {
    return this.cliente;
  }
}
