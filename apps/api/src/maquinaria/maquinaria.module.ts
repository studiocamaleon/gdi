import { Module } from '@nestjs/common';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { MaquinariaController } from './maquinaria.controller';
import { MaquinariaService } from './maquinaria.service';

@Module({
  imports: [CapacidadesEmpresaModule],
  controllers: [MaquinariaController],
  providers: [MaquinariaService],
})
export class MaquinariaModule {}
