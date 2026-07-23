import { Injectable, Logger } from '@nestjs/common';
import { TipoEnlacePublico } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionesService } from './notificaciones.service';
import { nombreDelCliente } from './notificaciones-ordenes.service';
import { enContextoDe } from './contexto';
import { urlEnlacePublico } from '../../enlaces-publicos/enlaces-publicos.urls';

/**
 * "Registramos tu pago" — el aviso del recibo.
 *
 * A diferencia de los avisos de orden y presupuesto, este NO se deriva de un
 * estado: un cobro registrado es un hecho puntual, no una transición que se
 * pueda releer. Por eso se llama una sola vez, al registrarlo, y la clave
 * única del encolado es la que evita el duplicado si se llama de más.
 *
 * Se manda al REGISTRAR, no al acreditar: lo que el cliente necesita saber es
 * que su pago llegó. Si el banco lo acredita mañana es asunto nuestro.
 * Ver docs/recibos-pago-diseno.md
 */
@Injectable()
export class NotificacionesCobrosService {
  private readonly logger = new Logger(NotificacionesCobrosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** Pensado para llamarse sin `await` desde el flujo de negocio. */
  async avisar(cobroId: string): Promise<void> {
    try {
      await this.intentar(cobroId);
    } catch (error) {
      this.logger.error(
        `Falló al avisar el cobro ${cobroId}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async intentar(cobroId: string): Promise<void> {
    const cobro = await this.prisma.cobro.findFirst({
      where: { id: cobroId, anuladoEl: null },
      select: {
        id: true,
        tenantId: true,
        clienteId: true,
        montoBruto: true,
        cliente: { select: { razonSocial: true } },
        orden: {
          select: { id: true, numero: true, total: true, cobradoTotal: true },
        },
      },
    });
    if (!cobro?.clienteId) return;

    // La plantilla pide número de orden y saldo restante. Un pago a cuenta no
    // tiene ni uno ni otro, y no hay forma honesta de rellenarlos: mejor no
    // mandar nada que mandar "OT-—" con saldo cero.
    if (!cobro.orden) return;

    const enlace = await this.prisma.enlacePublico.findUnique({
      where: {
        tipo_entidadId: {
          tipo: TipoEnlacePublico.COBRO,
          entidadId: cobro.id,
        },
      },
      select: { token: true },
    });
    // Sin link no hay recibo que ver, y el mensaje existe para que lo vea.
    if (!enlace) return;

    const total = Number(cobro.orden.total ?? 0);
    const cobrado = Number(cobro.orden.cobradoTotal ?? 0);
    const saldo = Math.max(0, total - cobrado);

    const parametros = [
      nombreDelCliente(cobro.cliente?.razonSocial),
      money(Number(cobro.montoBruto)),
      cobro.orden.numero,
      money(saldo),
      urlEnlacePublico(TipoEnlacePublico.COBRO, enlace.token),
    ];

    // El cobro puede registrarse desde un flujo sin contexto de tenant (cron
    // de acreditación); sin esto el encolado falla y el aviso se pierde callado.
    await enContextoDe(cobro.tenantId, () =>
      this.notificaciones.encolar({
        evento: 'pago_recibido',
        entidadId: cobro.id,
        clienteId: cobro.clienteId,
        ordenId: cobro.orden!.id,
        parametros,
      }),
    );
  }
}

/** Sin `$`: el símbolo ya está en el texto fijo de la plantilla. */
function money(n: number): string {
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
