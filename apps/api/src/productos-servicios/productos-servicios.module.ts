import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductosServiciosController } from './productos-servicios.controller';
import { ProductosServiciosService } from './productos-servicios.service';

/**
 * Módulo productos-servicios — modelo universal por pasos.
 *
 * F.3 — endpoints CRUD del catálogo (productos, rutas, cargos, familias).
 * Por ahora read-only (GET). POST/PUT/DELETE en sub-fases siguientes.
 *
 * Sub-módulos (preservados):
 * - pasos/    → catálogo de 38 familias (hardcoded en TS)
 * - nesting/  → algoritmos de nesting (extraídos en F.1)
 * - costing/  → helpers de carga de tarifas (extraídos en F.1)
 */
@Module({
  imports: [PrismaModule],
  controllers: [ProductosServiciosController],
  providers: [ProductosServiciosService],
  exports: [ProductosServiciosService],
})
export class ProductosServiciosModule {}
