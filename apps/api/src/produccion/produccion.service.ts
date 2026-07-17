import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertEstacionDto } from './dto/upsert-estacion.dto';
import { FAMILIAS } from '../productos-servicios/pasos/familias';
import type { FamiliaCodigo } from '../productos-servicios/pasos/types';

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

/** Include de la proyección completa de una estación. */
const ESTACION_INCLUDE = {
  familias: { select: { familiaCodigo: true } },
  empleados: {
    include: {
      empleado: { select: { id: true, nombreCompleto: true, sector: true } },
    },
  },
  maquinas: {
    // centroCostoPrincipalId es el vínculo real paso→máquina: la
    // trazabilidad del paso guarda centroCostoId, no maquinaId.
    select: {
      id: true,
      codigo: true,
      nombre: true,
      centroCostoPrincipalId: true,
    },
    orderBy: { codigo: 'asc' as const },
  },
} satisfies Prisma.EstacionInclude;

type EstacionConRelaciones = Prisma.EstacionGetPayload<{
  include: typeof ESTACION_INCLUDE;
}>;

@Injectable()
export class ProduccionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Estaciones ───────────────────────────────────────────────────────
  // La estación agrupa familias de pasos (ruteo del tablero), máquinas y
  // empleados habilitados. Ver docs/estaciones-diseno.md

  async findEstaciones(auth: CurrentAuth) {
    const rows = await this.prisma.estacion.findMany({
      where: { tenantId: auth.tenantId },
      include: ESTACION_INCLUDE,
      orderBy: [{ nombre: 'asc' }],
    });
    return rows.map((item) => this.toEstacion(item));
  }

  /**
   * Catálogo de familias de pasos (fuente de verdad: el catálogo del motor)
   * + qué estación tiene tomada cada una, para el picker del panel.
   */
  async findFamiliasPasos(auth: CurrentAuth) {
    const asignadas = await this.prisma.estacionFamilia.findMany({
      where: { tenantId: auth.tenantId },
      include: {
        estacion: {
          select: {
            id: true,
            nombre: true,
            maquinas: { select: { id: true }, take: 1 },
          },
        },
      },
      orderBy: { estacion: { nombre: 'asc' } },
    });
    const porFamilia = new Map<
      string,
      Array<{ id: string; nombre: string; conMaquinas: boolean }>
    >();
    for (const fila of asignadas) {
      const lista = porFamilia.get(fila.familiaCodigo) ?? [];
      lista.push({
        id: fila.estacion.id,
        nombre: fila.estacion.nombre,
        conMaquinas: fila.estacion.maquinas.length > 0,
      });
      porFamilia.set(fila.familiaCodigo, lista);
    }
    return Object.values(FAMILIAS).map((familia) => ({
      codigo: familia.codigo,
      nombre: familia.nombre,
      categoria: familia.categoria,
      visibleEnSelector: familia.visibleEnSelector !== false,
      estaciones: porFamilia.get(familia.codigo) ?? [],
    }));
  }

  /**
   * Valida el payload contra el catálogo y el tenant, y devuelve las
   * referencias saneadas. La unicidad familia→estación se valida acá con
   * mensaje útil (la dueña); el constraint de DB es la red de seguridad.
   */
  private async validarReferencias(
    auth: CurrentAuth,
    payload: UpsertEstacionDto,
    exceptoEstacionId?: string,
  ) {
    const familias = [...new Set(payload.familias ?? [])];
    const empleadoIds = [...new Set(payload.empleadoIds ?? [])];
    const maquinaIds = [...new Set(payload.maquinaIds ?? [])];

    const invalidas = familias.filter(
      (codigo) => !FAMILIAS[codigo as FamiliaCodigo],
    );
    if (invalidas.length > 0) {
      throw new BadRequestException(
        `Familias de pasos desconocidas: ${invalidas.join(', ')}.`,
      );
    }

    // Una familia puede repetirse entre estaciones CON máquinas (filtran por
    // máquina y son disjuntas), pero a lo sumo hay UNA estación general (sin
    // máquinas) por familia: dos generales serían ruteo ambiguo (D1 del doc).
    const payloadEsGeneral = maquinaIds.length === 0;
    if (familias.length > 0 && payloadEsGeneral) {
      const tomadas = await this.prisma.estacionFamilia.findMany({
        where: {
          tenantId: auth.tenantId,
          familiaCodigo: { in: familias },
          ...(exceptoEstacionId
            ? { estacionId: { not: exceptoEstacionId } }
            : {}),
        },
        include: {
          estacion: {
            select: { nombre: true, maquinas: { select: { id: true }, take: 1 } },
          },
        },
      });
      const generales = tomadas.filter(
        (fila) => fila.estacion.maquinas.length === 0,
      );
      if (generales.length > 0) {
        const detalle = generales
          .map(
            (fila) =>
              `${FAMILIAS[fila.familiaCodigo as FamiliaCodigo]?.nombre ?? fila.familiaCodigo} (en "${fila.estacion.nombre}")`,
          )
          .join(' · ');
        throw new ConflictException(
          `Sólo puede haber una estación general (sin máquinas) por familia. Ya asignadas a otra estación general: ${detalle}. Asigná máquinas a esta estación para repartir la familia por máquina.`,
        );
      }
    }

    if (empleadoIds.length > 0) {
      const encontrados = await this.prisma.empleado.count({
        where: { tenantId: auth.tenantId, id: { in: empleadoIds } },
      });
      if (encontrados !== empleadoIds.length) {
        throw new NotFoundException('Algún empleado referenciado no existe.');
      }
    }
    if (maquinaIds.length > 0) {
      const encontradas = await this.prisma.maquina.count({
        where: { tenantId: auth.tenantId, id: { in: maquinaIds } },
      });
      if (encontradas !== maquinaIds.length) {
        throw new NotFoundException('Alguna máquina referenciada no existe.');
      }
    }

    return { familias, empleadoIds, maquinaIds };
  }

  /**
   * Sincroniza las tres listas de la estación (reemplazo completo). Las
   * máquinas se MUEVEN: asignar acá una máquina que estaba en otra estación
   * le pisa el estacionId (una máquina vive en un solo lugar).
   */
  private async sincronizarListas(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    estacionId: string,
    listas: {
      familias: string[];
      empleadoIds: string[];
      maquinaIds: string[];
    },
  ) {
    await tx.estacionFamilia.deleteMany({
      where: { tenantId: auth.tenantId, estacionId },
    });
    if (listas.familias.length > 0) {
      await tx.estacionFamilia.createMany({
        data: listas.familias.map((familiaCodigo) => ({
          tenantId: auth.tenantId,
          estacionId,
          familiaCodigo,
        })),
      });
    }

    await tx.estacionEmpleado.deleteMany({
      where: { tenantId: auth.tenantId, estacionId },
    });
    if (listas.empleadoIds.length > 0) {
      await tx.estacionEmpleado.createMany({
        data: listas.empleadoIds.map((empleadoId) => ({
          tenantId: auth.tenantId,
          estacionId,
          empleadoId,
        })),
      });
    }

    // Desasigna las que salieron de la estación, asigna (o mueve) las nuevas.
    await tx.maquina.updateMany({
      where: {
        tenantId: auth.tenantId,
        estacionId,
        id: { notIn: listas.maquinaIds },
      },
      data: { estacionId: null },
    });
    if (listas.maquinaIds.length > 0) {
      await tx.maquina.updateMany({
        where: { tenantId: auth.tenantId, id: { in: listas.maquinaIds } },
        data: { estacionId },
      });
    }
  }

  async createEstacion(auth: CurrentAuth, payload: UpsertEstacionDto) {
    const listas = await this.validarReferencias(auth, payload);
    try {
      const creada = await this.prisma.$transaction(async (tx) => {
        const estacion = await tx.estacion.create({
          data: {
            tenantId: auth.tenantId,
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            activo: payload.activo ?? true,
            etapa: payload.etapa ?? 'preprensa',
            icono: payload.icono?.trim() || null,
            capacidadConcurrente: payload.capacidadConcurrente ?? 1,
            horario: payload.horario?.trim() || null,
          },
        });
        await this.sincronizarListas(tx, auth, estacion.id, listas);
        return estacion;
      });
      return this.findEstacion(auth, creada.id);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Ya existe una estación con ese nombre.');
      }
      throw error;
    }
  }

  async updateEstacion(
    auth: CurrentAuth,
    id: string,
    payload: UpsertEstacionDto,
  ) {
    const existing = await this.prisma.estacion.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Estación no encontrada.');
    }
    const listas = await this.validarReferencias(auth, payload, id);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.estacion.update({
          where: { id },
          data: {
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            activo: payload.activo,
            etapa: payload.etapa ?? existing.etapa,
            icono: payload.icono?.trim() || null,
            capacidadConcurrente:
              payload.capacidadConcurrente ?? existing.capacidadConcurrente,
            horario: payload.horario?.trim() || null,
          },
        });
        await this.sincronizarListas(tx, auth, id, listas);
      });
      return this.findEstacion(auth, id);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Ya existe una estación con ese nombre.');
      }
      throw error;
    }
  }

  async toggleEstacion(auth: CurrentAuth, id: string) {
    const existing = await this.prisma.estacion.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Estación no encontrada.');
    }
    await this.prisma.estacion.update({
      where: { id },
      data: { activo: !existing.activo },
    });
    return this.findEstacion(auth, id);
  }

  /**
   * Borrado real: libera familias y empleados (cascade) y desasigna las
   * máquinas (SetNull). El trabajo vivo del tablero cae a "Sin estación".
   */
  async deleteEstacion(auth: CurrentAuth, id: string) {
    const existing = await this.prisma.estacion.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { id: true, nombre: true },
    });
    if (!existing) {
      throw new NotFoundException('Estación no encontrada.');
    }
    await this.prisma.estacion.delete({ where: { id } });
    return { ok: true };
  }

  private async findEstacion(auth: CurrentAuth, id: string) {
    const row = await this.prisma.estacion.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: ESTACION_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Estación no encontrada.');
    }
    return this.toEstacion(row);
  }

  private toEstacion(item: EstacionConRelaciones) {
    return {
      id: item.id,
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      activo: item.activo,
      etapa: item.etapa,
      icono: item.icono,
      capacidadConcurrente: item.capacidadConcurrente,
      horario: item.horario,
      familias: item.familias.map((fila) => fila.familiaCodigo),
      empleados: item.empleados.map((fila) => ({
        id: fila.empleado.id,
        nombreCompleto: fila.empleado.nombreCompleto,
        sector: fila.empleado.sector,
      })),
      maquinas: item.maquinas.map((maquina) => ({
        id: maquina.id,
        codigo: maquina.codigo,
        nombre: maquina.nombre,
        centroCostoId: maquina.centroCostoPrincipalId,
      })),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
