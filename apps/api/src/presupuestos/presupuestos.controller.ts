import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { RolSistema } from '@prisma/client';
import { ArchivosService } from '../archivos/archivos.service';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { PresupuestosService } from './presupuestos.service';
import { PresupuestoPdfService } from './presupuesto-pdf.service';
import {
  ActualizarConfigPresupuestosDto,
  ConvertirPresupuestoDto,
  DecisionPublicaDto,
  EmitirPresupuestoDto,
  ListarPresupuestosDto,
  ResolverAprobacionDto,
  ResolverPresupuestoDto,
} from './dto/presupuestos.dto';
import { Permiso } from '../auth/permiso.decorator';
import { OcultaMargenes } from '../auth/margenes.decorator';

@OcultaMargenes()
@Permiso('comercial.ver')
@Controller('presupuestos')
export class PresupuestosController {
  constructor(
    private readonly service: PresupuestosService,
    private readonly pdf: PresupuestoPdfService,
    private readonly prisma: PrismaService,
    private readonly archivos: ArchivosService,
  ) {}

  // ── Link público (sin sesión; el token es la credencial) ───────────
  @Public()
  @Get('track/:token')
  publico(@Param('token') token: string) {
    return this.service.publico(token);
  }

  @Public()
  @Post('track/:token/decision')
  decisionPublica(
    @Param('token') token: string,
    @Body() dto: DecisionPublicaDto,
  ) {
    return this.service.decisionPublica(token, dto);
  }

  // ── Config ─────────────────────────────────────────────────────────
  @Get('config')
  config(@CurrentSession() auth: CurrentAuth) {
    return this.service.config(auth.tenantId);
  }

  /** El operador no se sube su propio umbral (plan F2 §6). */
  @Permiso('comercial.gestionar')
  @Put('config')
  @Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)
  actualizarConfig(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: ActualizarConfigPresupuestosDto,
  ) {
    return this.service.actualizarConfig(auth.tenantId, dto);
  }

  // ── Ciclo ──────────────────────────────────────────────────────────
  @Get()
  listado(
    @CurrentSession() auth: CurrentAuth,
    @Query() filtros: ListarPresupuestosDto,
  ) {
    return this.service.listado(auth, filtros);
  }

  @Permiso('comercial.gestionar')
  @Post('emitir')
  emitir(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: EmitirPresupuestoDto,
  ) {
    return this.service.emitir(auth, dto);
  }

  @Get(':id')
  detalle(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detalle(auth, id);
  }

  @Permiso('comercial.gestionar')
  @Patch(':id/enviar')
  enviar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.enviar(auth, id);
  }

  @Permiso('comercial.gestionar')
  @Patch(':id/resolver')
  resolver(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolverPresupuestoDto,
  ) {
    return this.service.resolver(auth, id, dto);
  }

  // La excepción: cotizar lo hace el vendedor, autorizar un margen por debajo
  // del piso lo firma otro. Por eso no alcanza con `comercial.gestionar`.
  @Permiso('comercial.aprobar_descuento')
  @Patch(':id/aprobacion')
  @Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)
  resolverAprobacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolverAprobacionDto,
  ) {
    return this.service.resolverAprobacion(auth, id, dto);
  }

  @Permiso('comercial.gestionar')
  @Post(':id/convertir')
  convertir(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertirPresupuestoDto,
  ) {
    return this.service.convertir(auth, id, dto);
  }

  /**
   * El PDF del presupuesto. Sale del storage: se genera una vez (al emitir, o
   * en el primer pedido si el presupuesto es anterior a esto) y después es un
   * 302 a una URL firmada. Antes se lanzaba Chrome headless en cada request.
   */
  @Get(':id/pdf')
  async pdfPresupuesto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const archivo = await this.service.pdfDe(auth, id);
    res.redirect(302, await this.archivos.urlDeDescarga(archivo.id));
  }
}
