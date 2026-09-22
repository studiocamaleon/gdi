import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { PresupuestoPdfDatos } from '../presupuestos/presupuesto-pdf.service';
import { VERSION_PRESUPUESTO_HTML } from '../presupuestos/pdf-piloto/presupuesto-html';

export const MAX_INTENTOS_PDF = 3;
export const REVISION_BORRADOR = 1;
export const REVISION_EMITIDA = 2;

export function pdfAsincronoHabilitado() {
  return process.env.PRESUPUESTO_PDF_ASYNC === 'true';
}

export function hashDatosPdf(datos: PresupuestoPdfDatos): string {
  // JSONB reordena claves: la huella debe ser independiente del orden de objetos.
  function canonico(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canonico);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v)
          .filter(([, x]) => x !== undefined)
          .sort(([a], [b]) => a.localeCompare(b, 'en'))
          .map(([k, x]) => [k, canonico(x)]),
      );
    return v;
  }
  return createHash('sha256')
    .update(JSON.stringify(canonico(datos)))
    .digest('hex');
}

/** La fila es simultáneamente snapshot inmutable y bandeja durable de salida. */
@Injectable()
export class DocumentosPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
  ) {}

  preparar(
    tenantId: string,
    cotizacionId: string,
    revision: number,
    datos: PresupuestoPdfDatos,
  ) {
    const json = JSON.stringify(datos);
    if (datos.items.length > 500 || Buffer.byteLength(json) > 4 * 1024 * 1024)
      throw new BadRequestException(
        'El presupuesto supera el límite de tamaño para generar el PDF.',
      );
    const datosJson = JSON.parse(json) as Prisma.InputJsonValue;
    return {
      tenantId,
      cotizacionId,
      revision,
      plantillaVersion: VERSION_PRESUPUESTO_HTML,
      datosHash: hashDatosPdf(datosJson as unknown as PresupuestoPdfDatos),
      datosJson,
    };
  }

  async registrar(
    tx: Prisma.TransactionClient,
    entrada: ReturnType<DocumentosPdfService['preparar']>,
  ) {
    await this.capacidades.exigir(entrada.tenantId, 'documentos_pdf', tx);
    // Nunca sobrescribe datos al reenviar o ante una carrera. El trigger de BD
    // también impide modificar una entrada que ya se congeló.
    // INSERT ON CONFLICT DO NOTHING: upsert con update vacío puede convertirse
    // en SELECT + INSERT en Prisma y fallar ante dos primeras descargas a la vez.
    await tx.documentoPdf.createMany({ data: [entrada], skipDuplicates: true });
    return tx.documentoPdf.findFirstOrThrow({
      where: {
        tenantId: entrada.tenantId,
        cotizacionId: entrada.cotizacionId,
        revision: entrada.revision,
      },
    });
  }

  buscar(tenantId: string, cotizacionId: string, revision: number) {
    return this.prisma.documentoPdf.findFirst({
      where: { tenantId, cotizacionId, revision },
      include: { archivo: true },
    });
  }

  async reintentar(tenantId: string, cotizacionId: string, revision: number) {
    const doc = await this.buscar(tenantId, cotizacionId, revision);
    if (!doc) throw new NotFoundException('No se encontró el documento.');
    if (doc.estado !== 'FALLIDO') return doc;
    await this.capacidades.exigir(tenantId, 'documentos_pdf');
    await this.prisma.documentoPdf.updateMany({
      where: { id: doc.id, tenantId, estado: 'FALLIDO', ronda: doc.ronda },
      data: {
        estado: 'PENDIENTE',
        intentos: 0,
        ronda: { increment: 1 },
        proximoIntentoEl: new Date(),
        encoladoEl: null,
        errorCodigo: null,
        errorMensaje: null,
        leaseToken: null,
        leaseHasta: null,
      },
    });
    return this.buscar(tenantId, cotizacionId, revision);
  }
}
