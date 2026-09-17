import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentSession } from '../../auth/current-auth.decorator';
import { Permiso } from '../../auth/permiso.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { ColasProduccionService } from './colas.service';
import { ConsultaColaDto } from './consulta-cola.dto';
import { SimulacionNestingColaService } from './simulacion-nesting.service';
import { SimularNestingColaDto } from './simular-nesting.dto';

@Permiso('produccion.ver')
@Controller('produccion/colas')
export class ColasProduccionController {
  constructor(
    private readonly service: ColasProduccionService,
    private readonly simulacion: SimulacionNestingColaService,
  ) {}

  @Post(':maquinaId/simular-nesting')
  @HttpCode(200)
  simular(
    @CurrentSession() auth: CurrentAuth,
    @Param('maquinaId', ParseUUIDPipe) maquinaId: string,
    @Body() dto: SimularNestingColaDto,
  ) {
    return this.simulacion.simular(auth.tenantId, maquinaId, dto.pasoIds);
  }

  @Get()
  maquinas(@CurrentSession() auth: CurrentAuth) {
    return this.service.maquinas(auth.tenantId);
  }

  @Get(':maquinaId')
  listar(
    @CurrentSession() auth: CurrentAuth,
    @Param('maquinaId', ParseUUIDPipe) maquinaId: string,
    @Query() consulta: ConsultaColaDto,
  ) {
    return this.service.listar(auth.tenantId, maquinaId, consulta, auth);
  }
}
