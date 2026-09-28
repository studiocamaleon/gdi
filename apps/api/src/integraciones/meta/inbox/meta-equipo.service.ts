import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentAuth } from '../../../auth/auth.types';
import { PrismaService } from '../../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../../suscripciones/capacidades-empresa.service';
import { InboxTiempoRealBus } from '../../../inbox-tiempo-real/inbox-tiempo-real.bus';
import { registrarCambioInbox } from '../../../inbox-tiempo-real/inbox-revision';
import { exigirAccesoInbox } from '../meta-conexion-acceso';
import { canalGeneralInbox, identidadCanalInbox } from '../meta-inbox-canal';
import { destinatarioCanalPermitido } from '../meta-prueba.config';
import { nombreOperador, operadoresInbox } from './meta-equipo';
import {
  AsignarInboxDto,
  NotaInboxDto,
  EstadoInboxDto,
  LecturaInboxDto,
} from './meta-equipo.dto';

@Injectable()
export class MetaEquipoService {
  constructor(
    private readonly db: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService,
    private readonly bus: InboxTiempoRealBus,
  ) {}
  async guardar(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    dto: NotaInboxDto | AsignarInboxDto | EstadoInboxDto | LecturaInboxDto,
  ) {
    const nota = 'texto' in dto;
    const estado = 'estado' in dto;
    const lectura = !('clave' in dto);
    if (nota && (!dto.texto.trim() || dto.texto.length > 4000))
      throw new BadRequestException('Escribí entre 1 y 4000 caracteres.');
    if (!nota && !estado && !lectura && dto.responsableId === undefined)
      throw new BadRequestException('Elegí el responsable o Sin asignar.');
    await exigirAccesoInbox(this.db, auth, ip);
    const canal = await canalGeneralInbox(this.db, auth.tenantId);
    if (!canal || identidadCanalInbox(canal) !== dto.canalId)
      throw new ConflictException(
        'La conexión cambió. Volvé a abrir la conversación.',
      );
    const aviso = {
      tenantId: auth.tenantId,
      wabaId: canal.wabaId,
      phoneNumberId: canal.phoneNumberId,
    };
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${auth.tenantId}::uuid FOR NO KEY UPDATE`;
      await tx.$queryRaw`SELECT id FROM "MetaVinculo" WHERE id=${canal.id}::uuid AND "tenantId"=${auth.tenantId}::uuid FOR NO KEY UPDATE`;
      await exigirAccesoInbox(tx, auth, ip);
      await this.capacidades.exigirOperacionTx(tx, auth.tenantId, [
        'whatsapp_automatico',
      ]);
      const vigente = await canalGeneralInbox(tx, auth.tenantId);
      if (!vigente || identidadCanalInbox(vigente) !== dto.canalId)
        throw new ForbiddenException();
      const scope = {
        tenantId: auth.tenantId,
        vinculoId: canal.id,
        conversacionId,
      };
      const c = await tx.inboxConversacion.findFirst({
        where: {
          id: conversacionId,
          tenantId: auth.tenantId,
          vinculoId: canal.id,
        },
      });
      if (!c || !destinatarioCanalPermitido(vigente, c.contactoWaId))
        throw new NotFoundException('La conversación no está disponible.');
      if (lectura) {
        if (dto.revision > c.entrantesRevision)
          throw new BadRequestException(
            'La lectura no corresponde a esta conversación.',
          );
        const cambio = await tx.inboxConversacion.updateMany({
          where: {
            id: c.id,
            tenantId: auth.tenantId,
            vinculoId: canal.id,
            leidaRevision: { lt: dto.revision },
          },
          data: { leidaRevision: dto.revision },
        });
        if (cambio.count) await registrarCambioInbox(tx, aviso);
        return;
      }
      const anterior = await tx.inboxEventoInterno.findFirst({
        where: { tenantId: auth.tenantId, clave: dto.clave },
      });
      if (anterior) {
        if (
          anterior.conversacionId !== conversacionId ||
          anterior.vinculoId !== canal.id ||
          anterior.actorId !== auth.userId ||
          (nota
            ? anterior.tipo !== 'NOTA' || anterior.texto !== dto.texto.trim()
            : estado
              ? anterior.tipo !==
                (dto.estado === 'RESUELTA' ? 'RESUELTA' : 'REABIERTA')
              : !['ASIGNACION', 'TRANSFERENCIA', 'SIN_ASIGNAR'].includes(
                  anterior.tipo,
                ) || anterior.responsableId !== dto.responsableId)
        )
          throw new ConflictException('Esa acción corresponde a otro cambio.');
        return;
      }
      const actor = await tx.user.findUniqueOrThrow({
        where: { id: auth.userId },
        select: { nombreCompleto: true, email: true },
      });
      const base = {
        ...scope,
        clave: dto.clave,
        actorId: auth.userId,
        actorNombre: nombreOperador(actor),
      };
      if (nota) {
        await tx.inboxEventoInterno.create({
          data: { ...base, tipo: 'NOTA', texto: dto.texto.trim() },
        });
      } else if (estado) {
        if (
          c.estadoVersion !== dto.version ||
          c.entrantesRevision !== dto.revision
        )
          throw new ConflictException(
            'La conversación cambió. Revisá los mensajes y su estado antes de continuar.',
          );
        if (c.estado === dto.estado) return;
        await tx.inboxConversacion.update({
          where: { id: c.id, tenantId: auth.tenantId },
          data: {
            estado: dto.estado,
            estadoVersion: { increment: 1 },
            resueltaEl: dto.estado === 'RESUELTA' ? new Date() : null,
          },
        });
        await tx.inboxEventoInterno.create({
          data: {
            ...base,
            tipo: dto.estado === 'RESUELTA' ? 'RESUELTA' : 'REABIERTA',
          },
        });
      } else {
        if (c.asignacionVersion !== dto.version)
          throw new ConflictException(
            'Otra persona cambió el responsable. Revisá la asignación actual antes de confirmar.',
          );
        const responsable = dto.responsableId
          ? (await operadoresInbox(tx, auth.tenantId)).find(
              (o) => o.id === dto.responsableId,
            )
          : null;
        if (dto.responsableId && !responsable)
          throw new BadRequestException(
            'Ese integrante no tiene acceso activo al Inbox de esta empresa.',
          );
        if (c.responsableId === dto.responsableId) return;
        await tx.inboxConversacion.update({
          where: { id: c.id, tenantId: auth.tenantId },
          data: {
            responsableId: responsable?.id ?? null,
            responsableNombre: responsable?.nombre ?? null,
            asignacionVersion: { increment: 1 },
          },
        });
        await tx.inboxEventoInterno.create({
          data: {
            ...base,
            tipo: !responsable
              ? 'SIN_ASIGNAR'
              : c.responsableId
                ? 'TRANSFERENCIA'
                : 'ASIGNACION',
            anteriorId: c.responsableId,
            anteriorNombre: c.responsableNombre,
            responsableId: responsable?.id,
            responsableNombre: responsable?.nombre,
          },
        });
      }
      await registrarCambioInbox(tx, aviso);
    });
    this.bus.avisar(aviso);
    return { guardado: true };
  }
}
