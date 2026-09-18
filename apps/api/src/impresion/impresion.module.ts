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
  imports: [ConfigModule, ArchivosModule, MotorUniversalModule],
  controllers: [ImpresionController, PerfilesCadController],
  exports: [PerfilesCadService],
  providers: [
    ImpresionService,
    PerfilesImpresionService,
    PerfilesCadService,
    DocumentosOrdenService,
  ],
})
export class ImpresionModule {}
