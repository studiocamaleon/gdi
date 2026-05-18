import { Injectable } from '@nestjs/common';
import type {
  ActualizarProductoDto,
  CrearProductoDto,
} from './dto/producto.dto';
import type { ActualizarRutaDto, CrearRutaDto } from './dto/ruta.dto';
import type {
  ActualizarProductoRutaAlternativaDto,
  AgregarPasoExtraDto,
  CrearProductoRutaAlternativaDto,
  DuplicarProductoRutaAlternativaDto,
  UpsertProductoConfigPasoDto,
} from './dto/producto-ruta.dto';
import type {
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

  listarProductos(tenantId: string, activo?: boolean) {
    return this.productos.listarProductos(tenantId, activo);
  }

  listarCatalogoComercial() {
    return this.productos.listarCatalogoComercial();
  }

  crearProducto(tenantId: string, dto: CrearProductoDto) {
    return this.productos.crearProducto(tenantId, dto);
  }

  actualizarProducto(tenantId: string, id: string, dto: ActualizarProductoDto) {
    return this.productos.actualizarProducto(tenantId, id, dto);
  }

  eliminarProducto(tenantId: string, id: string) {
    return this.productos.eliminarProducto(tenantId, id);
  }

  obtenerProducto(tenantId: string, id: string) {
    return this.productos.obtenerProducto(tenantId, id);
  }

  listarRutas(tenantId: string) {
    return this.rutas.listarRutas(tenantId);
  }

  crearRuta(tenantId: string, dto: CrearRutaDto) {
    return this.rutas.crearRuta(tenantId, dto);
  }

  actualizarRuta(tenantId: string, id: string, dto: ActualizarRutaDto) {
    return this.rutas.actualizarRuta(tenantId, id, dto);
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

  listarFamilias() {
    return this.familias.listarFamilias();
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

  asociarCargoPaso(
    tenantId: string,
    configPasoId: string,
    dto: AsociarCargoPasoDto,
  ) {
    return this.cargos.asociarCargoPaso(tenantId, configPasoId, dto);
  }

  desasociarCargoPaso(tenantId: string, asociacionId: string) {
    return this.cargos.desasociarCargoPaso(tenantId, asociacionId);
  }

  agregarPasoExtra(
    tenantId: string,
    productoId: string,
    dto: AgregarPasoExtraDto,
  ) {
    return this.cargos.agregarPasoExtra(tenantId, productoId, dto);
  }

  eliminarPasoExtra(tenantId: string, pasoExtraId: string) {
    return this.cargos.eliminarPasoExtra(tenantId, pasoExtraId);
  }
}
