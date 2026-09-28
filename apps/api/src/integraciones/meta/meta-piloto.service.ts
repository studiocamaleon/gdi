import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { configuracionMetaPiloto } from './meta-piloto.config';
import { MetaCloudClient } from './meta-cloud.client';

@Injectable()
export class MetaPilotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: MetaCloudClient,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  async estado(tenantId: string) {
    const config = configuracionMetaPiloto();
    if (!tenantId || config?.tenantId !== tenantId) return null;
    const mensajes = await this.prisma.notificacionWhatsapp.findMany({
      where: { tenantId, canal: 'META_WHATSAPP', evento: 'meta_prueba' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        estado: true,
        estadoEntrega: true,
        estadoEntregaEl: true,
        motivo: true,
        createdAt: true,
        metaErrorCodigo: true,
      },
    });
    return { listo: config.listo, destinatario: config.destinatario, mensajes };
  }

  async enviarPrueba(tenantId: string, clave: string) {
    const config = configuracionMetaPiloto();
    if (!tenantId || config?.tenantId !== tenantId)
      throw new NotFoundException();
    if (!config.listo)
      throw new ServiceUnavailableException(
        'Falta completar la conexión de prueba con Meta.',
      );
    const claveUnica = `meta_prueba:${clave}`;
    let fila;
    try {
      // La clave se conserva en el navegador hasta recibir respuesta. El índice
      // único evita dos POST aun con clicks simultáneos o un reintento HTTP.
      fila = await this.prisma.$transaction(async (tx) => {
        await this.capacidades.exigirOperacionTx(tx, tenantId, [
          'whatsapp_automatico',
        ]);
        return tx.notificacionWhatsapp.create({
          data: {
            tenantId,
            claveUnica,
            evento: 'meta_prueba',
            canal: 'META_WHATSAPP',
            estado: 'enviando',
            reservadaEl: new Date(),
            intentos: 1,
            telefono: config.destinatario,
            plantilla: 'hello_world',
            parametros: [],
            metaPhoneNumberId: config.phoneNumberId,
          },
        });
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
      return this.estado(tenantId);
    }
    const result = await this.client.enviarPlantilla({
      accessToken: config.accessToken,
      phoneNumberId: config.phoneNumberId,
      telefono: config.destinatario,
      plantilla: 'hello_world',
      idioma: 'en_US',
      parametros: [],
      correlacion: fila.id,
    });
    const data =
      result.estado === 'aceptada'
        ? {
            estado: 'enviada',
            metaWamid: result.wamid,
            enviadaEl: new Date(),
            motivo: null,
          }
        : result.estado === 'fallida'
          ? {
              estado: 'fallida',
              metaErrorCodigo: result.codigo,
              motivo: `Meta rechazó el envío (código ${result.codigo}).`,
            }
          : {
              estado: 'meta_incierta',
              motivo:
                'No se pudo confirmar el envío. Revisá WhatsApp antes de crear otra prueba.',
            };
    // El webhook puede llegar ANTES que la respuesta del POST. No rebajarlo.
    await this.prisma.notificacionWhatsapp.updateMany({
      where: { id: fila.id, tenantId, estado: 'enviando', estadoEntrega: null },
      data,
    });
    return this.estado(tenantId);
  }
}
