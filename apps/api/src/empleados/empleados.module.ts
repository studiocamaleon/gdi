import { Module } from '@nestjs/common';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { AuthModule } from '../auth/auth.module';
import { EmpleadosController } from './empleados.controller';
import { EmpleadosService } from './empleados.service';

@Module({
  imports: [AuthModule, CapacidadesEmpresaModule],
  controllers: [EmpleadosController],
  providers: [EmpleadosService],
})
export class EmpleadosModule {}
