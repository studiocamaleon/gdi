import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ConsultaContratacionService } from '../suscripciones/consulta-contratacion.service';
import { autorizarEdicionPlanes } from './planes/autorizar-edicion-planes';
import { bloquearCupoUsuarios } from '../suscripciones/cupos-usuarios';

const SOLICITADA = 'contratacion_consulta_solicitada';
const TERMINADA = 'contratacion_consulta_terminada';
const objeto = (v: Prisma.JsonValue | null) =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const texto = (v: Prisma.JsonValue | undefined, fallback = '') =>
  typeof v === 'string' ? v : fallback;
export type ConsultaContratacionPlataforma = {
  solicitudId: string;
  motivo: string;
  transaccionId?: string;
};
export type ConsultaContratacionResultado = {
  solicitudId: string;
  resultado: string;
  detalle: string;
  estado: string;
  transaccionId: string | null;
};

@Injectable()
export class ContratacionesPlataformaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consulta: ConsultaContratacionService,
  ) {}

  private async suscripcion(
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const s = await tx.suscripcion.findUnique({
      where: { id },
      select: { id: true, tenantId: true },
    });
    if (!s) throw new NotFoundException('La suscripción no existe.');
    return s;
  }

  async listar(id: string, pagina: number, limite: number) {
    const s = await this.suscripcion(id);
    const where = { tenantId: s.tenantId };
    const [total, filas] = await Promise.all([
      this.prisma.planContratacion.count({ where }),
      this.prisma.planContratacion.findMany({
        where,
        orderBy: [{ creadaEl: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * limite,
        take: limite,
        include: { oferta: { select: { entorno: true } } },
      }),
    ]);
    return {
      total,
      pagina,
      limite,
      contrataciones: filas.map((op) => {
        const revision = objeto(op.revisionJson),
          destino = objeto(revision.destino ?? null);
        return {
          id: op.id,
          tipo: op.tipo,
          estado: op.estado,
          entorno: op.oferta.entorno,
          plan: texto(destino.nombre, 'Plan registrado'),
          ciclo: op.ciclo,
          adicionales: op.adicionales,
          creadaEl: op.creadaEl.toISOString(),
          enviadaEl: op.enviadaEl?.toISOString() ?? null,
          finalizadaEl: op.finalizadaEl?.toISOString() ?? null,
          transaccionId: op.transaccionId,
          referencia: op.referencia,
          detalle: op.detalle,
        };
      }),
    };
  }

  async historial(
    id: string,
    contratacionId: string,
    pagina: number,
    limite: number,
  ) {
    const s = await this.suscripcion(id);
    if (
      !(await this.prisma.planContratacion.findFirst({
        where: { id: contratacionId, tenantId: s.tenantId },
      }))
    )
      throw new NotFoundException('La contratación no existe en esta empresa.');
    const where: Prisma.PlataformaEventoWhereInput = {
      tenantAfectadoId: s.tenantId,
      tipo: { in: [SOLICITADA, TERMINADA] },
      datosJson: { path: ['contratacionId'], equals: contratacionId },
    };
    const [total, eventos] = await Promise.all([
      this.prisma.plataformaEvento.count({ where }),
      this.prisma.plataformaEvento.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * limite,
        take: limite,
        include: { staff: { select: { nombreCompleto: true } } },
      }),
    ]);
    return {
      total,
      pagina,
      limite,
      eventos: eventos.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        fecha: e.createdAt.toISOString(),
        actor: e.staff.nombreCompleto,
        descripcion: e.descripcion,
        resultado: texto(objeto(e.datosJson).resultado) || null,
      })),
    };
  }

  async recuperar(
    auth: CurrentAuth,
    id: string,
    contratacionId: string,
    dto: ConsultaContratacionPlataforma,
  ): Promise<ConsultaContratacionResultado> {
    const motivo = dto.motivo.trim();
    if (motivo.length < 5 || motivo.length > 300)
      throw new BadRequestException(
        'Indicá un motivo de entre 5 y 300 caracteres.',
      );
    const inicio = await this.prisma.$transaction(async (tx) => {
      await autorizarEdicionPlanes(tx, auth);
      const s = await this.suscripcion(id, tx);
      await bloquearCupoUsuarios(tx, s.tenantId);
      const op = await tx.planContratacion.findFirst({
        where: { id: contratacionId, tenantId: s.tenantId },
      });
      if (!op)
        throw new NotFoundException(
          'La contratación no existe en esta empresa.',
        );
      const anterior = await tx.plataformaEvento.findUnique({
        where: { id: dto.solicitudId },
      });
      if (anterior) {
        const datos = objeto(anterior.datosJson);
        if (
          anterior.tipo !== SOLICITADA ||
          anterior.staffUserId !== auth.userId ||
          anterior.tenantAfectadoId !== s.tenantId ||
          datos.contratacionId !== contratacionId ||
          datos.motivo !== motivo ||
          datos.transaccionId !== (dto.transaccionId ?? null)
        )
          throw new ConflictException(
            'La solicitud corresponde a otra consulta.',
          );
        const fin = await tx.plataformaEvento.findFirst({
          where: {
            tenantAfectadoId: s.tenantId,
            tipo: TERMINADA,
            datosJson: { path: ['solicitudId'], equals: dto.solicitudId },
          },
        });
        const d = objeto(fin?.datosJson ?? null);
        const respuesta: ConsultaContratacionResultado = {
          solicitudId: dto.solicitudId,
          resultado: texto(d.resultado, fin ? 'sin_resultado' : 'en_curso'),
          detalle: fin
            ? fin.descripcion
            : 'La consulta ya fue registrada. Actualizá el historial; si quedó sin resultado, podés iniciar una nueva consulta de lectura.',
          estado: texto(d.estado, op.estado),
          transaccionId: texto(d.transaccionId) || op.transaccionId,
        };
        return { nueva: false as const, respuesta };
      }
      await tx.plataformaEvento.create({
        data: {
          id: dto.solicitudId,
          staffUserId: auth.userId,
          tenantAfectadoId: s.tenantId,
          tipo: SOLICITADA,
          descripcion: `Consulta de contratación. Motivo: ${motivo}`,
          datosJson: {
            contratacionId,
            suscripcionId: id,
            motivo,
            transaccionId: dto.transaccionId ?? null,
            estadoAntes: op.estado,
          },
        },
      });
      return { nueva: true as const, tenantId: s.tenantId };
    });
    if (!inicio.nueva) return inicio.respuesta;
    const registrar = async (
      tx: Prisma.TransactionClient,
      respuesta: ConsultaContratacionResultado,
    ) => {
      await tx.plataformaEvento.create({
        data: {
          staffUserId: auth.userId,
          tenantAfectadoId: inicio.tenantId,
          tipo: TERMINADA,
          descripcion: respuesta.detalle,
          datosJson: { ...respuesta, contratacionId },
        },
      });
    };
    const respuesta = (r: {
      resultado: string;
      detalle: string;
      operacion: { estado: string; transaccionId: string | null };
    }): ConsultaContratacionResultado => ({
      solicitudId: dto.solicitudId,
      resultado: r.resultado,
      detalle: r.detalle,
      estado: r.operacion.estado,
      transaccionId: r.operacion.transaccionId,
    });
    try {
      const r = await this.consulta.consultar(
        inicio.tenantId,
        contratacionId,
        (tx) => autorizarEdicionPlanes(tx, auth),
        {
          transaccionId: dto.transaccionId,
          registrar: (tx, r) => registrar(tx, respuesta(r)),
        },
      );
      return respuesta(r);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      return this.prisma.$transaction(async (tx) => {
        await autorizarEdicionPlanes(tx, auth);
        await bloquearCupoUsuarios(tx, inicio.tenantId);
        const op = await tx.planContratacion.findFirstOrThrow({
          where: { id: contratacionId, tenantId: inicio.tenantId },
        });
        const r = respuesta({
          operacion: op,
          resultado: 'fallida',
          detalle:
            error instanceof ConflictException ||
            error instanceof BadRequestException
              ? error.message
              : 'La consulta no pudo registrar un resultado. Revisá el historial y consultá nuevamente; no se repitió el cobro.',
        });
        await registrar(tx, r);
        return r;
      });
    }
  }
}
