import {
  HttpException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FacturacionLote, FacturacionLoteItem, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { CurrentAuth } from '../auth/auth.types';
import { expandir, permisosDeRolBase } from '../auth/permisos';
import { PrismaService } from '../prisma/prisma.service';
import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';
import { runWithTenant } from '../common/tenant-context';
import { reportarFallo } from '../common/observabilidad';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { ComprobantesService } from './comprobantes.service';
import { EmisionFiscalService } from './emision-fiscal.service';
import {
  IniciarLoteFacturacionDto,
  FacturarLoteDto,
} from './dto/comprobante.dto';

const FISCALES_TERMINALES = ['emitida', 'error', 'verificar'];
const AVISOS_TERMINALES = ['enviada', 'omitida', 'fallida', 'verificar'];
export const LEASE_FACTURACION_MS = 120_000;
const incluirItems = { items: { orderBy: { posicion: 'asc' as const } } };

@Injectable()
export class FacturacionLotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly comprobantes: ComprobantesService,
    private readonly emisiones: EmisionFiscalService,
    private readonly eventos: EventosSistemaService,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  async iniciar(auth: CurrentAuth, input: IniciarLoteFacturacionDto) {
    if (auth.impersonacion || auth.mcp || !auth.membershipId)
      throw new ForbiddenException(
        'Iniciá el lote desde tu propia sesión de usuario.',
      );
    // Defensa también para invocaciones fuera del controller.
    if (!auth.permisos?.has('administracion.facturacion.gestionar'))
      throw new ForbiddenException('No tenés permiso para facturar órdenes.');
    if (
      !input.ordenIds.length ||
      input.ordenIds.length > 100 ||
      new Set(input.ordenIds).size !== input.ordenIds.length
    )
      throw new BadRequestException(
        'Seleccioná entre 1 y 100 órdenes, sin repetir.',
      );
    const solicitud = {
      ordenIds: input.ordenIds,
      modo: input.modo,
      detalle: input.detalle ?? (input.modo === 'agrupada' ? 'orden' : 'items'),
      puntoVentaId: input.puntoVentaId ?? null,
    };
    const where = {
      tenantId_userId_claveSolicitud: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        claveSolicitud: input.claveSolicitud,
      },
    };
    const existente = await this.prisma.facturacionLote.findUnique({
      where,
      include: incluirItems,
    });
    if (existente) return this.mismaSolicitud(existente, solicitud);
    await this.capacidades.exigir(auth.tenantId, 'fiscal_argentina');
    const ordenes = await this.prisma.ordenTrabajo.findMany({
      where: { tenantId: auth.tenantId, id: { in: input.ordenIds } },
      select: {
        id: true,
        numero: true,
        estado: true,
        clienteId: true,
        total: true,
        facturadoTotal: true,
        tratamientoFiscal: true,
      },
    });
    if (ordenes.length !== input.ordenIds.length)
      throw new BadRequestException('Hay órdenes que no existen en el lote.');
    if (
      ordenes.some(
        (o) =>
          ['borrador', 'cancelada'].includes(o.estado) ||
          o.tratamientoFiscal === 'SIN_COMPROBANTE' ||
          Number(o.total ?? 0) - Number(o.facturadoTotal) <= 0.01,
      )
    )
      throw new BadRequestException(
        'Hay órdenes en borrador, canceladas, sin comprobante fiscal o ya facturadas. Actualizá la selección.',
      );
    if (
      input.modo === 'agrupada' &&
      new Set(ordenes.map((o) => o.clienteId)).size !== 1
    )
      throw new BadRequestException(
        'Para agrupar, las órdenes tienen que ser del mismo cliente.',
      );
    const numeros = new Map(ordenes.map((o) => [o.id, o.numero]));
    const grupos =
      input.modo === 'agrupada'
        ? [input.ordenIds]
        : input.ordenIds.map((id) => [id]);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serializa sólo la admisión de lotes de esta empresa, sin trabajo remoto.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${auth.tenantId}, 817))::text`;
        const repetido = await tx.facturacionLote.findUnique({
          where,
          include: incluirItems,
        });
        if (repetido) return this.mismaSolicitud(repetido, solicitud);
        if (
          (await tx.facturacionLote.count({
            where: {
              tenantId: auth.tenantId,
              userId: auth.userId,
              estado: { in: ['pendiente', 'procesando', 'esperando_envios'] },
            },
          })) >= 5
        )
          throw new ConflictException(
            'Ya tenés cinco lotes en curso. Esperá a que terminen antes de iniciar otro.',
          );
        const ocupado = await tx.facturacionLoteItem.findFirst({
          where: {
            tenantId: auth.tenantId,
            ordenIds: { hasSome: input.ordenIds },
            lote: { estado: { in: ['pendiente', 'procesando'] } },
          },
        });
        if (ocupado)
          throw new ConflictException(
            'Hay órdenes seleccionadas que ya pertenecen a un lote en curso.',
          );
        return tx.facturacionLote.create({
          data: {
            tenantId: auth.tenantId,
            userId: auth.userId,
            claveSolicitud: input.claveSolicitud,
            solicitudJson: solicitud,
            items: {
              create: grupos.map((ids, posicion) => ({
                tenantId: auth.tenantId,
                posicion,
                ordenIds: ids,
                numeros: ids.map((id) => numeros.get(id)!),
              })),
            },
          },
          include: incluirItems,
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const repetido = await this.prisma.facturacionLote.findUniqueOrThrow({
          where,
          include: incluirItems,
        });
        return this.mismaSolicitud(repetido, solicitud);
      }
      throw e;
    }
  }

  private mismaSolicitud<T extends FacturacionLote>(
    lote: T,
    solicitud: unknown,
  ): T {
    // JSONB no conserva orden de claves; comparar por campos canónicos.
    const a = lote.solicitudJson as Record<string, unknown>;
    const b = solicitud as Record<string, unknown>;
    if (
      ['ordenIds', 'modo', 'detalle', 'puntoVentaId'].some(
        (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]),
      )
    )
      throw new ConflictException(
        'La clave de solicitud ya corresponde a otro lote.',
      );
    return lote;
  }

  presentar(lote: FacturacionLote & { items: FacturacionLoteItem[] }) {
    // Los tokens de ejecución y la solicitud interna no salen al navegador.
    return {
      id: lote.id,
      estado: lote.estado,
      createdAt: lote.createdAt,
      items: lote.items.map((i) => ({
        id: i.id,
        ordenIds: i.ordenIds,
        numeros: i.numeros,
        estado: i.estado,
        comprobanteId: i.comprobanteId,
        error: i.error,
        avisoEstado: i.avisoEstado,
        avisoDetalle: i.avisoDetalle,
        pdfEstado: i.pdfEstado,
      })),
    };
  }

  listar(auth: CurrentAuth) {
    return this.prisma.facturacionLote.findMany({
      where: { tenantId: auth.tenantId, userId: auth.userId },
      include: incluirItems,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async obtener(auth: CurrentAuth, id: string) {
    const lote = await this.prisma.facturacionLote.findFirst({
      where: { id, tenantId: auth.tenantId, userId: auth.userId },
      include: incluirItems,
    });
    if (!lote) throw new NotFoundException('No se encontró el lote.');
    return lote;
  }

  /** SQL sin contexto: admisión cross-tenant del proceso dedicado, nunca HTTP.
   * El advisory lock sólo serializa este commit breve, no la emisión ni la red. */
  async reclamar() {
    return this.prisma.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<
        { ok: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(173126, 817) AS ok`;
      if (!lock.ok) return null;
      const token = randomUUID();
      const filas = await tx.$queryRaw<FacturacionLote[]>`
        WITH candidato AS (
          SELECT l.id FROM "FacturacionLote" l
          WHERE l.estado IN ('pendiente', 'procesando', 'esperando_envios')
            AND l."proximaEjecucion" <= NOW()
            AND (l."leaseHasta" IS NULL OR l."leaseHasta" < NOW())
            AND NOT EXISTS (SELECT 1 FROM "FacturacionLote" otro
              WHERE otro."tenantId" = l."tenantId" AND otro."leaseHasta" >= NOW())
          ORDER BY l."proximaEjecucion", l."createdAt"
          FOR UPDATE SKIP LOCKED LIMIT 1
        )
        UPDATE "FacturacionLote" l SET "leaseToken" = ${token}::uuid,
          "leaseHasta" = NOW() + INTERVAL '120 seconds', "updatedAt" = NOW()
        FROM candidato c WHERE l.id = c.id RETURNING l.*`;
      return filas[0] ?? null;
    });
  }

  async renovar(lote: FacturacionLote) {
    const r = await this.prisma.facturacionLote.updateMany({
      where: {
        id: lote.id,
        tenantId: lote.tenantId,
        leaseToken: lote.leaseToken,
      },
      data: { leaseHasta: new Date(Date.now() + LEASE_FACTURACION_MS) },
    });
    return r.count === 1;
  }

  async liberar(lote: FacturacionLote, demoraMs = 2_000) {
    await this.prisma.facturacionLote.updateMany({
      where: {
        id: lote.id,
        tenantId: lote.tenantId,
        leaseToken: lote.leaseToken,
      },
      data: {
        leaseToken: null,
        leaseHasta: null,
        proximaEjecucion: new Date(Date.now() + demoraMs),
      },
    });
  }

  private async authVigente(lote: FacturacionLote): Promise<CurrentAuth> {
    const m = await this.prisma.membership.findFirst({
      where: {
        tenantId: lote.tenantId,
        userId: lote.userId,
        activa: true,
        user: { activo: true },
        tenant: { activo: true },
      },
      include: { user: true, rolDelTenant: true },
    });
    if (!m)
      throw new ForbiddenException(
        'El usuario que inició el lote ya no tiene acceso a la empresa.',
      );
    const permisos = expandir(
      m.rolDelTenant?.permisos ?? permisosDeRolBase(m.rol),
    );
    if (!permisos.has('administracion.facturacion.gestionar'))
      throw new ForbiddenException(
        'El usuario que inició el lote ya no tiene permiso para facturar.',
      );
    return {
      tenantId: lote.tenantId,
      userId: lote.userId,
      membershipId: m.id,
      role: m.rol,
      email: m.user.email,
      sessionId: `lote:${lote.id}`,
      permisos,
    };
  }

  /** Un paso por turno: no acapara la empresa ni monopoliza el worker. */
  async procesar(lote: FacturacionLote) {
    return runWithTenant(lote.tenantId, async () => {
      if (!(await this.renovar(lote))) return;
      const items = await this.prisma.facturacionLoteItem.findMany({
        where: { tenantId: lote.tenantId, loteId: lote.id },
        orderBy: { posicion: 'asc' },
      });
      const fiscal = items.find((i) => !FISCALES_TERMINALES.includes(i.estado));
      if (fiscal) {
        await this.prisma.facturacionLote.updateMany({
          where: { id: lote.id, leaseToken: lote.leaseToken },
          data: { estado: 'procesando' },
        });
        await this.procesarFiscal(lote, fiscal);
        return;
      }
      const publicacion = items
        .filter(
          (i) =>
            i.estado === 'emitida' &&
            !AVISOS_TERMINALES.includes(i.avisoEstado),
        )
        .sort(
          (a, b) =>
            Number(a.pdfEstado === 'listo') - Number(b.pdfEstado === 'listo') ||
            a.updatedAt.getTime() - b.updatedAt.getTime(),
        )[0];
      if (publicacion) {
        await this.prisma.facturacionLote.updateMany({
          where: { id: lote.id, leaseToken: lote.leaseToken },
          data: { estado: 'esperando_envios' },
        });
        await this.procesarPublicacion(lote, publicacion);
        return;
      }
      await this.finalizar(lote, items);
    });
  }

  private async procesarFiscal(
    lote: FacturacionLote,
    item: FacturacionLoteItem,
  ) {
    const solicitud = lote.solicitudJson as unknown as FacturarLoteDto;
    try {
      const auth = await this.authVigente(lote);
      if (!item.comprobanteId) {
        // Se adjunta en la misma transacción que crea el borrador.
        if (solicitud.modo === 'agrupada')
          await this.comprobantes.facturarLote(
            auth,
            {
              ...solicitud,
              puntoVentaId: solicitud.puntoVentaId ?? undefined,
              ordenIds: item.ordenIds,
            },
            item.id,
            lote.leaseToken!,
          );
        else
          await this.comprobantes.facturarOrden(
            auth,
            item.ordenIds[0],
            {
              emitir: false,
              detalle: solicitud.detalle,
              puntoVentaId: solicitud.puntoVentaId ?? undefined,
            },
            item.id,
            lote.leaseToken!,
          );
      }
      const vigente = await this.prisma.facturacionLoteItem.findUniqueOrThrow({
        where: { id: item.id },
      });
      if (!vigente.comprobanteId)
        throw new Error('No se pudo asociar el comprobante al lote.');
      const c = await this.prisma.comprobante.findFirstOrThrow({
        where: { id: vigente.comprobanteId, tenantId: lote.tenantId },
        include: { emisiones: { orderBy: { creadaEl: 'desc' }, take: 1 } },
      });
      if (c.estado !== 'emitido' && c.estado !== 'rechazado') {
        const anterior = c.emisiones[0];
        if (!anterior) await this.emisiones.emitir(auth, c.id);
        // Un reinicio nunca autoriza un segundo envío: sólo consulta el intento existente.
        else if (
          ['preparando', 'enviando', 'verificar'].includes(anterior.estado)
        )
          await this.emisiones.consultar(auth, c.id);
      }
      const resultado = await this.prisma.comprobante.findFirstOrThrow({
        where: { id: c.id, tenantId: lote.tenantId },
        include: { emisiones: { orderBy: { creadaEl: 'desc' }, take: 1 } },
      });
      const intento = resultado.emisiones[0];
      if (resultado.estado === 'emitido') {
        await this.actualizarItem(lote, item.id, {
          estado: 'emitida',
          error: null,
        });
      } else if (
        intento &&
        ['preparando', 'enviando', 'verificar'].includes(intento.estado)
      ) {
        // Consulta automática acotada; mantener la serie fiscal protegida si no se confirmó.
        if (Date.now() - intento.creadaEl.getTime() < 180_000) return;
        await this.detenerPorIncierta(
          lote,
          item.id,
          intento.detalle ?? 'Consultá el resultado fiscal antes de continuar.',
        );
      } else {
        await this.actualizarItem(lote, item.id, {
          estado: 'error',
          avisoEstado: 'omitida',
          error:
            resultado.estado === 'rechazado' &&
            Array.isArray(
              (resultado.rechazoJson as { errores?: unknown[] } | null)
                ?.errores,
            )
              ? (resultado.rechazoJson as { errores: string[] }).errores
                  .join(' · ')
                  .slice(0, 500) || 'El proveedor rechazó el comprobante.'
              : (intento?.detalle ??
                `El comprobante quedó ${resultado.estado}.`),
        });
      }
    } catch (error) {
      reportarFallo(error, {
        area: 'administracion',
        operacion: 'cola',
        cola: 'facturacion',
        tenant_id: lote.tenantId,
        lote_id: lote.id,
        etapa: 'emision',
      });
      // Un fallo de persistencia posterior al envío tampoco prueba que ARCA lo rechazó.
      const vigente = await this.prisma.facturacionLoteItem.findUniqueOrThrow({
        where: { id: item.id },
      });
      if (vigente.comprobanteId) {
        const c = await this.prisma.comprobante.findFirstOrThrow({
          where: { id: vigente.comprobanteId, tenantId: lote.tenantId },
          include: { emisiones: { orderBy: { creadaEl: 'desc' }, take: 1 } },
        });
        if (c.estado === 'emitido') {
          await this.actualizarItem(lote, item.id, {
            estado: 'emitida',
            error: null,
          });
          return;
        }
        if (
          c.emisiones.some((e) =>
            ['preparando', 'enviando', 'verificar'].includes(e.estado),
          )
        ) {
          await this.detenerPorIncierta(
            lote,
            item.id,
            'El envío fiscal requiere verificación. No se volvió a enviar.',
          );
          return;
        }
      }
      await this.actualizarItem(lote, item.id, {
        estado: 'error',
        avisoEstado: 'omitida',
        error:
          error instanceof HttpException && error.getStatus() < 500
            ? error.message.slice(0, 500)
            : 'No se pudo completar la emisión por un problema temporal. Revisá el comprobante antes de volver a facturar.',
      });
    }
  }

  private async detenerPorIncierta(
    lote: FacturacionLote,
    itemId: string,
    detalle: string,
  ) {
    await this.actualizarItem(lote, itemId, {
      estado: 'verificar',
      avisoEstado: 'omitida',
      error: detalle,
    });
    await this.prisma.facturacionLoteItem.updateMany({
      where: {
        tenantId: lote.tenantId,
        loteId: lote.id,
        estado: 'pendiente',
        comprobanteId: null,
        lote: { leaseToken: lote.leaseToken },
      },
      data: {
        estado: 'error',
        avisoEstado: 'omitida',
        error:
          'No procesada: hay un envío fiscal pendiente de verificación en este lote.',
      },
    });
  }

  private async procesarPublicacion(
    lote: FacturacionLote,
    item: FacturacionLoteItem,
  ) {
    const aviso = await this.prisma.notificacionWhatsapp.findFirst({
      where: {
        tenantId: lote.tenantId,
        claveUnica: `comprobante_emitido:${item.comprobanteId}`,
      },
    });
    if (aviso) {
      const vencido =
        aviso.estado === 'wati_aceptada' &&
        aviso.estadoEntregaEl &&
        Date.now() - aviso.estadoEntregaEl.getTime() > 24 * 60 * 60_000;
      const estado = vencido
        ? 'verificar'
        : aviso.estado === 'enviada'
          ? 'enviada'
          : aviso.estado === 'descartada'
            ? 'omitida'
            : aviso.estado === 'fallida'
              ? 'fallida'
              : aviso.estado.includes('incierta')
                ? 'verificar'
                : 'pendiente';
      await this.actualizarItem(lote, item.id, {
        avisoEstado: estado,
        avisoDetalle: vencido
          ? 'El proveedor no confirmó el envío en 24 horas. Revisá su resultado.'
          : aviso.motivo,
        pdfEstado: 'listo',
      });
      // Los envíos programados mantienen el lote visible; el scheduler existente despacha.
      return;
    }
    try {
      const resultado = await this.comprobantes.publicarParaLote(
        lote.tenantId,
        item.comprobanteId!,
      );
      if (
        !resultado.encolada &&
        resultado.motivo === 'Error interno al encolar.'
      )
        throw new Error(resultado.motivo);
      await this.actualizarItem(lote, item.id, {
        pdfEstado: 'listo',
        avisoEstado:
          resultado.encolada || resultado.motivo === 'Ya se había notificado.'
            ? 'pendiente'
            : 'omitida',
        avisoDetalle: resultado.encolada ? null : resultado.motivo,
      });
    } catch (error) {
      reportarFallo(error, {
        area: 'administracion',
        operacion: 'cola',
        cola: 'facturacion',
        tenant_id: lote.tenantId,
        lote_id: lote.id,
        etapa: 'publicacion',
      });
      const intentos = item.intentosPublicacion + 1;
      await this.actualizarItem(lote, item.id, {
        intentosPublicacion: intentos,
        avisoEstado: intentos >= 4 ? 'fallida' : 'pendiente',
        avisoDetalle:
          'No se pudo preparar el PDF o encolar el aviso al cliente.',
      });
    }
  }

  private async actualizarItem(
    lote: FacturacionLote,
    id: string,
    data: Prisma.FacturacionLoteItemUpdateManyMutationInput,
  ) {
    const r = await this.prisma.facturacionLoteItem.updateMany({
      where: {
        id,
        tenantId: lote.tenantId,
        loteId: lote.id,
        lote: { leaseToken: lote.leaseToken },
      },
      data,
    });
    if (!r.count)
      throw new ConflictException(
        'Se perdió el turno de procesamiento del lote.',
      );
  }

  private async finalizar(lote: FacturacionLote, items: FacturacionLoteItem[]) {
    const emitidas = items.filter((i) => i.estado === 'emitida').length;
    const enviadas = items.filter((i) => i.avisoEstado === 'enviada').length;
    const completo = emitidas === items.length && enviadas === items.length;
    await this.prisma.$transaction(async (tx) => {
      // Actualización condicional y evento en un commit: una sola campanita aun con reinicios.
      const r = await tx.facturacionLote.updateMany({
        where: {
          id: lote.id,
          tenantId: lote.tenantId,
          leaseToken: lote.leaseToken,
          notificadaEl: null,
        },
        data: {
          estado: completo ? 'completado' : 'con_observaciones',
          notificadaEl: new Date(),
        },
      });
      if (!r.count) return;
      await this.eventos.publicar(
        {
          tenantId: lote.tenantId,
          actorNombre: 'Sistema',
          tipo: 'facturacion_lote_finalizado',
          entidadTipo: 'facturacion_lote',
          entidadId: lote.id,
          titulo: completo
            ? 'Facturación y envíos completados'
            : 'Lote de facturación terminado con observaciones',
          mensaje: completo
            ? `Se emitieron ${emitidas} facturas y se confirmó el envío a los clientes.`
            : `Se emitieron ${emitidas} de ${items.length} facturas y se confirmó el envío de ${enviadas}. Revisá el detalle de las facturas y avisos que requieren atención.`,
          href: `/administracion/facturacion?lote=${lote.id}`,
          severidad: completo ? 'EXITO' : 'ADVERTENCIA',
          topicos: ['administracion.facturacion'],
          destinatariosUserId: [lote.userId],
          incluirActor: true,
        },
        tx,
      );
    });
  }
}
