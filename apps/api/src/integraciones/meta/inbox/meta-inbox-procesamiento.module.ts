import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { InboxTiempoRealModule } from '../../../inbox-tiempo-real/inbox-tiempo-real.module';
import { MetaInboxProcesador } from './meta-inbox-procesador.service';

@Module({
  imports: [PrismaModule, InboxTiempoRealModule],
  providers: [MetaInboxProcesador],
  exports: [MetaInboxProcesador],
})
export class MetaInboxProcesamientoModule {}
