import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { configuracionMetaRecepcion } from './meta-recepcion';

@Injectable()
export class MetaRecepcionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  async listar(tenantId: string) {
    const config = configuracionMetaRecepcion();
    if (!tenantId || config?.tenantId !== tenantId) return null;
    // Lectura permitida con suscripción en sólo lectura si aún incluye la
    // capacidad. No se convierte esta consulta en un permiso de envío.
    await this.capacidades.exigirIncluida(tenantId, 'whatsapp_automatico');
    const scope = {
      tenantId,
      wabaId: config.wabaId,
      phoneNumberId: config.phoneNumberId,
      remitente: config.destinatario,
    };
    const mensajes = await this.prisma.mensajeWhatsappRecibido.findMany({
      where: scope,
      orderBy: [{ enviadoEl: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        remitente: true,
        nombreContacto: true,
        tipo: true,
        texto: true,
        enviadoEl: true,
      },
    });
    return { contacto: config.destinatario, mensajes };
  }
}
