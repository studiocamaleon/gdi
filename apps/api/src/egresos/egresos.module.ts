import { Module } from '@nestjs/common';

import { EgresosController } from './egresos.controller';
import { EgresosService } from './egresos.service';

@Module({
  controllers: [EgresosController],
  providers: [EgresosService],
  exports: [EgresosService],
})
export class EgresosModule {}
