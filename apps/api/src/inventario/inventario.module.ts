import { PrevisionMaterialesService } from './prevision-materiales.service';
import { PrevisionMaterialesController } from './prevision-materiales.controller';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';
import { Module } from '@nestjs/common';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { InventarioBibliotecaService } from './inventario-biblioteca.service';
import { InventarioController } from './inventario.controller';
import { InventarioStockController } from './inventario-stock.controller';
import { InventarioService } from './inventario.service';

@Module({
  imports: [CotizacionesModule, CapacidadesEmpresaModule],
  controllers: [
    InventarioController,
    InventarioStockController,
    PrevisionMaterialesController,
  ],
  providers: [
    InventarioService,
    InventarioBibliotecaService,
    PrevisionMaterialesService,
  ],
  exports: [InventarioService, PrevisionMaterialesService],
})
export class InventarioModule {}
