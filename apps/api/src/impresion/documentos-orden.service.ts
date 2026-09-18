import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import { resolverRangoPaginas } from '../common/rangos-paginas';
import {
  orientacionPaginaPdf,
  resumirOrientaciones,
  type OrientacionPagina,
} from '../common/orientacion-pdf';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ArchivosService } from '../archivos/archivos.service';
import { ImpresionService } from './impresion.service';
import {
  objeto,
  planDocumento,
  siguienteEstado,
  type EstadoImpresion,
} from './documentos-orden.domain';

const TIPO = 'impresion_documento';
const MAX_BYTES = 25 * 1024 * 1024;

@Injectable()
export class DocumentosOrdenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly archivos: ArchivosService,
    private readonly impresion: ImpresionService,
  ) {}

  private async orden(
    auth: CurrentAuth,
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const orden = await db.ordenTrabajo.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: {
        id: true,
        numero: true,
        estado: true,
        updatedAt: true,
        items: {
          where: { parentItemId: null },
          orderBy: { ordenIndice: 'asc' },
          select: {
            id: true,
            nombre: true,
            contieneLotesEntrega: true,
            jobContextSnapshotJson: true,
            cotizacionItem: { select: { jobContextJson: true } },
            archivos: {
              where: {
                tenantId: auth.tenantId,
                estado: 'LISTO',
                eliminadoEl: null,
                autogeneradoPor: 'centro-copiado',
              },
              select: {
                id: true,
                nombreOriginal: true,
                mimeType: true,
                bytes: true,
                key: true,
              },
            },
          },
        },
      },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada.');
    return orden;
  }

  private documentos(
    orden: Awaited<ReturnType<DocumentosOrdenService['orden']>>,
  ) {
    return orden.items.flatMap((item) => {
      const plan = planDocumento(
        item.jobContextSnapshotJson ?? item.cotizacionItem?.jobContextJson,
      );
      if (!plan) return [];
      let motivo = plan.motivo;
      const archivos = plan.segmentos.map((s) => {
        const coincidencias = item.archivos.filter(
          (a) => a.nombreOriginal === s.nombre,
        );
        // Un documento suelto puede tener un nombre comercial distinto al PDF.
        return coincidencias.length === 1
          ? coincidencias[0]
          : plan.segmentos.length === 1 && item.archivos.length === 1
            ? item.archivos[0]
            : null;
      });
      if (
        !motivo &&
        (archivos.some((a) => !a || a.mimeType !== 'application/pdf') ||
          new Set(archivos.map((a) => a?.id)).size !== archivos.length)
      )
        motivo =
          'Falta un PDF confirmado o no se puede identificar cada original. Revisá los archivos del centro de copiado.';
      if (
        !motivo &&
        archivos.reduce((sum, a) => sum + Number(a?.bytes ?? 0), 0) > MAX_BYTES
      )
        motivo =
          'La impresión directa admite hasta 25 MB por documento o tomo.';
      if (!motivo && item.contieneLotesEntrega)
        motivo =
          'Este producto está distribuido en entregas; requiere impresión manual por lote.';
      return [{ ...plan, itemId: item.id, motivo, archivos }];
    });
  }

  async vista(auth: CurrentAuth, id: string) {
    const orden = await this.orden(auth, id);
    const historial = await this.prisma.ordenTrabajoEvento.findMany({
      where: { tenantId: auth.tenantId, ordenId: id, tipo: TIPO },
      orderBy: { fecha: 'desc' },
      take: 100,
      select: { id: true, fecha: true, usuarioNombre: true, datosJson: true },
    });
    const documentos = this.documentos(orden);
    // Aunque el historial sea largo, ningún documento ya enviado debe aparecer
    // como nuevo por haber quedado fuera de la ventana de los últimos 100.
    if (historial.length === 100) {
      const faltantes = documentos.filter(
        (d) => !historial.some((e) => objeto(e.datosJson).itemId === d.itemId),
      );
      const ultimos = await Promise.all(
        faltantes.map((d) =>
          this.prisma.ordenTrabajoEvento.findFirst({
            where: {
              tenantId: auth.tenantId,
              ordenId: id,
              tipo: TIPO,
              datosJson: { path: ['itemId'], equals: d.itemId },
            },
            orderBy: { fecha: 'desc' },
            select: {
              id: true,
              fecha: true,
              usuarioNombre: true,
              datosJson: true,
            },
          }),
        ),
      );
      for (const ultimo of ultimos) if (ultimo) historial.push(ultimo);
    }
    return {
      ordenId: id,
      numero: orden.numero,
      estado: orden.estado,
      documentos: documentos.map(({ archivos, segmentos, ...doc }) => ({
        ...doc,
        archivos: archivos.filter((a) => a !== null).map((a) => a.id),
        documentos: segmentos.length,
        seleccionPaginas: segmentos
          .filter((s) => s.rangoPaginas)
          .map((s) => ({
            nombre: s.nombre,
            rango: s.rangoPaginas!,
            paginasOriginales: s.paginasOriginales!,
          })),
      })),
      historial: historial.map((e) => ({
        ...objeto(e.datosJson),
        id: e.id,
        fecha: e.fecha.toISOString(),
        usuario: e.usuarioNombre,
      })),
    };
  }

  async preparar(
    auth: CurrentAuth,
    ordenId: string,
    itemId: string,
    intentoId: string,
    impresora: string,
    host: string,
    reimpresionDe?: string,
  ) {
    const orden = await this.orden(auth, ordenId);
    if (['borrador', 'cancelada'].includes(orden.estado))
      throw new BadRequestException('Primero emití la orden.');
    const doc = this.documentos(orden).find((d) => d.itemId === itemId);
    if (!doc || doc.motivo)
      throw new BadRequestException(doc?.motivo ?? 'Documento no imprimible.');

    const unido = await PDFDocument.create();
    const extraerPaginas =
      doc.archivos.length > 1 || doc.segmentos.some((s) => !!s.rangoPaginas);
    let originalBytes: Buffer | null = null;
    const orientacionesPaginas: OrientacionPagina[] = [];
    for (const [i, archivo] of doc.archivos.entries()) {
      if (!archivo) throw new BadRequestException('Falta el archivo original.');
      const bytes = await this.archivos.leerContenido(archivo.key);
      if (!bytes || bytes.length !== Number(archivo.bytes))
        throw new BadRequestException('El PDF no está disponible.');
      if (doc.archivos.length === 1) originalBytes = bytes;
      let pdf: PDFDocument;
      try {
        pdf = await PDFDocument.load(bytes);
      } catch {
        throw new BadRequestException(
          'No se pudo leer el PDF. Revisá que sea válido y no tenga contraseña.',
        );
      }
      const segmento = doc.segmentos[i];
      if (
        pdf.getPageCount() !== (segmento.paginasOriginales ?? segmento.paginas)
      )
        throw new BadRequestException(
          `Las páginas de ${archivo.nombreOriginal} no coinciden con las cotizadas. Volvé a cotizar el documento.`,
        );
      const seleccion = resolverRangoPaginas(
        segmento.rangoPaginas ?? '',
        pdf.getPageCount(),
      );
      if (seleccion.error || seleccion.paginas !== segmento.paginas)
        throw new BadRequestException(
          'El rango no coincide con las páginas cotizadas. Volvé a cotizar el documento.',
        );
      const indices = seleccion.intervalos.flatMap(([desde, hasta]) =>
        Array.from({ length: hasta - desde + 1 }, (_, n) => desde - 1 + n),
      );
      // Se verifica el PDF real incluso en órdenes históricas sin orientación.
      const orientaciones = indices.map((indice) =>
        orientacionPaginaPdf(pdf.getPage(indice)),
      );
      orientacionesPaginas.push(...orientaciones);
      if (extraerPaginas) {
        const paginas = await unido.copyPages(pdf, indices);
        paginas.forEach((p) => unido.addPage(p));
        // Cada original empieza en un frente y cada juego mantiene su orden.
        if (doc.archivos.length > 1 && doc.faz === 2 && seleccion.paginas % 2)
          unido.addPage(
            orientaciones.at(-1) === 'horizontal'
              ? [841.89, 595.276]
              : [595.276, 841.89],
          );
      }
    }
    const contenido = extraerPaginas
      ? Buffer.from(await unido.save())
      : originalBytes;
    if (!contenido) throw new BadRequestException('El PDF no está disponible.');
    const jobName = `Grafo ${orden.numero} ${intentoId}`;
    const params = {
      printer: { name: impresora },
      options: {
        copies: doc.copias,
        jobName,
        units: 'mm',
        size: { width: 210, height: 297 },
        colorType: 'grayscale',
        duplex: doc.faz === 2 ? 'long-edge' : 'one-sided',
        // QZ orienta cada página según su CropBox y /Rotate. Un único envío
        // conserva el orden y los frentes/dorsos incluso en archivos mixtos.
        orientation: null,
        scaleContent: true,
        rasterize: false,
      },
      data: [
        {
          type: 'pixel',
          format: 'pdf',
          flavor: 'base64',
          data: contenido.toString('base64'),
        },
      ],
    };
    // Validar la firma antes de reservar; una configuración rota no crea un envío.
    const firma = this.impresion.firmarDocumento(params);
    const datos = {
      itemId,
      nombre: doc.nombre,
      copias: doc.copias,
      paginas: doc.paginas,
      hojas: doc.hojas,
      faz: doc.faz,
      orientacion: resumirOrientaciones(orientacionesPaginas),
      orientacionesPaginas,
      archivos: doc.archivos.map((a) => a!.id),
      seleccionPaginas: doc.segmentos
        .filter((s) => s.rangoPaginas)
        .map((s) => ({
          nombre: s.nombre,
          rango: s.rangoPaginas!,
          paginasOriginales: s.paginasOriginales!,
        })),
      host,
      impresora,
      jobName,
      estado: 'PREPARADO',
      actualizadoEl: new Date().toISOString(),
      reimpresionDe: reimpresionDe ?? null,
      eventos: [] as Array<{ estado: string; fecha: string; detalle: string }>,
    };
    await this.prisma.$transaction(async (tx) => {
      // Serializa envíos de una misma OT incluso desde dos pestañas/usuarios.
      await tx.$queryRaw`SELECT id FROM "OrdenTrabajo" WHERE id = ${ordenId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const actual = await tx.ordenTrabajo.findFirst({
        where: { id: ordenId, tenantId: auth.tenantId },
        select: { estado: true, updatedAt: true },
      });
      if (!actual || ['borrador', 'cancelada'].includes(actual.estado))
        throw new ConflictException(
          'La orden ya no está disponible para imprimir.',
        );
      if (actual.updatedAt.getTime() !== orden.updatedAt.getTime())
        throw new ConflictException(
          'La orden cambió mientras preparábamos el PDF. Actualizá el panel.',
        );
      const previo = await tx.ordenTrabajoEvento.findFirst({
        where: {
          ordenId,
          tenantId: auth.tenantId,
          tipo: TIPO,
          datosJson: { path: ['itemId'], equals: itemId },
        },
        orderBy: { fecha: 'desc' },
        select: { id: true },
      });
      const repetido = await tx.ordenTrabajoEvento.findFirst({
        where: { id: intentoId, tenantId: auth.tenantId },
        select: { id: true },
      });
      if (repetido || (previo?.id ?? null) !== (reimpresionDe ?? null))
        throw new ConflictException(
          'Este documento ya tiene un envío. Actualizá el panel y revisá la cola antes de reimprimir.',
        );
      await tx.ordenTrabajoEvento.create({
        data: {
          id: intentoId,
          tenantId: auth.tenantId,
          ordenId,
          tipo: TIPO,
          descripcion: `${reimpresionDe ? 'Reimpresión' : 'Impresión'} de ${doc.nombre} · ${doc.copias} copia(s) · ${impresora}`,
          usuarioId: auth.userId,
          usuarioNombre: auth.impersonacion?.actorNombre ?? auth.email,
          datosJson: datos as Prisma.InputJsonValue,
        },
      });
    });
    return {
      ...firma,
      params,
      totalPaginas: doc.paginas,
      intento: {
        ...datos,
        id: intentoId,
        fecha: new Date().toISOString(),
        usuario: auth.email,
      },
    };
  }

  async confirmar(auth: CurrentAuth, ordenId: string, envioIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      // Comparte el bloqueo con preparar: no confirma una versión anterior si
      // otra pestaña acaba de reimprimir o de modificar los documentos de la OT.
      await tx.$queryRaw`SELECT id FROM "OrdenTrabajo" WHERE id = ${ordenId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const orden = await this.orden(auth, ordenId, tx);
      if (['borrador', 'cancelada'].includes(orden.estado))
        throw new ConflictException(
          'La orden no está disponible para confirmar.',
        );
      const documentos = this.documentos(orden);
      const ultimos = await Promise.all(
        documentos.map((doc) =>
          tx.ordenTrabajoEvento.findFirst({
            where: {
              tenantId: auth.tenantId,
              ordenId,
              tipo: TIPO,
              datosJson: { path: ['itemId'], equals: doc.itemId },
            },
            orderBy: { fecha: 'desc' },
            select: { id: true },
          }),
        ),
      );
      if (!ultimos.length || ultimos.some((e) => !e))
        throw new ConflictException(
          'Hay documentos sin enviar. Completá los envíos antes de confirmar todo.',
        );
      const ids = ultimos.map((e) => e!.id);
      if (
        ids.length !== envioIds.length ||
        ids.some((id) => !envioIds.includes(id))
      )
        throw new ConflictException(
          'Los envíos cambiaron. Actualizá el panel y revisá la impresión antes de confirmar.',
        );
      const confirmacion = {
        fecha: new Date().toISOString(),
        usuario: auth.impersonacion?.actorNombre ?? auth.email,
        usuarioId: auth.userId,
      };
      let nuevos = 0;
      for (const id of ids.sort()) {
        // Los eventos de Windows usan el mismo bloqueo: conservamos su estado
        // y guardamos la verificación humana por separado, sin perder mensajes.
        await tx.$queryRaw`SELECT id FROM "OrdenTrabajoEvento" WHERE id = ${id}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
        const envio = await tx.ordenTrabajoEvento.findFirst({
          where: { id, ordenId, tenantId: auth.tenantId, tipo: TIPO },
        });
        if (!envio) throw new NotFoundException('Envío no encontrado.');
        const datos = objeto(envio.datosJson);
        if (datos.confirmacion) continue;
        await tx.ordenTrabajoEvento.update({
          where: { id, tenantId: auth.tenantId },
          data: {
            datosJson: { ...datos, confirmacion } as Prisma.InputJsonValue,
          },
        });
        nuevos++;
      }
      if (nuevos)
        await tx.ordenTrabajoEvento.create({
          data: {
            tenantId: auth.tenantId,
            ordenId,
            tipo: 'impresion_confirmada',
            descripcion: `Impresión de documentos verificada: ${ids.length} documento(s) impresos correctamente.`,
            usuarioId: auth.userId,
            usuarioNombre: confirmacion.usuario,
            datosJson: { envioIds: ids, ...confirmacion },
          },
        });
      return { ok: true };
    });
  }

  async estado(
    auth: CurrentAuth,
    ordenId: string,
    intentoId: string,
    estado: EstadoImpresion,
    detalle: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "OrdenTrabajoEvento" WHERE id = ${intentoId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const evento = await tx.ordenTrabajoEvento.findFirst({
        where: {
          id: intentoId,
          ordenId,
          tenantId: auth.tenantId,
          tipo: TIPO,
          usuarioId: auth.userId,
        },
      });
      if (!evento)
        throw new NotFoundException('Envío no encontrado para esta sesión.');
      const datos = objeto(evento.datosJson);
      const actualizadoEl = new Date().toISOString();
      const eventos: unknown[] = Array.isArray(datos.eventos)
        ? datos.eventos.slice(-39)
        : [];
      datos.estado = siguienteEstado(datos.estado as EstadoImpresion, estado);
      datos.actualizadoEl = actualizadoEl;
      datos.eventos = [...eventos, { estado, detalle, fecha: actualizadoEl }];
      await tx.ordenTrabajoEvento.update({
        where: { id: intentoId, tenantId: auth.tenantId },
        data: { datosJson: datos as Prisma.InputJsonValue },
      });
      return {
        ...datos,
        id: intentoId,
        fecha: evento.fecha.toISOString(),
        usuario: evento.usuarioNombre,
      };
    });
  }
}
