import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { Module } from '@nestjs/common';
import { CuponesController } from './cupones.controller';
import { CuponesService } from './cupones.service';

@Module({
  imports: [CapacidadesEmpresaModule],
  controllers: [CuponesController],
  providers: [CuponesService],
  exports: [CuponesService],
})
export class CuponesModule {}
