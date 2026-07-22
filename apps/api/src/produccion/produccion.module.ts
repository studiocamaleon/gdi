import { Module } from '@nestjs/common';
import { ProduccionController } from './produccion.controller';
import { ProduccionService } from './produccion.service';

@Module({
  controllers: [ProduccionController],
  providers: [ProduccionService],
  // EtaModule reusa el ensamblado de estaciones/medianas/días/config.
  exports: [ProduccionService],
})
export class ProduccionModule {}
