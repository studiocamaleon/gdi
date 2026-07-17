import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertEstacionDto } from './dto/upsert-estacion.dto';
import type { CrearDiaNoLaborableDto } from './dto/crear-dia-no-laborable.dto';
import type { ActualizarConfiguracionProduccionDto } from './dto/actualizar-configuracion-produccion.dto';
import { FAMILIAS } from '../productos-servicios/pasos/familias';
import type { FamiliaCodigo } from '../productos-servicios/pasos/types';
import { parseCalendario, type CalendarioEstacion } from './calendario';

/**
 * Mínimo de pasos hechos por familia para publicar su mediana histórica:
 * no se proyecta cola sobre anécdota (D6 de capacidad-estaciones-diseno.md).
 */
const MIN_MUESTRAS_MEDIANA = 3;

/** Serializa el calendario validado para la columna Json nullable. */
function calendarioAJson(calendario: CalendarioEstacion | null) {
  return calendario === null
    ? Prisma.DbNull
    : (calendario as unknown as Prisma.InputJsonValue);
}

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
   * Mediana histórica de duración REAL por familia de pasos (fallback de
   * `duracionEstimadaMin` para la cola del tablero, D6 del doc de capacidad):
   * completadoEl − iniciadoEl de los pasos `hecho` del tenant, sólo familias
   * con muestras suficientes. Mediana y no promedio: resiste el paso que
   * quedó abierto un fin de semana.
   */
  async findDuracionesFamilias(auth: CurrentAuth) {
    const rows = await this.prisma.$queryRaw<
      Array<{ familiaCodigo: string; medianaMin: number; muestras: number }>
    >`
      SELECT "familiaCodigo",
             percentile_cont(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM ("completadoEl" - "iniciadoEl")) / 60.0
             ) AS "medianaMin",
             COUNT(*)::int AS "muestras"
      FROM "OrdenTrabajoItemPaso"
      WHERE "tenantId" = ${auth.tenantId}::uuid
        AND "estado" = 'hecho'
        AND "iniciadoEl" IS NOT NULL
        AND "completadoEl" IS NOT NULL
        AND "completadoEl" > "iniciadoEl"
      GROUP BY "familiaCodigo"
      HAVING COUNT(*) >= ${MIN_MUESTRAS_MEDIANA}
      ORDER BY "familiaCodigo" ASC
    `;
    return rows.map((row) => ({
      familiaCodigo: row.familiaCodigo,
      medianaMin: Math.round(Number(row.medianaMin) * 10) / 10,
      muestras: Number(row.muestras),
    }));
  }

  // ── Configuración de producción (margen de la ETA sugerida) ──────────

  async getConfiguracion(auth: CurrentAuth) {
    const row = await this.prisma.configuracionProduccion.findUnique({
      where: { tenantId: auth.tenantId },
    });
    return { margenEtaDias: row?.margenEtaDias ?? 0 };
  }

  async actualizarConfiguracion(
    auth: CurrentAuth,
    payload: ActualizarConfiguracionProduccionDto,
  ) {
    const row = await this.prisma.configuracionProduccion.upsert({
      where: { tenantId: auth.tenantId },
      create: { tenantId: auth.tenantId, margenEtaDias: payload.margenEtaDias },
      update: { margenEtaDias: payload.margenEtaDias },
    });
    return { margenEtaDias: row.margenEtaDias };
  }

  // ── Días no laborables (feriados y cierres del taller) ───────────────
  // Fechas puntuales a nivel tenant que la proyección de cola y la
  // simulación de flujo saltan. Ver docs/capacidad-estaciones-diseno.md D8.

  async findDiasNoLaborables(auth: CurrentAuth) {
    const rows = await this.prisma.diaNoLaborable.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { fecha: 'asc' },
    });
    return rows.map((row) => this.toDiaNoLaborable(row));
  }

  async crearDiaNoLaborable(auth: CurrentAuth, payload: CrearDiaNoLaborableDto) {
    // El DTO valida el formato; acá el calendario real (30/02 → inválida).
    const fecha = new Date(`${payload.fecha}T00:00:00.000Z`);
    if (
      Number.isNaN(fecha.getTime()) ||
      fecha.toISOString().slice(0, 10) !== payload.fecha
    ) {
      throw new BadRequestException(`"${payload.fecha}" no es una fecha real.`);
    }
    try {
      const creado = await this.prisma.diaNoLaborable.create({
        data: {
          tenantId: auth.tenantId,
          fecha,
          descripcion: payload.descripcion?.trim() || null,
        },
      });
      return this.toDiaNoLaborable(creado);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Esa fecha ya está cargada como no laborable.');
      }
      throw error;
    }
  }

  async eliminarDiaNoLaborable(auth: CurrentAuth, id: string) {
    const existing = await this.prisma.diaNoLaborable.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Día no laborable no encontrado.');
    }
    await this.prisma.diaNoLaborable.delete({ where: { id } });
    return { ok: true };
  }

  private toDiaNoLaborable(row: {
    id: string;
    fecha: Date;
    descripcion: string | null;
  }) {
    return {
      id: row.id,
      fecha: row.fecha.toISOString().slice(0, 10),
      descripcion: row.descripcion ?? '',
    };
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
            calendarioJson: calendarioAJson(parseCalendario(payload.calendario)),
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
            // undefined = no tocar; null explícito = borrar el calendario.
            calendarioJson:
              payload.calendario === undefined
                ? undefined
                : calendarioAJson(parseCalendario(payload.calendario)),
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
      calendario: (item.calendarioJson as CalendarioEstacion | null) ?? null,
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
