import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { CentroCopiadoService } from './centro-copiado.service';
import {
  AgregarAOrdenCentroCopiadoDto,
  CotizarCentroCopiadoDto,
} from './dto/cotizar-centro-copiado.dto';
import { ActualizarCentroCopiadoConfigDto } from './dto/centro-copiado-config.dto';
import { Permiso } from '../auth/permiso.decorator';
import { OcultaMargenes } from '../auth/margenes.decorator';
import { SuscripcionesService } from '../suscripciones/suscripciones.service';
import { CentroCopiadoSaludService } from './centro-copiado-salud.service';
import { CentroCopiadoAuditoriaService } from './centro-copiado-auditoria.service';

interface RequestWithAuth extends Request {
  auth?: { tenantId: string; userId: string };
}

@OcultaMargenes()
@Permiso('comercial.ver')
@Controller('centro-copiado')
export class CentroCopiadoController {
  constructor(
    private readonly centroCopiado: CentroCopiadoService,
    private readonly suscripciones: SuscripcionesService,
    private readonly saludCentroCopiado: CentroCopiadoSaludService,
    private readonly auditoriaCentroCopiado: CentroCopiadoAuditoriaService,
  ) {}

  private async tenantHabilitado(req: RequestWithAuth): Promise<string> {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
    if (!(await this.suscripciones.feature(tenantId, 'centroCopiado'))) {
      throw new ForbiddenException(
        'El plan actual no incluye el Centro de Copiado.',
      );
    }
    return tenantId;
  }

  /** GET /centro-copiado/estado — si el módulo está activo (para el botón/atajo). */
  @Get('estado')
  async estado(@Req() req: RequestWithAuth) {
    const tenantId = await this.tenantHabilitado(req);
    return this.centroCopiado.estado(tenantId);
  }

  /** GET /centro-copiado/opciones — papeles disponibles para el modal. */
  @Get('opciones')
  async opciones(@Req() req: RequestWithAuth) {
    const tenantId = await this.tenantHabilitado(req);
    return this.centroCopiado.opciones(tenantId);
  }

  /**
   * POST /centro-copiado/cotizar
   *
   * Preview en vivo del TPV: cotiza cada documento (un segmento de impresión) y
   * devuelve el desglose por documento, por tomo y los totales. No persiste.
   */
  @Post('cotizar')
  async cotizar(
    @Body() dto: CotizarCentroCopiadoDto,
    @Req() req: RequestWithAuth,
  ) {
    const tenantId = await this.tenantHabilitado(req);
    return this.centroCopiado.cotizar(tenantId, dto);
  }

  /**
   * POST /centro-copiado/construir-items
   *
   * Devuelve, por documento, el payload para stagear un PropuestaItem en el front
   * (jobContext + snapshot + especificaciones + montos). No persiste: el guardado
   * lo hace el flujo normal de la propuesta.
   */
  @Post('construir-items')
  async construirItems(
    @Body() dto: AgregarAOrdenCentroCopiadoDto,
    @Req() req: RequestWithAuth,
  ) {
    const tenantId = await this.tenantHabilitado(req);
    return this.centroCopiado.construirItems(tenantId, dto);
  }

  /**
   * POST /centro-copiado/guardar-tomo
   *
   * Persiste UN tomo anillado como un CotizacionItem compuesto (impresión de sus
   * sub-documentos agregada). Lo llama el "Guardar cambios" del front para los
   * renglones de tomo. Recibe los documentos del tomo + su grupo + cotizacionId.
   */
  @Post('guardar-tomo')
  async guardarTomo(
    @Body() dto: AgregarAOrdenCentroCopiadoDto,
    @Req() req: RequestWithAuth,
  ) {
    const tenantId = await this.tenantHabilitado(req);
    return this.centroCopiado.guardarTomo(tenantId, dto);
  }

  /**
   * POST /centro-copiado/agregar-a-orden
   *
   * Persiste la carga en una cotización borrador con la misma representación
   * canónica del staging: un ítem por suelto y uno por tomo compuesto. No crea
   * la OrdenTrabajo: eso sigue el flujo normal.
   */
  @Post('agregar-a-orden')
  async agregarAOrden(
    @Body() dto: AgregarAOrdenCentroCopiadoDto,
    @Req() req: RequestWithAuth,
  ) {
    const tenantId = await this.tenantHabilitado(req);
    return this.centroCopiado.agregarAOrden(tenantId, dto);
  }

  /**
   * GET /centro-copiado/config — configuración del módulo + universo disponible
   * (papeles/terminaciones a elegir). Para la página de Configuración.
   */
  @Get('config')
  @Permiso('costos.gestionar')
  async getConfig(@Req() req: RequestWithAuth) {
    const tenantId = await this.tenantHabilitado(req);
    return this.centroCopiado.getConfig(tenantId);
  }

  /** Diagnóstico operativo: nunca repara ni provisiona durante la lectura. */
  @Get('salud')
  @Permiso('costos.gestionar')
  async salud(@Req() req: RequestWithAuth) {
    const tenantId = await this.tenantHabilitado(req);
    return this.saludCentroCopiado.obtener(tenantId);
  }

  /** PUT /centro-copiado/config — actualiza la curación del módulo. */
  @Put('config')
  @Permiso('costos.gestionar')
  async actualizarConfig(
    @Body() dto: ActualizarCentroCopiadoConfigDto,
    @Req() req: RequestWithAuth,
  ) {
    const tenantId = await this.tenantHabilitado(req);
    return this.centroCopiado.actualizarConfig(tenantId, dto, req.auth?.userId);
  }

  /** POST explícito: crea/repara la plantilla; ningún GET escribe datos. */
  @Post('inicializar')
  @Permiso('costos.gestionar')
  async inicializar(@Req() req: RequestWithAuth) {
    const tenantId = await this.tenantHabilitado(req);
    return this.centroCopiado.inicializar(tenantId, req.auth?.userId);
  }

  /** Reparación explícita e idempotente de la infraestructura del módulo. */
  @Post('reparar')
  @Permiso('costos.gestionar')
  async reparar(@Req() req: RequestWithAuth) {
    const tenantId = await this.tenantHabilitado(req);
    await this.centroCopiado.reparar(tenantId, req.auth?.userId);
    return this.saludCentroCopiado.obtener(tenantId);
  }

  @Get('historial')
  @Permiso('costos.gestionar')
  async historial(@Req() req: RequestWithAuth) {
    const tenantId = await this.tenantHabilitado(req);
    return this.auditoriaCentroCopiado.listar(tenantId);
  }
}
