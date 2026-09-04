import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { MotorUniversalService } from './motor.service';
import {
  CotizarAsincronoDto,
  CotizarDto,
  RecotizarItemDto,
} from './cotizar.dto';
import type { CotizarOutput } from './tipos';
import { Permiso } from '../auth/permiso.decorator';
import { OcultaMargenes } from '../auth/margenes.decorator';
import {
  AnalizarSvgFabricacionDto,
  MedirSvgFabricacionDto,
  NormalizarFuenteVectorialDto,
} from './geometria-vectorial/analizar-svg.dto';
import {
  analizarSvgFabricacion,
  SvgFabricacionError,
} from './geometria-vectorial/svg-parser';
import { NestingIrregularError } from './geometria-vectorial/nesting-irregular';
import { GeometriaVectorialCacheService } from './geometria-vectorial/geometria-vectorial-cache.service';
import { resolverConfiguracionEncastresVectoriales } from './geometria-vectorial/segmentacion-encastres';
import { AnalisisVectorialAsyncService } from './geometria-vectorial/analisis-vectorial-async.service';
import { CotizacionJobsService } from '../workers/cotizacion/cotizacion-jobs.service';
import {
  FuenteVectorialError,
  normalizarFuenteVectorial,
} from './geometria-vectorial/fuente-vectorial';

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
    private readonly analisisVectorialAsync: AnalisisVectorialAsyncService,
    private readonly cotizacionesAsync: CotizacionJobsService,
  ) {}

  /** Puerta única de ingreso para SVG y DXF. Devuelve un SVG canónico para
   * mantener compatibles recetas y cotizaciones históricas. */
  @Post('geometria-vectorial/normalizar')
  normalizarFuente(
    @Body() dto: NormalizarFuenteVectorialDto,
    @Req() req: RequestWithAuth,
  ) {
    if (!req.auth?.tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
    try {
      return {
        nombreArchivo: dto.nombreArchivo,
        ...normalizarFuenteVectorial(dto),
      };
    } catch (error) {
      if (error instanceof FuenteVectorialError) {
        throw new BadRequestException({
          message: error.message,
          diagnosticos: error.diagnosticos,
        });
      }
      if (error instanceof SvgFabricacionError) {
        throw new BadRequestException({
          message: error.message,
          diagnosticos: error.diagnosticos,
        });
      }
      throw error;
    }
  }

  /**
   * Obtiene la proporción de los contornos fabricables, no del lienzo del SVG.
   * No ejecuta nesting ni persiste: permite dimensionar una fuente compartida
   * con el mismo criterio geométrico que luego utilizará el costeo.
   */
  @Post('geometria-vectorial/medir')
  medirSvg(@Body() dto: MedirSvgFabricacionDto, @Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
    try {
      const { geometria, diagnosticos } = analizarSvgFabricacion({
        svg: dto.svg,
        anchoFinalMm: 1_000,
      });
      return {
        nombreArchivo: dto.nombreArchivo,
        relacionAltoAncho: geometria.altoMm / geometria.anchoMm,
        diagnosticos,
      };
    } catch (error) {
      if (error instanceof SvgFabricacionError) {
        throw new BadRequestException({
          message: error.message,
          diagnosticos: error.diagnosticos,
        });
      }
      throw error;
    }
  }

  /** Interpreta la fuente para el editor de capas, sin ejecutar nesting. */
  @Post('geometria-vectorial/preparar')
  prepararSvg(
    @Body() dto: AnalizarSvgFabricacionDto,
    @Req() req: RequestWithAuth,
  ) {
    if (!req.auth?.tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
    try {
      const analisis = analizarSvgFabricacion({
        svg: dto.svg,
        anchoFinalMm: dto.anchoFinalMm,
        altoFinalMm: dto.altoFinalMm,
      });
      return {
        nombreArchivo: dto.nombreArchivo,
        geometria: analisis.geometria,
        configuracionCapas: dto.configuracionCapas,
        diagnosticos: analisis.diagnosticos,
      };
    } catch (error) {
      if (error instanceof SvgFabricacionError) {
        throw new BadRequestException({
          message: error.message,
          diagnosticos: error.diagnosticos,
        });
      }
      throw error;
    }
  }

  /** Encola el nesting real. El worker devuelve y valida el único layout que
   * luego usan tanto la vista como la cotización. */
  @Post('geometria-vectorial/analizar-asincrono')
  @HttpCode(HttpStatus.ACCEPTED)
  async analizarSvgAsincrono(
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
      return await this.analisisVectorialAsync.iniciar({ tenantId, dto });
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

  @Get('geometria-vectorial/trabajos/:id')
  consultarAnalisisSvg(@Param('id') id: string, @Req() req: RequestWithAuth) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
    return this.analisisVectorialAsync.consultar(tenantId, id);
  }

  @Delete('geometria-vectorial/trabajos/:id')
  cancelarAnalisisSvg(@Param('id') id: string, @Req() req: RequestWithAuth) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
    return this.analisisVectorialAsync.cancelar(tenantId, id);
  }

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
          permitirSegmentacion: dto.permitirSegmentacion !== false,
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
        solucionNesting: entry.solucionNesting,
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
   * Variante durable del costeo. Devuelve 202 y permite que productos con
   * geometría compleja continúen aunque finalice la petición HTTP original.
   */
  @Post('cotizar-asincrono')
  @HttpCode(HttpStatus.ACCEPTED)
  async cotizarAsincrono(
    @Body() dto: CotizarAsincronoDto,
    @Req() req: RequestWithAuth,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
    return this.cotizacionesAsync.crear({
      claveSolicitud: dto.claveSolicitud,
      cotizacion: {
        tenantId,
        productoId: dto.productoId,
        rutaAlternativaId: dto.rutaAlternativaId ?? null,
        jobContext: dto.jobContext as never,
        clienteId: dto.clienteId ?? null,
        periodo: dto.periodo ?? null,
        descuento: dto.descuento ?? null,
      },
    });
  }

  @Get('cotizaciones-asincronas/:id')
  consultarCotizacionAsincrona(
    @Param('id') id: string,
    @Req() req: RequestWithAuth,
  ) {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Falta tenant en el contexto de autenticación',
      );
    }
    return this.cotizacionesAsync.consultar(tenantId, id);
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
