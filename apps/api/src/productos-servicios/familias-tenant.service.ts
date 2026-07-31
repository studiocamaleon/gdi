/**
 * Familias de pasos del TENANT (pasos componibles, Etapa C).
 *
 * Este service es el dueño del ciclo de vida completo:
 *  - CRUD contra la tabla FamiliaTenant, con la validación de forma
 *    (familia-tenant-validacion.ts) como única puerta de escritura.
 *  - El registro en memoria que hace resolubles las familias de forma
 *    síncrona para el motor (pasos/familias.ts): se carga entero al bootear
 *    y se escribe-through en cada alta/edición/borrado.
 *  - El ruteo a estaciones NO se arma acá: la estación declara qué captura
 *    (por máquina/tecnología/paso/familia) desde su propio panel. El editor de
 *    pasos ya no asigna estación (rediseño, docs/estaciones-reglas-diseno.md).
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
import { loadTarifasHorarias } from './costing/load-tarifas';
import {
  cargarRegistroFamiliasTenant,
  quitarFamiliaTenantDelRegistro,
  registrarFamiliaTenant,
} from './pasos/familias';
import {
  derivarOutputsTenant,
  proyectarFamiliaTenant,
  validarDefinicionFamiliaTenant,
  type FamiliaTenantInput,
} from './pasos/familia-tenant-validacion';

export interface UpsertFamiliaTenantInput extends FamiliaTenantInput {
  /** E.1 — defaults declarados del paso (FamiliaPasoDefaults). */
  defaults?: DefaultsFamiliaInput | null;
}

/** E.1 — payload de defaults; null en un campo lo limpia. */
export interface DefaultsFamiliaInput {
  centroCostoId?: string | null;
  productividadHora?: number | null;
  tiempoFijoMin?: number | null;
  demasiaMm?: number | null;
  solapePanelMm?: number | null;
  /** E.2 — tercerización declarada del paso. */
  tercerizado?: boolean | null;
  proveedorId?: string | null;
  fuenteCostoTercerizado?: string | null;
  plazoProveedorDias?: number | null;
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
      // Fase D: la regla "por familia" vive en EstacionRegla (tipo='familia').
      this.prisma.estacionRegla.findMany({
        where: { tenantId, tipo: 'familia' },
        select: {
          valor: true,
          estacion: { select: { id: true, nombre: true } },
        },
      }),
    ]);
    const estacionPorFamilia = new Map(
      asignaciones.map((a) => [a.valor, a.estacion]),
    );
    // E.1 — defaults declarados, para precargar la edición en el wizard.
    const defaultsRows = await this.prisma.familiaPasoDefaults.findMany({
      where: { tenantId, familiaCodigo: { in: filas.map((f) => f.id) } },
    });
    const defaultsPorFamilia = new Map(
      defaultsRows.map((d) => [
        d.familiaCodigo,
        {
          centroCostoId: d.centroCostoId,
          productividadHora:
            d.productividadHora != null ? Number(d.productividadHora) : null,
          tiempoFijoMin:
            d.tiempoFijoMin != null ? Number(d.tiempoFijoMin) : null,
          demasiaMm: d.demasiaMm != null ? Number(d.demasiaMm) : null,
          solapePanelMm:
            d.solapePanelMm != null ? Number(d.solapePanelMm) : null,
          tercerizado: d.tercerizado,
          proveedorId: d.proveedorId,
          fuenteCostoTercerizado: d.fuenteCostoTercerizado,
          plazoProveedorDias: d.plazoProveedorDias,
        },
      ]),
    );
    return filas.map((fila) => ({
      ...fila,
      estacion: estacionPorFamilia.get(fila.id) ?? null,
      defaults: defaultsPorFamilia.get(fila.id) ?? null,
    }));
  }

  async crear(tenantId: string, input: UpsertFamiliaTenantInput) {
    // B.3.2 — los outputs no son texto libre: se DERIVAN de la forma. Lo
    // que venga en el input se descarta.
    input = { ...input, outputsCanonicos: derivarOutputsTenant(input) };
    const errores = validarDefinicionFamiliaTenant(input);
    if (errores.length > 0) {
      throw new BadRequestException([
        'La definición del paso tiene errores:',
        ...errores,
      ]);
    }
    try {
      const fila = await this.prisma.$transaction(async (tx) => {
        const creada = await tx.familiaTenant.create({
          data: this.aDatosDeFila(tenantId, input),
        });
        // E.1 — defaults declarados del paso, en la misma transacción.
        await this.upsertDefaultsEnTx(tx, tenantId, creada.id, input.defaults);
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
      // B.3.2 — siempre derivados de la forma mergeada (nunca del input ni
      // de la fila vieja): un PATCH cualquiera normaliza outputs legacy.
      outputsCanonicos: [],
      modoRegistro: input.modoRegistro ?? existente.modoRegistro,
      presetOrigen: input.presetOrigen ?? existente.presetOrigen,
      // `nestingConfig` presente en el patch (aunque sea null) = reemplazar;
      // ausente = conservar el de la fila.
      nestingConfig:
        'nestingConfig' in input
          ? input.nestingConfig
          : ((existente.nestingConfigJson as { superficie?: string } | null) ??
            null),
    };
    merged.outputsCanonicos = derivarOutputsTenant(merged);
    const errores = validarDefinicionFamiliaTenant(merged);
    if (errores.length > 0) {
      throw new BadRequestException([
        'La definición del paso tiene errores:',
        ...errores,
      ]);
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
        // E.1 — `defaults` presente en el patch = reemplazar; ausente = no tocar.
        if ('defaults' in input) {
          await this.upsertDefaultsEnTx(tx, tenantId, id, input.defaults);
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
      // Fase D: limpiar las reglas "por familia" que apuntan a esta familia.
      this.prisma.estacionRegla.deleteMany({
        where: { tenantId, tipo: 'familia', valor: id },
      }),
      this.prisma.familiaTenant.delete({ where: { id } }),
    ]);
    quitarFamiliaTenantDelRegistro(id);
    return { eliminada: true };
  }

  /**
   * Preview de costeo del wizard (Etapa D, §8.8: visible pero opcional).
   *
   * NO corre el motor entero — correrlo exige un producto con ruta y config
   * reales, que al crear la familia todavía no existen. Espeja la aritmética
   * EXACTA del motor para un paso sin máquina (F.2.10: totalMin/60 × tarifa
   * del centro × dotación) usando la MISMA tarifa publicada que usaría una
   * cotización real (loadTarifasHorarias, período actual). Si la fórmula del
   * motor cambia, el spec de este service lo pesca porque compara contra el
   * mismo redondeo (ceil de minutos).
   */
  async previewCosteo(
    tenantId: string,
    input: {
      cantidad: number;
      modoTiempo: string;
      tiempoFijoMin?: number;
      productividadPorHora?: number;
      dotacion?: number;
      centroCostoId: string;
    },
  ) {
    const cantidad = Math.max(0, Number(input.cantidad) || 0);
    const dotacion = Math.max(1, Number(input.dotacion) || 1);

    let runMin = 0;
    if (input.modoTiempo === 'T-1') {
      runMin = Math.max(0, Number(input.tiempoFijoMin) || 0);
    } else if (input.modoTiempo === 'T-2') {
      const productividad = Number(input.productividadPorHora) || 0;
      if (productividad <= 0) {
        throw new BadRequestException(
          'T-2 necesita una productividad por hora mayor a cero.',
        );
      }
      runMin = (cantidad / productividad) * 60;
    } else {
      throw new BadRequestException(
        'El preview soporta T-1 (tiempo fijo) y T-2 (productividad propia). T-3/T-4 dependen de la máquina o del comercial.',
      );
    }

    const centro = await this.prisma.centroCosto.findFirst({
      where: { id: input.centroCostoId, tenantId },
      select: { id: true, nombre: true },
    });
    if (!centro) {
      throw new BadRequestException('El centro de costo indicado no existe.');
    }

    const ahora = new Date();
    const periodo = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    const tarifas = await loadTarifasHorarias(this.prisma as never, {
      tenantId,
      periodo,
      centroCostoIds: [centro.id],
    });
    const tarifaHora = Number(
      (tarifas.get(centro.id) as { tarifa?: unknown } | undefined)?.tarifa ?? 0,
    );

    // Mismo redondeo que el motor: los minutos del paso se techan.
    const totalMin = Math.ceil(runMin);
    const costoTiempo = (totalMin / 60) * tarifaHora * dotacion;

    return {
      periodo,
      centroCostoNombre: centro.nombre,
      tarifaHora,
      tarifaPublicada: tarifaHora > 0,
      totalMin,
      dotacion,
      costoTiempo: Math.round(costoTiempo * 100) / 100,
      cantidad,
    };
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
      nestingConfigJson: input.nestingConfig?.superficie
        ? ({ superficie: input.nestingConfig.superficie } as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    };
  }

  /**
   * E.1 — Upsert de FamiliaPasoDefaults dentro de una transacción. Vacío o
   * todo-null borra la fila (sin defaults = sin fila, no una fila hueca).
   */
  private async upsertDefaultsEnTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    familiaCodigo: string,
    defaults: DefaultsFamiliaInput | null | undefined,
  ) {
    const limpio = {
      centroCostoId: defaults?.centroCostoId ?? null,
      productividadHora: defaults?.productividadHora ?? null,
      tiempoFijoMin: defaults?.tiempoFijoMin ?? null,
      demasiaMm: defaults?.demasiaMm ?? null,
      solapePanelMm: defaults?.solapePanelMm ?? null,
      tercerizado: defaults?.tercerizado ?? null,
      proveedorId: defaults?.proveedorId ?? null,
      fuenteCostoTercerizado: defaults?.fuenteCostoTercerizado ?? null,
      plazoProveedorDias: defaults?.plazoProveedorDias ?? null,
    };
    const tieneAlgoTercerizado = limpio.tercerizado === true;
    if (tieneAlgoTercerizado && limpio.proveedorId) {
      const proveedor = await tx.proveedor.findFirst({
        where: { id: limpio.proveedorId, tenantId },
        select: { id: true },
      });
      if (!proveedor) {
        throw new BadRequestException('El proveedor del default no existe.');
      }
    }
    const tieneAlgo = Object.values(limpio).some((v) => v !== null);
    if (!tieneAlgo) {
      await tx.familiaPasoDefaults.deleteMany({
        where: { tenantId, familiaCodigo },
      });
      return;
    }
    if (limpio.centroCostoId) {
      const centro = await tx.centroCosto.findFirst({
        where: { id: limpio.centroCostoId, tenantId },
        select: { id: true },
      });
      if (!centro) {
        throw new BadRequestException(
          'El centro de costo del default no existe.',
        );
      }
    }
    await tx.familiaPasoDefaults.upsert({
      where: { tenantId_familiaCodigo: { tenantId, familiaCodigo } },
      create: { tenantId, familiaCodigo, ...limpio },
      update: limpio,
    });
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
