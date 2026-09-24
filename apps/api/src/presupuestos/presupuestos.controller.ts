import {
  Body,
  Controller,
  Get,
  NotFoundException,
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
import { CorreoPresupuestoService } from './correo-presupuesto.service';
import { PresupuestoPdfService } from './presupuesto-pdf.service';
import {
  ActualizarConfigPresupuestosDto,
  ConvertirPresupuestoDto,
  DecisionPublicaDto,
  EmitirPresupuestoDto,
  ListarPresupuestosDto,
  ResolverAprobacionDto,
  ResolverPresupuestoDto,
  EnviarCorreoPresupuestoDto,
} from './dto/presupuestos.dto';
import { Permiso } from '../auth/permiso.decorator';
import { OcultaMargenes } from '../auth/margenes.decorator';
import { PresupuestoPilotoService } from './pdf-piloto/presupuesto-piloto.service';
import { pilotoPdfHabilitado } from './pdf-piloto/presupuesto-render.service';

@OcultaMargenes()
@Permiso('comercial.ver')
@Controller('presupuestos')
export class PresupuestosController {
  constructor(
    private readonly service: PresupuestosService,
    private readonly pdf: PresupuestoPdfService,
    private readonly prisma: PrismaService,
    private readonly archivos: ArchivosService,
    private readonly piloto: PresupuestoPilotoService,
    private readonly correos: CorreoPresupuestoService,
  ) {}

  // ── Link público (sin sesión; el token es la credencial) ───────────
  @Public()
  @Get('track/:token')
  publico(@Param('token') token: string) {
    return this.service.publico(token);
  }

  @Public()
  @Get('track/:token/logo')
  async logoPublico(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.service.logoPublicoPorToken(token);
    if (!url) {
      res.status(404).end();
      return;
    }
    res.redirect(302, url);
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
  @Get(':id/correo/preparar')
  prepararCorreo(@CurrentSession() auth: CurrentAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.correos.preparar(auth, id);
  }

  @Permiso('comercial.gestionar')
  @Post(':id/correo/vista-previa')
  vistaPreviaCorreo(@CurrentSession() auth: CurrentAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EnviarCorreoPresupuestoDto) {
    return this.correos.vistaPrevia(auth, id, dto);
  }

  @Permiso('comercial.gestionar')
  @Post(':id/correo')
  enviarCorreo(@CurrentSession() auth: CurrentAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EnviarCorreoPresupuestoDto) {
    return this.correos.encolar(auth, id, dto);
  }

  @Get(':id/correos')
  historialCorreos(@CurrentSession() auth: CurrentAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.correos.historial(auth, id);
  }

  @Permiso('comercial.gestionar')
  @Post(':id/correos/:correoId/reintentar')
  reintentarCorreo(@CurrentSession() auth: CurrentAuth, @Param('id', ParseUUIDPipe) id: string, @Param('correoId', ParseUUIDPipe) correoId: string) {
    return this.correos.reintentar(auth, id, correoId);
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

  /** Vista previa interna: no reemplaza ni publica el documento emitido. */
  @Get(':id/pdf-piloto')
  async pdfPiloto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!pilotoPdfHabilitado())
      throw new NotFoundException('PDF piloto no habilitado.');
    const datos = await this.service.datosPdf(auth, id);
    const contenido = await this.piloto.generar(auth.tenantId, id, datos);
    const nombre = `${datos.numero.replace(/[^a-zA-Z0-9_-]/g, '_')}-piloto.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nombre}"`,
      'Cache-Control': 'private, no-store',
    });
    res.send(contenido);
  }

  /**
   * Compatibilidad para consumidores directos: 202 mientras se prepara,
   * 302 al archivo guardado. La UI consulta /pdf/estado antes de abrirlo.
   */
  @Get(':id/pdf')
  async pdfPresupuesto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const estado = await this.service.estadoPdf(auth, id);
    res.set('Cache-Control', 'private, no-store');
    if (estado.estado === 'listo') res.redirect(302, estado.url);
    else res.status(202).set('Retry-After', '2').json(estado);
  }

  @Get(':id/pdf/estado')
  async estadoPdf(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    res
      .set('Cache-Control', 'private, no-store')
      .json(await this.service.estadoPdf(auth, id));
  }

  @Post(':id/pdf/reintentar')
  async reintentarPdf(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.reintentarPdf(auth, id);
  }
}
