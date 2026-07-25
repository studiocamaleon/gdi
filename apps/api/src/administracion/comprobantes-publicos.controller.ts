import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TipoEnlacePublico } from '@prisma/client';
import { Public } from '../auth/public.decorator';
import { ArchivosService } from '../archivos/archivos.service';
import { EnlacesPublicosService } from '../enlaces-publicos/enlaces-publicos.service';
import { ComprobantesService } from './comprobantes.service';

/**
 * El comprobante fiscal visto por el CLIENTE, sin sesión: el token del link
 * (`/f/<token>`) es la credencial. Devuelve el documento tal como lo exige la
 * normativa —el mismo contenido del PDF— y nada del contexto interno.
 *
 * Controller aparte, igual que el del recibo: todo lo de `administracion`
 * exige sesión, y mezclar una ruta pública ahí adentro es exactamente como se
 * filtra una por descuido.
 */
@Controller('comprobantes')
export class ComprobantesPublicosController {
  constructor(
    private readonly comprobantes: ComprobantesService,
    private readonly enlaces: EnlacesPublicosService,
    private readonly archivos: ArchivosService,
  ) {}

  @Public()
  @Get('publico/:token')
  async publico(@Param('token') token: string) {
    const enlace = await this.enlaces.resolver(
      token,
      TipoEnlacePublico.FACTURA,
      { contarVisita: true },
    );
    if (!enlace) throw new NotFoundException('No encontramos ese comprobante.');
    return this.comprobantes.documentoPublico(
      enlace.tenantId,
      enlace.entidadId,
    );
  }

  /** El PDF desde el link del cliente: el token autoriza, igual que la vista. */
  @Public()
  @Get('publico/:token/pdf')
  async pdfPublico(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const enlace = await this.enlaces.resolver(
      token,
      TipoEnlacePublico.FACTURA,
    );
    if (!enlace) {
      res.status(404).end();
      return;
    }
    const archivo = await this.comprobantes.pdfDe(
      enlace.tenantId,
      enlace.entidadId,
    );
    res.redirect(302, await this.archivos.urlDeDescarga(archivo.id));
  }

  /** El logo de la imprenta para la vista pública (302 a URL firmada de 60 s). */
  @Public()
  @Get('publico/:token/logo')
  async logoPublico(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const enlace = await this.enlaces.resolver(
      token,
      TipoEnlacePublico.FACTURA,
    );
    if (!enlace) {
      res.status(404).end();
      return;
    }
    const url = await this.archivos.urlDeLogoPublico(enlace.tenantId);
    if (!url) {
      res.status(404).end();
      return;
    }
    res.redirect(302, url);
  }
}
