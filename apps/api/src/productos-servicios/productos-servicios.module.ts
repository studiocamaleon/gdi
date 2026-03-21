import { Module } from '@nestjs/common';
import { ProductosServiciosController } from './productos-servicios.controller';
import { ProductosServiciosService } from './productos-servicios.service';

@Module({
  controllers: [ProductosServiciosController],
  providers: [ProductosServiciosService],
})
export class ProductosServiciosModule {}
