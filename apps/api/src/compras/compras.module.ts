import { Module } from '@nestjs/common';
import { InventarioModule } from '../inventario/inventario.module';
import { ReservasMaterialModule } from '../inventario/reservas-material.module';
import { ComprasController } from './compras.controller';
import { ComprasService } from './compras.service';
@Module({
  imports: [InventarioModule, ReservasMaterialModule],
  controllers: [ComprasController],
  providers: [ComprasService],
})
export class ComprasModule {}
