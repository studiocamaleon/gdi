import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildModoColorOptionsFromProfiles } from './modo-color-comercial';
import { PrismaService } from '../prisma/prisma.service';
import { MAQUINA_DISPONIBLE_WHERE } from '../maquinaria/maquinaria-disponibilidad';
import { PaginationDto, paginatedResponse } from '../common/dto/pagination.dto';
import { resolverFamilia } from './pasos/familias';
import { OrdenProductosDto } from './dto/list-productos-query.dto';
import type {
  ActualizarProductoDto,
  CrearProductoDto,
  DuplicarProductoDto,
  MedidaPredefinidaDto,
} from './dto/producto.dto';

type MedidaPredefinidaNormalizada = {
  id: string;
  nombre: string;
  anchoMm: number;
  altoMm: number;
  esDefault: boolean;
  /** "pliego_util" = plancha completa (pieza derivada del pliego al cotizar). */
  tipo?: 'pliego_util';
};

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  async listarProductos(
    tenantId: string,
    opts: {
      pagination: PaginationDto;
      activo?: boolean;
      search?: string;
      unidadComercial?: 'unidad' | 'm2' | 'metro_lineal';
      subcategoriaCodigo?: string;
      orden?: OrdenProductosDto;
    },
  ) {
    const {
      pagination,
      activo,
      search,
      unidadComercial,
      subcategoriaCodigo,
      orden = OrdenProductosDto.recientes,
    } = opts;
    const where: Prisma.ProductoWhereInput = {
      tenantId,
      // Los productos de sistema (ej. la plantilla del centro de copiado) no se
      // listan en el catálogo: los gestiona su módulo, no el usuario.
      sistemaCodigo: null,
      ...(activo !== undefined ? { activo } : {}),
      ...(unidadComercial ? { unidadComercial } : {}),
      ...(subcategoriaCodigo
        ? { subcategoriaComercial: { codigo: subcategoriaCodigo } }
        : {}),
      // Búsqueda por título (nombre) y código, no por la descripción.
      ...(search
        ? {
            OR: [
              { nombre: { contains: search, mode: 'insensitive' } },
              { codigo: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.producto.findMany({
        where,
        orderBy:
          orden === OrdenProductosDto.nombre_asc
            ? { nombre: 'asc' }
            : orden === OrdenProductosDto.nombre_desc
              ? { nombre: 'desc' }
              : { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          subcategoriaComercial: {
            include: { categoria: true },
          },
          rutasAlternativas: {
            where: { activo: true },
            select: {
              id: true,
              nombre: true,
              esPreferida: true,
              rutaVersion: true,
              ruta: {
                select: {
                  id: true,
                  codigo: true,
                  nombre: true,
                  pasos: { select: { id: true, version: true } },
                },
              },
              configPasos: {
                select: { id: true, rutaPasoId: true, tercerizado: true },
              },
            },
            orderBy: { orden: 'asc' },
          },
        },
      }),
      this.prisma.producto.count({ where }),
    ]);

    // Flag derivado: ¿algún paso tercerizado en alguna ruta? (para el badge)
    const conFlag = data.map((producto) => {
      const rutasCompletas =
        producto.rutasAlternativas.length > 0 &&
        producto.rutasAlternativas.every((ra) => {
          const configurados = new Set(
            ra.configPasos.map((paso) => paso.rutaPasoId),
          );
          return ra.ruta.pasos
            .filter((paso) => paso.version === ra.rutaVersion)
            .every((paso) => configurados.has(paso.id));
        });
      const precio = producto.precioConfigJson;
      const precioCompleto =
        precio !== null &&
        typeof precio === 'object' &&
        !Array.isArray(precio) &&
        typeof (precio as Record<string, unknown>).metodoCalculo === 'string';
      const listoParaCotizar = rutasCompletas && precioCompleto;

      return {
        ...producto,
        tercerizado: producto.rutasAlternativas.some((ra) =>
          ra.configPasos.some((paso) => paso.tercerizado),
        ),
        listoParaCotizar,
        estadoCatalogo: producto.activo
          ? listoParaCotizar
            ? 'activo'
            : 'incompleto'
          : listoParaCotizar
            ? 'listo'
            : 'borrador',
      };
    });

    return paginatedResponse(conFlag, total, pagination);
  }

  async crearProducto(tenantId: string, dto: CrearProductoDto) {
    const subcategoriaComercial = await this.assertSubcategoriaComercial(
      dto.subcategoriaComercialCodigo,
    );
    const medidas = this.normalizarMedidasPredefinidas({
      modoMedidas: dto.modoMedidas,
      medidas: dto.medidasPredefinidasJson,
      anchoDefault: dto.medidaDefaultAnchoMm,
      altoDefault: dto.medidaDefaultAltoMm,
      unidadComercial: dto.unidadComercial,
    });
    const medidaDefault = medidas.find((medida) => medida.esDefault);
    const codigoManual = dto.codigo?.trim();
    const codigoBase =
      codigoManual || this.codigoFromNombre(dto.nombre, 'PRODUCTO');

    for (let intento = 0; intento < 5; intento += 1) {
      const codigo = await this.nextCopyCode(tenantId, codigoBase);
      try {
        return await this.prisma.producto.create({
          data: {
            tenantId,
            subcategoriaComercialId: subcategoriaComercial.id,
            codigo,
            nombre: dto.nombre,
            descripcion: dto.descripcion ?? null,
            unidadComercial: dto.unidadComercial,
            modoMedidas: dto.modoMedidas,
            minimoComercialPolitica: this.normalizarMinimoPolitica(
              dto.minimoComercialPolitica,
              dto.minimoComercialCantidad,
            ),
            minimoComercialCantidad: this.normalizarMinimoCantidad(
              dto.minimoComercialPolitica,
              dto.minimoComercialCantidad,
            ),
            minimoComercialBase: this.normalizarMinimoBase(
              dto.minimoComercialPolitica,
              dto.minimoComercialBase,
            ),
            medidaDefaultAnchoMm: medidaDefault
              ? new Prisma.Decimal(medidaDefault.anchoMm)
              : null,
            medidaDefaultAltoMm: medidaDefault
              ? new Prisma.Decimal(medidaDefault.altoMm)
              : null,
            medidasPredefinidasJson:
              medidas.length > 0
                ? (medidas as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            personalizacionesJson: (dto.personalizacionesJson ??
              Prisma.JsonNull) as Prisma.InputJsonValue,
            precioConfigJson: (dto.precioConfigJson ??
              Prisma.JsonNull) as Prisma.InputJsonValue,
            atributosComercialesJson: (dto.atributosComercialesJson ??
              Prisma.JsonNull) as Prisma.InputJsonValue,
            activo: false,
          },
          include: {
            subcategoriaComercial: { include: { categoria: true } },
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          if (codigoManual) {
            throw new BadRequestException(
              `Ya existe un producto con código "${codigo}"`,
            );
          }
          continue;
        }
        throw err;
      }
    }

    throw new BadRequestException(
      'No se pudo generar un código de producto único.',
    );
  }

  async actualizarProducto(
    tenantId: string,
    id: string,
    dto: ActualizarProductoDto,
  ) {
    const existente = await this.prisma.producto.findFirst({
      where: { id, tenantId },
    });
    if (!existente) throw new NotFoundException(`Producto ${id} no encontrado`);
    if (existente.sistemaCodigo) {
      throw new BadRequestException(
        'Este producto lo gestiona un módulo del sistema y no se edita desde el catálogo.',
      );
    }
    if (
      dto.expectedUpdatedAt &&
      new Date(dto.expectedUpdatedAt).getTime() !==
        existente.updatedAt.getTime()
    ) {
      throw new ConflictException(
        'El producto cambió desde que abriste la pantalla. Recargá antes de guardar para no sobrescribir cambios de otra persona.',
      );
    }

    const data: Prisma.ProductoUpdateInput = {};
    const touchedMedidas =
      dto.modoMedidas !== undefined ||
      dto.medidaDefaultAnchoMm !== undefined ||
      dto.medidaDefaultAltoMm !== undefined ||
      dto.medidasPredefinidasJson !== undefined;
    const medidas = touchedMedidas
      ? this.normalizarMedidasPredefinidas({
          modoMedidas: dto.modoMedidas ?? existente.modoMedidas,
          medidas:
            dto.medidasPredefinidasJson !== undefined
              ? dto.medidasPredefinidasJson
              : this.jsonToMedidas(existente.medidasPredefinidasJson),
          anchoDefault:
            dto.medidaDefaultAnchoMm !== undefined
              ? dto.medidaDefaultAnchoMm
              : this.decimalToNumber(existente.medidaDefaultAnchoMm),
          altoDefault:
            dto.medidaDefaultAltoMm !== undefined
              ? dto.medidaDefaultAltoMm
              : this.decimalToNumber(existente.medidaDefaultAltoMm),
          unidadComercial: dto.unidadComercial ?? existente.unidadComercial,
        })
      : [];
    const medidaDefault = medidas.find((medida) => medida.esDefault);
    if (dto.subcategoriaComercialCodigo !== undefined) {
      await this.assertSubcategoriaComercial(dto.subcategoriaComercialCodigo);
      data.subcategoriaComercial = {
        connect: { codigo: dto.subcategoriaComercialCodigo },
      };
    }
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
    if (dto.unidadComercial !== undefined) {
      data.unidadComercial = dto.unidadComercial;
    }
    if (dto.modoMedidas !== undefined) data.modoMedidas = dto.modoMedidas;
    if (
      dto.minimoComercialPolitica !== undefined ||
      dto.minimoComercialCantidad !== undefined ||
      dto.minimoComercialBase !== undefined
    ) {
      const politica = this.normalizarMinimoPolitica(
        dto.minimoComercialPolitica ?? existente.minimoComercialPolitica,
        dto.minimoComercialCantidad !== undefined
          ? dto.minimoComercialCantidad
          : this.decimalToNumber(existente.minimoComercialCantidad),
      );
      data.minimoComercialPolitica = politica;
      data.minimoComercialCantidad = this.normalizarMinimoCantidad(
        politica,
        dto.minimoComercialCantidad !== undefined
          ? dto.minimoComercialCantidad
          : this.decimalToNumber(existente.minimoComercialCantidad),
      );
      data.minimoComercialBase = this.normalizarMinimoBase(
        politica,
        dto.minimoComercialBase ?? existente.minimoComercialBase,
      );
    }
    if (touchedMedidas) {
      data.medidaDefaultAnchoMm = medidaDefault
        ? new Prisma.Decimal(medidaDefault.anchoMm)
        : null;
      data.medidaDefaultAltoMm = medidaDefault
        ? new Prisma.Decimal(medidaDefault.altoMm)
        : null;
      data.medidasPredefinidasJson =
        medidas.length > 0
          ? (medidas as Prisma.InputJsonValue)
          : Prisma.JsonNull;
    }
    if (dto.personalizacionesJson !== undefined) {
      data.personalizacionesJson = (dto.personalizacionesJson ??
        Prisma.JsonNull) as Prisma.InputJsonValue;
    }
    if (dto.precioConfigJson !== undefined) {
      data.precioConfigJson = dto.precioConfigJson as Prisma.InputJsonValue;
    }
    if (dto.atributosComercialesJson !== undefined) {
      data.atributosComercialesJson =
        dto.atributosComercialesJson as Prisma.InputJsonValue;
    }
    if (dto.activo !== undefined) data.activo = dto.activo;

    return this.prisma.producto.update({
      where: { id },
      data,
      include: {
        subcategoriaComercial: { include: { categoria: true } },
      },
    });
  }

  async eliminarProducto(tenantId: string, id: string) {
    const existente = await this.prisma.producto.findFirst({
      where: { id, tenantId },
      include: {
        cotizacionItems: { take: 1 },
      },
    });
    if (!existente) throw new NotFoundException(`Producto ${id} no encontrado`);
    if (existente.sistemaCodigo) {
      throw new BadRequestException(
        'Este producto lo gestiona un módulo del sistema y no se borra desde el catálogo.',
      );
    }

    if (existente.cotizacionItems.length > 0) {
      return this.prisma.producto.update({
        where: { id },
        data: { activo: false },
      });
    }

    return this.prisma.producto.delete({ where: { id } });
  }

  async duplicarProducto(
    tenantId: string,
    id: string,
    dto: DuplicarProductoDto = {},
  ) {
    const origen = await this.prisma.producto.findFirst({
      where: { id, tenantId },
      include: {
        rutasAlternativas: {
          include: {
            configPasos: {
              include: {
                slotsMateriales: {
                  include: {
                    candidatos: {
                      include: { variantes: { orderBy: { orden: 'asc' } } },
                      orderBy: { orden: 'asc' },
                    },
                  },
                  orderBy: { slotCodigo: 'asc' },
                },
                maquinasCandidatas: { orderBy: { orden: 'asc' } },
                cargosDirectosPaso: true,
                tercerizadoEntradas: { where: { activo: true } },
              },
            },
          },
          orderBy: { orden: 'asc' },
        },
        pasosExtras: { orderBy: { ordenInterno: 'asc' } },
        cargosDirectosCotizacion: true,
        impuestosAplicados: { orderBy: { orden: 'asc' } },
        comisionesAplicadas: { orderBy: { orden: 'asc' } },
        preciosEspecialesClientes: true,
      },
    });
    if (!origen) throw new NotFoundException(`Producto ${id} no encontrado`);

    const nombre = dto.nombre?.trim() || `${origen.nombre} copia`;
    const baseCodigo = dto.codigo?.trim() || this.codigoFromNombre(nombre);
    const codigo = await this.nextCopyCode(tenantId, baseCodigo);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const productoDuplicado = await tx.producto.create({
          data: {
            tenantId,
            subcategoriaComercialId: origen.subcategoriaComercialId,
            codigo,
            nombre,
            descripcion: origen.descripcion,
            unidadComercial: origen.unidadComercial,
            modoMedidas: origen.modoMedidas,
            minimoComercialPolitica: origen.minimoComercialPolitica,
            minimoComercialCantidad: origen.minimoComercialCantidad,
            minimoComercialBase: origen.minimoComercialBase,
            medidaDefaultAnchoMm: origen.medidaDefaultAnchoMm,
            medidaDefaultAltoMm: origen.medidaDefaultAltoMm,
            medidasPredefinidasJson: this.jsonOrNull(
              origen.medidasPredefinidasJson,
            ),
            personalizacionesJson: this.jsonOrNull(
              origen.personalizacionesJson,
            ),
            precioConfigJson: this.jsonOrNull(origen.precioConfigJson),
            atributosComercialesJson: this.jsonOrNull(
              origen.atributosComercialesJson,
            ),
            categoriaFiscal: origen.categoriaFiscal,
            activo: dto.activo ?? false,
          },
          include: {
            subcategoriaComercial: { include: { categoria: true } },
          },
        });

        const rutaDuplicadaPorOrigen = new Map<string, string>();

        for (const rutaAlt of origen.rutasAlternativas) {
          const rutaDuplicada = await tx.productoRutaAlternativa.create({
            data: {
              tenantId,
              productoId: productoDuplicado.id,
              rutaId: rutaAlt.rutaId,
              rutaVersion: rutaAlt.rutaVersion,
              nombre: rutaAlt.nombre,
              esPreferida: rutaAlt.esPreferida,
              reglaAutoSeleccionJson: this.jsonOrNull(
                rutaAlt.reglaAutoSeleccionJson,
              ),
              orden: rutaAlt.orden,
              activo: rutaAlt.activo,
            },
          });
          rutaDuplicadaPorOrigen.set(rutaAlt.id, rutaDuplicada.id);

          for (const config of rutaAlt.configPasos) {
            const configDuplicada = await tx.productoConfigPaso.create({
              data: {
                tenantId,
                productoRutaAlternativaId: rutaDuplicada.id,
                rutaPasoId: config.rutaPasoId,
                modoActivacion: config.modoActivacion,
                condicionActivacionJson: this.jsonOrNull(
                  config.condicionActivacionJson,
                ),
                modoTiempo: config.modoTiempo,
                mecanismoCantidad: config.mecanismoCantidad,
                mecanismoCantidadConfigJson: this.jsonOrNull(
                  config.mecanismoCantidadConfigJson,
                ),
                multiplicadoresActivos: config.multiplicadoresActivos,
                paramsPasoJson: this.jsonOrNull(config.paramsPasoJson),
                nombreVisible: config.nombreVisible,
                maquinaM1Id: config.maquinaM1Id,
                perfilM1Id: config.perfilM1Id,
                centroCostoId: config.centroCostoId,
                setupOverrideMin: config.setupOverrideMin,
                cleanupOverrideMin: config.cleanupOverrideMin,
                tiempoFijoOverrideMin: config.tiempoFijoOverrideMin,
                dotacionOperarios: config.dotacionOperarios,
                tercerizado: config.tercerizado,
                proveedorId: config.proveedorId,
                fuenteCostoTercerizado: config.fuenteCostoTercerizado,
                tercerizadoConfigJson: this.jsonOrNull(
                  config.tercerizadoConfigJson,
                ),
                plazoProveedorDias: config.plazoProveedorDias,
                requiereRutaPasoIds: config.requiereRutaPasoIds,
                activo: config.activo,
              },
            });

            for (const slot of config.slotsMateriales) {
              const slotDuplicado =
                await tx.productoConfigPasoSlotMaterial.create({
                  data: {
                    tenantId,
                    productoConfigPasoId: configDuplicada.id,
                    slotCodigo: slot.slotCodigo,
                    slotNombre: slot.slotNombre,
                    slotRol: slot.slotRol,
                    modoSeleccion: slot.modoSeleccion,
                    criterioMotorAuto: slot.criterioMotorAuto,
                    criterioInputCampo: slot.criterioInputCampo,
                    criterioMaterialCampo: slot.criterioMaterialCampo,
                    materialVarianteId: slot.materialVarianteId,
                    formula: slot.formula,
                    cantidadFactor: slot.cantidadFactor,
                    cantidadBase: slot.cantidadBase,
                    fuenteMedida: slot.fuenteMedida,
                    aplicaMultiCaras: slot.aplicaMultiCaras,
                    activo: slot.activo,
                  },
                });

              for (const candidato of slot.candidatos) {
                const candidatoDuplicado =
                  await tx.productoConfigPasoSlotMaterialCandidato.create({
                    data: {
                      tenantId,
                      slotMaterialId: slotDuplicado.id,
                      materiaPrimaId: candidato.materiaPrimaId,
                      defaultVarianteId: candidato.defaultVarianteId,
                      orden: candidato.orden,
                    },
                  });
                if (candidato.variantes.length > 0) {
                  await tx.productoConfigPasoSlotMaterialCandidatoVariante.createMany(
                    {
                      data: candidato.variantes.map((variante) => ({
                        tenantId,
                        candidatoId: candidatoDuplicado.id,
                        varianteId: variante.varianteId,
                        orden: variante.orden,
                      })),
                    },
                  );
                }
              }
            }

            if (config.maquinasCandidatas.length > 0) {
              await tx.productoConfigPasoMaquinaCandidata.createMany({
                data: config.maquinasCandidatas.map((maquina) => ({
                  tenantId,
                  productoConfigPasoId: configDuplicada.id,
                  maquinaId: maquina.maquinaId,
                  perfilDefaultId: maquina.perfilDefaultId,
                  perfilDefaultPorModoJson:
                    maquina.perfilDefaultPorModoJson ?? Prisma.JsonNull,
                  modoColorAllowedModes: maquina.modoColorAllowedModes,
                  esPreferida: maquina.esPreferida,
                  orden: maquina.orden,
                  activo: maquina.activo,
                })),
              });
            }

            if (config.cargosDirectosPaso.length > 0) {
              await tx.productoCargoDirectoPaso.createMany({
                data: config.cargosDirectosPaso.map((cargo) => ({
                  tenantId,
                  productoConfigPasoId: configDuplicada.id,
                  cargoDirectoCatalogoId: cargo.cargoDirectoCatalogoId,
                  modoActivacion: cargo.modoActivacion,
                  condicionActivacionJson: this.jsonOrNull(
                    cargo.condicionActivacionJson,
                  ),
                  configOverrideJson: this.jsonOrNull(cargo.configOverrideJson),
                  activo: cargo.activo,
                })),
              });
            }

            if (config.tercerizadoEntradas.length > 0) {
              await tx.pasoTercerizadoEntrada.createMany({
                data: config.tercerizadoEntradas.map((entrada) => ({
                  tenantId,
                  productoConfigPasoId: configDuplicada.id,
                  valoresJson: this.jsonOrNull(entrada.valoresJson),
                  claveMatch: entrada.claveMatch,
                  cantidad: entrada.cantidad,
                  costo: entrada.costo,
                  activo: entrada.activo,
                })),
              });
            }
          }
        }

        if (origen.pasosExtras.length > 0) {
          await tx.productoPasoExtra.createMany({
            data: origen.pasosExtras.map((paso) => ({
              tenantId,
              productoId: productoDuplicado.id,
              rutaAlternativaId: paso.rutaAlternativaId
                ? (rutaDuplicadaPorOrigen.get(paso.rutaAlternativaId) ?? null)
                : null,
              insertarDespuesDeRutaPasoId: paso.insertarDespuesDeRutaPasoId,
              ordenInterno: paso.ordenInterno,
              familiaCodigo: paso.familiaCodigo,
              nombreVisible: paso.nombreVisible,
              modoActivacion: paso.modoActivacion,
              condicionActivacionJson: this.jsonOrNull(
                paso.condicionActivacionJson,
              ),
              modoTiempo: paso.modoTiempo,
              mecanismoCantidad: paso.mecanismoCantidad,
              mecanismoCantidadConfigJson: this.jsonOrNull(
                paso.mecanismoCantidadConfigJson,
              ),
              multiplicadoresActivos: paso.multiplicadoresActivos,
              setupOverrideMin: paso.setupOverrideMin,
              cleanupOverrideMin: paso.cleanupOverrideMin,
              tiempoFijoOverrideMin: paso.tiempoFijoOverrideMin,
              paramsPasoJson: this.jsonOrNull(paso.paramsPasoJson),
              maquinaM1Id: paso.maquinaM1Id,
              perfilM1Id: paso.perfilM1Id,
              centroCostoId: paso.centroCostoId,
              configSlotsMaterialesJson: this.jsonOrNull(
                paso.configSlotsMaterialesJson,
              ),
              configMaquinasCandidatasJson: this.jsonOrNull(
                paso.configMaquinasCandidatasJson,
              ),
              configCargosDirectosJson: this.jsonOrNull(
                paso.configCargosDirectosJson,
              ),
              activo: paso.activo,
            })),
          });
        }

        if (origen.cargosDirectosCotizacion.length > 0) {
          await tx.productoCargoDirectoCotizacion.createMany({
            data: origen.cargosDirectosCotizacion.map((cargo) => ({
              tenantId,
              productoId: productoDuplicado.id,
              cargoDirectoCatalogoId: cargo.cargoDirectoCatalogoId,
              modoActivacion: cargo.modoActivacion,
              condicionActivacionJson: this.jsonOrNull(
                cargo.condicionActivacionJson,
              ),
              configOverrideJson: this.jsonOrNull(cargo.configOverrideJson),
              activo: cargo.activo,
            })),
          });
        }

        if (origen.impuestosAplicados.length > 0) {
          await tx.productoImpuestoAplicado.createMany({
            data: origen.impuestosAplicados.map((impuesto) => ({
              tenantId,
              productoId: productoDuplicado.id,
              impuestoCatalogoId: impuesto.impuestoCatalogoId,
              orden: impuesto.orden,
            })),
          });
        }

        if (origen.comisionesAplicadas.length > 0) {
          await tx.productoComisionAplicada.createMany({
            data: origen.comisionesAplicadas.map((comision) => ({
              tenantId,
              productoId: productoDuplicado.id,
              comisionCatalogoId: comision.comisionCatalogoId,
              orden: comision.orden,
            })),
          });
        }

        if (origen.preciosEspecialesClientes.length > 0) {
          await tx.productoPrecioEspecialClienteV2.createMany({
            data: origen.preciosEspecialesClientes.map((precio) => ({
              tenantId,
              productoId: productoDuplicado.id,
              clienteId: precio.clienteId,
              configJson: this.jsonOrNull(precio.configJson),
              activo: precio.activo,
            })),
          });
        }

        return productoDuplicado;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Ya existe un producto con código "${codigo}"`,
        );
      }
      throw err;
    }
  }

  private async nextCopyCode(tenantId: string, codigoBase: string) {
    const base = codigoBase.slice(0, 50);
    for (let index = 1; index < 1000; index += 1) {
      const suffix = `-${index}`;
      const candidate =
        index === 1 ? base : `${base.slice(0, 50 - suffix.length)}${suffix}`;
      const exists = await this.prisma.producto.findFirst({
        where: { tenantId, codigo: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    throw new BadRequestException(
      'No se pudo generar un código de copia único.',
    );
  }

  private codigoFromNombre(nombre: string, fallback = 'PRODUCTO-COPIA') {
    const codigo = nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .toUpperCase();
    return codigo || fallback;
  }

  private jsonOrNull(value: Prisma.JsonValue | null) {
    return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }

  private decimalToNumber(value: Prisma.Decimal | null): number | null {
    return value == null ? null : Number(value);
  }

  private normalizarMinimoPolitica(
    politica: string | null | undefined,
    cantidad: number | null | undefined,
  ) {
    const normalized =
      politica === 'ADVERTIR_FACTURAR_MINIMO' || politica === 'BLOQUEAR'
        ? politica
        : 'NONE';
    const cantidadNumber = Number(cantidad ?? 0);
    if (!Number.isFinite(cantidadNumber) || cantidadNumber <= 0) return 'NONE';
    return normalized;
  }

  private normalizarMinimoCantidad(
    politica: string | null | undefined,
    cantidad: number | null | undefined,
  ) {
    if (politica !== 'ADVERTIR_FACTURAR_MINIMO' && politica !== 'BLOQUEAR') {
      return null;
    }
    const cantidadNumber = Number(cantidad ?? 0);
    return Number.isFinite(cantidadNumber) && cantidadNumber > 0
      ? new Prisma.Decimal(cantidadNumber)
      : null;
  }

  private normalizarMinimoBase(
    politica: string | null | undefined,
    base: string | null | undefined,
  ) {
    if (politica !== 'ADVERTIR_FACTURAR_MINIMO' && politica !== 'BLOQUEAR') {
      return 'cantidad_comercial';
    }
    return base === 'pliegos_impresos'
      ? 'pliegos_impresos'
      : 'cantidad_comercial';
  }

  private jsonToMedidas(
    value: Prisma.JsonValue | null,
  ): MedidaPredefinidaDto[] | null {
    return Array.isArray(value) ? (value as MedidaPredefinidaDto[]) : null;
  }

  private normalizarMedidasPredefinidas(input: {
    modoMedidas: string;
    medidas?: MedidaPredefinidaDto[] | null;
    anchoDefault?: number | null;
    altoDefault?: number | null;
    unidadComercial?: string | null;
  }): MedidaPredefinidaNormalizada[] {
    if (input.modoMedidas === 'LIBRE') return [];

    const fuente =
      input.medidas && input.medidas.length > 0
        ? input.medidas
        : input.anchoDefault && input.altoDefault
          ? [
              {
                id: 'default',
                nombre: `${input.anchoDefault} x ${input.altoDefault} mm`,
                anchoMm: input.anchoDefault,
                altoMm: input.altoDefault,
                esDefault: true,
              },
            ]
          : [];

    // Los productos por unidad (merchandising comprado: taza, remera) pueden no
    // tener medida: se cotizan por unidad y la estampa la maneja la
    // personalización. Ver docs/productos-comprados-merchandising-diseno.md
    if (
      input.modoMedidas === 'FIJA' &&
      fuente.length === 0 &&
      input.unidadComercial !== 'unidad'
    ) {
      throw new BadRequestException(
        'Los productos con medida fija deben tener al menos una medida predefinida.',
      );
    }

    const medidas = fuente.map((medida, index) => {
      // "Plancha completa" (pliego_util): la pieza se deriva del pliego del
      // paso de impresión al cotizar — no declara dims propias (0×0 acá).
      // Ver docs/medida-plancha-area-util-diseno.md.
      const esPliegoUtil = medida.tipo === 'pliego_util';
      const anchoMm = esPliegoUtil ? 0 : Number(medida.anchoMm);
      const altoMm = esPliegoUtil ? 0 : Number(medida.altoMm);
      if (!esPliegoUtil && (!Number.isFinite(anchoMm) || anchoMm <= 0)) {
        throw new BadRequestException(
          'Cada medida debe tener ancho mayor a 0.',
        );
      }
      if (!esPliegoUtil && (!Number.isFinite(altoMm) || altoMm <= 0)) {
        throw new BadRequestException('Cada medida debe tener alto mayor a 0.');
      }
      return {
        id:
          typeof medida.id === 'string' && medida.id.trim()
            ? medida.id.trim()
            : `medida-${index + 1}`,
        nombre:
          typeof medida.nombre === 'string' && medida.nombre.trim()
            ? medida.nombre.trim()
            : esPliegoUtil
              ? 'Plancha completa'
              : `${anchoMm} x ${altoMm} mm`,
        anchoMm,
        altoMm,
        esDefault: medida.esDefault === true,
        ...(esPliegoUtil ? { tipo: 'pliego_util' as const } : {}),
      };
    });

    const defaults = medidas.filter((medida) => medida.esDefault);
    if (defaults.length > 1) {
      throw new BadRequestException(
        'Solo una medida predefinida puede ser predeterminada.',
      );
    }
    if (medidas.length > 0 && defaults.length === 0) {
      medidas[0].esDefault = true;
    }

    return medidas;
  }

  async obtenerProducto(tenantId: string, id: string) {
    const producto = await this.prisma.producto.findFirst({
      where: { id, tenantId },
      include: {
        subcategoriaComercial: {
          include: { categoria: true },
        },
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
                maquinaM1: {
                  select: {
                    id: true,
                    codigo: true,
                    nombre: true,
                    plantilla: true,
                    anchoUtil: true,
                    parametrosTecnicosJson: true,
                    centroCostoPrincipalId: true,
                    centroCostoPrincipal: {
                      select: {
                        id: true,
                        codigo: true,
                        nombre: true,
                      },
                    },
                    consumibles: {
                      where: { activo: true },
                      select: {
                        id: true,
                        perfilOperativoId: true,
                        consumoBase: true,
                        detalleJson: true,
                        materiaPrimaVariante: {
                          select: {
                            id: true,
                            precioReferencia: true,
                          },
                        },
                      },
                    },
                    perfilesOperativos: {
                      where: { activo: true },
                      select: {
                        id: true,
                        nombre: true,
                        activo: true,
                        tipoPerfil: true,
                        // Ordena los niveles de complejidad del corte en el
                        // sheet (más m²/h = corte más fácil).
                        productivityValue: true,
                        detalleJson: true,
                      },
                    },
                  },
                },
                perfilM1: {
                  select: {
                    id: true,
                    nombre: true,
                    tipoPerfil: true,
                    detalleJson: true,
                  },
                },
                centroCosto: {
                  select: {
                    id: true,
                    codigo: true,
                    nombre: true,
                  },
                },
                slotsMateriales: {
                  include: {
                    materialVariante: {
                      select: {
                        id: true,
                        sku: true,
                        nombreVariante: true,
                        precioReferencia: true,
                        atributosVarianteJson: true,
                        materiaPrima: {
                          select: {
                            id: true,
                            codigo: true,
                            nombre: true,
                            familia: true,
                            subfamilia: true,
                            templateId: true,
                            variantes: {
                              where: { activo: true },
                              select: {
                                id: true,
                                sku: true,
                                nombreVariante: true,
                                precioReferencia: true,
                                atributosVarianteJson: true,
                              },
                              orderBy: { sku: 'asc' },
                            },
                          },
                        },
                      },
                    },
                    candidatos: {
                      orderBy: { orden: 'asc' },
                      include: {
                        materiaPrima: {
                          select: {
                            id: true,
                            codigo: true,
                            nombre: true,
                            familia: true,
                            subfamilia: true,
                            templateId: true,
                            // Modo "todas las variantes": la lista viva de
                            // variantes activas del material, para que el editor
                            // muestre todas (y absorba las nuevas).
                            variantes: {
                              where: { activo: true },
                              orderBy: { sku: 'asc' },
                              select: {
                                id: true,
                                sku: true,
                                nombreVariante: true,
                                precioReferencia: true,
                                atributosVarianteJson: true,
                              },
                            },
                          },
                        },
                        defaultVariante: {
                          select: {
                            id: true,
                            sku: true,
                            nombreVariante: true,
                            precioReferencia: true,
                          },
                        },
                        variantes: {
                          orderBy: { orden: 'asc' },
                          include: {
                            variante: {
                              select: {
                                id: true,
                                sku: true,
                                nombreVariante: true,
                                precioReferencia: true,
                                atributosVarianteJson: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                maquinasCandidatas: {
                  where: { activo: true },
                  orderBy: [{ esPreferida: 'desc' }, { orden: 'asc' }],
                  include: {
                    perfilDefault: {
                      select: {
                        id: true,
                        nombre: true,
                        tipoPerfil: true,
                        detalleJson: true,
                      },
                    },
                    maquina: {
                      select: {
                        id: true,
                        codigo: true,
                        nombre: true,
                        plantilla: true,
                        anchoUtil: true,
                        parametrosTecnicosJson: true,
                        centroCostoPrincipalId: true,
                        centroCostoPrincipal: {
                          select: {
                            id: true,
                            codigo: true,
                            nombre: true,
                          },
                        },
                        perfilesOperativos: {
                          where: { activo: true },
                          select: {
                            id: true,
                            nombre: true,
                            activo: true,
                            tipoPerfil: true,
                            // Ídem maquinaM1: niveles de complejidad del corte.
                            productivityValue: true,
                            detalleJson: true,
                          },
                        },
                      },
                    },
                  },
                },
                cargosDirectosPaso: {
                  include: { cargoDirectoCatalogo: true },
                },
                tercerizadoEntradas: { where: { activo: true } },
              },
              orderBy: { rutaPaso: { orden: 'asc' } },
            },
          },
          orderBy: { orden: 'asc' },
        },
        pasosExtras: {
          orderBy: { ordenInterno: 'asc' },
          include: {
            maquinaM1: {
              select: { id: true, codigo: true, nombre: true, plantilla: true },
            },
            perfilM1: { select: { id: true, nombre: true } },
            centroCosto: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
              },
            },
          },
        },
        cargosDirectosCotizacion: {
          include: { cargoDirectoCatalogo: true },
        },
      },
    });
    if (!producto) throw new NotFoundException(`Producto ${id} no encontrado`);

    // M-2 en extras: hidratar las candidatas embebidas (ids → máquinas con
    // perfiles) para que editor y cotizador las consuman con el mismo shape
    // que las candidatas de configPasos.
    const pasoExtraCandidatas = await this.hydratePasoExtraCandidatas(
      tenantId,
      producto.pasosExtras,
    );
    const pasoExtraSlots = await this.hydratePasoExtraSlots(
      tenantId,
      producto.pasosExtras,
    );
    return {
      ...producto,
      rutasAlternativas: producto.rutasAlternativas.map((rutaAlt) => ({
        ...rutaAlt,
        ruta: {
          ...rutaAlt.ruta,
          // `familiaNombre` resuelto en el server: para una familia TENANT el
          // código es un UUID y todo fallback del front que "humanice" el
          // código termina mostrando el UUID (pasó 3 veces en los E2E).
          pasos: rutaAlt.ruta.pasos
            .filter((paso) => paso.version === rutaAlt.rutaVersion)
            .map((paso) => ({
              ...paso,
              familiaNombre:
                resolverFamilia(paso.familiaCodigo)?.nombre ?? null,
            })),
        },
        // G-F3: extras de ESTA ruta alternativa (scope por ruta).
        pasosExtras: producto.pasosExtras
          .filter((pe) => pe.rutaAlternativaId === rutaAlt.id)
          .map((pe) => ({
            ...pe,
            maquinasCandidatas: pasoExtraCandidatas.get(pe.id) ?? [],
            slotsMateriales: pasoExtraSlots.get(pe.id) ?? [],
          })),
        configPasos: rutaAlt.configPasos.map((configPaso) => ({
          ...configPaso,
          rutaPaso: configPaso.rutaPaso
            ? {
                ...configPaso.rutaPaso,
                familiaNombre:
                  resolverFamilia(configPaso.rutaPaso.familiaCodigo)?.nombre ??
                  null,
              }
            : configPaso.rutaPaso,
          modoColorOptions: this.buildModoColorOptions(configPaso),
          maquinasCandidatas: configPaso.maquinasCandidatas.map(
            (candidata) => ({
              ...candidata,
              modoColorOptions: this.buildModoColorOptionsForProfiles(
                candidata.maquina?.perfilesOperativos ?? [],
                configPaso.paramsPasoJson,
                candidata.modoColorAllowedModes,
              ),
            }),
          ),
        })),
      })),
    };
  }

  /**
   * M-2 en extras — hidrata `configMaquinasCandidatasJson` (sólo ids) de cada
   * paso extra a candidatas con máquina + perfiles + modoColorOptions, con el
   * mismo shape que las candidatas de ProductoConfigPaso. Devuelve un mapa
   * pasoExtraId → candidatas (preferida primero). Descarta candidatas cuya
   * máquina no exista o esté inactiva.
   */
  private async hydratePasoExtraCandidatas(
    tenantId: string,
    pasosExtras: Array<{
      id: string;
      paramsPasoJson: Prisma.JsonValue | null;
      configMaquinasCandidatasJson: Prisma.JsonValue | null;
    }>,
  ) {
    type CandidataJson = {
      maquinaId?: string;
      perfilDefaultId?: string | null;
      modoColorAllowedModes?: string[];
      esPreferida?: boolean;
      orden?: number;
    };
    const parse = (json: Prisma.JsonValue | null): CandidataJson[] =>
      Array.isArray(json) ? (json as CandidataJson[]) : [];

    const maquinaIds = new Set<string>();
    for (const pe of pasosExtras) {
      for (const c of parse(pe.configMaquinasCandidatasJson)) {
        if (c.maquinaId) maquinaIds.add(c.maquinaId);
      }
    }
    const maquinas =
      maquinaIds.size === 0
        ? []
        : await this.prisma.maquina.findMany({
            where: {
              tenantId,
              id: { in: [...maquinaIds] },
              ...MAQUINA_DISPONIBLE_WHERE,
            },
            select: {
              id: true,
              codigo: true,
              nombre: true,
              plantilla: true,
              anchoUtil: true,
              parametrosTecnicosJson: true,
              centroCostoPrincipalId: true,
              centroCostoPrincipal: {
                select: { id: true, codigo: true, nombre: true },
              },
              perfilesOperativos: {
                where: { activo: true },
                select: {
                  id: true,
                  nombre: true,
                  activo: true,
                  tipoPerfil: true,
                  detalleJson: true,
                },
              },
            },
          });
    const maquinaMap = new Map(maquinas.map((m) => [m.id, m]));

    return new Map(
      pasosExtras.map((pe) => {
        const candidatas = parse(pe.configMaquinasCandidatasJson)
          .flatMap((c, i) => {
            const maquina = c.maquinaId
              ? maquinaMap.get(c.maquinaId)
              : undefined;
            if (!maquina) return [];
            const perfilDefault = c.perfilDefaultId
              ? (maquina.perfilesOperativos.find(
                  (p) => p.id === c.perfilDefaultId,
                ) ?? null)
              : null;
            return [
              {
                id: `${pe.id}:cand:${i}`,
                maquinaId: maquina.id,
                perfilDefaultId: c.perfilDefaultId ?? null,
                modoColorAllowedModes: c.modoColorAllowedModes ?? [],
                modoColorOptions: this.buildModoColorOptionsForProfiles(
                  maquina.perfilesOperativos,
                  pe.paramsPasoJson,
                  c.modoColorAllowedModes,
                ),
                esPreferida: c.esPreferida ?? false,
                orden: c.orden ?? i,
                perfilDefault,
                maquina,
              },
            ];
          })
          .sort(
            (a, b) =>
              Number(b.esPreferida) - Number(a.esPreferida) ||
              a.orden - b.orden,
          );
        return [pe.id, candidatas] as const;
      }),
    );
  }

  /**
   * G-F4 en extras — hidrata `configSlotsMaterialesJson` (sólo ids) de cada paso
   * extra a `slotsMateriales` con el MISMO shape que los slots de
   * ProductoConfigPaso (candidatos → materiaPrima + variantes hidratadas, y
   * `materialVariante` para HARDCODED). Sin esto, el sheet de cotización no
   * puede renderizar el picker de material del extra (incl. COMERCIAL_ELIGE).
   * Devuelve un mapa pasoExtraId → slotsMateriales[].
   */
  private async hydratePasoExtraSlots(
    tenantId: string,
    pasosExtras: Array<{
      id: string;
      configSlotsMaterialesJson: Prisma.JsonValue | null;
    }>,
  ) {
    type CandidatoJson = {
      materiaPrimaId?: string;
      defaultVarianteId?: string | null;
      orden?: number;
      varianteIds?: string[];
      todasLasVariantes?: boolean;
    };
    type SlotJson = {
      slotCodigo?: string;
      slotNombre?: string | null;
      slotRol?: string | null;
      modoSeleccion?: string;
      criterioMotorAuto?: string | null;
      formula?: string;
      cantidadFactor?: string | number | null;
      cantidadBase?: string | null;
      fuenteMedida?: string | null;
      aplicaMultiCaras?: boolean;
      materialVarianteId?: string | null;
      candidatos?: CandidatoJson[];
    };
    const parse = (json: Prisma.JsonValue | null): SlotJson[] =>
      Array.isArray(json) ? (json as SlotJson[]) : [];

    const materiaPrimaIds = new Set<string>();
    const varianteIds = new Set<string>();
    for (const pe of pasosExtras) {
      for (const s of parse(pe.configSlotsMaterialesJson)) {
        if (s.materialVarianteId) varianteIds.add(s.materialVarianteId);
        for (const c of s.candidatos ?? []) {
          if (c.materiaPrimaId) materiaPrimaIds.add(c.materiaPrimaId);
          if (c.defaultVarianteId) varianteIds.add(c.defaultVarianteId);
          for (const vid of c.varianteIds ?? []) varianteIds.add(vid);
        }
      }
    }

    const variantes =
      varianteIds.size === 0
        ? []
        : await this.prisma.materiaPrimaVariante.findMany({
            where: { id: { in: [...varianteIds] }, materiaPrima: { tenantId } },
            select: {
              id: true,
              sku: true,
              nombreVariante: true,
              precioReferencia: true,
              atributosVarianteJson: true,
              materiaPrimaId: true,
            },
          });
    const varianteMap = new Map(variantes.map((v) => [v.id, v]));
    for (const v of variantes) materiaPrimaIds.add(v.materiaPrimaId);

    const materiaPrimas =
      materiaPrimaIds.size === 0
        ? []
        : await this.prisma.materiaPrima.findMany({
            where: { tenantId, id: { in: [...materiaPrimaIds] } },
            select: {
              id: true,
              codigo: true,
              nombre: true,
              familia: true,
              subfamilia: true,
              templateId: true,
              variantes: {
                where: { activo: true },
                select: {
                  id: true,
                  sku: true,
                  nombreVariante: true,
                  precioReferencia: true,
                  atributosVarianteJson: true,
                },
                orderBy: { sku: 'asc' },
              },
            },
          });
    const mpMap = new Map(materiaPrimas.map((mp) => [mp.id, mp]));
    // Variantes activas por id (para resolver el modo "todas": sus ids no
    // están en el JSON, salen de la lista viva del material).
    const mpVarianteMap = new Map(
      materiaPrimas.flatMap((mp) =>
        mp.variantes.map((v) => [v.id, v] as const),
      ),
    );

    return new Map(
      pasosExtras.map((pe) => {
        const slots = parse(pe.configSlotsMaterialesJson).map((s, i) => {
          const materialVariante = s.materialVarianteId
            ? (varianteMap.get(s.materialVarianteId) ?? null)
            : null;
          const mvMateriaPrima = materialVariante
            ? (mpMap.get(materialVariante.materiaPrimaId) ?? null)
            : null;
          return {
            id: `${pe.id}:slot:${i}`,
            slotCodigo: s.slotCodigo ?? '',
            slotNombre: s.slotNombre ?? null,
            slotRol: s.slotRol ?? null,
            modoSeleccion: s.modoSeleccion ?? 'HARDCODED',
            criterioMotorAuto: s.criterioMotorAuto ?? null,
            formula: s.formula ?? '',
            cantidadFactor: s.cantidadFactor ?? null,
            cantidadBase: s.cantidadBase ?? null,
            fuenteMedida: s.fuenteMedida ?? null,
            aplicaMultiCaras: s.aplicaMultiCaras ?? false,
            materialVariante:
              materialVariante && mvMateriaPrima
                ? {
                    id: materialVariante.id,
                    sku: materialVariante.sku,
                    nombreVariante: materialVariante.nombreVariante,
                    precioReferencia: materialVariante.precioReferencia,
                    atributosVarianteJson:
                      materialVariante.atributosVarianteJson,
                    materiaPrima: {
                      id: mvMateriaPrima.id,
                      codigo: mvMateriaPrima.codigo,
                      nombre: mvMateriaPrima.nombre,
                      familia: mvMateriaPrima.familia,
                      subfamilia: mvMateriaPrima.subfamilia,
                      templateId: mvMateriaPrima.templateId,
                      variantes: mvMateriaPrima.variantes,
                    },
                  }
                : null,
            candidatos: (s.candidatos ?? []).flatMap((c, ci) => {
              const mp = c.materiaPrimaId
                ? mpMap.get(c.materiaPrimaId)
                : undefined;
              if (!mp) return [];
              const defaultVariante = c.defaultVarianteId
                ? (varianteMap.get(c.defaultVarianteId) ?? null)
                : null;
              return [
                {
                  id: `${pe.id}:slot:${i}:cand:${ci}`,
                  materiaPrimaId: c.materiaPrimaId as string,
                  defaultVarianteId: c.defaultVarianteId ?? null,
                  orden: c.orden ?? ci,
                  todasLasVariantes: c.todasLasVariantes ?? false,
                  materiaPrima: {
                    id: mp.id,
                    codigo: mp.codigo,
                    nombre: mp.nombre,
                    familia: mp.familia,
                    subfamilia: mp.subfamilia,
                    templateId: mp.templateId,
                    variantes: mp.variantes,
                  },
                  defaultVariante: defaultVariante
                    ? {
                        id: defaultVariante.id,
                        sku: defaultVariante.sku,
                        nombreVariante: defaultVariante.nombreVariante,
                        precioReferencia: defaultVariante.precioReferencia,
                      }
                    : null,
                  // Modo "todas": todas las variantes activas del material; si
                  // no, la lista fija guardada en el JSON.
                  variantes: (c.todasLasVariantes
                    ? mp.variantes.map((v) => v.id)
                    : (c.varianteIds ?? [])
                  ).flatMap((vid) => {
                    const v = varianteMap.get(vid) ?? mpVarianteMap.get(vid);
                    return v
                      ? [
                          {
                            variante: {
                              id: v.id,
                              sku: v.sku,
                              nombreVariante: v.nombreVariante,
                              precioReferencia: v.precioReferencia,
                              atributosVarianteJson: v.atributosVarianteJson,
                            },
                          },
                        ]
                      : [];
                  }),
                },
              ];
            }),
          };
        });
        return [pe.id, slots] as const;
      }),
    );
  }

  private buildModoColorOptions(configPaso: {
    paramsPasoJson?: Prisma.JsonValue | null;
    maquinaM1?: {
      perfilesOperativos?: Array<{
        id: string;
        activo?: boolean;
        tipoPerfil?: string | null;
        detalleJson?: Prisma.JsonValue | null;
      }>;
    } | null;
    maquinasCandidatas?: Array<{
      maquina?: {
        perfilesOperativos?: Array<{
          id: string;
          activo?: boolean;
          tipoPerfil?: string | null;
          detalleJson?: Prisma.JsonValue | null;
        }>;
      } | null;
    }>;
  }) {
    const params =
      configPaso.paramsPasoJson &&
      typeof configPaso.paramsPasoJson === 'object' &&
      !Array.isArray(configPaso.paramsPasoJson)
        ? (configPaso.paramsPasoJson as Record<string, unknown>)
        : {};
    const modoColorConfig =
      params.modoColorConfig &&
      typeof params.modoColorConfig === 'object' &&
      !Array.isArray(params.modoColorConfig)
        ? (params.modoColorConfig as Record<string, unknown>)
        : {};
    const profiles = [
      ...(configPaso.maquinaM1?.perfilesOperativos ?? []),
      ...(configPaso.maquinasCandidatas ?? []).flatMap(
        (candidate) => candidate.maquina?.perfilesOperativos ?? [],
      ),
    ];
    return buildModoColorOptionsFromProfiles(
      profiles,
      modoColorConfig.allowedModes,
    );
  }

  private buildModoColorOptionsForProfiles(
    profiles: Array<{
      id: string;
      activo?: boolean;
      tipoPerfil?: string | null;
      detalleJson?: Prisma.JsonValue | null;
    }>,
    paramsPasoJson?: Prisma.JsonValue | null,
    allowedModesOverride?: string[] | null,
  ) {
    const params =
      paramsPasoJson &&
      typeof paramsPasoJson === 'object' &&
      !Array.isArray(paramsPasoJson)
        ? (paramsPasoJson as Record<string, unknown>)
        : {};
    const modoColorConfig =
      params.modoColorConfig &&
      typeof params.modoColorConfig === 'object' &&
      !Array.isArray(params.modoColorConfig)
        ? (params.modoColorConfig as Record<string, unknown>)
        : {};
    const explicitAllowed = Array.isArray(allowedModesOverride)
      ? allowedModesOverride.length > 0
        ? allowedModesOverride
        : null
      : Array.isArray(modoColorConfig.allowedModes)
        ? modoColorConfig.allowedModes
        : null;
    const options = buildModoColorOptionsFromProfiles(
      profiles,
      explicitAllowed ?? undefined,
    );
    const shouldIncludeSinImpresion =
      !explicitAllowed ||
      explicitAllowed.some(
        (mode) => typeof mode === 'string' && mode === 'SIN_IMPRESION',
      );
    if (
      shouldIncludeSinImpresion &&
      !options.some((option) => option.value === 'SIN_IMPRESION')
    ) {
      return [
        {
          value: 'SIN_IMPRESION',
          label: 'Sin impresión',
          perfilIds: [],
        },
        ...options,
      ];
    }
    return options;
  }

  listarCatalogoComercial() {
    return this.prisma.productoCategoriaComercial.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      include: {
        subcategorias: {
          where: { activo: true },
          orderBy: { orden: 'asc' },
        },
      },
    });
  }

  private async assertSubcategoriaComercial(codigo: string) {
    const subcategoria =
      await this.prisma.productoSubcategoriaComercial.findUnique({
        where: { codigo },
        select: { id: true, activo: true },
      });
    if (!subcategoria || !subcategoria.activo) {
      throw new BadRequestException(
        `Subcategoría comercial inválida: ${codigo}`,
      );
    }
    return subcategoria;
  }
}
