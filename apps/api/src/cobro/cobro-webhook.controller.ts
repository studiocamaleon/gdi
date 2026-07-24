import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { SinTenant } from '../common/sin-tenant.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleService } from './paddle.service';
import { SuscripcionSyncService } from './suscripcion-sync.service';

/**
 * Webhooks de las pasarelas de cobro.
 *
 * Es PÚBLICO (Paddle no puede autenticarse con nuestro JWT), así que la firma
 * es lo único que separa a Paddle de cualquiera que conozca la URL: nada se
 * procesa antes de verificarla.
 *
 * @SinTenant porque el evento llega sin contexto de tenant — el tenant se
 * resuelve después, por la referencia de la suscripción.
 *
 * El contrato con Paddle es el código HTTP: 2xx = recibido, no reintentar;
 * cualquier otra cosa = reintentar. De ahí el diseño de idempotencia de abajo.
 * Ver docs/suscripciones-cobro-diseno.md
 */
@Controller('webhooks')
@Public()
@SinTenant()
export class CobroWebhookController {
  private readonly logger = new Logger(CobroWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleService,
    private readonly sync: SuscripcionSyncService,
  ) {}

  @Post('paddle')
  @HttpCode(200)
  // Throttle alto: Paddle puede ráfagar en renovaciones masivas, pero acota
  // el daño de que alguien golpee la URL a ciegas.
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async paddleWebhook(
    @Req() req: { rawBody?: Buffer },
    @Headers('paddle-signature') firma?: string,
  ) {
    if (!this.paddle.puedeVerificarFirma) {
      // Sin secret no se puede distinguir un evento real de uno falso: es
      // preferible rechazar (y que Paddle reintente) a procesar a ciegas.
      throw new ServiceUnavailableException('Paddle no está configurado.');
    }
    if (!firma || !req.rawBody) {
      throw new UnauthorizedException('Falta la firma o el cuerpo del evento.');
    }

    const evento = await this.paddle.verificarEvento(
      req.rawBody.toString('utf8'),
      firma,
    );
    if (!evento) {
      throw new UnauthorizedException('Firma inválida.');
    }

    // ── Idempotencia ────────────────────────────────────────────────────
    // Paddle reintenta ante cualquier no-2xx, así que el mismo evento puede
    // llegar varias veces. Se registra por eventoId (unique), pero la guarda
    // es `procesadoEl`, no la mera existencia: si un intento anterior falló a
    // mitad de camino, el reintento TIENE que volver a procesarlo.
    const yaVisto = await this.prisma.eventoCobro.findUnique({
      where: { eventoId: evento.eventId },
      select: { id: true, procesadoEl: true },
    });
    if (yaVisto?.procesadoEl) {
      return { ok: true, repetido: true };
    }

    const registro =
      yaVisto ??
      (await this.prisma.eventoCobro.create({
        data: {
          proveedor: 'paddle',
          eventoId: evento.eventId,
          tipo: evento.eventType,
          payloadJson: evento.data as object,
        },
        select: { id: true, procesadoEl: true },
      }));

    try {
      const resultado = await this.procesar(evento.eventType, evento.data);
      await this.prisma.eventoCobro.update({
        where: { id: registro.id },
        data: {
          procesadoEl: new Date(),
          errorTexto: resultado.nota ?? null,
        },
      });
      return { ok: true, ...resultado.respuesta };
    } catch (error) {
      const detalle =
        error instanceof Error ? error.message : 'error desconocido';
      await this.prisma.eventoCobro.update({
        where: { id: registro.id },
        data: { errorTexto: detalle },
      });
      this.logger.error(
        `Falló el procesamiento de ${evento.eventType} (${evento.eventId}): ${detalle}`,
      );
      // Se propaga a propósito: 5xx hace que Paddle reintente, y el evento
      // quedó sin `procesadoEl`, así que el reintento vuelve a entrar.
      throw error;
    }
  }

  /** Despacha por tipo de evento. Lo que no nos toca se registra y se ignora
   *  (devolver 2xx igual: no queremos que Paddle reintente para siempre algo
   *  que no vamos a procesar nunca). */
  private async procesar(
    tipo: string,
    data: unknown,
  ): Promise<{ nota?: string; respuesta: Record<string, unknown> }> {
    if (!tipo.startsWith('subscription.')) {
      return { respuesta: { ignorado: tipo } };
    }
    const externa = this.sync.extraer(data);
    if (!externa) {
      return {
        nota: 'Payload de suscripción sin la forma esperada.',
        respuesta: { ignorado: tipo },
      };
    }
    const resultado = await this.sync.aplicar(externa);
    return resultado.aplicado
      ? {
          respuesta: { tenantId: resultado.tenantId, estado: resultado.estado },
        }
      : { nota: resultado.motivo, respuesta: { sinAplicar: resultado.motivo } };
  }
}
