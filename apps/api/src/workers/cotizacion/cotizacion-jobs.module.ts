import { Module } from '@nestjs/common';
import { CotizacionJobsService } from './cotizacion-jobs.service';

@Module({
  providers: [CotizacionJobsService],
  exports: [CotizacionJobsService],
})
export class CotizacionJobsModule {}
