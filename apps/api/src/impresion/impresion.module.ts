import { CatalogoCadModule } from '../centro-copiado/catalogo-cad.module';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { ImpresionDirectaGuard } from './impresion-directa.guard';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArchivosModule } from '../archivos/archivos.module';
import { ImpresionController } from './impresion.controller';
import { ImpresionService } from './impresion.service';
import { DocumentosOrdenService } from './documentos-orden.service';
import { PerfilesImpresionService } from './perfiles-impresion.service';
import { MotorUniversalModule } from '../motor-universal/motor.module';
import { PerfilesCadService } from './perfiles-cad.service';
import { PerfilesCadController } from './perfiles-cad.controller';

@Module({
  imports: [
    CatalogoCadModule,
    CapacidadesEmpresaModule,
    ConfigModule,
    ArchivosModule,
    MotorUniversalModule,
  ],
  controllers: [ImpresionController, PerfilesCadController],
  exports: [PerfilesCadService],
  providers: [
    ImpresionDirectaGuard,
    ImpresionService,
    PerfilesImpresionService,
    PerfilesCadService,
    DocumentosOrdenService,
  ],
})
export class ImpresionModule {}
