import { ConflictException, Injectable } from '@nestjs/common';
import { Planta } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { CentroCompleto } from './costos.types';
import { CostosMapper } from './costos.mapper';
import { CostosValidacionesService } from './costos-validaciones.service';
import { UpsertCentroCostoDto } from './dto/upsert-centro-costo.dto';
import { UpsertPlantaDto } from './dto/upsert-planta.dto';

@Injectable()
export class CostosCatalogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: CostosMapper,
    private readonly validaciones: CostosValidacionesService,
  ) {}

  async findPlantas(auth: CurrentAuth) {
    const plantas = await this.prisma.planta.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { nombre: 'asc' },
    });

    return plantas.map((planta) => this.mapper.toPlantaResponse(planta));
  }

  async createPlanta(auth: CurrentAuth, payload: UpsertPlantaDto) {
    let planta: Planta;

    try {
      planta = await this.prisma.planta.create({
        data: {
          tenantId: auth.tenantId,
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion?.trim() || null,
        },
      });
    } catch (error) {
      this.handleWriteError(error, 'planta');
    }

    return this.mapper.toPlantaResponse(planta);
  }

  async updatePlanta(auth: CurrentAuth, id: string, payload: UpsertPlantaDto) {
    await this.validaciones.findPlantaOrThrow(auth, id);

    let planta: Planta;

    try {
      planta = await this.prisma.planta.update({
        where: { id },
        data: {
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion?.trim() || null,
        },
      });
    } catch (error) {
      this.handleWriteError(error, 'planta');
    }

    return this.mapper.toPlantaResponse(planta);
  }

  async togglePlanta(auth: CurrentAuth, id: string) {
    const planta = await this.validaciones.findPlantaOrThrow(auth, id);

    return this.prisma.planta.update({
      where: { id },
      data: { activa: !planta.activa },
    });
  }





  async findCentros(auth: CurrentAuth) {
    const centros = await this.prisma.centroCosto.findMany({
      where: { tenantId: auth.tenantId },
      include: {
        planta: true,
        capacidadesPeriodo: {
          orderBy: [{ periodo: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
        tarifasPeriodo: {
          orderBy: [{ periodo: 'desc' }, { createdAt: 'desc' }],
          take: 8,
        },
      },
      orderBy: [{ nombre: 'asc' }],
    });

    return centros.map((centro) => this.mapper.toCentroResponse(centro));
  }

  async createCentro(auth: CurrentAuth, payload: UpsertCentroCostoDto) {
    await this.validaciones.validateCentroReferences(auth, payload);

    let centro: CentroCompleto;

    try {
      centro = await this.prisma.centroCosto.create({
        data: this.mapper.buildCreateCentroData(auth, payload),
        include: {
          planta: true,
          capacidadesPeriodo: true,
          tarifasPeriodo: true,
        },
      });
    } catch (error) {
      this.handleWriteError(error, 'centro');
    }

    return this.mapper.toCentroResponse(centro);
  }

  async updateCentro(
    auth: CurrentAuth,
    id: string,
    payload: UpsertCentroCostoDto,
  ) {
    await this.validaciones.findCentroOrThrow(auth, id);
    await this.validaciones.validateCentroReferences(auth, payload);

    let centro: CentroCompleto;

    try {
      centro = await this.prisma.centroCosto.update({
        where: { id },
        data: this.mapper.buildUpdateCentroData(payload),
        include: {
          planta: true,
          capacidadesPeriodo: true,
          tarifasPeriodo: true,
        },
      });
    } catch (error) {
      this.handleWriteError(error, 'centro');
    }

    return this.mapper.toCentroResponse(centro);
  }

  async toggleCentro(auth: CurrentAuth, id: string) {
    const centro = await this.validaciones.findCentroOrThrow(auth, id);

    return this.prisma.centroCosto.update({
      where: { id },
      data: { activo: !centro.activo },
    });
  }

  async eliminarCentro(auth: CurrentAuth, id: string) {
    const centro = await this.validaciones.findCentroOrThrow(auth, id);

    // Bloqueamos el borrado si el centro está en uso: máquinas o pasos lo
    // apuntan (FK SetNull) y quedarían sin centro → romperían el costeo.
    // Las tarifas/recursos/componentes/capacidad de período se borran en
    // cascada (onDelete: Cascade en el schema), así que no bloquean.
    const [maquinas, configPasos, pasosExtra] = await Promise.all([
      this.prisma.maquina.count({ where: { centroCostoPrincipalId: id } }),
      this.prisma.productoConfigPaso.count({ where: { centroCostoId: id } }),
      this.prisma.productoPasoExtra.count({ where: { centroCostoId: id } }),
    ]);

    const referencias: string[] = [];
    if (maquinas > 0) referencias.push(`${maquinas} máquina(s)`);
    if (configPasos > 0) referencias.push(`${configPasos} paso(s) de producto`);
    if (pasosExtra > 0) referencias.push(`${pasosExtra} paso(s) extra`);

    if (referencias.length > 0) {
      throw new ConflictException(
        `No se puede eliminar "${centro.nombre}": lo usan ${referencias.join(
          ', ',
        )}. Reasigná esas referencias o desactivá el centro en su lugar.`,
      );
    }

    await this.prisma.centroCosto.delete({ where: { id } });
    return { id, eliminado: true };
  }

  private handleWriteError(
    error: unknown,
    entity: 'planta' | 'area' | 'centro',
  ): never {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const messages = {
        planta: 'Ya existe una planta con ese codigo en la empresa actual.',
        area: 'Ya existe un area con ese codigo en la planta seleccionada.',
        centro:
          'Ya existe un centro de costo con ese codigo en la empresa actual.',
      } as const;

      throw new ConflictException(messages[entity]);
    }

    throw error;
  }
}
