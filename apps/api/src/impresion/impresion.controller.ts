import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsOptional,
  IsUUID,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { ImpresionService } from './impresion.service';
import { DocumentosOrdenService } from './documentos-orden.service';
import {
  ESTADOS_IMPRESION,
  type EstadoImpresion,
} from './documentos-orden.domain';

export class ImpresoraDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  // La cola no puede contener controles, saltos de línea ni tabuladores.
  // eslint-disable-next-line no-control-regex
  @Matches(/^[^\x00-\x1f\x7f]+$/)
  impresora!: string;
}

export class PrepararEtiquetaDto extends ImpresoraDto {
  @IsInt()
  @Min(1)
  @Max(20)
  copias!: number;
  @IsInt()
  @Min(0)
  @Max(199)
  pagina!: number;
}

export class PrepararDocumentoDto extends ImpresoraDto {
  @IsUUID()
  intentoId!: string;
  @IsString()
  @MaxLength(253)
  @Matches(/^[a-zA-Z0-9.-]+$/)
  host!: string;
  @IsOptional()
  @IsUUID()
  reimpresionDe?: string;
}
export class EstadoDocumentoDto {
  @IsIn(ESTADOS_IMPRESION)
  estado!: EstadoImpresion;
  @IsString()
  @MaxLength(500)
  detalle!: string;
}

export class ConfirmarDocumentosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  envioIds!: string[];
}

export class EscucharImpresoraDto extends ImpresoraDto {
  @IsInt()
  @Min(1)
  timestamp!: number;
}

export class PruebaDocumentoDto extends ImpresoraDto {
  @IsInt()
  @Min(1)
  @Max(3)
  copias!: number;
  @IsBoolean()
  dobleFaz!: boolean;
}

@Permiso(
  'produccion.ver',
  'produccion.ejecutar',
  'configuracion.ver',
  'comercial.gestionar',
)
@Controller('impresion')
export class ImpresionController {
  constructor(
    private readonly service: ImpresionService,
    private readonly documentos: DocumentosOrdenService,
  ) {}
  @Get('configuracion')
  @Header('Cache-Control', 'no-store')
  configuracion(@CurrentSession() auth: CurrentAuth) {
    return this.service.configuracion(auth);
  }
  @Post('impresoras')
  @Header('Cache-Control', 'no-store')
  impresoras() {
    return this.service.buscarImpresoras();
  }
  @Post('escuchar')
  @Permiso('configuracion.ver', 'comercial.gestionar', 'produccion.ejecutar')
  @Header('Cache-Control', 'no-store')
  escuchar(@Body() body: EscucharImpresoraDto) {
    return this.service.escucharImpresora(body.impresora, body.timestamp);
  }
  @Post('prueba-documento')
  @Permiso('configuracion.ver')
  @Header('Cache-Control', 'no-store')
  pruebaDocumento(@Body() body: PruebaDocumentoDto) {
    return this.service.prepararPruebaDocumento(
      body.impresora,
      body.copias,
      body.dobleFaz,
    );
  }

  @Get('ordenes/:id/documentos')
  @Permiso('comercial.ver', 'produccion.ver', 'produccion.ejecutar')
  @Header('Cache-Control', 'no-store')
  vistaDocumentos(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentos.vista(auth, id);
  }
  @Post('ordenes/:id/documentos/:itemId')
  @Permiso('comercial.gestionar', 'produccion.ejecutar')
  @Header('Cache-Control', 'no-store')
  prepararDocumento(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: PrepararDocumentoDto,
  ) {
    return this.documentos.preparar(
      auth,
      id,
      itemId,
      body.intentoId,
      body.impresora,
      body.host,
      body.reimpresionDe,
    );
  }
  @Post('ordenes/:id/envios/:intentoId')
  @Permiso('comercial.gestionar', 'produccion.ejecutar')
  @Header('Cache-Control', 'no-store')
  estadoDocumento(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('intentoId', ParseUUIDPipe) intentoId: string,
    @Body() body: EstadoDocumentoDto,
  ) {
    return this.documentos.estado(
      auth,
      id,
      intentoId,
      body.estado,
      body.detalle,
    );
  }
  @Post('ordenes/:id/confirmacion-documentos')
  @Permiso('comercial.gestionar', 'produccion.ejecutar')
  @Header('Cache-Control', 'no-store')
  confirmarDocumentos(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConfirmarDocumentosDto,
  ) {
    return this.documentos.confirmar(auth, id, body.envioIds);
  }
  @Get('ordenes/:id/etiqueta')
  @Permiso('produccion.ver', 'produccion.ejecutar')
  @Header('Cache-Control', 'no-store')
  etiqueta(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.vistaPrevia(auth, id);
  }
  @Post('ordenes/:id/etiqueta')
  @Permiso('produccion.ver', 'produccion.ejecutar')
  @Header('Cache-Control', 'no-store')
  preparar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PrepararEtiquetaDto,
  ) {
    return this.service.preparar(
      auth,
      id,
      body.impresora,
      body.copias,
      body.pagina,
    );
  }
}
