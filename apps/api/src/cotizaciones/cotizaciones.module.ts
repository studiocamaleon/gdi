import { Module } from '@nestjs/common';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesService } from './cotizaciones.service';
import { TipoCambioService } from './tipo-cambio.service';

@Module({
  controllers: [CotizacionesController],
  providers: [CotizacionesService, TipoCambioService],
  exports: [CotizacionesService, TipoCambioService],
})
export class CotizacionesModule {}
