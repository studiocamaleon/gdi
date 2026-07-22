import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common';
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
  decisionPublica(@Param('token') token: string, @Body() dto: DecisionPublicaDto) {
    return this.service.decisionPublica(token, dto);
  }

  // ── Config ─────────────────────────────────────────────────────────
  @Get('config')
  config(@CurrentSession() auth: CurrentAuth) {
    return this.service.config(auth.tenantId);
  }

  /** El operador no se sube su propio umbral (plan F2 §6). */
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
  listado(@CurrentSession() auth: CurrentAuth, @Query() filtros: ListarPresupuestosDto) {
    return this.service.listado(auth, filtros);
  }

  @Post('emitir')
  emitir(@CurrentSession() auth: CurrentAuth, @Body() dto: EmitirPresupuestoDto) {
    return this.service.emitir(auth, dto);
  }

  @Get(':id')
  detalle(@CurrentSession() auth: CurrentAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detalle(auth, id);
  }

  @Patch(':id/enviar')
  enviar(@CurrentSession() auth: CurrentAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.enviar(auth, id);
  }

  @Patch(':id/resolver')
  resolver(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolverPresupuestoDto,
  ) {
    return this.service.resolver(auth, id, dto);
  }

  @Patch(':id/aprobacion')
  @Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)
  resolverAprobacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolverAprobacionDto,
  ) {
    return this.service.resolverAprobacion(auth, id, dto);
  }

  @Post(':id/convertir')
  convertir(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertirPresupuestoDto,
  ) {
    return this.service.convertir(auth, id, dto);
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  async pdfPresupuesto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const [detalle, cfg, tenant, logoDataUri] = await Promise.all([
      this.service.detalle(auth, id),
      this.service.config(auth.tenantId),
      this.pdfTenantNombre(auth.tenantId),
      this.archivos.logoDataUri(auth.tenantId),
    ]);
    const buffer = await this.pdf.generar({
      numero: detalle.numero!,
      negocio: tenant,
      logoDataUri,
      cliente: detalle.cliente?.nombre ?? null,
      vendedor: detalle.vendedor?.nombre ?? null,
      fechaEmision: detalle.fechaEmision,
      fechaValidez: detalle.fechaValidez,
      observaciones: detalle.observaciones,
      senaSugeridaPct: detalle.senaSugeridaPct,
      condicionesTexto: cfg.condicionesTexto,
      subtotal: detalle.subtotal,
      impuestos: detalle.impuestos,
      cargosDirectos: detalle.cargosDirectos,
      total: detalle.total,
      items: detalle.items,
    });
    return new StreamableFile(buffer, {
      disposition: `inline; filename="${detalle.numero}.pdf"`,
    });
  }

  private async pdfTenantNombre(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nombre: true },
    });
    return tenant?.nombre ?? 'Presupuesto';
  }
}
