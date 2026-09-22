import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import { SinTenant } from '../common/sin-tenant.decorator';
import { PlataformaGuard } from './plataforma.guard';
import { PlataformaAdminGuard } from './plataforma-admin.guard';
import { PaginaPlataformaDto } from './plataforma.controller';
import { ContratacionesPlataformaService } from './contrataciones-plataforma.service';

export class RecuperarContratacionDto {
  @IsUUID() solicitudId: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  motivo: string;
  @IsOptional()
  @IsString()
  @Matches(/^txn_[a-z0-9]{26}$/)
  transaccionId?: string;
}

@Controller('plataforma/suscripciones/:id/contrataciones')
@SinTenant()
@UseGuards(PlataformaGuard)
export class ContratacionesPlataformaController {
  constructor(private readonly service: ContratacionesPlataformaService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  listar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: PaginaPlataformaDto,
  ) {
    return this.service.listar(id, dto.pagina, dto.limite);
  }
  @Get(':contratacionId/historial')
  @Header('Cache-Control', 'no-store')
  historial(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contratacionId', ParseUUIDPipe) contratacionId: string,
    @Query() dto: PaginaPlataformaDto,
  ) {
    return this.service.historial(id, contratacionId, dto.pagina, dto.limite);
  }
  @Post(':contratacionId/consultar')
  @Header('Cache-Control', 'no-store')
  @UseGuards(PlataformaAdminGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  recuperar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contratacionId', ParseUUIDPipe) contratacionId: string,
    @Body() dto: RecuperarContratacionDto,
  ) {
    return this.service.recuperar(auth, id, contratacionId, dto);
  }
}
