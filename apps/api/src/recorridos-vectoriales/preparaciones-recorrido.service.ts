import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoRevisionRecorridoVectorial,
  Prisma,
  UnidadProduccionMaquina,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RecorridosVectorialesService } from './recorridos-vectoriales.service';
import type { PerfilMaquinaCorte } from './recorridos-vectoriales.types';
import {
  crearSvgPlacaDesdeNesting,
  type NestingVectorialParaRecorrido,
} from './nesting-svg';

type NestingPersistido = NestingVectorialParaRecorrido;

const ESTADOS_ACTIVOS: EstadoRevisionRecorridoVectorial[] = [
  EstadoRevisionRecorridoVectorial.BORRADOR,
  EstadoRevisionRecorridoVectorial.REVISADA,
  EstadoRevisionRecorridoVectorial.APROBADA,
  EstadoRevisionRecorridoVectorial.ENVIADA_MAQUINA,
];

@Injectable()
export class PreparacionesRecorridoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recorridos: RecorridosVectorialesService,
  ) {}

  async asegurarParaItem(auth: CurrentAuth, itemId: string, forzar = false) {
    const item = await this.prisma.ordenTrabajoItem.findFirst({
      where: { id: itemId, tenantId: auth.tenantId },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        cotizacionItem: {
          select: { trazabilidadJson: true, snapshotJson: true },
        },
      },
    });
    if (!item) throw new NotFoundException('No se encontró el item de la OT.');
    if (!item.cotizacionItem) return [];

    const paso = this.pasoCorte(item.cotizacionItem.trazabilidadJson);
    if (!paso) return [];
    const nesting = this.nestingDelPaso(paso);
    const profile = await this.resolverPerfil(
      auth.tenantId,
      item.cotizacionItem.snapshotJson,
    );
    const cantidadPlacas = nesting.substrates?.length ?? 0;
    if (cantidadPlacas === 0) {
      throw new BadRequestException(
        'El paso de corte no contiene placas de nesting preparables.',
      );
    }

    const prepared = [];
    for (let plateIndex = 0; plateIndex < cantidadPlacas; plateIndex += 1) {
      const svg = crearSvgPlacaDesdeNesting(nesting, plateIndex);
      prepared.push(
        await this.asegurarRevision({
          auth,
          itemId: item.id,
          itemName: item.nombre || item.codigo,
          plateIndex,
          svg,
          profile,
          forzar,
        }),
      );
    }
    return prepared;
  }

  async descargar(
    auth: CurrentAuth,
    revisionId: string,
    formato: 'tap' | 'source-svg' | 'linked-svg',
  ) {
    const revision = await this.prisma.recorridoVectorialRevision.findFirst({
      where: { id: revisionId, tenantId: auth.tenantId },
    });
    if (!revision)
      throw new NotFoundException('No se encontró la preparación.');
    if (formato === 'tap') {
      return {
        bytes: Buffer.from(revision.tap, 'ascii'),
        mime: 'application/octet-stream',
        name: revision.nombreArchivo.replace(/\.svg$/i, '.tap'),
      };
    }
    return {
      bytes: Buffer.from(
        formato === 'source-svg' ? revision.sourceSvg : revision.linkedSvg,
        'utf8',
      ),
      mime: 'image/svg+xml; charset=utf-8',
      name:
        formato === 'source-svg'
          ? revision.nombreArchivo
          : revision.nombreArchivo.replace(/\.svg$/i, '-recorrido.svg'),
    };
  }

  async cambiarEstado(
    auth: CurrentAuth,
    revisionId: string,
    estado: 'REVISADA' | 'APROBADA' | 'ENVIADA_MAQUINA',
  ) {
    if (
      estado !== 'REVISADA' &&
      estado !== 'APROBADA' &&
      estado !== 'ENVIADA_MAQUINA'
    ) {
      throw new BadRequestException('El estado de preparación no es válido.');
    }
    const current = await this.prisma.recorridoVectorialRevision.findFirst({
      where: { id: revisionId, tenantId: auth.tenantId },
      select: { id: true, estado: true },
    });
    if (!current) throw new NotFoundException('No se encontró la preparación.');
    if (current.estado === EstadoRevisionRecorridoVectorial.REEMPLAZADA) {
      throw new BadRequestException(
        'Una preparación reemplazada no puede volver a aprobarse.',
      );
    }
    return this.prisma.recorridoVectorialRevision.update({
      where: { id: revisionId },
      data: { estado },
      select: { id: true, estado: true, updatedAt: true },
    });
  }

  private async asegurarRevision(args: {
    auth: CurrentAuth;
    itemId: string;
    itemName: string;
    plateIndex: number;
    svg: string;
    profile: PerfilMaquinaCorte;
    forzar: boolean;
  }) {
    const preparationHash = createHash('sha256')
      .update(args.svg)
      .update(JSON.stringify(args.profile))
      .digest('hex');
    const latest = await this.prisma.recorridoVectorialRevision.findFirst({
      where: {
        tenantId: args.auth.tenantId,
        ordenTrabajoItemId: args.itemId,
        placaIndice: args.plateIndex,
      },
      orderBy: { revision: 'desc' },
    });
    if (
      !args.forzar &&
      latest?.sourceHash === preparationHash &&
      ESTADOS_ACTIVOS.includes(latest.estado)
    ) {
      return this.proyectar(latest);
    }

    const name = `${this.safeName(args.itemName)}-placa-${args.plateIndex + 1}.svg`;
    const result = await this.recorridos.generar({
      modo: 'CORTE',
      svg: args.svg,
      nombreFuente: name,
      perfil: args.profile,
    });
    const actorName = args.auth.impersonacion?.actorNombre ?? args.auth.email;
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.recorridoVectorialRevision.updateMany({
        where: {
          tenantId: args.auth.tenantId,
          ordenTrabajoItemId: args.itemId,
          placaIndice: args.plateIndex,
          estado: { in: ESTADOS_ACTIVOS },
        },
        data: { estado: EstadoRevisionRecorridoVectorial.REEMPLAZADA },
      });
      return tx.recorridoVectorialRevision.create({
        data: {
          tenantId: args.auth.tenantId,
          ordenTrabajoItemId: args.itemId,
          placaIndice: args.plateIndex,
          revision: (latest?.revision ?? 0) + 1,
          modo: result.modo,
          postprocesador: result.postprocesador,
          engineId: result.engine.id,
          engineVersion: result.engine.version,
          sourceHash: preparationHash,
          nombreArchivo: name,
          sourceSvg: args.svg,
          linkedSvg: result.svgVinculado,
          tap: result.tap,
          routeJson: {
            svg: result.recorridoSvg,
            machine: result.recorridoMaquina,
            originSvg: result.origenSvg,
            bridges: result.conexiones,
          } as Prisma.InputJsonValue,
          reportJson: result.informe as Prisma.InputJsonValue,
          metricsJson: result.metricas as Prisma.InputJsonValue,
          machineProfileJson: result.perfil as Prisma.InputJsonValue,
          creadaPorId: args.auth.userId,
          creadaPorNombre: actorName,
        },
      });
    });
    return this.proyectar(created);
  }

  private proyectar(revision: {
    id: string;
    placaIndice: number;
    revision: number;
    estado: EstadoRevisionRecorridoVectorial;
    nombreArchivo: string;
    linkedSvg: string;
    routeJson: Prisma.JsonValue;
    reportJson: Prisma.JsonValue;
    metricsJson: Prisma.JsonValue;
    machineProfileJson: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: revision.id,
      placaIndice: revision.placaIndice,
      revision: revision.revision,
      estado: revision.estado,
      nombreArchivo: revision.nombreArchivo,
      linkedSvg: revision.linkedSvg,
      route: revision.routeJson,
      report: revision.reportJson,
      metricas: revision.metricsJson,
      perfilMaquina: revision.machineProfileJson,
      createdAt: revision.createdAt,
      updatedAt: revision.updatedAt,
    };
  }

  private pasoCorte(value: Prisma.JsonValue) {
    const root = this.record(value);
    const pasos = Array.isArray(root?.pasos) ? root.pasos : [];
    return pasos
      .map((item) => this.record(item))
      .find(
        (paso) =>
          paso?.familiaCodigo === 'corte_hilo_caliente' && paso.nestingResult,
      );
  }

  private nestingDelPaso(paso: Record<string, unknown>): NestingPersistido {
    const nesting = this.record(paso.nestingResult) as NestingPersistido | null;
    if (
      !nesting ||
      nesting.algorithm !== 'irregular-2d-bottom-left-v1' ||
      !Array.isArray(nesting.substrates) ||
      !Array.isArray(nesting.placements)
    ) {
      throw new BadRequestException(
        'El item no contiene un nesting vectorial de placas compatible.',
      );
    }
    return nesting;
  }

  private async resolverPerfil(
    tenantId: string,
    snapshotValue: Prisma.JsonValue,
  ): Promise<PerfilMaquinaCorte> {
    const snapshot = this.record(snapshotValue);
    const route = this.record(snapshot?.ruta);
    const pasos = Array.isArray(route?.pasos) ? route.pasos : [];
    const cutting = pasos
      .map((item) => this.record(item))
      .find((paso) => paso?.familia === 'corte_hilo_caliente');
    const machineId =
      typeof cutting?.maquinaId === 'string' ? cutting.maquinaId : undefined;
    const profileId =
      typeof cutting?.perfilId === 'string' ? cutting.perfilId : undefined;
    const machine = await this.prisma.maquina.findFirst({
      where: {
        tenantId,
        activo: true,
        plantilla: 'CORTE_HILO_CALIENTE',
        ...(machineId ? { id: machineId } : {}),
      },
      include: {
        perfilesOperativos: {
          where: {
            activo: true,
            ...(profileId ? { id: profileId } : {}),
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!machine) {
      throw new BadRequestException(
        'Configurá una cortadora de hilo caliente para preparar el TAP.',
      );
    }
    const profile = machine.perfilesOperativos[0];
    if (
      !profile?.productivityValue ||
      profile.productivityUnit !== UnidadProduccionMaquina.MM_MIN
    ) {
      throw new BadRequestException(
        'La cortadora necesita un perfil activo con velocidad en mm/min.',
      );
    }
    const params = this.record(machine.parametrosTecnicosJson) ?? {};
    const postprocessor = params.postprocesadorRecorrido;
    if (postprocessor !== 'HOTWIRE_TAP_V1') {
      throw new BadRequestException(
        'La máquina no tiene un postprocesador TAP compatible.',
      );
    }
    return {
      id: profile.id,
      nombre: `${machine.nombre} · ${profile.nombre}`,
      postprocesador: 'HOTWIRE_TAP_V1',
      anchoUtilMm: Number(machine.anchoUtil),
      altoUtilMm: Number(machine.largoUtil),
      velocidadMmMin: Number(profile.productivityValue),
      decimales: this.positiveInt(params.decimalesTap, 6),
      entradaMm: this.positiveNumber(params.entradaMm, 8),
      origen: this.origin(params.origenMaquina),
      estrategiaOrigen:
        params.estrategiaOrigen === 'plate-corner'
          ? 'plate-corner'
          : 'geometry-bounds',
      strictBounds: true,
    };
  }

  private record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private origin(value: unknown): PerfilMaquinaCorte['origen'] {
    return value === 'bottom-right' ||
      value === 'top-left' ||
      value === 'top-right'
      ? value
      : 'bottom-left';
  }

  private positiveNumber(value: unknown, fallback: number) {
    const result = Number(value);
    return Number.isFinite(result) && result >= 0 ? result : fallback;
  }

  private positiveInt(value: unknown, fallback: number) {
    const result = Math.trunc(Number(value));
    return Number.isFinite(result) && result >= 0 ? result : fallback;
  }

  private safeName(value: string) {
    return (
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'corte'
    );
  }
}
