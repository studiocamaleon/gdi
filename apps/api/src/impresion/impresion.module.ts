import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos/archivos.module';
import { ImpresionController } from './impresion.controller';
import { ImpresionService } from './impresion.service';
import { DocumentosOrdenService } from './documentos-orden.service';

@Module({
  imports: [ArchivosModule],
  controllers: [ImpresionController],
  providers: [ImpresionService, DocumentosOrdenService],
})
export class ImpresionModule {}
