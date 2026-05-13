import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AgregarPasoExtraDto } from './dto/producto-ruta.dto';
import type {
  ActualizarCargoDirectoDto,
  AsociarCargoCotizacionDto,
  AsociarCargoPasoDto,
  CrearCargoDirectoDto,
} from './dto/cargo-directo.dto';
import { FamiliasPasosService } from './familias-pasos.service';

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
    try {
      return await this.prisma.cargoDirectoCatalogo.create({
        data: {
          tenantId,
          codigo: dto.codigo,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          modoCalculo: dto.modoCalculo,
          modosActivacionSoportados: dto.modosActivacionSoportados ?? [
            'OPCIONAL',
          ],
          configJson: (dto.configJson ??
            Prisma.JsonNull) as Prisma.InputJsonValue,
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

    if (
      existente.pasoCargos.length > 0 ||
      existente.cotizacionCargos.length > 0
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
        where: { id: dto.cargoDirectoCatalogoId, tenantId },
      }),
    ]);
    if (!producto)
      throw new NotFoundException(`Producto ${productoId} no encontrado`);
    if (!cargo)
      throw new NotFoundException(
        `Cargo ${dto.cargoDirectoCatalogoId} no encontrado`,
      );

    return this.prisma.productoCargoDirectoCotizacion.create({
      data: {
        tenantId,
        productoId,
        cargoDirectoCatalogoId: dto.cargoDirectoCatalogoId,
        modoActivacion: dto.modoActivacion,
        condicionActivacionJson: (dto.condicionActivacionJson ??
          Prisma.JsonNull) as Prisma.InputJsonValue,
        configOverrideJson: (dto.configOverrideJson ??
          Prisma.JsonNull) as Prisma.InputJsonValue,
        activo: true,
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
        where: { id: dto.cargoDirectoCatalogoId, tenantId },
      }),
    ]);
    if (!configPaso)
      throw new NotFoundException(`ConfigPaso ${configPasoId} no encontrado`);
    if (!cargo)
      throw new NotFoundException(
        `Cargo ${dto.cargoDirectoCatalogoId} no encontrado`,
      );

    return this.prisma.productoCargoDirectoPaso.create({
      data: {
        tenantId,
        productoConfigPasoId: configPasoId,
        cargoDirectoCatalogoId: dto.cargoDirectoCatalogoId,
        modoActivacion: dto.modoActivacion,
        condicionActivacionJson: (dto.condicionActivacionJson ??
          Prisma.JsonNull) as Prisma.InputJsonValue,
        configOverrideJson: (dto.configOverrideJson ??
          Prisma.JsonNull) as Prisma.InputJsonValue,
        activo: true,
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

    this.familias.assertFamiliaExiste(dto.familiaCodigo);

    let ordenInterno = dto.ordenInterno ?? 0;
    if (dto.ordenInterno === undefined) {
      const last = await this.prisma.productoPasoExtra.findFirst({
        where: { productoId, tenantId },
        orderBy: { ordenInterno: 'desc' },
      });
      ordenInterno = (last?.ordenInterno ?? 0) + 1;
    }

    return this.prisma.productoPasoExtra.create({
      data: {
        tenantId,
        productoId,
        familiaCodigo: dto.familiaCodigo,
        insertarDespuesDeRutaPasoId: dto.insertarDespuesDeRutaPasoId ?? null,
        ordenInterno,
        modoActivacion: dto.modoActivacion ?? null,
        condicionActivacionJson:
          (dto.condicionActivacionJson as never) ?? Prisma.JsonNull,
        modoTiempo: dto.modoTiempo ?? null,
        mecanismoCantidad: dto.mecanismoCantidad ?? null,
        paramsPasoJson: (dto.paramsPasoJson as never) ?? Prisma.JsonNull,
        maquinaM1Id: dto.maquinaM1Id ?? null,
        perfilM1Id: dto.perfilM1Id ?? null,
        activo: true,
      },
    });
  }

  async eliminarPasoExtra(tenantId: string, pasoExtraId: string) {
    const existente = await this.prisma.productoPasoExtra.findFirst({
      where: { id: pasoExtraId, tenantId },
    });
    if (!existente)
      throw new NotFoundException(`Paso extra ${pasoExtraId} no encontrado`);
    return this.prisma.productoPasoExtra.delete({ where: { id: pasoExtraId } });
  }
}
