import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmpleadosController } from './empleados.controller';
import { EmpleadosService } from './empleados.service';
import { RemuneracionesService } from './remuneraciones.service';

@Module({
  imports: [AuthModule],
  controllers: [EmpleadosController],
  providers: [EmpleadosService, RemuneracionesService],
  // Costos consume la remuneración vigente para armar los componentes de
  // sueldos de cada centro, y Gastos fijos el total de la nómina.
  exports: [RemuneracionesService],
})
export class EmpleadosModule {}
