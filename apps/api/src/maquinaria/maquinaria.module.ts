import { Module } from '@nestjs/common';
import { MaquinariaController } from './maquinaria.controller';
import { MaquinariaService } from './maquinaria.service';

@Module({
  controllers: [MaquinariaController],
  providers: [MaquinariaService],
})
export class MaquinariaModule {}
