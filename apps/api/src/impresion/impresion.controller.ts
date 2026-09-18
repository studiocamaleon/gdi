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

export class PrepararEtiquetaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  // La cola no puede contener controles, saltos de línea ni tabuladores.
  // eslint-disable-next-line no-control-regex
  @Matches(/^[^\x00-\x1f\x7f]+$/)
  impresora!: string;
  @IsInt()
  @Min(1)
  @Max(20)
  copias!: number;
  @IsInt()
  @Min(0)
  @Max(199)
  pagina!: number;
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
