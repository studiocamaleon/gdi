import { Module } from '@nestjs/common';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesService } from './cotizaciones.service';
import { TipoCambioService } from './tipo-cambio.service';

@Module({
  imports: [CapacidadesEmpresaModule],
  controllers: [CotizacionesController],
  providers: [CotizacionesService, TipoCambioService],
  exports: [CotizacionesService, TipoCambioService],
})
export class CotizacionesModule {}
