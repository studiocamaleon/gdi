import { FacturacionCoreModule } from './facturacion-core.module';
import { FacturacionLotesController } from './facturacion-lotes.controller';
import { EventosSistemaModule } from '../eventos-sistema/eventos-sistema.module';
import { FiscalPlataformaModule } from '../fiscal-plataforma/fiscal-plataforma.module';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos/archivos.module';
import { DatosEmpresaModule } from '../tenants/datos-empresa.module';
import { EnlacesPublicosModule } from '../enlaces-publicos/enlaces-publicos.module';
import { SuscripcionesModule } from '../suscripciones/suscripciones.module';
import { AdministracionController } from './administracion.controller';
import { RecibosController } from './recibos.controller';
import { ComprobantesPublicosController } from './comprobantes-publicos.controller';
import { MetodosPagoService } from './metodos-pago.service';
import { CobrosService } from './cobros.service';
import { TesoreriaService } from './tesoreria.service';
import { ImputacionesService } from './imputaciones.service';
import { CuentaCorrienteService } from './cuenta-corriente.service';
import { EstadoCuentaPdfService } from './estado-cuenta-pdf.service';
import { RecibosService } from './recibos.service';
import { ReciboPdfService } from './recibo-pdf.service';

@Module({
  imports: [
    FacturacionCoreModule,
    EventosSistemaModule,
    FiscalPlataformaModule,
    CapacidadesEmpresaModule,
    ArchivosModule,
    EnlacesPublicosModule,
    SuscripcionesModule,
    DatosEmpresaModule,
  ],
  // El público primero: `administracion` no tiene comodines hoy, pero el
  // orden de registro es el que resuelve Nest y no cuesta nada dejarlo claro.
  controllers: [
    FacturacionLotesController,
    RecibosController,
    ComprobantesPublicosController,
    AdministracionController,
  ],
  providers: [
    MetodosPagoService,
    CobrosService,
    TesoreriaService,
    ImputacionesService,
    CuentaCorrienteService,
    EstadoCuentaPdfService,
    RecibosService,
    ReciboPdfService,
  ],
  // El seguimiento público del recibo lo sirve su propio controller.
  // Recibos: seguimiento público. Comprobantes: el billing del control plane.
  // CobrosService lo usa la entrega en el mostrador (cobrar y entregar en un
  // acto). La dependencia sigue siendo de ida: Administración no importa
  // OrdenesTrabajoModule.
  exports: [
    FacturacionCoreModule,
    RecibosService,
    CobrosService,
  ],
})
export class AdministracionModule {}
