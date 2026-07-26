import { Injectable, Logger } from '@nestjs/common';
import { TipoEnlacePublico } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionesService } from './notificaciones.service';
import { enContextoDe } from './contexto';
import type { EventoNotificacion } from '../wati/catalogo';
import { urlEnlacePublico } from '../../enlaces-publicos/enlaces-publicos.urls';
import { numeroMoneda } from '../../common/moneda';
import { regionalDelTenant } from '../../common/regional';

/**
 * Traduce el estado de una orden al aviso que le corresponde.
 *
 * **Por qué lee el estado en vez de engancharse a la transición.** La orden
 * cambia de estado en media docena de lugares distintos —completar un paso,
 * recibir una compra tercerizada, emitirla a mano— y sólo uno de ellos deja
 * registro. Engancharse a cada uno significa perder el que se agregue mañana.
 *
 * Acá se hace al revés: se pregunta "¿en qué estado está?" y se encola lo que
 * corresponda. Y **llamarlo de más es gratis**, porque la clave única
 * `(evento, orden)` descarta el repetido — eso es lo que permite sembrarlo sin
 * miedo después de cualquier operación que *pueda* haber movido la orden, y
 * que el cron lo vuelva a llamar como red sin duplicar nada.
 *
 * Nunca lanza: una notificación no puede voltear la operación que la disparó.
 */

/** Qué aviso va con cada estado. Los que no están acá no notifican. */
const EVENTO_POR_ESTADO: Record<string, EventoNotificacion> = {
  pendiente: 'orden_recibida',
  produccion: 'orden_en_produccion',
  entregada: 'orden_entregada',
  // `finalizada` se resuelve aparte: hay dos plantillas según quede saldo.
};

@Injectable()
export class NotificacionesOrdenesService {
  private readonly logger = new Logger(NotificacionesOrdenesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /**
   * Encola el aviso que corresponda al estado actual de la orden.
   *
   * Pensado para llamarse sin `await` desde el flujo de negocio.
   */
  async sincronizar(ordenId: string): Promise<void> {
    try {
      await this.intentar(ordenId);
    } catch (error) {
      this.logger.error(
        `Falló al sincronizar avisos de la orden ${ordenId}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async intentar(ordenId: string): Promise<void> {
    const orden = await this.prisma.ordenTrabajo.findFirst({
      where: { id: ordenId },
      select: {
        tenantId: true,
        id: true,
        numero: true,
        estado: true,
        fechaEntrega: true,
        total: true,
        cobradoTotal: true,
        publicToken: true,
        clienteId: true,
        cliente: { select: { razonSocial: true } },
      },
    });
    if (!orden?.clienteId) return;

    const saldo = Number(orden.total ?? 0) - Number(orden.cobradoTotal ?? 0);
    const evento =
      orden.estado === 'finalizada'
        ? saldo > 0
          ? 'orden_lista_con_saldo'
          : 'orden_lista'
        : EVENTO_POR_ESTADO[orden.estado];
    if (!evento) return;

    // El link de seguimiento sale del token público, que se genera al emitir
    // la orden. Sin token no hay nada que mostrarle al cliente, así que el
    // aviso pierde la mitad de su gracia: mejor no mandarlo.
    const seguimiento = orden.publicToken
      ? urlEnlacePublico(TipoEnlacePublico.SEGUIMIENTO_OT, orden.publicToken)
      : null;

    const nombre = nombreDelCliente(orden.cliente?.razonSocial);
    const comun = { clienteId: orden.clienteId, ordenId: orden.id };

    // Sin `$`: el símbolo ya está en el texto fijo de la plantilla de Meta,
    // y mandarlo acá saldría "$$92.700,00". La fecha, en la zona del taller.
    const { moneda, zonaHoraria } = await regionalDelTenant(
      this.prisma,
      orden.tenantId,
    );
    const money = (n: number) => numeroMoneda(n, moneda);
    const fecha = (d: Date | null) => fechaLegible(d, zonaHoraria);

    const parametros = (() => {
      switch (evento) {
        case 'orden_recibida':
        case 'orden_en_produccion':
          return seguimiento
            ? [nombre, orden.numero, fecha(orden.fechaEntrega), seguimiento]
            : null;
        case 'orden_lista':
          return seguimiento ? [nombre, orden.numero, seguimiento] : null;
        case 'orden_lista_con_saldo':
          return seguimiento
            ? [nombre, orden.numero, money(saldo), seguimiento]
            : null;
        case 'orden_entregada':
          return [nombre, orden.numero, fecha(orden.fechaEntrega)];
        default:
          return null;
      }
    })();
    if (!parametros) return;

    // Igual que en presupuestos: puede venir de una ruta pública sin contexto.
    await enContextoDe(orden.tenantId, () =>
      this.notificaciones.encolar({
        evento,
        entidadId: orden.id,
        ...comun,
        parametros,
      }),
    );
  }
}

/**
 * El nombre del cliente para el saludo del mensaje.
 *
 * Va COMPLETO. La primera versión cortaba al primer token para que no saliera
 * "Hola Distribuidora del Sur S.R.L.", y el resultado fue peor: "Imprenta
 * Imagen SRL" llegaba como "Hola Imprenta", que suena a que le erramos al
 * nombre. Un nombre largo se lee raro; uno cortado se lee mal.
 */
export function nombreDelCliente(razonSocial?: string | null): string {
  return (razonSocial ?? '').trim() || 'Hola';
}

/** `dd/mm/aaaa`, o un guion si la orden no tiene fecha comprometida. */
function fechaLegible(d: Date | null, zona: string): string {
  if (!d) return 'a confirmar';
  return new Date(d).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: zona,
  });
}

