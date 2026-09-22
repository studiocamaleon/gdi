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
import { Prisma } from '@prisma/client';
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

    const payload = evento.data as Record<string, unknown> | null;
    const ref = evento.eventType.startsWith('subscription.')
      ? payload?.id
      : (payload?.subscriptionId ?? payload?.subscription_id);
    const registro = await this.prisma.eventoCobro.upsert({
      where: { eventoId: evento.eventId },
      create: {
        proveedor: 'paddle',
        eventoId: evento.eventId,
        tipo: evento.eventType,
        payloadJson: evento.data as object,
        ocurridoEl: evento.occurredAt,
        referenciaSuscripcion: typeof ref === 'string' ? ref : null,
      },
      update: {},
      select: { id: true },
    });
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "EventoCobro" WHERE id = ${registro.id}::uuid FOR UPDATE`;
          const guardado = await tx.eventoCobro.findUniqueOrThrow({
            where: { id: registro.id },
          });
          if (guardado.procesadoEl) return { ok: true, repetido: true };
          const resultado = await this.procesar(
            tx,
            guardado.tipo,
            guardado.payloadJson,
            guardado.ocurridoEl,
          );
          await tx.eventoCobro.update({
            where: { id: registro.id },
            data: {
              procesadoEl: new Date(),
              errorTexto: resultado.nota ?? null,
              resultado: resultado.estado,
            },
          });
          return { ok: true, ...resultado.respuesta };
        },
        { timeout: 30000 },
      );
    } catch (error) {
      const detalle =
        error instanceof Error ? error.message : 'error desconocido';
      await this.prisma.eventoCobro.updateMany({
        where: { id: registro.id, procesadoEl: null },
        data: { errorTexto: detalle, resultado: 'fallido' },
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
    tx: Prisma.TransactionClient,
    tipo: string,
    data: unknown,
    ocurridoEl: Date | null,
  ): Promise<{
    estado: 'aplicado' | 'ignorado' | 'sin_aplicar';
    nota?: string;
    respuesta: Record<string, unknown>;
  }> {
    if (tipo === 'transaction.completed' && data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      const ref = d.subscriptionId ?? d.subscription_id;
      if (typeof ref === 'string' && /^sub_[a-z0-9]{26}$/.test(ref)) {
        const remoto = await this.paddle.obtenerSuscripcion(ref);
        const externa = this.sync.extraer(remoto);
        if (!externa)
          throw new ServiceUnavailableException(
            'No se pudo verificar la suscripción del pago completado.',
          );
        if (externa) {
          const resultado = await this.sync.aplicarEnTransaccion(tx, externa, {
            origen: 'reconciliacion',
          });
          return resultado.aplicado
            ? {
                estado: 'aplicado',
                respuesta: { tenantId: resultado.tenantId },
              }
            : {
                estado: 'sin_aplicar',
                nota: resultado.motivo,
                respuesta: { sinAplicar: resultado.motivo },
              };
        }
      }
    }
    if (!tipo.startsWith('subscription.')) {
      return { estado: 'ignorado', respuesta: { ignorado: tipo } };
    }
    const externa = this.sync.extraer(data);
    if (!externa) {
      return {
        estado: 'sin_aplicar',
        nota: 'Payload de suscripción sin la forma esperada.',
        respuesta: { ignorado: tipo },
      };
    }
    const resultado = await this.sync.aplicarEnTransaccion(tx, externa, {
      ocurridoEl,
      origen: 'webhook',
    });
    return resultado.aplicado
      ? {
          estado: 'aplicado',
          nota: resultado.advertencia,
          respuesta: { tenantId: resultado.tenantId, estado: resultado.estado },
        }
      : {
          estado: 'sin_aplicar',
          nota: resultado.motivo,
          respuesta: { sinAplicar: resultado.motivo },
        };
  }
}
