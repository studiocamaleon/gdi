import {
  Controller,
  Get,
  Header,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { SinTenant } from '../common/sin-tenant.decorator';
import { PlataformaGuard } from './plataforma.guard';
import { PlataformaAdminGuard } from './plataforma-admin.guard';
import { IncidentesService, type FiltroIncidentes } from './incidentes.service';

export class FiltroIncidentesDto implements FiltroIncidentes {
  @IsIn(['production', 'staging']) entorno: FiltroIncidentes['entorno'] =
    'production';
  @IsIn(['24h', '7d', '14d']) periodo: FiltroIncidentes['periodo'] = '24h';
  @IsIn(['abiertos', 'resueltos', 'todos']) estado: FiltroIncidentes['estado'] =
    'abiertos';
  @IsIn(['si', 'no']) pruebas: FiltroIncidentes['pruebas'] = 'no';
}

@Controller('plataforma/incidentes')
@SinTenant()
@UseGuards(PlataformaGuard)
export class IncidentesController {
  constructor(private readonly incidentes: IncidentesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(@Query() filtro: FiltroIncidentesDto) {
    return this.incidentes.listar(filtro);
  }

  @Post('prueba')
  @Header('Cache-Control', 'no-store')
  @UseGuards(PlataformaAdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 1 } })
  probar() {
    return this.incidentes.probar();
  }
}
