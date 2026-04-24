import { Module } from '@nestjs/common';

/**
 * Módulo productos-servicios — modelo universal por pasos.
 *
 * Estado actual (Fase F.1.3): los 5 motores legacy (digital-sheet,
 * rigid-printed, talonario, vinyl-cut, wide-format) + el service monolítico
 * de 17k LOC + el controller fueron eliminados. El catálogo de familias
 * (`pasos/`), los algoritmos de nesting (`nesting/`) y los helpers de costing
 * (`costing/`) se preservan como infraestructura para el motor universal.
 *
 * Próximo paso (F.2): implementar `MotorUniversalService` que consume el
 * schema nuevo (Ruta, Producto, ProductoConfigPaso, etc.) y devuelve
 * costo + trazabilidad. Después se agregará el controller con los endpoints
 * nuevos (`POST /productos-servicios/v2/cotizar`).
 */
@Module({
  controllers: [],
  providers: [],
})
export class ProductosServiciosModule {}
