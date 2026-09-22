import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { Module } from '@nestjs/common';
import { RecorridosVectorialesService } from './recorridos-vectoriales.service';
import { PreparacionesRecorridoController } from './preparaciones-recorrido.controller';
import { PreparacionesRecorridoService } from './preparaciones-recorrido.service';

@Module({
  imports: [CapacidadesEmpresaModule],
  controllers: [PreparacionesRecorridoController],
  providers: [RecorridosVectorialesService, PreparacionesRecorridoService],
  exports: [RecorridosVectorialesService, PreparacionesRecorridoService],
})
export class RecorridosVectorialesModule {}
