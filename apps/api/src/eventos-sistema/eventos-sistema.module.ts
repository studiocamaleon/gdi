import { Global, Module } from '@nestjs/common';
import { EventosSistemaController } from './eventos-sistema.controller';
import { EventosSistemaService } from './eventos-sistema.service';

@Global()
@Module({
  controllers: [EventosSistemaController],
  providers: [EventosSistemaService],
  exports: [EventosSistemaService],
})
export class EventosSistemaModule {}
