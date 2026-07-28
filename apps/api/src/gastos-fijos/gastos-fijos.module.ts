import { Module } from '@nestjs/common';
import { GastosFijosController } from './gastos-fijos.controller';
import { GastosFijosService } from './gastos-fijos.service';

@Module({
  // La nómina real sale de los legajos: la línea de sueldos del punto de
  // equilibrio se concilia contra ella.
  controllers: [GastosFijosController],
  providers: [GastosFijosService],
})
export class GastosFijosModule {}
