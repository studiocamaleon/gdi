import { BadRequestException, Injectable } from '@nestjs/common';
import { UnidadBaseCentroCosto } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CATEGORIAS } from './pasos/categorias';
import {
  FAMILIAS,
  listarFamilias as listarFamiliasCatalogo,
} from './pasos/familias';
import { MODOS_ACTIVACION_UNIVERSALES } from './pasos/types';
import type {
  FamiliaCodigo,
  MecanismoCantidad,
  ModoActivacion,
  ModoTiempo,
} from './pasos/types';
import type { UpsertProductoConfigPasoDto } from './dto/producto-ruta.dto';

const UNIDADES_CENTRO_COSTO_HORARIAS = [
  UnidadBaseCentroCosto.HORA_HOMBRE,
  UnidadBaseCentroCosto.HORA_MAQUINA,
];

@Injectable()
export class FamiliasPasosService {
  constructor(private readonly prisma: PrismaService) {}

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
          modoActivacionDefault: f.modoActivacionDefault,
          modosTiempoSoportados: f.modosTiempoSoportados,
          mecanismosCantidadSoportados: f.mecanismosCantidadSoportados,
          modosActivacionSoportados: MODOS_ACTIVACION_UNIVERSALES,
          multiplicadoresSoportados: f.multiplicadoresSoportados,
          slotsRequeridos: f.slotsRequeridos,
          plantillasCompatibles: f.plantillasCompatibles,
          inputsRequeridos: f.inputsRequeridos,
          outputsCanonicos: f.outputsCanonicos,
          validaciones: f.validaciones,
          paramsPasoSchema: f.paramsPasoSchema,
          productosTipicos: f.productosTipicos,
        };
      }),
    };
  }

  async listarLookupsConfigPaso(tenantId: string) {
    const [maquinas, centrosCosto] = await Promise.all([
      this.prisma.maquina.findMany({
        where: { tenantId, activo: true },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          plantilla: true,
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
              tipoPerfil: true,
	              productivityValue: true,
	              productivityUnit: true,
	              detalleJson: true,
	            },
	          },
        },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.centroCosto.findMany({
        where: {
          tenantId,
          activo: true,
          unidadBaseFutura: { in: UNIDADES_CENTRO_COSTO_HORARIAS },
        },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          unidadBaseFutura: true,
        },
        orderBy: { nombre: 'asc' },
      }),
    ]);
    return { maquinas, materiasPrimas: [], centrosCosto };
  }

  async buscarMateriasPrimas(
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
    const limit = Math.min(Math.max(Number(query.limit ?? 25), 1), 50);
    const text = query.q?.trim();
    return this.prisma.materiaPrima.findMany({
      where: {
        tenantId,
        activo: true,
        ...(query.familias?.length ? { familia: { in: query.familias as never[] } } : {}),
        ...(query.subfamilias?.length ? { subfamilia: { in: query.subfamilias as never[] } } : {}),
        ...(query.templateIds?.length ? { templateId: { in: query.templateIds } } : {}),
        ...(query.tipoTecnico?.length ? { tipoTecnico: { in: query.tipoTecnico } } : {}),
        ...(text
          ? {
              OR: [
                { codigo: { contains: text, mode: 'insensitive' } },
                { nombre: { contains: text, mode: 'insensitive' } },
                { tipoTecnico: { contains: text, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        familia: true,
        subfamilia: true,
        tipoTecnico: true,
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
      orderBy: { nombre: 'asc' },
      take: limit,
    });
  }

  validarFamiliasDePasos(
    pasos: Array<{ familiaCodigo: string; orden: number }>,
  ) {
    const familiasValidas = new Set(listarFamiliasCatalogo());
    const ordenes = new Set<number>();
    for (const p of pasos) {
      if (!familiasValidas.has(p.familiaCodigo as never)) {
        throw new BadRequestException(
          `Familia desconocida: "${p.familiaCodigo}"`,
        );
      }
      if (ordenes.has(p.orden)) {
        throw new BadRequestException(
          `Orden ${p.orden} duplicado en los pasos`,
        );
      }
      ordenes.add(p.orden);
    }
  }

  validarConfigPasoContraFamilia(
    familiaCodigo: string,
    dto: UpsertProductoConfigPasoDto,
  ) {
    const familia = FAMILIAS[familiaCodigo as FamiliaCodigo];
    if (!familia) {
      throw new BadRequestException(`Familia desconocida: "${familiaCodigo}"`);
    }

    if (
      dto.modoActivacion &&
      !MODOS_ACTIVACION_UNIVERSALES.includes(
        dto.modoActivacion as ModoActivacion,
      )
    ) {
      throw new BadRequestException(
        `Modo de activación no soportado: ${dto.modoActivacion}`,
      );
    }

    if (
      dto.modoTiempo &&
      !familia.modosTiempoSoportados.includes(dto.modoTiempo as ModoTiempo)
    ) {
      throw new BadRequestException(
        `La familia ${familiaCodigo} no soporta modoTiempo=${dto.modoTiempo}`,
      );
    }

    if (
      dto.mecanismoCantidad &&
      !familia.mecanismosCantidadSoportados.includes(
        dto.mecanismoCantidad as MecanismoCantidad,
      )
    ) {
      throw new BadRequestException(
        `La familia ${familiaCodigo} no soporta mecanismoCantidad=${dto.mecanismoCantidad}`,
      );
    }

    const multiplicadoresSoportados = new Set(
      familia.multiplicadoresSoportados,
    );
    for (const multiplicador of dto.multiplicadoresActivos ?? []) {
      if (!multiplicadoresSoportados.has(multiplicador)) {
        throw new BadRequestException(
          `La familia ${familiaCodigo} no soporta el multiplicador ${multiplicador}`,
        );
      }
    }
  }

  assertFamiliaExiste(familiaCodigo: string) {
    if (!FAMILIAS[familiaCodigo as FamiliaCodigo]) {
      throw new BadRequestException(`Familia desconocida: ${familiaCodigo}`);
    }
  }
}
