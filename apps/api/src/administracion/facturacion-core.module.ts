import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { ArchivosModule } from '../archivos/archivos.module';
import { DatosEmpresaModule } from '../tenants/datos-empresa.module';
import { EnlacesPublicosModule } from '../enlaces-publicos/enlaces-publicos.module';
import { FiscalPlataformaModule } from '../fiscal-plataforma/fiscal-plataforma.module';
import { IntegracionesModule } from '../integraciones/integraciones.module';
import { EventosSistemaModule } from '../eventos-sistema/eventos-sistema.module';
import { ConfiguracionFiscalService } from './configuracion-fiscal.service';
import { AfipIntegracionService } from './afip-integracion.service';
import { EmisionFiscalService } from './emision-fiscal.service';
import { ComprobantesService } from './comprobantes.service';
import { FacturaService } from './factura.service';
import { FacturaPdfService } from './factura-pdf.service';
import { FacturacionOrdenesService } from './facturacion-ordenes.service';
import { FacturacionLotesService } from './facturacion-lotes.service';
import { ManualProvider } from './invoicing/manual.provider';
import { AfipSdkProvider } from './invoicing/afip-sdk.provider';

const servicios = [
  ConfiguracionFiscalService,
  AfipIntegracionService,
  EmisionFiscalService,
  ComprobantesService,
  FacturaService,
  FacturaPdfService,
  FacturacionOrdenesService,
  FacturacionLotesService,
  ManualProvider,
  AfipSdkProvider,
];

/** Mismo dominio fiscal en HTTP y workers; no arrastra cajas, cobros ni cron. */
@Module({
  imports: [
    PrismaModule,
    CapacidadesEmpresaModule,
    ArchivosModule,
    DatosEmpresaModule,
    EnlacesPublicosModule,
    FiscalPlataformaModule,
    IntegracionesModule,
    EventosSistemaModule,
  ],
  providers: servicios,
  exports: servicios,
})
export class FacturacionCoreModule {}
