import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';
import { Module } from '@nestjs/common';
import { InventarioBibliotecaService } from './inventario-biblioteca.service';
import { InventarioController } from './inventario.controller';
import { InventarioStockController } from './inventario-stock.controller';
import { InventarioService } from './inventario.service';

@Module({
  imports: [CotizacionesModule],
  controllers: [InventarioController, InventarioStockController],
  providers: [InventarioService, InventarioBibliotecaService],
})
export class InventarioModule {}
