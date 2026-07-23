import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos/archivos.module';
import { EnlacesPublicosModule } from '../enlaces-publicos/enlaces-publicos.module';
import { SuscripcionesModule } from '../suscripciones/suscripciones.module';
import { AdministracionController } from './administracion.controller';
import { RecibosController } from './recibos.controller';
import { MetodosPagoService } from './metodos-pago.service';
import { CobrosService } from './cobros.service';
import { AcreditacionesScheduler } from './acreditaciones.scheduler';
import { TesoreriaService } from './tesoreria.service';
import { ConfiguracionFiscalService } from './configuracion-fiscal.service';
import { AfipIntegracionService } from './afip-integracion.service';
import { ComprobantesService } from './comprobantes.service';
import { ImputacionesService } from './imputaciones.service';
import { CuentaCorrienteService } from './cuenta-corriente.service';
import { FacturaService } from './factura.service';
import { FacturaPdfService } from './factura-pdf.service';
import { EstadoCuentaPdfService } from './estado-cuenta-pdf.service';
import { RecibosService } from './recibos.service';
import { ReciboPdfService } from './recibo-pdf.service';
import { FacturacionOrdenesService } from './facturacion-ordenes.service';
import { ManualProvider } from './invoicing/manual.provider';
import { AfipSdkProvider } from './invoicing/afip-sdk.provider';

@Module({
  imports: [ArchivosModule, EnlacesPublicosModule, SuscripcionesModule],
  // El público primero: `administracion` no tiene comodines hoy, pero el
  // orden de registro es el que resuelve Nest y no cuesta nada dejarlo claro.
  controllers: [RecibosController, AdministracionController],
  providers: [
    MetodosPagoService,
    CobrosService,
    AcreditacionesScheduler,
    TesoreriaService,
    ConfiguracionFiscalService,
    AfipIntegracionService,
    ComprobantesService,
    ImputacionesService,
    CuentaCorrienteService,
    FacturaService,
    FacturaPdfService,
    EstadoCuentaPdfService,
    RecibosService,
    ReciboPdfService,
    FacturacionOrdenesService,
    ManualProvider,
    AfipSdkProvider,
  ],
  // El seguimiento público del recibo lo sirve su propio controller.
  exports: [RecibosService],
})
export class AdministracionModule {}
