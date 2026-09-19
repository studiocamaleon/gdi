import { UseGuards } from '@nestjs/common';
import {
  ImpresionDirectaGuard,
  ImpresionManual,
} from './impresion-directa.guard';
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ValidateNested,
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
import { Type } from 'class-transformer';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { ImpresionService } from './impresion.service';
import { DocumentosOrdenService } from './documentos-orden.service';
import { PerfilesImpresionService } from './perfiles-impresion.service';
import {
  DestinoImpresionDto,
  BandejaImpresionDto,
  PerfilImpresionDto,
  PreparacionBandejaDto,
  ConfiguracionCadDto,
  PruebaCadDto,
} from './perfiles-impresion.dto';
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
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  pagina?: number;
  @IsUUID()
  perfilId!: string;
  @IsString()
  @MaxLength(60)
  @Matches(/^\d+:\d+:\d+$/)
  revisionPerfil!: string;
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
export class LiberarImpresionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(140, { each: true })
  trabajos!: string[];
  @IsUUID() perfilId!: string;
  @IsString() @Matches(/^\d+:\d+:\d+$/) revision!: string;
}
export class GrupoLiberarDto {
  @IsUUID() ordenId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(140, { each: true })
  trabajos!: string[];
}
export class LiberarLoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GrupoLiberarDto)
  grupos!: GrupoLiberarDto[];
  @IsUUID() perfilId!: string;
  @IsString() @Matches(/^\d+:\d+:\d+$/) revision!: string;
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

export class EscucharImpresoraDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  // eslint-disable-next-line no-control-regex -- Excluye controles del nombre de cola.
  @Matches(/^[^\x00-\x1f\x7f]+$/)
  impresora?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  // eslint-disable-next-line no-control-regex -- Excluye controles de cada nombre de cola.
  @Matches(/^[^\x00-\x1f\x7f]+$/, { each: true })
  impresoras?: string[];
  @IsInt()
  @Min(1)
  timestamp!: number;
}

export class DetallesImpresorasDto {
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
@UseGuards(ImpresionDirectaGuard)
@Controller('impresion')
export class ImpresionController {
  constructor(
    private readonly service: ImpresionService,
    private readonly documentos: DocumentosOrdenService,
    private readonly perfiles: PerfilesImpresionService,
  ) {}
  @Get('perfiles')
  @Permiso(
    'configuracion.ver',
    'comercial.ver',
    'produccion.ver',
    'produccion.ejecutar',
  )
  configuracionPerfiles(@CurrentSession() auth: CurrentAuth) {
    return this.perfiles.configuracion(auth);
  }
  @Post('destinos')
  @Permiso('configuracion.gestionar')
  crearDestino(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: DestinoImpresionDto,
  ) {
    return this.perfiles.guardarDestino(auth, body);
  }
  @Put('destinos/:id')
  @Permiso('configuracion.gestionar')
  editarDestino(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DestinoImpresionDto,
  ) {
    return this.perfiles.guardarDestino(auth, body, id);
  }
  @Post('destinos/:id/bandejas')
  @Permiso('configuracion.gestionar')
  crearBandeja(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: BandejaImpresionDto,
  ) {
    return this.perfiles.agregarBandeja(auth, id, body);
  }
  @Put('destinos/:id/cad')
  @Permiso('configuracion.gestionar')
  guardarCad(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConfiguracionCadDto,
  ) {
    return this.perfiles.guardarCad(auth, id, body);
  }
  @Post('destinos/:id/prueba-cad')
  @Permiso('configuracion.gestionar')
  @Header('Cache-Control', 'no-store')
  pruebaCad(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PruebaCadDto,
  ) {
    return this.perfiles.pruebaCad(auth, id, body);
  }
  @Post('perfiles')
  @Permiso('configuracion.gestionar')
  crearPerfil(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: PerfilImpresionDto,
  ) {
    return this.perfiles.guardarPerfil(auth, body);
  }
  @Put('perfiles/:id')
  @Permiso('configuracion.gestionar')
  editarPerfil(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PerfilImpresionDto,
  ) {
    return this.perfiles.guardarPerfil(auth, body, id);
  }
  @Post('bandejas/:id/preparacion')
  @Permiso('configuracion.gestionar', 'produccion.ejecutar')
  prepararBandeja(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PreparacionBandejaDto,
  ) {
    return this.perfiles.prepararBandeja(auth, id, body);
  }
  @Post('perfiles/:id/prueba')
  @Permiso('configuracion.gestionar')
  pruebaPerfil(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.perfiles.prueba(auth, id);
  }
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
  @Post('detalles-impresoras')
  @Permiso('configuracion.gestionar')
  @Header('Cache-Control', 'no-store')
  detallesImpresoras(@Body() body: DetallesImpresorasDto) {
    return this.service.detallesImpresoras(body.timestamp);
  }
  @Post('escuchar')
  @Permiso('configuracion.ver', 'comercial.gestionar', 'produccion.ejecutar')
  @Header('Cache-Control', 'no-store')
  escuchar(@Body() body: EscucharImpresoraDto) {
    return this.service.escucharImpresora(
      body.impresoras ?? body.impresora ?? [],
      body.timestamp,
    );
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

  @Get('cola')
  @Permiso('comercial.ver', 'produccion.ver', 'produccion.ejecutar')
  @Header('Cache-Control', 'no-store')
  cola(
    @CurrentSession() auth: CurrentAuth,
    @Query('desde', new DefaultValuePipe(0), ParseIntPipe) desde: number,
  ) {
    return this.documentos.cola(auth, Math.max(0, desde));
  }
  @Post('cola/liberar')
  @Permiso('comercial.gestionar', 'produccion.ejecutar')
  liberarLote(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: LiberarLoteDto,
  ) {
    return this.documentos.liberarLote(
      auth,
      body.grupos,
      body.perfilId,
      body.revision,
    );
  }
  @Post('ordenes/:id/cola')
  @Permiso('comercial.gestionar', 'produccion.ejecutar')
  solicitar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentos.solicitar(auth, id);
  }
  @Post('ordenes/:id/liberar-impresion')
  @Permiso('comercial.gestionar', 'produccion.ejecutar')
  liberar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LiberarImpresionDto,
  ) {
    return this.documentos.liberar(
      auth,
      id,
      body.trabajos,
      body.perfilId,
      body.revision,
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
      body.perfilId,
      body.revisionPerfil,
      body.pagina,
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
  @ImpresionManual()
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
