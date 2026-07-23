import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TipoEnlacePublico } from '@prisma/client';
import { Public } from '../auth/public.decorator';
import { ArchivosService } from '../archivos/archivos.service';
import { EnlacesPublicosService } from '../enlaces-publicos/enlaces-publicos.service';
import { RecibosService } from './recibos.service';

/**
 * El recibo visto por el CLIENTE, sin sesión: el token del link (`/c/<token>`)
 * es la credencial. Devuelve sólo la proyección del recibo —nunca comisiones,
 * retenciones ni el resto del cobro, que es información interna de la imprenta.
 *
 * Va en su propio controller y no en el de administración porque todo lo de
 * allá exige sesión: mezclar rutas públicas en un controller privado es
 * exactamente como se filtra una por descuido.
 * Ver docs/recibos-pago-diseno.md
 */
@Controller('recibos')
export class RecibosController {
  constructor(
    private readonly recibos: RecibosService,
    private readonly enlaces: EnlacesPublicosService,
    private readonly archivos: ArchivosService,
  ) {}

  @Public()
  @Get('publico/:token')
  async publico(@Param('token') token: string) {
    const enlace = await this.enlaces.resolver(token, TipoEnlacePublico.COBRO, {
      contarVisita: true,
    });
    if (!enlace) throw new NotFoundException('No encontramos ese recibo.');
    return this.recibos.documento(enlace.entidadId);
  }

  /** El PDF desde el link del cliente: el token autoriza, igual que la vista. */
  @Public()
  @Get('publico/:token/pdf')
  async pdfPublico(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const enlace = await this.enlaces.resolver(token, TipoEnlacePublico.COBRO);
    if (!enlace) {
      res.status(404).end();
      return;
    }
    const archivo = await this.recibos.pdfDe(enlace.entidadId);
    res.redirect(302, await this.archivos.urlDeDescarga(archivo.id));
  }

  /** El logo de la imprenta para la vista pública (302 a URL firmada de 60 s). */
  @Public()
  @Get('publico/:token/logo')
  async logoPublico(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const enlace = await this.enlaces.resolver(token, TipoEnlacePublico.COBRO);
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
