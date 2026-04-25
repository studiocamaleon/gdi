import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FAMILIAS, listarFamilias as listarFamiliasCatalogo } from './pasos/familias';
import { CATEGORIAS } from './pasos/categorias';
import type { ActualizarProductoDto, CrearProductoDto } from './dto/producto.dto';
import type { ActualizarRutaDto, CrearRutaDto } from './dto/ruta.dto';
import type {
  ActualizarProductoRutaAlternativaDto,
  CrearProductoRutaAlternativaDto,
  UpsertProductoConfigPasoDto,
} from './dto/producto-ruta.dto';
import type { ActualizarCargoDirectoDto, CrearCargoDirectoDto } from './dto/cargo-directo.dto';

/**
 * Service F.3 — CRUD del Modelo Universal V2.
 *
 * MVP: read-only para arrancar UI de listados/detalles. POST/PUT/DELETE
 * se implementan cuando la UI de edición esté lista en sub-fases siguientes.
 */
@Injectable()
export class ProductosServiciosService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // PRODUCTOS
  // ============================================================================

  async listarProductos(tenantId: string, activo?: boolean) {
    return this.prisma.producto.findMany({
      where: { tenantId, ...(activo !== undefined ? { activo } : {}) },
      orderBy: { nombre: 'asc' },
      include: {
        rutasAlternativas: {
          where: { activo: true },
          select: {
            id: true,
            nombre: true,
            esPreferida: true,
            ruta: { select: { id: true, codigo: true, nombre: true } },
          },
          orderBy: { orden: 'asc' },
        },
      },
    });
  }

  async crearProducto(tenantId: string, dto: CrearProductoDto) {
    try {
      return await this.prisma.producto.create({
        data: {
          tenantId,
          codigo: dto.codigo,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          unidadComercial: dto.unidadComercial,
          modoMedidas: dto.modoMedidas,
          medidaDefaultAnchoMm: dto.medidaDefaultAnchoMm
            ? new Prisma.Decimal(dto.medidaDefaultAnchoMm)
            : null,
          medidaDefaultAltoMm: dto.medidaDefaultAltoMm
            ? new Prisma.Decimal(dto.medidaDefaultAltoMm)
            : null,
          precioConfigJson: (dto.precioConfigJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          activo: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Ya existe un producto con código "${dto.codigo}"`);
      }
      throw err;
    }
  }

  async actualizarProducto(tenantId: string, id: string, dto: ActualizarProductoDto) {
    // Verifica que existe
    const existente = await this.prisma.producto.findFirst({ where: { id, tenantId } });
    if (!existente) throw new NotFoundException(`Producto ${id} no encontrado`);

    const data: Prisma.ProductoUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
    if (dto.unidadComercial !== undefined) data.unidadComercial = dto.unidadComercial;
    if (dto.modoMedidas !== undefined) data.modoMedidas = dto.modoMedidas;
    if (dto.medidaDefaultAnchoMm !== undefined) {
      data.medidaDefaultAnchoMm =
        dto.medidaDefaultAnchoMm === null ? null : new Prisma.Decimal(dto.medidaDefaultAnchoMm);
    }
    if (dto.medidaDefaultAltoMm !== undefined) {
      data.medidaDefaultAltoMm =
        dto.medidaDefaultAltoMm === null ? null : new Prisma.Decimal(dto.medidaDefaultAltoMm);
    }
    if (dto.precioConfigJson !== undefined) {
      data.precioConfigJson = dto.precioConfigJson as Prisma.InputJsonValue;
    }
    if (dto.activo !== undefined) data.activo = dto.activo;

    return this.prisma.producto.update({ where: { id }, data });
  }

  async eliminarProducto(tenantId: string, id: string) {
    const existente = await this.prisma.producto.findFirst({
      where: { id, tenantId },
      include: {
        cotizacionItems: { take: 1 },
      },
    });
    if (!existente) throw new NotFoundException(`Producto ${id} no encontrado`);

    if (existente.cotizacionItems.length > 0) {
      // Soft-delete: marcar inactivo en vez de borrar (preserva trazabilidad de cotizaciones)
      return this.prisma.producto.update({
        where: { id },
        data: { activo: false },
      });
    }

    // Hard delete (cascade limpia rutasAlternativas, configPasos, slots, etc.)
    return this.prisma.producto.delete({ where: { id } });
  }

  async obtenerProducto(tenantId: string, id: string) {
    const producto = await this.prisma.producto.findFirst({
      where: { id, tenantId },
      include: {
        rutasAlternativas: {
          where: { activo: true },
          include: {
            ruta: {
              include: {
                pasos: { orderBy: { orden: 'asc' } },
              },
            },
            configPasos: {
              include: {
                rutaPaso: true,
                maquinaM1: { select: { id: true, codigo: true, nombre: true, plantilla: true } },
                perfilM1: { select: { id: true, nombre: true } },
                slotsMateriales: {
                  include: {
                    materialVariante: {
                      select: { id: true, sku: true, nombreVariante: true, precioReferencia: true },
                    },
                  },
                },
                cargosDirectosPaso: {
                  include: { cargoDirectoCatalogo: true },
                },
              },
              orderBy: { rutaPaso: { orden: 'asc' } },
            },
          },
          orderBy: { orden: 'asc' },
        },
        pasosExtras: { orderBy: { ordenInterno: 'asc' } },
        cargosDirectosCotizacion: {
          include: { cargoDirectoCatalogo: true },
        },
      },
    });
    if (!producto) throw new NotFoundException(`Producto ${id} no encontrado`);
    return producto;
  }

  // ============================================================================
  // RUTAS
  // ============================================================================

  async listarRutas(tenantId: string) {
    return this.prisma.ruta.findMany({
      where: { tenantId, activo: true },
      orderBy: { nombre: 'asc' },
      include: {
        pasos: {
          orderBy: { orden: 'asc' },
          select: { id: true, orden: true, familiaCodigo: true },
        },
        _count: { select: { productosAlternativas: true } },
      },
    });
  }

  async crearRuta(tenantId: string, dto: CrearRutaDto) {
    this.validarFamiliasDePasos(dto.pasos);
    try {
      const ruta = await this.prisma.ruta.create({
        data: {
          tenantId,
          codigo: dto.codigo,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          versionActual: 1,
          activo: true,
          pasos: {
            create: dto.pasos.map((p) => ({
              tenantId,
              orden: p.orden,
              familiaCodigo: p.familiaCodigo,
              activo: true,
            })),
          },
        },
        include: { pasos: true },
      });
      // Crear versión inicial snapshot
      await this.prisma.rutaVersion.create({
        data: {
          tenantId,
          rutaId: ruta.id,
          version: 1,
          snapshotJson: {
            pasos: ruta.pasos.map((p) => ({ orden: p.orden, familia: p.familiaCodigo })),
          },
          cambios: 'Versión inicial',
        },
      });
      return ruta;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Ya existe una ruta con código "${dto.codigo}"`);
      }
      throw err;
    }
  }

  async actualizarRuta(tenantId: string, id: string, dto: ActualizarRutaDto) {
    const existente = await this.prisma.ruta.findFirst({
      where: { id, tenantId },
      include: { pasos: { orderBy: { orden: 'asc' } }, productosAlternativas: true },
    });
    if (!existente) throw new NotFoundException(`Ruta ${id} no encontrada`);

    if (dto.pasos) {
      this.validarFamiliasDePasos(dto.pasos);
    }

    // Heurística: si cambian pasos y nuevaVersion no se especifica, sugerir nueva versión
    const cambioEstructural = dto.pasos !== undefined;
    const debeSerNuevaVersion = dto.nuevaVersion === true || (cambioEstructural && dto.nuevaVersion !== false);

    return this.prisma.$transaction(async (tx) => {
      const dataBase: Prisma.RutaUpdateInput = {};
      if (dto.nombre !== undefined) dataBase.nombre = dto.nombre;
      if (dto.descripcion !== undefined) dataBase.descripcion = dto.descripcion;
      if (dto.activo !== undefined) dataBase.activo = dto.activo;

      if (dto.pasos) {
        if (debeSerNuevaVersion && existente.productosAlternativas.length > 0) {
          // Crear nueva versión: incrementa versionActual + nuevo snapshot
          const nuevaVersion = existente.versionActual + 1;
          dataBase.versionActual = nuevaVersion;
          // Eliminar pasos viejos + insertar nuevos
          await tx.rutaPaso.deleteMany({ where: { rutaId: id } });
          await tx.rutaPaso.createMany({
            data: dto.pasos.map((p) => ({
              tenantId,
              rutaId: id,
              orden: p.orden,
              familiaCodigo: p.familiaCodigo,
              activo: true,
            })),
          });
          await tx.rutaVersion.create({
            data: {
              tenantId,
              rutaId: id,
              version: nuevaVersion,
              snapshotJson: { pasos: dto.pasos.map((p) => ({ orden: p.orden, familia: p.familiaCodigo })) },
              cambios: dto.cambios ?? 'Actualización de pasos',
            },
          });
        } else {
          // Patch in-place: reemplazar pasos sin nueva versión
          await tx.rutaPaso.deleteMany({ where: { rutaId: id } });
          await tx.rutaPaso.createMany({
            data: dto.pasos.map((p) => ({
              tenantId,
              rutaId: id,
              orden: p.orden,
              familiaCodigo: p.familiaCodigo,
              activo: true,
            })),
          });
        }
      }

      return tx.ruta.update({
        where: { id },
        data: dataBase,
        include: { pasos: { orderBy: { orden: 'asc' } } },
      });
    });
  }

  async eliminarRuta(tenantId: string, id: string) {
    const existente = await this.prisma.ruta.findFirst({
      where: { id, tenantId },
      include: { productosAlternativas: { take: 1 } },
    });
    if (!existente) throw new NotFoundException(`Ruta ${id} no encontrada`);

    if (existente.productosAlternativas.length > 0) {
      throw new BadRequestException(
        `Ruta "${existente.nombre}" está siendo usada por ${existente.productosAlternativas.length} producto(s). Marcala como inactiva en vez de eliminarla.`,
      );
    }

    return this.prisma.ruta.delete({ where: { id } });
  }

  /** Verifica que cada `familiaCodigo` exista en el catálogo hardcoded. */
  private validarFamiliasDePasos(pasos: Array<{ familiaCodigo: string; orden: number }>) {
    const familiasValidas = new Set(listarFamiliasCatalogo());
    const ordenes = new Set<number>();
    for (const p of pasos) {
      if (!familiasValidas.has(p.familiaCodigo as never)) {
        throw new BadRequestException(`Familia desconocida: "${p.familiaCodigo}"`);
      }
      if (ordenes.has(p.orden)) {
        throw new BadRequestException(`Orden ${p.orden} duplicado en los pasos`);
      }
      ordenes.add(p.orden);
    }
  }

  async obtenerRuta(tenantId: string, id: string) {
    const ruta = await this.prisma.ruta.findFirst({
      where: { id, tenantId },
      include: {
        pasos: { orderBy: { orden: 'asc' } },
        versiones: { orderBy: { version: 'desc' }, take: 5 },
        productosAlternativas: {
          include: { producto: { select: { id: true, codigo: true, nombre: true } } },
        },
      },
    });
    if (!ruta) throw new NotFoundException(`Ruta ${id} no encontrada`);
    return ruta;
  }

  // ============================================================================
  // PRODUCTO ↔ RUTA (asociación + config por paso)
  // ============================================================================

  async crearProductoRutaAlternativa(
    tenantId: string,
    productoId: string,
    dto: CrearProductoRutaAlternativaDto,
  ) {
    // Verificar producto + ruta existen
    const [producto, ruta] = await Promise.all([
      this.prisma.producto.findFirst({ where: { id: productoId, tenantId } }),
      this.prisma.ruta.findFirst({ where: { id: dto.rutaId, tenantId } }),
    ]);
    if (!producto) throw new NotFoundException(`Producto ${productoId} no encontrado`);
    if (!ruta) throw new NotFoundException(`Ruta ${dto.rutaId} no encontrada`);

    // Si esPreferida=true, desmarcar las otras del mismo producto
    if (dto.esPreferida) {
      await this.prisma.productoRutaAlternativa.updateMany({
        where: { tenantId, productoId, esPreferida: true },
        data: { esPreferida: false },
      });
    }

    try {
      return await this.prisma.productoRutaAlternativa.create({
        data: {
          tenantId,
          productoId,
          rutaId: dto.rutaId,
          rutaVersion: dto.rutaVersion,
          nombre: dto.nombre,
          esPreferida: dto.esPreferida ?? false,
          reglaAutoSeleccionJson: (dto.reglaAutoSeleccionJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          orden: dto.orden ?? 0,
          activo: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Este producto ya tiene esa ruta como alternativa`);
      }
      throw err;
    }
  }

  async actualizarProductoRutaAlternativa(
    tenantId: string,
    rutaAltId: string,
    dto: ActualizarProductoRutaAlternativaDto,
  ) {
    const existente = await this.prisma.productoRutaAlternativa.findFirst({
      where: { id: rutaAltId, tenantId },
    });
    if (!existente) throw new NotFoundException(`Ruta alternativa ${rutaAltId} no encontrada`);

    if (dto.esPreferida === true) {
      await this.prisma.productoRutaAlternativa.updateMany({
        where: { tenantId, productoId: existente.productoId, esPreferida: true, id: { not: rutaAltId } },
        data: { esPreferida: false },
      });
    }

    const data: Prisma.ProductoRutaAlternativaUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.esPreferida !== undefined) data.esPreferida = dto.esPreferida;
    if (dto.reglaAutoSeleccionJson !== undefined) {
      data.reglaAutoSeleccionJson = dto.reglaAutoSeleccionJson as Prisma.InputJsonValue;
    }
    if (dto.orden !== undefined) data.orden = dto.orden;
    if (dto.activo !== undefined) data.activo = dto.activo;

    return this.prisma.productoRutaAlternativa.update({ where: { id: rutaAltId }, data });
  }

  async eliminarProductoRutaAlternativa(tenantId: string, rutaAltId: string) {
    const existente = await this.prisma.productoRutaAlternativa.findFirst({
      where: { id: rutaAltId, tenantId },
    });
    if (!existente) throw new NotFoundException(`Ruta alternativa ${rutaAltId} no encontrada`);
    return this.prisma.productoRutaAlternativa.delete({ where: { id: rutaAltId } });
  }

  /**
   * Upsert de la configuración de UN paso del producto en una ruta alternativa.
   * Crea o actualiza ProductoConfigPaso + sus slots de materiales.
   */
  async upsertConfigPaso(
    tenantId: string,
    rutaAltId: string,
    dto: UpsertProductoConfigPasoDto,
  ) {
    const rutaAlt = await this.prisma.productoRutaAlternativa.findFirst({
      where: { id: rutaAltId, tenantId },
    });
    if (!rutaAlt) throw new NotFoundException(`Ruta alternativa ${rutaAltId} no encontrada`);

    return this.prisma.$transaction(async (tx) => {
      // Buscar configPaso existente
      const existente = await tx.productoConfigPaso.findFirst({
        where: { tenantId, productoRutaAlternativaId: rutaAltId, rutaPasoId: dto.rutaPasoId },
      });

      const data: Prisma.ProductoConfigPasoUncheckedCreateInput = {
        tenantId,
        productoRutaAlternativaId: rutaAltId,
        rutaPasoId: dto.rutaPasoId,
        modoActivacion: dto.modoActivacion ?? null,
        condicionActivacionJson: (dto.condicionActivacionJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        modoTiempo: dto.modoTiempo ?? null,
        mecanismoCantidad: dto.mecanismoCantidad ?? null,
        mecanismoCantidadConfigJson: (dto.mecanismoCantidadConfigJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        multiplicadoresActivos: dto.multiplicadoresActivos ?? [],
        paramsPasoJson: (dto.paramsPasoJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        maquinaM1Id: dto.maquinaM1Id ?? null,
        perfilM1Id: dto.perfilM1Id ?? null,
        setupOverrideMin: dto.setupOverrideMin != null ? new Prisma.Decimal(dto.setupOverrideMin) : null,
        cleanupOverrideMin: dto.cleanupOverrideMin != null ? new Prisma.Decimal(dto.cleanupOverrideMin) : null,
        tiempoFijoOverrideMin: dto.tiempoFijoOverrideMin != null ? new Prisma.Decimal(dto.tiempoFijoOverrideMin) : null,
        activo: true,
      };

      let configPaso;
      if (existente) {
        configPaso = await tx.productoConfigPaso.update({ where: { id: existente.id }, data });
      } else {
        configPaso = await tx.productoConfigPaso.create({ data });
      }

      // Si vinieron slots, reemplazar todos
      if (dto.slotsMateriales) {
        await tx.productoConfigPasoSlotMaterial.deleteMany({
          where: { productoConfigPasoId: configPaso.id },
        });
        if (dto.slotsMateriales.length > 0) {
          await tx.productoConfigPasoSlotMaterial.createMany({
            data: dto.slotsMateriales.map((s) => ({
              tenantId,
              productoConfigPasoId: configPaso.id,
              slotCodigo: s.slotCodigo,
              modoSeleccion: s.modoSeleccion,
              criterioMotorAuto: s.criterioMotorAuto ?? null,
              criterioInputCampo: s.criterioInputCampo ?? null,
              criterioMaterialCampo: s.criterioMaterialCampo ?? null,
              materialVarianteId: s.materialVarianteId ?? null,
              materialesCandidatosJson: (s.materialesCandidatosJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
              estrategiaCosto: s.estrategiaCosto ?? 'simple',
              formula: s.formula ?? 'por_unidad_productiva',
              aplicaMultiCaras: s.aplicaMultiCaras ?? false,
              activo: true,
            })),
          });
        }
      }

      return configPaso;
    });
  }

  // ============================================================================
  // CATÁLOGO DE FAMILIAS (hardcoded)
  // ============================================================================

  listarFamilias() {
    return {
      categorias: Object.values(CATEGORIAS).sort((a, b) => a.orden - b.orden),
      familias: listarFamiliasCatalogo().map((codigo) => {
        const f = FAMILIAS[codigo];
        return {
          codigo: f.codigo,
          nombre: f.nombre,
          categoria: f.categoria,
          descripcion: f.descripcion,
          relacionMaquinaSoportada: f.relacionMaquinaSoportada,
          modosTiempoSoportados: f.modosTiempoSoportados,
          mecanismosCantidadSoportados: f.mecanismosCantidadSoportados,
          modosActivacionSoportados: f.modosActivacionSoportados,
          slotsRequeridos: f.slotsRequeridos,
          plantillasCompatibles: f.plantillasCompatibles,
          productosTipicos: f.productosTipicos,
        };
      }),
    };
  }

  // ============================================================================
  // LOOKUPS para el editor de configuración por paso (F.3.7)
  // ============================================================================

  /** Devuelve máquinas + perfiles + materiales+variantes en un solo response. */
  async listarLookupsConfigPaso(tenantId: string) {
    const [maquinas, materiasPrimas] = await Promise.all([
      this.prisma.maquina.findMany({
        where: { tenantId, activo: true },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          plantilla: true,
          perfilesOperativos: {
            where: { activo: true },
            select: {
              id: true,
              nombre: true,
              productivityValue: true,
              productivityUnit: true,
            },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.materiaPrima.findMany({
        where: { tenantId, activo: true },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          familia: true,
          subfamilia: true,
          variantes: {
            where: { activo: true },
            select: {
              id: true,
              sku: true,
              nombreVariante: true,
              precioReferencia: true,
            },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
    ]);
    return { maquinas, materiasPrimas };
  }

  // ============================================================================
  // CARGOS DIRECTOS CATÁLOGO
  // ============================================================================

  async listarCargosDirectos(tenantId: string, soloActivos = true) {
    return this.prisma.cargoDirectoCatalogo.findMany({
      where: { tenantId, ...(soloActivos ? { activo: true } : {}) },
      orderBy: { nombre: 'asc' },
    });
  }

  async crearCargoDirecto(tenantId: string, dto: CrearCargoDirectoDto) {
    try {
      return await this.prisma.cargoDirectoCatalogo.create({
        data: {
          tenantId,
          codigo: dto.codigo,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          modoCalculo: dto.modoCalculo,
          modosActivacionSoportados: dto.modosActivacionSoportados ?? ['OPCIONAL'],
          configJson: (dto.configJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          activo: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Ya existe un cargo con código "${dto.codigo}"`);
      }
      throw err;
    }
  }

  async actualizarCargoDirecto(tenantId: string, id: string, dto: ActualizarCargoDirectoDto) {
    const existente = await this.prisma.cargoDirectoCatalogo.findFirst({
      where: { id, tenantId },
    });
    if (!existente) throw new NotFoundException(`Cargo ${id} no encontrado`);

    const data: Prisma.CargoDirectoCatalogoUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
    if (dto.modoCalculo !== undefined) data.modoCalculo = dto.modoCalculo;
    if (dto.modosActivacionSoportados !== undefined) {
      data.modosActivacionSoportados = dto.modosActivacionSoportados;
    }
    if (dto.configJson !== undefined) data.configJson = dto.configJson as Prisma.InputJsonValue;
    if (dto.activo !== undefined) data.activo = dto.activo;

    return this.prisma.cargoDirectoCatalogo.update({ where: { id }, data });
  }

  async eliminarCargoDirecto(tenantId: string, id: string) {
    const existente = await this.prisma.cargoDirectoCatalogo.findFirst({
      where: { id, tenantId },
      include: {
        pasoCargos: { take: 1 },
        cotizacionCargos: { take: 1 },
      },
    });
    if (!existente) throw new NotFoundException(`Cargo ${id} no encontrado`);

    if (existente.pasoCargos.length > 0 || existente.cotizacionCargos.length > 0) {
      // Soft-delete (preserva integridad de productos que lo usan)
      return this.prisma.cargoDirectoCatalogo.update({
        where: { id },
        data: { activo: false },
      });
    }

    return this.prisma.cargoDirectoCatalogo.delete({ where: { id } });
  }
}
