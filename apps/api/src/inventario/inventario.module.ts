import { Module } from '@nestjs/common';
import { InventarioController } from './inventario.controller';
import { InventarioStockController } from './inventario-stock.controller';
import { InventarioService } from './inventario.service';

@Module({
  controllers: [InventarioController, InventarioStockController],
  providers: [InventarioService],
})
export class InventarioModule {}
