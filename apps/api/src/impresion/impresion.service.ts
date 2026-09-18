import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  randomUUID,
  createPrivateKey,
  sign,
  X509Certificate,
  type KeyObject,
} from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PrismaService } from '../prisma/prisma.service';
import { ArchivosService } from '../archivos/archivos.service';
import type { CurrentAuth } from '../auth/auth.types';
import { pdfPruebaA4 } from './prueba-documento';
import { etiquetaTspl, renderizarEtiquetas } from './etiqueta-ot';

@Injectable()
export class ImpresionService {
  private identidad?: {
    certificado: string;
    clave: KeyObject;
    x509: X509Certificate;
  };
  constructor(
    private readonly prisma: PrismaService,
    private readonly archivos: ArchivosService,
    private readonly config: ConfigService,
  ) {}

  private claves() {
    if (!this.identidad) {
      const certificadoPath = this.config.get<string>(
        'QZ_SIGNING_CERTIFICATE_PATH',
      );
      const clavePath = this.config.get<string>('QZ_SIGNING_PRIVATE_KEY_PATH');
      if (!certificadoPath || !clavePath)
        throw new ServiceUnavailableException(
          'La impresión requiere configurar el certificado de Grafo en el servidor.',
        );
      try {
        const certificado = readFileSync(certificadoPath, 'utf8');
        const clave = createPrivateKey(readFileSync(clavePath));
        const x509 = new X509Certificate(certificado);
        if (clave.asymmetricKeyType !== 'rsa' || !x509.checkPrivateKey(clave))
          throw new Error('Identidad inválida');
        this.identidad = { certificado, clave, x509 };
      } catch {
        throw new ServiceUnavailableException(
          'No se pudo cargar el certificado de impresión. Contactá al administrador.',
        );
      }
    }
    const ahora = Date.now();
    if (
      ahora < Date.parse(this.identidad.x509.validFrom) ||
      ahora > Date.parse(this.identidad.x509.validTo)
    ) {
      throw new ServiceUnavailableException(
        'El certificado de impresión necesita renovarse. Contactá al administrador.',
      );
    }
    return this.identidad;
  }

  configuracion(auth: CurrentAuth) {
    try {
      const { certificado, x509 } = this.claves();
      return {
        tenantId: auth.tenantId,
        certificado,
        firmaDisponible: true,
        validoHasta: x509.validTo,
      };
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      return {
        tenantId: auth.tenantId,
        certificado: null,
        firmaDisponible: false,
        mensaje: error.message,
      };
    }
  }

  /** Se firman sólo mensajes construidos aquí; nunca un hash o comando del navegador. */
  private firmar<T extends object | undefined>(
    call: string,
    params: T,
    timestamp = Date.now(),
  ) {
    const hash = createHash('sha256')
      .update(JSON.stringify({ call, params, timestamp }))
      .digest('hex');
    const firma = sign(
      'RSA-SHA512',
      Buffer.from(hash),
      this.claves().clave,
    ).toString('base64');
    return { params, timestamp, hash, firma };
  }

  buscarImpresoras() {
    return this.firmar('printers.find', {});
  }

  detallesImpresoras(timestamp: number) {
    if (
      !Number.isSafeInteger(timestamp) ||
      Math.abs(Date.now() - timestamp) > 60000
    )
      throw new BadRequestException(
        'La consulta de bandejas venció. Revisá la hora del equipo.',
      );
    // details() del SDK omite params y asigna su propio timestamp. Se firma
    // exclusivamente esta consulta de lectura, sin aceptar comandos del cliente.
    return this.firmar('printers.detail', undefined, timestamp);
  }

  /** El único caller es el servicio de documentos, luego de validar la OT. */
  firmarDocumento(params: object) {
    return this.firmar('print', params);
  }

  escucharImpresora(impresora: string | string[], timestamp: number) {
    // El SDK asigna su timestamp al iniciar la escucha. Reconstruimos únicamente
    // este comando conocido; no se aceptan hashes, comandos ni jobData del cliente.
    if (
      !Number.isSafeInteger(timestamp) ||
      Math.abs(Date.now() - timestamp) > 60000
    )
      throw new BadRequestException(
        'La solicitud de escucha venció. Revisá la hora del equipo.',
      );
    const printerNames = Array.isArray(impresora) ? impresora : [impresora];
    if (!printerNames.length)
      throw new BadRequestException('Elegí las impresoras a seguir.');
    return this.firmar('printers.startListening', { printerNames }, timestamp);
  }

  prepararPruebaDocumento(
    impresora: string,
    copias: number,
    dobleFaz: boolean,
  ) {
    const jobName = `Grafo prueba A4 ${randomUUID()}`;
    const params = {
      printer: { name: impresora },
      options: {
        copies: copias,
        jobName,
        units: 'mm',
        size: { width: 210, height: 297 },
        colorType: 'grayscale',
        duplex: dobleFaz ? 'long-edge' : 'one-sided',
        orientation: 'portrait',
        scaleContent: true,
        rasterize: false,
      },
      data: [
        {
          type: 'pixel',
          format: 'pdf',
          flavor: 'base64',
          data: pdfPruebaA4().toString('base64'),
        },
      ],
    };
    return { ...this.firmar('print', params), params, totalPaginas: 2 };
  }

  private async paginas(auth: CurrentAuth, id: string, pagina?: number) {
    const orden = await this.prisma.ordenTrabajo.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: {
        numero: true,
        estado: true,
        fechaEntrega: true,
        tenant: { select: { nombre: true } },
        cliente: { select: { nombre: true } },
        items: {
          where: { parentItemId: null },
          orderBy: { ordenIndice: 'asc' },
          select: { nombre: true, cantidad: true, cantidadUnidad: true },
        },
      },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada.');
    if (['borrador', 'cancelada'].includes(orden.estado))
      throw new BadRequestException(
        'Sólo se imprimen etiquetas de órdenes emitidas.',
      );
    const totalPaginas = Math.max(1, Math.ceil(orden.items.length / 5));
    if (pagina !== undefined && pagina >= totalPaginas)
      throw new BadRequestException('Página de etiqueta inválida.');
    const logo = await this.archivos
      .logoDataUri(auth.tenantId)
      .catch(() => null);
    const paginas = await renderizarEtiquetas(
      {
        numero: orden.numero,
        empresa: orden.tenant.nombre,
        cliente: orden.cliente?.nombre ?? 'Consumidor final',
        fechaEntrega: orden.fechaEntrega,
        logo,
        productos: orden.items.map((p) => ({
          nombre: p.nombre,
          cantidad: Number(p.cantidad),
          unidad: p.cantidadUnidad,
        })),
      },
      pagina,
    );
    return { numero: orden.numero, paginas, totalPaginas };
  }

  async vistaPrevia(auth: CurrentAuth, id: string) {
    const { numero, paginas } = await this.paginas(auth, id);
    return {
      numero,
      anchoMm: 100,
      altoMm: 150,
      paginas: paginas.map(
        (png) => `data:image/png;base64,${png.toString('base64')}`,
      ),
    };
  }

  async preparar(
    auth: CurrentAuth,
    id: string,
    impresora: string,
    copias: number,
    pagina: number,
  ) {
    this.claves();
    const { numero, paginas, totalPaginas } = await this.paginas(
      auth,
      id,
      pagina,
    );
    const raw = await etiquetaTspl(paginas[0], copias);
    const params = {
      printer: { name: impresora },
      options: {
        copies: 1,
        jobName: `Grafo ${numero} (${pagina + 1}/${totalPaginas})`,
      },
      data: [
        {
          type: 'raw',
          format: 'command',
          flavor: 'base64',
          data: raw.toString('base64'),
        },
      ],
    };
    return { ...this.firmar('print', params), params, totalPaginas };
  }
}
