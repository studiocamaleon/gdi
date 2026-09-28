import { ConflictException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithTenant } from '../../common/tenant-context';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { registrarCambioInbox } from '../../inbox-tiempo-real/inbox-revision';
import { SecretosService } from '../cripto/secretos.service';
import { MetaConexionClient } from './meta-conexion.client';
import { configuracionCanalPrueba } from './meta-prueba.config';

/** Operación de servidor, sin controller ni endpoint público. Cada activación
 * acredita de nuevo token/activos/suscripción en Graph y crea una generación.
 * No inventa una autorización Embedded Signup ni una solicitud de historial. */
export class MetaPruebaService {
  constructor(
    private readonly db: PrismaService,
    private readonly secretos: SecretosService,
    private readonly client: MetaConexionClient,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  async activar(accessToken: string) {
    const config = configuracionCanalPrueba();
    if (!config || !this.secretos.disponible || !accessToken)
      throw new ForbiddenException('El canal de prueba no está preparado.');
    return runWithTenant(config.tenantId, async () => {
      const anterior = await this.db.metaVinculo.findFirst({
        where: { tenantId: config.tenantId },
      });
      if (
        anterior &&
        (anterior.tipo !== 'PRUEBA' ||
          anterior.wabaId !== config.wabaId ||
          anterior.phoneNumberId !== config.phoneNumberId ||
          anterior.pruebaDestinatarioWaId !== config.destinatario)
      )
        throw new ConflictException('Existe otro canal. No se reemplazó.');
      const activos = await this.client.verificarPrueba(
        {
          appId: process.env.META_APP_ID ?? '',
          appSecret: process.env.META_APP_SECRET ?? '',
          graphVersion: process.env.META_GRAPH_API_VERSION ?? 'v26.0',
          configId: '',
        },
        accessToken,
        config,
      );
      if (
        !activos.tokenVenceEl ||
        activos.tokenVenceEl <= new Date() ||
        activos.wabaId !== config.wabaId ||
        activos.phoneNumberId !== config.phoneNumberId
      )
        throw new ConflictException('La credencial no acredita este canal.');
      return this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${config.tenantId}::uuid FOR NO KEY UPDATE`;
        await this.capacidades.exigirOperacionTx(tx, config.tenantId, [
          'whatsapp_automatico',
        ]);
        await tx.$queryRaw`SELECT id FROM "MetaVinculo" WHERE "tenantId"=${config.tenantId}::uuid FOR NO KEY UPDATE`;
        const actual = await tx.metaVinculo.findFirst({
          where: { tenantId: config.tenantId },
        });
        if (
          actual?.autorizacionId !== anterior?.autorizacionId ||
          (actual &&
            (actual.tipo !== 'PRUEBA' ||
              actual.wabaId !== config.wabaId ||
              actual.phoneNumberId !== config.phoneNumberId ||
              actual.pruebaDestinatarioWaId !== config.destinatario)) ||
          JSON.stringify(configuracionCanalPrueba()) !==
            JSON.stringify(config) ||
          activos.tokenVenceEl! <= new Date()
        )
          throw new ConflictException(
            'El canal cambió durante la comprobación.',
          );
        if (
          await tx.inboxEnvio.count({
            where: {
              tenantId: config.tenantId,
              estado: { in: ['ENVIANDO', 'INCIERTO'] },
            },
          })
        )
          throw new ConflictException(
            'Revisá los envíos pendientes antes de renovar el canal.',
          );
        const desde = new Date();
        const datos = {
          ...activos,
          tipo: 'PRUEBA',
          pruebaDestinatarioWaId: config.destinatario,
          pruebaDestinoE164: config.destinoE164,
          tokenCifrado: this.secretos.cifrar(
            accessToken,
          ) as Prisma.InputJsonValue,
          autorizacionId: randomUUID(),
          estado: 'VERIFICADO' as const,
          verificadoEl: desde,
          recepcionDesdeEl: desde,
          desconectadoEl: null,
          ultimoCambioCuentaEl: null,
          ultimoEventoCuenta: null,
        };
        const canal = actual
          ? await tx.metaVinculo.update({
              where: { id: actual.id, tenantId: config.tenantId },
              data: datos,
            })
          : await tx.metaVinculo.create({
              data: { ...datos, tenantId: config.tenantId },
            });
        // Conversación vacía: habilita una plantilla sin inventar mensajes ni
        // abrir la ventana de atención. No modifica entradas anteriores.
        await tx.inboxConversacion.upsert({
          where: {
            vinculoId_contactoWaId: {
              vinculoId: canal.id,
              contactoWaId: config.destinatario,
            },
          },
          create: {
            tenantId: config.tenantId,
            vinculoId: canal.id,
            contactoWaId: config.destinatario,
          },
          update: {},
        });
        await registrarCambioInbox(tx, {
          tenantId: canal.tenantId,
          wabaId: canal.wabaId,
          phoneNumberId: canal.phoneNumberId,
        });
        return {
          canalId: canal.id,
          tipo: canal.tipo,
          venceEl: canal.tokenVenceEl,
        };
      });
    });
  }
}
