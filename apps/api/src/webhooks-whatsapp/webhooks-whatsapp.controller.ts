import {
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { SinTenant } from '../common/sin-tenant.decorator';
import { WebhooksWhatsappService } from './webhooks-whatsapp.service';

/**
 * Endpoint de webhooks de WhatsApp (Meta Cloud API): /api/webhooks/whatsapp.
 *
 * Mismo patrón que el webhook de Paddle (el otro @Public de webhooks):
 * el body CRUDO lo captura main.ts para todo /api/webhooks/*, la firma es
 * la única autenticación, y la respuesta es 200 rápido con el procesamiento
 * detrás (acá: persistencia cruda; los procesadores llegan en F1d).
 *
 * Meta exige responder en ~250 ms y reintenta ante no-2xx hasta 7 días.
 */
@Controller('webhooks')
@Public()
@SinTenant()
export class WebhooksWhatsappController {
  private readonly logger = new Logger(WebhooksWhatsappController.name);

  constructor(private readonly service: WebhooksWhatsappService) {}

  /**
   * Verificación del endpoint (la hace Meta una vez, al configurarlo en el
   * dashboard): responder el challenge CRUDO con 200 si el verify token
   * coincide. Cualquier otra cosa: 403 sin detalle.
   */
  @Get('whatsapp')
  verificar(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() res: Response,
  ) {
    const esperado = this.service.verifyToken;
    if (!esperado) {
      throw new ServiceUnavailableException(
        'WHATSAPP_WEBHOOK_VERIFY_TOKEN no está configurado.',
      );
    }
    if (mode === 'subscribe' && token === esperado && challenge) {
      res.status(200).type('text/plain').send(challenge);
      return;
    }
    res.status(403).send();
  }

  /**
   * Recepción. Verifica firma → desarma → persiste crudo → 200.
   * La persistencia es rápida (createMany); si a futuro crece, el corte
   * natural es encolar el raw y persistir async — la respuesta ya está
   * pensada para eso.
   */
  @Post('whatsapp')
  @HttpCode(200)
  // Statuses ≈ 3× la tasa de envío + entrantes. Cubeta generosa por IP de
  // Meta; el AppThrottlerGuard no aplica tracker MCP acá (no hay bearer).
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async recibir(
    @Req() req: { rawBody?: Buffer; body?: unknown },
    @Headers('x-hub-signature-256') firma?: string,
  ) {
    if (!this.service.puedeVerificarFirma) {
      // Sin app secret no hay forma de distinguir a Meta de un atacante:
      // rechazar (Meta reintenta) antes que persistir basura.
      throw new ServiceUnavailableException('META_APP_SECRET no configurado.');
    }
    if (!firma || !req.rawBody) {
      throw new UnauthorizedException('Falta la firma o el cuerpo.');
    }
    if (!this.service.verificarFirma(req.rawBody, firma)) {
      throw new UnauthorizedException('Firma inválida.');
    }

    const cambios = this.service.extraerCambios(req.body);
    try {
      await this.service.persistir(cambios);
    } catch (error) {
      // Persistir falló: devolver no-2xx para que Meta REINTENTE (history y
      // echoes no tienen replay: perderlos por tragarnos el error sería
      // exactamente el bug que esta tabla existe para evitar).
      this.logger.error('No se pudo persistir el webhook de WhatsApp', error);
      throw error;
    }
    return { ok: true };
  }
}
