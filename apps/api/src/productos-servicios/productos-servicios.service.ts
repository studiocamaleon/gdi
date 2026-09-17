import { BadRequestException, Injectable } from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto';
import type {
  ActualizarProductoDto,
  CrearProductoDto,
  DuplicarProductoDto,
} from './dto/producto.dto';
import type {
  ActualizarRutaDto,
  CrearRutaDto,
  DuplicarRutaDto,
} from './dto/ruta.dto';
import type {
  ActualizarPasoExtraDto,
  ActualizarProductoRutaAlternativaDto,
  ReordenarPasosRutaAlternativaDto,
  AgregarPasoExtraDto,
  CrearProductoRutaAlternativaDto,
  DuplicarProductoRutaAlternativaDto,
  UpsertProductoConfigPasoDto,
} from './dto/producto-ruta.dto';
import type {
  ActualizarAsociacionCargoDto,
  ActualizarCargoDirectoDto,
  AsociarCargoCotizacionDto,
  AsociarCargoPasoDto,
  CrearCargoDirectoDto,
} from './dto/cargo-directo.dto';
import { ProductosService } from './productos.service';
import { RutasProduccionService } from './rutas-produccion.service';
import { ProductoRutasService } from './producto-rutas.service';
import { ConfigPasosService } from './config-pasos.service';
import { FamiliasPasosService } from './familias-pasos.service';
import { CargosDirectosProductoService } from './cargos-directos-producto.service';
import { ProductoValidacionService } from './producto-validacion.service';
import type { OrdenProductosDto } from './dto/list-productos-query.dto';

@Injectable()
export class ProductosServiciosService {
  constructor(
    private readonly productos: ProductosService,
    private readonly rutas: RutasProduccionService,
    private readonly productoRutas: ProductoRutasService,
    private readonly configPasos: ConfigPasosService,
    private readonly familias: FamiliasPasosService,
    private readonly cargos: CargosDirectosProductoService,
    private readonly validacion: ProductoValidacionService,
  ) {}

  listarProductos(
    tenantId: string,
    opts: {
      pagination: PaginationDto;
      activo?: boolean;
      search?: string;
      unidadComercial?: 'unidad' | 'm2' | 'metro_lineal';
      subcategoriaCodigo?: string;
      categoriaCodigo?: string;
      orden?: OrdenProductosDto;
      composicion?: 'simple' | 'compuesto';
    },
  ) {
    return this.productos.listarProductos(tenantId, opts);
  }

  listarCatalogoComercial() {
    return this.productos.listarCatalogoComercial();
  }

  crearProducto(tenantId: string, dto: CrearProductoDto) {
    return this.productos.crearProducto(tenantId, dto);
  }

  async actualizarProducto(
    tenantId: string,
    id: string,
    dto: ActualizarProductoDto,
  ) {
    const { activo, ...cambios } = dto;
    const actualizado = await this.productos.actualizarProducto(
      tenantId,
      id,
      cambios,
    );

    if (activo !== true) {
      if (activo === false) {
        return this.productos.actualizarProducto(tenantId, id, {
          activo: false,
        });
      }
      return actualizado;
    }

    const resultado = await this.validacion.validarProducto(tenantId, id);
    if (!resultado.exitoso) {
      await this.productos.actualizarProducto(tenantId, id, { activo: false });
      throw new BadRequestException({
        message:
          'El producto se guardó como borrador porque todavía no está listo para cotizar.',
        errores: resultado.errores,
      });
    }

    return this.productos.actualizarProducto(tenantId, id, { activo: true });
  }

  duplicarProducto(tenantId: string, id: string, dto: DuplicarProductoDto) {
    return this.productos.duplicarProducto(tenantId, id, dto);
  }

  eliminarProducto(tenantId: string, id: string) {
    return this.productos.eliminarProducto(tenantId, id);
  }

  obtenerProducto(tenantId: string, id: string) {
    return this.productos.obtenerProducto(tenantId, id);
  }

  listarRutas(tenantId: string, incluirInactivas = false) {
    return this.rutas.listarRutas(tenantId, incluirInactivas);
  }

  crearRuta(tenantId: string, dto: CrearRutaDto) {
    return this.rutas.crearRuta(tenantId, dto);
  }

  actualizarRuta(tenantId: string, id: string, dto: ActualizarRutaDto) {
    return this.rutas.actualizarRuta(tenantId, id, dto);
  }

  duplicarRuta(tenantId: string, id: string, dto: DuplicarRutaDto) {
    return this.rutas.duplicarRuta(tenantId, id, dto);
  }

  migrarProductosRuta(
    tenantId: string,
    id: string,
    rutaAlternativaIds: string[],
  ) {
    return this.rutas.migrarProductosAVersionActual(
      tenantId,
      id,
      rutaAlternativaIds,
    );
  }

  eliminarRuta(tenantId: string, id: string) {
    return this.rutas.eliminarRuta(tenantId, id);
  }

  obtenerRuta(tenantId: string, id: string) {
    return this.rutas.obtenerRuta(tenantId, id);
  }

  crearProductoRutaAlternativa(
    tenantId: string,
    productoId: string,
    dto: CrearProductoRutaAlternativaDto,
  ) {
    return this.productoRutas.crearProductoRutaAlternativa(
      tenantId,
      productoId,
      dto,
    );
  }

  actualizarProductoRutaAlternativa(
    tenantId: string,
    rutaAltId: string,
    dto: ActualizarProductoRutaAlternativaDto,
  ) {
    return this.productoRutas.actualizarProductoRutaAlternativa(
      tenantId,
      rutaAltId,
      dto,
    );
  }

  reordenarPasosRutaAlternativa(
    tenantId: string,
    rutaAltId: string,
    dto: ReordenarPasosRutaAlternativaDto,
  ) {
    return this.productoRutas.reordenarPasosRutaAlternativa(
      tenantId,
      rutaAltId,
      dto,
    );
  }

  duplicarProductoRutaAlternativa(
    tenantId: string,
    rutaAltId: string,
    dto: DuplicarProductoRutaAlternativaDto,
  ) {
    return this.productoRutas.duplicarProductoRutaAlternativa(
      tenantId,
      rutaAltId,
      dto,
    );
  }

  eliminarProductoRutaAlternativa(tenantId: string, rutaAltId: string) {
    return this.productoRutas.eliminarProductoRutaAlternativa(
      tenantId,
      rutaAltId,
    );
  }

  upsertConfigPaso(
    tenantId: string,
    rutaAltId: string,
    dto: UpsertProductoConfigPasoDto,
  ) {
    return this.configPasos.upsertConfigPaso(tenantId, rutaAltId, dto);
  }

  listarFamilias(tenantId: string) {
    return this.familias.listarFamilias(tenantId);
  }

  listarLookupsConfigPaso(tenantId: string) {
    return this.familias.listarLookupsConfigPaso(tenantId);
  }

  buscarMateriasPrimas(
    tenantId: string,
    query: {
      q?: string;
      familias?: string[];
      subfamilias?: string[];
      templateIds?: string[];
      tipoTecnico?: string[];
      ids?: string[];
      varianteIds?: string[];
      limit?: number;
    },
  ) {
    return this.familias.buscarMateriasPrimas(tenantId, query);
  }

  listarCargosDirectos(tenantId: string, soloActivos = true) {
    return this.cargos.listarCargosDirectos(tenantId, soloActivos);
  }

  crearCargoDirecto(tenantId: string, dto: CrearCargoDirectoDto) {
    return this.cargos.crearCargoDirecto(tenantId, dto);
  }

  actualizarCargoDirecto(
    tenantId: string,
    id: string,
    dto: ActualizarCargoDirectoDto,
  ) {
    return this.cargos.actualizarCargoDirecto(tenantId, id, dto);
  }

  eliminarCargoDirecto(tenantId: string, id: string) {
    return this.cargos.eliminarCargoDirecto(tenantId, id);
  }

  validarProducto(tenantId: string, productoId: string) {
    return this.validacion.validarProducto(tenantId, productoId);
  }

  asociarCargoCotizacion(
    tenantId: string,
    productoId: string,
    dto: AsociarCargoCotizacionDto,
  ) {
    return this.cargos.asociarCargoCotizacion(tenantId, productoId, dto);
  }

  desasociarCargoCotizacion(tenantId: string, asociacionId: string) {
    return this.cargos.desasociarCargoCotizacion(tenantId, asociacionId);
  }

  actualizarCargoCotizacion(
    tenantId: string,
    asociacionId: string,
    dto: ActualizarAsociacionCargoDto,
  ) {
    return this.cargos.actualizarCargoCotizacion(tenantId, asociacionId, dto);
  }

  asociarCargoPaso(
    tenantId: string,
    configPasoId: string,
    dto: AsociarCargoPasoDto,
  ) {
    return this.cargos.asociarCargoPaso(tenantId, configPasoId, dto);
  }

  actualizarCargoPaso(
    tenantId: string,
    asociacionId: string,
    dto: ActualizarAsociacionCargoDto,
  ) {
    return this.cargos.actualizarCargoPaso(tenantId, asociacionId, dto);
  }

  desasociarCargoPaso(tenantId: string, asociacionId: string) {
    return this.cargos.desasociarCargoPaso(tenantId, asociacionId);
  }

  distribuirCargoPasoPorNiveles(tenantId: string, asociacionId: string) {
    return this.cargos.distribuirCargoPasoPorNiveles(tenantId, asociacionId);
  }

  agregarPasoExtra(
    tenantId: string,
    productoId: string,
    dto: AgregarPasoExtraDto,
  ) {
    return this.cargos.agregarPasoExtra(tenantId, productoId, dto);
  }

  actualizarPasoExtra(
    tenantId: string,
    pasoExtraId: string,
    dto: ActualizarPasoExtraDto,
  ) {
    return this.cargos.actualizarPasoExtra(tenantId, pasoExtraId, dto);
  }

  eliminarPasoExtra(tenantId: string, pasoExtraId: string) {
    return this.cargos.eliminarPasoExtra(tenantId, pasoExtraId);
  }
}
