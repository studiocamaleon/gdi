import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithTenant } from '../../common/tenant-context';
import { IntegracionesService } from '../integraciones.service';
import { ESTADOS } from '../notificaciones/estados';
import { WatiClient } from './wati.client';

@Injectable()
export class WatiEntregaService {
  private readonly logger = new Logger(WatiEntregaService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly integraciones: IntegracionesService,
    private readonly wati: WatiClient,
  ) {}

  /** No envía ni reintenta. Cada campaña contiene un único intento reservado. */
  async revisarTenant(tenantId: string, ahora = new Date()): Promise<void> {
    return runWithTenant(tenantId, async () => {
      const desde = new Date(ahora.getTime() - 7 * 86400_000);
      const filas = await this.prisma.notificacionWhatsapp.findMany({
        where: {
          tenantId,
          canal: 'WATI',
          reservaToken: { not: null },
          estado: { in: [ESTADOS.aceptada, ESTADOS.enviada] },
          estadoEntrega: { in: ['aceptado', 'enviado'] },
          estadoEntregaEl: { gte: desde },
        },
        orderBy: { watiConsultaEl: { sort: 'asc', nulls: 'first' } },
        take: 25,
      });
      if (!filas.length) return;
      const cred = await this.integraciones.credencialesWati();
      if (!cred) return;
      // Rotación incluso ante un error de red: una fila no monopoliza el barrido.
      await this.prisma.notificacionWhatsapp.updateMany({
        where: { tenantId, id: { in: filas.map((f) => f.id) } },
        data: { watiConsultaEl: ahora },
      });
      try {
        const campanias = new Map<string, string>();
        for (let pagina = 1; pagina <= 5; pagina++) {
          const data = await this.wati.listarCampanias(
            cred,
            desde,
            ahora,
            pagina,
          );
          const lista = data.broadcasts ?? [];
          for (const c of lista) {
            // Dos campañas con igual nombre no son evidencia inequívoca.
            campanias.set(c.name, campanias.has(c.name) ? '' : c.id);
          }
          if (
            lista.length < 100 ||
            (data.total != null && pagina * 100 >= data.total)
          )
            break;
        }
        for (const f of filas) {
          const id = campanias.get(`grafo_${f.reservaToken}`);
          if (!id) continue;
          const data = await this.wati.destinatariosCampania(cred, id);
          const receptores = (data.recipients ?? []).filter(
            (r) =>
              r.contact_phone.replace(/^\+/, '') ===
                f.telefono.replace(/^\+/, '') &&
              (!f.watiMensajeId || r.local_message_id === f.watiMensajeId),
          );
          if (receptores.length !== 1) continue;
          const receptor = receptores[0];
          const estado = (
            {
              sent: 'enviado',
              delivered: 'entregado',
              read: 'leido',
              replied: 'leido',
              failed: 'fallido',
            } as Record<string, string>
          )[receptor.status.toLowerCase()];
          if (!estado) continue;
          // Una confirmación de salida no puede convertirse luego en reenvío.
          if (estado === 'fallido' && f.estadoEntrega !== 'aceptado') continue;
          const fallo = estado === 'fallido';
          const codigo = /^\d{1,10}$/.test(receptor.failed_code ?? '')
            ? ` Código ${receptor.failed_code}.`
            : '';
          await this.prisma.notificacionWhatsapp.updateMany({
            where: {
              id: f.id,
              tenantId,
              canal: 'WATI',
              reservaToken: f.reservaToken,
              estado: f.estado,
              estadoEntrega: f.estadoEntrega,
            },
            data: {
              estado: fallo ? ESTADOS.fallida : ESTADOS.enviada,
              estadoEntrega: estado,
              estadoEntregaEl: ahora,
              enviadaEl: fallo ? null : (f.enviadaEl ?? ahora),
              motivo: fallo
                ? `Wati confirmó que el mensaje falló.${codigo} Podés reintentar desde el historial.`
                : null,
            },
          });
        }
      } catch {
        // Un timeout, una falta de permisos o un resultado ausente NO son fallos de entrega.
        this.logger.warn(
          'No se pudo actualizar la entrega de avisos de Wati; se conserva el último estado confirmado.',
        );
      }
    });
  }
}
