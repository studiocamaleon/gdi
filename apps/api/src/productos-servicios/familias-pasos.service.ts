import { BadRequestException, Injectable } from '@nestjs/common';
import { TipoCentroCosto } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CATEGORIAS } from './pasos/categorias';
import {
  FAMILIAS,
  listarFamilias as listarFamiliasCatalogo,
  resolverFamilia,
} from './pasos/familias';
import { MODOS_ACTIVACION_UNIVERSALES } from './pasos/types';
import { proyectarPasoTenant } from './pasos/paso-tenant';
import { resumenCapacidades } from './pasos/capacidades';

import { outputsReferenciadosPorRegla } from './pasos/validacion-pre-pasada';
import type {
  DefinicionFamiliaResuelta,
  FamiliaCodigo,
  MecanismoCantidad,
  ModoActivacion,
  ModoTiempo,
} from './pasos/types';
import type { UpsertProductoConfigPasoDto } from './dto/producto-ruta.dto';

@Injectable()
export class FamiliasPasosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catálogo del sistema + familias del TENANT activas (Etapa C): es lo
   *  que consumen el editor de rutas y los selectores de pasos. */
  async listarFamilias(tenantId: string) {
    const [familiasTenant, defaultsRows] = await Promise.all([
      this.prisma.pasoTenant.findMany({
        where: { tenantId, activo: true },
        orderBy: { nombre: 'asc' },
      }),
      // E.1 — defaults declarados (sistema Y tenant) para selectores y la
      // ficha "Configurar defaults" del catálogo.
      this.prisma.familiaPasoDefaults.findMany({ where: { tenantId } }),
    ]);
    const defaultsPorFamilia = new Map(
      defaultsRows.map((d) => [
        d.familiaCodigo,
        {
          centroCostoId: d.centroCostoId,
          productividadHora:
            d.productividadHora != null ? Number(d.productividadHora) : null,
          tiempoFijoMin:
            d.tiempoFijoMin != null ? Number(d.tiempoFijoMin) : null,
          demasiaMm: d.demasiaMm != null ? Number(d.demasiaMm) : null,
          solapePanelMm:
            d.solapePanelMm != null ? Number(d.solapePanelMm) : null,
          tercerizado: d.tercerizado,
          proveedorId: d.proveedorId,
          fuenteCostoTercerizado: d.fuenteCostoTercerizado,
          plazoProveedorDias: d.plazoProveedorDias,
        },
      ]),
    );
    return {
      categorias: Object.values(CATEGORIAS).sort((a, b) => a.orden - b.orden),
      // Una sola serialización para AMBOS mundos: una instancia del tenant
      // HEREDA la ficha entera de su plantilla (docs/pasos-tenant-por-
      // plantilla-diseno.md), así que sale con los mismos ejes que un paso
      // del sistema — antes eran dos mapeos con la mitad de los campos en
      // null del lado tenant.
      familias: [
        ...listarFamiliasCatalogo().map((codigo) =>
          serializarFamilia(FAMILIAS[codigo], 'sistema', defaultsPorFamilia),
        ),
        ...familiasTenant
          .map((fila) => proyectarPasoTenant(fila))
          .filter((f): f is NonNullable<typeof f> => f != null)
          .map((f) => serializarFamilia(f, 'tenant', defaultsPorFamilia)),
      ],
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
          tipoCentro: TipoCentroCosto.PRODUCTIVO,
        },
        select: {
          id: true,
          codigo: true,
          nombre: true,
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
    const ordenes = new Set<number>();
    for (const p of pasos) {
      // Resolver, no catálogo: una FamiliaTenant (UUID) es tan válida como
      // una del sistema. Las inhabilitadas también resuelven — una ruta
      // existente que las usa tiene que poder re-guardarse (§8.6).
      if (!resolverFamilia(p.familiaCodigo)) {
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
    const familia = resolverFamilia(familiaCodigo);
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

    // Una familia TENANT puede fijar su activación (wizard: "fijar para
    // todos los productos"). NO_EJECUTAR queda siempre permitido: es el
    // interruptor para apagar el paso en una ruta puntual, no un modo más.
    if (
      familia.esDeTenant &&
      dto.modoActivacion &&
      dto.modoActivacion !== 'NO_EJECUTAR' &&
      !familia.modosActivacionSoportados.includes(
        dto.modoActivacion as ModoActivacion,
      )
    ) {
      throw new BadRequestException(
        `El paso "${familia.nombre}" fija su activación en ${familia.modosActivacionSoportados.join('/')}: no se puede cambiar por producto.`,
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

    // Una familia que muta medidas se resuelve ANTES del bucle, cuando todavía
    // no corrió ningún paso: su condición no puede mirar un output canónico,
    // porque daría falso y la mutación no se aplicaría en silencio.
    if (familia.mutaMedidasEnPrePasada && dto.condicionActivacionJson) {
      const outputs = outputsReferenciadosPorRegla(dto.condicionActivacionJson);
      if (outputs.length > 0) {
        throw new BadRequestException(
          `La condición de ${familiaCodigo} no puede depender de ${outputs.join(', ')}: ` +
            'esta familia se resuelve antes que el resto de los pasos, así que ese ' +
            'dato todavía no existe. Usá datos del pedido (medidas, cantidad, opciones).',
        );
      }
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
    if (!resolverFamilia(familiaCodigo)) {
      throw new BadRequestException(`Familia desconocida: ${familiaCodigo}`);
    }
  }
}

/**
 * Proyección de una familia al catálogo que consumen el editor de rutas y
 * los selectores. Vale igual para las del sistema y para las instancias del
 * tenant: una instancia trae la ficha heredada, así que no hay campos que
 * anular. [E1 pasos-tenant: antes eran dos mapeos duplicados]
 */
function serializarFamilia(
  f: DefinicionFamiliaResuelta,
  origen: 'sistema' | 'tenant',
  defaultsPorFamilia: Map<string, unknown>,
) {
  return {
    codigo: f.codigo as string,
    origen,
    nombre: f.nombre,
    categoria: f.categoria as string,
    descripcion: f.descripcion,
    visibleEnSelector: f.visibleEnSelector ?? true,
    relacionMaquinaSoportada: f.relacionMaquinaSoportada,
    modoActivacionDefault: f.modoActivacionDefault as string,
    modosTiempoSoportados: f.modosTiempoSoportados,
    mecanismosCantidadSoportados: f.mecanismosCantidadSoportados,
    modosActivacionSoportados: MODOS_ACTIVACION_UNIVERSALES,
    multiplicadoresSoportados: f.multiplicadoresSoportados,
    slotsRequeridos: f.slotsRequeridos,
    mutaMedidasEnPrePasada: f.mutaMedidasEnPrePasada ?? false,
    nestingConfig: f.nestingConfig ?? null,
    esImpresion: f.esImpresion ?? false,
    tiposPerfilCompatibles: f.tiposPerfilCompatibles ?? null,
    separacionNestingDefaultMm: f.separacionNestingDefaultMm ?? 0,
    fuentesPiezasNesting: Object.keys(f.fuentesPiezasNesting ?? {}),
    fuentePiezasDefault: f.fuentePiezasDefault ?? null,
    outputHeredadoDefault: f.outputHeredadoDefault ?? null,
    editorParamsGenerico: f.editorParamsGenerico ?? false,
    mecanismoCantidadDefault: f.mecanismoCantidadDefault ?? null,
    ritmoDefault: f.ritmoDefault ?? null,
    derivador: f.derivador
      ? {
          magnitudPrincipal: f.derivador.magnitudPrincipal,
          unidadPrincipal: f.derivador.unidadPrincipal ?? null,
          magnitudesTiempo: f.derivador.magnitudesTiempo ?? [],
        }
      : null,
    permiteSlotsAdicionales: f.permiteSlotsAdicionales,
    plantillasCompatibles: f.plantillasCompatibles,
    inputsRequeridos: f.inputsRequeridos,
    outputsCanonicos: f.outputsCanonicos,
    capacidades: resumenCapacidades(f.outputsCanonicos),
    defaults: defaultsPorFamilia.get(f.codigo as string) ?? null,
    validaciones: f.validaciones,
    paramsPasoSchema: f.paramsPasoSchema,
    productosTipicos: f.productosTipicos ?? [],
    /** Sólo instancias: de qué plantilla hereda (para mostrarlo en la UI). */
    plantillaCodigo: f.plantillaCodigo ?? null,
  };
}
