import { Module } from '@nestjs/common';
import { InboxTiempoRealModule } from '../inbox-tiempo-real/inbox-tiempo-real.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhooksWhatsappController } from './webhooks-whatsapp.controller';
import { WebhooksWhatsappService } from './webhooks-whatsapp.service';
import { MetaInboxProcesamientoModule } from '../integraciones/meta/inbox/meta-inbox-procesamiento.module';

/**
 * Webhooks entrantes de WhatsApp (Meta Cloud API) — F1a del plan Tech
 * Provider. Ver docs/whatsapp-tech-provider-diseno.md.
 */
@Module({
  imports: [PrismaModule, InboxTiempoRealModule, MetaInboxProcesamientoModule],
  controllers: [WebhooksWhatsappController],
  providers: [WebhooksWhatsappService],
  exports: [WebhooksWhatsappService],
})
export class WebhooksWhatsappModule {}
