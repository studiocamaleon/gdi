import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
import type { CurrentAuth } from '../../auth/auth.types';
import type { ResolverAvisoDto } from './notificaciones.dto';
import { CANAL_WEB, esOrdenWeb, textoWhatsappWeb } from './whatsapp-web-texto';

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
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
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
      const resultado = await this.prisma.$transaction((tx) =>
        this.intentarEncolar(ctx, tx),
      );
      // El envío sólo puede comenzar después de confirmar la fila de la cola.
      if (resultado.encolada)
        void this.despacho.despachar(resultado.id).catch(() => undefined);
      return resultado;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      )
        return { encolada: false, motivo: error.message };
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return { encolada: false, motivo: 'Ya se había notificado.' };
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
    tx: Prisma.TransactionClient,
  ): Promise<ResultadoEncolar> {
    const tenantId = this.tenantId();
    await this.capacidades.exigirOperacionTx(tx, tenantId, ['identidad']);
    const plantilla = POR_EVENTO.get(ctx.evento);
    if (!plantilla) {
      return { encolada: false, motivo: `Evento desconocido: ${ctx.evento}.` };
    }

    // `?? true` y no `?? false`: si el tenant nunca abrió la pantalla no hay
    // fila, y "sin configurar" tiene que significar apagado. Al revés,
    // conectar Wati empezaría a escribirle a todos los clientes sin que nadie
    // lo haya decidido.
    const config = await tx.configuracionNotificaciones.findFirst({
      where: { tenantId },
    });
    const capacidad =
      config?.canalOrdenes === CANAL_WEB && esOrdenWeb(ctx.evento)
        ? 'whatsapp_web'
        : 'whatsapp_automatico';
    await this.capacidades.exigirOperacionTx(
      tx,
      tenantId,
      [capacidad],
      [capacidad],
    );
    if (config?.pausado ?? true) {
      return { encolada: false, motivo: 'Los avisos están pausados.' };
    }

    if (!(await this.eventoActivo(ctx.evento, tx))) {
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
      ? await tx.cliente.findFirst({ where: { id: ctx.clienteId, tenantId } })
      : null;
    if (!cliente) {
      return { encolada: false, motivo: 'La operación no tiene cliente.' };
    }
    // Consentimiento proporcionado a lo que se manda.
    //
    // Wati no exige opt-in —manda a cualquier número— pero la política de Meta
    // sí lo pide, y el castigo es indirecto: la gente bloquea, baja la calidad
    // del número, Meta pausa plantillas. Lo que la gente bloquea es el
    // marketing, no el aviso de su propia orden.
    //
    // Por eso: un cliente al que nunca se le preguntó recibe lo transaccional
    // y no el marketing. Uno que pidió no recibir no recibe NADA — eso se
    // respeta siempre, es lo único que no admite matices.
    if (cliente.aceptaWhatsapp === false) {
      return {
        encolada: false,
        motivo: 'El cliente pidió no recibir WhatsApp.',
      };
    }
    if (
      plantilla.categoria === 'MARKETING' &&
      cliente.aceptaWhatsapp !== true
    ) {
      return {
        encolada: false,
        motivo: 'Es un mensaje promocional y el cliente no lo aceptó.',
      };
    }

    // El teléfono se resuelve ACÁ y se guarda: si el cliente lo cambia después,
    // el mensaje sale al que estaba vigente cuando pasó el hecho.
    const tel = aE164(cliente);
    if (!tel.ok) return { encolada: false, motivo: tel.motivo };

    const claveUnica = `${ctx.evento}:${ctx.entidadId}`;
    const fila = await tx.notificacionWhatsapp.create({
      data: {
        tenantId,
        evento: ctx.evento,
        estado: ESTADOS.pendiente,
        clienteId: cliente.id,
        ordenId: ctx.ordenId ?? null,
        cotizacionId: ctx.cotizacionId ?? null,
        claveUnica,
        telefono: tel.e164,
        plantilla: plantilla.codigo,
        parametros: ctx.parametros,
        ...(config?.canalOrdenes === CANAL_WEB && esOrdenWeb(ctx.evento)
          ? {
              canal: CANAL_WEB,
              textoWeb: textoWhatsappWeb(ctx.evento, ctx.parametros),
            }
          : {}),
      },
    });
    return { encolada: true, id: fila.id };
  }

  /**
   * Si el tenant nunca tocó el evento, vale el default del catálogo.
   *
   * Guardar sólo lo que tocó tiene una consecuencia buena: cuando Grafo agrega
   * un evento al catálogo, se enciende según lo que decidimos nosotros sin
   * backfillear una fila por tenant.
   */
  private async eventoActivo(
    evento: EventoNotificacion,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const fila = await tx.notificacionEvento.findFirst({
      where: { tenantId: this.tenantId(), evento },
    });
    return fila?.activo ?? POR_EVENTO.get(evento)?.activoPorDefecto ?? false;
  }

  // ── Configuración ────────────────────────────────────────────────────

  /** Consultar no crea configuración ni reactiva una empresa en sólo lectura. */
  async configuracion() {
    const tenantId = this.tenantId();
    return (
      (await this.prisma.configuracionNotificaciones.findFirst({
        where: { tenantId },
      })) ?? {
        tenantId,
        pausado: true,
        horaDesde: '09:00',
        horaHasta: '20:00',
        diasAtencion: '1,2,3,4,5',
        resenaDiasDespues: 3,
        canalOrdenes: 'WATI',
      }
    );
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
      /** false = todavía no hay nada que lo dispare. La UI lo deshabilita. */
      cableado: p.cableado ?? false,
      /** Si el tenant nunca lo tocó, muestra que está en el default. */
      porDefecto: !porEvento.has(p.evento),
    }));
  }

  async cambiarEvento(evento: EventoNotificacion, activo: boolean) {
    const plantilla = POR_EVENTO.get(evento);
    if (!plantilla) throw new Error(`Evento desconocido: ${evento}`);
    const tenantId = this.tenantId();
    return this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(tx, tenantId, ['identidad']);
      if (activo) {
        const config = await tx.configuracionNotificaciones.findFirst({
          where: { tenantId },
        });
        const capacidad =
          config?.canalOrdenes === CANAL_WEB && esOrdenWeb(evento)
            ? 'whatsapp_web'
            : 'whatsapp_automatico';
        await this.capacidades.exigirOperacionTx(
          tx,
          tenantId,
          [capacidad],
          [capacidad],
        );
      }
      return tx.notificacionEvento.upsert({
        where: { tenantId_evento: { tenantId, evento } },
        create: { tenantId, evento, activo },
        update: { activo },
      });
    });
  }

  async cambiarConfiguracion(datos: {
    pausado?: boolean;
    horaDesde?: string;
    horaHasta?: string;
    diasAtencion?: string;
    resenaDiasDespues?: number;
  }) {
    const tenantId = this.tenantId();
    return this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(tx, tenantId, ['identidad']);
      const config = await tx.configuracionNotificaciones.findFirst({
        where: { tenantId },
      });
      if (datos.pausado !== true) {
        const capacidad =
          config?.canalOrdenes === CANAL_WEB
            ? 'whatsapp_web'
            : 'whatsapp_automatico';
        await this.capacidades.exigirOperacionTx(
          tx,
          tenantId,
          [capacidad],
          datos.pausado === false ? [capacidad] : [],
        );
      }
      return tx.configuracionNotificaciones.upsert({
        where: { tenantId },
        create: { tenantId, ...datos },
        update: datos,
      });
    });
  }

  /**
   * Las últimas notificaciones, con el nombre del cliente resuelto.
   *
   * Es el "log de mensajes" del diseño y sale gratis de la misma tabla que
   * hace de cola. Incluye lo descartado con su motivo: la pregunta que se le
   * hace a esta pantalla es "¿por qué a este cliente no le llegó nada?", y sin
   * los descartes no tiene respuesta.
   */
  async log(limite = 100) {
    const filas = await this.prisma.notificacionWhatsapp.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limite, 500),
    });

    const ids = [...new Set(filas.map((f) => f.clienteId).filter(Boolean))];
    const clientes = ids.length
      ? await this.prisma.cliente.findMany({
          where: { id: { in: ids as string[] } },
          select: { id: true, razonSocial: true },
        })
      : [];
    const nombre = new Map(clientes.map((c) => [c.id, c.razonSocial]));

    return filas.map((f) => ({
      id: f.id,
      canal: f.canal,
      evento: f.evento,
      titulo: POR_EVENTO.get(f.evento as never)?.titulo ?? f.evento,
      estado: f.estado,
      cliente: f.clienteId ? (nombre.get(f.clienteId) ?? null) : null,
      telefono: f.telefono,
      motivo: f.motivo,
      intentos: f.intentos,
      programadaPara: f.programadaPara,
      enviadaEl: f.enviadaEl,
      createdAt: f.createdAt,
    }));
  }

  async resolver(auth: CurrentAuth, id: string, dto: ResolverAvisoDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(tx, auth.tenantId, [
        'identidad',
      ]);
      const n = await tx.notificacionWhatsapp.findFirst({
        where: { id, tenantId: auth.tenantId },
      });
      if (!n) throw new NotFoundException('No se encontró el aviso.');
      const incierta = ['wati_incierta', 'web_incierta'].includes(n.estado);
      const cerrable =
        ['pendiente', 'wati_reservada', 'web_reservada', 'fallida'].includes(
          n.estado,
        ) || incierta;
      if (
        n.estado !== dto.estadoEsperado ||
        !cerrable ||
        (dto.accion === 'confirmar_enviada' && !incierta)
      )
        throw new ConflictException(
          'El aviso cambió o tiene un envío en curso. Actualizá su estado antes de resolverlo.',
        );
      const motivo = dto.motivo.trim();
      if (motivo.length < 5)
        throw new ConflictException('Indicá el motivo de la resolución.');
      const estado =
        dto.accion === 'confirmar_enviada' ? 'enviada' : 'descartada';
      const actorUserId = auth.impersonacion?.actorUserId ?? auth.userId;
      const actor = await tx.user.findUnique({
        where: { id: actorUserId },
        select: { nombreCompleto: true, email: true },
      });
      const actorNombre =
        auth.impersonacion?.actorNombre ??
        actor?.nombreCompleto ??
        actor?.email ??
        auth.email;
      const cambio = await tx.notificacionWhatsapp.updateMany({
        where: {
          id,
          tenantId: auth.tenantId,
          estado: dto.estadoEsperado,
          reservaToken: n.reservaToken,
        },
        data: {
          estado,
          reservaToken: null,
          reservadaEl: null,
          programadaPara: null,
          enviadaEl: estado === 'enviada' ? new Date() : n.enviadaEl,
          motivo: `${estado === 'enviada' ? 'Confirmado' : 'Descartado'} por ${actorNombre}: ${motivo}${n.motivo ? ` · Antecedente: ${n.motivo}` : ''}`,
        },
      });
      if (!cambio.count)
        throw new ConflictException(
          'El aviso cambió mientras lo resolvías. Actualizá el historial.',
        );
      await tx.eventoSistema.create({
        data: {
          tenantId: auth.tenantId,
          tipo: 'aviso.resuelto',
          entidadTipo: 'notificacion_whatsapp',
          entidadId: id,
          actorUserId,
          actorNombre: actorNombre.slice(0, 200),
          titulo:
            estado === 'enviada'
              ? 'Aviso confirmado manualmente'
              : 'Aviso descartado',
          mensaje: `${n.estado} → ${estado}: ${motivo}`.slice(0, 600),
          topicos: [],
        },
      });
      return { ok: true };
    });
  }

  /**
   * Cuántos clientes hay en cada estado de consentimiento. La UI lo necesita
   * para poder decir "3 clientes pidieron no recibir" sin que haya que ir a
   * buscarlos de a uno.
   */
  async resumenConsentimiento() {
    const [total, aceptaron, rechazaron] = await Promise.all([
      this.prisma.cliente.count(),
      this.prisma.cliente.count({ where: { aceptaWhatsapp: true } }),
      this.prisma.cliente.count({ where: { aceptaWhatsapp: false } }),
    ]);
    return {
      total,
      aceptaron,
      rechazaron,
      sinPreguntar: total - aceptaron - rechazaron,
    };
  }
}
