import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AlcanceDocumentoProduccion,
  ArchivoEstado,
  DecisionAprobacionDocumento,
  EstadoRevisionArchivo,
  EstadoSolicitudAprobacion,
  Prisma,
  RolSistema,
  SeveridadNotificacionInterna,
  TipoEnlacePublico,
} from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { ArchivosService } from '../archivos/archivos.service';
import { firmaActor } from '../common/firma-actor';
import {
  generarTokenPublico,
  EnlacesPublicosService,
} from '../enlaces-publicos/enlaces-publicos.service';
import { urlEnlacePublico } from '../enlaces-publicos/enlaces-publicos.urls';
import { PrismaService } from '../prisma/prisma.service';
import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';
import {
  CrearArchivoMaestroDto,
  CrearGateDocumentoDto,
  CrearRevisionArchivoDto,
  DecidirAprobacionDocumentoDto,
  DecisionPublicaDocumentoDto,
  EmitirLinkAprobacionDto,
  SolicitarAprobacionDocumentoDto,
} from './dto/desarrollo-documental.dto';

const INCLUDE_MAESTRO = {
  revisionAprobada: { select: { id: true, numero: true } },
  revisionLiberada: {
    select: {
      id: true,
      numero: true,
      liberadaEl: true,
      liberadaPorNombre: true,
      archivo: { select: { id: true, nombreOriginal: true } },
    },
  },
  revisiones: {
    orderBy: { numero: 'desc' as const },
    include: {
      archivo: {
        select: {
          id: true,
          nombreOriginal: true,
          mimeType: true,
          bytes: true,
          hash: true,
        },
      },
      solicitudes: {
        orderBy: { createdAt: 'desc' as const },
        include: {
          asignadaAUsuario: {
            select: { id: true, nombreCompleto: true, email: true },
          },
          decisiones: { orderBy: { createdAt: 'desc' as const } },
        },
      },
    },
  },
  gates: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      orden: { select: { id: true, numero: true, estado: true } },
      paso: { select: { id: true, nombre: true, estado: true } },
    },
  },
} satisfies Prisma.ArchivoMaestroInclude;

type MaestroCompleto = Prisma.ArchivoMaestroGetPayload<{
  include: typeof INCLUDE_MAESTRO;
}>;

type GateDocumentoEvaluable = {
  tipoAprobacion: string;
  archivoMaestro: {
    revisionLiberada: null | {
      solicitudes: Array<{ tipo: string }>;
    };
  };
};

export function gateDocumentoEstaCumplido(
  gate: GateDocumentoEvaluable,
): boolean {
  const revision = gate.archivoMaestro.revisionLiberada;
  return Boolean(
    revision &&
    revision.solicitudes.some(
      (solicitud) => solicitud.tipo === gate.tipoAprobacion,
    ),
  );
}

export function decisionRequiereComentario(
  decision: DecisionAprobacionDocumento,
): boolean {
  return (
    decision === DecisionAprobacionDocumento.OBSERVAR ||
    decision === DecisionAprobacionDocumento.RECHAZAR
  );
}

@Injectable()
export class DesarrolloDocumentalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enlaces: EnlacesPublicosService,
    private readonly archivos: ArchivosService,
    @Optional() private readonly eventosSistema?: EventosSistemaService,
  ) {}

  /**
   * Convierte los requisitos declarativos de la receta congelada en documentos
   * reales de la campaña y, cuando corresponde, en gates de la OT. Es
   * idempotente: guardar/emitir más de una vez reutiliza maestro y gate.
   */
  async materializarRequisitosReceta(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      ordenId: string;
      proyectoCampanaId: string;
      actorUserId?: string | null;
      actorNombre: string;
    },
  ) {
    const orden = await tx.ordenTrabajo.findFirst({
      where: {
        id: args.ordenId,
        tenantId: args.tenantId,
        proyectoCampanaId: args.proyectoCampanaId,
      },
      select: {
        items: {
          where: { recetaRevisionId: { not: null } },
          select: {
            id: true,
            codigo: true,
            pasos: { select: { id: true, rutaPasoId: true } },
            recetaRevision: {
              select: {
                documentos: {
                  where: { requerido: true },
                  orderBy: { orden: 'asc' },
                },
              },
            },
          },
        },
      },
    });
    if (!orden) throw new NotFoundException('Orden o campaña inexistente.');

    let documentosCreados = 0;
    let gatesCreados = 0;
    for (const item of orden.items) {
      const requisitos = item.recetaRevision?.documentos ?? [];
      const idsVigentes = requisitos
        .filter((item) => item.tipoAprobacion)
        .map((item) => item.id);
      await tx.gateProduccionDocumento.updateMany({
        where: {
          tenantId: args.tenantId,
          ordenItemId: item.id,
          ...(idsVigentes.length
            ? { recetaDocumentoId: { notIn: idsVigentes } }
            : { recetaDocumentoId: { not: null } }),
        },
        data: { activo: false },
      });
      for (const requisito of requisitos) {
        const nombre = `${item.codigo} · ${requisito.nombre}`.slice(0, 180);
        const existente = await tx.archivoMaestro.findUnique({
          where: {
            tenantId_proyectoCampanaId_nombre: {
              tenantId: args.tenantId,
              proyectoCampanaId: args.proyectoCampanaId,
              nombre,
            },
          },
          select: { id: true },
        });
        const maestro =
          existente ??
          (await tx.archivoMaestro.create({
            data: {
              tenantId: args.tenantId,
              proyectoCampanaId: args.proyectoCampanaId,
              nombre,
              proposito: requisito.proposito,
              etapa: requisito.etapa,
              descripcion:
                requisito.descripcion ??
                `Requerido por la receta ${item.codigo} (${requisito.codigo}).`,
              requerido: true,
              creadoPorId: args.actorUserId ?? null,
              creadoPorNombre: args.actorNombre,
            },
          }));
        if (!existente) documentosCreados += 1;
        if (!requisito.tipoAprobacion) continue;

        const clavePaso = requisito.pasoClave?.replace(/^(ruta|extra):/, '');
        const pasoId =
          requisito.alcance === AlcanceDocumentoProduccion.PASO && clavePaso
            ? (item.pasos.find((paso) => paso.rutaPasoId === clavePaso)?.id ??
              null)
            : null;
        const gateExistente = await tx.gateProduccionDocumento.findUnique({
          where: {
            ordenItemId_recetaDocumentoId: {
              ordenItemId: item.id,
              recetaDocumentoId: requisito.id,
            },
          },
          select: { id: true },
        });
        if (gateExistente) {
          await tx.gateProduccionDocumento.update({
            where: { id: gateExistente.id },
            data: {
              pasoId,
              alcance: requisito.alcance,
              archivoMaestroId: maestro.id,
              tipoAprobacion: requisito.tipoAprobacion,
              nombre: requisito.nombre,
              activo: true,
            },
          });
        } else {
          await tx.gateProduccionDocumento.create({
            data: {
              tenantId: args.tenantId,
              proyectoCampanaId: args.proyectoCampanaId,
              ordenId: args.ordenId,
              ordenItemId: item.id,
              pasoId,
              alcance: requisito.alcance,
              archivoMaestroId: maestro.id,
              recetaDocumentoId: requisito.id,
              tipoAprobacion: requisito.tipoAprobacion,
              nombre: requisito.nombre,
            },
          });
          gatesCreados += 1;
        }
      }
    }
    return { documentosCreados, gatesCreados };
  }

  async listarCampana(auth: CurrentAuth, campanaId: string) {
    const campana = await this.prisma.proyectoCampana.findFirst({
      where: { id: campanaId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!campana) throw new NotFoundException('Campaña no encontrada.');
    return this.listar(campanaId);
  }

  async estadoOrden(auth: CurrentAuth, ordenId: string) {
    const orden = await this.prisma.ordenTrabajo.findFirst({
      where: { id: ordenId, tenantId: auth.tenantId },
      select: {
        id: true,
        numero: true,
        gatesDocumento: {
          where: { activo: true },
          orderBy: { createdAt: 'asc' },
          include: {
            paso: { select: { id: true, nombre: true, estado: true } },
            archivoMaestro: {
              include: {
                revisionLiberada: {
                  include: {
                    archivo: { select: { id: true, nombreOriginal: true } },
                    solicitudes: {
                      where: { estado: EstadoSolicitudAprobacion.APROBADA },
                      select: { tipo: true, resueltaEl: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada.');
    return {
      orden: { id: orden.id, numero: orden.numero },
      gates: orden.gatesDocumento.map((gate) => {
        const liberada = gate.archivoMaestro.revisionLiberada;
        return {
          id: gate.id,
          nombre: gate.nombre,
          tipoAprobacion: gate.tipoAprobacion,
          paso: gate.paso,
          cumplido: gateDocumentoEstaCumplido(gate),
          documento: {
            id: gate.archivoMaestro.id,
            nombre: gate.archivoMaestro.nombre,
            proposito: gate.archivoMaestro.proposito,
          },
          revisionLiberada: liberada
            ? {
                id: liberada.id,
                numero: liberada.numero,
                liberadaEl: liberada.liberadaEl?.toISOString() ?? null,
                liberadaPorNombre: liberada.liberadaPorNombre,
                archivo: {
                  id: liberada.archivo.id,
                  nombre: liberada.archivo.nombreOriginal,
                },
              }
            : null,
        };
      }),
    };
  }

  async crearMaestro(auth: CurrentAuth, dto: CrearArchivoMaestroDto) {
    const campana = await this.prisma.proyectoCampana.findFirst({
      where: { id: dto.proyectoCampanaId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!campana) throw new NotFoundException('Campaña no encontrada.');
    const nombre = dto.nombre.trim();
    if (!nombre) throw new BadRequestException('El nombre es obligatorio.');
    const actor = this.actor(auth);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.archivoMaestro.create({
          data: {
            tenantId: auth.tenantId,
            proyectoCampanaId: campana.id,
            nombre,
            proposito: dto.proposito,
            etapa: dto.etapa,
            descripcion: dto.descripcion?.trim() || null,
            requerido: dto.requerido ?? true,
            creadoPorId: auth.userId,
            creadoPorNombre: actor,
          },
        });
        await this.evento(
          tx,
          auth.tenantId,
          campana.id,
          actor,
          {
            tipo: 'archivo_maestro_creado',
            descripcion: `Se creó el documento controlado “${nombre}”.`,
            datosJson: { proposito: dto.proposito, etapa: dto.etapa },
          },
          auth.userId,
        );
      });
    } catch (error) {
      if (this.esUnico(error)) {
        throw new ConflictException(
          'Ya existe un documento con ese nombre en la campaña.',
        );
      }
      throw error;
    }
    return this.listar(campana.id);
  }

  async crearRevision(
    auth: CurrentAuth,
    maestroId: string,
    dto: CrearRevisionArchivoDto,
  ) {
    const maestro = await this.maestro(maestroId);
    const archivo = await this.prisma.archivo.findFirst({
      where: {
        id: dto.archivoId,
        tenantId: auth.tenantId,
        proyectoCampanaId: maestro.proyectoCampanaId,
        estado: ArchivoEstado.LISTO,
        generado: false,
      },
      select: { id: true, hash: true, nombreOriginal: true },
    });
    if (!archivo) {
      throw new BadRequestException(
        'El archivo debe ser un adjunto vigente de esta campaña.',
      );
    }
    if (!archivo.hash) {
      throw new BadRequestException(
        'El archivo no tiene hash SHA-256. Volvé a subirlo como revisión controlada.',
      );
    }
    const actor = this.actor(auth);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${maestro.id}))`;
        const ultima = await tx.archivoRevision.aggregate({
          where: { archivoMaestroId: maestro.id },
          _max: { numero: true },
        });
        const numero = (ultima._max.numero ?? 0) + 1;
        await tx.archivoRevision.create({
          data: {
            tenantId: auth.tenantId,
            archivoMaestroId: maestro.id,
            archivoId: archivo.id,
            numero,
            comentario: dto.comentario?.trim() || null,
            hash: archivo.hash,
            autorUserId: auth.userId,
            autorNombre: actor,
          },
        });
        await this.evento(
          tx,
          auth.tenantId,
          maestro.proyectoCampanaId,
          actor,
          {
            tipo: 'revision_documental_creada',
            descripcion: `Se agregó V${numero} a “${maestro.nombre}” (${archivo.nombreOriginal}).`,
            datosJson: { maestroId: maestro.id, numero, archivoId: archivo.id },
          },
          auth.userId,
        );
      });
    } catch (error) {
      if (this.esUnico(error)) {
        throw new ConflictException(
          'Ese archivo ya pertenece a una revisión controlada.',
        );
      }
      throw error;
    }
    return this.listar(maestro.proyectoCampanaId);
  }

  async solicitar(
    auth: CurrentAuth,
    revisionId: string,
    dto: SolicitarAprobacionDocumentoDto,
  ) {
    const revision = await this.revision(revisionId);
    if (revision.estado === EstadoRevisionArchivo.OBSOLETA) {
      throw new BadRequestException(
        'Una revisión obsoleta no puede enviarse a aprobación.',
      );
    }
    if (dto.asignadaAUsuarioId) {
      const asignada = await this.prisma.user.findFirst({
        where: {
          id: dto.asignadaAUsuarioId,
          memberships: {
            some: {
              tenantId: auth.tenantId,
              activa: true,
            },
          },
        },
        select: { id: true },
      });
      if (!asignada)
        throw new BadRequestException(
          'El aprobador no pertenece a esta empresa.',
        );
    }
    if (
      !dto.asignadaAUsuarioId &&
      !dto.asignadaARol &&
      !dto.permiteDecisionExterna
    ) {
      throw new BadRequestException(
        'Asigná un usuario, un rol o habilitá la aprobación externa.',
      );
    }
    const actor = this.actor(auth);
    const expiraEl = dto.expiraEl ? new Date(dto.expiraEl) : null;
    if (expiraEl && expiraEl.getTime() <= Date.now()) {
      throw new BadRequestException('La fecha de expiración debe ser futura.');
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.solicitudAprobacionDocumento.create({
          data: {
            tenantId: auth.tenantId,
            revisionId: revision.id,
            tipo: dto.tipo,
            comentario: dto.comentario?.trim() || null,
            solicitadaPorId: auth.userId,
            solicitadaPorNombre: actor,
            asignadaAUsuarioId: dto.asignadaAUsuarioId ?? null,
            asignadaARol: dto.asignadaARol ?? null,
            permiteDecisionExterna: dto.permiteDecisionExterna ?? false,
            expiraEl,
          },
        });
        await tx.archivoRevision.update({
          where: { id: revision.id },
          data: { estado: EstadoRevisionArchivo.EN_REVISION },
        });
        await this.evento(
          tx,
          auth.tenantId,
          revision.maestro.proyectoCampanaId,
          actor,
          {
            tipo: 'aprobacion_documental_solicitada',
            descripcion: `V${revision.numero} de “${revision.maestro.nombre}” fue enviada a aprobación (${this.labelTipo(dto.tipo)}).`,
            datosJson: { revisionId: revision.id, tipo: dto.tipo },
          },
          auth.userId,
        );
      });
    } catch (error) {
      if (this.esUnico(error)) {
        throw new ConflictException(
          'Ya existe una solicitud pendiente de ese tipo para la revisión.',
        );
      }
      throw error;
    }
    return this.listar(revision.maestro.proyectoCampanaId);
  }

  async emitirLink(
    auth: CurrentAuth,
    solicitudId: string,
    dto: EmitirLinkAprobacionDto,
  ) {
    const solicitud = await this.solicitud(solicitudId);
    if (!solicitud.permiteDecisionExterna) {
      throw new BadRequestException('La solicitud no admite decisión externa.');
    }
    if (solicitud.estado !== EstadoSolicitudAprobacion.PENDIENTE) {
      throw new BadRequestException('La solicitud ya no está pendiente.');
    }
    const token = generarTokenPublico();
    const dias = dto.diasVigencia ?? 14;
    const expiraEl =
      solicitud.expiraEl ?? new Date(Date.now() + dias * 86_400_000);
    await this.prisma.$transaction(async (tx) => {
      await this.enlaces.emitir(tx, {
        tenantId: auth.tenantId,
        tipo: TipoEnlacePublico.APROBACION_DOCUMENTAL,
        entidadId: solicitud.id,
        token,
        expiraEl,
      });
      if (!solicitud.expiraEl) {
        await tx.solicitudAprobacionDocumento.update({
          where: { id: solicitud.id },
          data: { expiraEl },
        });
      }
    });
    return {
      token,
      url: urlEnlacePublico(TipoEnlacePublico.APROBACION_DOCUMENTAL, token),
      expiraEl: expiraEl.toISOString(),
    };
  }

  async revocarLink(auth: CurrentAuth, solicitudId: string) {
    const solicitud = await this.solicitud(solicitudId);
    await this.prisma.$transaction(async (tx) => {
      await this.enlaces.revocar(
        tx,
        TipoEnlacePublico.APROBACION_DOCUMENTAL,
        solicitud.id,
      );
      await this.evento(
        tx,
        auth.tenantId,
        solicitud.revision.maestro.proyectoCampanaId,
        this.actor(auth),
        {
          tipo: 'link_aprobacion_documental_revocado',
          descripcion: `Se revocó el link externo de V${solicitud.revision.numero} de “${solicitud.revision.maestro.nombre}”.`,
          datosJson: { solicitudId: solicitud.id },
        },
        auth.userId,
      );
    });
    return this.listar(solicitud.revision.maestro.proyectoCampanaId);
  }

  async decidir(
    auth: CurrentAuth,
    solicitudId: string,
    dto: DecidirAprobacionDocumentoDto,
  ) {
    const solicitud = await this.solicitud(solicitudId);
    const privilegiado =
      auth.role === RolSistema.ADMINISTRADOR ||
      auth.role === RolSistema.SUPERVISOR;
    if (
      solicitud.asignadaAUsuarioId &&
      solicitud.asignadaAUsuarioId !== auth.userId &&
      !privilegiado
    ) {
      throw new ForbiddenException(
        'La solicitud está asignada a otro aprobador.',
      );
    }
    if (
      solicitud.asignadaARol &&
      solicitud.asignadaARol !== auth.role &&
      !privilegiado
    ) {
      throw new ForbiddenException('Tu rol no puede resolver esta solicitud.');
    }
    if (dto.evidenciaArchivoId) {
      const evidencia = await this.prisma.archivo.findFirst({
        where: { id: dto.evidenciaArchivoId, estado: ArchivoEstado.LISTO },
        select: { id: true },
      });
      if (!evidencia)
        throw new BadRequestException('La evidencia no está disponible.');
    }
    await this.resolverSolicitud({
      solicitud,
      decision: dto.decision,
      comentario: dto.comentario,
      evidenciaArchivoId: dto.evidenciaArchivoId,
      actorUserId: auth.userId,
      actorNombre: this.actor(auth),
      actorRol: auth.role,
      origen: 'INTERNO',
    });
    return this.listar(solicitud.revision.maestro.proyectoCampanaId);
  }

  async liberar(auth: CurrentAuth, revisionId: string) {
    const revision = await this.revision(revisionId);
    if (revision.estado !== EstadoRevisionArchivo.APROBADA) {
      throw new BadRequestException(
        'Sólo una revisión aprobada puede liberarse a producción.',
      );
    }
    const aprobacion = await this.prisma.solicitudAprobacionDocumento.findFirst(
      {
        where: { revisionId, estado: EstadoSolicitudAprobacion.APROBADA },
        select: { id: true },
      },
    );
    if (!aprobacion)
      throw new BadRequestException(
        'La revisión no tiene una decisión aprobatoria vigente.',
      );
    const actor = this.actor(auth);
    await this.prisma.$transaction(async (tx) => {
      await tx.archivoMaestro.update({
        where: { id: revision.archivoMaestroId },
        data: { revisionLiberadaId: revision.id, liberadaEl: new Date() },
      });
      await tx.archivoRevision.update({
        where: { id: revision.id },
        data: {
          liberadaEl: new Date(),
          liberadaPorId: auth.userId,
          liberadaPorNombre: actor,
        },
      });
      await this.evento(
        tx,
        auth.tenantId,
        revision.maestro.proyectoCampanaId,
        actor,
        {
          tipo: 'revision_documental_liberada',
          descripcion: `V${revision.numero} de “${revision.maestro.nombre}” quedó liberada a producción.`,
          datosJson: {
            revisionId: revision.id,
            maestroId: revision.archivoMaestroId,
          },
        },
        auth.userId,
      );
    });
    return this.listar(revision.maestro.proyectoCampanaId);
  }

  async crearGate(auth: CurrentAuth, dto: CrearGateDocumentoDto) {
    const [campana, orden, maestro, paso] = await Promise.all([
      this.prisma.proyectoCampana.findFirst({
        where: { id: dto.proyectoCampanaId },
        select: { id: true },
      }),
      this.prisma.ordenTrabajo.findFirst({
        where: { id: dto.ordenId },
        select: { id: true, proyectoCampanaId: true, numero: true },
      }),
      this.prisma.archivoMaestro.findFirst({
        where: { id: dto.archivoMaestroId },
        select: { id: true, proyectoCampanaId: true, nombre: true },
      }),
      dto.pasoId
        ? this.prisma.ordenTrabajoItemPaso.findFirst({
            where: { id: dto.pasoId },
            select: { id: true, ordenId: true },
          })
        : Promise.resolve(null),
    ]);
    if (!campana || !orden || !maestro)
      throw new NotFoundException(
        'No se encontraron las referencias del gate.',
      );
    if (
      orden.proyectoCampanaId !== campana.id ||
      maestro.proyectoCampanaId !== campana.id
    ) {
      throw new BadRequestException(
        'La campaña, la OT y el documento deben pertenecer al mismo proyecto.',
      );
    }
    if (dto.pasoId && (!paso || paso.ordenId !== orden.id)) {
      throw new BadRequestException(
        'El paso no pertenece a la orden indicada.',
      );
    }
    try {
      await this.prisma.gateProduccionDocumento.create({
        data: {
          tenantId: auth.tenantId,
          proyectoCampanaId: campana.id,
          ordenId: orden.id,
          pasoId: dto.pasoId ?? null,
          alcance: dto.pasoId
            ? AlcanceDocumentoProduccion.PASO
            : AlcanceDocumentoProduccion.ORDEN,
          archivoMaestroId: maestro.id,
          tipoAprobacion: dto.tipoAprobacion,
          nombre: dto.nombre.trim(),
        },
      });
    } catch (error) {
      if (this.esUnico(error))
        throw new ConflictException('Ese gate ya está configurado.');
      throw error;
    }
    return this.listar(campana.id);
  }

  async eliminarGate(auth: CurrentAuth, gateId: string) {
    const gate = await this.prisma.gateProduccionDocumento.findFirst({
      where: { id: gateId },
      select: { id: true, proyectoCampanaId: true },
    });
    if (!gate) throw new NotFoundException('Gate no encontrado.');
    await this.prisma.gateProduccionDocumento.delete({
      where: { id: gate.id },
    });
    return this.listar(gate.proyectoCampanaId);
  }

  async exigirGatesCumplidos(
    ordenId: string,
    pasoId?: string,
    ordenItemId?: string,
  ): Promise<void> {
    const alcances = [
      { alcance: AlcanceDocumentoProduccion.ORDEN },
      ...(ordenItemId
        ? [
            {
              alcance: AlcanceDocumentoProduccion.ITEM,
              ordenItemId,
            },
          ]
        : []),
      ...(pasoId
        ? [
            {
              alcance: AlcanceDocumentoProduccion.PASO,
              pasoId,
            },
          ]
        : []),
    ];
    const gates = await this.prisma.gateProduccionDocumento.findMany({
      where: {
        ordenId,
        activo: true,
        OR: alcances,
      },
      include: {
        archivoMaestro: {
          include: {
            revisionLiberada: {
              include: {
                solicitudes: {
                  where: { estado: EstadoSolicitudAprobacion.APROBADA },
                },
              },
            },
          },
        },
      },
    });
    const pendientes = gates.filter((gate) => !gateDocumentoEstaCumplido(gate));
    if (pendientes.length) {
      throw new BadRequestException(
        `Producción bloqueada por aprobación documental: ${pendientes.map((g) => g.nombre).join(', ')}.`,
      );
    }
  }

  async publico(token: string) {
    const solicitud = await this.solicitudPublica(token, true);
    return this.aPublico(solicitud);
  }

  async archivoPublico(token: string): Promise<string> {
    const solicitud = await this.solicitudPublica(token, false);
    return this.archivos.firmarDescargaDe(solicitud.revision.archivo);
  }

  async decidirPublico(token: string, dto: DecisionPublicaDocumentoDto) {
    if (
      dto.decision !== DecisionAprobacionDocumento.APROBAR &&
      dto.decision !== DecisionAprobacionDocumento.OBSERVAR &&
      dto.decision !== DecisionAprobacionDocumento.RECHAZAR
    ) {
      throw new BadRequestException('Decisión externa inválida.');
    }
    const solicitud = await this.solicitudPublica(token, false);
    await this.resolverSolicitud({
      solicitud,
      decision: dto.decision,
      comentario: dto.comentario,
      actorUserId: null,
      actorNombre: dto.actorNombre.trim(),
      actorRol: 'CLIENTE_EXTERNO',
      origen: 'EXTERNO',
    });
    return { estado: this.estadoSolicitud(dto.decision) };
  }

  private async resolverSolicitud(params: {
    solicitud: Awaited<ReturnType<DesarrolloDocumentalService['solicitud']>>;
    decision: DecisionAprobacionDocumento;
    comentario?: string;
    evidenciaArchivoId?: string;
    actorUserId: string | null;
    actorNombre: string;
    actorRol: string;
    origen: string;
  }) {
    const { solicitud } = params;
    if (solicitud.estado !== EstadoSolicitudAprobacion.PENDIENTE) {
      throw new ConflictException('La solicitud ya fue resuelta.');
    }
    if (solicitud.expiraEl && solicitud.expiraEl.getTime() < Date.now()) {
      throw new BadRequestException('La solicitud de aprobación venció.');
    }
    const comentario = params.comentario?.trim() || null;
    if (decisionRequiereComentario(params.decision) && !comentario) {
      throw new BadRequestException(
        'La observación o rechazo debe incluir un fundamento.',
      );
    }
    const estado = this.estadoSolicitud(params.decision);
    const estadoRevision =
      params.decision === DecisionAprobacionDocumento.APROBAR
        ? EstadoRevisionArchivo.APROBADA
        : params.decision === DecisionAprobacionDocumento.CANCELAR
          ? EstadoRevisionArchivo.BORRADOR
          : EstadoRevisionArchivo.OBSERVADA;
    await this.prisma.$transaction(async (tx) => {
      const cambio = await tx.solicitudAprobacionDocumento.updateMany({
        where: {
          id: solicitud.id,
          estado: EstadoSolicitudAprobacion.PENDIENTE,
        },
        data: { estado, resueltaEl: new Date() },
      });
      if (cambio.count !== 1)
        throw new ConflictException(
          'La solicitud fue resuelta por otra persona.',
        );
      await tx.decisionAprobacionDocumentoRegistro.create({
        data: {
          tenantId: solicitud.tenantId,
          solicitudId: solicitud.id,
          decision: params.decision,
          comentario,
          evidenciaArchivoId: params.evidenciaArchivoId ?? null,
          actorUserId: params.actorUserId,
          actorNombre: params.actorNombre,
          actorRol: params.actorRol,
          origen: params.origen,
        },
      });
      if (params.decision === DecisionAprobacionDocumento.APROBAR) {
        const anteriorId = solicitud.revision.maestro.revisionAprobadaId;
        if (anteriorId && anteriorId !== solicitud.revision.id) {
          await tx.archivoRevision.update({
            where: { id: anteriorId },
            data: { estado: EstadoRevisionArchivo.OBSOLETA },
          });
        }
        await tx.archivoMaestro.update({
          where: { id: solicitud.revision.archivoMaestroId },
          data: {
            revisionAprobadaId: solicitud.revision.id,
            ...(anteriorId !== solicitud.revision.id
              ? { revisionLiberadaId: null, liberadaEl: null }
              : {}),
          },
        });
      }
      await tx.archivoRevision.update({
        where: { id: solicitud.revision.id },
        data: { estado: estadoRevision },
      });
      await this.evento(
        tx,
        solicitud.tenantId,
        solicitud.revision.maestro.proyectoCampanaId,
        params.actorNombre,
        {
          tipo: `aprobacion_documental_${estado.toLowerCase()}`,
          descripcion: `${params.actorNombre} ${this.labelDecision(params.decision)} V${solicitud.revision.numero} de “${solicitud.revision.maestro.nombre}”.`,
          datosJson: {
            solicitudId: solicitud.id,
            revisionId: solicitud.revision.id,
            origen: params.origen,
          },
          origen: params.origen === 'EXTERNO' ? 'cliente' : 'usuario',
        },
        params.actorUserId,
      );
    });
  }

  private async listar(campanaId: string) {
    const maestros = await this.prisma.archivoMaestro.findMany({
      where: { proyectoCampanaId: campanaId },
      include: INCLUDE_MAESTRO,
      orderBy: [{ etapa: 'asc' }, { createdAt: 'asc' }],
    });
    return { maestros: maestros.map((m) => this.aDto(m)) };
  }

  private aDto(m: MaestroCompleto) {
    return {
      id: m.id,
      proyectoCampanaId: m.proyectoCampanaId,
      nombre: m.nombre,
      proposito: m.proposito,
      etapa: m.etapa,
      descripcion: m.descripcion,
      requerido: m.requerido,
      creadoPorNombre: m.creadoPorNombre,
      createdAt: m.createdAt.toISOString(),
      revisionAprobada: m.revisionAprobada,
      revisionLiberada: m.revisionLiberada
        ? {
            ...m.revisionLiberada,
            liberadaEl: m.revisionLiberada.liberadaEl?.toISOString() ?? null,
            archivo: {
              id: m.revisionLiberada.archivo.id,
              nombre: m.revisionLiberada.archivo.nombreOriginal,
            },
          }
        : null,
      revisiones: m.revisiones.map((r) => ({
        id: r.id,
        numero: r.numero,
        estado: r.estado,
        comentario: r.comentario,
        hash: r.hash,
        autorNombre: r.autorNombre,
        createdAt: r.createdAt.toISOString(),
        liberadaEl: r.liberadaEl?.toISOString() ?? null,
        liberadaPorNombre: r.liberadaPorNombre,
        archivo: {
          id: r.archivo.id,
          nombre: r.archivo.nombreOriginal,
          mimeType: r.archivo.mimeType,
          bytes: Number(r.archivo.bytes),
          hash: r.archivo.hash,
        },
        solicitudes: r.solicitudes.map((s) => ({
          id: s.id,
          tipo: s.tipo,
          estado: s.estado,
          comentario: s.comentario,
          solicitadaPorNombre: s.solicitadaPorNombre,
          asignadaAUsuario: s.asignadaAUsuario
            ? {
                id: s.asignadaAUsuario.id,
                nombre:
                  s.asignadaAUsuario.nombreCompleto ?? s.asignadaAUsuario.email,
              }
            : null,
          asignadaARol: s.asignadaARol,
          permiteDecisionExterna: s.permiteDecisionExterna,
          expiraEl: s.expiraEl?.toISOString() ?? null,
          resueltaEl: s.resueltaEl?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
          decisiones: s.decisiones.map((d) => ({
            ...d,
            createdAt: d.createdAt.toISOString(),
          })),
        })),
      })),
      gates: m.gates.map((g) => ({
        id: g.id,
        nombre: g.nombre,
        tipoAprobacion: g.tipoAprobacion,
        activo: g.activo,
        orden: g.orden,
        paso: g.paso,
      })),
    };
  }

  private maestro(id: string) {
    return this.prisma.archivoMaestro
      .findFirst({
        where: { id },
        select: { id: true, nombre: true, proyectoCampanaId: true },
      })
      .then(
        (row) =>
          row ??
          Promise.reject(
            new NotFoundException('Documento maestro no encontrado.'),
          ),
      );
  }

  private revision(id: string) {
    return this.prisma.archivoRevision
      .findFirst({
        where: { id },
        include: {
          maestro: {
            select: {
              id: true,
              nombre: true,
              proyectoCampanaId: true,
              revisionAprobadaId: true,
            },
          },
        },
      })
      .then(
        (row) =>
          row ??
          Promise.reject(new NotFoundException('Revisión no encontrada.')),
      );
  }

  private solicitud(id: string) {
    return this.prisma.solicitudAprobacionDocumento
      .findFirst({
        where: { id },
        include: {
          revision: {
            include: {
              maestro: {
                select: {
                  id: true,
                  nombre: true,
                  proyectoCampanaId: true,
                  revisionAprobadaId: true,
                },
              },
              archivo: true,
            },
          },
        },
      })
      .then(
        (row) =>
          row ??
          Promise.reject(new NotFoundException('Solicitud no encontrada.')),
      );
  }

  private async solicitudPublica(token: string, contarVisita: boolean) {
    const enlace = await this.enlaces.resolver(
      token,
      TipoEnlacePublico.APROBACION_DOCUMENTAL,
      { contarVisita },
    );
    if (!enlace)
      throw new NotFoundException('Solicitud no encontrada o link vencido.');
    const solicitud = await this.prisma.solicitudAprobacionDocumento.findFirst({
      where: {
        id: enlace.entidadId,
        tenantId: enlace.tenantId,
        permiteDecisionExterna: true,
      },
      include: {
        tenant: { select: { nombre: true } },
        revision: {
          include: {
            archivo: true,
            maestro: {
              include: {
                proyectoCampana: { select: { codigo: true, nombre: true } },
              },
            },
          },
        },
        decisiones: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada.');
    if (solicitud.expiraEl && solicitud.expiraEl.getTime() < Date.now()) {
      throw new NotFoundException('El link de aprobación venció.');
    }
    return solicitud;
  }

  private aPublico(
    s: Awaited<ReturnType<DesarrolloDocumentalService['solicitudPublica']>>,
  ) {
    return {
      negocio: s.tenant.nombre,
      campana: s.revision.maestro.proyectoCampana,
      documento: {
        nombre: s.revision.maestro.nombre,
        proposito: s.revision.maestro.proposito,
        etapa: s.revision.maestro.etapa,
      },
      revision: {
        numero: s.revision.numero,
        nombreArchivo: s.revision.archivo.nombreOriginal,
        mimeType: s.revision.archivo.mimeType,
        bytes: Number(s.revision.archivo.bytes),
        hash: s.revision.hash,
      },
      solicitud: {
        tipo: s.tipo,
        estado: s.estado,
        comentario: s.comentario,
        expiraEl: s.expiraEl?.toISOString() ?? null,
      },
      decision: s.decisiones[0]
        ? {
            decision: s.decisiones[0].decision,
            actorNombre: s.decisiones[0].actorNombre,
            comentario: s.decisiones[0].comentario,
            fecha: s.decisiones[0].createdAt.toISOString(),
          }
        : null,
    };
  }

  private estadoSolicitud(
    decision: DecisionAprobacionDocumento,
  ): EstadoSolicitudAprobacion {
    return {
      APROBAR: EstadoSolicitudAprobacion.APROBADA,
      OBSERVAR: EstadoSolicitudAprobacion.OBSERVADA,
      RECHAZAR: EstadoSolicitudAprobacion.RECHAZADA,
      CANCELAR: EstadoSolicitudAprobacion.CANCELADA,
    }[decision];
  }

  private actor(auth: CurrentAuth) {
    return firmaActor(auth, auth.email);
  }

  private labelTipo(tipo: string) {
    return tipo.toLowerCase().replaceAll('_', ' ');
  }

  private labelDecision(decision: DecisionAprobacionDocumento) {
    return {
      APROBAR: 'aprobó',
      OBSERVAR: 'observó',
      RECHAZAR: 'rechazó',
      CANCELAR: 'canceló la solicitud de',
    }[decision];
  }

  private async evento(
    tx: Prisma.TransactionClient,
    tenantId: string,
    proyectoCampanaId: string,
    actorNombre: string,
    data: {
      tipo: string;
      descripcion: string;
      datosJson?: Prisma.InputJsonValue;
      origen?: string;
    },
    actorUserId: string | null,
  ) {
    const eventoCampana = await tx.proyectoCampanaEvento.create({
      data: {
        tenantId,
        proyectoCampanaId,
        actorUserId,
        actorNombre,
        tipo: data.tipo,
        descripcion: data.descripcion,
        datosJson: data.datosJson,
        origen: data.origen ?? 'usuario',
      },
    });
    const decisionNegativa = /RECHAZ|OBSERV|BLOQUE/i.test(data.tipo);
    const decisionPositiva = /APROB|LIBER|COMPLET/i.test(data.tipo);
    await this.eventosSistema?.publicar(
      {
        tenantId,
        actorUserId,
        actorNombre,
        tipo: `documento.${data.tipo.toLowerCase()}`,
        entidadTipo: 'campana',
        entidadId: proyectoCampanaId,
        titulo: decisionNegativa
          ? 'Documento requiere atención'
          : decisionPositiva
            ? 'Documento aprobado'
            : 'Actualización documental',
        mensaje: data.descripcion,
        href: `/comercial/campanas/${proyectoCampanaId}`,
        severidad: decisionNegativa
          ? SeveridadNotificacionInterna.ADVERTENCIA
          : decisionPositiva
            ? SeveridadNotificacionInterna.EXITO
            : SeveridadNotificacionInterna.INFO,
        topicos: [`campana:${proyectoCampanaId}`],
        proyectoCampanaId,
      },
      tx,
    );
    return eventoCampana;
  }

  private esUnico(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
