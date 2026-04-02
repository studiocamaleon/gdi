import { Module } from '@nestjs/common';
import { ProduccionController } from './produccion.controller';
import { ProduccionService } from './produccion.service';

@Module({
  controllers: [ProduccionController],
  providers: [ProduccionService],
})
export class ProduccionModule {}
