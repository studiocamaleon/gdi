import { exigirAccesoConexionMeta } from './meta-conexion-acceso';
import { MetaInboxGeneralService } from './meta-inbox-general.service';
import { lecturaGeneralHabilitada } from './meta-inbox-canal';
import {
  BadRequestException,
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
    private readonly general: MetaInboxGeneralService,
  ) {}

  /** Disponibilidad de lectura del piloto, no un chequeo de salud de Meta.
   * Exige una recepción validada en el canal actual; no basta con cargar claves.
   * El menú sólo necesita esta señal, nunca el contenido de los mensajes. */
  async disponibilidad(auth: CurrentAuth, ip = '') {
    if (lecturaGeneralHabilitada())
      return this.general.disponibilidad(auth, ip);
    await exigirAccesoConexionMeta(this.prisma, auth, ip);
    const identidad = { empresaId: auth.tenantId, usuarioId: auth.userId };
    const config = configuracionMetaRecepcion();
    if (!auth.tenantId || config?.tenantId !== auth.tenantId)
      return { ...identidad, disponible: false };
    await this.capacidades.exigirIncluida(auth.tenantId, 'whatsapp_automatico');
    const comprobante = await this.prisma.mensajeWhatsappRecibido.findFirst({
      where: {
        tenantId: auth.tenantId,
        wabaId: config.wabaId,
        phoneNumberId: config.phoneNumberId,
        remitente: config.destinatario,
      },
      select: { id: true },
    });
    return { ...identidad, disponible: Boolean(comprobante) };
  }

  async consultar(auth: CurrentAuth, query: MetaInboxQueryDto, ip = '') {
    if (lecturaGeneralHabilitada())
      return this.general.consultar(auth, query, ip);
    await exigirAccesoConexionMeta(this.prisma, auth, ip);
    if (
      query.conversacionId ||
      query.desdeId ||
      query.busqueda ||
      query.listaAntesDe
    )
      throw new BadRequestException(
        'Esta consulta no está disponible en el piloto.',
      );
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
