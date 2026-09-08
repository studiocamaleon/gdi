import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { regionalDelTenant } from '../../common/regional';
import { proximaVentana } from '../notificaciones/despacho.service';
import { CANAL_WEB, EVENTOS_WEB } from '../notificaciones/whatsapp-web-texto';
import { POR_EVENTO } from '../wati/catalogo';
import type {
  ConfigurarWebDto,
  DispositivoWebDto,
  ReservaWebDto,
  ResultadoWebDto,
} from './automaticos.dto';

@Injectable()
export class AutomaticosWebService {
  constructor(private readonly prisma: PrismaService) {}
  private validarTenant(tenantId: string, dto: DispositivoWebDto) {
    if (tenantId !== dto.tenantId)
      throw new ForbiddenException(
        'La sesión cambió de empresa. Volvé a conectar los avisos.',
      );
  }
  async estado(tenantId: string) {
    const [config, ultimos] = await Promise.all([
      this.prisma.configuracionNotificaciones.findFirst({
        where: { tenantId },
      }),
      this.prisma.notificacionWhatsapp.findMany({
        where: { tenantId, canal: CANAL_WEB },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          evento: true,
          estado: true,
          telefono: true,
          motivo: true,
          enviadaEl: true,
        },
      }),
    ]);
    return {
      tenantId,
      modo: config?.canalOrdenes ?? 'WATI',
      dispositivoId: config?.whatsappWebDispositivoId ?? null,
      numero: config?.whatsappWebNumero ?? null,
      pausado: config?.pausado ?? true,
      ultimos,
    };
  }
  async configurar(tenantId: string, dto: ConfigurarWebDto) {
    this.validarTenant(tenantId, dto);
    await this.prisma.$transaction(async (tx) => {
      // Bloquea la misma fila que iniciar(): una pausa no puede adelantarse
      // silenciosamente a un envío ya autorizado. Los envíos en curso terminan.
      await tx.configuracionNotificaciones.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
      });
      await tx.$queryRaw`SELECT "id" FROM "ConfiguracionNotificaciones" WHERE "tenantId" = ${tenantId}::uuid FOR UPDATE`;
      await tx.configuracionNotificaciones.updateMany({
        where: { tenantId },
        data: {
          canalOrdenes: dto.modo === 'WATI' ? 'WATI' : CANAL_WEB,
          whatsappWebDispositivoId:
            dto.modo === CANAL_WEB ? dto.dispositivoId : null,
          whatsappWebNumero: dto.numero,
          whatsappWebDesde: new Date(),
        },
      });
      if (dto.modo === CANAL_WEB)
        for (const evento of EVENTOS_WEB) {
          await tx.notificacionEvento.upsert({
            where: { tenantId_evento: { tenantId, evento } },
            create: { tenantId, evento, activo: true },
            update: { activo: true },
          });
        }
    });
    return this.estado(tenantId);
  }
  private async configActiva(tenantId: string, dto: DispositivoWebDto) {
    this.validarTenant(tenantId, dto);
    const c = await this.prisma.configuracionNotificaciones.findFirst({
      where: { tenantId },
    });
    if (
      !c ||
      c.pausado ||
      c.canalOrdenes !== CANAL_WEB ||
      c.whatsappWebDispositivoId !== dto.dispositivoId ||
      c.whatsappWebNumero !== dto.numero
    )
      return null;
    return c;
  }
  async prueba(tenantId: string, dto: DispositivoWebDto) {
    if (!(await this.configActiva(tenantId, dto)))
      throw new ConflictException(
        'Activá los avisos en este equipo antes de probar.',
      );
    await this.prisma.notificacionWhatsapp.create({
      data: {
        tenantId,
        evento: 'prueba_extension',
        canal: CANAL_WEB,
        claveUnica: `prueba_extension:${randomUUID()}`,
        telefono: dto.numero,
        plantilla: 'prueba_extension',
        parametros: [],
        textoWeb:
          'Prueba de Grafo. Este mensaje salió automáticamente desde la extensión de Chrome, sin WATI.',
      },
    });
    return { ok: true };
  }

  async reservar(tenantId: string, dto: DispositivoWebDto) {
    const config = await this.configActiva(tenantId, dto);
    if (!config) return { trabajo: null };
    const ahora = new Date();
    // Una reserva que nunca llegó a iniciar se puede recuperar. Una iniciada
    // se considera incierta: reenviarla tras un corte podría duplicarla.
    await this.prisma.notificacionWhatsapp.updateMany({
      where: {
        tenantId,
        canal: CANAL_WEB,
        estado: 'web_reservada',
        reservadaEl: { lt: new Date(+ahora - 120_000) },
      },
      data: { estado: 'pendiente', reservaToken: null, reservadaEl: null },
    });
    await this.prisma.notificacionWhatsapp.updateMany({
      where: {
        tenantId,
        canal: CANAL_WEB,
        estado: 'web_enviando',
        reservadaEl: { lt: new Date(+ahora - 600_000) },
      },
      data: {
        estado: 'web_incierta',
        motivo:
          'Se interrumpió la confirmación. No se reenvía automáticamente para evitar duplicados.',
      },
    });
    const filas = await this.prisma.notificacionWhatsapp.findMany({
      where: {
        tenantId,
        canal: CANAL_WEB,
        estado: 'pendiente',
        OR: [{ programadaPara: null }, { programadaPara: { lte: ahora } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
    const { zonaHoraria } = await regionalDelTenant(this.prisma, tenantId);
    for (const fila of filas) {
      const plantilla = POR_EVENTO.get(fila.evento as never);
      const prueba =
        fila.evento === 'prueba_extension' && fila.telefono === dto.numero;
      if ((!plantilla && !prueba) || !fila.textoWeb) continue;
      const proxima = prueba
        ? null
        : proximaVentana(ahora, {
            ...config,
            requiereLocalAbierto: plantilla?.requiereLocalAbierto ?? false,
            zona: zonaHoraria,
          });
      if (proxima) {
        await this.prisma.notificacionWhatsapp.updateMany({
          where: { id: fila.id, tenantId, estado: 'pendiente' },
          data: { programadaPara: proxima },
        });
        continue;
      }
      const token = randomUUID();
      const tomada = await this.prisma.notificacionWhatsapp.updateMany({
        where: { id: fila.id, tenantId, canal: CANAL_WEB, estado: 'pendiente' },
        data: {
          estado: 'web_reservada',
          reservadaEl: ahora,
          reservaToken: token,
        },
      });
      if (tomada.count === 1) return { trabajo: { id: fila.id, token } };
    }
    return { trabajo: null };
  }
  async iniciar(tenantId: string, id: string, dto: ReservaWebDto) {
    this.validarTenant(tenantId, dto);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ConfiguracionNotificaciones" WHERE "tenantId" = ${tenantId}::uuid FOR UPDATE`;
      const c = await tx.configuracionNotificaciones.findFirst({
        where: { tenantId },
      });
      if (
        !c ||
        c.pausado ||
        c.canalOrdenes !== CANAL_WEB ||
        c.whatsappWebDispositivoId !== dto.dispositivoId ||
        c.whatsappWebNumero !== dto.numero
      )
        throw new ConflictException(
          'Los envíos están pausados o cambió el equipo emisor.',
        );
      const n = await tx.notificacionWhatsapp.findFirst({
        where: {
          id,
          tenantId,
          canal: CANAL_WEB,
          estado: 'web_reservada',
          reservaToken: dto.token,
          reservadaEl: { gte: new Date(Date.now() - 120_000) },
        },
      });
      if (!n || !n.textoWeb)
        throw new ConflictException('La reserva venció o ya se utilizó.');
      const [cliente, evento] = await Promise.all([
        n.clienteId
          ? tx.cliente.findFirst({
              where: { id: n.clienteId, tenantId },
              select: { aceptaWhatsapp: true },
            })
          : null,
        tx.notificacionEvento.findFirst({
          where: { tenantId, evento: n.evento },
        }),
      ]);
      const prueba =
        n.evento === 'prueba_extension' && n.telefono === dto.numero;
      if (
        !prueba &&
        (!cliente ||
          cliente.aceptaWhatsapp === false ||
          evento?.activo === false)
      ) {
        await tx.notificacionWhatsapp.updateMany({
          where: {
            id,
            tenantId,
            estado: 'web_reservada',
            reservaToken: dto.token,
          },
          data: {
            estado: 'descartada',
            motivo: 'El cliente o el evento dejó de admitir avisos.',
          },
        });
        return { trabajo: null };
      }
      const { zonaHoraria } = await regionalDelTenant(this.prisma, tenantId);
      const proxima = prueba
        ? null
        : proximaVentana(new Date(), {
            ...c,
            requiereLocalAbierto:
              POR_EVENTO.get(n.evento as never)?.requiereLocalAbierto ?? false,
            zona: zonaHoraria,
          });
      if (proxima) {
        await tx.notificacionWhatsapp.updateMany({
          where: {
            id,
            tenantId,
            estado: 'web_reservada',
            reservaToken: dto.token,
          },
          data: {
            estado: 'pendiente',
            programadaPara: proxima,
            reservaToken: null,
            reservadaEl: null,
          },
        });
        return { trabajo: null };
      }
      const tomada = await tx.notificacionWhatsapp.updateMany({
        where: {
          id,
          tenantId,
          estado: 'web_reservada',
          reservaToken: dto.token,
        },
        data: {
          estado: 'web_enviando',
          reservadaEl: new Date(),
          intentos: { increment: 1 },
        },
      });
      if (tomada.count !== 1)
        throw new ConflictException('La reserva ya se utilizó.');
      return {
        trabajo: {
          id,
          telefono: n.telefono,
          texto: n.textoWeb,
          numeroEmisor: dto.numero,
        },
      };
    });
  }
  async resultado(tenantId: string, id: string, dto: ResultadoWebDto) {
    this.validarTenant(tenantId, dto);
    const estado =
      dto.estado === 'incierta'
        ? 'web_incierta'
        : dto.estado === 'no_enviada'
          ? 'pendiente'
          : 'enviada';
    if (dto.estado === 'enviada' && !dto.mensajeId)
      throw new ConflictException('Falta la confirmación de WhatsApp.');
    const res = await this.prisma.notificacionWhatsapp.updateMany({
      where: {
        id,
        tenantId,
        canal: CANAL_WEB,
        reservaToken: dto.token,
        estado: { in: ['web_enviando', 'web_incierta'] },
      },
      data: {
        estado,
        mensajeWebId: dto.mensajeId ?? null,
        motivo: dto.motivo ?? null,
        enviadaEl: estado === 'enviada' ? new Date() : null,
        ...(estado === 'pendiente'
          ? { reservadaEl: null, programadaPara: new Date(Date.now() + 60_000) }
          : {}),
      },
    });
    // Es idempotente: se puede confirmar otra vez si se perdió la respuesta HTTP.
    if (!res.count) {
      const actual = await this.prisma.notificacionWhatsapp.findFirst({
        where: { id, tenantId, canal: CANAL_WEB, reservaToken: dto.token },
      });
      if (actual?.estado !== estado)
        throw new ConflictException('No se pudo confirmar ese intento.');
    }
    return { ok: true };
  }
}
