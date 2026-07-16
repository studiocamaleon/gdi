import { Module } from '@nestjs/common';
import { AdministracionController } from './administracion.controller';
import { MetodosPagoService } from './metodos-pago.service';
import { CobrosService } from './cobros.service';
import { TesoreriaService } from './tesoreria.service';
import { ConfiguracionFiscalService } from './configuracion-fiscal.service';
import { ComprobantesService } from './comprobantes.service';
import { ImputacionesService } from './imputaciones.service';
import { ManualProvider } from './invoicing/manual.provider';

@Module({
  controllers: [AdministracionController],
  providers: [
    MetodosPagoService,
    CobrosService,
    TesoreriaService,
    ConfiguracionFiscalService,
    ComprobantesService,
    ImputacionesService,
    ManualProvider,
  ],
})
export class AdministracionModule {}
