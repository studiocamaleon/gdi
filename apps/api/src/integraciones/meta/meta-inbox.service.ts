import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentAuth } from '../../auth/auth.types';
import { WhatsappContextoService } from '../../clientes/whatsapp-contexto.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { configuracionMetaRecepcion } from './meta-recepcion';
import { MetaInboxQueryDto } from './meta-inbox.dto';

@Injectable()
export class MetaInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService,
    private readonly clientes: WhatsappContextoService,
  ) {}

  async consultar(auth: CurrentAuth, query: MetaInboxQueryDto) {
    const config = configuracionMetaRecepcion();
    if (!auth.tenantId || config?.tenantId !== auth.tenantId) return null;
    await this.capacidades.exigirIncluida(auth.tenantId, 'whatsapp_automatico');
    const puedeVerClientes = auth.permisos?.has('crm.ver') === true;
    if (query.clienteId && !puedeVerClientes)
      throw new ForbiddenException('No tenés permiso para consultar clientes.');

    const scope = {
      tenantId: auth.tenantId,
      wabaId: config.wabaId,
      phoneNumberId: config.phoneNumberId,
      remitente: config.destinatario,
    };
    // Un cursor ajeno no sirve ni para descubrir fechas o IDs de otro canal.
    const cursor = query.antesDe
      ? await this.prisma.mensajeWhatsappRecibido.findFirst({
          where: { ...scope, id: query.antesDe },
          select: { id: true, enviadoEl: true },
        })
      : null;
    if (query.antesDe && !cursor)
      throw new NotFoundException(
        'La página de mensajes ya no está disponible.',
      );

    const mensajes = await this.prisma.mensajeWhatsappRecibido.findMany({
      where: {
        ...scope,
        ...(cursor
          ? {
              OR: [
                { enviadoEl: { lt: cursor.enviadoEl } },
                { enviadoEl: cursor.enviadoEl, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ enviadoEl: 'desc' }, { id: 'desc' }],
      take: 51,
      select: {
        id: true,
        nombreContacto: true,
        tipo: true,
        texto: true,
        enviadoEl: true,
      },
    });
    const pagina = mensajes.slice(0, 50);
    const anterior = mensajes.length > 50 ? pagina[pagina.length - 1].id : null;
    const contexto = puedeVerClientes
      ? await this.clientes.contexto(auth, {
          telefono: config.destinatario,
          clienteId: query.clienteId,
        })
      : null;
    return {
      // Permite retirar la vista si se cambia de cuenta/empresa en otra pestaña.
      empresaId: auth.tenantId,
      usuarioId: auth.userId,
      contacto: { telefono: config.destinatario },
      mensajes: pagina.reverse(),
      anterior,
      contexto,
    };
  }
}
