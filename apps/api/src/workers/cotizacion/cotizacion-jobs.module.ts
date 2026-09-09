import { Module } from '@nestjs/common';
import { CotizacionJobsService } from './cotizacion-jobs.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PreparacionesNestingService } from './preparaciones-nesting.service';
import { PreparacionesNestingController } from './preparaciones-nesting.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PreparacionesNestingController],
  providers: [CotizacionJobsService, PreparacionesNestingService],
  exports: [CotizacionJobsService, PreparacionesNestingService],
})
export class CotizacionJobsModule {}
