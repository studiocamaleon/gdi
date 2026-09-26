import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InboxTiempoRealBus } from './inbox-tiempo-real.bus';

@Module({
  imports: [PrismaModule],
  providers: [InboxTiempoRealBus],
  exports: [InboxTiempoRealBus],
})
export class InboxTiempoRealModule {}
