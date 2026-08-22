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
import { analizarSvgFabricacion } from '../motor-universal/geometria-vectorial/svg-parser';
import { segmentarPiezasConEncastres } from '../motor-universal/geometria-vectorial/segmentacion-encastres';
import type { UnionVectorial } from '../motor-universal/geometria-vectorial/tipos';
import {
  crearPlantillaInstalacion,
  type ConfiguracionPlantillaInstalacion,
} from './plantilla-instalacion';
import {
  crearDxfPatronPounce,
  crearDxfPlantillaRigida,
  crearEpsPlantillaVinilo,
  crearPaqueteInstalacion,
  crearPlanoGeneralAcotadoPdf,
  crearPlantillaPapelMosaicoPdf,
  crearPlantillaPapelPlotterPdf,
} from './plantilla-instalacion-export';

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

  async plantillaInstalacion(
    auth: CurrentAuth,
    itemId: string,
    configuracion?: ConfiguracionPlantillaInstalacion,
  ) {
    const result = await this.generarPlantillaInstalacion(
      auth,
      itemId,
      configuracion,
    );
    return {
      schemaVersion: result.plantilla.schemaVersion,
      nombreArchivo: result.nombreArchivo,
      anchoDisenoMm: result.plantilla.anchoDisenoMm,
      altoDisenoMm: result.plantilla.altoDisenoMm,
      anchoPlantillaMm: result.plantilla.anchoPlantillaMm,
      altoPlantillaMm: result.plantilla.altoPlantillaMm,
      bordeMm: result.plantilla.bordeMm,
      cantidadPiezas: result.plantilla.cantidadPiezas,
      cantidadUniones: result.plantilla.cantidadUniones,
      previewSvg: result.plantilla.previewSvg,
      paneles: result.plantilla.paneles.map((panel) => ({
        indice: panel.indice,
        fila: panel.fila,
        columna: panel.columna,
        origenXmm: panel.origenXmm,
        origenYmm: panel.origenYmm,
        anchoMm: panel.anchoMm,
        altoMm: panel.altoMm,
      })),
    };
  }

  async descargarPlantillaInstalacion(
    auth: CurrentAuth,
    itemId: string,
    panelIndex: number | null,
    configuracion?: ConfiguracionPlantillaInstalacion,
  ) {
    const result = await this.generarPlantillaInstalacion(
      auth,
      itemId,
      configuracion,
    );
    if (panelIndex == null) {
      return {
        bytes: Buffer.from(result.plantilla.svg, 'utf8'),
        mime: 'image/svg+xml; charset=utf-8',
        name: `${result.nombreArchivo}-plantilla-completa.svg`,
      };
    }
    const panel = result.plantilla.paneles[panelIndex];
    if (!panel) {
      throw new NotFoundException('No se encontró el panel de la plantilla.');
    }
    return {
      bytes: Buffer.from(panel.svg, 'utf8'),
      mime: 'image/svg+xml; charset=utf-8',
      name: `${result.nombreArchivo}-plantilla-panel-${panelIndex + 1}.svg`,
    };
  }

  async descargarArchivoInstalacion(
    auth: CurrentAuth,
    itemId: string,
    formato:
      | 'paquete'
      | 'plano-pdf'
      | 'papel-plotter-pdf'
      | 'papel-mosaico-pdf'
      | 'rigida-dxf'
      | 'vinilo-eps'
      | 'pounce-dxf',
    panelIndex: number | null,
    configuracion?: ConfiguracionPlantillaInstalacion,
  ) {
    const generated = await this.generarPlantillaInstalacion(
      auth,
      itemId,
      configuracion,
    );
    const exportInput = {
      nombre: generated.nombre,
      nombreFuente: generated.nombreFuente,
      geometria: generated.geometria,
      plantilla: generated.plantilla,
      uniones: generated.uniones,
    };
    const base = generated.nombreArchivo;
    switch (formato) {
      case 'paquete':
        return file(
          crearPaqueteInstalacion(exportInput),
          'application/zip',
          `${base}-paquete-instalacion.zip`,
        );
      case 'plano-pdf':
        return file(
          crearPlanoGeneralAcotadoPdf(exportInput),
          'application/pdf',
          `${base}-plano-general-acotado.pdf`,
        );
      case 'papel-plotter-pdf':
        return file(
          crearPlantillaPapelPlotterPdf(exportInput),
          'application/pdf',
          `${base}-plantilla-plotter-1a1.pdf`,
        );
      case 'papel-mosaico-pdf':
        return file(
          crearPlantillaPapelMosaicoPdf(exportInput),
          'application/pdf',
          `${base}-plantilla-mosaico-a4-1a1.pdf`,
        );
      case 'rigida-dxf': {
        const dxf = crearDxfPlantillaRigida(exportInput, panelIndex);
        return file(
          Buffer.from(dxf, 'utf8'),
          'application/dxf; charset=utf-8',
          panelIndex == null
            ? `${base}-plantilla-rigida.dxf`
            : `${base}-plantilla-rigida-panel-${panelIndex + 1}.dxf`,
        );
      }
      case 'vinilo-eps':
        return file(
          Buffer.from(crearEpsPlantillaVinilo(exportInput), 'ascii'),
          'application/postscript',
          `${base}-plantilla-vinilo.eps`,
        );
      case 'pounce-dxf':
        return file(
          Buffer.from(crearDxfPatronPounce(exportInput), 'utf8'),
          'application/dxf; charset=utf-8',
          `${base}-patron-pounce.dxf`,
        );
      default:
        throw new BadRequestException(
          'El formato de instalación solicitado no es válido.',
        );
    }
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

  private async generarPlantillaInstalacion(
    auth: CurrentAuth,
    itemId: string,
    configuracion?: ConfiguracionPlantillaInstalacion,
  ) {
    const item = await this.prisma.ordenTrabajoItem.findFirst({
      where: { id: itemId, tenantId: auth.tenantId },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        cotizacionItem: {
          select: {
            jobContextJson: true,
            trazabilidadJson: true,
          },
        },
      },
    });
    if (!item) throw new NotFoundException('No se encontró el item de la OT.');
    const quoteItem = item.cotizacionItem;
    if (!quoteItem) {
      throw new BadRequestException(
        'El item no conserva la fuente vectorial de la cotización.',
      );
    }
    const paso = this.pasoCorte(quoteItem.trazabilidadJson);
    if (!paso) {
      throw new BadRequestException(
        'La plantilla de instalación sólo está disponible para cortes vectoriales de Polyfan.',
      );
    }
    const context = this.record(quoteItem.jobContextJson);
    const source = this.record(context?.disenoVectorialFuente);
    const svg = typeof source?.svg === 'string' ? source.svg : '';
    const width = Number(source?.anchoFinalMm);
    const height =
      source?.altoFinalMm == null ? undefined : Number(source.altoFinalMm);
    const sourceName =
      typeof source?.nombreArchivo === 'string'
        ? source.nombreArchivo
        : item.nombre || item.codigo;
    if (!svg || !Number.isFinite(width) || width <= 0) {
      throw new BadRequestException(
        'El item no contiene un SVG original válido para generar la plantilla.',
      );
    }
    const geometria = analizarSvgFabricacion({
      svg,
      anchoFinalMm: width,
      altoFinalMm: height,
    }).geometria;
    const nesting = this.nestingDelPaso(paso);
    const firstSubstrate = nesting.substrates?.[0];
    const visual = this.record(nesting.visualConfig);
    const margins = this.record(visual?.margins);
    const margin = Math.max(
      Number(margins?.leftMm ?? 0),
      Number(margins?.rightMm ?? 0),
      Number(margins?.topMm ?? 0),
      Number(margins?.bottomMm ?? 0),
    );
    const widthUsable = Number(firstSubstrate?.widthMm ?? 0) - margin * 2;
    const heightUsable = Number(firstSubstrate?.heightMm ?? 0) - margin * 2;
    const unionesPersistidas = this.unionesDelNesting(nesting);
    let uniones: UnionVectorial[] = unionesPersistidas ?? [];
    if (
      unionesPersistidas === null &&
      nesting.estrategiaDisposicion === 'nesting_optimizado' &&
      widthUsable > 0 &&
      heightUsable > 0
    ) {
      uniones = segmentarPiezasConEncastres({
        piezas: geometria.piezas,
        anchoUtilMm: widthUsable,
        altoUtilMm: heightUsable,
        permitirRotacion: true,
      }).uniones;
    }
    return {
      nombreArchivo: this.safeName(sourceName.replace(/\.svg$/i, '')),
      nombre: item.nombre || item.codigo,
      nombreFuente: sourceName,
      geometria,
      uniones,
      plantilla: crearPlantillaInstalacion({
        geometria,
        nombre: item.nombre || item.codigo,
        uniones,
        configuracion,
      }),
    };
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

  private unionesDelNesting(
    nesting: NestingPersistido,
  ): UnionVectorial[] | null {
    const root = this.record(nesting);
    const metricas = this.record(root?.metricasRaw);
    if (!Array.isArray(metricas?.uniones)) return null;
    return metricas.uniones
      .map((value) => this.record(value))
      .filter(
        (value): value is Record<string, unknown> =>
          Boolean(
            value &&
              typeof value.id === 'string' &&
              typeof value.piezaOrigenId === 'string' &&
              (value.tipoEncastre === 'cola_milano' ||
                value.tipoEncastre === 'recta'),
          ),
      ) as unknown as UnionVectorial[];
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

function file(bytes: Buffer, mime: string, name: string) {
  return { bytes, mime, name };
}
