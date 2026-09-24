import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  ArchivoScope,
  TipoEnlacePublico,
  type CorreoPresupuesto,
} from '@prisma/client';
import { isEmail } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { ArchivosService } from '../archivos/archivos.service';
import { REVISION_EMITIDA } from '../documentos-pdf/documentos-pdf.service';
import { urlEnlacePublico } from '../enlaces-publicos/enlaces-publicos.urls';
import { runWithTenant } from '../common/tenant-context';
import { PresupuestosService } from './presupuestos.service';
import { CorreoPresupuestoTransporte } from './correo-presupuesto.transporte';
import {
  ASUNTO_PRESUPUESTO,
  MENSAJE_PRESUPUESTO,
  completarPlantilla,
  crearCorreoPresupuesto,
} from './correo-presupuesto.plantilla';
import { EnviarCorreoPresupuestoDto } from './dto/presupuestos.dto';
import {
  adjuntosMarcaCorreo,
  MARCA_CORREO_CID,
} from '../registro/plantillas/correo-base';

const MAX_PDF = 20 * 1024 * 1024;
const VENTANA_REINTENTO = 23 * 60 * 60 * 1000;
class ErrorPreparacionCorreo extends Error {}

@Injectable()
export class CorreoPresupuestoService {
  private readonly logger = new Logger(CorreoPresupuestoService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly presupuestos: PresupuestosService,
    private readonly archivos: ArchivosService,
    private readonly capacidades: CapacidadesEmpresaService,
    private readonly transporte: CorreoPresupuestoTransporte,
  ) {}

  private async exigirAcceso(auth: CurrentAuth, id: string) {
    const presupuesto = await this.prisma.cotizacion.findFirst({
      where: { id, tenantId: auth.tenantId, numero: { not: null } },
      include: {
        cliente: {
          select: {
            nombre: true,
            emailPrincipal: true,
            contactos: { select: { id: true, nombre: true, email: true } },
          },
        },
      },
    });
    if (!presupuesto) throw new NotFoundException('El presupuesto no existe.');
    return presupuesto;
  }

  private async exigirCapacidades(tenantId: string) {
    await this.capacidades.exigir(tenantId, 'presupuestos');
    await this.capacidades.exigir(tenantId, 'documentos_pdf');
    await this.capacidades.exigir(tenantId, 'aprobacion_presupuestos');
  }

  async preparar(auth: CurrentAuth, id: string) {
    const p = await this.exigirAcceso(auth, id);
    await this.exigirCapacidades(auth.tenantId);
    const [cfg, empresa, tenant] = await Promise.all([
      this.prisma.configuracionPresupuestos.findUnique({
        where: { tenantId: auth.tenantId },
      }),
      this.prisma.datosEmpresa.findUnique({
        where: { tenantId: auth.tenantId },
        select: { email: true },
      }),
      this.prisma.tenant.findUniqueOrThrow({
        where: { id: auth.tenantId },
        select: { nombre: true },
      }),
    ]);
    const valores = {
      empresa: tenant.nombre,
      presupuesto: p.numero!,
      cliente: p.cliente?.nombre ?? 'cliente',
    };
    return {
      empresa: tenant.nombre,
      numero: p.numero!,
      para: p.cliente?.emailPrincipal ?? '',
      contactos: p.cliente?.contactos.filter((c) => c.email) ?? [],
      responderA: cfg?.correoResponderA ?? empresa?.email ?? '',
      remitente: this.transporte.remitente(tenant.nombre),
      asunto: completarPlantilla(
        cfg?.correoAsunto ?? ASUNTO_PRESUPUESTO,
        valores,
      ).slice(0, 200),
      mensaje: completarPlantilla(
        cfg?.correoMensaje ?? MENSAJE_PRESUPUESTO,
        valores,
      ),
      disponible: this.transporte.disponible,
    };
  }

  async vistaPrevia(
    auth: CurrentAuth,
    id: string,
    dto: EnviarCorreoPresupuestoDto,
  ) {
    const datos = await this.preparar(auth, id);
    const html = crearCorreoPresupuesto({ ...datos, ...dto, url: '#' }).html;
    return {
      html: html.replace(
        `cid:${MARCA_CORREO_CID}`,
        `data:image/png;base64,${adjuntosMarcaCorreo()[0].content.toString('base64')}`,
      ),
    };
  }

  async historial(auth: CurrentAuth, id: string) {
    await this.exigirAcceso(auth, id);
    const filas = await this.prisma.correoPresupuesto.findMany({
      where: { tenantId: auth.tenantId, cotizacionId: id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return filas.map((f) => this.proyectar(f));
  }

  private proyectar(f: CorreoPresupuesto) {
    return {
      id: f.id,
      estado: f.estado,
      para: f.para,
      responderA: f.responderA,
      asunto: f.asunto,
      mensaje: f.mensaje,
      createdAt: f.createdAt,
      enviadoEl: f.enviadoEl,
      error: f.error,
      puedeReintentar:
        f.estado === 'FALLIDO' &&
        (!f.primerIntentoEl ||
          Date.now() - f.primerIntentoEl.getTime() < VENTANA_REINTENTO),
    };
  }

  async encolar(
    auth: CurrentAuth,
    id: string,
    dto: EnviarCorreoPresupuestoDto,
  ) {
    await this.exigirAcceso(auth, id);
    await this.exigirCapacidades(auth.tenantId);
    const entrada = {
      para: dto.para.trim(),
      asunto: dto.asunto.trim(),
      mensaje: dto.mensaje.trim(),
    };
    if (!isEmail(entrada.para) || !entrada.asunto || !entrada.mensaje)
      throw new BadRequestException('Completá destinatario, asunto y mensaje.');
    const anterior = await this.prisma.correoPresupuesto.findUnique({
      where: {
        tenantId_idempotencia: {
          tenantId: auth.tenantId,
          idempotencia: dto.idempotencia,
        },
      },
    });
    if (anterior) {
      if (
        anterior.cotizacionId !== id ||
        anterior.para !== entrada.para ||
        anterior.asunto !== entrada.asunto ||
        anterior.mensaje !== entrada.mensaje
      )
        throw new ConflictException(
          'La clave corresponde a otro envío. Abrí un nuevo mensaje.',
        );
      return this.proyectar(anterior);
    }
    const datos = await this.preparar(auth, id);
    if (!datos.disponible)
      throw new ServiceUnavailableException(
        'El servicio de correo no está configurado.',
      );
    if (!isEmail(datos.responderA))
      throw new BadRequestException(
        'Configurá el correo comercial de la empresa para recibir las respuestas.',
      );
    let p = await this.exigirAcceso(auth, id);
    if (p.estado === 'borrador') {
      const resultado = await this.presupuestos.enviar(auth, id, {
        notificarWhatsapp: false,
      });
      if (resultado.estado === 'pendiente_aprobacion')
        throw new BadRequestException(
          'El presupuesto necesita aprobación interna antes de enviar el correo.',
        );
      p = await this.exigirAcceso(auth, id);
    }
    if (
      p.estado !== 'enviado' ||
      !p.publicToken ||
      (p.fechaValidez && p.fechaValidez < new Date())
    )
      throw new BadRequestException(
        'Sólo podés enviar presupuestos emitidos, vigentes y pendientes de respuesta.',
      );
    const estadoPdf = await this.presupuestos.estadoPdf(auth, id);
    if (estadoPdf.estado === 'fallido')
      throw new BadRequestException(
        'No se pudo generar el PDF. Reintentá su generación antes de enviar.',
      );
    const documento = await this.prisma.documentoPdf.findFirst({
      where: {
        tenantId: auth.tenantId,
        cotizacionId: id,
        revision: REVISION_EMITIDA,
      },
      include: { archivo: true },
    });
    const archivo = documento
      ? documento.archivo
      : await this.prisma.archivo.findFirst({
          where: {
            tenantId: auth.tenantId,
            cotizacionId: id,
            scope: ArchivoScope.COTIZACION,
            generado: true,
            estado: 'LISTO',
            documentoPdfId: null,
          },
          orderBy: { createdAt: 'desc' },
        });
    if (!documento && !archivo)
      throw new BadRequestException(
        'El PDF emitido todavía no está disponible.',
      );
    const usuario = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      select: { nombreCompleto: true },
    });
    const publicToken = p.publicToken;
    // createMany + índice único cubren también dos peticiones concurrentes.
    await this.prisma.$transaction(async (tx) => {
      const creado = await tx.correoPresupuesto.createMany({
        data: [
          {
            tenantId: auth.tenantId,
            cotizacionId: id,
            idempotencia: dto.idempotencia,
            ...entrada,
            empresa: datos.empresa,
            numero: datos.numero,
            responderA: datos.responderA,
            remitente: datos.remitente,
            url: urlEnlacePublico(TipoEnlacePublico.PRESUPUESTO, publicToken),
            archivoId: archivo?.id,
            documentoPdfId: documento?.id,
            usuarioId: auth.userId,
            usuarioNombre: usuario?.nombreCompleto ?? auth.email,
          },
        ],
        skipDuplicates: true,
      });
      if (creado.count) {
        const actualizado = await tx.cotizacion.updateMany({
          where: {
            id,
            tenantId: auth.tenantId,
            estado: 'enviado',
            publicToken,
            OR: [{ fechaValidez: null }, { fechaValidez: { gte: new Date() } }],
          },
          data: { notificarWhatsapp: false },
        });
        if (!actualizado.count)
          throw new ConflictException(
            'El presupuesto cambió. Actualizá la ficha antes de enviar.',
          );
      }
    });
    const guardado = await this.prisma.correoPresupuesto.findUniqueOrThrow({
      where: {
        tenantId_idempotencia: {
          tenantId: auth.tenantId,
          idempotencia: dto.idempotencia,
        },
      },
    });
    if (
      guardado.cotizacionId !== id ||
      guardado.para !== entrada.para ||
      guardado.asunto !== entrada.asunto ||
      guardado.mensaje !== entrada.mensaje
    )
      throw new ConflictException('La clave corresponde a otro envío.');
    return this.proyectar(guardado);
  }

  async reintentar(auth: CurrentAuth, id: string, correoId: string) {
    await this.exigirAcceso(auth, id);
    await this.exigirCapacidades(auth.tenantId);
    const correo = await this.prisma.correoPresupuesto.findFirst({
      where: { id: correoId, tenantId: auth.tenantId, cotizacionId: id },
    });
    if (!correo) throw new NotFoundException('Envío no encontrado.');
    if (!this.proyectar(correo).puedeReintentar)
      throw new BadRequestException(
        'Este envío no admite un reintento seguro. Revisá su estado con el equipo de Grafo.',
      );
    if (correo.documentoPdfId) await this.presupuestos.reintentarPdf(auth, id);
    await this.prisma.correoPresupuesto.updateMany({
      where: { id: correoId, tenantId: auth.tenantId, estado: 'FALLIDO' },
      data: { estado: 'PENDIENTE', error: null, proximoIntentoEl: new Date() },
    });
    return { ok: true };
  }

  @Cron('*/10 * * * * *', { name: 'presupuestos-correo' })
  async despacharPendientes() {
    if (!this.transporte.disponible) return;
    try {
      const ahora = new Date();
      const pendientes = await this.prisma.correoPresupuesto.findMany({
        where: {
          OR: [
            { estado: 'PENDIENTE', proximoIntentoEl: { lte: ahora } },
            { estado: 'ENVIANDO', leaseHasta: { lt: ahora } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });
      // Cada fila se reclama atómicamente, incluso con varias instancias de API.
      for (const pendiente of pendientes)
        await runWithTenant(pendiente.tenantId, () => this.procesar(pendiente));
    } catch (error) {
      this.logger.error(
        'No se pudo procesar la cola de correos de presupuestos.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async procesar(correo: CorreoPresupuesto) {
    const ahora = new Date();
    if (!['PENDIENTE', 'ENVIANDO'].includes(correo.estado)) return;
    if (
      correo.estado === 'ENVIANDO' &&
      correo.leaseHasta &&
      correo.leaseHasta >= ahora
    )
      return;
    const leaseHasta = new Date(Date.now() + 5 * 60 * 1000);
    const claim = await this.prisma.correoPresupuesto.updateMany({
      where: {
        id: correo.id,
        tenantId: correo.tenantId,
        estado: correo.estado,
        updatedAt: correo.updatedAt,
      },
      data: { estado: 'ENVIANDO', leaseHasta },
    });
    if (!claim.count) return;
    // El lease actúa también como token: una ejecución vieja no pisa a otra.
    const where = {
      id: correo.id,
      tenantId: correo.tenantId,
      estado: 'ENVIANDO',
      leaseHasta,
    };
    try {
      if (
        correo.primerIntentoEl &&
        Date.now() - correo.primerIntentoEl.getTime() >= VENTANA_REINTENTO
      )
        throw new ErrorPreparacionCorreo(
          'No se confirmó el resultado dentro del plazo de reintento seguro. Contactá al equipo de Grafo antes de reenviar.',
        );
      const p = await this.prisma.cotizacion.findFirst({
        where: { id: correo.cotizacionId, tenantId: correo.tenantId },
      });
      if (
        !p ||
        p.estado !== 'enviado' ||
        (p.fechaValidez && p.fechaValidez < ahora)
      )
        throw new ErrorPreparacionCorreo(
          'El presupuesto ya fue resuelto o venció. No se envió un nuevo correo.',
        );
      await this.exigirCapacidades(correo.tenantId);
      let archivoId = correo.archivoId;
      if (!archivoId && correo.documentoPdfId) {
        const doc = await this.prisma.documentoPdf.findFirst({
          where: {
            id: correo.documentoPdfId,
            tenantId: correo.tenantId,
            cotizacionId: correo.cotizacionId,
            revision: REVISION_EMITIDA,
          },
          include: { archivo: true },
        });
        if (!doc || doc.estado === 'FALLIDO')
          throw new ErrorPreparacionCorreo(
            'No se pudo generar el PDF. Reintentá el envío para volver a prepararlo.',
          );
        if (doc.estado !== 'LISTO' || !doc.archivo) {
          await this.prisma.correoPresupuesto.updateMany({
            where,
            data: {
              estado: 'PENDIENTE',
              leaseHasta: null,
              proximoIntentoEl: new Date(Date.now() + 10_000),
            },
          });
          return;
        }
        archivoId = doc.archivo.id;
      }
      if (!archivoId)
        throw new ErrorPreparacionCorreo(
          'No hay un PDF emitido para adjuntar.',
        );
      const archivo = await this.prisma.archivo.findFirst({
        where: {
          id: archivoId,
          tenantId: correo.tenantId,
          cotizacionId: correo.cotizacionId,
          scope: ArchivoScope.COTIZACION,
          generado: true,
          estado: 'LISTO',
        },
      });
      if (
        !archivo ||
        archivo.mimeType !== 'application/pdf' ||
        archivo.bytes > BigInt(MAX_PDF)
      )
        throw new ErrorPreparacionCorreo(
          'El PDF no está disponible o supera los 20 MB permitidos por correo.',
        );
      const pdf = await this.archivos.leerContenido(archivo.key);
      if (
        !pdf?.length ||
        pdf.length > MAX_PDF ||
        !pdf.subarray(0, 1024).includes(Buffer.from('%PDF-'))
      )
        throw new ErrorPreparacionCorreo(
          'No se pudo leer un PDF válido. El correo no se envió.',
        );
      const listo = await this.prisma.correoPresupuesto.updateMany({
        where,
        data: {
          archivoId,
          primerIntentoEl: correo.primerIntentoEl ?? new Date(),
          intentos: { increment: 1 },
        },
      });
      if (!listo.count) return;
      const proveedorId = await this.transporte.enviar({ ...correo, pdf });
      await this.prisma.$transaction(async (tx) => {
        const actualizado = await tx.correoPresupuesto.updateMany({
          where,
          data: {
            estado: 'ENVIADO',
            enviadoEl: new Date(),
            proveedorId,
            error: null,
            leaseHasta: null,
          },
        });
        if (actualizado.count)
          await tx.cotizacionEvento.create({
            data: {
              tenantId: correo.tenantId,
              cotizacionId: correo.cotizacionId,
              tipo: 'correo_enviado',
              descripcion: `Correo enviado a ${correo.para} con PDF adjunto y enlace de aprobación.`,
              usuarioId: correo.usuarioId,
              usuarioNombre: correo.usuarioNombre,
              datosJson: { correoId: correo.id },
            },
          });
      });
    } catch (error) {
      await this.prisma.correoPresupuesto.updateMany({
        where,
        data: {
          estado: 'FALLIDO',
          leaseHasta: null,
          error:
            error instanceof Error &&
            (error instanceof BadRequestException ||
              error instanceof ServiceUnavailableException ||
              error instanceof ErrorPreparacionCorreo)
              ? error.message.slice(0, 500)
              : 'No se pudo completar el envío. Reintentá desde el historial.',
        },
      });
    }
  }
}
