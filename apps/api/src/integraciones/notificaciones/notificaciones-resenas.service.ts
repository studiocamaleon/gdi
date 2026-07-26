import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { DatosEmpresaService } from '../../tenants/datos-empresa.service';
import { enContextoDe } from './contexto';
import { nombreDelCliente } from './notificaciones-ordenes.service';
import { NotificacionesService } from './notificaciones.service';

/**
 * El pedido de reseña, unos días después de la entrega.
 *
 * Es el único aviso que **no** lo dispara un hecho: nadie aprieta un botón
 * llamado "ya pasaron tres días". Por eso se resuelve barriendo, igual que la
 * acreditación de cobros con plazo: se busca lo que cumplió el plazo y se
 * encola. La clave única `(evento, orden)` hace que barrer de más sea gratis.
 *
 * Tres cosas lo frenan, y las tres son a propósito:
 *
 *  - **Sin link de reseñas no se manda.** El mensaje entero existe para llevar
 *    a esa página; sin ella sería spam sin destino. Vive en Configuración ›
 *    Empresa.
 *  - **Es plantilla de MARKETING**, así que `NotificacionesService` sólo la
 *    deja pasar si el cliente aceptó recibir WhatsApp explícitamente. Un
 *    cliente al que nunca se le preguntó recibe los avisos de su propia orden
 *    y no esto.
 *  - **Viene apagado** (`activoPorDefecto: false` en el catálogo). La imprenta
 *    lo enciende cuando quiere.
 *
 * Ver docs/datos-de-empresa-diseno.md (fase C).
 */

/**
 * Hasta cuántos días para atrás mira el barrido, más allá del plazo.
 *
 * Sin este techo, encender la función —o volver de una pausa larga— dispararía
 * un mensaje por cada orden entregada desde que existe el campo. Con él, lo
 * que quedó viejo simplemente no se pide: a nadie le sirve que le pregunten
 * por un trabajo de hace dos meses.
 */
const VENTANA_DIAS = 10;

@Injectable()
export class NotificacionesResenasService {
  private readonly logger = new Logger(NotificacionesResenasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
    private readonly empresa: DatosEmpresaService,
  ) {}

  /** Nunca lanza: un barrido que falla no puede voltear el cron entero. */
  async barrer(tenantId: string, ahora = new Date()): Promise<number> {
    try {
      return await this.intentar(tenantId, ahora);
    } catch (error) {
      this.logger.error(
        `Falló el barrido de reseñas del tenant ${tenantId}.`,
        error instanceof Error ? error.stack : String(error),
      );
      return 0;
    }
  }

  private async intentar(tenantId: string, ahora: Date): Promise<number> {
    const { urlResenas } = await this.empresa.paraDocumentos(tenantId);
    if (!urlResenas) return 0;

    const config = await this.prisma.configuracionNotificaciones.findUnique({
      where: { tenantId },
      select: { resenaDiasDespues: true },
    });
    const dias = config?.resenaDiasDespues ?? 3;

    const hasta = restarDias(ahora, dias);
    const desde = restarDias(hasta, VENTANA_DIAS);

    // Las que ya tienen el pedido encolado. La clave única las descartaría
    // igual, pero mirarlo antes evita un INSERT fallido por orden y por
    // corrida — el barrido pasa todos los días sobre la misma ventana.
    const yaPedidas = (
      await this.prisma.notificacionWhatsapp.findMany({
        where: { tenantId, evento: 'resena', ordenId: { not: null } },
        select: { ordenId: true },
      })
    ).map((n) => n.ordenId!);

    const ordenes = await this.prisma.ordenTrabajo.findMany({
      where: {
        tenantId,
        estado: 'entregada',
        fechaEntregada: { gte: desde, lte: hasta },
        clienteId: { not: null },
        // Lo ya encolado se filtra abajo con `claveUnica`: `NotificacionWhatsapp`
        // guarda `ordenId` como columna suelta, sin relación de Prisma, así que
        // no se puede filtrar acá con un `none`.
        ...(yaPedidas.length ? { id: { notIn: yaPedidas } } : {}),
      },
      select: {
        id: true,
        numero: true,
        clienteId: true,
        cliente: { select: { razonSocial: true } },
      },
      orderBy: { fechaEntregada: 'asc' },
    });

    let encoladas = 0;
    for (const orden of ordenes) {
      const r = await enContextoDe(tenantId, () =>
        this.notificaciones.encolar({
          evento: 'resena',
          entidadId: orden.id,
          clienteId: orden.clienteId!,
          ordenId: orden.id,
          parametros: [
            nombreDelCliente(orden.cliente?.razonSocial),
            orden.numero ?? '',
            urlResenas,
          ],
        }),
      );
      if (r.encolada) encoladas++;
    }
    return encoladas;
  }
}

function restarDias(d: Date, dias: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - dias);
  return x;
}
