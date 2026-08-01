import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { CentroCopiadoService } from './centro-copiado.service';
import {
  AgregarAOrdenCentroCopiadoDto,
  CotizarCentroCopiadoDto,
} from './dto/cotizar-centro-copiado.dto';
import { Permiso } from '../auth/permiso.decorator';
import { OcultaMargenes } from '../auth/margenes.decorator';

interface RequestWithAuth extends Request {
  auth?: { tenantId: string; userId: string };
}

@OcultaMargenes()
@Permiso('comercial.ver')
@Controller('centro-copiado')
export class CentroCopiadoController {
  constructor(private readonly centroCopiado: CentroCopiadoService) {}

  /** GET /centro-copiado/opciones — papeles disponibles para el modal. */
  @Get('opciones')
  async opciones(@Req() req: RequestWithAuth) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
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
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
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
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
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
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
    return this.centroCopiado.guardarTomo(tenantId, dto);
  }

  /**
   * POST /centro-copiado/agregar-a-orden
   *
   * Persiste la carga como N CotizacionItem (un renglón por documento) en una
   * cotización borrador. No crea la OrdenTrabajo: eso sigue el flujo normal.
   * (Camino alternativo/eager; el modal usa el flujo de staging con construir-items.)
   */
  @Post('agregar-a-orden')
  async agregarAOrden(
    @Body() dto: AgregarAOrdenCentroCopiadoDto,
    @Req() req: RequestWithAuth,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
    return this.centroCopiado.agregarAOrden(tenantId, dto);
  }
}
