import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { WhatsappContextoController } from './whatsapp-contexto.controller';
import { WhatsappContextoService } from './whatsapp-contexto.service';

@Module({
  imports: [CapacidadesEmpresaModule],
  controllers: [ClientesController, WhatsappContextoController],
  providers: [ClientesService, WhatsappContextoService],
})
export class ClientesModule {}
