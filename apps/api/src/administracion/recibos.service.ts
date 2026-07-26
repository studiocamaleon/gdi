import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Archivo,
  ArchivoScope,
  Prisma,
  TipoEnlacePublico,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArchivosService } from '../archivos/archivos.service';
import {
  EnlacesPublicosService,
  generarTokenPublico,
} from '../enlaces-publicos/enlaces-publicos.service';
import { urlEnlacePublico } from '../enlaces-publicos/enlaces-publicos.urls';
import { importeEnLetras } from './numero-en-letras';
import { ReciboPdfService, type ReciboDoc } from './recibo-pdf.service';
import { DatosEmpresaService } from '../tenants/datos-empresa.service';

/**
 * Recibos de pago — el documento del cobro.
 *
 * El recibo es 1:1 con el `Cobro`, así que no tiene entidad propia: número,
 * link público y PDF cuelgan del cobro. Acá vive todo lo que lo arma.
 * Ver docs/recibos-pago-diseno.md
 */
@Injectable()
export class RecibosService {
  private readonly logger = new Logger(RecibosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly archivos: ArchivosService,
    private readonly enlaces: EnlacesPublicosService,
    private readonly pdf: ReciboPdfService,
    private readonly empresa: DatosEmpresaService,
  ) {}

  /**
   * Número atómico REC-AAAA-NNNN. Se llama DENTRO de la transacción del cobro:
   * un cobro registrado sin número de recibo sería un cobro sin comprobante.
   */
  async numerar(
    tx: Prisma.TransactionClient,
    tenantId: string,
    fecha: Date,
  ): Promise<string> {
    const anio = fecha.getFullYear();
    const contador = await tx.reciboContador.upsert({
      where: { tenantId_anio: { tenantId, anio } },
      create: { tenantId, anio, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    });
    return `REC-${anio}-${String(contador.ultimo).padStart(4, '0')}`;
  }

  /** Emite el link público del recibo, en la misma transacción que el cobro. */
  async emitirEnlace(
    tx: Prisma.TransactionClient,
    tenantId: string,
    cobroId: string,
  ): Promise<string> {
    return this.enlaces.emitir(tx, {
      tenantId,
      tipo: TipoEnlacePublico.COBRO,
      entidadId: cobroId,
      token: generarTokenPublico(),
    });
  }

  /** La URL que se le manda al cliente por WhatsApp. */
  async urlPublica(cobroId: string): Promise<string | null> {
    const enlace = await this.prisma.enlacePublico.findUnique({
      where: {
        tipo_entidadId: { tipo: TipoEnlacePublico.COBRO, entidadId: cobroId },
      },
      select: { token: true },
    });
    if (!enlace) return null;
    return urlEnlacePublico(TipoEnlacePublico.COBRO, enlace.token);
  }

  // ── Proyección del documento ─────────────────────────────────────────

  /**
   * Arma el recibo desde el cobro. `porToken` decide si se exige tenant: por
   * el link público no hay sesión, y el token ya es la credencial.
   */
  async documento(cobroId: string, tenantId?: string): Promise<ReciboDoc> {
    const cobro = await this.prisma.cobro.findFirst({
      where: {
        id: cobroId,
        ...(tenantId ? { tenantId } : {}),
        anuladoEl: null,
      },
      include: {
        cliente: { select: { nombre: true, razonSocial: true } },
        metodoPago: { select: { nombre: true } },
        cuentaDestino: {
          select: { nombre: true, banco: true, cbuAlias: true },
        },
        tenant: { select: { nombre: true } },
        orden: {
          select: {
            numero: true,
            total: true,
            cobradoTotal: true,
            cotizacion: { select: { numero: true } },
            items: {
              orderBy: { ordenIndice: 'asc' },
              take: 1,
              select: { nombre: true },
            },
          },
        },
      },
    });
    if (!cobro || !cobro.numeroRecibo) {
      throw new NotFoundException('No se encontró el recibo.');
    }

    const monto = Number(cobro.montoBruto);
    const negocio = cobro.tenant.nombre;

    let orden: ReciboDoc['orden'] = null;
    if (cobro.orden) {
      const total = Number(cobro.orden.total ?? 0);
      // `cobradoTotal` ya incluye ESTE cobro (se recalcula en la misma
      // transacción del registro), así que los anteriores son la resta.
      const cobrado = Number(cobro.orden.cobradoTotal ?? 0);
      const anteriores = Math.max(0, Math.round((cobrado - monto) * 100) / 100);
      const saldo = Math.max(0, Math.round((total - cobrado) * 100) / 100);
      orden = {
        numero: cobro.orden.numero,
        detalle: cobro.orden.items[0]?.nombre ?? null,
        subtitulo: cobro.orden.cotizacion?.numero
          ? `Según presupuesto ${cobro.orden.cotizacion.numero}`
          : null,
        total,
        pagosAnteriores: anteriores,
        saldoPendiente: saldo,
        pctAbonado: total > 0 ? Math.min(100, (cobrado / total) * 100) : 100,
      };
    }

    const cuenta = cobro.cuentaDestino;
    const cuentaTexto = [
      cuenta?.banco ?? cuenta?.nombre,
      this.enmascarar(cuenta?.cbuAlias),
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      numero: cobro.numeroRecibo,
      negocio,
      empresa: await this.empresa.paraDocumentos(cobro.tenantId),
      iniciales: this.iniciales(negocio),
      logoDataUri: await this.archivos.logoDataUri(cobro.tenantId),
      clienteNombre:
        cobro.cliente?.razonSocial ?? cobro.cliente?.nombre ?? null,
      fecha: cobro.fecha.toISOString().slice(0, 10),
      registradoPor: cobro.registradoPorNombre,
      referencia: cobro.referencia,
      monto,
      montoEnLetras: importeEnLetras(monto, cobro.moneda),
      metodoNombre: cobro.metodoPago.nombre,
      cuentaTexto: cuentaTexto || null,
      orden,
    };
  }

  // ── PDF ──────────────────────────────────────────────────────────────

  /** El PDF guardado; si todavía no existe, lo genera y lo guarda. */
  async pdfDe(cobroId: string, tenantId?: string): Promise<Archivo> {
    const existente = await this.archivos.generadoDe(
      ArchivoScope.COBRO,
      cobroId,
    );
    if (existente) return existente;
    return this.materializarPdf(cobroId, tenantId);
  }

  /** Rehace el PDF y reemplaza el anterior. */
  async materializarPdf(cobroId: string, tenantId?: string): Promise<Archivo> {
    const doc = await this.documento(cobroId, tenantId);
    const cobro = await this.prisma.cobro.findFirst({
      where: { id: cobroId },
      select: { tenantId: true },
    });
    if (!cobro) throw new NotFoundException('No se encontró el cobro.');

    return this.archivos.materializar({
      tenantId: cobro.tenantId,
      scope: ArchivoScope.COBRO,
      entidadId: cobroId,
      nombre: `${doc.numero}.pdf`,
      mimeType: 'application/pdf',
      contenido: this.pdf.generar(doc),
    });
  }

  /**
   * Genera el PDF sin dejar caer el registro del cobro si falla. Se llama
   * post-commit: el recibo ya tiene número y link, y el PDF se puede rehacer
   * después desde el endpoint — pero cobrar no puede fallar por un PDF.
   */
  materializarPdfEnSegundoPlano(cobroId: string): void {
    void this.materializarPdf(cobroId).catch((error: unknown) => {
      this.logger.warn(
        `No pude materializar el PDF del recibo de ${cobroId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  // ── helpers ──────────────────────────────────────────────────────────

  /** "Grafica Corporearte" → "GC". El fallback del logo. */
  private iniciales(nombre: string): string {
    const palabras = nombre.trim().split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return '?';
    if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }

  /** Un CBU entero en un documento que se comparte no aporta nada bueno. */
  private enmascarar(cbuAlias: string | null | undefined): string | null {
    if (!cbuAlias) return null;
    const limpio = cbuAlias.trim();
    if (!/^\d{6,}$/.test(limpio)) return limpio; // es un alias, no un CBU
    return `CBU ***${limpio.slice(-4)}`;
  }
}
