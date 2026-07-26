import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { GuardarDatosEmpresaDto } from './dto/datos-empresa.dto';

/**
 * Cómo se presenta la imprenta ante su cliente.
 *
 * Va aparte de `ConfiguracionFiscalService` a propósito: acá vive lo comercial
 * —teléfono, web, dónde queda, dónde dejar una reseña— y allá lo que ARCA
 * exige en un comprobante. Son dos públicos y dos permisos.
 *
 * Ver docs/datos-de-empresa-diseno.md
 */
@Injectable()
export class DatosEmpresaService {
  constructor(private readonly prisma: PrismaService) {}

  async leer(auth: CurrentAuth): Promise<DatosEmpresaResponse> {
    const [tenant, datos] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: auth.tenantId },
        select: { nombre: true },
      }),
      this.prisma.datosEmpresa.findUnique({
        where: { tenantId: auth.tenantId },
      }),
    ]);

    return {
      nombre: tenant?.nombre ?? '',
      telefonoCodigo: datos?.telefonoCodigo ?? null,
      telefonoNumero: datos?.telefonoNumero ?? null,
      paisCodigo: datos?.paisCodigo ?? null,
      whatsappCodigo: datos?.whatsappCodigo ?? null,
      whatsappNumero: datos?.whatsappNumero ?? null,
      email: datos?.email ?? null,
      sitioWeb: datos?.sitioWeb ?? null,
      domicilioComercial: datos?.domicilioComercial ?? null,
      localidad: datos?.localidad ?? null,
      provincia: datos?.provincia ?? null,
      horarioAtencion: datos?.horarioAtencion ?? null,
      urlResenas: datos?.urlResenas ?? null,
    };
  }

  async guardar(
    auth: CurrentAuth,
    dto: GuardarDatosEmpresaDto,
  ): Promise<DatosEmpresaResponse> {
    const datos = {
      telefonoCodigo: limpio(dto.telefonoCodigo),
      telefonoNumero: limpio(dto.telefonoNumero),
      paisCodigo: limpio(dto.paisCodigo)?.toUpperCase() ?? null,
      whatsappCodigo: limpio(dto.whatsappCodigo),
      whatsappNumero: limpio(dto.whatsappNumero),
      email: limpio(dto.email),
      sitioWeb: conEsquema(dto.sitioWeb),
      domicilioComercial: limpio(dto.domicilioComercial),
      localidad: limpio(dto.localidad),
      provincia: limpio(dto.provincia),
      horarioAtencion: limpio(dto.horarioAtencion),
      urlResenas: conEsquema(dto.urlResenas),
    };

    // El nombre comercial y el resto se guardan juntos o no se guarda nada:
    // son una sola pantalla y el usuario apretó un solo botón.
    await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: auth.tenantId },
        data: { nombre: dto.nombre.trim() },
      }),
      this.prisma.datosEmpresa.upsert({
        where: { tenantId: auth.tenantId },
        create: { tenantId: auth.tenantId, ...datos },
        update: datos,
      }),
    ]);

    return this.leer(auth);
  }
}

export type DatosEmpresaResponse = {
  nombre: string;
  telefonoCodigo: string | null;
  telefonoNumero: string | null;
  paisCodigo: string | null;
  whatsappCodigo: string | null;
  whatsappNumero: string | null;
  email: string | null;
  sitioWeb: string | null;
  domicilioComercial: string | null;
  localidad: string | null;
  provincia: string | null;
  horarioAtencion: string | null;
  urlResenas: string | null;
};

/** Vacío y "  " son lo mismo que no cargado: uno solo llega a la base. */
function limpio(v: string | undefined | null): string | null {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
}

/**
 * Le pone `https://` al link que no lo trae.
 *
 * Casi nadie escribe el esquema —se copia "grafo.ar" de una tarjeta—, y un
 * `href` sin esquema el navegador lo resuelve como ruta relativa: el cliente
 * que toca la web de la imprenta en el seguimiento público terminaba en
 * `app.grafo.ar/grafo.ar`, una página que no existe.
 */
function conEsquema(v: string | undefined | null): string | null {
  const t = limpio(v);
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}
