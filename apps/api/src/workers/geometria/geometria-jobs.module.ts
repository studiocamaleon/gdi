import { Module } from '@nestjs/common';
import { ControlTrabajosGeometriaService } from '../control-trabajos-geometria.service';
import { GeometriaJobsController } from './geometria-jobs.controller';
import { GeometriaJobsService } from './geometria-jobs.service';

@Module({
  controllers: [GeometriaJobsController],
  providers: [GeometriaJobsService, ControlTrabajosGeometriaService],
  exports: [GeometriaJobsService],
})
export class GeometriaJobsModule {}
