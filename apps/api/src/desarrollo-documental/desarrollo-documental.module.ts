import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos/archivos.module';
import { EnlacesPublicosModule } from '../enlaces-publicos/enlaces-publicos.module';
import { DesarrolloDocumentalController } from './desarrollo-documental.controller';
import { DesarrolloDocumentalService } from './desarrollo-documental.service';

@Module({
  imports: [ArchivosModule, EnlacesPublicosModule],
  controllers: [DesarrolloDocumentalController],
  providers: [DesarrolloDocumentalService],
  exports: [DesarrolloDocumentalService],
})
export class DesarrolloDocumentalModule {}
