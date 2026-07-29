/**
 * Familias de pasos del TENANT (pasos componibles, Etapa C).
 *
 * Este service es el dueño del ciclo de vida completo:
 *  - CRUD contra la tabla FamiliaTenant, con la validación de forma
 *    (familia-tenant-validacion.ts) como única puerta de escritura.
 *  - El registro en memoria que hace resolubles las familias de forma
 *    síncrona para el motor (pasos/familias.ts): se carga entero al bootear
 *    y se escribe-through en cada alta/edición/borrado.
 *  - El ruteo a estaciones NO se duplica acá: se escribe en EstacionFamilia
 *    (la fuente de verdad que ya usa el tablero) con familiaCodigo = UUID.
 *
 * Borrado (decisión §8.6): físico sólo si NINGUNA ruta/paso-extra/OT la
 * referenció jamás; con un solo uso histórico, inhabilitar. El resolver
 * sigue resolviendo inhabilitadas — `activo` sólo filtra selectores.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  cargarRegistroFamiliasTenant,
  quitarFamiliaTenantDelRegistro,
  registrarFamiliaTenant,
} from './pasos/familias';
import {
  proyectarFamiliaTenant,
  validarDefinicionFamiliaTenant,
  type FamiliaTenantInput,
} from './pasos/familia-tenant-validacion';

export interface UpsertFamiliaTenantInput extends FamiliaTenantInput {
  /** Estación donde se hace el paso (decisión §8.4). null = quitarla. */
  estacionId?: string | null;
}

@Injectable()
export class FamiliasTenantService implements OnModuleInit {
  private readonly logger = new Logger(FamiliasTenantService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Boot: TODAS las familias tenant (de todos los tenants, incluidas las
   *  inhabilitadas) entran al registro síncrono del resolver. */
  async onModuleInit() {
    const filas = await this.prisma.familiaTenant.findMany();
    cargarRegistroFamiliasTenant(filas.map(proyectarFamiliaTenant));
    if (filas.length > 0) {
      this.logger.log(`Registro de familias tenant: ${filas.length} cargadas`);
    }
  }

  async listar(tenantId: string) {
    const [filas, asignaciones] = await Promise.all([
      this.prisma.familiaTenant.findMany({
        where: { tenantId },
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      }),
      this.prisma.estacionFamilia.findMany({
        where: { tenantId },
        select: {
          familiaCodigo: true,
          estacion: { select: { id: true, nombre: true } },
        },
      }),
    ]);
    const estacionPorFamilia = new Map(
      asignaciones.map((a) => [a.familiaCodigo, a.estacion]),
    );
    return filas.map((fila) => ({
      ...fila,
      estacion: estacionPorFamilia.get(fila.id) ?? null,
    }));
  }

  async crear(tenantId: string, input: UpsertFamiliaTenantInput) {
    const errores = validarDefinicionFamiliaTenant(input);
    if (errores.length > 0) {
      throw new BadRequestException({
        message: 'La definición del paso tiene errores.',
        errores,
      });
    }
    if (input.estacionId) {
      await this.assertEstacionDelTenant(tenantId, input.estacionId);
    }

    try {
      const fila = await this.prisma.$transaction(async (tx) => {
        const creada = await tx.familiaTenant.create({
          data: this.aDatosDeFila(tenantId, input),
        });
        if (input.estacionId) {
          await tx.estacionFamilia.create({
            data: {
              tenantId,
              estacionId: input.estacionId,
              familiaCodigo: creada.id,
            },
          });
        }
        return creada;
      });
      registrarFamiliaTenant(proyectarFamiliaTenant(fila));
      return fila;
    } catch (error) {
      this.reLanzarNombreDuplicado(error, input.nombre);
      throw error;
    }
  }

  async actualizar(
    tenantId: string,
    id: string,
    input: Partial<UpsertFamiliaTenantInput> & { activo?: boolean },
  ) {
    const existente = await this.prisma.familiaTenant.findFirst({
      where: { id, tenantId },
    });
    if (!existente) throw new NotFoundException('Familia no encontrada.');

    // PATCH parcial: se valida el MERGE, no el fragmento — así un patch no
    // puede dejar en la base una forma que entera no validaría.
    const merged: FamiliaTenantInput = {
      nombre: input.nombre ?? existente.nombre,
      descripcion: input.descripcion ?? existente.descripcion,
      categoria: input.categoria ?? existente.categoria,
      relacionMaquina:
        input.relacionMaquina ?? (existente.relacionMaquina as string[]),
      modosTiempo: input.modosTiempo ?? (existente.modosTiempo as string[]),
      mecanismosCantidad:
        input.mecanismosCantidad ?? (existente.mecanismosCantidad as string[]),
      modosActivacion:
        input.modosActivacion ?? (existente.modosActivacion as string[]),
      modoActivacionDefault:
        input.modoActivacionDefault ?? existente.modoActivacionDefault,
      slots:
        input.slots ??
        (existente.slots as unknown as FamiliaTenantInput['slots']),
      multiplicadores:
        input.multiplicadores ?? (existente.multiplicadores as string[]),
      plantillasCompatibles:
        input.plantillasCompatibles ??
        (existente.plantillasCompatibles as string[]),
      tiposPerfilCompatibles:
        input.tiposPerfilCompatibles ??
        (existente.tiposPerfilCompatibles as string[] | null) ??
        undefined,
      inputsRequeridos:
        input.inputsRequeridos ?? (existente.inputsRequeridos as string[]),
      outputsCanonicos:
        input.outputsCanonicos ?? (existente.outputsCanonicos as string[]),
      modoRegistro: input.modoRegistro ?? existente.modoRegistro,
      presetOrigen: input.presetOrigen ?? existente.presetOrigen,
    };
    const errores = validarDefinicionFamiliaTenant(merged);
    if (errores.length > 0) {
      throw new BadRequestException({
        message: 'La definición del paso tiene errores.',
        errores,
      });
    }
    if (input.estacionId) {
      await this.assertEstacionDelTenant(tenantId, input.estacionId);
    }

    try {
      const fila = await this.prisma.$transaction(async (tx) => {
        const actualizada = await tx.familiaTenant.update({
          where: { id },
          data: {
            ...this.aDatosDeFila(tenantId, merged),
            tenantId: undefined,
            ...(typeof input.activo === 'boolean'
              ? { activo: input.activo }
              : {}),
          },
        });
        // estacionId presente en el patch (aunque sea null) = reemplazar la
        // asignación. Ausente = no tocarla.
        if ('estacionId' in input) {
          await tx.estacionFamilia.deleteMany({
            where: { tenantId, familiaCodigo: id },
          });
          if (input.estacionId) {
            await tx.estacionFamilia.create({
              data: {
                tenantId,
                estacionId: input.estacionId,
                familiaCodigo: id,
              },
            });
          }
        }
        return actualizada;
      });
      registrarFamiliaTenant(proyectarFamiliaTenant(fila));
      return fila;
    } catch (error) {
      this.reLanzarNombreDuplicado(error, merged.nombre);
      throw error;
    }
  }

  /** Borrado físico sólo si es virgen (§8.6); si tiene usos, 409 con la
   *  salida correcta (inhabilitar). */
  async eliminar(tenantId: string, id: string) {
    const existente = await this.prisma.familiaTenant.findFirst({
      where: { id, tenantId },
    });
    if (!existente) throw new NotFoundException('Familia no encontrada.');

    const [enRutas, enPasosExtra, enOts] = await Promise.all([
      this.prisma.rutaPaso.count({
        where: { familiaCodigo: id, ruta: { tenantId } },
      }),
      this.prisma.productoPasoExtra.count({
        where: { tenantId, familiaCodigo: id },
      }),
      this.prisma.ordenTrabajoItemPaso.count({
        where: { tenantId, familiaCodigo: id },
      }),
    ]);
    const usos = enRutas + enPasosExtra + enOts;
    if (usos > 0) {
      throw new ConflictException(
        `"${existente.nombre}" ya fue usada (${enRutas} paso(s) de ruta, ${enPasosExtra} paso(s) extra, ${enOts} paso(s) de OT): no se puede borrar sin dejar esos registros mudos. Inhabilitala — desaparece de los selectores y todo lo histórico sigue leyéndose.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.estacionFamilia.deleteMany({
        where: { tenantId, familiaCodigo: id },
      }),
      this.prisma.familiaTenant.delete({ where: { id } }),
    ]);
    quitarFamiliaTenantDelRegistro(id);
    return { eliminada: true };
  }

  private aDatosDeFila(
    tenantId: string,
    input: FamiliaTenantInput,
  ): Prisma.FamiliaTenantUncheckedCreateInput {
    return {
      tenantId,
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      categoria: input.categoria,
      relacionMaquina: input.relacionMaquina,
      modosTiempo: input.modosTiempo,
      mecanismosCantidad: input.mecanismosCantidad,
      modosActivacion: input.modosActivacion ?? [
        'OBLIGATORIO',
        'OPCIONAL',
        'CONDICIONAL',
        'NO_EJECUTAR',
      ],
      modoActivacionDefault: input.modoActivacionDefault ?? 'OPCIONAL',
      slots: (input.slots ?? []) as unknown as Prisma.InputJsonValue,
      multiplicadores: input.multiplicadores ?? [],
      plantillasCompatibles: input.plantillasCompatibles ?? [],
      tiposPerfilCompatibles: input.tiposPerfilCompatibles ?? undefined,
      inputsRequeridos: input.inputsRequeridos ?? [],
      outputsCanonicos: input.outputsCanonicos ?? [],
      validaciones: [],
      modoRegistro: input.modoRegistro ?? null,
      presetOrigen: input.presetOrigen ?? null,
    };
  }

  private async assertEstacionDelTenant(tenantId: string, estacionId: string) {
    const estacion = await this.prisma.estacion.findFirst({
      where: { id: estacionId, tenantId },
      select: { id: true },
    });
    if (!estacion) {
      throw new BadRequestException('La estación indicada no existe.');
    }
  }

  private reLanzarNombreDuplicado(error: unknown, nombre: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        `Ya existe un paso llamado "${nombre}" en esta empresa.`,
      );
    }
  }
}
