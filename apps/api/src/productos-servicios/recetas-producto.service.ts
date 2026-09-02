import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AlcanceDocumentoProduccion,
  EstadoProductoRecetaRevision,
  Prisma,
  UnidadMateriaPrima,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import type { CurrentAuth } from '../auth/auth.types';
import { firmaActor } from '../common/firma-actor';
import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  DescartarBorradorRecetaDto,
  DeprecarRecetaDto,
  GuardarBorradorRecetaDto,
  PublicarRecetaDto,
  RecetaComponenteDto,
  RecetaDocumentoDto,
} from './dto/receta-producto.dto';
import { ProductoValidacionService } from './producto-validacion.service';
import { ProductosService } from './productos.service';
import { ConfigPasosService } from './config-pasos.service';
import type { UpsertProductoConfigPasoDto } from './dto/producto-ruta.dto';
import {
  compilarRutaLineal,
  validarYOrdenarGrafo,
  type GrafoProduccion,
} from '../ordenes-trabajo/grafo-produccion';
import {
  leerConfiguracionComponente,
  ordenarComponentesPorCalculo,
  validarConfiguracionComponente,
} from './componentes-configuracion';
import { catalogoSalidasPublicasComposicion } from './composicion-outputs';
import {
  leerConfiguracionesPasosCompuestos,
  leerDefinicionesPasoCompuesto,
  type ConfiguracionPasoCompuesto,
} from './pasos-compuestos';
import {
  construirBomMultinivel,
  type BomRevisionFuente,
} from './bom-multinivel';
import { leerWorkflowRuta } from './ruta-workflow';
import {
  congelarPoliticaPricingComponente,
  validarPoliticaPricingComponente,
} from './precio/pricing-compuesto';

type ProductoDetalle = Awaited<ReturnType<ProductosService['obtenerProducto']>>;
type RutaDetalle = ProductoDetalle['rutasAlternativas'][number];

type PasoSnapshot = {
  clave: string;
  nombre: string;
  familiaCodigo: string;
  orden: number;
  configuracion: Record<string, unknown>;
  slots: Array<Record<string, unknown>>;
  recurso: Record<string, unknown>;
};

type SnapshotConfiguracion = {
  contractVersion: 1;
  producto: Record<string, unknown>;
  ruta: Record<string, unknown>;
  pasos: PasoSnapshot[];
  cargosCotizacion: unknown[];
};

type VarianteMaterialReferencia = {
  unidad: UnidadMateriaPrima | null;
  sku: string;
  nombre: string;
};

function jsonSeguro(valor: unknown): unknown {
  return JSON.parse(
    JSON.stringify(valor, (_key, item: unknown) =>
      typeof item === 'bigint' ? item.toString() : item,
    ),
  ) as unknown;
}

function ordenarCanonico(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarCanonico);
  if (!valor || typeof valor !== 'object') return valor;
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, ordenarCanonico(item)]),
  );
}

export function huellaDe(valor: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(ordenarCanonico(jsonSeguro(valor))))
    .digest('hex');
}

function numero(valor: unknown, fallback = 0): number {
  const result = Number(valor);
  return Number.isFinite(result) ? result : fallback;
}

function grafoParaConfiguracion(
  configuracion: SnapshotConfiguracion,
  aristas?: Array<{ desdeClave: string; haciaClave: string }>,
  gates?: Array<{ nodoClave: string; tipo: 'MATERIAL' | 'CALIDAD' }>,
): GrafoProduccion {
  const nodos = configuracion.pasos.map((paso, indice) => ({
    clave: paso.clave,
    indice,
    gates: (gates ?? [])
      .filter((gate) => gate.nodoClave === paso.clave)
      .map((gate) => gate.tipo),
  }));
  try {
    return aristas
      ? validarYOrdenarGrafo(nodos, aristas)
      : compilarRutaLineal(nodos);
  } catch (error: unknown) {
    throw new BadRequestException(
      error instanceof Error
        ? error.message
        : 'La topología productiva no es válida.',
    );
  }
}

@Injectable()
export class RecetasProductoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productos: ProductosService,
    private readonly validacionProducto: ProductoValidacionService,
    private readonly eventos: EventosSistemaService,
    @Optional() private readonly configPasos?: ConfigPasosService,
  ) {}

  async obtener(auth: CurrentAuth, productoId: string) {
    await this.productos.obtenerProducto(auth.tenantId, productoId);
    return this.prisma.productoReceta.findMany({
      where: { tenantId: auth.tenantId, productoId },
      orderBy: { createdAt: 'asc' },
      include: {
        rutaAlternativa: {
          select: { id: true, nombre: true, rutaVersion: true, activo: true },
        },
        revisionPublicada: {
          include: {
            materiales: { orderBy: { orden: 'asc' } },
            recursos: { orderBy: { orden: 'asc' } },
            componentes: { orderBy: { orden: 'asc' } },
            documentos: { orderBy: { orden: 'asc' } },
          },
        },
        revisiones: {
          orderBy: { numero: 'desc' },
          include: {
            materiales: { orderBy: { orden: 'asc' } },
            recursos: { orderBy: { orden: 'asc' } },
            componentes: { orderBy: { orden: 'asc' } },
            documentos: { orderBy: { orden: 'asc' } },
          },
        },
      },
    });
  }

  /**
   * Proyección de lectura del BOM completo. Sigue las revisiones exactas que
   * quedaron congeladas en cada componente; nunca reemplaza un hijo por su
   * publicación más reciente.
   */
  async obtenerBomMultinivel(auth: CurrentAuth, revisionId: string) {
    try {
      const bom = await construirBomMultinivel(revisionId, (id) =>
        this.cargarRevisionBom(auth.tenantId, id),
      );
      if (!bom) {
        throw new NotFoundException('La revisión de receta no existe.');
      }
      return bom;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      throw new ConflictException(
        error instanceof Error
          ? error.message
          : 'No se pudo proyectar el BOM multinivel.',
      );
    }
  }

  /** Contrato consumido por el motor: null mantiene el flujo legacy. */
  async resolverPublicadaParaCotizar(
    tenantId: string,
    productoId: string,
    rutaAlternativaId: string,
  ) {
    const receta = await this.prisma.productoReceta.findFirst({
      where: {
        tenantId,
        productoId,
        rutaAlternativaId,
        activo: true,
        revisionPublicadaId: { not: null },
      },
      include: {
        revisionPublicada: {
          include: {
            documentos: { orderBy: { orden: 'asc' } },
            componentes: { orderBy: { orden: 'asc' } },
          },
        },
      },
    });
    if (!receta?.revisionPublicada) return null;

    const producto = await this.productos.obtenerProducto(tenantId, productoId);
    const ruta = this.encontrarRuta(producto, rutaAlternativaId);
    const pasosCompuestosPublicados = receta.revisionPublicada
      .pasosCompuestosJson
      ? leerConfiguracionesPasosCompuestos(
          receta.revisionPublicada.pasosCompuestosJson,
        )
      : [];
    const snapshot = {
      ...this.incorporarPasosInternos(
        this.snapshotConfiguracion(producto, ruta),
        pasosCompuestosPublicados,
      ),
      ...(receta.revisionPublicada.grafoProduccionJson
        ? {
            grafoProduccion: receta.revisionPublicada.grafoProduccionJson,
          }
        : {}),
      documentos: this.documentosCanonicos(receta.revisionPublicada.documentos),
      componentes: this.componentesCanonicos(
        await this.componentesConRevisionActual(
          tenantId,
          receta.revisionPublicada.componentes.map((item) => ({
            ...item,
            cantidad: Number(item.cantidad),
          })),
          pasosCompuestosPublicados,
        ),
      ),
      ...(receta.revisionPublicada.pasosCompuestosJson
        ? {
            pasosCompuestos: pasosCompuestosPublicados,
          }
        : {}),
    };
    const huellaActual = huellaDe(snapshot);
    if (huellaActual !== receta.revisionPublicada.huellaConfiguracion) {
      throw new ConflictException(
        `La receta publicada V${receta.revisionPublicada.numero} tiene cambios productivos sin publicar. Actualizá y publicá una nueva revisión antes de cotizar por esta vía.`,
      );
    }
    return {
      id: receta.revisionPublicada.id,
      version: receta.revisionPublicada.numero,
      huella: receta.revisionPublicada.huellaConfiguracion,
      snapshot: receta.revisionPublicada.snapshotJson,
      componentes: receta.revisionPublicada.componentes.map((item) => ({
        productoComponenteId: item.productoComponenteId,
        recetaRevisionId: item.recetaRevisionId,
        recetaVersion: item.recetaVersion,
        recetaHuella: item.recetaHuella,
        codigo: item.codigo,
        nombre: item.nombre,
        politicaEjecucion: item.politicaEjecucion,
        formula: item.formula,
        cantidad: Number(item.cantidad),
        unidad: item.unidad,
        requerido: item.requerido,
        configuracionJson:
          item.configuracionJson == null
            ? null
            : jsonSeguro(item.configuracionJson),
        nodoIncorporacionClave: item.nodoIncorporacionClave,
        nodosPredecesoresClaves: item.nodosPredecesoresClaves,
        orden: item.orden,
      })),
      pasosCompuestos: receta.revisionPublicada.pasosCompuestosJson
        ? leerConfiguracionesPasosCompuestos(
            receta.revisionPublicada.pasosCompuestosJson,
          )
        : this.pasosCompuestosDesdeLegacy(
            receta.revisionPublicada.componentes.map((item) => ({
              ...item,
              cantidad: Number(item.cantidad),
            })),
            this.snapshotConfiguracion(producto, ruta),
          ),
    };
  }

  async guardarBorrador(
    auth: CurrentAuth,
    productoId: string,
    dto: GuardarBorradorRecetaDto,
  ) {
    const producto = await this.productos.obtenerProducto(
      auth.tenantId,
      productoId,
    );
    const ruta = this.encontrarRuta(producto, dto.rutaAlternativaId);
    const actorNombre = await this.actorNombre(auth);
    const configuracion = this.snapshotConfiguracion(producto, ruta);

    const existente = await this.prisma.productoReceta.findFirst({
      where: {
        tenantId: auth.tenantId,
        productoId,
        rutaAlternativaId: ruta.id,
      },
      include: {
        revisiones: {
          where: { estado: EstadoProductoRecetaRevision.BORRADOR },
          include: { documentos: true, componentes: true },
        },
        revisionPublicada: {
          include: { documentos: true, componentes: true },
        },
      },
    });
    const borradorExistente = existente?.revisiones[0] ?? null;
    const revisionFuente =
      borradorExistente ?? existente?.revisionPublicada ?? null;
    const plantillaRuta = !revisionFuente
      ? await this.plantillaInicialDesdeRuta(auth.tenantId, ruta)
      : null;
    if (
      dto.expectedUpdatedAt &&
      (!borradorExistente ||
        borradorExistente.updatedAt.toISOString() !== dto.expectedUpdatedAt)
    ) {
      throw new ConflictException(
        'La receta cambió en otra sesión. Recargá antes de volver a guardar.',
      );
    }

    const documentos =
      dto.documentos ??
      revisionFuente?.documentos.map((item) => ({
        codigo: item.codigo,
        nombre: item.nombre,
        alcance: item.alcance,
        pasoClave: item.pasoClave,
        proposito: item.proposito,
        etapa: item.etapa,
        tipoAprobacion: item.tipoAprobacion,
        requerido: item.requerido,
        descripcion: item.descripcion,
        orden: item.orden,
      })) ??
      [];
    const componentes =
      dto.componentes ??
      revisionFuente?.componentes.map((item) => ({
        productoComponenteId: item.productoComponenteId,
        codigo: item.codigo,
        nombre: item.nombre,
        politicaEjecucion: item.politicaEjecucion,
        formula: item.formula,
        cantidad: Number(item.cantidad),
        unidad: item.unidad,
        requerido: item.requerido,
        configuracionJson:
          item.configuracionJson == null
            ? null
            : jsonSeguro(item.configuracionJson),
        nodoIncorporacionClave: item.nodoIncorporacionClave,
        nodosPredecesoresClaves: item.nodosPredecesoresClaves,
        orden: item.orden,
      })) ??
      plantillaRuta?.componentes ??
      [];
    if (producto.estructuraProducto === 'SIMPLE' && componentes.length > 0) {
      throw new BadRequestException(
        'Este producto está definido como simple. Cambialo a compuesto en Identidad antes de agregar componentes fabricados.',
      );
    }
    await this.validarReferenciasBorrador(
      auth.tenantId,
      productoId,
      documentos,
      componentes,
      new Set(configuracion.pasos.map((paso) => paso.clave)),
    );
    const nombresPasoVigentes = new Map(
      configuracion.pasos.map((paso) => [paso.clave, paso.nombre]),
    );
    const pasosCompuestos = leerConfiguracionesPasosCompuestos(
      dto.pasosCompuestos ??
        borradorExistente?.pasosCompuestosJson ??
        existente?.revisionPublicada?.pasosCompuestosJson ??
        [],
    ).map((paso) => ({
      ...paso,
      // El nombre es contextual al producto y puede cambiar en el editor de
      // ruta. La sincronización debe conservar la subruta configurada, pero no
      // una etiqueta vieja que vuelva a confundir BOM y componentes.
      pasoNombre: nombresPasoVigentes.get(paso.nodoClave) ?? paso.pasoNombre,
    }));
    const componentesVersionados = await this.componentesConRevisionActual(
      auth.tenantId,
      componentes,
      pasosCompuestos,
      { actualizarSnapshotsPricing: true },
    );

    const aristasFuente = dto.dependencias
      ? dto.dependencias.map((dependencia) => ({
          desdeClave: dependencia.desdeClave,
          haciaClave: dependencia.haciaClave,
        }))
      : (borradorExistente?.grafoProduccionJson ??
          existente?.revisionPublicada?.grafoProduccionJson)
        ? (
            (borradorExistente?.grafoProduccionJson ??
              existente?.revisionPublicada
                ?.grafoProduccionJson) as unknown as GrafoProduccion
          ).aristas
        : plantillaRuta?.dependencias;
    const grafoAnterior = (borradorExistente?.grafoProduccionJson ??
      existente?.revisionPublicada?.grafoProduccionJson) as
      | (GrafoProduccion & Prisma.JsonObject)
      | null
      | undefined;
    const gatesFuente = dto.gates
      ? dto.gates
      : (grafoAnterior?.nodos ?? []).flatMap((nodo) =>
          (nodo.gates ?? []).map((tipo) => ({
            nodoClave: nodo.clave,
            tipo,
          })),
        );
    const grafoProduccion = grafoParaConfiguracion(
      configuracion,
      aristasFuente,
      gatesFuente,
    );
    const clavesNodo = new Set(grafoProduccion.nodos.map((nodo) => nodo.clave));
    for (const componente of componentes) {
      if (
        (componente.politicaEjecucion ?? 'INDEPENDIENTE') === 'INDEPENDIENTE' &&
        !componente.nodoIncorporacionClave
      ) {
        throw new BadRequestException(
          `El componente "${componente.nombre}" necesita un nodo de incorporación en el flujo principal.`,
        );
      }
      if (
        componente.nodoIncorporacionClave &&
        !clavesNodo.has(componente.nodoIncorporacionClave)
      ) {
        throw new BadRequestException(
          `El nodo de incorporación de "${componente.nombre}" ya no existe en esta ruta.`,
        );
      }
      for (const predecesor of componente.nodosPredecesoresClaves ?? []) {
        if (!clavesNodo.has(predecesor)) {
          throw new BadRequestException(
            `La dependencia inicial de "${componente.nombre}" referencia un nodo que ya no existe.`,
          );
        }
      }
    }
    try {
      validarYOrdenarGrafo(
        [
          ...grafoProduccion.nodos,
          ...componentes
            .filter(
              (item) =>
                (item.politicaEjecucion ?? 'INDEPENDIENTE') === 'INDEPENDIENTE',
            )
            .map((item, index) => ({
              clave: `componente:${item.codigo}`,
              indice: grafoProduccion.nodos.length + index,
            })),
        ],
        [
          ...grafoProduccion.aristas,
          ...componentes
            .filter(
              (item) =>
                (item.politicaEjecucion ?? 'INDEPENDIENTE') === 'INDEPENDIENTE',
            )
            .flatMap((item) => {
              const nodoComponente = `componente:${item.codigo}`;
              return [
                ...(item.nodosPredecesoresClaves ?? []).map((desdeClave) => ({
                  desdeClave,
                  haciaClave: nodoComponente,
                })),
                ...(item.nodoIncorporacionClave
                  ? [
                      {
                        desdeClave: nodoComponente,
                        haciaClave: item.nodoIncorporacionClave,
                      },
                    ]
                  : []),
              ];
            }),
        ],
      );
    } catch (error: unknown) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Las dependencias de los componentes no forman un flujo válido.',
      );
    }
    await this.validarPasosCompuestos(
      auth.tenantId,
      pasosCompuestos,
      configuracion,
      componentes,
      clavesNodo,
      false,
    );

    const configuracionConInternos = this.incorporarPasosInternos(
      configuracion,
      pasosCompuestos,
    );
    const snapshot = {
      ...configuracionConInternos,
      grafoProduccion,
      documentos: this.documentosCanonicos(documentos),
      componentes: this.componentesCanonicos(componentesVersionados),
      pasosCompuestos,
    };
    const huella = huellaDe(snapshot);
    const variantes = await this.unidadesVariantes(auth.tenantId, snapshot);
    const materiales = this.materialesDesdeSnapshot(snapshot, variantes);
    const recursos = await this.recursosConEstaciones(
      auth.tenantId,
      this.recursosDesdeSnapshot(snapshot),
    );

    const revisionId = await this.prisma.$transaction(async (tx) => {
      const receta =
        existente ??
        (await tx.productoReceta.create({
          data: {
            tenantId: auth.tenantId,
            productoId,
            rutaAlternativaId: ruta.id,
            codigo: `REC-${producto.codigo}-${ruta.ruta.codigo}`.slice(0, 80),
            nombre: `Receta de ${producto.nombre} · ${ruta.nombre}`.slice(
              0,
              180,
            ),
          },
          include: { revisiones: true },
        }));

      let revision = borradorExistente;
      if (revision) {
        await tx.productoRecetaMaterial.deleteMany({
          where: { revisionId: revision.id, tenantId: auth.tenantId },
        });
        await tx.productoRecetaRecurso.deleteMany({
          where: { revisionId: revision.id, tenantId: auth.tenantId },
        });
        await tx.productoRecetaComponente.deleteMany({
          where: { revisionId: revision.id, tenantId: auth.tenantId },
        });
        await tx.productoRecetaDocumento.deleteMany({
          where: { revisionId: revision.id, tenantId: auth.tenantId },
        });
        revision = await tx.productoRecetaRevision.update({
          where: { id: revision.id },
          data: {
            rutaAlternativaId: ruta.id,
            rutaVersion: ruta.rutaVersion,
            huellaConfiguracion: huella,
            snapshotJson: snapshot as Prisma.InputJsonValue,
            topologiaProduccion: grafoProduccion.topologia,
            grafoProduccionJson: grafoProduccion as Prisma.InputJsonValue,
            pasosCompuestosJson:
              pasosCompuestos as unknown as Prisma.InputJsonValue,
            cambios: dto.cambios ?? revision.cambios,
            creadaPorId: auth.userId,
            creadaPorNombre: actorNombre,
          },
          include: { documentos: true, componentes: true },
        });
      } else {
        const ultima = await tx.productoRecetaRevision.aggregate({
          where: { recetaId: receta.id, tenantId: auth.tenantId },
          _max: { numero: true },
        });
        revision = await tx.productoRecetaRevision.create({
          data: {
            tenantId: auth.tenantId,
            recetaId: receta.id,
            numero: (ultima._max.numero ?? 0) + 1,
            rutaAlternativaId: ruta.id,
            rutaVersion: ruta.rutaVersion,
            huellaConfiguracion: huella,
            snapshotJson: snapshot as Prisma.InputJsonValue,
            topologiaProduccion: grafoProduccion.topologia,
            grafoProduccionJson: grafoProduccion as Prisma.InputJsonValue,
            pasosCompuestosJson:
              pasosCompuestos as unknown as Prisma.InputJsonValue,
            cambios: dto.cambios,
            creadaPorId: auth.userId,
            creadaPorNombre: actorNombre,
          },
          include: { documentos: true, componentes: true },
        });
      }

      if (materiales.length) {
        await tx.productoRecetaMaterial.createMany({
          data: materiales.map((item) => ({
            ...item,
            tenantId: auth.tenantId,
            revisionId: revision.id,
          })),
        });
      }
      if (recursos.length) {
        await tx.productoRecetaRecurso.createMany({
          data: recursos.map((item) => ({
            ...item,
            tenantId: auth.tenantId,
            revisionId: revision.id,
          })),
        });
      }
      if (componentes.length) {
        await tx.productoRecetaComponente.createMany({
          data: componentes.map((item, index) => ({
            ...(componentesVersionados[index] ?? {}),
            tenantId: auth.tenantId,
            revisionId: revision.id,
            productoComponenteId: item.productoComponenteId,
            recetaRevisionId: componentesVersionados[index].recetaRevisionId,
            recetaVersion: componentesVersionados[index].recetaVersion,
            recetaHuella: componentesVersionados[index].recetaHuella,
            codigo: item.codigo.trim(),
            nombre: item.nombre.trim(),
            politicaEjecucion: item.politicaEjecucion ?? 'INDEPENDIENTE',
            formula: item.formula ?? 'por_unidad',
            cantidad: item.cantidad,
            unidad: item.unidad ?? 'unidad',
            requerido: item.requerido ?? true,
            configuracionJson:
              (componentesVersionados[index].configuracionJson as
                | Prisma.InputJsonValue
                | undefined) ?? undefined,
            nodoIncorporacionClave: item.nodoIncorporacionClave ?? null,
            nodosPredecesoresClaves: item.nodosPredecesoresClaves ?? [],
            orden: item.orden ?? index,
          })),
        });
      }
      if (documentos.length) {
        await tx.productoRecetaDocumento.createMany({
          data: documentos.map((item, index) => ({
            tenantId: auth.tenantId,
            revisionId: revision.id,
            alcance:
              item.alcance ??
              (item.pasoClave
                ? AlcanceDocumentoProduccion.PASO
                : AlcanceDocumentoProduccion.ITEM),
            pasoClave:
              (item.alcance ??
                (item.pasoClave
                  ? AlcanceDocumentoProduccion.PASO
                  : AlcanceDocumentoProduccion.ITEM)) ===
              AlcanceDocumentoProduccion.PASO
                ? (item.pasoClave ?? null)
                : null,
            codigo: item.codigo.trim(),
            nombre: item.nombre.trim(),
            proposito: item.proposito,
            etapa: item.etapa,
            tipoAprobacion: item.tipoAprobacion ?? null,
            requerido: item.requerido ?? true,
            descripcion: item.descripcion ?? null,
            orden: item.orden ?? index,
          })),
        });
      }

      await this.eventos.publicar(
        {
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          actorNombre,
          tipo: 'receta_borrador_guardado',
          entidadTipo: 'PRODUCTO_RECETA_REVISION',
          entidadId: revision.id,
          titulo: `Receta V${revision.numero} actualizada`,
          mensaje: `${producto.nombre} tiene cambios de receta sin publicar.`,
          href: `/productos-servicios/${productoId}?tab=produccion&vista=bom`,
          topicos: [`producto:${productoId}`, `receta:${receta.id}`],
        },
        tx,
      );
      return revision.id;
    });

    return this.obtenerRevision(auth.tenantId, revisionId);
  }

  async publicar(
    auth: CurrentAuth,
    revisionId: string,
    dto: PublicarRecetaDto,
  ) {
    const revision = await this.prisma.productoRecetaRevision.findFirst({
      where: { id: revisionId, tenantId: auth.tenantId },
      include: {
        receta: { include: { producto: true } },
        documentos: { orderBy: { orden: 'asc' } },
        componentes: { orderBy: { orden: 'asc' } },
      },
    });
    if (!revision)
      throw new NotFoundException('Revisión de receta inexistente.');
    if (revision.estado !== EstadoProductoRecetaRevision.BORRADOR) {
      throw new BadRequestException(
        'Sólo una revisión en borrador puede publicarse.',
      );
    }
    if (revision.updatedAt.toISOString() !== dto.expectedUpdatedAt) {
      throw new ConflictException(
        'La receta cambió en otra sesión. Recargá antes de publicarla.',
      );
    }

    const producto = await this.productos.obtenerProducto(
      auth.tenantId,
      revision.receta.productoId,
    );
    const ruta = this.encontrarRuta(producto, revision.rutaAlternativaId);
    const configuracion = this.snapshotConfiguracion(producto, ruta);
    const pasosCompuestosActuales = leerConfiguracionesPasosCompuestos(
      revision.pasosCompuestosJson ?? [],
    );
    const componentesActuales = await this.componentesConRevisionActual(
      auth.tenantId,
      revision.componentes.map((item) => ({
        ...item,
        cantidad: Number(item.cantidad),
      })),
      pasosCompuestosActuales,
      { actualizarSnapshotsPricing: true },
    );
    const configuracionConInternos = this.incorporarPasosInternos(
      configuracion,
      pasosCompuestosActuales,
    );
    const snapshotActual = {
      ...configuracionConInternos,
      ...(revision.grafoProduccionJson
        ? { grafoProduccion: revision.grafoProduccionJson }
        : {}),
      documentos: this.documentosCanonicos(revision.documentos),
      componentes: this.componentesCanonicos(componentesActuales),
      ...(revision.pasosCompuestosJson
        ? {
            pasosCompuestos: pasosCompuestosActuales,
          }
        : {}),
    };
    if (huellaDe(snapshotActual) !== revision.huellaConfiguracion) {
      throw new ConflictException(
        'La configuración productiva cambió desde que se guardó el borrador. Actualizá la receta antes de publicar.',
      );
    }
    const grafoActual = revision.grafoProduccionJson as
      | GrafoProduccion
      | null
      | undefined;
    await this.validarPasosCompuestos(
      auth.tenantId,
      pasosCompuestosActuales,
      configuracion,
      revision.componentes.map((item) => ({
        ...item,
        cantidad: Number(item.cantidad),
      })),
      new Set(
        grafoActual?.nodos.map((item) => item.clave) ??
          configuracion.pasos.map((item) => item.clave),
      ),
      true,
    );

    const validacion = await this.validacionProducto.validarProducto(
      auth.tenantId,
      revision.receta.productoId,
    );
    if (!validacion.exitoso) {
      throw new BadRequestException({
        message: 'El producto todavía no está listo para publicar su receta.',
        errores: validacion.errores,
      });
    }
    await this.validarCiclos(
      auth.tenantId,
      revision.receta.productoId,
      revision.componentes.map((item) => item.productoComponenteId),
    );
    const unidades = await this.unidadesVariantes(
      auth.tenantId,
      snapshotActual,
    );
    this.validarUnidades(snapshotActual, unidades);
    const actorNombre = await this.actorNombre(auth);

    await this.prisma.$transaction(async (tx) => {
      if (revision.receta.revisionPublicadaId) {
        await tx.productoRecetaRevision.updateMany({
          where: {
            id: revision.receta.revisionPublicadaId,
            tenantId: auth.tenantId,
            estado: EstadoProductoRecetaRevision.PUBLICADA,
          },
          data: {
            estado: EstadoProductoRecetaRevision.DEPRECADA,
            deprecadaEl: new Date(),
            deprecadaPorId: auth.userId,
            deprecadaPorNombre: actorNombre,
          },
        });
      }
      const updated = await tx.productoRecetaRevision.updateMany({
        where: {
          id: revision.id,
          tenantId: auth.tenantId,
          estado: EstadoProductoRecetaRevision.BORRADOR,
          updatedAt: revision.updatedAt,
        },
        data: {
          estado: EstadoProductoRecetaRevision.PUBLICADA,
          cambios: dto.cambios ?? revision.cambios,
          publicadaEl: new Date(),
          publicadaPorId: auth.userId,
          publicadaPorNombre: actorNombre,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'La revisión cambió mientras se publicaba.',
        );
      }
      await tx.productoReceta.update({
        where: { id: revision.recetaId },
        data: { revisionPublicadaId: revision.id },
      });
      await this.eventos.publicar(
        {
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          actorNombre,
          tipo: 'receta_publicada',
          entidadTipo: 'PRODUCTO_RECETA_REVISION',
          entidadId: revision.id,
          titulo: `Receta V${revision.numero} publicada`,
          mensaje: `${revision.receta.producto.nombre} ya tiene una definición productiva vigente.`,
          href: `/productos-servicios/${revision.receta.productoId}?tab=produccion&vista=bom`,
          topicos: [
            `producto:${revision.receta.productoId}`,
            `receta:${revision.recetaId}`,
          ],
        },
        tx,
      );
    });

    return this.obtenerRevision(auth.tenantId, revision.id);
  }

  async descartarBorrador(
    auth: CurrentAuth,
    revisionId: string,
    dto: DescartarBorradorRecetaDto,
  ) {
    const revision = await this.prisma.productoRecetaRevision.findFirst({
      where: { id: revisionId, tenantId: auth.tenantId },
      include: { receta: { include: { producto: true } } },
    });
    if (!revision) {
      throw new NotFoundException('Revisión de receta inexistente.');
    }
    if (revision.estado !== EstadoProductoRecetaRevision.BORRADOR) {
      throw new BadRequestException(
        'Sólo una revisión en borrador puede descartarse.',
      );
    }
    if (revision.updatedAt.toISOString() !== dto.expectedUpdatedAt) {
      throw new ConflictException(
        'El borrador cambió en otra sesión. Recargá antes de descartarlo.',
      );
    }

    const actorNombre = await this.actorNombre(auth);
    const resultado = await this.prisma.$transaction(async (tx) => {
      const eliminada = await tx.productoRecetaRevision.deleteMany({
        where: {
          id: revision.id,
          tenantId: auth.tenantId,
          estado: EstadoProductoRecetaRevision.BORRADOR,
          updatedAt: revision.updatedAt,
        },
      });
      if (eliminada.count !== 1) {
        throw new ConflictException(
          'El borrador cambió mientras se descartaba.',
        );
      }

      const revisionesRestantes = await tx.productoRecetaRevision.count({
        where: { recetaId: revision.recetaId, tenantId: auth.tenantId },
      });
      const recetaEliminada =
        revisionesRestantes === 0 && !revision.receta.revisionPublicadaId;
      if (recetaEliminada) {
        await tx.productoReceta.deleteMany({
          where: {
            id: revision.recetaId,
            tenantId: auth.tenantId,
            revisionPublicadaId: null,
          },
        });
      }

      await this.eventos.publicar(
        {
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          actorNombre,
          tipo: 'receta_borrador_descartado',
          entidadTipo: 'PRODUCTO_RECETA_REVISION',
          entidadId: revision.id,
          titulo: `Borrador V${revision.numero} descartado`,
          mensaje: `${revision.receta.producto.nombre} descartó sus cambios de receta sin publicar.`,
          href: `/productos-servicios/${revision.receta.productoId}?tab=produccion&vista=bom`,
          topicos: [
            `producto:${revision.receta.productoId}`,
            `receta:${revision.recetaId}`,
          ],
        },
        tx,
      );

      return { recetaEliminada };
    });

    return {
      id: revision.id,
      numero: revision.numero,
      descartada: true,
      ...resultado,
    };
  }

  async deprecar(
    auth: CurrentAuth,
    revisionId: string,
    dto: DeprecarRecetaDto,
  ) {
    const revision = await this.prisma.productoRecetaRevision.findFirst({
      where: { id: revisionId, tenantId: auth.tenantId },
      include: { receta: { include: { producto: true } } },
    });
    if (!revision)
      throw new NotFoundException('Revisión de receta inexistente.');
    if (
      revision.estado !== EstadoProductoRecetaRevision.PUBLICADA ||
      revision.receta.revisionPublicadaId !== revision.id
    ) {
      throw new BadRequestException(
        'Sólo la revisión publicada vigente puede deprecarse.',
      );
    }
    if (revision.updatedAt.toISOString() !== dto.expectedUpdatedAt) {
      throw new ConflictException(
        'La receta cambió en otra sesión. Recargá antes de retirarla.',
      );
    }
    const actorNombre = await this.actorNombre(auth);
    await this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.productoRecetaRevision.updateMany({
        where: {
          id: revision.id,
          tenantId: auth.tenantId,
          estado: EstadoProductoRecetaRevision.PUBLICADA,
          updatedAt: revision.updatedAt,
        },
        data: {
          estado: EstadoProductoRecetaRevision.DEPRECADA,
          cambios: dto.motivo ?? revision.cambios,
          deprecadaEl: new Date(),
          deprecadaPorId: auth.userId,
          deprecadaPorNombre: actorNombre,
        },
      });
      if (actualizada.count !== 1) {
        throw new ConflictException('La revisión cambió mientras se retiraba.');
      }
      await tx.productoReceta.update({
        where: { id: revision.recetaId },
        data: { revisionPublicadaId: null },
      });
      await this.eventos.publicar(
        {
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          actorNombre,
          tipo: 'receta_deprecada',
          entidadTipo: 'PRODUCTO_RECETA_REVISION',
          entidadId: revision.id,
          titulo: `Receta V${revision.numero} retirada`,
          mensaje: `${revision.receta.producto.nombre} volvió temporalmente al modo compatible.`,
          href: `/productos-servicios/${revision.receta.productoId}?tab=produccion&vista=bom`,
          topicos: [
            `producto:${revision.receta.productoId}`,
            `receta:${revision.recetaId}`,
          ],
        },
        tx,
      );
    });
    return this.obtenerRevision(auth.tenantId, revision.id);
  }

  private async obtenerRevision(tenantId: string, revisionId: string) {
    return this.prisma.productoRecetaRevision.findFirstOrThrow({
      where: { id: revisionId, tenantId },
      include: {
        materiales: { orderBy: { orden: 'asc' } },
        recursos: { orderBy: { orden: 'asc' } },
        componentes: { orderBy: { orden: 'asc' } },
        documentos: { orderBy: { orden: 'asc' } },
      },
    });
  }

  private async cargarRevisionBom(
    tenantId: string,
    revisionId: string,
  ): Promise<BomRevisionFuente | null> {
    const revision = await this.prisma.productoRecetaRevision.findFirst({
      where: { id: revisionId, tenantId },
      include: {
        receta: {
          include: {
            producto: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                unidadComercial: true,
              },
            },
          },
        },
        rutaAlternativa: { select: { id: true, nombre: true } },
        materiales: { orderBy: { orden: 'asc' } },
        recursos: { orderBy: { orden: 'asc' } },
        componentes: { orderBy: { orden: 'asc' } },
        documentos: { orderBy: { orden: 'asc' } },
      },
    });
    if (!revision) return null;

    return {
      id: revision.id,
      numero: revision.numero,
      estado: revision.estado,
      huellaConfiguracion: revision.huellaConfiguracion,
      recetaId: revision.recetaId,
      rutaAlternativaId: revision.rutaAlternativaId,
      rutaNombre: revision.rutaAlternativa.nombre,
      productoId: revision.receta.producto.id,
      productoCodigo: revision.receta.producto.codigo,
      productoNombre: revision.receta.producto.nombre,
      unidadComercial: revision.receta.producto.unidadComercial,
      materiales: revision.materiales.map((material) => ({
        id: material.id,
        pasoClave: material.pasoClave,
        pasoNombre: material.pasoNombre,
        slotCodigo: material.slotCodigo,
        slotNombre: material.slotNombre,
        rol: material.rol,
        modoSeleccion: material.modoSeleccion,
        materialVarianteId: material.materialVarianteId,
        materialSku: material.materialSku,
        materialNombre: material.materialNombre,
        unidad: material.unidad,
        formula: material.formula,
        cantidadBase: material.cantidadBase,
        cantidadFactor:
          material.cantidadFactor === null
            ? null
            : Number(material.cantidadFactor),
        fuenteMedida: material.fuenteMedida,
        mermaAdicionalPct: Number(material.mermaAdicionalPct),
        aplicaMultiCaras: material.aplicaMultiCaras,
        orden: material.orden,
      })),
      recursos: revision.recursos.map((recurso) => ({
        id: recurso.id,
        pasoClave: recurso.pasoClave,
        pasoNombre: recurso.pasoNombre,
        familiaCodigo: recurso.familiaCodigo,
        maquinaNombre: recurso.maquinaNombre,
        estacionNombre: recurso.estacionNombre,
        perfilNombre: recurso.perfilNombre,
        centroCostoNombre: recurso.centroCostoNombre,
        dotacionOperarios: recurso.dotacionOperarios,
        tercerizado: recurso.tercerizado,
        proveedorNombre: recurso.proveedorNombre,
        orden: recurso.orden,
      })),
      documentos: revision.documentos.map((documento) => ({
        id: documento.id,
        alcance: documento.alcance,
        pasoClave: documento.pasoClave,
        codigo: documento.codigo,
        nombre: documento.nombre,
        proposito: documento.proposito,
        etapa: documento.etapa,
        requerido: documento.requerido,
        orden: documento.orden,
      })),
      componentes: revision.componentes.map((componente) => ({
        id: componente.id,
        productoComponenteId: componente.productoComponenteId,
        recetaRevisionId: componente.recetaRevisionId,
        recetaVersion: componente.recetaVersion,
        recetaHuella: componente.recetaHuella,
        codigo: componente.codigo,
        nombre: componente.nombre,
        politicaEjecucion: componente.politicaEjecucion,
        formula: componente.formula,
        cantidad: Number(componente.cantidad),
        unidad: componente.unidad,
        requerido: componente.requerido,
        configuracionJson: jsonSeguro(componente.configuracionJson),
        nodoIncorporacionClave: componente.nodoIncorporacionClave,
        orden: componente.orden,
      })),
    };
  }

  private pasosCompuestosDesdeLegacy(
    componentes: Array<{
      codigo: string;
      nombre: string;
      configuracionJson?: unknown;
      nodoIncorporacionClave?: string | null;
    }>,
    configuracion: SnapshotConfiguracion,
  ): ConfiguracionPasoCompuesto[] {
    const porNodo = new Map<string, ConfiguracionPasoCompuesto>();
    for (const componente of componentes) {
      const nodoClave = componente.nodoIncorporacionClave;
      const legacy = leerConfiguracionComponente(
        componente.configuracionJson,
      )?.operacionesIncorporacion;
      if (!nodoClave || !legacy?.length) continue;
      const paso = configuracion.pasos.find((item) => item.clave === nodoClave);
      if (!paso) continue;
      const actual = porNodo.get(nodoClave) ?? {
        version: 1 as const,
        nodoClave,
        pasoTenantId: paso.familiaCodigo,
        pasoNombre: paso.nombre,
        operaciones: [],
      };
      actual.operaciones.push(
        ...legacy.map((operacion, index) => ({
          ...operacion,
          activa: true,
          componentesCodigos: [componente.codigo],
          orden: actual.operaciones.length + index,
        })),
      );
      porNodo.set(nodoClave, actual);
    }
    return [...porNodo.values()];
  }

  private async validarPasosCompuestos(
    tenantId: string,
    pasosCompuestos: ConfiguracionPasoCompuesto[],
    configuracion: SnapshotConfiguracion,
    componentes: RecetaComponenteDto[],
    clavesNodo: Set<string>,
    exigirTodos: boolean,
  ) {
    const idsRuta = configuracion.pasos
      .map((item) => item.familiaCodigo)
      .filter((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        ),
      );
    const idsConsulta = [
      ...new Set([
        ...pasosCompuestos.map((item) => item.pasoTenantId),
        ...idsRuta,
      ]),
    ];
    if (!idsConsulta.length) return;
    const filas = await this.prisma.pasoTenant.findMany({
      where: {
        tenantId,
        id: { in: idsConsulta },
      },
      select: {
        id: true,
        nombre: true,
        tipoPaso: true,
        operacionesCompuestasJson: true,
      },
    });
    const porId = new Map(filas.map((item) => [item.id, item]));
    if (exigirTodos) {
      for (const nodo of configuracion.pasos) {
        const plantilla = porId.get(nodo.familiaCodigo);
        if (
          plantilla?.tipoPaso === 'COMPUESTO' &&
          !pasosCompuestos.some((item) => item.nodoClave === nodo.clave)
        ) {
          throw new BadRequestException(
            `La etapa compuesta "${nodo.nombre}" todavía no tiene sus pasos internos configurados en la BOM.`,
          );
        }
      }
    }
    const codigosComponentes = new Set(componentes.map((item) => item.codigo));
    const nodosVistos = new Set<string>();
    for (const paso of pasosCompuestos) {
      if (nodosVistos.has(paso.nodoClave)) {
        throw new BadRequestException(
          `El paso compuesto "${paso.pasoNombre}" está configurado más de una vez.`,
        );
      }
      nodosVistos.add(paso.nodoClave);
      if (!clavesNodo.has(paso.nodoClave)) {
        throw new BadRequestException(
          `El nodo compuesto "${paso.pasoNombre}" ya no existe en la ruta.`,
        );
      }
      const nodo = configuracion.pasos.find(
        (item) => item.clave === paso.nodoClave,
      );
      const plantilla = porId.get(paso.pasoTenantId);
      if (
        !nodo ||
        nodo.familiaCodigo !== paso.pasoTenantId ||
        plantilla?.tipoPaso !== 'COMPUESTO'
      ) {
        throw new BadRequestException(
          `"${paso.pasoNombre}" no corresponde a un paso compuesto vigente de esta ruta.`,
        );
      }
      const definiciones = leerDefinicionesPasoCompuesto(
        plantilla.operacionesCompuestasJson,
      );
      const definicionesPorCodigo = new Map(
        definiciones.map((item) => [item.codigo, item]),
      );
      if (paso.version === 2) {
        const internos = paso.pasos ?? [];
        for (const requerida of definiciones.filter((item) => item.requerida)) {
          if (
            !internos.some(
              (item) => item.codigo === requerida.codigo && item.activa,
            )
          ) {
            throw new BadRequestException(
              `El paso obligatorio "${requerida.nombre}" de "${paso.pasoNombre}" todavía no está configurado.`,
            );
          }
        }
        const codigosInternos = new Set(internos.map((item) => item.codigo));
        for (const interno of internos) {
          const definicion = definicionesPorCodigo.get(interno.codigo);
          if (
            !definicion ||
            definicion.familiaCodigo !== interno.familiaCodigo
          ) {
            throw new BadRequestException(
              `El paso interno "${interno.nombre}" ya no coincide con la subruta reutilizable de "${paso.pasoNombre}".`,
            );
          }
          for (const codigo of interno.componentesCodigos) {
            if (!codigosComponentes.has(codigo)) {
              throw new BadRequestException(
                `El paso "${interno.nombre}" referencia un componente que ya no existe.`,
              );
            }
          }
          if (
            interno.requiereCodigos.some(
              (codigo) => !codigosInternos.has(codigo),
            )
          ) {
            throw new BadRequestException(
              `El paso "${interno.nombre}" depende de otro paso interno que ya no existe.`,
            );
          }
          if (exigirTodos && interno.activa && this.configPasos) {
            await this.configPasos.validarConfiguracionBase(
              tenantId,
              interno.familiaCodigo,
              {
                ...(interno.configuracion as unknown as UpsertProductoConfigPasoDto),
                rutaPasoId: interno.codigo,
                requiereRutaPasoIds: [],
              },
            );
          }
        }
        continue;
      }
      for (const requerida of definiciones.filter((item) => item.requerida)) {
        if (
          !paso.operaciones.some(
            (item) => item.codigo === requerida.codigo && item.activa,
          )
        ) {
          throw new BadRequestException(
            `La operación obligatoria "${requerida.nombre}" de "${paso.pasoNombre}" todavía no está configurada.`,
          );
        }
      }
      for (const operacion of paso.operaciones) {
        if (!definicionesPorCodigo.has(operacion.codigo)) {
          throw new BadRequestException(
            `La operación "${operacion.nombre}" ya no existe en el paso reutilizable "${paso.pasoNombre}".`,
          );
        }
        for (const codigo of operacion.componentesCodigos) {
          if (!codigosComponentes.has(codigo)) {
            throw new BadRequestException(
              `La operación "${operacion.nombre}" referencia un componente que ya no existe.`,
            );
          }
        }
        const fuente = operacion.fuenteCantidad;
        if (
          fuente?.tipo === 'COMPONENTE' &&
          (!fuente.componenteCodigo ||
            !codigosComponentes.has(fuente.componenteCodigo))
        ) {
          throw new BadRequestException(
            `La fuente de "${operacion.nombre}" ya no pertenece a un componente de la BOM.`,
          );
        }
      }
    }
  }

  private encontrarRuta(producto: ProductoDetalle, rutaAlternativaId: string) {
    const ruta = producto.rutasAlternativas.find(
      (item) => item.id === rutaAlternativaId,
    );
    if (!ruta) {
      throw new BadRequestException(
        'La ruta alternativa no pertenece al producto o está inactiva.',
      );
    }
    return ruta;
  }

  private snapshotConfiguracion(
    producto: ProductoDetalle,
    ruta: RutaDetalle,
  ): SnapshotConfiguracion {
    const extras = ruta.pasosExtras;
    const pasosBase: PasoSnapshot[] = ruta.configPasos.map((paso, index) => ({
      clave: `ruta:${paso.rutaPasoId}`,
      nombre:
        paso.nombreVisible ??
        paso.rutaPaso?.nombreVisible ??
        paso.rutaPaso?.familiaNombre ??
        paso.rutaPaso?.familiaCodigo ??
        `Paso ${index + 1}`,
      familiaCodigo: paso.rutaPaso?.familiaCodigo ?? '',
      orden: paso.ordenFlujo ?? paso.rutaPaso?.orden ?? index,
      configuracion: jsonSeguro({
        modoActivacion: paso.modoActivacion,
        condicionActivacionJson: paso.condicionActivacionJson,
        modoTiempo: paso.modoTiempo,
        mecanismoCantidad: paso.mecanismoCantidad,
        mecanismoCantidadConfigJson: paso.mecanismoCantidadConfigJson,
        multiplicadoresActivos: [...paso.multiplicadoresActivos].sort(),
        paramsPasoJson: paso.paramsPasoJson,
        setupOverrideMin: paso.setupOverrideMin,
        cleanupOverrideMin: paso.cleanupOverrideMin,
        tiempoFijoOverrideMin: paso.tiempoFijoOverrideMin,
        requiereRutaPasoIds: [...paso.requiereRutaPasoIds].sort(),
        cargos: paso.cargosDirectosPaso,
        tercerizadoEntradas: paso.tercerizadoEntradas,
      }) as Record<string, unknown>,
      slots: paso.slotsMateriales.map(
        (slot) =>
          jsonSeguro({
            slotCodigo: slot.slotCodigo,
            slotNombre: slot.slotNombre,
            slotRol: slot.slotRol,
            modoSeleccion: slot.modoSeleccion,
            heredaDeRutaPasoId: slot.heredaDeRutaPasoId,
            heredaDeSlotCodigo: slot.heredaDeSlotCodigo,
            criterioMotorAuto: slot.criterioMotorAuto,
            criterioInputCampo: slot.criterioInputCampo,
            criterioMaterialCampo: slot.criterioMaterialCampo,
            criterioFiltroCampo: slot.criterioFiltroCampo,
            materialVarianteId: slot.materialVarianteId,
            materialVariante: slot.materialVariante,
            candidatos: slot.candidatos,
            formula: slot.formula,
            cantidadFactor: slot.cantidadFactor,
            cantidadBase: slot.cantidadBase,
            fuenteMedida: slot.fuenteMedida,
            mermaAdicionalPct: slot.mermaAdicionalPct,
            aplicaMultiCaras: slot.aplicaMultiCaras,
          }) as Record<string, unknown>,
      ),
      recurso: jsonSeguro({
        maquina: paso.maquinaM1,
        perfil: paso.perfilM1,
        centroCosto: paso.centroCosto,
        maquinasCandidatas: paso.maquinasCandidatas,
        dotacionOperarios: paso.dotacionOperarios,
        tercerizado: paso.tercerizado,
        proveedorId: paso.proveedorId,
        fuenteCostoTercerizado: paso.fuenteCostoTercerizado,
        tercerizadoConfigJson: paso.tercerizadoConfigJson,
        plazoProveedorDias: paso.plazoProveedorDias,
      }) as Record<string, unknown>,
    }));
    const pasosExtras: PasoSnapshot[] = extras.map((paso, index) => ({
      clave: `extra:${paso.id}`,
      nombre: paso.nombreVisible ?? paso.familiaCodigo,
      familiaCodigo: paso.familiaCodigo,
      orden: paso.ordenFlujo ?? 10000 + paso.ordenInterno + index,
      configuracion: jsonSeguro({
        modoActivacion: paso.modoActivacion,
        condicionActivacionJson: paso.condicionActivacionJson,
        modoTiempo: paso.modoTiempo,
        mecanismoCantidad: paso.mecanismoCantidad,
        paramsPasoJson: paso.paramsPasoJson,
        configCargosDirectosJson: paso.configCargosDirectosJson,
      }) as Record<string, unknown>,
      slots: (paso.slotsMateriales ?? []).map(
        (slot) => jsonSeguro(slot) as Record<string, unknown>,
      ),
      recurso: jsonSeguro({
        maquina: paso.maquinaM1,
        perfil: paso.perfilM1,
        centroCosto: paso.centroCosto,
        maquinasCandidatas: paso.maquinasCandidatas,
        dotacionOperarios: 1,
        tercerizado: false,
        proveedorId: null,
      }) as Record<string, unknown>,
    }));
    return {
      contractVersion: 1,
      producto: {
        id: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        unidadComercial: producto.unidadComercial,
        modoMedidas: producto.modoMedidas,
        dimensionesRequeridas: producto.dimensionesRequeridas,
        medidaDefaultAnchoMm: numero(producto.medidaDefaultAnchoMm, 0),
        medidaDefaultAltoMm: numero(producto.medidaDefaultAltoMm, 0),
        medidaDefaultProfundidadMm: numero(
          producto.medidaDefaultProfundidadMm,
          0,
        ),
        medidasPredefinidasJson: jsonSeguro(producto.medidasPredefinidasJson),
        atributosComercialesJson: jsonSeguro(producto.atributosComercialesJson),
      },
      ruta: {
        alternativaId: ruta.id,
        alternativaNombre: ruta.nombre,
        rutaId: ruta.rutaId,
        rutaVersion: ruta.rutaVersion,
        rutaCodigo: ruta.ruta.codigo,
        rutaNombre: ruta.ruta.nombre,
      },
      pasos: [...pasosBase, ...pasosExtras].sort(
        (a, b) => a.orden - b.orden || a.clave.localeCompare(b.clave),
      ),
      cargosCotizacion: jsonSeguro(
        producto.cargosDirectosCotizacion,
      ) as unknown[],
    };
  }

  private async plantillaInicialDesdeRuta(
    tenantId: string,
    ruta: RutaDetalle,
  ): Promise<{
    dependencias: Array<{ desdeClave: string; haciaClave: string }>;
    componentes: RecetaComponenteDto[];
  }> {
    const version = await this.prisma.rutaVersion.findFirst({
      where: {
        tenantId,
        rutaId: ruta.rutaId,
        version: ruta.rutaVersion,
      },
      select: { snapshotJson: true },
    });
    const workflow = leerWorkflowRuta(version?.snapshotJson, ruta.ruta.pasos);
    const tipos = new Map(
      workflow.nodos.map((nodo) => [nodo.clave, nodo.tipo]),
    );
    const dependencias = workflow.aristas.filter(
      (arista) =>
        tipos.get(arista.desdeClave) !== 'COMPONENTE' &&
        tipos.get(arista.haciaClave) !== 'COMPONENTE',
    );
    const componentes: RecetaComponenteDto[] = workflow.nodos
      .filter((nodo) => nodo.tipo === 'COMPONENTE')
      .map((nodo, index) => ({
        productoComponenteId: nodo.productoComponenteId,
        codigo: nodo.codigo,
        nombre: nodo.nombre,
        politicaEjecucion: 'INDEPENDIENTE',
        formula: 'por_unidad',
        cantidad: 1,
        unidad: 'unidad',
        requerido: nodo.requerido,
        configuracionJson: null,
        nodoIncorporacionClave:
          workflow.aristas.find((arista) => arista.desdeClave === nodo.clave)
            ?.haciaClave ?? null,
        nodosPredecesoresClaves: workflow.aristas
          .filter(
            (arista) =>
              arista.haciaClave === nodo.clave &&
              tipos.get(arista.desdeClave) !== 'COMPONENTE',
          )
          .map((arista) => arista.desdeClave),
        orden: index,
      }));
    return { dependencias, componentes };
  }

  /** Materializa las operaciones privadas de una etapa como pasos de cálculo
   * del snapshot. El motor los evalúa con toda la precisión del editor normal,
   * pero consolida el resultado antes de exponerlo a la OT y al Tablero. */
  private incorporarPasosInternos(
    configuracion: SnapshotConfiguracion,
    compuestos: ConfiguracionPasoCompuesto[],
  ): SnapshotConfiguracion {
    const internos: PasoSnapshot[] = [];
    for (const compuesto of compuestos) {
      if (compuesto.version !== 2) continue;
      const contenedor = configuracion.pasos.find(
        (item) => item.clave === compuesto.nodoClave,
      );
      for (const [index, paso] of (compuesto.pasos ?? [])
        .filter((item) => item.activa)
        .entries()) {
        const cfg = paso.configuracion;
        internos.push({
          clave: `${compuesto.nodoClave}:interno:${paso.codigo}`,
          nombre: paso.nombre,
          familiaCodigo: paso.familiaCodigo,
          orden: (contenedor?.orden ?? 10000) + (index + 1) / 1000,
          configuracion: jsonSeguro({
            ...cfg,
            contenedorClave: compuesto.nodoClave,
            pasoInternoCodigo: paso.codigo,
            componentesCodigos: paso.componentesCodigos,
            requiereCodigos: paso.requiereCodigos,
          }) as Record<string, unknown>,
          slots: Array.isArray(cfg.slotsMateriales)
            ? cfg.slotsMateriales.map(
                (slot) => jsonSeguro(slot) as Record<string, unknown>,
              )
            : [],
          recurso: jsonSeguro({
            maquina: cfg.maquinaM1Id ? { id: cfg.maquinaM1Id } : null,
            perfil: cfg.perfilM1Id ? { id: cfg.perfilM1Id } : null,
            centroCosto: cfg.centroCostoId ? { id: cfg.centroCostoId } : null,
            maquinasCandidatas: cfg.maquinasCandidatas ?? [],
            dotacionOperarios: cfg.dotacionOperarios ?? 1,
            tercerizado: cfg.tercerizado ?? false,
            proveedorId: cfg.proveedorId ?? null,
            fuenteCostoTercerizado: cfg.fuenteCostoTercerizado ?? null,
            tercerizadoConfigJson: cfg.tercerizadoConfigJson ?? null,
            plazoProveedorDias: cfg.plazoProveedorDias ?? null,
          }) as Record<string, unknown>,
        });
      }
    }
    return {
      ...configuracion,
      pasos: [...configuracion.pasos, ...internos].sort(
        (a, b) => a.orden - b.orden || a.clave.localeCompare(b.clave),
      ),
    };
  }

  private documentosCanonicos(documentos: RecetaDocumentoDto[]) {
    return documentos
      .map((item, index) => {
        const alcance =
          item.alcance ??
          (item.pasoClave
            ? AlcanceDocumentoProduccion.PASO
            : AlcanceDocumentoProduccion.ITEM);
        return {
          codigo: item.codigo.trim(),
          nombre: item.nombre.trim(),
          alcance,
          pasoClave:
            alcance === AlcanceDocumentoProduccion.PASO
              ? (item.pasoClave ?? null)
              : null,
          proposito: item.proposito,
          etapa: item.etapa,
          tipoAprobacion: item.tipoAprobacion ?? null,
          requerido: item.requerido ?? true,
          descripcion: item.descripcion ?? null,
          orden: item.orden ?? index,
        };
      })
      .sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo));
  }

  private componentesCanonicos(
    componentes: Array<
      RecetaComponenteDto & {
        recetaRevisionId?: string;
        recetaVersion?: number;
        recetaHuella?: string;
      }
    >,
  ) {
    return componentes
      .map((item, index) => ({
        productoComponenteId: item.productoComponenteId,
        recetaRevisionId: item.recetaRevisionId ?? null,
        recetaVersion: item.recetaVersion ?? null,
        recetaHuella: item.recetaHuella ?? null,
        codigo: item.codigo.trim(),
        nombre: item.nombre.trim(),
        politicaEjecucion: item.politicaEjecucion ?? 'INDEPENDIENTE',
        formula: item.formula ?? 'por_unidad',
        cantidad: Number(item.cantidad),
        unidad: item.unidad ?? 'unidad',
        requerido: item.requerido ?? true,
        configuracionJson:
          item.configuracionJson == null
            ? null
            : jsonSeguro(item.configuracionJson),
        nodoIncorporacionClave: item.nodoIncorporacionClave ?? null,
        ...((item.nodosPredecesoresClaves?.length ?? 0) > 0
          ? { nodosPredecesoresClaves: item.nodosPredecesoresClaves }
          : {}),
        orden: item.orden ?? index,
      }))
      .sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo));
  }

  private async componentesConRevisionActual(
    tenantId: string,
    componentes: RecetaComponenteDto[],
    pasosCompuestos: ConfiguracionPasoCompuesto[] = [],
    opciones: { actualizarSnapshotsPricing?: boolean } = {},
  ) {
    if (!componentes.length) return [];
    const ids = [
      ...new Set(componentes.map((item) => item.productoComponenteId)),
    ];
    const recetas = await this.prisma.productoReceta.findMany({
      where: {
        tenantId,
        productoId: { in: ids },
        activo: true,
        revisionPublicadaId: { not: null },
      },
      select: {
        productoId: true,
        producto: { select: { precioConfigJson: true } },
        revisionPublicada: {
          select: {
            id: true,
            numero: true,
            huellaConfiguracion: true,
            snapshotJson: true,
          },
        },
      },
    });
    const porProducto = new Map(
      recetas.flatMap((receta) =>
        receta.revisionPublicada
          ? [[receta.productoId, receta.revisionPublicada] as const]
          : [],
      ),
    );
    const precioPorProducto = new Map(
      recetas.map((receta) => [
        receta.productoId,
        receta.producto.precioConfigJson,
      ]),
    );
    const componentePorCodigo = new Map(
      componentes.map((item) => [item.codigo, item]),
    );
    for (const item of componentes) {
      const configuracion = leerConfiguracionComponente(item.configuracionJson);
      for (const binding of configuracion?.bindings ?? []) {
        const fuente = binding.regla?.fuente;
        if (fuente?.tipo !== 'COMPONENTE' || !fuente.componenteCodigo) {
          continue;
        }
        const componenteFuente = componentePorCodigo.get(
          fuente.componenteCodigo,
        );
        const revisionFuente = componenteFuente
          ? porProducto.get(componenteFuente.productoComponenteId)
          : null;
        const snapshot = revisionFuente?.snapshotJson;
        const pasos =
          snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
            ? (snapshot as Record<string, unknown>).pasos
            : null;
        const catalogo = catalogoSalidasPublicasComposicion(
          Array.isArray(pasos)
            ? pasos.flatMap((paso) => {
                if (!paso || typeof paso !== 'object' || Array.isArray(paso)) {
                  return [];
                }
                const value = paso as Record<string, unknown>;
                return typeof value.familiaCodigo === 'string'
                  ? [
                      {
                        familiaCodigo: value.familiaCodigo,
                        nombreVisible:
                          typeof value.nombre === 'string'
                            ? value.nombre
                            : null,
                      },
                    ]
                  : [];
              })
            : [],
        );
        if (!catalogo.some((output) => output.clave === fuente.campo)) {
          throw new BadRequestException(
            `El componente "${item.nombre}" usa el dato "${fuente.campo}" de "${componenteFuente?.nombre ?? fuente.componenteCodigo}", pero ese producto no lo publica en su receta vigente.`,
          );
        }
      }
      for (const operacion of configuracion?.operacionesIncorporacion ?? []) {
        const fuente = operacion.fuenteCantidad;
        if (fuente?.tipo !== 'COMPONENTE' || !fuente.componenteCodigo) {
          continue;
        }
        const componenteFuente = componentePorCodigo.get(
          fuente.componenteCodigo,
        );
        if (item.requerido !== false && componenteFuente?.requerido === false) {
          throw new BadRequestException(
            `La incorporación requerida de "${item.nombre}" no puede depender del componente opcional "${componenteFuente.nombre}".`,
          );
        }
        const revisionFuente = componenteFuente
          ? porProducto.get(componenteFuente.productoComponenteId)
          : null;
        const snapshot = revisionFuente?.snapshotJson;
        const pasos =
          snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
            ? (snapshot as Record<string, unknown>).pasos
            : null;
        const catalogo = catalogoSalidasPublicasComposicion(
          Array.isArray(pasos)
            ? pasos.flatMap((paso) => {
                if (!paso || typeof paso !== 'object' || Array.isArray(paso)) {
                  return [];
                }
                const value = paso as Record<string, unknown>;
                return typeof value.familiaCodigo === 'string'
                  ? [
                      {
                        familiaCodigo: value.familiaCodigo,
                        nombreVisible:
                          typeof value.nombre === 'string'
                            ? value.nombre
                            : null,
                      },
                    ]
                  : [];
              })
            : [],
        );
        if (!catalogo.some((output) => output.clave === fuente.campo)) {
          throw new BadRequestException(
            `La operación "${operacion.nombre}" usa el dato "${fuente.campo}" de "${componenteFuente?.nombre ?? fuente.componenteCodigo}", pero ese producto no lo publica en su receta vigente.`,
          );
        }
      }
    }
    for (const paso of pasosCompuestos) {
      for (const operacion of paso.operaciones.filter((item) => item.activa)) {
        const fuente = operacion.fuenteCantidad;
        if (fuente?.tipo !== 'COMPONENTE' || !fuente.componenteCodigo) {
          continue;
        }
        const componenteFuente = componentePorCodigo.get(
          fuente.componenteCodigo,
        );
        const revisionFuente = componenteFuente
          ? porProducto.get(componenteFuente.productoComponenteId)
          : null;
        const snapshot = revisionFuente?.snapshotJson;
        const pasos =
          snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
            ? (snapshot as Record<string, unknown>).pasos
            : null;
        const catalogo = catalogoSalidasPublicasComposicion(
          Array.isArray(pasos)
            ? pasos.flatMap((pasoSnapshot) => {
                if (
                  !pasoSnapshot ||
                  typeof pasoSnapshot !== 'object' ||
                  Array.isArray(pasoSnapshot)
                ) {
                  return [];
                }
                const value = pasoSnapshot as Record<string, unknown>;
                return typeof value.familiaCodigo === 'string'
                  ? [
                      {
                        familiaCodigo: value.familiaCodigo,
                        nombreVisible:
                          typeof value.nombre === 'string'
                            ? value.nombre
                            : null,
                      },
                    ]
                  : [];
              })
            : [],
        );
        if (!catalogo.some((output) => output.clave === fuente.campo)) {
          throw new BadRequestException(
            `La operación "${operacion.nombre}" usa el dato "${fuente.campo}" de "${componenteFuente?.nombre ?? fuente.componenteCodigo}", pero ese producto no lo publica en su receta vigente.`,
          );
        }
      }
    }
    return componentes.map((item) => {
      const revision = porProducto.get(item.productoComponenteId);
      if (!revision) {
        throw new BadRequestException(
          `El componente ${item.nombre} debe tener una receta publicada.`,
        );
      }
      return {
        ...item,
        recetaRevisionId: revision.id,
        recetaVersion: revision.numero,
        recetaHuella: revision.huellaConfiguracion,
        configuracionJson: congelarPoliticaPricingComponente({
          configuracionJson: item.configuracionJson,
          precioConfigHijo: precioPorProducto.get(item.productoComponenteId),
          actualizarSnapshot: opciones.actualizarSnapshotsPricing === true,
          componenteNombre: item.nombre,
        }),
      };
    });
  }

  private materialesDesdeSnapshot(
    snapshot: SnapshotConfiguracion & {
      documentos: unknown[];
      componentes: unknown[];
    },
    variantes: Map<string, VarianteMaterialReferencia>,
  ) {
    return snapshot.pasos.flatMap((paso) =>
      paso.slots.map((slot, index) => {
        const materialVariante =
          slot.materialVariante && typeof slot.materialVariante === 'object'
            ? (slot.materialVariante as Record<string, unknown>)
            : null;
        const materiaPrima =
          materialVariante?.materiaPrima &&
          typeof materialVariante.materiaPrima === 'object'
            ? (materialVariante.materiaPrima as Record<string, unknown>)
            : null;
        const varianteId =
          typeof slot.materialVarianteId === 'string'
            ? slot.materialVarianteId
            : null;
        const varianteCatalogo = varianteId
          ? (variantes.get(varianteId) ?? null)
          : null;
        return {
          pasoClave: paso.clave,
          pasoNombre: paso.nombre,
          slotCodigo: String(slot.slotCodigo ?? `slot_${index}`),
          slotNombre:
            typeof slot.slotNombre === 'string' ? slot.slotNombre : null,
          rol: typeof slot.slotRol === 'string' ? slot.slotRol : null,
          modoSeleccion: String(slot.modoSeleccion ?? 'HARDCODED'),
          materialVarianteId: varianteId,
          materialSku:
            varianteCatalogo?.sku ??
            (typeof materialVariante?.sku === 'string'
              ? materialVariante.sku
              : null),
          materialNombre:
            varianteCatalogo?.nombre ??
            (typeof materiaPrima?.nombre === 'string'
              ? materiaPrima.nombre
              : typeof materialVariante?.nombreVariante === 'string'
                ? materialVariante.nombreVariante
                : null),
          unidad: varianteCatalogo?.unidad ?? null,
          formula: String(slot.formula ?? 'por_unidad_productiva'),
          cantidadBase:
            typeof slot.cantidadBase === 'string' ? slot.cantidadBase : null,
          cantidadFactor:
            slot.cantidadFactor == null ? null : numero(slot.cantidadFactor, 1),
          fuenteMedida:
            typeof slot.fuenteMedida === 'string' ? slot.fuenteMedida : null,
          mermaAdicionalPct: numero(slot.mermaAdicionalPct, 0),
          aplicaMultiCaras: slot.aplicaMultiCaras === true,
          seleccionSnapshotJson: jsonSeguro({
            candidatos: slot.candidatos ?? [],
            heredaDeRutaPasoId: slot.heredaDeRutaPasoId ?? null,
            heredaDeSlotCodigo: slot.heredaDeSlotCodigo ?? null,
            criterioMotorAuto: slot.criterioMotorAuto ?? null,
            criterioInputCampo: slot.criterioInputCampo ?? null,
            criterioMaterialCampo: slot.criterioMaterialCampo ?? null,
          }) as Prisma.InputJsonValue,
          orden: paso.orden * 1000 + index,
        };
      }),
    );
  }

  private recursosDesdeSnapshot(
    snapshot: SnapshotConfiguracion & {
      documentos: unknown[];
      componentes: unknown[];
    },
  ) {
    return snapshot.pasos.map((paso) => {
      const recurso = paso.recurso;
      const maquina =
        recurso.maquina && typeof recurso.maquina === 'object'
          ? (recurso.maquina as Record<string, unknown>)
          : null;
      const perfil =
        recurso.perfil && typeof recurso.perfil === 'object'
          ? (recurso.perfil as Record<string, unknown>)
          : null;
      const estacion =
        maquina?.estacion && typeof maquina.estacion === 'object'
          ? (maquina.estacion as Record<string, unknown>)
          : null;
      const centro =
        recurso.centroCosto && typeof recurso.centroCosto === 'object'
          ? (recurso.centroCosto as Record<string, unknown>)
          : maquina?.centroCostoPrincipal &&
              typeof maquina.centroCostoPrincipal === 'object'
            ? (maquina.centroCostoPrincipal as Record<string, unknown>)
            : null;
      const paramsPaso =
        paso.configuracion.paramsPasoJson &&
        typeof paso.configuracion.paramsPasoJson === 'object'
          ? (paso.configuracion.paramsPasoJson as Record<string, unknown>)
          : null;
      const habilidadesRequeridas = Array.isArray(
        paramsPaso?.habilidadesRequeridas,
      )
        ? paramsPaso.habilidadesRequeridas
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean)
        : [];
      return {
        pasoClave: paso.clave,
        pasoNombre: paso.nombre,
        familiaCodigo: paso.familiaCodigo,
        maquinaId: typeof maquina?.id === 'string' ? maquina.id : null,
        maquinaCodigo:
          typeof maquina?.codigo === 'string' ? maquina.codigo : null,
        maquinaNombre:
          typeof maquina?.nombre === 'string' ? maquina.nombre : null,
        estacionId: typeof estacion?.id === 'string' ? estacion.id : null,
        estacionNombre:
          typeof estacion?.nombre === 'string' ? estacion.nombre : null,
        perfilId: typeof perfil?.id === 'string' ? perfil.id : null,
        perfilNombre: typeof perfil?.nombre === 'string' ? perfil.nombre : null,
        centroCostoId: typeof centro?.id === 'string' ? centro.id : null,
        centroCostoCodigo:
          typeof centro?.codigo === 'string' ? centro.codigo : null,
        centroCostoNombre:
          typeof centro?.nombre === 'string' ? centro.nombre : null,
        dotacionOperarios: Math.max(1, numero(recurso.dotacionOperarios, 1)),
        tercerizado: recurso.tercerizado === true,
        proveedorId:
          typeof recurso.proveedorId === 'string' ? recurso.proveedorId : null,
        proveedorNombre: null,
        capacidadesSnapshotJson: jsonSeguro({
          parametrosTecnicos: maquina?.parametrosTecnicosJson ?? null,
          capacidadesAvanzadas: maquina?.capacidadesAvanzadasJson ?? null,
          perfilDetalle: perfil?.detalleJson ?? null,
        }) as Prisma.InputJsonValue,
        habilidadesRequeridas,
        configuracionSnapshotJson: jsonSeguro(recurso) as Prisma.InputJsonValue,
        orden: paso.orden,
      };
    });
  }

  private async recursosConEstaciones<
    T extends {
      familiaCodigo: string;
      maquinaId: string | null;
      estacionId: string | null;
      estacionNombre: string | null;
    },
  >(tenantId: string, recursos: T[]): Promise<T[]> {
    const sinEstacion = recursos.filter((recurso) => !recurso.estacionId);
    if (!sinEstacion.length) return recursos;
    const maquinas = sinEstacion
      .map((recurso) => recurso.maquinaId)
      .filter((id): id is string => Boolean(id));
    const familias = [
      ...new Set(sinEstacion.map((recurso) => recurso.familiaCodigo)),
    ];
    const [reglas, legacy] = await Promise.all([
      this.prisma.estacionRegla.findMany({
        where: {
          tenantId,
          OR: [
            { tipo: 'maquina', valor: { in: maquinas } },
            { tipo: 'familia', valor: { in: familias } },
          ],
          estacion: { activo: true },
        },
        include: { estacion: { select: { id: true, nombre: true } } },
      }),
      this.prisma.estacionFamilia.findMany({
        where: {
          tenantId,
          familiaCodigo: { in: familias },
          estacion: { activo: true },
        },
        include: { estacion: { select: { id: true, nombre: true } } },
      }),
    ]);
    const porMaquina = new Map(
      reglas
        .filter((regla) => regla.tipo === 'maquina')
        .map((regla) => [regla.valor, regla.estacion] as const),
    );
    const porFamilia = new Map(
      reglas
        .filter((regla) => regla.tipo === 'familia')
        .map((regla) => [regla.valor, regla.estacion] as const),
    );
    const porFamiliaLegacy = new Map(
      legacy.map((item) => [item.familiaCodigo, item.estacion] as const),
    );
    return recursos.map((recurso) => {
      if (recurso.estacionId) return recurso;
      const estacion =
        (recurso.maquinaId ? porMaquina.get(recurso.maquinaId) : null) ??
        porFamilia.get(recurso.familiaCodigo) ??
        porFamiliaLegacy.get(recurso.familiaCodigo);
      return estacion
        ? {
            ...recurso,
            estacionId: estacion.id,
            estacionNombre: estacion.nombre,
          }
        : recurso;
    });
  }

  private async unidadesVariantes(
    tenantId: string,
    snapshot: SnapshotConfiguracion,
  ) {
    const ids = new Set<string>();
    for (const paso of snapshot.pasos) {
      for (const slot of paso.slots) {
        for (const id of this.idsVariantesSlot(slot)) ids.add(id);
      }
    }
    if (!ids.size) return new Map<string, VarianteMaterialReferencia>();
    const variantes = await this.prisma.materiaPrimaVariante.findMany({
      where: {
        tenantId,
        id: { in: [...ids] },
        materiaPrima: { tenantId },
      },
      select: {
        id: true,
        sku: true,
        nombreVariante: true,
        unidadStock: true,
        materiaPrima: { select: { nombre: true, unidadStock: true } },
      },
    });
    return new Map(
      variantes.map((item) => [
        item.id,
        {
          unidad: item.unidadStock ?? item.materiaPrima.unidadStock,
          sku: item.sku,
          nombre: item.nombreVariante
            ? `${item.materiaPrima.nombre} · ${item.nombreVariante}`
            : item.materiaPrima.nombre,
        },
      ]),
    );
  }

  private async validarReferenciasBorrador(
    tenantId: string,
    productoId: string,
    documentos: RecetaDocumentoDto[],
    componentes: RecetaComponenteDto[],
    clavesPaso: Set<string>,
  ) {
    const codigosDocumentos = new Set<string>();
    for (const item of documentos) {
      const codigo = item.codigo.trim().toLowerCase();
      if (codigosDocumentos.has(codigo)) {
        throw new BadRequestException(`Documento duplicado: ${item.codigo}.`);
      }
      codigosDocumentos.add(codigo);
      const alcance =
        item.alcance ??
        (item.pasoClave
          ? AlcanceDocumentoProduccion.PASO
          : AlcanceDocumentoProduccion.ITEM);
      if (alcance === AlcanceDocumentoProduccion.PASO) {
        if (!item.pasoClave || !clavesPaso.has(item.pasoClave)) {
          throw new BadRequestException(
            `El documento "${item.nombre}" debe apuntar a un paso vigente de la ruta.`,
          );
        }
      } else if (item.pasoClave) {
        throw new BadRequestException(
          `El documento "${item.nombre}" no puede conservar un paso cuando su alcance es ${alcance.toLowerCase()}.`,
        );
      }
    }
    const codigosComponentes = new Set<string>();
    for (const item of componentes) {
      validarConfiguracionComponente(item.configuracionJson, item.nombre);
      validarPoliticaPricingComponente(item.configuracionJson, item.nombre);
      if (item.productoComponenteId === productoId) {
        throw new BadRequestException(
          'Un producto no puede ser componente de sí mismo.',
        );
      }
      const codigo = item.codigo.trim().toLowerCase();
      if (codigosComponentes.has(codigo)) {
        throw new BadRequestException(`Componente duplicado: ${item.codigo}.`);
      }
      codigosComponentes.add(codigo);
    }
    ordenarComponentesPorCalculo(componentes);
    const ids = [
      ...new Set(componentes.map((item) => item.productoComponenteId)),
    ];
    if (ids.length) {
      const encontrados = await this.prisma.producto.count({
        where: { tenantId, id: { in: ids }, activo: true },
      });
      if (encontrados !== ids.length) {
        throw new BadRequestException(
          'Uno o más componentes no existen, están inactivos o pertenecen a otra empresa.',
        );
      }
    }
  }

  private async validarCiclos(
    tenantId: string,
    productoRaizId: string,
    componentesIniciales: string[],
  ) {
    const visitar = async (
      productoId: string,
      camino: string[],
      profundidad: number,
    ): Promise<void> => {
      if (profundidad > 12) {
        throw new BadRequestException(
          'La composición supera la profundidad máxima de 12 niveles.',
        );
      }
      if (camino.includes(productoId)) {
        throw new BadRequestException(
          'La receta contiene un ciclo de componentes fabricados.',
        );
      }
      const receta = await this.prisma.productoReceta.findFirst({
        where: { tenantId, productoId, revisionPublicadaId: { not: null } },
        include: {
          revisionPublicada: {
            include: { componentes: { where: { requerido: true } } },
          },
        },
      });
      if (!receta?.revisionPublicada) {
        throw new BadRequestException(
          'Todo componente fabricado debe tener una receta publicada.',
        );
      }
      for (const hijo of receta.revisionPublicada.componentes) {
        await visitar(
          hijo.productoComponenteId,
          [...camino, productoId],
          profundidad + 1,
        );
      }
    };
    for (const componenteId of componentesIniciales) {
      await visitar(componenteId, [productoRaizId], 1);
    }
  }

  private validarUnidades(
    snapshot: SnapshotConfiguracion,
    variantes: Map<string, VarianteMaterialReferencia>,
  ) {
    for (const paso of snapshot.pasos) {
      for (const slot of paso.slots) {
        const formula = String(slot.formula ?? '');
        const unidadesSlot = new Set(
          this.idsVariantesSlot(slot)
            .map((id) => variantes.get(id)?.unidad)
            .filter((item): item is UnidadMateriaPrima => Boolean(item)),
        );
        const esperada =
          formula === 'por_m2'
            ? UnidadMateriaPrima.M2
            : formula === 'por_metro_lineal'
              ? UnidadMateriaPrima.METRO_LINEAL
              : null;
        if (esperada) {
          const incompatibles = [...unidadesSlot].filter(
            (unidad) => unidad !== esperada,
          );
          if (incompatibles.length) {
            throw new BadRequestException(
              `${paso.nombre} / ${String(slot.slotCodigo)} usa ${formula.replaceAll('_', ' ')} con variante(s) en ${incompatibles.join(', ')}.`,
            );
          }
        }
      }
    }
  }

  private idsVariantesSlot(slot: Record<string, unknown>): string[] {
    const ids = new Set<string>();
    if (typeof slot.materialVarianteId === 'string') {
      ids.add(slot.materialVarianteId);
    }
    const candidatos = Array.isArray(slot.candidatos) ? slot.candidatos : [];
    for (const candidatoRaw of candidatos) {
      if (!candidatoRaw || typeof candidatoRaw !== 'object') continue;
      const candidato = candidatoRaw as Record<string, unknown>;
      if (typeof candidato.defaultVarianteId === 'string') {
        ids.add(candidato.defaultVarianteId);
      }
      const variantes = Array.isArray(candidato.variantes)
        ? candidato.variantes
        : [];
      for (const varianteRaw of variantes) {
        if (!varianteRaw || typeof varianteRaw !== 'object') continue;
        const varianteContenedor = varianteRaw as Record<string, unknown>;
        const variante =
          varianteContenedor.variante &&
          typeof varianteContenedor.variante === 'object'
            ? (varianteContenedor.variante as Record<string, unknown>)
            : varianteContenedor;
        if (typeof variante.id === 'string') ids.add(variante.id);
      }
    }
    return [...ids];
  }

  private async actorNombre(auth: CurrentAuth) {
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      select: { nombreCompleto: true, email: true },
    });
    return firmaActor(
      auth,
      user?.nombreCompleto?.trim() || user?.email || auth.email,
    );
  }
}
