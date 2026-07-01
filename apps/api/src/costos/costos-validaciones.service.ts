import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TipoRecursoCentroCosto } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { DbClient } from './costos.types';
import { ReplaceCentroRecursosDto } from './dto/replace-centro-recursos.dto';
import { TipoRecursoCentroCostoDto } from './dto/replace-centro-recursos.dto';
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

  async findAreaOrThrow(
    auth: CurrentAuth,
    id: string,
    db: DbClient = this.prisma,
  ) {
    const area = await db.areaCosto.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      include: { planta: true },
    });

    if (!area) {
      throw new NotFoundException(`No existe el area ${id}`);
    }

    return area;
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
        areaCosto: true,
        responsableEmpleado: true,
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
    const [planta, area] = await Promise.all([
      db.planta.findFirst({
        where: { id: payload.plantaId, tenantId: auth.tenantId },
      }),
      db.areaCosto.findFirst({
        where: { id: payload.areaCostoId, tenantId: auth.tenantId },
      }),
    ]);

    if (!planta) {
      throw new NotFoundException('La planta no existe.');
    }

    if (!area) {
      throw new NotFoundException('El area no existe.');
    }

    if (area.plantaId !== planta.id) {
      throw new BadRequestException(
        'El area no pertenece a la planta seleccionada.',
      );
    }

    if (payload.responsableEmpleadoId) {
      const empleado = await db.empleado.findFirst({
        where: {
          id: payload.responsableEmpleadoId,
          tenantId: auth.tenantId,
        },
      });

      if (!empleado) {
        throw new NotFoundException('El responsable seleccionado no existe.');
      }
    }
  }

  async validateRecursos(
    auth: CurrentAuth,
    centroCostoId: string,
    periodo: string,
    recursos: ReplaceCentroRecursosDto['recursos'],
    db: DbClient = this.prisma,
  ) {
    const centro = await db.centroCosto.findFirst({
      where: { id: centroCostoId, tenantId: auth.tenantId },
      select: { id: true, plantaId: true },
    });
    if (!centro) {
      throw new NotFoundException(
        `No existe el centro de costo ${centroCostoId}`,
      );
    }

    const recursosActivos = recursos.filter((recurso) => recurso.activo);
    const employeeAssignments = new Map<string, number>();
    const employeeIds = new Set<string>();
    const machineIds = new Set<string>();
    const machineAssignments = new Set<string>();

    for (const recurso of recursos) {
      if (
        recurso.tipoRecurso === TipoRecursoCentroCostoDto.empleado &&
        !recurso.empleadoId
      ) {
        throw new BadRequestException(
          'Los recursos de tipo empleado necesitan un empleado asociado.',
        );
      }

      if (
        recurso.tipoRecurso === TipoRecursoCentroCostoDto.maquinaria &&
        !recurso.maquinaId &&
        !recurso.nombreRecurso?.trim()
      ) {
        throw new BadRequestException(
          'Los recursos de tipo maquinaria necesitan un nombre de máquina.',
        );
      }

      if (
        recurso.tipoRecurso !== TipoRecursoCentroCostoDto.maquinaria &&
        recurso.maquinaId
      ) {
        throw new BadRequestException(
          'Solo los recursos de tipo maquinaria pueden referenciar una máquina.',
        );
      }

      if (recurso.tipoRecurso === TipoRecursoCentroCostoDto.empleado) {
        if (recurso.porcentajeAsignacion === undefined) {
          throw new BadRequestException(
            'Cada persona asignada necesita un porcentaje de dedicacion para este mes.',
          );
        }

        if (
          recurso.porcentajeAsignacion <= 0 ||
          recurso.porcentajeAsignacion > 100
        ) {
          throw new BadRequestException(
            'El porcentaje de dedicacion de una persona debe estar entre 0,01 y 100.',
          );
        }

        if (!recurso.empleadoId) {
          throw new BadRequestException(
            'Los recursos de tipo empleado necesitan un empleado asociado.',
          );
        }

        if (employeeAssignments.has(recurso.empleadoId)) {
          throw new BadRequestException(
            'No puedes asignar la misma persona dos veces en el mismo centro y mes.',
          );
        }

        employeeAssignments.set(
          recurso.empleadoId,
          recurso.activo ? recurso.porcentajeAsignacion : 0,
        );
        employeeIds.add(recurso.empleadoId);
      } else if (recurso.porcentajeAsignacion !== undefined) {
        throw new BadRequestException(
          'Solo las personas pueden llevar porcentaje de dedicacion en esta version.',
        );
      }

      if (recurso.tipoRecurso === TipoRecursoCentroCostoDto.gasto_general) {
        if (!recurso.nombreRecurso?.trim()) {
          throw new BadRequestException(
            'Los gastos generales necesitan un nombre descriptivo.',
          );
        }
        if (!recurso.tipoGastoGeneral) {
          throw new BadRequestException(
            'Los gastos generales necesitan un tipo de gasto.',
          );
        }
        if (recurso.valorMensual === undefined || recurso.valorMensual < 0) {
          throw new BadRequestException(
            'Los gastos generales necesitan un valor mensual mayor o igual a 0.',
          );
        }
      }

      if (recurso.tipoRecurso === TipoRecursoCentroCostoDto.activo_fijo) {
        if (!recurso.nombreRecurso?.trim()) {
          throw new BadRequestException(
            'Los activos fijos necesitan un nombre descriptivo.',
          );
        }
        if (
          recurso.vidaUtilRestanteMeses === undefined ||
          recurso.vidaUtilRestanteMeses < 1
        ) {
          throw new BadRequestException(
            'Los activos fijos necesitan vida util restante en meses (minimo 1).',
          );
        }
        if (
          recurso.valorActual === undefined ||
          recurso.valorActual < 0 ||
          recurso.valorFinalVida === undefined ||
          recurso.valorFinalVida < 0
        ) {
          throw new BadRequestException(
            'Los activos fijos necesitan valor actual y valor final de vida validos.',
          );
        }
        if (recurso.valorFinalVida > recurso.valorActual) {
          throw new BadRequestException(
            'En activos fijos, el valor final de vida no puede ser mayor al valor actual.',
          );
        }
      }

      if (
        recurso.tipoRecurso === TipoRecursoCentroCostoDto.maquinaria &&
        recurso.maquinaId
      ) {
        if (machineAssignments.has(recurso.maquinaId)) {
          throw new BadRequestException(
            'No puedes asignar la misma máquina dos veces en el mismo centro y mes.',
          );
        }
        machineAssignments.add(recurso.maquinaId);
        machineIds.add(recurso.maquinaId);
      }
    }

    if (employeeIds.size > 0) {
      const existingEmployees = await db.empleado.findMany({
        where: {
          tenantId: auth.tenantId,
          id: { in: Array.from(employeeIds) },
        },
        select: { id: true },
      });
      const existingEmployeeIds = new Set(
        existingEmployees.map((item) => item.id),
      );

      for (const empleadoId of employeeIds) {
        if (!existingEmployeeIds.has(empleadoId)) {
          throw new NotFoundException(
            'Uno de los empleados asignados no existe en la empresa actual.',
          );
        }
      }

      const allocations = await db.centroCostoRecurso.groupBy({
        by: ['empleadoId'],
        where: {
          tenantId: auth.tenantId,
          periodo,
          tipoRecurso: TipoRecursoCentroCosto.EMPLEADO,
          activo: true,
          empleadoId: { in: Array.from(employeeIds) },
          NOT: { centroCostoId },
        },
        _sum: {
          porcentajeAsignacion: true,
        },
      });
      const allocationMap = new Map(
        allocations.map((allocation) => [
          allocation.empleadoId ?? '',
          Number(allocation._sum.porcentajeAsignacion?.toFixed(2) ?? 0),
        ]),
      );

      for (const [empleadoId, porcentajeActual] of employeeAssignments) {
        const porcentajeEnOtrosCentros = allocationMap.get(empleadoId) ?? 0;
        if (porcentajeEnOtrosCentros + porcentajeActual > 100) {
          throw new BadRequestException(
            `La persona seleccionada supera el 100% de dedicacion para ${periodo}.`,
          );
        }
      }
    }

    if (machineIds.size > 0) {
      const machines = await db.maquina.findMany({
        where: {
          tenantId: auth.tenantId,
          id: { in: Array.from(machineIds) },
        },
        select: { id: true, plantaId: true },
      });
      const machinesById = new Map(machines.map((item) => [item.id, item]));

      for (const maquinaId of machineIds) {
        const machine = machinesById.get(maquinaId);
        if (!machine) {
          throw new NotFoundException(
            'Una de las máquinas asignadas no existe en la empresa actual.',
          );
        }

        if (machine.plantaId !== centro.plantaId) {
          throw new BadRequestException(
            'La máquina asignada al centro debe pertenecer a la misma planta.',
          );
        }
      }
    }

    if (
      recursosActivos.length === 0 &&
      recursos.length > 0 &&
      recursos.some(
        (recurso) => recurso.tipoRecurso === TipoRecursoCentroCostoDto.empleado,
      )
    ) {
      throw new BadRequestException(
        'Si asignas personas al centro, al menos una debe quedar activa para el mes.',
      );
    }
  }
}
