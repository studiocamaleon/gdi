import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { Module } from '@nestjs/common';
import { CampanasController } from './campanas.controller';
import { CampanasService } from './campanas.service';

@Module({
  imports: [CapacidadesEmpresaModule],
  controllers: [CampanasController],
  providers: [CampanasService],
  exports: [CampanasService],
})
export class CampanasModule {}
