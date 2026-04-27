import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImpuestosCatalogoController } from './catalogos/impuestos-catalogo.controller';
import { ImpuestosCatalogoService } from './catalogos/impuestos-catalogo.service';
import { ComisionesCatalogoController } from './catalogos/comisiones-catalogo.controller';
import { ComisionesCatalogoService } from './catalogos/comisiones-catalogo.service';
import { PrecioAplicacionesController } from './aplicaciones/precio-aplicaciones.controller';
import { PrecioAplicacionesService } from './aplicaciones/precio-aplicaciones.service';
import { PreciosEspecialesClientesController } from './precios-especiales-clientes/precios-especiales-clientes.controller';
import { PreciosEspecialesClientesService } from './precios-especiales-clientes/precios-especiales-clientes.service';
import { AplicarPrecioService } from './aplicar-precio.service';

/**
 * Módulo Tab Precio (Sprint 5.a) — capa comercial sobre el costo del motor.
 *
 * Composición:
 *   - 2 catálogos del tenant (impuestos, comisiones) — CRUD con soft-delete.
 *   - 2 pivots producto ⇄ catálogo (impuestos aplicados, comisiones aplicadas)
 *     con replace-all batch atómico.
 *   - Precios especiales por cliente (override del precio standard).
 *   - AplicarPrecioService (pure function, stateless): consume costo +
 *     config + impuestos + comisiones y devuelve precio neto/bruto +
 *     desglose + snapshots inmutables.
 *
 * `AplicarPrecioService` se exporta para que el cotizador (módulo `cotizacion`,
 * cuando exista) lo inyecte y lo use al crear `CotizacionItem`.
 */
@Module({
  imports: [PrismaModule],
  controllers: [
    ImpuestosCatalogoController,
    ComisionesCatalogoController,
    PrecioAplicacionesController,
    PreciosEspecialesClientesController,
  ],
  providers: [
    ImpuestosCatalogoService,
    ComisionesCatalogoService,
    PrecioAplicacionesService,
    PreciosEspecialesClientesService,
    AplicarPrecioService,
  ],
  exports: [
    AplicarPrecioService,
    PreciosEspecialesClientesService,
    ImpuestosCatalogoService,
    ComisionesCatalogoService,
    PrecioAplicacionesService,
  ],
})
export class PrecioModule {}
