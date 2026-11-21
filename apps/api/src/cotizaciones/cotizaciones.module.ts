import { TrabajosMedidaController } from '../trabajos-medida/trabajos-medida.controller';
import { TrabajosMedidaService } from '../trabajos-medida/trabajos-medida.service';
import { Module } from '@nestjs/common';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesService } from './cotizaciones.service';
import { TipoCambioService } from './tipo-cambio.service';

@Module({
  imports: [CapacidadesEmpresaModule],
  controllers: [CotizacionesController, TrabajosMedidaController],
  providers: [CotizacionesService, TipoCambioService, TrabajosMedidaService],
  exports: [CotizacionesService, TipoCambioService],
})
export class CotizacionesModule {}
