import { Module } from '@nestjs/common';
import { ControlTrabajosGeometriaService } from '../control-trabajos-geometria.service';
import { GeometriaJobsController } from './geometria-jobs.controller';
import { GeometriaJobsService } from './geometria-jobs.service';
import { NestingsGuardadosModule } from './nestings-guardados.service';
import { CapacidadGeometriaModule } from './capacidad-geometria.service';

@Module({
  imports: [NestingsGuardadosModule, CapacidadGeometriaModule],
  controllers: [GeometriaJobsController],
  providers: [GeometriaJobsService, ControlTrabajosGeometriaService],
  exports: [GeometriaJobsService],
})
export class GeometriaJobsModule {}
