import { Injectable, Logger } from '@nestjs/common';
import { TipoEnlacePublico } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionesService } from './notificaciones.service';
import { nombreDelCliente } from './notificaciones-ordenes.service';
import { enContextoDe } from './contexto';
import type { EventoNotificacion } from '../wati/catalogo';
import { urlEnlacePublico } from '../../enlaces-publicos/enlaces-publicos.urls';
import { numeroMoneda } from '../../common/moneda';
import { regionalDelTenant } from '../../common/regional';

/**
 * Traduce el estado de un presupuesto al aviso que le corresponde.
 *
 * Mismo patrón que el de órdenes y por las mismas razones: se pregunta "¿en
 * qué estado está?" en vez de engancharse a cada transición, así que llamarlo
 * de más es gratis y no hay que acertar qué método lo movió.
 *
 * `presupuesto_por_vencer` NO está acá: no lo dispara un cambio de estado sino
 * el paso del tiempo, y eso no tiene puerta que suene. Va por cron aparte.
 */

const EVENTO_POR_ESTADO: Record<string, EventoNotificacion> = {
  enviado: 'presupuesto_enviado',
  aprobado: 'presupuesto_aprobado',
  // `rechazado`, `vencido` y `convertido` no le avisan nada al cliente: o ya
  // lo sabe porque fue él quien decidió, o es un estado interno nuestro.
};

@Injectable()
export class NotificacionesPresupuestosService {
  private readonly logger = new Logger(NotificacionesPresupuestosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** Pensado para llamarse sin `await` desde el flujo de negocio. */
  async sincronizar(cotizacionId: string): Promise<void> {
    try {
      await this.intentar(cotizacionId);
    } catch (error) {
      this.logger.error(
        `Falló al sincronizar avisos del presupuesto ${cotizacionId}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Encola, una sola vez, presupuestos enviados que vencen en tres días. */
  async barrerPorVencer(tenantId: string, ahora = new Date()): Promise<number> {
    const hasta = new Date(ahora.getTime() + 3 * 86_400_000);
    const yaAvisados = (
      await this.prisma.notificacionWhatsapp.findMany({
        where: {
          tenantId,
          evento: 'presupuesto_por_vencer',
          cotizacionId: { not: null },
        },
        select: { cotizacionId: true },
      })
    ).map((fila) => fila.cotizacionId!);
    const presupuestos = await this.prisma.cotizacion.findMany({
      where: {
        tenantId,
        estado: 'enviado',
        clienteId: { not: null },
        publicToken: { not: null },
        fechaValidez: { gte: ahora, lte: hasta },
        ...(yaAvisados.length ? { id: { notIn: yaAvisados } } : {}),
      },
      select: {
        id: true,
        numero: true,
        clienteId: true,
        publicToken: true,
        fechaValidez: true,
        cliente: { select: { razonSocial: true } },
      },
      orderBy: { fechaValidez: 'asc' },
    });
    const { zonaHoraria } = await regionalDelTenant(this.prisma, tenantId);
    let encoladas = 0;
    for (const presupuesto of presupuestos) {
      const resultado = await enContextoDe(tenantId, () =>
        this.notificaciones.encolar({
          evento: 'presupuesto_por_vencer',
          entidadId: presupuesto.id,
          clienteId: presupuesto.clienteId!,
          cotizacionId: presupuesto.id,
          parametros: [
            nombreDelCliente(presupuesto.cliente?.razonSocial),
            presupuesto.numero ?? '',
            fechaLegible(presupuesto.fechaValidez, zonaHoraria),
            urlEnlacePublico(
              TipoEnlacePublico.PRESUPUESTO,
              presupuesto.publicToken!,
            ),
          ],
        }),
      );
      if (resultado.encolada) encoladas += 1;
    }
    return encoladas;
  }

  private async intentar(cotizacionId: string): Promise<void> {
    const p = await this.prisma.cotizacion.findFirst({
      where: { id: cotizacionId },
      select: {
        tenantId: true,
        id: true,
        numero: true,
        estado: true,
        total: true,
        fechaValidez: true,
        publicToken: true,
        clienteId: true,
        cliente: { select: { razonSocial: true } },
      },
    });
    if (!p?.clienteId || !p.numero) return;

    const evento = EVENTO_POR_ESTADO[p.estado];
    if (!evento) return;

    // Sin link público el mensaje no sirve: los dos avisos existen para que el
    // cliente ABRA el presupuesto.
    if (!p.publicToken) return;
    const url = urlEnlacePublico(TipoEnlacePublico.PRESUPUESTO, p.publicToken);

    const nombre = nombreDelCliente(p.cliente?.razonSocial);
    // Sin `$`: el símbolo ya está en el texto fijo de la plantilla de Meta.
    // La fecha de vencimiento, en la zona del taller.
    const { moneda, zonaHoraria } = await regionalDelTenant(
      this.prisma,
      p.tenantId,
    );
    const total = numeroMoneda(Number(p.total ?? 0), moneda);
    const fecha = (d: Date | null) => fechaLegible(d, zonaHoraria);

    const parametros =
      evento === 'presupuesto_enviado'
        ? [nombre, p.numero, total, fecha(p.fechaValidez), url]
        : [nombre, p.numero, total, url];

    // La aprobación llega desde el link público, que no tiene contexto de
    // tenant. Sin esto el encolado falla y el aviso se pierde callado.
    await enContextoDe(p.tenantId, () =>
      this.notificaciones.encolar({
        evento,
        entidadId: p.id,
        clienteId: p.clienteId!,
        cotizacionId: p.id,
        parametros,
      }),
    );
  }
}

function fechaLegible(d: Date | null, zona: string): string {
  if (!d) return 'sin vencimiento';
  return new Date(d).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: zona,
  });
}
