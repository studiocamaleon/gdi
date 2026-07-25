import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmpleadosController } from './empleados.controller';
import { EmpleadosService } from './empleados.service';
import { NominaCostosService } from './nomina-costos.service';
import { RemuneracionesService } from './remuneraciones.service';

@Module({
  imports: [AuthModule],
  controllers: [EmpleadosController],
  providers: [EmpleadosService, RemuneracionesService, NominaCostosService],
  // Costos consume la remuneración vigente para derivar los componentes de
  // sueldo de cada centro, y Gastos fijos el total de la nómina. El puente vive
  // acá y no en Costos para que la dependencia vaya en un solo sentido:
  // Costos → Empleados, nunca al revés.
  exports: [RemuneracionesService, NominaCostosService],
})
export class EmpleadosModule {}
