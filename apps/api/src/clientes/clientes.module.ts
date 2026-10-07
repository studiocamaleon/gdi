import {
  SolicitudesAltaController,
  RegistroClientesPublicoController,
} from './solicitudes-alta.controller';
import { SolicitudesAltaService } from './solicitudes-alta.service';
import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { WhatsappContextoController } from './whatsapp-contexto.controller';
import { WhatsappContextoService } from './whatsapp-contexto.service';

@Module({
  imports: [CapacidadesEmpresaModule],
  controllers: [
    ClientesController,
    WhatsappContextoController,
    SolicitudesAltaController,
    RegistroClientesPublicoController,
  ],
  providers: [ClientesService, WhatsappContextoService, SolicitudesAltaService],
  exports: [WhatsappContextoService],
})
export class ClientesModule {}
