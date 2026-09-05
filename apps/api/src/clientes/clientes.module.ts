import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { WhatsappContextoController } from './whatsapp-contexto.controller';
import { WhatsappContextoService } from './whatsapp-contexto.service';

@Module({
  controllers: [ClientesController, WhatsappContextoController],
  providers: [ClientesService, WhatsappContextoService],
})
export class ClientesModule {}
