import { admitePasoSinMaquina } from '../productos-servicios/pasos/ruteo-maquina';
import { leerModoOperacionMaquina } from '../eta/motor/demanda-humana';
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
import {
  FAMILIAS,
  resolverFamilia,
} from '../productos-servicios/pasos/familias';
import {
  normalizarCalendarioAlmacenado,
  parseCalendario,
  type CalendarioEstacion,
} from './calendario';
import type { EstructuraBastidorEjecutada } from '../motor-universal/tipos';
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
  equipoProduccion: true,
  // Fase D: la regla "por familia" vive en EstacionRegla (tipo='familia'), junto
  // con tecnología/paso. Ya no se lee EstacionFamilia (legacy, sólo respaldo).
  reglas: { select: { tipo: true, valor: true } },
  empleados: {
    include: {
      empleado: { select: { id: true, nombreCompleto: true, sector: true } },
    },
  },
  maquinas: {
    // El id identifica la máquina cotizada; el centro se conserva para costeo.
    select: {
      id: true,
      codigo: true,
      nombre: true,
      centroCostoPrincipalId: true,
      activo: true,
      parametrosTecnicosJson: true,
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

  async findEstaciones(tenantId: string, db: Prisma.TransactionClient = this.prisma) {
    const rows = await db.estacion.findMany({
      where: { tenantId: tenantId },
      include: ESTACION_INCLUDE,
      orderBy: [{ nombre: 'asc' }],
    });
    return rows.map((item) => this.toEstacion(item));
  }

  async recursosEstaciones(tenantId: string) {
    const [empleados, maquinas] = await Promise.all([
      this.prisma.empleado.findMany({
        where: { tenantId, activo: true },
        select: { id: true, nombreCompleto: true, sector: true },
        orderBy: { nombreCompleto: 'asc' },
      }),
      this.prisma.maquina.findMany({
        where: { tenantId, activo: true },
        select: { id: true, codigo: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);
    return { empleados, maquinas };
  }

  /**
   * Catálogo de familias de pasos (fuente de verdad: el catálogo del motor)
   * + qué estación tiene tomada cada una, para el picker del panel.
   */
  async findFamiliasPasos(auth: CurrentAuth) {
    // Fase D: las reglas "por familia" viven en EstacionRegla (tipo='familia').
    const asignadas = await this.prisma.estacionRegla.findMany({
      where: { tenantId: auth.tenantId, tipo: { in: ['familia', 'paso'] } },
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
      const lista = porFamilia.get(fila.valor) ?? [];
      lista.push({
        id: fila.estacion.id,
        nombre: fila.estacion.nombre,
        conMaquinas: fila.estacion.maquinas.length > 0,
      });
      porFamilia.set(fila.valor, lista);
    }
    // Catálogo del sistema + familias del TENANT (pasos componibles, Etapa
    // C): las dos tienen que poder asignarse a una estación, así que el
    // picker lista ambas. Las tenant inhabilitadas no se ofrecen.
    const pasosTenant = await this.prisma.pasoTenant.findMany({
      where: { tenantId: auth.tenantId, activo: true },
      select: { id: true, nombre: true, plantillaCodigo: true },
      orderBy: { nombre: 'asc' },
    });
    return [
      ...Object.values(FAMILIAS).filter((f) => admitePasoSinMaquina(f.codigo)).map((familia) => ({
        codigo: familia.codigo as string,
        nombre: familia.nombre,
        categoria: familia.categoria as string,
        visibleEnSelector: familia.visibleEnSelector !== false,
        origen: 'sistema' as const,
        estaciones: porFamilia.get(familia.codigo) ?? [],
      })),
      // La instancia HEREDA la categoría de su plantilla; y si no tiene
      // regla propia de estación, hereda la de la plantilla (se puede
      // cambiar). docs/pasos-tenant-por-plantilla-diseno.md
      ...pasosTenant.filter((p) => admitePasoSinMaquina(p.plantillaCodigo)).map((paso) => ({
        codigo: paso.id,
        nombre: paso.nombre,
        categoria: (resolverFamilia(paso.plantillaCodigo)?.categoria ??
          'operaciones_manuales') as string,
        visibleEnSelector: true,
        origen: 'tenant' as const,
        estaciones:
          porFamilia.get(paso.id) ?? [],
      })),
    ];
  }

  /**
   * Mediana histórica de duración REAL por familia de pasos (fallback de
   * `duracionEstimadaMin` para la cola del tablero, D6 del doc de capacidad):
   * `tiempoRealMin` de los pasos `hecho` del tenant, SOLO fuentes medidas
   * (D14 de registro-tiempos: 'estimado' acá cerraría el círculo
   * estimado→"real"→estimado, y 'declarado' es percepción, no medición).
   * Mediana y no promedio: resiste el outlier.
   */
  async findDuracionesFamilias(tenantId: string, db: Prisma.TransactionClient = this.prisma) {
    const rows = await db.$queryRaw<
      Array<{ familiaCodigo: string; medianaMin: number; muestras: number }>
    >`
      SELECT "familiaCodigo",
             percentile_cont(0.5) WITHIN GROUP (
               ORDER BY "tiempoRealMin"
             ) AS "medianaMin",
             COUNT(*)::int AS "muestras"
      FROM "OrdenTrabajoItemPaso"
      WHERE "tenantId" = ${tenantId}::uuid
        AND "estado" = 'hecho'
        AND "tiempoRealMin" IS NOT NULL
        AND "tiempoFuente" IN ('medido', 'medido_lote')
        AND "nestingLoteRol" IS DISTINCT FROM 'PARTICIPANTE'
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

  /**
   * Estructura del bastidor de un ítem, para el visor 3D.
   *
   * Sale del SNAPSHOT del ítem: el paso de bastidor persiste su estructura
   * efectiva (con overrides del sheet) en la trazabilidad. Un ítem cotizado
   * antes de esa persistencia no la tiene → 404 (se re-cotiza). No se lee la
   * config de la ruta a propósito: sería el default, no lo que se va a fabricar.
   *
   * `itemId` acepta un ítem de OT **o un CotizacionItem directo**: en el
   * cotizador el bastidor tiene que verse ANTES de emitir la OT (el dato ya
   * existe — la trazabilidad vive en el CotizacionItem; el camino OT siempre
   * la leyó de ahí vía relación).
   */
  async estructuraBastidor(
    auth: CurrentAuth,
    itemId: string,
  ): Promise<EstructuraBastidorEjecutada> {
    const item = await this.prisma.ordenTrabajoItem.findFirst({
      where: { id: itemId, tenantId: auth.tenantId },
      select: { trazabilidadSnapshotJson: true, cotizacionItem: { select: { trazabilidadJson: true } } },
    });

    let trazabilidad = item?.trazabilidadSnapshotJson ?? item?.cotizacionItem?.trazabilidadJson ?? null;
    if (!item) {
      // Borrador del cotizador: el id es el CotizacionItem, sin OT todavía.
      const cotizacionItem = await this.prisma.cotizacionItem.findFirst({
        where: { id: itemId, tenantId: auth.tenantId },
        select: { trazabilidadJson: true },
      });
      if (!cotizacionItem) {
        throw new NotFoundException('No se encontró el ítem.');
      }
      trazabilidad = cotizacionItem.trazabilidadJson;
    }

    const pasos = ((trazabilidad as { pasos?: unknown[] } | null)?.pasos ??
      []) as Array<{
      estructuraBastidor?: EstructuraBastidorEjecutada;
    }>;
    const estructura = pasos.find(
      (paso) => paso.estructuraBastidor,
    )?.estructuraBastidor;
    if (!estructura) {
      throw new NotFoundException(
        'El ítem no tiene estructura de bastidor en el snapshot (si es anterior a esta función, re-cotizalo).',
      );
    }
    return estructura;
  }

  // ── Configuración de producción (margen de la ETA sugerida) ──────────

  async getConfiguracion(tenantId: string, db: Prisma.TransactionClient = this.prisma) {
    const row = await db.configuracionProduccion.findUnique({
      where: { tenantId: tenantId },
    });
    return {
      margenEtaDias: row?.margenEtaDias ?? 0,
      tiempoEntrePasosMin: row?.tiempoEntrePasosMin ?? 0,
      corteJornada: row?.corteJornada ?? '20:00',
    };
  }

  async actualizarConfiguracion(
    auth: CurrentAuth,
    payload: ActualizarConfiguracionProduccionDto,
  ) {
    const row = await this.prisma.configuracionProduccion.upsert({
      where: { tenantId: auth.tenantId },
      create: {
        tenantId: auth.tenantId,
        margenEtaDias: payload.margenEtaDias,
        tiempoEntrePasosMin: payload.tiempoEntrePasosMin ?? 0,
        ...(payload.corteJornada ? { corteJornada: payload.corteJornada } : {}),
      },
      update: {
        margenEtaDias: payload.margenEtaDias,
        ...(payload.tiempoEntrePasosMin !== undefined
          ? { tiempoEntrePasosMin: payload.tiempoEntrePasosMin }
          : {}),
        ...(payload.corteJornada ? { corteJornada: payload.corteJornada } : {}),
      },
    });
    return {
      margenEtaDias: row.margenEtaDias,
      corteJornada: row.corteJornada,
      tiempoEntrePasosMin: row.tiempoEntrePasosMin,
    };
  }

  // ── Días no laborables (feriados y cierres del taller) ───────────────
  // Fechas puntuales a nivel tenant que la proyección de cola y la
  // simulación de flujo saltan. Ver docs/capacidad-estaciones-diseno.md D8.

  async findDiasNoLaborables(tenantId: string, db: Prisma.TransactionClient = this.prisma) {
    const rows = await db.diaNoLaborable.findMany({
      where: { tenantId: tenantId },
      orderBy: { fecha: 'asc' },
    });
    return rows.map((row) => this.toDiaNoLaborable(row));
  }

  async crearDiaNoLaborable(
    auth: CurrentAuth,
    payload: CrearDiaNoLaborableDto,
  ) {
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
        throw new ConflictException(
          'Esa fecha ya está cargada como no laborable.',
        );
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
    if (payload.equipoProduccionId && !(await this.prisma.equipoProduccion.findFirst({
      where: { id: payload.equipoProduccionId, tenantId: auth.tenantId }, select: { id: true },
    }))) throw new BadRequestException('El equipo de producción no pertenece a esta empresa.');
    if ((payload.reglas ?? []).some((r) => r.tipo === 'tecnologia')) {
      throw new BadRequestException('Las tareas con máquina se asignan mediante la máquina. Actualizá la pantalla de estaciones.');
    }
    const familias = [...new Set([
      ...(payload.familias ?? []),
      ...(payload.reglas ?? []).filter((r) => r.tipo === 'paso').map((r) => r.valor),
    ])];
    const reglas: Array<{ tipo: 'paso'; valor: string }> = [];
    const empleadoIds = [...new Set(payload.empleadoIds ?? [])];
    const maquinaIds = [...new Set(payload.maquinaIds ?? [])];
    // Siempre verificar pertenencia de los UUID, aunque el registro en memoria
    // conozca pasos de otras empresas.
    const codigosPropios = familias.filter((codigo) => !Object.hasOwn(FAMILIAS, codigo));
    const propios = codigosPropios.length ? await this.prisma.pasoTenant.findMany({
      where: { tenantId: auth.tenantId, id: { in: codigosPropios }, activo: true },
      select: { id: true, plantillaCodigo: true },
    }) : [];
    const plantillaPorId = new Map(propios.map((p) => [p.id, p.plantillaCodigo]));
    for (const codigo of familias) {
      const plantilla = Object.hasOwn(FAMILIAS, codigo) ? codigo : plantillaPorId.get(codigo);
      if (!plantilla) throw new BadRequestException('Algún paso no existe o no pertenece a esta empresa.');
      if (!admitePasoSinMaquina(plantilla)) throw new BadRequestException(
        `“${resolverFamilia(plantilla)?.nombre ?? codigo}” requiere máquina. Asigná su máquina a la estación.`,
      );
    }
    if (familias.length) {
      const tomadas = await this.prisma.estacionRegla.findMany({
        where: {
          tenantId: auth.tenantId, tipo: { in: ['familia', 'paso'] }, valor: { in: familias },
          ...(exceptoEstacionId ? { estacionId: { not: exceptoEstacionId } } : {}),
        },
        include: { estacion: { select: { nombre: true } } },
      });
      if (tomadas.length) throw new ConflictException(
        `Estos pasos sin máquina ya están asignados: ${tomadas.map((r) =>
          `${resolverFamilia(r.valor)?.nombre ?? r.valor} (en “${r.estacion.nombre}”)`).join(' · ')}. Cada paso se configura en una sola estación.`,
      );
    }

    if (empleadoIds.length > 0) {
      const encontrados = await this.prisma.empleado.count({
        where: {
          tenantId: auth.tenantId,
          id: { in: empleadoIds },
          activo: true,
        },
      });
      if (encontrados !== empleadoIds.length) {
        throw new NotFoundException(
          'Algún empleado no existe o está dado de baja.',
        );
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

    return { familias, empleadoIds, maquinaIds, reglas };
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
      reglas: Array<{ tipo: string; valor: string }>;
    },
  ) {
    // Fase D: todo el ruteo declarado (familia + tecnología + paso) vive en
    // EstacionRegla; se reemplaza entero. Ya no se escribe EstacionFamilia.
    await tx.estacionRegla.deleteMany({
      where: { tenantId: auth.tenantId, estacionId },
    });
    const reglasAEscribir = [
      ...listas.familias.map((valor) => ({ tipo: 'familia', valor })),
      ...listas.reglas.map((regla) => ({
        tipo: regla.tipo,
        valor: regla.valor,
      })),
    ];
    if (reglasAEscribir.length > 0) {
      await tx.estacionRegla.createMany({
        data: reglasAEscribir.map((regla) => ({
          tenantId: auth.tenantId,
          estacionId,
          tipo: regla.tipo,
          valor: regla.valor,
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

  /** Revalida dentro de la transacción, después del bloqueo por empresa. No
   * impide corregir una estación por conflictos históricos en otras reglas. */
  private async validarInvariantesRuteo(tx: Prisma.TransactionClient, tenantId: string, familias: string[]) {
    if (!familias.length) return;
    const reglas = await tx.estacionRegla.findMany({
      where: { tenantId, tipo: { in: ['familia', 'paso'] }, valor: { in: familias } },
      select: { valor: true, estacionId: true, estacion: { select: { nombre: true } } },
    });
    const dueñas = new Map<string, Map<string, string>>();
    for (const regla of reglas) {
      const mapa = dueñas.get(regla.valor) ?? new Map<string, string>();
      mapa.set(regla.estacionId, regla.estacion.nombre);
      dueñas.set(regla.valor, mapa);
    }
    for (const [codigo, mapa] of dueñas) if (mapa.size > 1) throw new ConflictException(
      `El paso sin máquina “${resolverFamilia(codigo)?.nombre ?? codigo}” está repetido en ${[...mapa.values()].join(', ')}.`,
    );
  }

  async createEstacion(auth: CurrentAuth, payload: UpsertEstacionDto) {
    const listas = await this.validarReferencias(auth, payload);
    try {
      const creada = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${auth.tenantId}::uuid FOR UPDATE`;
        const estacion = await tx.estacion.create({
          data: {
            tenantId: auth.tenantId,
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            activo: payload.activo ?? true,
            etapa: payload.etapa ?? 'preprensa',
            icono: payload.icono?.trim() || null,
            capacidadConcurrente: payload.capacidadConcurrente ?? 1,
            equipoProduccionId: payload.equipoProduccionId ?? null,
            tiempoPreparacionMin: payload.tiempoPreparacionMin ?? null,
            calendarioJson: calendarioAJson(
              parseCalendario(payload.calendario),
            ),
          },
        });
        await this.sincronizarListas(tx, auth, estacion.id, listas);
        await this.validarInvariantesRuteo(tx, auth.tenantId, listas.familias);
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
        await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${auth.tenantId}::uuid FOR UPDATE`;
        await tx.estacion.update({
          where: { id },
          data: {
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            activo: payload.activo,
            equipoProduccionId: payload.equipoProduccionId,
            etapa: payload.etapa ?? existing.etapa,
            icono: payload.icono?.trim() || null,
            capacidadConcurrente:
              payload.capacidadConcurrente ?? existing.capacidadConcurrente,
            tiempoPreparacionMin:
              payload.tiempoPreparacionMin !== undefined
                ? payload.tiempoPreparacionMin
                : existing.tiempoPreparacionMin,
            // undefined = no tocar; null explícito = borrar el calendario.
            calendarioJson:
              payload.calendario === undefined
                ? undefined
                : calendarioAJson(parseCalendario(payload.calendario)),
          },
        });
        await this.sincronizarListas(tx, auth, id, listas);
        await this.validarInvariantesRuteo(tx, auth.tenantId, listas.familias);
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
      equipoProduccionId: item.equipoProduccionId,
      equipoProduccion: item.equipoProduccion ? {
        id: item.equipoProduccion.id,
        nombre: item.equipoProduccion.nombre,
        personas: item.equipoProduccion.personas,
        activo: item.equipoProduccion.activo,
        calendario: normalizarCalendarioAlmacenado(item.equipoProduccion.calendarioJson),
      } : null,
      tiempoPreparacionMin: item.tiempoPreparacionMin,
      // Normaliza el shape legado (una franja suelta por día) al de listas.
      calendario: normalizarCalendarioAlmacenado(item.calendarioJson),
      // Fase D: familia y tecnología/paso salen de EstacionRegla. El shape de la
      // API no cambia (el front sigue viendo `familias` y `reglas` separadas).
      pasosSinMaquina: [...new Set(item.reglas.filter((r) =>
        (r.tipo === 'familia' || r.tipo === 'paso') && admitePasoSinMaquina(r.valor),
      ).map((r) => r.valor))],
      familias: item.reglas
        .filter((r) => r.tipo === 'familia' && admitePasoSinMaquina(r.valor))
        .map((r) => r.valor),
      reglas: item.reglas
        .filter((r) => r.tipo === 'paso' && admitePasoSinMaquina(r.valor))
        .map((r) => ({ tipo: r.tipo, valor: r.valor })),
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
        activo: maquina.activo,
        operacionMaquina: leerModoOperacionMaquina((maquina.parametrosTecnicosJson as Record<string, unknown> | null)?.operacionMaquina),
      })),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
