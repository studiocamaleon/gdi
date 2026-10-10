import { CatalogoCadModule } from './catalogo-cad.module';
import { CentroCopiadoCadService } from './centro-copiado-cad.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MotorUniversalModule } from '../motor-universal/motor.module';
import { CentroCopiadoController } from './centro-copiado.controller';
import { CentroCopiadoService } from './centro-copiado.service';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { CentroCopiadoSaludService } from './centro-copiado-salud.service';
import { CentroCopiadoAuditoriaService } from './centro-copiado-auditoria.service';
import { CentroCopiadoIdempotenciaService } from './centro-copiado-idempotencia.service';
import { CentroCopiadoTarifariosService } from './tarifarios/centro-copiado-tarifarios.service';
import { CentroCopiadoTarifariosController } from './tarifarios/centro-copiado-tarifarios.controller';
import { CentroCopiadoPoliticaController } from './tarifarios/centro-copiado-politica.controller';
import { CentroCopiadoPoliticaService } from './tarifarios/centro-copiado-politica.service';
import { CentroCopiadoSimulacionService } from './tarifarios/centro-copiado-simulacion.service';
import { CentroCopiadoSimulacionController } from './tarifarios/centro-copiado-simulacion.controller';

/**
 * TPV Centro de copiado. Consume el motor universal (via MotorUniversalModule)
 * para cotizar cada documento como un segmento de impresión sobre el producto
 * plantilla SYS-IMPRESION-DOC.
 */
@Module({
  imports: [
    PrismaModule,
    MotorUniversalModule,
    CapacidadesEmpresaModule,
    CatalogoCadModule,
  ],
  controllers: [
    CentroCopiadoSimulacionController,
    CentroCopiadoController,
    CentroCopiadoTarifariosController,
    CentroCopiadoPoliticaController,
  ],
  providers: [
    CentroCopiadoSimulacionService,
    CentroCopiadoCadService,
    CentroCopiadoService,
    CentroCopiadoSaludService,
    CentroCopiadoAuditoriaService,
    CentroCopiadoIdempotenciaService,
    CentroCopiadoTarifariosService,
    CentroCopiadoPoliticaService,
  ],
  exports: [
    CentroCopiadoService,
    CentroCopiadoSaludService,
    CentroCopiadoAuditoriaService,
    CentroCopiadoIdempotenciaService,
    CentroCopiadoTarifariosService,
    CentroCopiadoPoliticaService,
  ],
})
export class CentroCopiadoModule {}
