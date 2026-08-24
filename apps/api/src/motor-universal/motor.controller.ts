import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { MotorUniversalService } from './motor.service';
import { CotizarDto, RecotizarItemDto } from './cotizar.dto';
import type { CotizarOutput } from './tipos';
import { Permiso } from '../auth/permiso.decorator';
import { OcultaMargenes } from '../auth/margenes.decorator';
import { AnalizarSvgFabricacionDto } from './geometria-vectorial/analizar-svg.dto';
import { SvgFabricacionError } from './geometria-vectorial/svg-parser';
import { NestingIrregularError } from './geometria-vectorial/nesting-irregular';
import { GeometriaVectorialCacheService } from './geometria-vectorial/geometria-vectorial-cache.service';
import { resolverConfiguracionEncastresVectoriales } from './geometria-vectorial/segmentacion-encastres';

interface RequestWithAuth extends Request {
  auth?: { tenantId: string; userId: string };
}

@OcultaMargenes()
@Permiso('comercial.ver')
@Controller('motor-universal')
export class MotorUniversalController {
  constructor(
    private readonly motor: MotorUniversalService,
    private readonly geometriaCache: GeometriaVectorialCacheService,
  ) {}

  /**
   * Primera frontera del configurador vectorial. Analiza un SVG de una capa y
   * devuelve geometría canónica + nesting sobre una placa finita. No cotiza ni
   * persiste todavía: permite validar el archivo antes de incorporarlo al
   * JobContext y mantiene el parser fuera del navegador.
   */
  @Post('geometria-vectorial/analizar')
  analizarSvg(
    @Body() dto: AnalizarSvgFabricacionDto,
    @Req() req: RequestWithAuth,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
    try {
      const { entry, cacheHit } = this.geometriaCache.analizar({
        tenantId,
        svg: dto.svg,
        anchoFinalMm: dto.anchoFinalMm,
        altoFinalMm: dto.altoFinalMm,
        configuracionCapas: dto.configuracionCapas,
        parametros: {
          cantidad: dto.cantidad,
          anchoPlacaMm: dto.anchoPlacaMm,
          altoPlacaMm: dto.altoPlacaMm,
          margenMm: dto.margenMm ?? 0,
          separacionMm: dto.separacionMm ?? 0,
          permitirRotacion: dto.permitirRotacion !== false,
          preservarComposicionOriginalSiEntra:
            dto.preservarComposicionOriginalSiEntra === true,
          configuracionEncastres: resolverConfiguracionEncastresVectoriales(
            dto.configuracionEncastres,
          ),
        },
      });
      return {
        nombreArchivo: dto.nombreArchivo,
        cacheKey: entry.cacheKey,
        cacheHit,
        geometria: entry.analisis.geometria,
        nesting: entry.nesting,
        configuracionCapas: entry.configuracionCapas,
        configuracionEncastres: entry.parametros.configuracionEncastres,
        diagnosticos: entry.analisis.diagnosticos,
      };
    } catch (error) {
      if (error instanceof SvgFabricacionError) {
        throw new BadRequestException({
          message: error.message,
          diagnosticos: error.diagnosticos,
        });
      }
      if (error instanceof NestingIrregularError) {
        throw new BadRequestException({
          message: error.message,
          diagnosticos: [
            {
              codigo: 'pieza_no_entra',
              mensaje: error.message,
              severidad: 'ERROR',
            },
          ],
        });
      }
      throw error;
    }
  }

  /**
   * POST /motor-universal/cotizar
   *
   * Recibe un producto + jobContext y devuelve el costeo + trazabilidad.
   * Equivalente al "Cotizar" del modelo viejo, pero usando el motor universal.
   */
  @Post('cotizar')
  async cotizar(
    @Body() dto: CotizarDto,
    @Req() req: RequestWithAuth,
  ): Promise<CotizarOutput> {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }

    return this.motor.cotizar({
      tenantId,
      productoId: dto.productoId,
      rutaAlternativaId: dto.rutaAlternativaId ?? null,
      jobContext: dto.jobContext as never,
      clienteId: dto.clienteId ?? null,
      periodo: dto.periodo ?? null,
      descuento: dto.descuento ?? null,
    });
  }

  /**
   * POST /motor-universal/cotizar-y-guardar
   *
   * Cotiza y persiste como CotizacionItem (con snapshot completo).
   * Si se pasa cotizacionId, agrega item a esa cotización; sino crea una nueva.
   */
  @Post('cotizar-y-guardar')
  @Permiso('comercial.gestionar')
  async cotizarYGuardar(@Body() dto: CotizarDto, @Req() req: RequestWithAuth) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }

    return this.motor.cotizarYGuardar({
      tenantId,
      productoId: dto.productoId,
      rutaAlternativaId: dto.rutaAlternativaId ?? null,
      jobContext: dto.jobContext as never,
      clienteId: dto.clienteId ?? null,
      periodo: dto.periodo ?? null,
      descuento: dto.descuento ?? null,
      cotizacionId: dto.cotizacionId,
    });
  }

  @Patch('cotizacion-items/:id/recotizar')
  @Permiso('comercial.gestionar')
  async recotizarItem(
    @Param('id') id: string,
    @Body() dto: RecotizarItemDto,
    @Req() req: RequestWithAuth,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }

    return this.motor.recotizarItem({
      tenantId,
      cotizacionItemId: id,
      rutaAlternativaId: dto.rutaAlternativaId ?? null,
      jobContext: dto.jobContext as never,
      clienteId: dto.clienteId ?? null,
      periodo: dto.periodo ?? null,
      descuento: dto.descuento ?? null,
    });
  }
}
