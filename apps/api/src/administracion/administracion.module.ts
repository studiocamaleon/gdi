import { Module } from '@nestjs/common';
import { AdministracionController } from './administracion.controller';
import { MetodosPagoService } from './metodos-pago.service';
import { CobrosService } from './cobros.service';
import { TesoreriaService } from './tesoreria.service';
import { ConfiguracionFiscalService } from './configuracion-fiscal.service';
import { ComprobantesService } from './comprobantes.service';
import { ImputacionesService } from './imputaciones.service';
import { CuentaCorrienteService } from './cuenta-corriente.service';
import { FacturaService } from './factura.service';
import { FacturaPdfService } from './factura-pdf.service';
import { EstadoCuentaPdfService } from './estado-cuenta-pdf.service';
import { FacturacionOrdenesService } from './facturacion-ordenes.service';
import { ManualProvider } from './invoicing/manual.provider';
import { AfipSdkProvider } from './invoicing/afip-sdk.provider';

@Module({
  controllers: [AdministracionController],
  providers: [
    MetodosPagoService,
    CobrosService,
    TesoreriaService,
    ConfiguracionFiscalService,
    ComprobantesService,
    ImputacionesService,
    CuentaCorrienteService,
    FacturaService,
    FacturaPdfService,
    EstadoCuentaPdfService,
    FacturacionOrdenesService,
    ManualProvider,
    AfipSdkProvider,
  ],
})
export class AdministracionModule {}
