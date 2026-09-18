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
  IsBoolean,
  IsInt,
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

@Permiso('produccion.ver', 'produccion.ejecutar', 'configuracion.ver')
@Controller('impresion')
export class ImpresionController {
  constructor(private readonly service: ImpresionService) {}
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
  @Permiso('configuracion.ver')
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
