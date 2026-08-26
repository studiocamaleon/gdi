import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import {
  AltaPorDocumentoDto,
  EstadoClienteDto,
  ImportarClientesDto,
  UpdateClienteDto,
  UpsertClienteDto,
} from './dto/upsert-cliente.dto';
import { ClientesQueryDto } from './dto/clientes-query.dto';
import { ClientesService } from './clientes.service';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';

@Permiso('crm.ver')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  findAll(
    @CurrentSession() auth: CurrentAuth,
    @Query() query: ClientesQueryDto,
  ) {
    return this.clientesService.findAll(auth, query);
  }

  /**
   * ¿Este documento ya está cargado? Se consulta al escanear, antes de
   * ofrecer el alta. Va antes de `:id` — "por-documento" no es un id.
   */
  @Get('por-documento/:documento')
  porDocumento(
    @CurrentSession() auth: CurrentAuth,
    @Param('documento') documento: string,
  ) {
    return this.clientesService.buscarPorDocumento(auth, documento);
  }

  @Get(':id')
  findOne(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.clientesService.findOne(auth, id);
  }

  @Permiso('crm.gestionar')
  @Post()
  create(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertClienteDto,
  ) {
    return this.clientesService.create(auth, payload);
  }

  @Permiso('crm.gestionar')
  @Post('importar')
  importar(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: ImportarClientesDto,
  ) {
    return this.clientesService.importar(auth, payload.clientes);
  }

  /**
   * Alta escaneando el DNI en el mostrador. Lo usa el comercial mientras
   * atiende, así que va con `comercial.gestionar` además del permiso de
   * registros: quien puede cargar la venta puede identificar al cliente.
   */
  @Permiso('crm.gestionar', 'comercial.gestionar')
  @Post('alta-por-documento')
  altaPorDocumento(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: AltaPorDocumentoDto,
  ) {
    return this.clientesService.altaPorDocumento(auth, payload);
  }

  @Permiso('crm.gestionar')
  @Put(':id')
  update(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpdateClienteDto,
  ) {
    return this.clientesService.update(auth, id, payload);
  }

  /** Fijar el estado explícitamente evita el read-toggle-write concurrente. */
  @Permiso('crm.gestionar')
  @Patch(':id/estado')
  estado(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: EstadoClienteDto,
  ) {
    return this.clientesService.fijarActivo(auth, id, payload.activo);
  }

  @Permiso('crm.gestionar')
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    await this.clientesService.remove(auth, id);
  }
}
