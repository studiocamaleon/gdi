import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CobroWebhookController } from './cobro-webhook.controller';
import { PaddleService } from './paddle.service';
import { SuscripcionSyncService } from './suscripcion-sync.service';

/**
 * Cobro de suscripciones: las pasarelas y sus webhooks.
 *
 * Separado a propósito de `SuscripcionesModule`, que es la capa de LECTURA y
 * el gate por plan. Este módulo sabe de Paddle; aquél no sabe quién cobró.
 * Cuando entre MercadoPago, se suma acá y el resto del sistema no se entera.
 * Ver docs/suscripciones-cobro-diseno.md
 */
@Module({
  imports: [PrismaModule],
  controllers: [CobroWebhookController],
  providers: [PaddleService, SuscripcionSyncService],
  exports: [PaddleService, SuscripcionSyncService],
})
export class CobroModule {}
