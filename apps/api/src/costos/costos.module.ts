import { Module } from '@nestjs/common';
import { EmpleadosModule } from '../empleados/empleados.module';
import { CostosController } from './costos.controller';
import { CostosService } from './costos.service';
import { CostosCatalogoService } from './costos-catalogo.service';
import { CostosConfiguracionPeriodoService } from './costos-configuracion-periodo.service';
import { CostosMapper } from './costos.mapper';
import { CostosRepartoService } from './costos-reparto.service';
import { CostosTarifasService } from './costos-tarifas.service';
import { CostosValidacionesService } from './costos-validaciones.service';

@Module({
  // Los componentes de sueldo se derivan del legajo. La dependencia va en un
  // solo sentido —Costos → Empleados— para no armar un ciclo.
  imports: [EmpleadosModule],
  controllers: [CostosController],
  providers: [
    CostosService,
    CostosCatalogoService,
    CostosConfiguracionPeriodoService,
    CostosTarifasService,
    CostosRepartoService,
    CostosValidacionesService,
    CostosMapper,
  ],
})
export class CostosModule {}
