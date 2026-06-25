import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductosServiciosController } from './productos-servicios.controller';
import { CargosDirectosProductoService } from './cargos-directos-producto.service';
import { ConfigPasosService } from './config-pasos.service';
import { FamiliasPasosService } from './familias-pasos.service';
import { ProductoRutasService } from './producto-rutas.service';
import { ProductoValidacionService } from './producto-validacion.service';
import { ProductosService } from './productos.service';
import { ProductosServiciosService } from './productos-servicios.service';
import { RutasProduccionService } from './rutas-produccion.service';
import { PrecioModule } from './precio/precio.module';

/**
 * Módulo productos-servicios — modelo universal por pasos.
 *
 * F.3 — endpoints CRUD del catálogo (productos, rutas, cargos, familias).
 *
 * Sub-módulos:
 * - pasos/    → catálogo de familias de paso (hardcoded en TS)
 * - nesting/  → algoritmos de nesting (extraídos en F.1)
 * - costing/  → helpers de carga de tarifas (extraídos en F.1)
 * - precio/   → Tab Precio v2 (Sprint 5.a): catálogos de impuestos y
 *               comisiones, pivots producto⇄catálogo, precios especiales
 *               por cliente, servicio AplicarPrecio (pure function).
 */
@Module({
  imports: [PrismaModule, PrecioModule],
  controllers: [ProductosServiciosController],
  providers: [
    ProductosServiciosService,
    ProductosService,
    RutasProduccionService,
    ProductoRutasService,
    ConfigPasosService,
    FamiliasPasosService,
    CargosDirectosProductoService,
    ProductoValidacionService,
  ],
  exports: [ProductosServiciosService, PrecioModule],
})
export class ProductosServiciosModule {}
