import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { GuardarDatosEmpresaDto } from './dto/datos-empresa.dto';
import { aE164 } from '../integraciones/telefono';
import { MONEDA_DEFAULT, monedaDe, type Moneda } from '../common/monedas';

export const ZONA_DEFAULT = 'America/Argentina/Buenos_Aires';

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
      monedaCodigo: datos?.monedaCodigo ?? MONEDA_DEFAULT,
      zonaHoraria: datos?.zonaHoraria ?? ZONA_DEFAULT,
      redondeoPrecio: datos?.redondeoPrecio ?? 'moneda',
    };
  }

  /**
   * La config regional pelada, para el resto del API: en qué moneda trabaja
   * el tenant, en qué zona vive su "hora de pared" y cómo redondea el
   * pricing. Con defaults argentinos cuando la fila no existe, así ningún
   * consumidor tiene que contemplar el null.
   */
  async regional(tenantId: string): Promise<ConfigRegional> {
    const d = await this.prisma.datosEmpresa.findUnique({
      where: { tenantId },
      select: { monedaCodigo: true, zonaHoraria: true, redondeoPrecio: true },
    });
    return {
      moneda: monedaDe(d?.monedaCodigo),
      zonaHoraria: d?.zonaHoraria ?? ZONA_DEFAULT,
      redondeoPrecio: d?.redondeoPrecio === 'entero' ? 'entero' : 'moneda',
    };
  }

  /**
   * Los mismos datos, ya masticados para los DOCUMENTOS: el PDF del
   * presupuesto, el del recibo y el seguimiento que ve el cliente.
   *
   * Se resuelve acá y no en cada consumidor porque las tres decisiones son
   * las mismas en los tres lados —cómo se arma la dirección, cómo se escribe
   * el teléfono, qué se muestra cuando falta la mitad de los datos— y
   * repetirlas garantizaba que se fueran separando.
   *
   * Toma `tenantId` y no `CurrentAuth` a propósito: el seguimiento público no
   * tiene sesión.
   */
  async paraDocumentos(tenantId: string): Promise<EmpresaEnDocumentos> {
    const d = await this.prisma.datosEmpresa.findUnique({
      where: { tenantId },
    });
    if (!d) return SIN_DATOS;

    const domicilio =
      [d.domicilioComercial, d.localidad, d.provincia]
        .map((x) => x?.trim())
        .filter(Boolean)
        .join(', ') || null;

    // El WhatsApp cae al teléfono: la mayoría de las imprentas usan el mismo
    // número y no lo cargan dos veces.
    const wsp = paraWhatsapp(
      d.whatsappNumero ? d.whatsappCodigo : d.telefonoCodigo,
      d.whatsappNumero ?? d.telefonoNumero,
      d.paisCodigo,
    );

    return {
      telefono: telefonoLegible(d.telefonoCodigo, d.telefonoNumero),
      telefonoLink: paraLlamar(d.telefonoCodigo, d.telefonoNumero),
      whatsapp: wsp,
      email: d.email,
      sitioWeb: d.sitioWeb,
      // En papel el esquema es ruido: nadie tipea "https://" al leer un PDF.
      sitioWebLegible: sinEsquema(d.sitioWeb),
      domicilio,
      horarioAtencion: d.horarioAtencion,
      urlResenas: d.urlResenas,
      moneda: monedaDe(d.monedaCodigo),
      zonaHoraria: d.zonaHoraria ?? ZONA_DEFAULT,
    };
  }

  async guardar(
    auth: CurrentAuth,
    dto: GuardarDatosEmpresaDto,
  ): Promise<DatosEmpresaResponse> {
    // La zona se valida contra ICU, que es quien la va a interpretar después:
    // una zona escrita mal no rompería al guardar sino semanas más tarde, en
    // el medio de un cálculo de ETA.
    if (dto.zonaHoraria !== undefined && !zonaValida(dto.zonaHoraria)) {
      throw new BadRequestException(
        `Zona horaria desconocida: "${dto.zonaHoraria}"`,
      );
    }

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
      // Los tres regionales tienen default en la base: sólo pisan si vienen.
      ...(dto.monedaCodigo !== undefined && {
        monedaCodigo: dto.monedaCodigo.toUpperCase(),
      }),
      ...(dto.zonaHoraria !== undefined && { zonaHoraria: dto.zonaHoraria }),
      ...(dto.redondeoPrecio !== undefined && {
        redondeoPrecio: dto.redondeoPrecio,
      }),
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

/** La config regional del tenant, siempre resuelta (nunca null). */
export type ConfigRegional = {
  moneda: Moneda;
  zonaHoraria: string;
  redondeoPrecio: 'moneda' | 'entero';
};

/** Lo que un documento necesita saber del negocio, ya formateado. */
export type EmpresaEnDocumentos = {
  /** "+54 3415551840", para imprimir. */
  telefono: string | null;
  /**
   * "+543415551840", para un `tel:`. Es lo que se cargó en forma
   * internacional, sin inventarle nada — ver `paraLlamar`.
   */
  telefonoLink: string | null;
  /**
   * "5493415551840", para `wa.me`. NO es lo mismo que `telefonoLink`: acá sí
   * se fuerza la forma móvil argentina. Cae al teléfono si no hay un WhatsApp
   * propio cargado.
   */
  whatsapp: string | null;
  email: string | null;
  /** Con esquema, para un `href`. */
  sitioWeb: string | null;
  /** Sin esquema ni "www.", para imprimir. */
  sitioWebLegible: string | null;
  /** "Mendoza 3450, Rosario, Santa Fe". */
  domicilio: string | null;
  horarioAtencion: string | null;
  urlResenas: string | null;
  /** Nunca null: sin fila de datos, la moneda es la default (ARS). */
  moneda: Moneda;
  zonaHoraria: string;
};

const SIN_DATOS: EmpresaEnDocumentos = {
  telefono: null,
  telefonoLink: null,
  whatsapp: null,
  email: null,
  sitioWeb: null,
  sitioWebLegible: null,
  domicilio: null,
  horarioAtencion: null,
  urlResenas: null,
  moneda: monedaDe(null),
  zonaHoraria: ZONA_DEFAULT,
};

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
  monedaCodigo: string;
  zonaHoraria: string;
  redondeoPrecio: string;
};

/**
 * ¿ICU conoce esta zona? `Intl` tira `RangeError` con una zona inválida, y
 * es exactamente el runtime que después la va a usar — mejor juez imposible.
 */
function zonaValida(zona: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

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

/** "+54 3415551840". Sin número no hay nada que mostrar. */
function telefonoLegible(
  codigo: string | null,
  numero: string | null,
): string | null {
  const n = (numero ?? '').trim();
  if (!n) return null;
  const c = (codigo ?? '').trim();
  return c ? `+${c} ${n}` : n;
}

/**
 * Para un `tel:`: el número cargado en forma internacional y nada más.
 *
 * NO se usa `aE164` acá, que es la función de WhatsApp: esa fuerza la forma
 * móvil argentina (le mete un `9`) porque para un mensaje conviene arriesgar.
 * Para una LLAMADA el riesgo es al revés — meterle el 9 a un fijo hace que la
 * llamada no entre—, así que se respeta lo que la imprenta cargó.
 */
function paraLlamar(codigo: string | null, numero: string | null): string | null {
  const n = (numero ?? '').replace(/\D/g, '');
  if (!n) return null;
  const c = (codigo ?? '').replace(/\D/g, '');
  return c ? `+${c}${n}` : `+${n}`;
}

/**
 * Para `wa.me`: dígitos, sin `+`, con la forma móvil que WhatsApp exige.
 * Null si el número no se puede interpretar — un link roto es peor que no
 * ofrecer el botón.
 */
function paraWhatsapp(
  codigo: string | null,
  numero: string | null,
  pais: string | null,
): string | null {
  if (!numero?.trim()) return null;
  const r = aE164({
    telefonoCodigo: codigo,
    telefonoNumero: numero,
    paisCodigo: pais,
  });
  return r.ok ? r.e164 : null;
}

/** "https://www.grafo.ar/" → "grafo.ar". */
function sinEsquema(url: string | null): string | null {
  if (!url) return null;
  return (
    url
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/$/, '') || null
  );
}
