import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionesService } from './notificaciones.service';
import { primerNombre } from './notificaciones-ordenes.service';
import { enContextoDe } from './contexto';
import type { EventoNotificacion } from '../wati/catalogo';

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
    const url = `${baseFront()}/presupuesto/${p.publicToken}`;

    const nombre = primerNombre(p.cliente?.razonSocial);
    const total = money(Number(p.total ?? 0));

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

function fecha(d: Date | null): string {
  if (!d) return 'sin vencimiento';
  return new Date(d).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

/** Sin `$`: el símbolo ya está en el texto fijo de la plantilla. */
function money(n: number): string {
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function baseFront(): string {
  return (
    process.env.FRONTEND_URL?.split(',')[0]?.trim() ?? 'http://localhost:3000'
  );
}
