import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MAQUINA_DISPONIBLE_WHERE } from '../maquinaria/maquinaria-disponibilidad';
import type {
  ActualizarPasoExtraDto,
  AgregarPasoExtraDto,
  ConfiguracionPasoDto,
  PasoExtraCargoDirectoDto,
} from './dto/producto-ruta.dto';
import type {
  ActualizarAsociacionCargoDto,
  ActualizarCargoDirectoDto,
  AsociarCargoCotizacionDto,
  AsociarCargoPasoDto,
  CrearCargoDirectoDto,
} from './dto/cargo-directo.dto';
import { FamiliasPasosService } from './familias-pasos.service';
import { leerNivelesPaso } from '../motor-universal/niveles-paso';
import { evaluarRegla } from '../motor-universal/evaluador-jsonlogic';

@Injectable()
export class CargosDirectosProductoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familias: FamiliasPasosService,
  ) {}

  listarCargosDirectos(tenantId: string, soloActivos = true) {
    return this.prisma.cargoDirectoCatalogo.findMany({
      where: { tenantId, ...(soloActivos ? { activo: true } : {}) },
      orderBy: { nombre: 'asc' },
    });
  }

  async crearCargoDirecto(tenantId: string, dto: CrearCargoDirectoDto) {
    const modos = dto.modosActivacionSoportados ?? ['OPCIONAL'];
    if (modos.length === 0) {
      throw new BadRequestException(
        'El costo directo necesita al menos una forma de activación.',
      );
    }
    this.validarAsociacion(
      {
        activo: true,
        nombre: dto.nombre,
        modoCalculo: dto.modoCalculo,
        modosActivacionSoportados: modos,
        configJson: dto.configJson ?? null,
      },
      { modoActivacion: modos[0] },
    );
    try {
      return await this.prisma.cargoDirectoCatalogo.create({
        data: {
          tenantId,
          codigo: dto.codigo,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          modoCalculo: dto.modoCalculo,
          modosActivacionSoportados: modos,
          configJson: (dto.configJson ??
            Prisma.JsonNull) as Prisma.InputJsonValue,
          aplicaMargen: dto.aplicaMargen ?? true,
          activo: true,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Ya existe un cargo con código "${dto.codigo}"`,
        );
      }
      throw err;
    }
  }

  async actualizarCargoDirecto(
    tenantId: string,
    id: string,
    dto: ActualizarCargoDirectoDto,
  ) {
    const existente = await this.prisma.cargoDirectoCatalogo.findFirst({
      where: { id, tenantId },
    });
    if (!existente) throw new NotFoundException(`Cargo ${id} no encontrado`);

    const modos =
      dto.modosActivacionSoportados ?? existente.modosActivacionSoportados;
    if (modos.length === 0) {
      throw new BadRequestException(
        'El costo directo necesita al menos una forma de activación.',
      );
    }
    this.validarAsociacion(
      {
        activo: true,
        nombre: dto.nombre ?? existente.nombre,
        modoCalculo: dto.modoCalculo ?? existente.modoCalculo,
        modosActivacionSoportados: modos,
        configJson:
          dto.configJson !== undefined ? dto.configJson : existente.configJson,
      },
      { modoActivacion: modos[0] },
    );

    const data: Prisma.CargoDirectoCatalogoUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
    if (dto.modoCalculo !== undefined) data.modoCalculo = dto.modoCalculo;
    if (dto.modosActivacionSoportados !== undefined) {
      data.modosActivacionSoportados = dto.modosActivacionSoportados;
    }
    if (dto.configJson !== undefined) {
      data.configJson = dto.configJson as Prisma.InputJsonValue;
    }
    if (dto.aplicaMargen !== undefined) {
      data.aplicaMargen = dto.aplicaMargen;
    }
    if (dto.activo !== undefined) data.activo = dto.activo;

    return this.prisma.cargoDirectoCatalogo.update({ where: { id }, data });
  }

  async eliminarCargoDirecto(tenantId: string, id: string) {
    const [existente, pasosExtras] = await Promise.all([
      this.prisma.cargoDirectoCatalogo.findFirst({
        where: { id, tenantId },
        include: {
          pasoCargos: { take: 1 },
          cotizacionCargos: { take: 1 },
        },
      }),
      this.prisma.productoPasoExtra.findMany({
        where: { tenantId, activo: true },
        select: { configCargosDirectosJson: true },
      }),
    ]);
    if (!existente) throw new NotFoundException(`Cargo ${id} no encontrado`);

    const usadoEnPasoExtra = pasosExtras.some((paso) =>
      (Array.isArray(paso.configCargosDirectosJson)
        ? paso.configCargosDirectosJson
        : []
      ).some(
        (cargo) =>
          cargo != null &&
          typeof cargo === 'object' &&
          !Array.isArray(cargo) &&
          (cargo as Record<string, unknown>).cargoDirectoCatalogoId === id,
      ),
    );

    if (
      existente.pasoCargos.length > 0 ||
      existente.cotizacionCargos.length > 0 ||
      usadoEnPasoExtra
    ) {
      return this.prisma.cargoDirectoCatalogo.update({
        where: { id },
        data: { activo: false },
      });
    }

    return this.prisma.cargoDirectoCatalogo.delete({ where: { id } });
  }

  async asociarCargoCotizacion(
    tenantId: string,
    productoId: string,
    dto: AsociarCargoCotizacionDto,
  ) {
    const [producto, cargo] = await Promise.all([
      this.prisma.producto.findFirst({ where: { id: productoId, tenantId } }),
      this.prisma.cargoDirectoCatalogo.findFirst({
        where: { id: dto.cargoDirectoCatalogoId, tenantId, activo: true },
      }),
    ]);
    if (!producto)
      throw new NotFoundException(`Producto ${productoId} no encontrado`);
    if (!cargo)
      throw new NotFoundException(
        `Cargo ${dto.cargoDirectoCatalogoId} no encontrado`,
      );

    this.validarAsociacion(cargo, dto);
    try {
      return await this.prisma.productoCargoDirectoCotizacion.create({
        data: {
          tenantId,
          productoId,
          cargoDirectoCatalogoId: dto.cargoDirectoCatalogoId,
          modoActivacion: dto.modoActivacion,
          condicionActivacionJson: (dto.condicionActivacionJson ??
            Prisma.JsonNull) as Prisma.InputJsonValue,
          configOverrideJson: (dto.configOverrideJson ??
            Prisma.JsonNull) as Prisma.InputJsonValue,
          aplicaMargenOverride: dto.aplicaMargenOverride ?? null,
          activo: true,
        },
      });
    } catch (err) {
      this.rethrowAsociacionDuplicada(err);
    }
  }

  async actualizarCargoCotizacion(
    tenantId: string,
    asociacionId: string,
    dto: ActualizarAsociacionCargoDto,
  ) {
    const asociacion =
      await this.prisma.productoCargoDirectoCotizacion.findFirst({
        where: { id: asociacionId, tenantId },
        include: { cargoDirectoCatalogo: true },
      });
    if (!asociacion)
      throw new NotFoundException(`Asociación ${asociacionId} no encontrada`);
    const merged = {
      modoActivacion: dto.modoActivacion ?? asociacion.modoActivacion,
      condicionActivacionJson:
        dto.condicionActivacionJson ?? asociacion.condicionActivacionJson,
      configOverrideJson:
        dto.configOverrideJson !== undefined
          ? dto.configOverrideJson
          : asociacion.configOverrideJson,
    };
    this.validarAsociacion(asociacion.cargoDirectoCatalogo, merged);
    return this.prisma.productoCargoDirectoCotizacion.update({
      where: { id: asociacionId },
      data: {
        ...(dto.modoActivacion !== undefined
          ? { modoActivacion: dto.modoActivacion }
          : {}),
        condicionActivacionJson:
          merged.modoActivacion === 'CONDICIONAL'
            ? ((merged.condicionActivacionJson ??
                Prisma.JsonNull) as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        ...(dto.configOverrideJson !== undefined
          ? {
              configOverrideJson: (dto.configOverrideJson ??
                Prisma.JsonNull) as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.aplicaMargenOverride !== undefined
          ? { aplicaMargenOverride: dto.aplicaMargenOverride }
          : {}),
      },
    });
  }

  async desasociarCargoCotizacion(tenantId: string, asociacionId: string) {
    const existente =
      await this.prisma.productoCargoDirectoCotizacion.findFirst({
        where: { id: asociacionId, tenantId },
      });
    if (!existente)
      throw new NotFoundException(`Asociación ${asociacionId} no encontrada`);
    return this.prisma.productoCargoDirectoCotizacion.delete({
      where: { id: asociacionId },
    });
  }

  async asociarCargoPaso(
    tenantId: string,
    configPasoId: string,
    dto: AsociarCargoPasoDto,
  ) {
    const [configPaso, cargo] = await Promise.all([
      this.prisma.productoConfigPaso.findFirst({
        where: { id: configPasoId, tenantId },
      }),
      this.prisma.cargoDirectoCatalogo.findFirst({
        where: { id: dto.cargoDirectoCatalogoId, tenantId, activo: true },
      }),
    ]);
    if (!configPaso)
      throw new NotFoundException(`ConfigPaso ${configPasoId} no encontrado`);
    if (!cargo)
      throw new NotFoundException(
        `Cargo ${dto.cargoDirectoCatalogoId} no encontrado`,
      );

    const niveles = leerNivelesPaso(configPaso.paramsPasoJson);
    if (niveles) {
      if (!dto.nivelCodigo) {
        throw new BadRequestException(
          'Este paso tiene niveles: elegí en cuál se aplicará el costo directo.',
        );
      }
      if (!niveles.opciones.some((nivel) => nivel.codigo === dto.nivelCodigo)) {
        throw new BadRequestException(
          `El nivel "${dto.nivelCodigo}" no existe en este paso.`,
        );
      }
    } else if (dto.nivelCodigo) {
      throw new BadRequestException('Este paso no tiene niveles configurados.');
    }

    this.validarAsociacion(cargo, dto);
    try {
      return await this.prisma.productoCargoDirectoPaso.create({
        data: {
          tenantId,
          productoConfigPasoId: configPasoId,
          cargoDirectoCatalogoId: dto.cargoDirectoCatalogoId,
          nivelCodigo: dto.nivelCodigo ?? null,
          modoActivacion: dto.modoActivacion,
          condicionActivacionJson: (dto.condicionActivacionJson ??
            Prisma.JsonNull) as Prisma.InputJsonValue,
          configOverrideJson: (dto.configOverrideJson ??
            Prisma.JsonNull) as Prisma.InputJsonValue,
          aplicaMargenOverride: dto.aplicaMargenOverride ?? null,
          activo: true,
        },
      });
    } catch (err) {
      this.rethrowAsociacionDuplicada(err);
    }
  }

  async actualizarCargoPaso(
    tenantId: string,
    asociacionId: string,
    dto: ActualizarAsociacionCargoDto,
  ) {
    const asociacion = await this.prisma.productoCargoDirectoPaso.findFirst({
      where: { id: asociacionId, tenantId },
      include: { cargoDirectoCatalogo: true },
    });
    if (!asociacion)
      throw new NotFoundException(`Asociación ${asociacionId} no encontrada`);
    const merged = {
      modoActivacion: dto.modoActivacion ?? asociacion.modoActivacion,
      condicionActivacionJson:
        dto.condicionActivacionJson ?? asociacion.condicionActivacionJson,
      configOverrideJson:
        dto.configOverrideJson !== undefined
          ? dto.configOverrideJson
          : asociacion.configOverrideJson,
    };
    this.validarAsociacion(asociacion.cargoDirectoCatalogo, merged);
    return this.prisma.productoCargoDirectoPaso.update({
      where: { id: asociacionId },
      data: {
        ...(dto.modoActivacion !== undefined
          ? { modoActivacion: dto.modoActivacion }
          : {}),
        condicionActivacionJson:
          merged.modoActivacion === 'CONDICIONAL'
            ? ((merged.condicionActivacionJson ??
                Prisma.JsonNull) as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        ...(dto.configOverrideJson !== undefined
          ? {
              configOverrideJson: (dto.configOverrideJson ??
                Prisma.JsonNull) as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.aplicaMargenOverride !== undefined
          ? { aplicaMargenOverride: dto.aplicaMargenOverride }
          : {}),
      },
    });
  }

  async desasociarCargoPaso(tenantId: string, asociacionId: string) {
    const existente = await this.prisma.productoCargoDirectoPaso.findFirst({
      where: { id: asociacionId, tenantId },
    });
    if (!existente)
      throw new NotFoundException(`Asociación ${asociacionId} no encontrada`);
    return this.prisma.productoCargoDirectoPaso.delete({
      where: { id: asociacionId },
    });
  }

  async distribuirCargoPasoPorNiveles(tenantId: string, asociacionId: string) {
    const asociacion = await this.prisma.productoCargoDirectoPaso.findFirst({
      where: { id: asociacionId, tenantId },
      include: { productoConfigPaso: true },
    });
    if (!asociacion) {
      throw new NotFoundException(`Asociación ${asociacionId} no encontrada`);
    }
    if (asociacion.nivelCodigo) {
      throw new BadRequestException('El costo ya pertenece a un nivel.');
    }
    const niveles = leerNivelesPaso(
      asociacion.productoConfigPaso.paramsPasoJson,
    );
    if (!niveles) {
      throw new BadRequestException(
        'El paso no tiene niveles configurados para distribuir el costo.',
      );
    }
    const existentes = await this.prisma.productoCargoDirectoPaso.count({
      where: {
        tenantId,
        productoConfigPasoId: asociacion.productoConfigPasoId,
        cargoDirectoCatalogoId: asociacion.cargoDirectoCatalogoId,
        nivelCodigo: { not: null },
      },
    });
    if (existentes > 0) {
      throw new BadRequestException(
        'Este costo ya tiene configuraciones por nivel.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.productoCargoDirectoPaso.delete({
        where: { id: asociacion.id },
      });
      return Promise.all(
        niveles.opciones.map((nivel) =>
          tx.productoCargoDirectoPaso.create({
            data: {
              tenantId,
              productoConfigPasoId: asociacion.productoConfigPasoId,
              cargoDirectoCatalogoId: asociacion.cargoDirectoCatalogoId,
              nivelCodigo: nivel.codigo,
              modoActivacion: asociacion.modoActivacion,
              condicionActivacionJson:
                asociacion.condicionActivacionJson === null
                  ? Prisma.JsonNull
                  : (asociacion.condicionActivacionJson as Prisma.InputJsonValue),
              configOverrideJson:
                asociacion.configOverrideJson === null
                  ? Prisma.JsonNull
                  : (asociacion.configOverrideJson as Prisma.InputJsonValue),
              aplicaMargenOverride: asociacion.aplicaMargenOverride,
              activo: asociacion.activo,
            },
          }),
        ),
      );
    });
  }

  private validarAsociacion(
    cargo: {
      activo: boolean;
      nombre: string;
      modoCalculo: string;
      modosActivacionSoportados: string[];
      configJson: unknown;
    },
    dto: {
      modoActivacion: string;
      condicionActivacionJson?: unknown;
      configOverrideJson?: unknown;
    },
  ) {
    if (!cargo.activo) {
      throw new BadRequestException(`El cargo "${cargo.nombre}" está inactivo`);
    }
    if (
      cargo.modosActivacionSoportados.length > 0 &&
      !cargo.modosActivacionSoportados.includes(dto.modoActivacion)
    ) {
      throw new BadRequestException(
        `El cargo "${cargo.nombre}" no admite el modo ${dto.modoActivacion}`,
      );
    }
    if (
      dto.modoActivacion === 'CONDICIONAL' &&
      (!dto.condicionActivacionJson ||
        typeof dto.condicionActivacionJson !== 'object')
    ) {
      throw new BadRequestException(
        'Un costo directo condicional necesita una regla de activación.',
      );
    }
    if (dto.modoActivacion === 'CONDICIONAL') {
      const evaluacion = evaluarRegla(
        dto.condicionActivacionJson,
        {} as Record<string, unknown>,
      );
      if (evaluacion.error) {
        throw new BadRequestException(
          `La regla de activación del costo directo es inválida: ${evaluacion.error}`,
        );
      }
    }
    const base = this.asRecord(cargo.configJson);
    const override = this.asRecord(dto.configOverrideJson);
    const config = { ...base, ...override };
    if (cargo.modoCalculo === 'MONTO_FIJO_PLANO') {
      const zonas = Array.isArray(config.zonas) ? config.zonas : [];
      const monto = Number(config.monto);
      if (!(Number.isFinite(monto) && monto > 0) && zonas.length === 0) {
        throw new BadRequestException(
          `El cargo "${cargo.nombre}" necesita un monto o una tabla de importes.`,
        );
      }
      if (
        zonas.some((zona) => {
          const item = this.asRecord(zona);
          return (
            typeof item.codigo !== 'string' ||
            !item.codigo.trim() ||
            typeof item.nombre !== 'string' ||
            !item.nombre.trim() ||
            !Number.isFinite(Number(item.monto)) ||
            !(Number(item.monto) > 0)
          );
        })
      ) {
        throw new BadRequestException(
          `La tabla de importes de "${cargo.nombre}" tiene opciones incompletas.`,
        );
      }
    } else if (cargo.modoCalculo === 'PORCENTAJE_SOBRE_BASE') {
      const porcentaje = Number(config.porcentaje ?? config.porcentajeDefault);
      if (!Number.isFinite(porcentaje) || porcentaje <= 0) {
        throw new BadRequestException(
          `El cargo "${cargo.nombre}" necesita un porcentaje mayor a cero.`,
        );
      }
    } else if (cargo.modoCalculo === 'POR_UNIDAD_INPUT') {
      if (
        !Number.isFinite(Number(config.precioPorUnidad)) ||
        !(Number(config.precioPorUnidad) > 0) ||
        typeof config.inputCantidad !== 'string' ||
        !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(config.inputCantidad.trim()) ||
        typeof config.unidad !== 'string' ||
        !config.unidad.trim()
      ) {
        throw new BadRequestException(
          `El cargo "${cargo.nombre}" necesita precio, unidad y un dato de cantidad válido.`,
        );
      }
    } else {
      throw new BadRequestException(
        `El cargo "${cargo.nombre}" tiene un modo de cálculo desconocido.`,
      );
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private validarReglaPasoExtra(
    modoActivacion: string | null | undefined,
    condicion: unknown,
  ) {
    if (modoActivacion !== 'CONDICIONAL') return;
    if (
      !condicion ||
      typeof condicion !== 'object' ||
      Array.isArray(condicion)
    ) {
      throw new BadRequestException(
        'Un paso extra condicional necesita una regla de activación.',
      );
    }
    const evaluacion = evaluarRegla(condicion, {} as Record<string, unknown>);
    if (evaluacion.error) {
      throw new BadRequestException(
        `La regla de activación del paso extra es inválida: ${evaluacion.error}`,
      );
    }
  }

  private rethrowAsociacionDuplicada(err: unknown): never {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new BadRequestException(
        'Este costo directo ya está asociado en este alcance.',
      );
    }
    throw err;
  }

  /**
   * Los pasos extra también son instancias de una familia. Al crearlos se
   * materializa (snapshot) la configuración reutilizable vigente, igual que
   * al agregar una ruta al producto. Así, cambios futuros del preset no pisan
   * la configuración particular que el comercial edite en este producto.
   */
  private async obtenerConfiguracionBasePasoExtra(
    tenantId: string,
    familiaCodigo: string,
  ): Promise<ConfiguracionPasoDto> {
    const esPasoTenant =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        familiaCodigo,
      );
    const fila = esPasoTenant
      ? await this.prisma.pasoTenant.findFirst({
          where: { id: familiaCodigo, tenantId, activo: true },
          select: { configBaseJson: true },
        })
      : await this.prisma.familiaPasoDefaults.findUnique({
          where: { tenantId_familiaCodigo: { tenantId, familiaCodigo } },
          select: { configBaseJson: true },
        });
    const base = fila?.configBaseJson;
    return base && typeof base === 'object' && !Array.isArray(base)
      ? (base as unknown as ConfiguracionPasoDto)
      : {};
  }

  async agregarPasoExtra(
    tenantId: string,
    productoId: string,
    dto: AgregarPasoExtraDto,
  ) {
    const producto = await this.prisma.producto.findFirst({
      where: { id: productoId, tenantId },
    });
    if (!producto)
      throw new NotFoundException(`Producto ${productoId} no encontrado`);

    await this.familias.assertFamiliaExiste(tenantId, dto.familiaCodigo);
    const base = await this.obtenerConfiguracionBasePasoExtra(
      tenantId,
      dto.familiaCodigo,
    );
    const modoActivacion = dto.modoActivacion ?? base.modoActivacion ?? null;
    const condicionActivacionJson =
      dto.condicionActivacionJson !== undefined
        ? dto.condicionActivacionJson
        : (base.condicionActivacionJson ?? null);
    const maquinaM1Id = dto.maquinaM1Id ?? base.maquinaM1Id ?? null;
    // Si el alta elige expresamente otra máquina, no se arrastra el perfil de
    // la máquina configurada en el preset.
    const perfilM1Id = maquinaM1Id
      ? dto.maquinaM1Id !== undefined
        ? (dto.perfilM1Id ?? null)
        : (base.perfilM1Id ?? null)
      : null;
    const centroCostoId = maquinaM1Id
      ? null
      : (dto.centroCostoId ?? base.centroCostoId ?? null);

    this.validarReglaPasoExtra(modoActivacion, condicionActivacionJson);

    // Validar las FK efectivas (incluidas las heredadas) para no materializar
    // referencias inactivas o pertenecientes a otro tenant.
    if (maquinaM1Id) {
      await this.assertMaquinaPerfil(tenantId, maquinaM1Id, perfilM1Id);
    }
    if (dto.insertarDespuesDeRutaPasoId) {
      const rutaPaso = await this.prisma.rutaPaso.findFirst({
        where: { id: dto.insertarDespuesDeRutaPasoId, tenantId },
        select: { id: true },
      });
      if (!rutaPaso) {
        throw new BadRequestException(
          'El paso de ruta indicado no existe o no pertenece a tu empresa.',
        );
      }
    }
    if (dto.rutaAlternativaId) {
      await this.assertRutaAlternativaDelProducto(
        tenantId,
        productoId,
        dto.rutaAlternativaId,
      );
    }
    if (centroCostoId) {
      await this.assertCentroCosto(tenantId, centroCostoId);
    }

    // ordenInterno se calcula por ruta alternativa (el orden es dentro del
    // flujo de esa ruta), no global al producto.
    let ordenInterno = dto.ordenInterno ?? 0;
    if (dto.ordenInterno === undefined) {
      const last = await this.prisma.productoPasoExtra.findFirst({
        where: {
          productoId,
          tenantId,
          rutaAlternativaId: dto.rutaAlternativaId ?? null,
        },
        orderBy: { ordenInterno: 'desc' },
      });
      ordenInterno = (last?.ordenInterno ?? 0) + 1;
    }

    return this.prisma.productoPasoExtra.create({
      data: {
        tenantId,
        productoId,
        rutaAlternativaId: dto.rutaAlternativaId ?? null,
        familiaCodigo: dto.familiaCodigo,
        insertarDespuesDeRutaPasoId: dto.insertarDespuesDeRutaPasoId ?? null,
        ordenInterno,
        nombreVisible: base.nombreVisible ?? null,
        modoActivacion,
        condicionActivacionJson:
          (condicionActivacionJson as never) ?? Prisma.JsonNull,
        modoTiempo: dto.modoTiempo ?? base.modoTiempo ?? null,
        mecanismoCantidad:
          dto.mecanismoCantidad ?? base.mecanismoCantidad ?? null,
        mecanismoCantidadConfigJson:
          (base.mecanismoCantidadConfigJson as never) ?? Prisma.JsonNull,
        multiplicadoresActivos: base.multiplicadoresActivos ?? [],
        paramsPasoJson:
          ((dto.paramsPasoJson !== undefined
            ? dto.paramsPasoJson
            : base.paramsPasoJson) as never) ?? Prisma.JsonNull,
        setupOverrideMin: base.setupOverrideMin ?? null,
        cleanupOverrideMin: base.cleanupOverrideMin ?? null,
        tiempoFijoOverrideMin: base.tiempoFijoOverrideMin ?? null,
        maquinaM1Id,
        perfilM1Id,
        // Centro de costo sólo aplica si el paso NO tiene máquina.
        centroCostoId,
        configSlotsMaterialesJson:
          (base.slotsMateriales as never) ?? Prisma.JsonNull,
        configMaquinasCandidatasJson:
          (base.maquinasCandidatas as never) ?? Prisma.JsonNull,
        activo: true,
      },
    });
  }

  async actualizarPasoExtra(
    tenantId: string,
    pasoExtraId: string,
    dto: ActualizarPasoExtraDto,
  ) {
    const existente = await this.prisma.productoPasoExtra.findFirst({
      where: { id: pasoExtraId, tenantId },
    });
    if (!existente)
      throw new NotFoundException(`Paso extra ${pasoExtraId} no encontrado`);

    this.validarReglaPasoExtra(
      dto.modoActivacion ?? existente.modoActivacion,
      dto.condicionActivacionJson !== undefined
        ? dto.condicionActivacionJson
        : existente.condicionActivacionJson,
    );

    // La máquina efectiva tras el patch (para validar perfil y limpiar centro).
    const maquinaEfectiva =
      dto.maquinaM1Id !== undefined ? dto.maquinaM1Id : existente.maquinaM1Id;
    if (dto.maquinaM1Id) {
      await this.assertMaquinaPerfil(tenantId, dto.maquinaM1Id, dto.perfilM1Id);
    }
    if (dto.insertarDespuesDeRutaPasoId) {
      const rutaPaso = await this.prisma.rutaPaso.findFirst({
        where: { id: dto.insertarDespuesDeRutaPasoId, tenantId },
        select: { id: true },
      });
      if (!rutaPaso) {
        throw new BadRequestException(
          'El paso de ruta indicado no existe o no pertenece a tu empresa.',
        );
      }
    }
    if (dto.centroCostoId) {
      await this.assertCentroCosto(tenantId, dto.centroCostoId);
    }

    const paramsPasoJsonEfectivo =
      dto.paramsPasoJson !== undefined
        ? dto.paramsPasoJson
        : existente.paramsPasoJson;
    if (
      dto.configCargosDirectosJson !== undefined ||
      dto.paramsPasoJson !== undefined
    ) {
      const cargosEfectivos =
        dto.configCargosDirectosJson !== undefined
          ? dto.configCargosDirectosJson
          : ((Array.isArray(existente.configCargosDirectosJson)
              ? existente.configCargosDirectosJson
              : []) as unknown as PasoExtraCargoDirectoDto[]);
      await this.validarCargosPasoExtra(
        tenantId,
        cargosEfectivos,
        paramsPasoJsonEfectivo,
      );
    }

    const data: Prisma.ProductoPasoExtraUpdateInput = {};
    if (dto.insertarDespuesDeRutaPasoId !== undefined)
      data.insertarDespuesDeRutaPasoId = dto.insertarDespuesDeRutaPasoId;
    if (dto.ordenInterno !== undefined) data.ordenInterno = dto.ordenInterno;
    if (dto.nombreVisible !== undefined) data.nombreVisible = dto.nombreVisible;
    if (dto.modoActivacion !== undefined)
      data.modoActivacion = dto.modoActivacion;
    if (dto.condicionActivacionJson !== undefined)
      data.condicionActivacionJson =
        (dto.condicionActivacionJson as never) ?? Prisma.JsonNull;
    if (dto.modoTiempo !== undefined) data.modoTiempo = dto.modoTiempo;
    if (dto.mecanismoCantidad !== undefined)
      data.mecanismoCantidad = dto.mecanismoCantidad;
    if (dto.mecanismoCantidadConfigJson !== undefined)
      data.mecanismoCantidadConfigJson =
        (dto.mecanismoCantidadConfigJson as never) ?? Prisma.JsonNull;
    if (dto.multiplicadoresActivos !== undefined)
      data.multiplicadoresActivos = dto.multiplicadoresActivos;
    if (dto.paramsPasoJson !== undefined)
      data.paramsPasoJson = (dto.paramsPasoJson as never) ?? Prisma.JsonNull;
    if (dto.setupOverrideMin !== undefined)
      data.setupOverrideMin = dto.setupOverrideMin;
    if (dto.cleanupOverrideMin !== undefined)
      data.cleanupOverrideMin = dto.cleanupOverrideMin;
    if (dto.tiempoFijoOverrideMin !== undefined)
      data.tiempoFijoOverrideMin = dto.tiempoFijoOverrideMin;
    if (dto.maquinaM1Id !== undefined)
      data.maquinaM1 = dto.maquinaM1Id
        ? { connect: { id: dto.maquinaM1Id } }
        : { disconnect: true };
    if (dto.perfilM1Id !== undefined || dto.maquinaM1Id !== undefined) {
      const perfilEfectivo = maquinaEfectiva
        ? dto.perfilM1Id !== undefined
          ? dto.perfilM1Id
          : existente.perfilM1Id
        : null;
      data.perfilM1 = perfilEfectivo
        ? { connect: { id: perfilEfectivo } }
        : { disconnect: true };
    }
    // Centro de costo sólo si no hay máquina efectiva.
    if (dto.centroCostoId !== undefined || dto.maquinaM1Id !== undefined) {
      const centroEfectivo = maquinaEfectiva
        ? null
        : dto.centroCostoId !== undefined
          ? dto.centroCostoId
          : existente.centroCostoId;
      data.centroCosto = centroEfectivo
        ? { connect: { id: centroEfectivo } }
        : { disconnect: true };
    }
    // Sub-fase 3 — config inline embebida (slots / cargos / candidatas). Se
    // guarda tal cual (ids); el motor la hidrata y scopea por tenant en cotización.
    if (dto.configSlotsMaterialesJson !== undefined)
      data.configSlotsMaterialesJson =
        (dto.configSlotsMaterialesJson as never) ?? Prisma.JsonNull;
    if (dto.configCargosDirectosJson !== undefined)
      data.configCargosDirectosJson =
        (dto.configCargosDirectosJson as never) ?? Prisma.JsonNull;
    if (dto.configMaquinasCandidatasJson !== undefined)
      data.configMaquinasCandidatasJson =
        (dto.configMaquinasCandidatasJson as never) ?? Prisma.JsonNull;
    if (dto.activo !== undefined) data.activo = dto.activo;

    return this.prisma.productoPasoExtra.update({
      where: { id: pasoExtraId },
      data,
    });
  }

  private async validarCargosPasoExtra(
    tenantId: string,
    cargos: PasoExtraCargoDirectoDto[],
    paramsPasoJson: unknown,
  ) {
    const catalogoIds = [
      ...new Set(cargos.map((cargo) => cargo.cargoDirectoCatalogoId)),
    ];
    const catalogos = await this.prisma.cargoDirectoCatalogo.findMany({
      where: { tenantId, id: { in: catalogoIds }, activo: true },
    });
    const catalogoPorId = new Map(catalogos.map((cargo) => [cargo.id, cargo]));
    const niveles = leerNivelesPaso(paramsPasoJson);
    const claves = new Set<string>();

    for (const cargo of cargos) {
      const catalogo = catalogoPorId.get(cargo.cargoDirectoCatalogoId);
      if (!catalogo) {
        throw new BadRequestException(
          'Uno de los costos directos no existe, está inactivo o pertenece a otra empresa.',
        );
      }
      if (niveles) {
        if (!cargo.nivelCodigo) {
          throw new BadRequestException(
            'Este paso extra tiene niveles: elegí en cuál se aplicará cada costo directo.',
          );
        }
        if (
          !niveles.opciones.some((nivel) => nivel.codigo === cargo.nivelCodigo)
        ) {
          throw new BadRequestException(
            `El nivel "${cargo.nivelCodigo}" no existe en este paso extra.`,
          );
        }
      } else if (cargo.nivelCodigo) {
        throw new BadRequestException(
          'Este paso extra no tiene niveles configurados.',
        );
      }

      const clave = `${cargo.cargoDirectoCatalogoId}:${cargo.nivelCodigo ?? 'general'}`;
      if (claves.has(clave)) {
        throw new BadRequestException(
          'El mismo costo directo no puede repetirse en un mismo nivel.',
        );
      }
      claves.add(clave);
      this.validarAsociacion(catalogo, cargo);
    }
  }

  async eliminarPasoExtra(tenantId: string, pasoExtraId: string) {
    const existente = await this.prisma.productoPasoExtra.findFirst({
      where: { id: pasoExtraId, tenantId },
    });
    if (!existente)
      throw new NotFoundException(`Paso extra ${pasoExtraId} no encontrado`);
    return this.prisma.productoPasoExtra.delete({ where: { id: pasoExtraId } });
  }

  // ── Validaciones compartidas ────────────────────────────────────────

  private async assertMaquinaPerfil(
    tenantId: string,
    maquinaId: string,
    perfilId?: string | null,
  ) {
    const maquina = await this.prisma.maquina.findFirst({
      where: { id: maquinaId, tenantId, ...MAQUINA_DISPONIBLE_WHERE },
      include: {
        perfilesOperativos: { where: { activo: true }, select: { id: true } },
      },
    });
    if (!maquina) {
      throw new BadRequestException(
        'La máquina M-1 seleccionada no existe o no está activa.',
      );
    }
    if (
      perfilId &&
      !maquina.perfilesOperativos.some((p) => p.id === perfilId)
    ) {
      throw new BadRequestException(
        'El perfil M-1 no pertenece a la máquina seleccionada.',
      );
    }
  }

  private async assertRutaAlternativaDelProducto(
    tenantId: string,
    productoId: string,
    rutaAlternativaId: string,
  ) {
    const ruta = await this.prisma.productoRutaAlternativa.findFirst({
      where: { id: rutaAlternativaId, tenantId, productoId },
      select: { id: true },
    });
    if (!ruta) {
      throw new BadRequestException(
        'La ruta alternativa indicada no existe o no pertenece a este producto.',
      );
    }
  }

  private async assertCentroCosto(tenantId: string, centroCostoId: string) {
    const centro = await this.prisma.centroCosto.findFirst({
      where: { id: centroCostoId, tenantId },
      select: { id: true },
    });
    if (!centro) {
      throw new BadRequestException(
        'El centro de costo indicado no existe o no pertenece a tu empresa.',
      );
    }
  }
}
