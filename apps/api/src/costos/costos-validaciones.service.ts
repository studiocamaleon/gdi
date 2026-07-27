import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { DbClient } from './costos.types';
import {
  CentroCostoLineaItemDto,
  SeccionCentroCostoLineaDto,
} from './dto/replace-centro-lineas.dto';
import { UpsertCentroCostoDto } from './dto/upsert-centro-costo.dto';

const DEFAULT_PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

@Injectable()
export class CostosValidacionesService {
  constructor(private readonly prisma: PrismaService) {}

  normalizePeriodo(periodo?: string) {
    if (!periodo || !DEFAULT_PERIOD_REGEX.test(periodo)) {
      throw new BadRequestException('El periodo debe tener formato YYYY-MM.');
    }

    return periodo;
  }

  async findPlantaOrThrow(
    auth: CurrentAuth,
    id: string,
    db: DbClient = this.prisma,
  ) {
    const planta = await db.planta.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
    });

    if (!planta) {
      throw new NotFoundException(`No existe la planta ${id}`);
    }

    return planta;
  }


  async findCentroOrThrow(
    auth: CurrentAuth,
    id: string,
    db: DbClient = this.prisma,
  ) {
    const centro = await db.centroCosto.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      include: {
        planta: true,
        capacidadesPeriodo: true,
        tarifasPeriodo: true,
      },
    });

    if (!centro) {
      throw new NotFoundException(`No existe el centro de costo ${id}`);
    }

    return centro;
  }

  async validateCentroReferences(
    auth: CurrentAuth,
    payload: UpsertCentroCostoDto,
    db: DbClient = this.prisma,
  ) {
    const planta = await db.planta.findFirst({
      where: { id: payload.plantaId, tenantId: auth.tenantId },
    });

    if (!planta) {
      throw new NotFoundException('La planta no existe.');
    }
  }

  /**
   * Lo que el DTO no puede ver por sí solo: relaciones entre campos de la misma
   * línea. Es sincrónica y no toca la base — todo lo que hace falta para
   * decidir está en la propia planilla, que es justamente el punto del modelo
   * manual.
   */
  validateLineas(lineas: CentroCostoLineaItemDto[]) {
    for (const linea of lineas) {
      if (linea.seccion !== SeccionCentroCostoLineaDto.activo_fijo) continue;

      const valorActual = linea.valorActual ?? 0;
      const valorFinal = linea.valorFinalVida ?? 0;
      if (valorFinal > valorActual) {
        throw new BadRequestException(
          `En "${linea.nombre}", el valor al final de la vida util no puede superar al valor actual: no se amortiza hacia arriba.`,
        );
      }
    }

    const nombresPorSeccion = new Map<string, Set<string>>();
    for (const linea of lineas) {
      const nombre = linea.nombre.trim().toLowerCase();
      const vistos = nombresPorSeccion.get(linea.seccion) ?? new Set<string>();
      if (vistos.has(nombre)) {
        throw new BadRequestException(
          `"${linea.nombre.trim()}" esta cargado dos veces en la misma seccion.`,
        );
      }
      vistos.add(nombre);
      nombresPorSeccion.set(linea.seccion, vistos);
    }
  }

}
