import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import {
  contratoPublicado,
  contratoSuscripcion,
} from '../../suscripciones/contrato-suscripcion';
import { diferenciasCapacidades } from '../../suscripciones/evaluador-capacidades';
import {
  bloquearCupoUsuarios,
  resumenCupoUsuarios,
} from '../../suscripciones/cupos-usuarios';
import { cupoAlmacenamiento } from '../../archivos/cupo-almacenamiento';
import { exigirSinContratacionPendiente } from '../../suscripciones/contratacion-pendiente';
import { autorizarEdicionPlanes } from './autorizar-edicion-planes';
import { operacionesCambioPlan } from './operaciones-cambio-plan';
import {
  diagnosticarCambioPlan,
  requiereCerrarOperacion,
} from './diagnostico-cambio-plan';
import type { ContenidoPlan } from './catalogo-planes';
import type {
  AsignarVersionDto,
  ConsultarAsignacionDto,
} from './planes-asignacion.controller';
import type {
  ResultadoAsignacion,
  VistaAsignacionPlan,
} from './asignacion-planes';

const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

@Injectable()
export class PlanesAsignacionService {
  constructor(private readonly prisma: PrismaService) {}

  private async evaluar(
    tx: Prisma.TransactionClient,
    dto: ConsultarAsignacionDto,
  ) {
    const tenant = await tx.tenant.findUnique({
      where: { id: dto.tenantId },
      include: { suscripcion: { include: { plan: true, planVersion: true } } },
    });
    if (!tenant) throw new NotFoundException('La empresa no existe.');
    const s = tenant.suscripcion;
    if (s?.plan.comercialVersionado && !dto.versionId)
      throw new BadRequestException(
        'Este contrato nació con una versión publicada y debe conservar una versión asignada.',
      );
    const version = dto.versionId
      ? await tx.planVersion.findUnique({ where: { id: dto.versionId } })
      : null;
    if (dto.versionId && !version)
      throw new NotFoundException('La versión publicada no existe.');
    const actual = contratoSuscripcion(s);
    // El contrato compatible se restaura a partir del plan comercial conservado.
    const propuesta = version
      ? contratoPublicado(version)
      : contratoSuscripcion(s ? { plan: s.plan } : null);
    const contenido: ContenidoPlan = version
      ? (version.contenido as unknown as ContenidoPlan)
      : {
          nombre: propuesta.nombre,
          descripcion: 'Condiciones anteriores del contrato comercial.',
          usuariosIncluidos: propuesta.limites.usuariosMax ?? 10000,
          adicionalesPermitidos: true,
          almacenamientoModo: propuesta.limites.almacenamiento.modo,
          almacenamientoGb: propuesta.limites.almacenamiento.gb,
          funciones: propuesta.funciones,
        };
    const diferencias = diferenciasCapacidades(actual, propuesta);
    const retiradas = new Set(
      diferencias.filter((d) => d.actual && !d.propuesta).map((d) => d.clave),
    );
    const [usuarios, archivos, operaciones] = await Promise.all([
      resumenCupoUsuarios(tx, dto.tenantId),
      cupoAlmacenamiento(tx, dto.tenantId),
      operacionesCambioPlan(tx, dto.tenantId, retiradas),
    ]);
    const uso = {
      usuarios: {
        activos: usuarios.activos,
        invitacionesPendientes: usuarios.invitacionesPendientes,
        adicionalesVigentes: usuarios.adicionales,
      },
      archivos: {
        guardadosBytes: String(archivos.bytes),
        reservadosBytes: String(archivos.bytesReservados),
        cargasPendientes: archivos.cargasPendientes,
      },
    };
    const diagnostico = diagnosticarCambioPlan(
      actual,
      propuesta,
      contenido,
      uso,
      tenant.cuotaBytesArchivos ? String(tenant.cuotaBytesArchivos) : null,
      operaciones,
    );
    const bloqueos = diagnostico.hallazgos
      .filter((h) => h.nivel === 'resolver')
      .map((h) => h.detalle);
    if (!s)
      bloqueos.push(
        'La empresa necesita una suscripción manual antes de asignar una versión.',
      );
    else if (s.proveedor !== 'manual' || s.referenciaExterna)
      bloqueos.push(
        'Esta suscripción tiene cobro externo. Su versión se vinculará mediante la integración comercial.',
      );
    if ((s?.planVersionId ?? null) === dto.versionId)
      bloqueos.push('La empresa ya utiliza estas condiciones.');
    // Sólo los circuitos con continuidad explícita pueden retirarse tras revisar.
    const pendientes = operaciones.filter(requiereCerrarOperacion);
    for (const o of pendientes)
      bloqueos.push(
        `${o.titulo}: ${o.cantidad}. Completá o cancelá esos compromisos antes de retirar la función.`,
      );
    const revisiones = diagnostico.hallazgos
      .filter(
        (h) =>
          h.nivel === 'revisar' &&
          !pendientes.some((o) => o.codigo === h.codigo),
      )
      .map((h) => h.codigo);
    const vista = {
      empresa: { id: tenant.id, nombre: tenant.nombre },
      actual: {
        nombre: actual.nombre,
        versionId: s?.planVersionId ?? null,
        numero: s?.planVersion?.numero ?? null,
        revision: s?.revisionContrato ?? 0,
      },
      destino: {
        nombre: propuesta.nombre,
        versionId: dto.versionId,
        numero: version?.numero ?? null,
      },
      uso,
      diferencias,
      diagnostico,
      bloqueos,
      revisiones,
    };
    // Se firma lo que se revisó, junto con las condiciones comerciales y excepciones vigentes.
    const huella = hash({
      ...vista,
      operaciones,
      suscripcion: s
        ? {
            id: s.id,
            updatedAt: s.updatedAt.toISOString(),
            planId: s.planId,
            proveedor: s.proveedor,
            estado: s.estado,
            adicionales: s.usuariosAdicionales,
          }
        : null,
      activo: tenant.activo,
      ajuste: String(tenant.cuotaBytesArchivos ?? 0),
      versionCatalogo: version?.catalogoVersion,
      funcionesActuales: actual.funciones,
    });
    return { vista: { ...vista, huella } satisfies VistaAsignacionPlan, s };
  }

  async diagnostico(dto: ConsultarAsignacionDto): Promise<VistaAsignacionPlan> {
    return this.prisma.$transaction(
      async (tx) => (await this.evaluar(tx, dto)).vista,
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async asignar(
    auth: CurrentAuth,
    dto: AsignarVersionDto,
  ): Promise<ResultadoAsignacion> {
    const motivo = dto.motivo?.trim();
    if (
      !motivo ||
      motivo.length < 5 ||
      motivo.length > 500 ||
      !Number.isInteger(dto.revision) ||
      !Array.isArray(dto.revisionesAceptadas)
    )
      throw new BadRequestException(
        'Revisá el motivo y las condiciones de asignación.',
      );
    const firmaSolicitud = hash({
      tenantId: dto.tenantId,
      versionId: dto.versionId,
      revision: dto.revision,
      huella: dto.huella,
      motivo,
      revisionesAceptadas: [...dto.revisionesAceptadas].sort(),
    });
    return this.prisma.$transaction(async (tx) => {
      await autorizarEdicionPlanes(tx, auth);
      await bloquearCupoUsuarios(tx, dto.tenantId);
      const previa = await tx.plataformaEvento.findUnique({
        where: { id: dto.operacionId },
      });
      if (previa) {
        const data = previa.datosJson as {
          firmaSolicitud?: string;
          resultado?: ResultadoAsignacion;
        };
        if (
          previa.tipo !== 'plan_version_asignada' ||
          previa.staffUserId !== auth.userId ||
          previa.tenantAfectadoId !== dto.tenantId ||
          data?.firmaSolicitud !== firmaSolicitud ||
          !data.resultado
        )
          throw new ConflictException(
            'La solicitud corresponde a otra operación.',
          );
        return data.resultado;
      }
      await exigirSinContratacionPendiente(tx, dto.tenantId);
      const { vista, s } = await this.evaluar(tx, dto);
      if (vista.huella !== dto.huella || vista.actual.revision !== dto.revision)
        throw new ConflictException(
          'Las condiciones de la empresa cambiaron. Actualizá el diagnóstico antes de asignar.',
        );
      if (vista.bloqueos.length || !s)
        throw new ConflictException(vista.bloqueos);
      if (vista.revisiones.some((c) => !dto.revisionesAceptadas.includes(c)))
        throw new BadRequestException(
          'Confirmá las revisiones de continuidad indicadas.',
        );
      const cambio = await tx.suscripcion.updateMany({
        where: {
          id: s.id,
          revisionContrato: dto.revision,
          proveedor: 'manual',
          referenciaExterna: null,
          updatedAt: s.updatedAt,
        },
        data: {
          planVersionId: dto.versionId,
          revisionContrato: { increment: 1 },
        },
      });
      if (cambio.count !== 1)
        throw new ConflictException(
          'La suscripción cambió. Volvé a revisar el diagnóstico.',
        );
      const resultado = {
        operacionId: dto.operacionId,
        tenantId: dto.tenantId,
        versionId: dto.versionId,
        revision: s.revisionContrato + 1,
      };
      await tx.plataformaEvento.create({
        data: {
          id: dto.operacionId,
          staffUserId: auth.userId,
          tenantAfectadoId: dto.tenantId,
          tipo: 'plan_version_asignada',
          descripcion: `${vista.actual.nombre} → ${vista.destino.nombre}${vista.destino.numero ? ` · versión ${vista.destino.numero}` : ' · contrato anterior'}. ${motivo}`,
          datosJson: {
            firmaSolicitud,
            resultado,
            anterior: vista.actual,
            destino: vista.destino,
            diagnostico: vista.diagnostico,
            uso: vista.uso,
            motivo,
            revisionesAceptadas: dto.revisionesAceptadas,
            planComercialConservado: s.planId,
            estadoConservado: s.estado,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return resultado;
    });
  }
}
