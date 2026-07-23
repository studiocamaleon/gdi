import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { getCurrentTenantId } from '../../common/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CATALOGO,
  POR_EVENTO,
  type EventoNotificacion,
} from '../wati/catalogo';
import { aE164 } from '../telefono';
import { DespachoService } from './despacho.service';
import { ESTADOS } from './estados';

/**
 * Encola notificaciones de WhatsApp y decide cuáles NO salen.
 *
 * Casi todo el valor está en el descarte. Mandar un mensaje es una línea; lo
 * difícil es que no salga cuando no corresponde, y hay cinco razones distintas
 * para que no corresponda — el tenant apagó el evento, el cliente no dio
 * consentimiento, la plantilla no está aprobada, el teléfono no sirve, o ya se
 * mandó. Cada una se resuelve acá y queda registrada con su motivo, así el
 * "no le llegó nada al cliente" tiene siempre una respuesta.
 *
 * **El evento de negocio nunca falla por esto** (D4). `encolar` no lanza: si
 * algo sale mal, devuelve el motivo y el negocio sigue. Marcar una orden como
 * lista no puede depender de que Wati esté vivo.
 *
 * Ver docs/notificaciones-whatsapp-catalogo.md
 */

export type ContextoNotificacion = {
  evento: EventoNotificacion;
  /** Lo que hace única a la notificación: la orden, el presupuesto, el cobro. */
  entidadId: string;
  clienteId?: string | null;
  ordenId?: string | null;
  cotizacionId?: string | null;
  /** Valores POSICIONALES: el primero es {{1}}. Los nombres los pone el catálogo. */
  parametros: string[];
};

export type ResultadoEncolar =
  | { encolada: true; id: string }
  | { encolada: false; motivo: string };

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly despacho: DespachoService,
  ) {}

  /**
   * El guard inyecta el tenant solo, pero los tipos de Prisma lo exigen en el
   * `create`. Pedirlo explícito además falla ruidosamente si alguien llama a
   * esto fuera de un contexto de tenant, que sería un bug.
   */
  private tenantId(): string {
    const id = getCurrentTenantId();
    if (!id) throw new Error('Sin contexto de tenant.');
    return id;
  }

  /**
   * Deja lista una notificación para que la cola la mande.
   *
   * Devuelve por qué NO se encoló cuando corresponde. Quien llama no tiene que
   * hacer nada con eso más que, si quiere, loguearlo: el flujo de negocio
   * sigue igual.
   */
  async encolar(ctx: ContextoNotificacion): Promise<ResultadoEncolar> {
    try {
      return await this.intentarEncolar(ctx);
    } catch (error) {
      // Última red de D4: ni siquiera un error inesperado acá puede tumbar la
      // transición de estado que disparó la notificación.
      this.logger.error(
        `Falló al encolar ${ctx.evento} de ${ctx.entidadId}.`,
        error instanceof Error ? error.stack : String(error),
      );
      return { encolada: false, motivo: 'Error interno al encolar.' };
    }
  }

  private async intentarEncolar(
    ctx: ContextoNotificacion,
  ): Promise<ResultadoEncolar> {
    const plantilla = POR_EVENTO.get(ctx.evento);
    if (!plantilla) {
      return { encolada: false, motivo: `Evento desconocido: ${ctx.evento}.` };
    }

    const config = await this.prisma.configuracionNotificaciones.findFirst();
    if (config?.pausado) {
      return { encolada: false, motivo: 'Notificaciones pausadas.' };
    }

    if (!(await this.eventoActivo(ctx.evento))) {
      return { encolada: false, motivo: 'El evento está apagado.' };
    }

    if (plantilla.parametros.length !== ctx.parametros.length) {
      // Bug nuestro, no del tenant: se registra fuerte porque significa que un
      // punto de enganche quedó desalineado del catálogo.
      this.logger.error(
        `${ctx.evento} espera ${plantilla.parametros.length} parámetros y recibió ${ctx.parametros.length}.`,
      );
      return { encolada: false, motivo: 'Parámetros incompletos.' };
    }

    const cliente = ctx.clienteId
      ? await this.prisma.cliente.findFirst({ where: { id: ctx.clienteId } })
      : null;
    if (!cliente) {
      return { encolada: false, motivo: 'La operación no tiene cliente.' };
    }
    if (!cliente.aceptaWhatsapp) {
      return {
        encolada: false,
        motivo: 'El cliente no aceptó recibir WhatsApp.',
      };
    }

    // El teléfono se resuelve ACÁ y se guarda: si el cliente lo cambia después,
    // el mensaje sale al que estaba vigente cuando pasó el hecho.
    const tel = aE164(cliente);
    if (!tel.ok) return { encolada: false, motivo: tel.motivo };

    const claveUnica = `${ctx.evento}:${ctx.entidadId}`;
    try {
      const fila = await this.prisma.notificacionWhatsapp.create({
        data: {
          tenantId: this.tenantId(),
          evento: ctx.evento,
          estado: ESTADOS.pendiente,
          clienteId: cliente.id,
          ordenId: ctx.ordenId ?? null,
          cotizacionId: ctx.cotizacionId ?? null,
          claveUnica,
          telefono: tel.e164,
          plantilla: plantilla.codigo,
          parametros: ctx.parametros,
        },
      });
      // Se intenta mandar YA, sin esperar al cron. No se hace `await` a
      // propósito: quien cerró la orden no tiene por qué esperar a que Wati
      // conteste, y si esto falla la fila queda pendiente y el cron la levanta
      // dentro de cinco minutos.
      void this.despacho.despachar(fila.id).catch(() => undefined);
      return { encolada: true, id: fila.id };
    } catch (error) {
      // P2002 = ya existe una notificación para (evento, entidad). NO es un
      // error: es la idempotencia haciendo su trabajo. Reabrir un paso devuelve
      // una OT finalizada a producción, y sin esto "tu orden está lista" saldría
      // cada vez que alguien corrige algo.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { encolada: false, motivo: 'Ya se había notificado.' };
      }
      throw error;
    }
  }

  /**
   * Si el tenant nunca tocó el evento, vale el default del catálogo.
   *
   * Guardar sólo lo que tocó tiene una consecuencia buena: cuando Grafo agrega
   * un evento al catálogo, se enciende según lo que decidimos nosotros sin
   * backfillear una fila por tenant.
   */
  private async eventoActivo(evento: EventoNotificacion): Promise<boolean> {
    const fila = await this.prisma.notificacionEvento.findFirst({
      where: { evento },
    });
    return fila?.activo ?? POR_EVENTO.get(evento)?.activoPorDefecto ?? false;
  }

  // ── Configuración ────────────────────────────────────────────────────

  /** La config del tenant, creándola con los defaults si es la primera vez. */
  async configuracion() {
    const existente = await this.prisma.configuracionNotificaciones.findFirst();
    if (existente) return existente;
    return this.prisma.configuracionNotificaciones.create({
      data: { tenantId: this.tenantId() },
    });
  }

  /**
   * El catálogo con el estado de cada evento para este tenant: qué es, cuándo
   * se dispara y si está encendido.
   */
  async eventos() {
    const filas = await this.prisma.notificacionEvento.findMany();
    const porEvento = new Map(filas.map((f) => [f.evento, f.activo]));
    return CATALOGO.map((p) => ({
      evento: p.evento,
      titulo: p.titulo,
      cuando: p.cuando,
      categoria: p.categoria,
      codigo: p.codigo,
      activo: porEvento.get(p.evento) ?? p.activoPorDefecto,
      /** Si el tenant nunca lo tocó, muestra que está en el default. */
      porDefecto: !porEvento.has(p.evento),
    }));
  }

  async cambiarEvento(evento: EventoNotificacion, activo: boolean) {
    const plantilla = POR_EVENTO.get(evento);
    if (!plantilla) throw new Error(`Evento desconocido: ${evento}`);
    const existente = await this.prisma.notificacionEvento.findFirst({
      where: { evento },
    });
    if (existente) {
      return this.prisma.notificacionEvento.update({
        where: { id: existente.id },
        data: { activo },
      });
    }
    return this.prisma.notificacionEvento.create({
      data: { tenantId: this.tenantId(), evento, activo },
    });
  }

  async cambiarConfiguracion(datos: {
    pausado?: boolean;
    horaDesde?: string;
    horaHasta?: string;
  }) {
    const config = await this.configuracion();
    return this.prisma.configuracionNotificaciones.update({
      where: { id: config.id },
      data: datos,
    });
  }
}
