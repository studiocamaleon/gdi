import { Module } from '@nestjs/common';
import { AdministracionController } from './administracion.controller';
import { MetodosPagoService } from './metodos-pago.service';
import { CobrosService } from './cobros.service';
import { TesoreriaService } from './tesoreria.service';

@Module({
  controllers: [AdministracionController],
  providers: [MetodosPagoService, CobrosService, TesoreriaService],
})
export class AdministracionModule {}
