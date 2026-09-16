import { Module } from '@nestjs/common';
import { ProduccionController } from './produccion.controller';
import { ProduccionService } from './produccion.service';
import { EquiposProduccionController } from './equipos-produccion.controller';
import { EquiposProduccionService } from './equipos-produccion.service';
import { ColasProduccionController } from './colas/colas.controller';
import { ColasProduccionService } from './colas/colas.service';
import { SimulacionNestingColaService } from './colas/simulacion-nesting.service';

@Module({
  controllers: [ProduccionController, EquiposProduccionController, ColasProduccionController],
  providers: [ProduccionService, EquiposProduccionService, ColasProduccionService, SimulacionNestingColaService],
  // EtaModule reusa el ensamblado de estaciones/medianas/días/config.
  exports: [ProduccionService, ColasProduccionService],
})
export class ProduccionModule {}
