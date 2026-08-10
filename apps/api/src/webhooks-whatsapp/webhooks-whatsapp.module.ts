import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhooksWhatsappController } from './webhooks-whatsapp.controller';
import { WebhooksWhatsappService } from './webhooks-whatsapp.service';

/**
 * Webhooks entrantes de WhatsApp (Meta Cloud API) — F1a del plan Tech
 * Provider. Ver docs/whatsapp-tech-provider-diseno.md.
 */
@Module({
  imports: [PrismaModule],
  controllers: [WebhooksWhatsappController],
  providers: [WebhooksWhatsappService],
  exports: [WebhooksWhatsappService],
})
export class WebhooksWhatsappModule {}
