import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Permiso } from '../../auth/permiso.decorator';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { CentroCopiadoTarifariosService } from './centro-copiado-tarifarios.service';
import {
  CrearTarifarioDto,
  EditarTarifarioDto,
  PaginaTarifariosDto,
  PublicarTarifarioDto,
} from './tarifarios.dto';

interface RequestConAuth extends Request {
  auth?: { tenantId: string; userId: string };
}

@Permiso('configuracion.copiado.ver')
@Controller('centro-copiado/tarifarios')
export class CentroCopiadoTarifariosController {
  constructor(
    private readonly tarifarios: CentroCopiadoTarifariosService,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  private async contexto(req: RequestConAuth) {
    if (!req.auth?.tenantId || !req.auth.userId)
      throw new UnauthorizedException('Falta el contexto de autenticación.');
    await this.capacidades.exigirIncluida(req.auth.tenantId, 'centro_copiado');
    return req.auth;
  }

  @Get()
  async listar(
    @Req() req: RequestConAuth,
    @Query() pagina: PaginaTarifariosDto,
  ) {
    const { tenantId } = await this.contexto(req);
    return this.tarifarios.listar(tenantId, pagina.desplazamiento);
  }

  @Get(':id')
  async obtener(
    @Req() req: RequestConAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tarifarios.obtener((await this.contexto(req)).tenantId, id);
  }

  @Get(':id/versiones')
  async versiones(
    @Req() req: RequestConAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagina: PaginaTarifariosDto,
  ) {
    return this.tarifarios.versiones(
      (await this.contexto(req)).tenantId,
      id,
      pagina.desplazamiento,
    );
  }

  @Get(':id/vigente')
  async vigente(
    @Req() req: RequestConAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      version: await this.tarifarios.vigente(
        (await this.contexto(req)).tenantId,
        id,
      ),
    };
  }

  @Get(':id/versiones/:versionId')
  async version(
    @Req() req: RequestConAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.tarifarios.version(
      (await this.contexto(req)).tenantId,
      id,
      versionId,
    );
  }

  @Post()
  @Permiso('configuracion.copiado.gestionar')
  async crear(@Req() req: RequestConAuth, @Body() dto: CrearTarifarioDto) {
    const { tenantId, userId } = await this.contexto(req);
    return this.tarifarios.crear(tenantId, userId, dto);
  }

  @Put(':id')
  @Permiso('configuracion.copiado.gestionar')
  async editar(
    @Req() req: RequestConAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditarTarifarioDto,
  ) {
    const { tenantId, userId } = await this.contexto(req);
    return this.tarifarios.editar(tenantId, id, userId, dto);
  }

  @Post(':id/publicar')
  @Permiso('configuracion.copiado.gestionar')
  async publicar(
    @Req() req: RequestConAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublicarTarifarioDto,
  ) {
    const { tenantId, userId } = await this.contexto(req);
    return this.tarifarios.publicar(tenantId, id, userId, dto);
  }
}
