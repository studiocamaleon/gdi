/**
 * Pasos propios del TENANT: instancias de una plantilla del catálogo del
 * sistema (docs/pasos-tenant-por-plantilla-diseno.md).
 *
 * Reemplaza a `familias-tenant.service.ts`, que era dueño de un CRUD sobre
 * una FORMA declarada por el tenant. Ahora la forma se HEREDA de la
 * plantilla, así que este service sólo administra: identidad (nombre,
 * descripción, ícono), defaults del taller y ciclo de vida.
 *
 *  - El registro en memoria (pasos/familias.ts) sigue haciendo resolubles
 *    las instancias de forma SÍNCRONA para el motor: se carga entero al
 *    bootear y se escribe-through en cada alta/edición/borrado. Lo que entra
 *    al registro ya viene proyectado sobre su plantilla — de ahí la herencia.
 *  - El ruteo a estaciones no se arma acá: la instancia hereda la regla de
 *    su plantilla y puede tener la suya propia (EstacionRegla tipo 'familia'
 *    acepta tanto códigos del sistema como ids de instancia).
 *
 * Borrado: físico sólo si NINGUNA ruta/paso-extra/OT la referenció jamás;
 * con un solo uso histórico, inhabilitar. El resolver sigue resolviendo
 * inhabilitadas — `activo` sólo filtra selectores.
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
  cargarRegistroPasosTenant,
  quitarPasoTenantDelRegistro,
  registrarPasoTenant,
} from './pasos/familias';
import {
  nombrePlantilla,
  plantillasInstanciables,
  proyectarPasoTenant,
  validarPasoTenant,
  type PasoTenantInput,
} from './pasos/paso-tenant';

/** Defaults del taller; null en un campo lo limpia. */
export interface DefaultsPasoTenantInput {
  centroCostoId?: string | null;
  productividadHora?: number | null;
  tiempoFijoMin?: number | null;
  demasiaMm?: number | null;
  solapePanelMm?: number | null;
  tercerizado?: boolean | null;
  proveedorId?: string | null;
  fuenteCostoTercerizado?: string | null;
  plazoProveedorDias?: number | null;
}

export interface UpsertPasoTenantInput extends PasoTenantInput {
  defaults?: DefaultsPasoTenantInput | null;
  activo?: boolean;
}

@Injectable()
export class PasosTenantService implements OnModuleInit {
  private readonly logger = new Logger(PasosTenantService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Boot: TODAS las instancias (de todos los tenants, incluidas las
   *  inhabilitadas) entran proyectadas al registro síncrono del resolver. */
  async onModuleInit() {
    const filas = await this.prisma.pasoTenant.findMany();
    const proyectadas = filas
      .map((f) => proyectarPasoTenant(f))
      .filter((f): f is NonNullable<typeof f> => f != null);
    cargarRegistroPasosTenant(proyectadas);
    const huerfanas = filas.length - proyectadas.length;
    if (huerfanas > 0) {
      this.logger.warn(
        `${huerfanas} paso(s) del tenant apuntan a una plantilla que ya no existe en el catálogo: no se resuelven.`,
      );
    }
  }

  /** Las plantillas que el modal de alta ofrece. */
  listarPlantillas() {
    return plantillasInstanciables();
  }

  async listar(tenantId: string) {
    const [filas, reglas] = await Promise.all([
      this.prisma.pasoTenant.findMany({
        where: { tenantId },
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      }),
      this.prisma.estacionRegla.findMany({
        where: { tenantId, tipo: 'familia' },
        select: {
          valor: true,
          estacion: { select: { id: true, nombre: true } },
        },
      }),
    ]);
    const estacionPorCodigo = new Map(
      reglas.map((r) => [r.valor, r.estacion]),
    );

    return filas.map((fila) => {
      const proyectada = proyectarPasoTenant(fila);
      return {
        id: fila.id,
        nombre: fila.nombre,
        descripcion: fila.descripcion,
        icono: fila.icono,
        activo: fila.activo,
        plantillaCodigo: fila.plantillaCodigo,
        /** El nombre de la PLANTILLA (no el de la instancia, que la
         *  proyección ya pisó). */
        plantillaNombre: nombrePlantilla(fila.plantillaCodigo),
        categoria: proyectada?.categoria ?? null,
        heredaFicha: proyectada != null,
        /** La instancia usa SU regla de estación si la tiene; si no, la de
         *  su plantilla (decisión: hereda pero se puede cambiar). */
        estacion:
          estacionPorCodigo.get(fila.id) ??
          estacionPorCodigo.get(fila.plantillaCodigo) ??
          null,
        estacionHeredada: !estacionPorCodigo.has(fila.id),
        defaults: this.defaultsDeFila(fila),
      };
    });
  }

  async crear(tenantId: string, input: UpsertPasoTenantInput) {
    const errores = validarPasoTenant(input);
    if (errores.length > 0) {
      throw new BadRequestException(errores.map((e) => e.mensaje));
    }
    await this.validarDefaults(tenantId, input.defaults);

    try {
      const fila = await this.prisma.pasoTenant.create({
        data: {
          tenantId,
          plantillaCodigo: input.plantillaCodigo,
          nombre: input.nombre.trim(),
          descripcion: input.descripcion?.trim() || null,
          icono: input.icono?.trim() || null,
          ...this.defaultsAColumnas(input.defaults),
        },
      });
      this.registrar(fila);
      return this.aRespuesta(fila);
    } catch (error) {
      this.reLanzarNombreDuplicado(error, input.nombre);
      throw error;
    }
  }

  async actualizar(
    tenantId: string,
    id: string,
    input: Partial<UpsertPasoTenantInput>,
  ) {
    const existente = await this.prisma.pasoTenant.findFirst({
      where: { id, tenantId },
    });
    if (!existente) throw new NotFoundException('Paso no encontrado.');

    const nombre = input.nombre?.trim() ?? existente.nombre;
    const plantillaCodigo = input.plantillaCodigo ?? existente.plantillaCodigo;
    const errores = validarPasoTenant({ nombre, plantillaCodigo });
    if (errores.length > 0) {
      throw new BadRequestException(errores.map((e) => e.mensaje));
    }
    await this.validarDefaults(tenantId, input.defaults);

    try {
      const fila = await this.prisma.pasoTenant.update({
        where: { id },
        data: {
          nombre,
          plantillaCodigo,
          descripcion:
            input.descripcion === undefined
              ? undefined
              : input.descripcion?.trim() || null,
          icono:
            input.icono === undefined ? undefined : input.icono?.trim() || null,
          activo: input.activo ?? undefined,
          ...(input.defaults === undefined
            ? {}
            : this.defaultsAColumnas(input.defaults)),
        },
      });
      this.registrar(fila);
      return this.aRespuesta(fila);
    } catch (error) {
      this.reLanzarNombreDuplicado(error, nombre);
      throw error;
    }
  }

  async eliminar(tenantId: string, id: string) {
    const existente = await this.prisma.pasoTenant.findFirst({
      where: { id, tenantId },
    });
    if (!existente) throw new NotFoundException('Paso no encontrado.');

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
        `"${existente.nombre}" ya fue usado (${enRutas} paso(s) de ruta, ${enPasosExtra} paso(s) extra, ${enOts} paso(s) de OT): no se puede borrar sin dejar esos registros mudos. Inhabilitalo — desaparece de los selectores y todo lo histórico sigue leyéndose.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.estacionRegla.deleteMany({
        where: { tenantId, tipo: 'familia', valor: id },
      }),
      this.prisma.pasoTenant.delete({ where: { id } }),
    ]);
    quitarPasoTenantDelRegistro(id);
    return { eliminado: true };
  }

  // ─── helpers ──────────────────────────────────────────────────────

  private registrar(fila: { id: string; plantillaCodigo: string; nombre: string; descripcion: string | null }) {
    const proyectada = proyectarPasoTenant(fila);
    if (proyectada) registrarPasoTenant(proyectada);
  }

  private aRespuesta(fila: {
    id: string;
    nombre: string;
    descripcion: string | null;
    icono: string | null;
    activo: boolean;
    plantillaCodigo: string;
  }) {
    const proyectada = proyectarPasoTenant(fila);
    return {
      id: fila.id,
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      icono: fila.icono,
      activo: fila.activo,
      plantillaCodigo: fila.plantillaCodigo,
      plantillaNombre: nombrePlantilla(fila.plantillaCodigo),
      categoria: proyectada?.categoria ?? null,
    };
  }

  private defaultsDeFila(fila: {
    centroCostoId: string | null;
    productividadHora: Prisma.Decimal | null;
    tiempoFijoMin: Prisma.Decimal | null;
    demasiaMm: Prisma.Decimal | null;
    solapePanelMm: Prisma.Decimal | null;
    tercerizado: boolean | null;
    proveedorId: string | null;
    fuenteCostoTercerizado: string | null;
    plazoProveedorDias: number | null;
  }) {
    return {
      centroCostoId: fila.centroCostoId,
      productividadHora:
        fila.productividadHora != null ? Number(fila.productividadHora) : null,
      tiempoFijoMin:
        fila.tiempoFijoMin != null ? Number(fila.tiempoFijoMin) : null,
      demasiaMm: fila.demasiaMm != null ? Number(fila.demasiaMm) : null,
      solapePanelMm:
        fila.solapePanelMm != null ? Number(fila.solapePanelMm) : null,
      tercerizado: fila.tercerizado,
      proveedorId: fila.proveedorId,
      fuenteCostoTercerizado: fila.fuenteCostoTercerizado,
      plazoProveedorDias: fila.plazoProveedorDias,
    };
  }

  private defaultsAColumnas(defaults: DefaultsPasoTenantInput | null | undefined) {
    return {
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
  }

  /** El centro y el proveedor de los defaults tienen que ser del tenant. */
  private async validarDefaults(
    tenantId: string,
    defaults: DefaultsPasoTenantInput | null | undefined,
  ) {
    if (!defaults) return;
    if (defaults.centroCostoId) {
      const centro = await this.prisma.centroCosto.findFirst({
        where: { id: defaults.centroCostoId, tenantId },
        select: { id: true },
      });
      if (!centro) {
        throw new BadRequestException('El centro de costo indicado no existe.');
      }
    }
    if (defaults.tercerizado === true && defaults.proveedorId) {
      const proveedor = await this.prisma.proveedor.findFirst({
        where: { id: defaults.proveedorId, tenantId, activo: true },
        select: { id: true },
      });
      if (!proveedor) {
        throw new BadRequestException(
          'El proveedor indicado no existe o está inhabilitado.',
        );
      }
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
