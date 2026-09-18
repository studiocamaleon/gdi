import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos/archivos.module';
import { ImpresionController } from './impresion.controller';
import { ImpresionService } from './impresion.service';

@Module({
  imports: [ArchivosModule],
  controllers: [ImpresionController],
  providers: [ImpresionService],
})
export class ImpresionModule {}
