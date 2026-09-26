import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../../suscripciones/capacidades-empresa.service';
import {
  SecretosService,
  type SecretoCifrado,
} from '../../cripto/secretos.service';
import { InboxTiempoRealBus } from '../../../inbox-tiempo-real/inbox-tiempo-real.bus';
import { registrarCambioInbox } from '../../../inbox-tiempo-real/inbox-revision';
import type { CurrentAuth } from '../../../auth/auth.types';
import { exigirAccesoConexionMeta } from '../meta-conexion-acceso';
import { canalGeneralInbox, identidadCanalInbox } from '../meta-inbox-canal';
import { MetaCloudClient, type ResultadoMeta } from '../meta-cloud.client';
import {
  enviosInboxHabilitados,
  presentarEnvio,
  consultarVentanaRespuesta,
} from './meta-envios.config';
import { confirmarEnvioInbox } from './meta-inbox-proyeccion';
import { EnviarTextoInboxDto } from './meta-envios.dto';

@Injectable()
export class MetaEnviosService {
  constructor(
    private readonly db: PrismaService,
    private readonly client: MetaCloudClient,
    private readonly secretos: SecretosService,
    private readonly capacidades: CapacidadesEmpresaService,
    private readonly bus: InboxTiempoRealBus,
  ) {}

  async enviar(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    dto: EnviarTextoInboxDto,
  ) {
    if (!enviosInboxHabilitados(auth.tenantId))
      throw new ForbiddenException(
        'Las respuestas todavía no están habilitadas.',
      );
    await exigirAccesoConexionMeta(this.db, auth, ip);
    const canal = await canalGeneralInbox(this.db, auth.tenantId);
    if (!canal || identidadCanalInbox(canal) !== dto.canalId)
      throw new ConflictException('La conexión cambió. Actualizá el Inbox.');
    if (!dto.texto.trim() || dto.texto.length > 4096)
      throw new BadRequestException('Escribí entre 1 y 4096 caracteres.');
    const huella = createHash('sha256').update(dto.texto).digest('hex');
    const aviso = {
      tenantId: canal.tenantId,
      wabaId: canal.wabaId,
      phoneNumberId: canal.phoneNumberId,
    };
    const reservado = await this.db.$transaction(async (tx) => {
      // Mismo orden que almacenamiento y proyección: empresa, vínculo, intento.
      await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${auth.tenantId}::uuid FOR NO KEY UPDATE`;
      await tx.$queryRaw`SELECT id FROM "MetaVinculo" WHERE id=${canal.id}::uuid AND "tenantId"=${auth.tenantId}::uuid FOR NO KEY UPDATE`;
      await exigirAccesoConexionMeta(tx, auth, ip);
      await this.capacidades.exigirOperacionTx(tx, auth.tenantId, [
        'whatsapp_automatico',
      ]);
      const actual = await canalGeneralInbox(tx, auth.tenantId);
      if (
        !enviosInboxHabilitados(auth.tenantId) ||
        !actual ||
        identidadCanalInbox(actual) !== dto.canalId
      )
        throw new ForbiddenException();
      const anterior = await tx.inboxEnvio.findFirst({
        where: { tenantId: auth.tenantId, clave: dto.clave },
      });
      if (anterior) {
        if (
          anterior.huella !== huella ||
          anterior.conversacionId !== conversacionId ||
          anterior.autorizacionId !== canal.autorizacionId ||
          anterior.vinculoId !== canal.id
        )
          throw new ConflictException(
            'Ese intento corresponde a otro mensaje.',
          );
        return { envio: anterior, token: null, telefono: null };
      }
      const v = await tx.metaVinculo.findFirstOrThrow({
        where: { id: canal.id, tenantId: auth.tenantId },
      });
      const c = await tx.inboxConversacion.findFirst({
        where: {
          id: conversacionId,
          tenantId: auth.tenantId,
          vinculoId: canal.id,
        },
      });
      if (!c)
        throw new NotFoundException('La conversación no está disponible.');
      if (!/^[1-9]\d{7,14}$/.test(c.contactoWaId))
        throw new BadRequestException('El destinatario no es válido.');
      if (!(await consultarVentanaRespuesta(tx, v, c)).abierta)
        throw new ConflictException(
          'La ventana de atención está cerrada. Hace falta una plantilla aprobada.',
        );
      if (
        (await tx.inboxEnvio.count({
          where: {
            tenantId: auth.tenantId,
            usuarioId: auth.userId,
            createdAt: { gt: new Date(Date.now() - 60000) },
          },
        })) >= 20
      )
        throw new ConflictException(
          'Esperá un momento antes de enviar más mensajes.',
        );
      if (!this.secretos.disponible)
        throw new ServiceUnavailableException('La conexión necesita revisión.');
      let token: string;
      try {
        token = this.secretos.descifrar(v.tokenCifrado as SecretoCifrado);
      } catch {
        throw new ServiceUnavailableException('La conexión necesita revisión.');
      }
      const envio = await tx.inboxEnvio.create({
        data: {
          tenantId: auth.tenantId,
          vinculoId: canal.id,
          autorizacionId: canal.autorizacionId,
          conversacionId,
          usuarioId: auth.userId,
          clave: dto.clave,
          huella,
          texto: dto.texto,
        },
      });
      await registrarCambioInbox(tx, aviso);
      return { envio, token, telefono: `+${c.contactoWaId}` };
    });
    this.bus.avisar(aviso);
    if (reservado.token && reservado.telefono) {
      let resultado: ResultadoMeta;
      try {
        resultado = await this.client.enviarTexto({
          accessToken: reservado.token,
          phoneNumberId: canal.phoneNumberId,
          telefono: reservado.telefono,
          texto: dto.texto,
          correlacion: `grafo-inbox:${reservado.envio.id}`,
        });
      } catch {
        resultado = { estado: 'incierta' };
      }
      // Se conserva el resultado incluso si se cerró la sesión durante el POST.
      // Ningún proceso reclama o repite estos envíos al reiniciar.
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "MetaVinculo" WHERE id=${canal.id}::uuid AND "tenantId"=${auth.tenantId}::uuid FOR NO KEY UPDATE`;
        const intento = await tx.inboxEnvio.findFirstOrThrow({
          where: { id: reservado.envio.id, tenantId: auth.tenantId },
        });
        if (intento.estado !== 'ENVIANDO') return; // El webhook pudo confirmar primero.
        const v = await tx.metaVinculo.findFirstOrThrow({
          where: { id: canal.id, tenantId: auth.tenantId },
        });
        if (
          resultado.estado === 'aceptada' &&
          v.autorizacionId === canal.autorizacionId
        ) {
          await confirmarEnvioInbox(tx, v, intento, resultado.wamid);
        } else {
          await tx.inboxEnvio.update({
            where: { id: intento.id },
            data: {
              estado:
                resultado.estado === 'fallida'
                  ? 'RECHAZADO'
                  : resultado.estado === 'aceptada'
                    ? 'ACEPTADO'
                    : 'INCIERTO',
              codigo: resultado.estado === 'fallida' ? resultado.codigo : null,
              ...(resultado.estado === 'aceptada'
                ? { wamid: resultado.wamid, texto: null }
                : {}),
            },
          });
        }
        await registrarCambioInbox(tx, aviso);
      });
      this.bus.avisar(aviso);
    }
    await exigirAccesoConexionMeta(this.db, auth, ip);
    await this.capacidades.exigirIncluida(auth.tenantId, 'whatsapp_automatico');
    const actual = await canalGeneralInbox(this.db, auth.tenantId);
    if (
      !enviosInboxHabilitados(auth.tenantId) ||
      !actual ||
      identidadCanalInbox(actual) !== dto.canalId
    )
      throw new ForbiddenException();
    return presentarEnvio(
      await this.db.inboxEnvio.findFirstOrThrow({
        where: { id: reservado.envio.id, tenantId: auth.tenantId },
      }),
    );
  }
}
