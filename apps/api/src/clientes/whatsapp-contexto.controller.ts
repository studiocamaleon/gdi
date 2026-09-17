import { Controller, Get, Header, Query } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso, SoloAutenticado } from '../auth/permiso.decorator';
import { WhatsappContextoDto } from './dto/whatsapp-contexto.dto';
import { WhatsappContextoService } from './whatsapp-contexto.service';

@Controller('chrome-whatsapp')
export class WhatsappContextoController {
  constructor(private readonly servicio: WhatsappContextoService) {}

  @SoloAutenticado()
  @Get('sesion')
  @Header('Cache-Control', 'no-store')
  sesion(@CurrentSession() auth: CurrentAuth) {
    return this.servicio.sesion(auth);
  }

  @Permiso('crm.ver')
  @Get('contexto')
  @Header('Cache-Control', 'no-store')
  contexto(
    @CurrentSession() auth: CurrentAuth,
    @Query() input: WhatsappContextoDto,
  ) {
    return this.servicio.contexto(auth, input);
  }
}
