import { Module } from '@nestjs/common';
import { DatosEmpresaService } from './datos-empresa.service';

/**
 * Módulo propio y mínimo para los datos de empresa.
 *
 * Existe para que los tres consumidores —presupuestos, recibos y el
 * seguimiento público— puedan pedirlos sin arrastrar `TenantsModule`, que trae
 * a `AuthModule` y `ArchivosModule` detrás y cerraría un ciclo de imports.
 */
@Module({
  providers: [DatosEmpresaService],
  exports: [DatosEmpresaService],
})
export class DatosEmpresaModule {}
