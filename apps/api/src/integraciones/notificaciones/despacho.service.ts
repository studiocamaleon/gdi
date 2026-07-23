import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { IntegracionesService } from '../integraciones.service';
import { POR_EVENTO } from '../wati/catalogo';
import { WatiClient } from '../wati/wati.client';
import { ESTADOS } from './estados';

/**
 * Manda una notificación de la cola.
 *
 * Vive aparte del cron porque lo usan los dos, y ésa es la diferencia entre
 * "el cliente se entera enseguida" y "el cliente se entera en algún momento
 * de los próximos cinco minutos":
 *
 *  - Al terminar una orden se llama a `despachar` **en el acto**, sin esperar
 *    al cron.
 *  - El cron es la red: levanta lo que quedó pendiente porque el intento
 *    inmediato falló, porque el proceso se reinició justo, o porque cayó
 *    fuera de horario.
 *
 * El intento inmediato NO bloquea al operario. Se dispara y se olvida: la
 * orden se cierra igual de rápido aunque Wati esté lento o caído (D4).
 */

/** Cada cuántos intentos se rinde con una notificación. */
export const MAX_INTENTOS = 4;

/**
 * El sistema es argentino y no modelamos zona horaria por tenant, así que las
 * ventanas se evalúan en hora de Buenos Aires — no en la del servidor, que en
 * Render es UTC y las correría tres horas.
 */
const ZONA = 'America/Argentina/Buenos_Aires';

export type ResultadoDespacho =
  | { estado: 'enviada' }
  | { estado: 'reprogramada'; para: Date }
  | { estado: 'pendiente'; motivo: string }
  | { estado: 'fallida'; motivo: string }
  | { estado: 'descartada'; motivo: string }
  | { estado: 'nada' };

@Injectable()
export class DespachoService {
  private readonly logger = new Logger(DespachoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integraciones: IntegracionesService,
    private readonly wati: WatiClient,
  ) {}

  /**
   * Intenta mandar una notificación ya. Nunca lanza.
   *
   * Pensado para llamarse sin `await` desde el flujo de negocio: lo peor que
   * puede pasar es que quede pendiente y la levante el cron.
   */
  async despachar(id: string, ahora = new Date()): Promise<ResultadoDespacho> {
    try {
      return await this.intentar(id, ahora);
    } catch (error) {
      this.logger.error(
        `Falló el despacho de la notificación ${id}.`,
        error instanceof Error ? error.stack : String(error),
      );
      return { estado: 'pendiente', motivo: 'Error interno al despachar.' };
    }
  }

  private async intentar(id: string, ahora: Date): Promise<ResultadoDespacho> {
    const n = await this.prisma.notificacionWhatsapp.findFirst({
      where: { id, estado: ESTADOS.pendiente },
    });
    if (!n) return { estado: 'nada' };

    // Mismo criterio que al encolar: sin fila, apagado.
    const config = await this.prisma.configuracionNotificaciones.findFirst();
    if (config?.pausado ?? true) {
      return { estado: 'pendiente', motivo: 'Los avisos están pausados.' };
    }

    const plantilla = POR_EVENTO.get(n.evento as never);
    if (!plantilla) {
      await this.marcar(id, ESTADOS.descartada, {
        intentos: n.intentos + 1,
        motivo: `El evento ${n.evento} ya no existe en el catálogo.`,
      });
      return { estado: 'descartada', motivo: 'Evento fuera del catálogo.' };
    }

    // Fuera de ventana no se descarta: se corre. El aviso sigue sirviendo
    // mañana a las 9, y despertar a alguien a las 23:40 no.
    const proxima = proximaVentana(ahora, {
      horaDesde: config?.horaDesde ?? '09:00',
      horaHasta: config?.horaHasta ?? '20:00',
      diasAtencion: config?.diasAtencion ?? '1,2,3,4,5',
      requiereLocalAbierto: plantilla.requiereLocalAbierto ?? false,
    });
    if (proxima) {
      await this.prisma.notificacionWhatsapp.updateMany({
        where: { id },
        data: { programadaPara: proxima },
      });
      return { estado: 'reprogramada', para: proxima };
    }

    const cred = await this.integraciones.credencialesWati();
    if (!cred) {
      return { estado: 'pendiente', motivo: 'Wati no está conectada.' };
    }

    // Meta sólo entrega las aprobadas, y una puede pausarse por calidad sin
    // que nadie avise. Verificarlo acá da un motivo legible en vez de un
    // rechazo críptico de Wati.
    const remota = (await this.wati.listarPlantillas(cred)).find(
      (p) => p.nombre === n.plantilla,
    );
    if (remota?.estado !== 'APPROVED') {
      const intentos = n.intentos + 1;
      await this.marcar(id, ESTADOS.pendiente, {
        intentos,
        motivo: `La plantilla ${n.plantilla} está ${remota?.estado ?? 'sin crear'}.`,
        // Una plantilla en revisión se aprueba sola en horas.
        programadaPara: new Date(ahora.getTime() + 60 * 60 * 1000),
      });
      return { estado: 'pendiente', motivo: 'La plantilla no está aprobada.' };
    }

    const nombres = plantilla.parametros.map((p) => p.nombre);
    const valores = Array.isArray(n.parametros)
      ? (n.parametros as string[])
      : [];
    if (nombres.length !== valores.length) {
      // El catálogo cambió después de encolar: mandar así saldría con los
      // datos corridos de lugar, que es peor que no mandar.
      await this.marcar(id, ESTADOS.descartada, {
        intentos: n.intentos + 1,
        motivo: 'Los parámetros no coinciden con la plantilla actual.',
      });
      return { estado: 'descartada', motivo: 'Parámetros desalineados.' };
    }

    const res = await this.wati.enviarPlantilla(cred, {
      telefono: n.telefono,
      plantilla: n.plantilla,
      parametros: Object.fromEntries(nombres.map((x, i) => [x, valores[i]])),
      broadcastName: `grafo_${n.evento}`,
    });

    if (res.ok) {
      await this.marcar(id, ESTADOS.enviada, {
        intentos: n.intentos + 1,
        motivo: null,
        enviadaEl: new Date(),
        programadaPara: null,
      });
      return { estado: 'enviada' };
    }

    const intentos = n.intentos + 1;
    const agotado = intentos >= MAX_INTENTOS;
    await this.marcar(id, agotado ? ESTADOS.fallida : ESTADOS.pendiente, {
      intentos,
      motivo: res.motivo,
      // Backoff: cada intento espera el doble que el anterior.
      programadaPara: agotado
        ? null
        : new Date(ahora.getTime() + 2 ** intentos * 60 * 1000),
    });
    return agotado
      ? { estado: 'fallida', motivo: res.motivo }
      : { estado: 'pendiente', motivo: res.motivo };
  }

  private async marcar(
    id: string,
    estado: string,
    datos: {
      intentos: number;
      motivo?: string | null;
      enviadaEl?: Date;
      programadaPara?: Date | null;
    },
  ): Promise<void> {
    await this.prisma.notificacionWhatsapp.updateMany({
      where: { id },
      data: { estado, ...datos },
    });
  }
}

/**
 * Cuándo se puede mandar. `null` = ahora mismo.
 *
 * Son DOS reglas y responden preguntas distintas:
 *
 *  - **Horario de cortesía**, para todos: no se le escribe a nadie a las 23:40.
 *  - **Días de atención al público**, sólo para los mensajes que invitan al
 *    cliente a venir. Una imprenta puede producir un sábado y tener el local
 *    cerrado; avisarle "pasá a retirarla" ese día lo hace viajar al pedo.
 *
 * Se exporta suelta porque es aritmética pura y se prueba sin base ni red.
 */
export function proximaVentana(
  ahora: Date,
  reglas: {
    horaDesde: string;
    horaHasta: string;
    /** ISO: 1 = lunes … 7 = domingo. */
    diasAtencion: string;
    requiereLocalAbierto: boolean;
  },
): Date | null {
  const minutos = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const inicio = minutos(reglas.horaDesde);
  const fin = minutos(reglas.horaHasta);

  const dias = new Set(
    reglas.diasAtencion
      .split(',')
      .map((d) => Number(d.trim()))
      .filter((d) => d >= 1 && d <= 7),
  );
  // Si el evento no depende del local, todos los días sirven.
  const sirveElDia = (iso: number) =>
    !reglas.requiereLocalAbierto || dias.has(iso);

  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(ahora);
  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? 0);
  const minuto = Number(partes.find((p) => p.type === 'minute')?.value ?? 0);
  const actual = hora * 60 + minuto;
  const iso =
    ISO_POR_DIA[partes.find((p) => p.type === 'weekday')?.value ?? ''];

  if (sirveElDia(iso) && actual >= inicio && actual < fin) return null;

  // Cuánto falta hasta la próxima apertura útil. Se avanza día por día en vez
  // de calcularlo: son como mucho siete vueltas y no hay que razonar sobre
  // fines de semana largos ni sobre qué pasa si no hay ningún día habilitado.
  let faltan = actual < inicio ? inicio - actual : 24 * 60 - actual + inicio;
  let diaCandidato = actual < inicio ? iso : siguiente(iso);
  for (let i = 0; i < 8; i += 1) {
    if (sirveElDia(diaCandidato))
      return new Date(ahora.getTime() + faltan * 60_000);
    faltan += 24 * 60;
    diaCandidato = siguiente(diaCandidato);
  }
  // Ningún día habilitado: no se manda nunca. Es configuración imposible, y
  // dejarlo pendiente es preferible a mandarlo cuando el local está cerrado.
  return new Date(ahora.getTime() + 24 * 60 * 60_000);
}

const ISO_POR_DIA: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const siguiente = (iso: number) => (iso % 7) + 1;
