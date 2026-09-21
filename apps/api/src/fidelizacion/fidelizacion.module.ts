import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { Global, Module } from '@nestjs/common';
import { FidelizacionController } from './fidelizacion.controller';
import { FidelizacionService } from './fidelizacion.service';

@Global()
@Module({
  imports: [CapacidadesEmpresaModule],
  controllers: [FidelizacionController],
  providers: [FidelizacionService],
  exports: [FidelizacionService],
})
export class FidelizacionModule {}
