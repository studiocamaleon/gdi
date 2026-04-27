import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductosServiciosController } from './productos-servicios.controller';
import { ProductosServiciosService } from './productos-servicios.service';
import { PrecioModule } from './precio/precio.module';

/**
 * Módulo productos-servicios — modelo universal por pasos.
 *
 * F.3 — endpoints CRUD del catálogo (productos, rutas, cargos, familias).
 *
 * Sub-módulos:
 * - pasos/    → catálogo de 38 familias (hardcoded en TS)
 * - nesting/  → algoritmos de nesting (extraídos en F.1)
 * - costing/  → helpers de carga de tarifas (extraídos en F.1)
 * - precio/   → Tab Precio v2 (Sprint 5.a): catálogos de impuestos y
 *               comisiones, pivots producto⇄catálogo, precios especiales
 *               por cliente, servicio AplicarPrecio (pure function).
 */
@Module({
  imports: [PrismaModule, PrecioModule],
  controllers: [ProductosServiciosController],
  providers: [ProductosServiciosService],
  exports: [ProductosServiciosService, PrecioModule],
})
export class ProductosServiciosModule {}
