import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MAQUINA_DISPONIBLE_WHERE } from '../maquinaria/maquinaria-disponibilidad';
import {
  esImpresionDeFamilia,
  familiaPublicaOutput,
} from '../productos-servicios/pasos/familias';
import { MotorUniversalService } from '../motor-universal/motor.service';
import { seleccionarMenorCapacidadQueCumpla } from '../motor-universal/seleccion-capacidad';
import type { CotizarOutput } from '../motor-universal/tipos';
import {
  NIVEL_COBERTURA_LABELS,
  normalizarNivelCobertura,
} from '../productos-servicios/cobertura-toner';
import {
  provisionarPlantillaCentroCopiado,
  CC_PRODUCTO_CODIGO,
} from './provisionar-plantilla';
import { dataCotizacionItemTomo } from './persistencia-tomo';
import {
  calcularHojas,
  construirSegmento,
  resolverVariantePapel,
  variantesCubre,
  pliegoDeDoc,
  DocumentoInput,
  PlantillaContexto,
  VariantePapel,
} from './adaptador';
import { PliegoDim } from './pliegos';

/**
 * Heurística de FALLBACK (cuando el tenant no eligió las tapas en Configuración):
 * una tapa es "frontal" si es transparente, si no es contratapa (plástica de
 * color). Tanto la tapa como la contratapa son plásticas (PP/PVC), así que la
 * distinción NO es por material sino por transparencia (nombre/colorBase). La
 * fuente de verdad es la config del tenant; esto sólo destraba el out-of-box.
 */
const TAPA_TRANSPARENTE_RX = /transp|cristal/i;
function esTapaFrontalDetect(
  ...textos: Array<string | null | undefined>
): boolean {
  return TAPA_TRANSPARENTE_RX.test(textos.filter(Boolean).join(' '));
}

/** Un tipo de papel (materia prima) con sus variantes y gramajes disponibles. */
interface PapelTipo {
  materiaPrimaId: string;
  nombre: string;
  gramajes: number[];
  variantes: VariantePapel[];
}

type CentroCopiadoDb = PrismaService | Prisma.TransactionClient;

/** Contexto del plantilla + papeles disponibles (resueltos por request). */
type Ctx = PlantillaContexto & {
  papeles: PapelTipo[];
  /** configPaso del anillado opcional (Etapa C); null = no está en la ruta. */
  anilladoConfigPasoId: string | null;
  /** Anillos instalados, para etiquetar el Ø elegido por capacidad y tipo. */
  anillos: Array<{
    tipoAnillo: string;
    diametroMm: number;
    capacidadMaxHojas: number;
  }>;
  /** Tipos de anillado habilitados por el configurador del tenant. */
  tiposAnilloPermitidos: string[];
  /**
   * Tapas de encuadernación instaladas (frontal transparente + contratapa
   * cartón). El anillado siempre las incluye; se resuelve por tamaño del
   * documento la variante que cubre (menor área) para cada rol.
   */
  tapas: Array<{
    materiaPrimaId: string;
    nombre: string;
    esFrontal: boolean;
    variantes: Array<{
      id: string;
      anchoMm: number | null;
      altoMm: number | null;
    }>;
  }>;
  /** Materia prima elegida en Configuración para cada rol (null = auto/heurística). */
  tapaFrontalMpId: string | null;
  tapaContratapaMpId: string | null;
};

/** Papel ofrecido en la config: el tipo y, opcional, sus gramajes ofrecidos. */
type PapelConfig = { materiaPrimaId: string; gramajes?: number[] };

import {
  AgregarAOrdenCentroCopiadoDto,
  CotizarCentroCopiadoDto,
  GrupoCentroCopiadoDto,
} from './dto/cotizar-centro-copiado.dto';
import { ActualizarCentroCopiadoConfigDto } from './dto/centro-copiado-config.dto';
import {
  CENTRO_COPIADO_TERMINACIONES,
  CENTRO_COPIADO_FORMATOS,
  CENTRO_COPIADO_TERMINACIONES_CATALOGO,
  CENTRO_COPIADO_TIPOS_ANILLO,
  errorEstructuraCargaCentroCopiado,
  metaDocumentoCentroCopiado,
  metaTomoCentroCopiado,
} from './centro-copiado.domain';
import { CentroCopiadoAuditoriaService } from './centro-copiado-auditoria.service';
import { CentroCopiadoIdempotenciaService } from './centro-copiado-idempotencia.service';

export interface DocumentoResultado {
  id: string;
  grupoId: string | null;
  carillas: number;
  hojas: number;
  pliegos: number;
  subtotal: number;
  iva: number;
  total: number;
  /** Anillado del doc SUELTO (cada copia = 1 libro); null si no aplica. */
  anillado: AnilladoResultado | null;
  error: string | null;
}

/** Etiquetas legibles de los tipos de anillo. */
const TIPO_ANILLO_LABELS: Record<string, string> = {
  ESPIRAL_PLASTICO: 'Espiral plástico',
  WIRE_O: 'Wire-O',
};
const labelTipoAnillo = (t: string) =>
  TIPO_ANILLO_LABELS[t] ?? (t ? t.replaceAll('_', ' ') : 'Anillo');

/** Línea de anillado de un tomo: 1 anillo × juegos + tiempo de anilladora. */
export interface AnilladoResultado {
  subtotal: number;
  iva: number;
  total: number;
  /** Tipo de anillo cotizado (ESPIRAL_PLASTICO | WIRE_O). */
  tipoAnillo: string;
  /** Ø del anillo elegido (menor capacidad que cubre las hojas); null si no se pudo. */
  diametroMm: number | null;
  /** Motivo cuando no se cotizó (sin anilladora, sin anillo que cubra, etc.). */
  error: string | null;
}

export interface GrupoResultado {
  id: string;
  juegos: number;
  /** Hojas físicas por un solo juego del tomo (para el anillado, cuando aplique). */
  hojasPorLibro: number;
  subtotal: number;
  iva: number;
  total: number;
  /** Anillado del tomo (cuando la terminación está activa y hay anilladora). */
  anillado: AnilladoResultado | null;
  error: string | null;
}

export interface CotizarCentroCopiadoResultado {
  documentos: DocumentoResultado[];
  grupos: GrupoResultado[];
  totales: {
    documentos: number;
    tomos: number;
    carillas: number;
    hojasFisicas: number;
    subtotal: number;
    iva: number;
    total: number;
  };
}

export interface ItemAgregado {
  documentoId: string;
  cotizacionItemId: string | null;
  grupoTomoId: string | null;
  nombre: string | null;
  carillas: number;
  hojas: number;
  subtotal: number;
  iva: number;
  total: number;
  error: string | null;
}

export interface AgregarAOrdenResultado {
  cotizacionId: string;
  grupoCargaId: string;
  items: ItemAgregado[];
  totales: CotizarCentroCopiadoResultado['totales'];
}

/** Payload por documento para construir un PropuestaItem en el front (staging). */
export interface ItemConstruido {
  documentoId: string;
  grupoTomoId: string | null;
  nombre: string;
  productoId: string;
  jobContext: Record<string, unknown>;
  especificaciones: Record<string, string>;
  cantidad: number;
  /** Unidad comercial del renglón: "libros" cuando anilla, "hojas" si no. */
  unidad: string;
  precioUnitario: number;
  subtotal: number;
  impuestoPorcentaje: number;
  impuestoMonto: number;
  total: number;
  cotizacion: NonNullable<CotizarOutput['cotizacion']> | null;
  error: string | null;
}

export interface ConstruirItemsResultado {
  grupoCargaId: string;
  items: ItemConstruido[];
}

const suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const redondear = (n: number) => Math.round(n * 100) / 100;

type PoliticaPrecioCentroCopiado = 'MARGEN_FIJO' | 'MARGEN_POR_VOLUMEN';
type TramoMargenCentroCopiado = {
  desdeCantidad: number;
  margenPct: number;
};

const CANTIDAD_MAXIMA_TRAMO = 1_000_000_000;

function tramosDesdeDetallePrecio(
  detalle: Record<string, unknown>,
): TramoMargenCentroCopiado[] {
  const explicitos = detalle.tramosDesde;
  if (Array.isArray(explicitos)) {
    const validos = explicitos
      .map((tramo) => {
        const t = tramo as Record<string, unknown>;
        return {
          desdeCantidad: Number(t.desdeCantidad),
          margenPct: Number(t.margenPct),
        };
      })
      .filter(
        (t) =>
          Number.isFinite(t.desdeCantidad) &&
          t.desdeCantidad >= 1 &&
          Number.isFinite(t.margenPct),
      );
    if (validos.length)
      return validos.sort((a, b) => a.desdeCantidad - b.desdeCantidad);
  }
  const tiers = detalle.tiers;
  if (!Array.isArray(tiers)) return [];
  let desdeCantidad = 1;
  return tiers.map((tier) => {
    const t = tier as Record<string, unknown>;
    const actual = {
      desdeCantidad,
      margenPct: Number(t.marginPct ?? 0),
    };
    desdeCantidad = Number(t.quantityUntil ?? desdeCantidad) + 1;
    return actual;
  });
}

function tiersMotorDesdeTramos(tramos: TramoMargenCentroCopiado[]) {
  const ordenados = [...tramos].sort(
    (a, b) => a.desdeCantidad - b.desdeCantidad,
  );
  return ordenados.map((tramo, index) => ({
    quantityUntil:
      index < ordenados.length - 1
        ? ordenados[index + 1].desdeCantidad - 1
        : CANTIDAD_MAXIMA_TRAMO,
    marginPct: tramo.margenPct,
  }));
}

/**
 * El paso de IMPRESIÓN de la ruta de CC. Desde la Etapa C la ruta puede tener un
 * 2º paso opcional (encuadernado_anillado), así que no vale asumir `configPasos[0]`.
 */
function pasoImpresion<
  T extends { rutaPaso?: { familiaCodigo?: string | null } | null },
>(configPasos: T[] | undefined | null): T | null {
  if (!configPasos?.length) return null;
  // [Tanda D] "El paso que imprime" se busca por capacidad declarada
  // (esImpresion), no por nombre de familia.
  return (
    configPasos.find((c) =>
      esImpresionDeFamilia(c.rutaPaso?.familiaCodigo ?? ''),
    ) ?? configPasos[0]
  );
}

/**
 * Terminaciones (pasos opcionales) que ofrece el centro de copiado. Hoy sólo
 * Anillado (sin costo hasta que el taller cargue anilladora + anillos). Cuando
 * la ruta de la plantilla tenga pasos opcionales reales (plastificado, etc.),
 * esta lista saldrá de ahí y cada terminación activará su paso con costo.
 */
const TERMINACIONES_DISPONIBLES: readonly string[] =
  CENTRO_COPIADO_TERMINACIONES;

@Injectable()
export class CentroCopiadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly motor: MotorUniversalService,
    private readonly auditoria?: CentroCopiadoAuditoriaService,
    private readonly idempotencia?: CentroCopiadoIdempotenciaService,
  ) {}

  /**
   * Opciones para el modal: TIPOS de papel + gramajes + las variantes (formato y
   * medidas) de cada tipo. El front cruza las variantes con el catálogo de
   * formatos del sistema para ofrecer por fila SÓLO los tamaños producibles.
   */
  async opciones(tenantId: string): Promise<{
    papeles: {
      materiaPrimaId: string;
      nombre: string;
      gramajes: number[];
      variantes: {
        formatoComercial: string | null;
        anchoMm: number | null;
        altoMm: number | null;
        gramajeGr: number | null;
      }[];
    }[];
    papelDefaultId: string | null;
    terminaciones: string[];
    /** Tipos de anillo instalados (para el selector cuando hay Anillado). */
    tiposAnillo: { value: string; label: string }[];
    /** Nombres de formato ofrecidos; null = todos los producibles. */
    tamanosOfrecidos: string[] | null;
    /** El tenant tiene el módulo activo. */
    activo: boolean;
  }> {
    const ctx = await this.contexto(tenantId);
    const config = await this.configDe(tenantId);
    // La config es CURACIÓN opcional: papelesJson null = todos los papeles; si
    // trae una lista, sólo esos (y, si el papel fija gramajes, sólo esos).
    const papelesCfg = (config.papelesJson as PapelConfig[] | null) ?? null;
    const permitido = papelesCfg
      ? new Map(papelesCfg.map((c) => [c.materiaPrimaId, c.gramajes ?? null]))
      : null;
    const papeles = (
      permitido
        ? ctx.papeles.filter((p) => permitido.has(p.materiaPrimaId))
        : ctx.papeles
    ).map((p) => {
      const gramajesOk = permitido?.get(p.materiaPrimaId) ?? null;
      const usaFiltro = !!gramajesOk?.length;
      return {
        materiaPrimaId: p.materiaPrimaId,
        nombre: p.nombre,
        gramajes: usaFiltro
          ? p.gramajes.filter((g) => gramajesOk.includes(g))
          : p.gramajes,
        variantes: p.variantes
          .filter(
            (v) =>
              !usaFiltro ||
              v.gramajeGr == null ||
              gramajesOk.includes(v.gramajeGr),
          )
          .map((v) => ({
            formatoComercial: v.formatoComercial,
            anchoMm: v.anchoMm,
            altoMm: v.altoMm,
            gramajeGr: v.gramajeGr,
          })),
      };
    });
    const obra = papeles.find((p) => /obra/i.test(p.nombre));
    // Tipos de anillo instalados (distintos, en orden estable).
    const tiposAnillo = Array.from(
      new Set(
        ctx.anillos
          .map((a) => a.tipoAnillo)
          .filter((tipo) => ctx.tiposAnilloPermitidos.includes(tipo)),
      ),
    ).map((value) => ({ value, label: labelTipoAnillo(value) }));
    return {
      papeles,
      papelDefaultId:
        obra?.materiaPrimaId ?? papeles[0]?.materiaPrimaId ?? null,
      terminaciones: (
        (config.terminacionesJson as string[] | null) ??
        TERMINACIONES_DISPONIBLES
      ).filter((t) => t !== 'Anillado' || !!ctx.anilladoConfigPasoId),
      tiposAnillo,
      tamanosOfrecidos: (config.tamanosJson as string[] | null) ?? null,
      activo: config.activo,
    };
  }

  /**
   * Estado liviano del módulo para el front (esconder el botón/atajo si está
   * pausado). Lectura pura: sin config aún = activo (default). Lo usa el flujo
   * comercial, así que NO exige el permiso de configurar.
   */
  async estado(
    tenantId: string,
  ): Promise<{ activo: boolean; configurado: boolean }> {
    const [config, producto] = await Promise.all([
      this.prisma.centroCopiadoConfig.findUnique({
        where: { tenantId },
        select: { activo: true },
      }),
      this.prisma.producto.findUnique({
        where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
        select: { id: true },
      }),
    ]);
    const configurado = Boolean(producto);
    return { activo: configurado && (config?.activo ?? true), configurado };
  }

  /** Lectura pura: si todavía no existe, aplica defaults sólo en memoria. */
  private async configDe(tenantId: string, db: CentroCopiadoDb = this.prisma) {
    const config = await db.centroCopiadoConfig.findUnique({
      where: { tenantId },
    });
    return (
      config ?? {
        tenantId,
        version: 0,
        activo: true,
        cobraSetup: false,
        maquinaColorId: null,
        maquinaBnId: null,
        maquinaAnilladoraId: null,
        tapaFrontalMateriaPrimaId: null,
        tapaContratapaMateriaPrimaId: null,
        papelesJson: null,
        tamanosJson: null,
        terminacionesJson: null,
        tiposAnilloJson: null,
        precioConfigJson: null,
      }
    );
  }

  /** Mutación explícita para tenants que aún no tienen la plantilla técnica. */
  async inicializar(tenantId: string, actorUserId?: string) {
    return this.actualizarConfig(tenantId, {}, actorUserId);
  }

  /**
   * Reaplica invariantes del módulo y reconstruye el ruteo desde la selección
   * persistida. Es una mutación explícita; los endpoints GET siguen siendo puros.
   */
  async reparar(tenantId: string, actorUserId?: string) {
    await provisionarPlantillaCentroCopiado(this.prisma, tenantId);
    const config = await this.configDe(tenantId);
    await this.prisma.$transaction(async (tx) => {
      await this.regenerarCandidatas(tx, tenantId, config);
      await this.auditoria?.registrar(tx, {
        tenantId,
        actorUserId,
        tipo: 'reparado',
        descripcion: 'Infraestructura y ruteo del Centro de Copiado reparados.',
      });
    });
    return this.getConfig(tenantId);
  }

  /**
   * Precio y tiempos de máquina del producto/paso plantilla de CC (que el usuario
   * no ve en el editor de rutas). Margen vive en Producto.precioConfigJson; setup/
   * cleanup en ProductoConfigPaso.setupOverrideMin/cleanupOverrideMin (override
   * propio de CC, gana sobre el perfil de la máquina sin pisarlo).
   */
  private async preciosYTiemposCC(
    tenantId: string,
    db: CentroCopiadoDb = this.prisma,
  ): Promise<{
    productoId: string | null;
    configPasoId: string | null;
    margenPct: number;
    margenMinimoPct: number;
    politicaPrecio: PoliticaPrecioCentroCopiado;
    tramosMargen: TramoMargenCentroCopiado[];
    minimoHojasFacturables: number;
    setupMin: number;
    cleanupMin: number;
  }> {
    const producto = await db.producto.findUnique({
      where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
      select: {
        id: true,
        precioConfigJson: true,
        minimoComercialPolitica: true,
        minimoComercialCantidad: true,
        minimoComercialBase: true,
        rutasAlternativas: {
          where: { activo: true },
          take: 1,
          select: {
            configPasos: {
              select: {
                id: true,
                setupOverrideMin: true,
                cleanupOverrideMin: true,
                rutaPaso: { select: { familiaCodigo: true } },
              },
            },
          },
        },
      },
    });
    // El setup/cleanup y las candidatas son del paso de IMPRESIÓN (puede haber un
    // 2º paso opcional de anillado desde la Etapa C).
    const cp = pasoImpresion(producto?.rutasAlternativas[0]?.configPasos);
    const detalle = ((
      producto?.precioConfigJson as Record<string, unknown> | null
    )?.detalle ?? {}) as Record<string, unknown>;
    const metodo = (
      producto?.precioConfigJson as Record<string, unknown> | null
    )?.metodoCalculo;
    const tramosMargen = tramosDesdeDetallePrecio(detalle);
    return {
      productoId: producto?.id ?? null,
      configPasoId: cp?.id ?? null,
      margenPct: Number(detalle.marginPct ?? tramosMargen[0]?.margenPct ?? 40),
      margenMinimoPct: Number(detalle.minimumMarginPct ?? 25),
      politicaPrecio:
        metodo === 'margen_variable' ? 'MARGEN_POR_VOLUMEN' : 'MARGEN_FIJO',
      tramosMargen:
        tramosMargen.length > 0
          ? tramosMargen
          : [{ desdeCantidad: 1, margenPct: 40 }],
      minimoHojasFacturables:
        producto?.minimoComercialPolitica === 'ADVERTIR_FACTURAR_MINIMO' &&
        producto.minimoComercialBase === 'pliegos_impresos'
          ? Number(producto.minimoComercialCantidad ?? 0)
          : 0,
      setupMin: Number(cp?.setupOverrideMin ?? 0),
      cleanupMin: Number(cp?.cleanupOverrideMin ?? 0),
    };
  }

  /** Config + universo disponible, para la página de Configuración. */
  async getConfig(tenantId: string) {
    const ctx = await this.contexto(tenantId);
    const config = await this.configDe(tenantId);
    const precios = await this.preciosYTiemposCC(tenantId);
    const laseres = await this.prisma.maquina.findMany({
      where: {
        tenantId,
        plantilla: 'IMPRESORA_LASER',
        ...MAQUINA_DISPONIBLE_WHERE,
      },
      include: { componentesDesgaste: { select: { soloColor: true } } },
      orderBy: { nombre: 'asc' },
    });
    const anilladoras = await this.prisma.maquina.findMany({
      where: {
        tenantId,
        plantilla: 'ANILLADORA',
        ...MAQUINA_DISPONIBLE_WHERE,
      },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    return {
      version: config.version,
      actualizadoEl:
        'updatedAt' in config ? config.updatedAt.toISOString() : null,
      activo: config.activo,
      cobraSetup: config.cobraSetup,
      margenPct: precios.margenPct,
      margenMinimoPct: precios.margenMinimoPct,
      politicaPrecio: precios.politicaPrecio,
      tramosMargen: precios.tramosMargen,
      minimoHojasFacturables: precios.minimoHojasFacturables,
      setupMin: precios.setupMin,
      cleanupMin: precios.cleanupMin,
      // Selección actual del tenant (null = todos / default / auto-resolver).
      papeles: (config.papelesJson as PapelConfig[] | null) ?? null,
      tamanos: (config.tamanosJson as string[] | null) ?? null,
      terminaciones: (config.terminacionesJson as string[] | null) ?? null,
      tiposAnillo: (config.tiposAnilloJson as string[] | null) ?? null,
      maquinaColorId: config.maquinaColorId,
      maquinaBnId: config.maquinaBnId,
      maquinaAnilladoraId: config.maquinaAnilladoraId,
      // Tapa/contratapa del anillado (materia prima elegida por el tenant).
      tapaFrontalMateriaPrimaId: config.tapaFrontalMateriaPrimaId,
      tapaContratapaMateriaPrimaId: config.tapaContratapaMateriaPrimaId,
      // Universo para elegir (el menú de tamaños lo tiene el front).
      disponibles: {
        papeles: ctx.papeles.map((p) => ({
          materiaPrimaId: p.materiaPrimaId,
          nombre: p.nombre,
          gramajes: p.gramajes,
          formatosProducibles: CENTRO_COPIADO_FORMATOS.filter((formato) =>
            p.variantes.some((variante) =>
              variantesCubre(variante, {
                preset: formato.nombre,
                anchoMm: formato.anchoMm,
                altoMm: formato.altoMm,
              }),
            ),
          ).map((formato) => formato.nombre),
        })),
        terminaciones: TERMINACIONES_DISPONIBLES,
        terminacionesCatalogo: CENTRO_COPIADO_TERMINACIONES_CATALOGO,
        formatos: CENTRO_COPIADO_FORMATOS,
        maquinas: laseres.map((m) => ({
          id: m.id,
          nombre: m.nombre,
          esColor: m.componentesDesgaste.some((c) => c.soloColor),
        })),
        anilladoras: anilladoras.map((m) => ({ id: m.id, nombre: m.nombre })),
        tiposAnillo: CENTRO_COPIADO_TIPOS_ANILLO.map((value) => ({
          value,
          label: labelTipoAnillo(value),
          instalado: ctx.anillos.some((anillo) => anillo.tipoAnillo === value),
        })),
        // Tapas instaladas (frontal transparente + contratapa de color); el
        // tenant asigna cuál va en cada rol. `esFrontal` es sólo una sugerencia.
        tapas: ctx.tapas.map((t) => ({
          materiaPrimaId: t.materiaPrimaId,
          nombre: t.nombre,
          esFrontal: t.esFrontal,
        })),
      },
    };
  }

  /** Actualiza la config. Un campo en null LIMPIA (vuelve al default). */
  private async validarActualizacionConfig(
    tenantId: string,
    dto: ActualizarCentroCopiadoConfigDto,
  ): Promise<void> {
    if (
      dto.terminaciones?.some(
        (terminacion) => !TERMINACIONES_DISPONIBLES.includes(terminacion),
      )
    ) {
      throw new BadRequestException(
        'La configuración contiene una terminación no soportada.',
      );
    }
    if (dto.tamanos?.some((tamano) => !tamano.trim())) {
      throw new BadRequestException(
        'Los tamaños ofrecidos no pueden estar vacíos.',
      );
    }
    if (
      dto.tiposAnillo?.some(
        (tipo) =>
          !CENTRO_COPIADO_TIPOS_ANILLO.includes(
            tipo as (typeof CENTRO_COPIADO_TIPOS_ANILLO)[number],
          ),
      )
    ) {
      throw new BadRequestException(
        'La configuración contiene un tipo de anillado no soportado.',
      );
    }
    if (dto.politicaPrecio === 'MARGEN_POR_VOLUMEN' || dto.tramosMargen) {
      const tramos = dto.tramosMargen ?? [];
      if (!tramos.length || tramos[0].desdeCantidad !== 1) {
        throw new BadRequestException(
          'La política por volumen debe comenzar desde 1 hoja.',
        );
      }
      const cantidades = tramos.map((tramo) => tramo.desdeCantidad);
      if (
        new Set(cantidades).size !== cantidades.length ||
        cantidades.some(
          (cantidad, index) => index > 0 && cantidad <= cantidades[index - 1],
        )
      ) {
        throw new BadRequestException(
          'Los tramos por volumen deben estar ordenados y no repetirse.',
        );
      }
      if (
        dto.margenMinimoPct !== undefined &&
        tramos.some((tramo) => tramo.margenPct < dto.margenMinimoPct!)
      ) {
        throw new BadRequestException(
          'Ningún tramo puede quedar por debajo del margen mínimo.',
        );
      }
    }

    const laserIds = Array.from(
      new Set(
        [dto.maquinaColorId, dto.maquinaBnId].filter(
          (id): id is string => typeof id === 'string',
        ),
      ),
    );
    if (laserIds.length) {
      const cantidad = await this.prisma.maquina.count({
        where: {
          tenantId,
          id: { in: laserIds },
          plantilla: 'IMPRESORA_LASER',
          ...MAQUINA_DISPONIBLE_WHERE,
        },
      });
      if (cantidad !== laserIds.length) {
        throw new BadRequestException(
          'Una de las impresoras seleccionadas no pertenece al tenant o no está disponible.',
        );
      }
    }
    if (dto.maquinaAnilladoraId) {
      const existe = await this.prisma.maquina.count({
        where: {
          tenantId,
          id: dto.maquinaAnilladoraId,
          plantilla: 'ANILLADORA',
          ...MAQUINA_DISPONIBLE_WHERE,
        },
      });
      if (!existe) {
        throw new BadRequestException(
          'La anilladora seleccionada no pertenece al tenant o no está disponible.',
        );
      }
    }

    const papelIds = Array.from(
      new Set((dto.papeles ?? []).map((papel) => papel.materiaPrimaId)),
    );
    if (papelIds.length) {
      const cantidad = await this.prisma.materiaPrima.count({
        where: {
          tenantId,
          id: { in: papelIds },
          subfamilia: 'SUSTRATO_HOJA',
        },
      });
      if (cantidad !== papelIds.length) {
        throw new BadRequestException(
          'Uno de los papeles seleccionados no pertenece al tenant o no es un sustrato de hoja.',
        );
      }
    }
    const tapaIds = Array.from(
      new Set(
        [
          dto.tapaFrontalMateriaPrimaId,
          dto.tapaContratapaMateriaPrimaId,
        ].filter((id): id is string => typeof id === 'string'),
      ),
    );
    if (tapaIds.length) {
      const cantidad = await this.prisma.materiaPrima.count({
        where: {
          tenantId,
          id: { in: tapaIds },
          subfamilia: 'TAPA_ENCUADERNACION',
        },
      });
      if (cantidad !== tapaIds.length) {
        throw new BadRequestException(
          'Una de las tapas seleccionadas no pertenece al tenant o no es válida.',
        );
      }
    }
  }

  async actualizarConfig(
    tenantId: string,
    dto: ActualizarCentroCopiadoConfigDto,
    actorUserId?: string,
  ) {
    await this.validarActualizacionConfig(tenantId, dto);
    // El producto y su ruta son infraestructura del módulo. Se provisionan
    // antes del commit de configuración; desde este punto, config + margen +
    // tiempos + candidatas se escriben como una sola unidad.
    await provisionarPlantillaCentroCopiado(this.prisma, tenantId);
    const jsonOrNull = (v: unknown) =>
      v == null ? Prisma.DbNull : (v as never);
    await this.prisma.$transaction(async (tx) => {
      const actual = await tx.centroCopiadoConfig.findUnique({
        where: { tenantId },
        select: { version: true },
      });
      if (dto.version !== undefined && dto.version !== (actual?.version ?? 0)) {
        throw new ConflictException(
          'La configuración cambió en otra sesión. Recargá antes de guardar.',
        );
      }
      const dataConfig = {
        tenantId,
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        ...(dto.cobraSetup !== undefined ? { cobraSetup: dto.cobraSetup } : {}),
        ...(dto.papeles !== undefined
          ? { papelesJson: jsonOrNull(dto.papeles) }
          : {}),
        ...(dto.tamanos !== undefined
          ? { tamanosJson: jsonOrNull(dto.tamanos) }
          : {}),
        ...(dto.terminaciones !== undefined
          ? { terminacionesJson: jsonOrNull(dto.terminaciones) }
          : {}),
        ...(dto.tiposAnillo !== undefined
          ? { tiposAnilloJson: jsonOrNull(dto.tiposAnillo) }
          : {}),
        ...(dto.maquinaColorId !== undefined
          ? { maquinaColorId: dto.maquinaColorId }
          : {}),
        ...(dto.maquinaBnId !== undefined
          ? { maquinaBnId: dto.maquinaBnId }
          : {}),
        ...(dto.maquinaAnilladoraId !== undefined
          ? { maquinaAnilladoraId: dto.maquinaAnilladoraId }
          : {}),
        ...(dto.tapaFrontalMateriaPrimaId !== undefined
          ? { tapaFrontalMateriaPrimaId: dto.tapaFrontalMateriaPrimaId }
          : {}),
        ...(dto.tapaContratapaMateriaPrimaId !== undefined
          ? {
              tapaContratapaMateriaPrimaId: dto.tapaContratapaMateriaPrimaId,
            }
          : {}),
      };
      const updateConfig = {
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        ...(dto.cobraSetup !== undefined ? { cobraSetup: dto.cobraSetup } : {}),
        ...(dto.papeles !== undefined
          ? { papelesJson: jsonOrNull(dto.papeles) }
          : {}),
        ...(dto.tamanos !== undefined
          ? { tamanosJson: jsonOrNull(dto.tamanos) }
          : {}),
        ...(dto.terminaciones !== undefined
          ? { terminacionesJson: jsonOrNull(dto.terminaciones) }
          : {}),
        ...(dto.tiposAnillo !== undefined
          ? { tiposAnilloJson: jsonOrNull(dto.tiposAnillo) }
          : {}),
        ...(dto.maquinaColorId !== undefined
          ? { maquinaColorId: dto.maquinaColorId }
          : {}),
        ...(dto.maquinaBnId !== undefined
          ? { maquinaBnId: dto.maquinaBnId }
          : {}),
        ...(dto.maquinaAnilladoraId !== undefined
          ? { maquinaAnilladoraId: dto.maquinaAnilladoraId }
          : {}),
        ...(dto.tapaFrontalMateriaPrimaId !== undefined
          ? { tapaFrontalMateriaPrimaId: dto.tapaFrontalMateriaPrimaId }
          : {}),
        ...(dto.tapaContratapaMateriaPrimaId !== undefined
          ? {
              tapaContratapaMateriaPrimaId: dto.tapaContratapaMateriaPrimaId,
            }
          : {}),
        version: { increment: 1 },
      };
      const config = actual
        ? await tx.centroCopiadoConfig.update({
            where: { tenantId },
            data: updateConfig,
          })
        : await tx.centroCopiadoConfig.create({ data: dataConfig });
      if (dto.maquinaColorId !== undefined || dto.maquinaBnId !== undefined) {
        await this.regenerarCandidatas(tx, tenantId, config);
      }
      // Margen y tiempos viven en el producto/paso porque el motor universal
      // los consume ahí, pero participan del mismo commit de configuración.
      await this.aplicarPrecioYTiempos(tx, tenantId, dto);
      await this.auditoria?.registrar(tx, {
        tenantId,
        actorUserId,
        tipo: actual ? 'configuracion_actualizada' : 'inicializado',
        descripcion: actual
          ? `Configuración del Centro de Copiado actualizada (v${config.version}).`
          : 'Centro de Copiado inicializado.',
        datos: {
          versionAnterior: actual?.version ?? 0,
          versionNueva: config.version,
          campos: Object.keys(dto).filter((campo) => campo !== 'version'),
        },
      });
    });
    return this.getConfig(tenantId);
  }

  /**
   * Persiste margen (en el precioConfigJson del producto CC) y setup/cleanup (en
   * los overrides del config paso). Sólo escribe lo que vino en el dto.
   */
  private async aplicarPrecioYTiempos(
    db: CentroCopiadoDb,
    tenantId: string,
    dto: ActualizarCentroCopiadoConfigDto,
  ): Promise<void> {
    const tocaPrecio =
      dto.margenPct !== undefined ||
      dto.margenMinimoPct !== undefined ||
      dto.politicaPrecio !== undefined ||
      dto.tramosMargen !== undefined ||
      dto.minimoHojasFacturables !== undefined;
    const tocaTiempos =
      dto.setupMin !== undefined || dto.cleanupMin !== undefined;
    if (!tocaPrecio && !tocaTiempos) return;

    const actual = await this.preciosYTiemposCC(tenantId, db);

    if (tocaPrecio && actual.productoId) {
      const politica = dto.politicaPrecio ?? actual.politicaPrecio;
      const margenMinimo = dto.margenMinimoPct ?? actual.margenMinimoPct;
      const tramos = dto.tramosMargen ?? actual.tramosMargen;
      const margenObjetivo = dto.margenPct ?? actual.margenPct;
      if (politica === 'MARGEN_FIJO' && margenObjetivo < margenMinimo) {
        throw new BadRequestException(
          'El margen objetivo no puede quedar por debajo del margen mínimo.',
        );
      }
      if (
        politica === 'MARGEN_POR_VOLUMEN' &&
        tramos.some((tramo) => tramo.margenPct < margenMinimo)
      ) {
        throw new BadRequestException(
          'Ningún tramo puede quedar por debajo del margen mínimo.',
        );
      }
      const precioConfigJson: Prisma.InputJsonObject =
        politica === 'MARGEN_POR_VOLUMEN'
          ? {
              metodoCalculo: 'margen_variable',
              detalle: {
                tiers: tiersMotorDesdeTramos(tramos),
                tramosDesde: tramos.map((tramo) => ({
                  desdeCantidad: tramo.desdeCantidad,
                  margenPct: tramo.margenPct,
                })),
                minimumMarginPct: margenMinimo,
              },
            }
          : {
              metodoCalculo: 'por_margen',
              detalle: {
                marginPct: margenObjetivo,
                minimumMarginPct: margenMinimo,
              },
            };
      const minimo =
        dto.minimoHojasFacturables ?? actual.minimoHojasFacturables;
      await db.producto.update({
        where: { id: actual.productoId },
        data: {
          precioConfigJson,
          minimoComercialPolitica:
            minimo > 0 ? 'ADVERTIR_FACTURAR_MINIMO' : 'NONE',
          minimoComercialCantidad: minimo > 0 ? minimo : null,
          minimoComercialBase: 'pliegos_impresos',
        },
      });
    }
    if (tocaTiempos && actual.configPasoId) {
      await db.productoConfigPaso.update({
        where: { id: actual.configPasoId },
        data: {
          ...(dto.setupMin !== undefined
            ? { setupOverrideMin: dto.setupMin }
            : {}),
          ...(dto.cleanupMin !== undefined
            ? { cleanupOverrideMin: dto.cleanupMin }
            : {}),
        },
      });
    }
  }

  /**
   * Regenera las máquinas candidatas del paso de impresión desde la config del
   * tenant: color = maquinaColorId (modo CMYK), B/N = maquinaBnId (modo BN). Si
   * ambas son la misma máquina, una candidata con ambos modos. Si no hay
   * selección, reconstruye explícitamente la resolución automática con las
   * láseres disponibles; así volver a "Automática" no conserva candidatas viejas.
   */
  private async regenerarCandidatas(
    db: CentroCopiadoDb,
    tenantId: string,
    config: { maquinaColorId: string | null; maquinaBnId: string | null },
  ): Promise<void> {
    let colorId = config.maquinaColorId;
    let bnId = config.maquinaBnId;

    const producto = await db.producto.findUnique({
      where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
      include: {
        rutasAlternativas: {
          where: { activo: true },
          include: {
            configPasos: {
              include: { rutaPaso: { select: { familiaCodigo: true } } },
            },
          },
        },
      },
    });
    const cp = pasoImpresion(producto?.rutasAlternativas[0]?.configPasos);
    if (!cp) return;

    const ids = [colorId, bnId].filter((x): x is string => !!x);
    const requiereAuto = !colorId || !bnId;
    const maquinas = await db.maquina.findMany({
      where: {
        tenantId,
        plantilla: 'IMPRESORA_LASER',
        ...MAQUINA_DISPONIBLE_WHERE,
        ...(!requiereAuto && ids.length ? { id: { in: ids } } : {}),
      },
      include: {
        componentesDesgaste: { select: { soloColor: true } },
        perfilesOperativos: { select: { id: true, nombre: true } },
      },
    });
    const colorAuto = maquinas.find((m) =>
      m.componentesDesgaste.some((c) => c.soloColor),
    );
    const bnAuto =
      maquinas.find((m) => m.componentesDesgaste.every((c) => !c.soloColor)) ??
      colorAuto;
    colorId ??= colorAuto?.id ?? null;
    bnId ??= bnAuto?.id ?? null;
    const perfilId = (mid: string | null): string | null => {
      const m = maquinas.find((x) => x.id === mid);
      if (!m) return null;
      const simple = m.perfilesOperativos.find((p) => /simple/i.test(p.nombre));
      return (simple ?? m.perfilesOperativos[0])?.id ?? null;
    };
    const existe = (mid: string | null) =>
      !!mid && maquinas.some((m) => m.id === mid);

    await db.productoConfigPasoMaquinaCandidata.deleteMany({
      where: { productoConfigPasoId: cp.id },
    });
    if (existe(colorId) && colorId === bnId) {
      // Una sola láser hace color y B/N.
      await db.productoConfigPasoMaquinaCandidata.create({
        data: {
          tenantId,
          productoConfigPasoId: cp.id,
          maquinaId: colorId!,
          esPreferida: true,
          orden: 0,
          activo: true,
          perfilDefaultId: perfilId(colorId),
          modoColorAllowedModes: ['CMYK', 'BN'],
        },
      });
      return;
    }
    let orden = 0;
    if (existe(colorId)) {
      await db.productoConfigPasoMaquinaCandidata.create({
        data: {
          tenantId,
          productoConfigPasoId: cp.id,
          maquinaId: colorId!,
          esPreferida: true,
          orden: orden++,
          activo: true,
          perfilDefaultId: perfilId(colorId),
          modoColorAllowedModes: ['CMYK'],
        },
      });
    }
    if (existe(bnId)) {
      await db.productoConfigPasoMaquinaCandidata.create({
        data: {
          tenantId,
          productoConfigPasoId: cp.id,
          maquinaId: bnId!,
          esPreferida: !existe(colorId),
          orden: orden++,
          activo: true,
          perfilDefaultId: perfilId(bnId),
          modoColorAllowedModes: ['BN'],
        },
      });
    }
  }

  /** Resuelve la variante + etiqueta legible para (tipo, gramaje, tamaño). */
  private resolverPapel(
    papeles: PapelTipo[],
    materiaPrimaId: string,
    pliego: PliegoDim,
    gramaje?: number | null,
  ): { varianteId: string | null; label: string } {
    const tipo = papeles.find((p) => p.materiaPrimaId === materiaPrimaId);
    if (!tipo) return { varianteId: null, label: '—' };
    const varianteId = resolverVariantePapel(tipo.variantes, pliego, gramaje);
    const v = tipo.variantes.find((x) => x.id === varianteId);
    const partes = [tipo.nombre];
    if (v?.formatoComercial) partes.push(v.formatoComercial);
    if (v?.gramajeGr != null) partes.push(`${v.gramajeGr}g`);
    return { varianteId, label: partes.join(' · ') };
  }

  /** Lectura pura del contexto ya provisionado. */
  private async contexto(tenantId: string): Promise<Ctx> {
    const config = await this.configDe(tenantId);
    const producto = await this.prisma.producto.findUnique({
      where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
      include: {
        rutasAlternativas: {
          where: { activo: true },
          include: {
            configPasos: {
              include: {
                maquinasCandidatas: true,
                rutaPaso: { select: { familiaCodigo: true } },
              },
            },
          },
        },
      },
    });
    const rutaAlt = producto?.rutasAlternativas[0];
    if (!producto || !rutaAlt) {
      throw new ConflictException(
        'El Centro de Copiado todavía no está inicializado. Inicializalo desde Configuración.',
      );
    }
    const cp = pasoImpresion(rutaAlt.configPasos);
    if (!cp) {
      throw new Error('Centro de copiado sin paso de impresión');
    }
    // [Tanda D] "El paso que anilla" = el que PUBLICA libros_anillados.
    const anilladoConfigPasoId =
      rutaAlt.configPasos.find((c) =>
        familiaPublicaOutput(c.rutaPaso?.familiaCodigo, 'libros_anillados'),
      )?.id ?? null;
    const color = cp.maquinasCandidatas.find((c) =>
      c.modoColorAllowedModes.includes('CMYK'),
    );
    const bn = cp.maquinasCandidatas.find((c) =>
      c.modoColorAllowedModes.includes('BN'),
    );
    const materias = await this.prisma.materiaPrima.findMany({
      where: { tenantId, subfamilia: 'SUSTRATO_HOJA' },
      include: {
        variantes: { where: { activo: true }, orderBy: { sku: 'asc' } },
      },
      orderBy: { nombre: 'asc' },
    });
    const numAttr = (x: unknown): number | null => {
      const n = typeof x === 'string' ? Number(x) : x;
      return typeof n === 'number' && Number.isFinite(n) ? n : null;
    };
    const papeles: PapelTipo[] = materias
      .map((m) => {
        const variantes = m.variantes.map((v) => {
          const a = (v.atributosVarianteJson ?? {}) as Record<string, unknown>;
          return {
            id: v.id,
            formatoComercial:
              typeof a.formatoComercial === 'string'
                ? a.formatoComercial
                : null,
            anchoMm: numAttr(a.anchoMm),
            altoMm: numAttr(a.altoMm),
            gramajeGr: numAttr(a.gramajeGr ?? a.gramaje),
          };
        });
        const gramajes = Array.from(
          new Set(
            variantes
              .map((v) => v.gramajeGr)
              .filter((g): g is number => g != null),
          ),
        ).sort((a, b) => a - b);
        return { materiaPrimaId: m.id, nombre: m.nombre, gramajes, variantes };
      })
      .filter((p) => p.variantes.length > 0);
    const maquinaColorId = color?.maquinaId ?? null;
    const maquinaBnId = bn?.maquinaId ?? null;
    // Espirales instalados: sólo para ETIQUETAR el Ø elegido (el motor hace la
    // selección real). El costo/tiempo del anillado los calcula el motor.
    const anillos = anilladoConfigPasoId
      ? (
          await this.prisma.materiaPrimaVariante.findMany({
            where: {
              tenantId,
              activo: true,
              materiaPrima: {
                familia: 'TERMINACION_EDITORIAL',
                subfamilia: 'ANILLADO_ENCUADERNACION',
              },
            },
            select: { atributosVarianteJson: true },
          })
        )
          .map((v) => {
            const a = (v.atributosVarianteJson ?? {}) as Record<
              string,
              unknown
            >;
            return {
              tipoAnillo: typeof a.tipoAnillo === 'string' ? a.tipoAnillo : '',
              diametroMm: numAttr(a.diametro) ?? 0,
              capacidadMaxHojas: numAttr(a.capacidadMaxHojas) ?? 0,
            };
          })
          .filter((x) => x.capacidadMaxHojas > 0)
      : [];
    const tiposConfigurados = (config.tiposAnilloJson as string[] | null) ?? [
      ...CENTRO_COPIADO_TIPOS_ANILLO,
    ];
    // Tapas instaladas (frontal transparente + contratapa cartón). El motor
    // consume la variante que se pinnea por slotMateriales; acá se cargan las
    // variantes con su tamaño para resolver por documento (menor que cubre).
    const tapas = anilladoConfigPasoId
      ? (
          await this.prisma.materiaPrima.findMany({
            where: {
              tenantId,
              familia: 'TERMINACION_EDITORIAL',
              subfamilia: 'TAPA_ENCUADERNACION',
            },
            include: {
              variantes: { where: { activo: true }, orderBy: { sku: 'asc' } },
            },
            orderBy: { nombre: 'asc' },
          })
        )
          .map((m) => {
            const mAttrs = (m.atributosTecnicosJson ?? {}) as Record<
              string,
              unknown
            >;
            const colorBase =
              typeof mAttrs.colorBase === 'string' ? mAttrs.colorBase : null;
            const materialMp =
              typeof mAttrs.material === 'string' ? mAttrs.material : null;
            const variantes = m.variantes.map((v) => {
              const a = (v.atributosVarianteJson ?? {}) as Record<
                string,
                unknown
              >;
              return {
                id: v.id,
                anchoMm: numAttr(a.anchoMm ?? a.ancho),
                altoMm: numAttr(a.altoMm ?? a.alto),
                material: typeof a.material === 'string' ? a.material : null,
              };
            });
            // Sólo fallback: la fuente de verdad es la config (tapaFrontalMpId /
            // tapaContratapaMpId). Se detecta por transparencia (nombre/color).
            void materialMp;
            const esFrontal = esTapaFrontalDetect(m.nombre, colorBase);
            return {
              materiaPrimaId: m.id,
              nombre: m.nombre,
              esFrontal,
              variantes: variantes.map(({ id, anchoMm, altoMm }) => ({
                id,
                anchoMm,
                altoMm,
              })),
            };
          })
          .filter((t) => t.variantes.length > 0)
      : [];
    return {
      productoId: producto.id,
      rutaAlternativaId: rutaAlt.id,
      configPasoId: cp.id,
      maquinaColorId,
      maquinaBnId,
      cobraSetup: config.cobraSetup,
      papeles,
      anilladoConfigPasoId,
      anillos,
      tiposAnilloPermitidos: tiposConfigurados,
      tapas,
      tapaFrontalMpId: config.tapaFrontalMateriaPrimaId,
      tapaContratapaMpId: config.tapaContratapaMateriaPrimaId,
    };
  }

  /**
   * La configuración del Centro de Copiado es una regla de dominio, no sólo un
   * filtro visual. Todo endpoint operativo pasa por esta validación para evitar
   * cotizaciones con materiales o terminaciones ocultos/deshabilitados.
   */
  private async validarOperacion(
    tenantId: string,
    dto: CotizarCentroCopiadoDto,
    ctx: Ctx,
  ): Promise<void> {
    const config = await this.configDe(tenantId);
    if (!config.activo) {
      throw new BadRequestException('El Centro de Copiado está pausado.');
    }

    const papelesCfg = (config.papelesJson as PapelConfig[] | null) ?? null;
    const papelesPermitidos = papelesCfg
      ? new Map(papelesCfg.map((p) => [p.materiaPrimaId, p.gramajes ?? null]))
      : null;
    const tamanosPermitidos = (config.tamanosJson as string[] | null) ?? null;
    const terminacionesConfiguradas =
      (config.terminacionesJson as string[] | null) ??
      TERMINACIONES_DISPONIBLES;
    const terminacionesPermitidas = new Set(
      terminacionesConfiguradas.filter(
        (t) => t !== 'Anillado' || !!ctx.anilladoConfigPasoId,
      ),
    );
    const tiposAnilloPermitidos = new Set(
      ctx.anillos
        .map((a) => a.tipoAnillo)
        .filter((tipo) => tipo && ctx.tiposAnilloPermitidos.includes(tipo)),
    );
    const errorEstructura = errorEstructuraCargaCentroCopiado(
      dto.documentos,
      dto.grupos,
    );
    if (errorEstructura) throw new BadRequestException(errorEstructura);

    for (const doc of dto.documentos) {
      const formato = CENTRO_COPIADO_FORMATOS.find(
        (candidato) => candidato.nombre === doc.tamano,
      );
      if (
        !formato ||
        formato.anchoMm !== doc.tamanoAnchoMm ||
        formato.altoMm !== doc.tamanoAltoMm
      ) {
        throw new BadRequestException(
          `El formato de "${doc.nombre ?? doc.id}" no coincide con el catálogo del Centro de Copiado.`,
        );
      }
      const papel = ctx.papeles.find(
        (p) => p.materiaPrimaId === doc.papelMateriaPrimaId,
      );
      if (
        !papel ||
        (papelesPermitidos && !papelesPermitidos.has(papel.materiaPrimaId))
      ) {
        throw new BadRequestException(
          `El papel seleccionado para "${doc.nombre ?? doc.id}" no está habilitado en Centro de Copiado.`,
        );
      }
      const gramajes = papelesPermitidos?.get(papel.materiaPrimaId) ?? null;
      if (
        gramajes?.length &&
        (doc.gramaje == null || !gramajes.includes(doc.gramaje))
      ) {
        throw new BadRequestException(
          `El gramaje seleccionado para "${doc.nombre ?? doc.id}" no está habilitado.`,
        );
      }
      if (
        tamanosPermitidos?.length &&
        !tamanosPermitidos.includes(doc.tamano)
      ) {
        throw new BadRequestException(
          `El tamaño ${doc.tamano} no está habilitado en Centro de Copiado.`,
        );
      }
      for (const terminacion of doc.terminaciones ?? []) {
        if (!terminacionesPermitidas.has(terminacion)) {
          throw new BadRequestException(
            `La terminación ${terminacion} no está disponible.`,
          );
        }
      }
      if (
        (doc.terminaciones ?? []).includes('Anillado') &&
        doc.tipoAnillo &&
        !tiposAnilloPermitidos.has(doc.tipoAnillo)
      ) {
        throw new BadRequestException(
          `El tipo de anillo seleccionado para "${doc.nombre ?? doc.id}" no está disponible.`,
        );
      }
    }

    for (const grupo of dto.grupos ?? []) {
      for (const terminacion of grupo.terminaciones ?? []) {
        if (!terminacionesPermitidas.has(terminacion)) {
          throw new BadRequestException(
            `La terminación ${terminacion} no está disponible.`,
          );
        }
      }
      if (
        (grupo.terminaciones ?? []).includes('Anillado') &&
        grupo.tipoAnillo &&
        !tiposAnilloPermitidos.has(grupo.tipoAnillo)
      ) {
        throw new BadRequestException(
          `El tipo de anillo del tomo ${grupo.nombre ?? grupo.id} no está disponible.`,
        );
      }
    }
  }

  private async cotizarDocumento(
    tenantId: string,
    doc: DocumentoInput,
    ctx: Ctx,
    copias: number,
    periodo: string | null,
  ): Promise<DocumentoResultado> {
    const { carillas, hojas } = calcularHojas(doc.paginas, copias, doc.faz);
    const base = {
      id: doc.id,
      grupoId: doc.grupoId ?? null,
      carillas,
      hojas,
      anillado: null as AnilladoResultado | null,
    };
    const { varianteId } = this.resolverPapel(
      ctx.papeles,
      doc.papelMateriaPrimaId,
      pliegoDeDoc(doc),
      doc.gramaje,
    );
    if (!varianteId) {
      return {
        ...base,
        pliegos: 0,
        subtotal: 0,
        iva: 0,
        total: 0,
        error: 'No hay papel disponible para ese tamaño.',
      };
    }
    const seg = construirSegmento(doc, ctx, copias, varianteId);
    // Anillado del doc SUELTO folded EN EL MISMO ítem: cada copia = 1 libro
    // (juegos = copias). Los documentos de un tomo NO anillan acá (lo hace el
    // compuesto del tomo, 1 anillo por libro).
    const quiereAnillado =
      doc.grupoId == null &&
      (doc.terminaciones ?? []).some((t) => t === 'Anillado');
    const hojasPorLibro =
      doc.faz === 2 ? Math.ceil(doc.paginas / 2) : doc.paginas;
    const anil = quiereAnillado
      ? this.anilladoActivacion(
          ctx,
          copias,
          hojasPorLibro,
          doc.tipoAnillo ?? '',
          pliegoDeDoc(doc),
        )
      : null;
    const jobContext = this.foldAnillado(seg.jobContext, anil?.additions);
    const cotizarJob = (contexto: Record<string, unknown>) =>
      this.motor.cotizar({
        tenantId,
        productoId: ctx.productoId,
        periodo,
        jobContext: contexto as never,
      });
    // Cuando hay anillado cotizamos también la impresión base. La cotización
    // final sigue siendo una sola; la diferencia se expone sólo para que Carga
    // rápida pueda explicar cuánto corresponde a hojas y cuánto a terminación.
    const [r, rSinAnillado] = anil?.additions
      ? await Promise.all([cotizarJob(jobContext), cotizarJob(seg.jobContext)])
      : [await cotizarJob(jobContext), null];
    if (!r.exitoso || !r.cotizacion) {
      return {
        ...base,
        pliegos: 0,
        subtotal: 0,
        iva: 0,
        total: 0,
        error: r.errores?.[0]?.mensaje ?? 'No se pudo cotizar',
      };
    }
    // Subtotal = impresión + anillado (misma cotización). El meta del anillado es
    // sólo para mostrar el Ø/aviso (el costo ya está en el desglose por paso).
    const montos = this.extraerMontos(r.cotizacion);
    let anillado = anil?.meta ?? null;
    if (anillado && anil?.additions) {
      if (!rSinAnillado?.exitoso || !rSinAnillado.cotizacion) {
        anillado = {
          ...anillado,
          error:
            rSinAnillado?.errores?.[0]?.mensaje ??
            'No se pudo desglosar el precio del anillado.',
        };
      } else {
        const sin = this.extraerMontos(rSinAnillado.cotizacion);
        anillado = {
          ...anillado,
          subtotal: redondear(Math.max(0, montos.subtotal - sin.subtotal)),
          iva: redondear(Math.max(0, montos.iva - sin.iva)),
          total: redondear(Math.max(0, montos.total - sin.total)),
        };
      }
    }
    return {
      ...base,
      pliegos: montos.pliegos,
      subtotal: montos.subtotal,
      iva: montos.iva,
      total: montos.total,
      anillado,
      error: null,
    };
  }

  /** Pliegos + subtotal (neto) / IVA / total (bruto) de una cotización exitosa. */
  private extraerMontos(cotizacion: NonNullable<CotizarOutput['cotizacion']>): {
    pliegos: number;
    subtotal: number;
    iva: number;
    total: number;
  } {
    const imp = cotizacion.pasos.find((p) =>
      esImpresionDeFamilia(p.familiaCodigo ?? ''),
    );
    const pliegos = Number(imp?.outputsCanonicos?.pliegos_impresos ?? 0);
    const d = cotizacion.desglosePrecio;
    const subtotal = d?.precioNetoTotal ?? cotizacion.precio?.precioTotal ?? 0;
    const total = d?.precioBrutoTotal ?? subtotal;
    // IVA (por fuera) = bruto − neto. NO usar desglosePrecio.totalImpuestos: ese
    // incluye los impuestos internos (IIBB/cheque) y viene por unidad.
    const iva = Math.max(0, total - subtotal);
    return {
      pliegos,
      subtotal: redondear(subtotal),
      iva: redondear(iva),
      total: redondear(total),
    };
  }

  /**
   * Línea de ANILLADO de un tomo. El anillado es 1 anillo por LIBRO (no por
   * sub-documento) y su tiempo escala por las hojas del libro. La impresión ya
   * se cotizó por sub-doc; acá se agrega SÓLO el anillado.
   *
   * Técnica: se cotiza un segmento de andamiaje con `cantidad = juegos` DOS
   * veces —con y sin el paso opcional activado— y se toma la DIFERENCIA. Así la
   * impresión de andamiaje se cancela y queda, ya priceada (margen + IVA), la
   * contribución exacta del paso `encuadernado_anillado` + su anillo.
   */
  private async cotizarAnilladoGrupo(
    tenantId: string,
    ctx: Ctx,
    juegos: number,
    hojasPorLibro: number,
    miembrosDto: DocumentoInput[],
    tipoAnillo: string,
    periodo: string | null,
  ): Promise<AnilladoResultado | null> {
    const repr = miembrosDto.find(
      (doc) =>
        this.resolverPapel(
          ctx.papeles,
          doc.papelMateriaPrimaId,
          pliegoDeDoc(doc),
          doc.gramaje,
        ).varianteId,
    );
    if (!repr) {
      return {
        subtotal: 0,
        iva: 0,
        total: 0,
        tipoAnillo: tipoAnillo || this.tipoAnilladoDefault(ctx),
        diametroMm: null,
        error: 'No hay papel disponible para preparar el anillado.',
      };
    }
    const papel = this.resolverPapel(
      ctx.papeles,
      repr.papelMateriaPrimaId,
      pliegoDeDoc(repr),
      repr.gramaje,
    );
    const activacion = this.anilladoActivacion(
      ctx,
      juegos,
      hojasPorLibro,
      tipoAnillo,
      pliegoDeDoc(repr),
    );
    if (!activacion || activacion.meta.error || !activacion.additions) {
      return {
        subtotal: 0,
        iva: 0,
        total: 0,
        tipoAnillo:
          activacion?.meta.tipoAnillo ??
          (tipoAnillo || this.tipoAnilladoDefault(ctx)),
        diametroMm: activacion?.meta.diametroMm ?? null,
        error:
          activacion?.meta.error ??
          'La terminación Anillado no está disponible para este tomo.',
      };
    }
    const base = construirSegmento(
      repr,
      ctx,
      juegos,
      papel.varianteId!,
    ).jobContext;
    const conAnillado = this.foldAnillado(base, activacion.additions);
    const [rBase, rAnillado] = await Promise.all([
      this.motor.cotizar({
        tenantId,
        productoId: ctx.productoId,
        periodo,
        jobContext: base as never,
      }),
      this.motor.cotizar({
        tenantId,
        productoId: ctx.productoId,
        periodo,
        jobContext: conAnillado as never,
      }),
    ]);
    if (
      !rBase.exitoso ||
      !rBase.cotizacion ||
      !rAnillado.exitoso ||
      !rAnillado.cotizacion
    ) {
      return {
        subtotal: 0,
        iva: 0,
        total: 0,
        tipoAnillo: activacion.meta.tipoAnillo,
        diametroMm: activacion.meta.diametroMm,
        error:
          rAnillado.errores?.[0]?.mensaje ??
          rBase.errores?.[0]?.mensaje ??
          'No se pudo cotizar el anillado.',
      };
    }
    const sin = this.extraerMontos(rBase.cotizacion);
    const con = this.extraerMontos(rAnillado.cotizacion);
    return {
      subtotal: redondear(Math.max(0, con.subtotal - sin.subtotal)),
      iva: redondear(Math.max(0, con.iva - sin.iva)),
      total: redondear(Math.max(0, con.total - sin.total)),
      tipoAnillo: activacion.meta.tipoAnillo,
      diametroMm: activacion.meta.diametroMm,
      error: null,
    };
  }

  /** Tipo de anillo por defecto: el primero instalado (o espiral plástico). */
  private tipoAnilladoDefault(ctx: Ctx): string {
    return (
      ctx.anillos.find((anillo) =>
        ctx.tiposAnilloPermitidos.includes(anillo.tipoAnillo),
      )?.tipoAnillo || 'ESPIRAL_PLASTICO'
    );
  }

  /** Ø que el motor elegiría: menor capacidad que cubre, DENTRO del tipo. */
  private diametroAnilladoParaHojas(
    ctx: Ctx,
    hojasPorLibro: number,
    tipoAnillo: string,
  ): number | null {
    const elegido = seleccionarMenorCapacidadQueCumpla(
      ctx.anillos
        .filter((a) => a.tipoAnillo === tipoAnillo)
        .map((a) => ({
          atributosVarianteJson: null,
          capacidadMaxHojas: a.capacidadMaxHojas,
          diametroMm: a.diametroMm,
        })),
      'capacidadMaxHojas',
      hojasPorLibro,
    );
    return elegido?.diametroMm ?? null;
  }

  /**
   * Resuelve las tapas del anillado para un tamaño de documento: elige, por rol
   * (frontal / contratapa), la variante que CUBRE el pliego con MENOR área (como
   * el papel). Devuelve el mapa `slotMateriales` (pineado al configPaso del
   * anillado) para el jobContext + las etiquetas para las especificaciones. Los
   * roles sin tapa que cubra simplemente no se pinnean (el anillado no se rompe).
   */
  private resolverTapasCC(
    ctx: Ctx,
    pliego: PliegoDim,
    tipoAnillo: string,
  ): {
    slotMateriales: Record<string, string>;
    labelFrontal: string | null;
    labelPosterior: string | null;
  } {
    const cpId = ctx.anilladoConfigPasoId;
    // El Wire-O por lo general no lleva tapas: no se aplican.
    if (tipoAnillo === 'WIRE_O') {
      return { slotMateriales: {}, labelFrontal: null, labelPosterior: null };
    }
    // Rol → pool de materia-primas candidatas: la elegida en Configuración, o (si
    // no hay elección) la heurística por transparencia. De ese pool se toma la
    // variante que CUBRE el pliego con menor área (sólo A4/Oficio/A3 disponibles).
    const pick = (
      mpElegidaId: string | null,
      esFrontal: boolean,
    ): { id: string; label: string } | null => {
      const pool = mpElegidaId
        ? ctx.tapas.filter((t) => t.materiaPrimaId === mpElegidaId)
        : ctx.tapas.filter((t) => t.esFrontal === esFrontal);
      let best: { id: string; label: string; area: number } | null = null;
      for (const t of pool) {
        for (const v of t.variantes) {
          if (v.anchoMm == null || v.altoMm == null) continue;
          const cubre = variantesCubre(
            {
              id: v.id,
              formatoComercial: null,
              anchoMm: v.anchoMm,
              altoMm: v.altoMm,
              gramajeGr: null,
            },
            pliego,
          );
          if (!cubre) continue;
          const area = v.anchoMm * v.altoMm;
          if (!best || area < best.area) {
            best = { id: v.id, label: t.nombre, area };
          }
        }
      }
      return best ? { id: best.id, label: best.label } : null;
    };
    const frontal = pick(ctx.tapaFrontalMpId, true);
    const posterior = pick(ctx.tapaContratapaMpId, false);
    const slotMateriales: Record<string, string> = {};
    if (cpId && frontal) slotMateriales[`${cpId}_tapa_frontal`] = frontal.id;
    if (cpId && posterior)
      slotMateriales[`${cpId}_tapa_posterior`] = posterior.id;
    return {
      slotMateriales,
      labelFrontal: frontal?.label ?? null,
      labelPosterior: posterior?.label ?? null,
    };
  }

  /**
   * Anillado FOLDEADO dentro del ítem de impresión (mismo jobContext, no un
   * renglón aparte): devuelve las claves a agregar al jobContext (juegos,
   * hojasPorLibro, tipoAnillo, opcionalesActivados, tapas) y el meta para mostrar
   * (Ø, tipo, aviso). Si ningún anillo del tipo cubre las hojas, NO se activa
   * (additions=null) y el meta lleva el error que bloquea la carga.
   */
  private anilladoActivacion(
    ctx: Ctx,
    juegos: number,
    hojasPorLibro: number,
    tipoAnillo: string,
    /** Tamaño del documento, para resolver la tapa/contratapa que lo cubre. */
    pliego: PliegoDim,
  ): {
    additions: Record<string, unknown> | null;
    meta: AnilladoResultado;
    /** Etiquetas de tapa/contratapa resueltas, para las especificaciones. */
    tapas: { frontal: string | null; posterior: string | null };
  } | null {
    if (!ctx.anilladoConfigPasoId || juegos <= 0 || hojasPorLibro <= 0) {
      return null;
    }
    const tipo = tipoAnillo || this.tipoAnilladoDefault(ctx);
    const diametroMm = this.diametroAnilladoParaHojas(ctx, hojasPorLibro, tipo);
    if (diametroMm == null) {
      return {
        additions: null,
        tapas: { frontal: null, posterior: null },
        meta: {
          subtotal: 0,
          iva: 0,
          total: 0,
          tipoAnillo: tipo,
          diametroMm: null,
          error: `Ningún anillo de ese tipo cubre ${hojasPorLibro} hojas.`,
        },
      };
    }
    const tapas = this.resolverTapasCC(ctx, pliego, tipo);
    return {
      additions: {
        juegos,
        hojasPorLibro,
        tipoAnillo: tipo,
        opcionalesActivados: { [ctx.anilladoConfigPasoId]: true },
        // Tapa frontal + contratapa pineadas por tamaño (el motor las consume 1
        // por libro). Vacío si el tenant no tiene tapas que cubran el documento.
        slotMateriales: tapas.slotMateriales,
      },
      tapas: { frontal: tapas.labelFrontal, posterior: tapas.labelPosterior },
      meta: {
        subtotal: 0,
        iva: 0,
        total: 0,
        tipoAnillo: tipo,
        diametroMm,
        error: null,
      },
    };
  }

  /**
   * Foldea el anillado (impresión + anillado en un solo jobContext) mergeando
   * `slotMateriales` (el papel de la impresión + las tapas del anillado): un
   * spread plano pisaría el papel, así que se combinan los dos mapas.
   */
  private foldAnillado(
    segJobContext: Record<string, unknown>,
    additions: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    if (!additions) return segJobContext;
    const baseSlots = (segJobContext.slotMateriales ?? {}) as Record<
      string,
      string
    >;
    const addSlots = (additions.slotMateriales ?? {}) as Record<string, string>;
    return {
      ...segJobContext,
      ...additions,
      slotMateriales: { ...baseSlots, ...addSlots },
    };
  }

  /** Etiqueta de las tapas para las especificaciones del renglón anillado. */
  private especificacionTapas(t: {
    frontal: string | null;
    posterior: string | null;
  }): string | null {
    const parts: string[] = [];
    if (t.frontal) parts.push(`Frontal: ${t.frontal}`);
    if (t.posterior) parts.push(`Contratapa: ${t.posterior}`);
    return parts.length ? parts.join(' · ') : null;
  }

  async cotizar(
    tenantId: string,
    dto: CotizarCentroCopiadoDto,
    /** Período de tarifas; null = mes actual (lo usa el endpoint en vivo). */
    periodo: string | null = null,
  ): Promise<CotizarCentroCopiadoResultado> {
    const ctx = await this.contexto(tenantId);
    await this.validarOperacion(tenantId, dto, ctx);
    const gruposById = new Map((dto.grupos ?? []).map((g) => [g.id, g]));

    // Un documento agrupado usa los `juegos` del tomo como copias efectivas.
    const documentos = await Promise.all(
      dto.documentos.map((doc) => {
        const grupo = doc.grupoId ? gruposById.get(doc.grupoId) : undefined;
        const copias = grupo ? grupo.juegos : doc.copias;
        return this.cotizarDocumento(
          tenantId,
          doc as DocumentoInput,
          ctx,
          copias,
          periodo,
        );
      }),
    );

    // Grupos (tomos): impresión = suma de sus documentos; el ANILLADO se agrega
    // como una línea (1 anillo × juegos + tiempo de anilladora) cuando la
    // terminación está activa y el taller tiene anilladora + anillos cargados.
    const grupos: GrupoResultado[] = await Promise.all(
      (dto.grupos ?? []).map(async (g) => {
        const miembros = documentos.filter((d) => d.grupoId === g.id);
        const validos = miembros.filter((d) => !d.error);
        const miembrosDto = dto.documentos.filter(
          (d) => d.grupoId === g.id,
        ) as DocumentoInput[];
        const hojasPorLibro = suma(
          miembrosDto.map((d) =>
            d.faz === 2 ? Math.ceil(d.paginas / 2) : d.paginas,
          ),
        );
        const impresion = {
          subtotal: suma(validos.map((d) => d.subtotal)),
          iva: suma(validos.map((d) => d.iva)),
          total: suma(validos.map((d) => d.total)),
        };
        const quiereAnillado = (g.terminaciones ?? []).some(
          (t) => t === 'Anillado',
        );
        // Sólo se cotiza el anillado si todos los documentos del tomo cotizaron
        // (si falta la impresión de uno, el tomo ya está en error).
        const anillado =
          quiereAnillado && !miembros.some((d) => d.error)
            ? await this.cotizarAnilladoGrupo(
                tenantId,
                ctx,
                g.juegos,
                hojasPorLibro,
                miembrosDto,
                g.tipoAnillo ?? '',
                periodo,
              )
            : null;
        // El tomo es UN ítem: impresión + anillado en el mismo subtotal.
        const extra = anillado && !anillado.error ? anillado : null;
        return {
          id: g.id,
          juegos: g.juegos,
          hojasPorLibro,
          subtotal: redondear(impresion.subtotal + (extra?.subtotal ?? 0)),
          iva: redondear(impresion.iva + (extra?.iva ?? 0)),
          total: redondear(impresion.total + (extra?.total ?? 0)),
          anillado,
          error: miembros.some((d) => d.error)
            ? 'Uno o más documentos del tomo no se pudieron cotizar'
            : (anillado?.error ?? null),
        };
      }),
    );

    const validos = documentos.filter((d) => !d.error);
    // Los sueltos ya traen el anillado en su subtotal (folded). Sólo falta sumar
    // el anillado de los TOMOS (que se cotiza aparte y se mergea al compuesto).
    const anilladoTomos = grupos.reduce(
      (acc, g) => {
        const a = g.anillado && !g.anillado.error ? g.anillado : null;
        acc.subtotal += a?.subtotal ?? 0;
        acc.iva += a?.iva ?? 0;
        acc.total += a?.total ?? 0;
        return acc;
      },
      { subtotal: 0, iva: 0, total: 0 },
    );
    return {
      documentos,
      grupos,
      totales: {
        documentos: dto.documentos.length,
        tomos: grupos.length,
        carillas: suma(documentos.map((d) => d.carillas)),
        hojasFisicas: suma(documentos.map((d) => d.hojas)),
        subtotal: redondear(
          suma(validos.map((d) => d.subtotal)) + anilladoTomos.subtotal,
        ),
        iva: redondear(suma(validos.map((d) => d.iva)) + anilladoTomos.iva),
        total: redondear(
          suma(validos.map((d) => d.total)) + anilladoTomos.total,
        ),
      },
    };
  }

  /**
   * Persiste la misma representación canónica que usa el modal: un ítem por
   * documento suelto y un único ítem compuesto por tomo. Antes este endpoint
   * guardaba N documentos + un renglón de anillado, produciendo dos modelos
   * persistentes distintos para la misma carga.
   */
  async agregarAOrden(
    tenantId: string,
    dto: AgregarAOrdenCentroCopiadoDto,
    periodo: string | null = null,
  ): Promise<AgregarAOrdenResultado> {
    if (this.idempotencia && dto.idempotencyKey) {
      return this.idempotencia.ejecutar({
        tenantId,
        tipo: 'agregar_a_orden',
        clave: dto.idempotencyKey,
        accion: () => this.agregarAOrdenInterno(tenantId, dto, periodo),
      });
    }
    return this.agregarAOrdenInterno(tenantId, dto, periodo);
  }

  private async agregarAOrdenInterno(
    tenantId: string,
    dto: AgregarAOrdenCentroCopiadoDto,
    periodo: string | null,
  ): Promise<AgregarAOrdenResultado> {
    const ctx = await this.contexto(tenantId);
    await this.validarOperacion(tenantId, dto, ctx);
    const grupoCargaId = dto.grupoCargaId ?? randomUUID();
    const preview = await this.cotizar(tenantId, dto, periodo);
    const errorPreview =
      preview.documentos.find((d) => d.error)?.error ??
      preview.grupos.find((g) => g.error)?.error ??
      null;
    if (errorPreview) {
      throw new BadRequestException(errorPreview);
    }
    const cotizacionId = await this.asegurarCotizacion(
      tenantId,
      dto.cotizacionId,
      dto.clienteId,
    );
    const gruposById = new Map((dto.grupos ?? []).map((g) => [g.id, g]));
    const emitidos = new Set<string>();
    const items: ItemAgregado[] = [];
    for (const doc of dto.documentos) {
      const d = doc as DocumentoInput;
      if (d.grupoId) {
        if (emitidos.has(d.grupoId)) continue;
        emitidos.add(d.grupoId);
        const grupo = gruposById.get(d.grupoId);
        if (!grupo) continue;
        const miembrosDto = dto.documentos.filter(
          (x) => x.grupoId === grupo.id,
        );
        const miembros = miembrosDto as DocumentoInput[];
        const guardado = await this.guardarTomo(
          tenantId,
          {
            documentos: miembrosDto,
            grupos: [grupo],
            cotizacionId,
            clienteId: dto.clienteId,
            grupoCargaId,
            idempotencyKey: undefined,
          },
          periodo,
        );
        const cantidades = miembros.map((m) =>
          calcularHojas(m.paginas, grupo.juegos, m.faz),
        );
        items.push({
          documentoId: grupo.id,
          cotizacionItemId: guardado.cotizacionItemId,
          grupoTomoId: null,
          nombre: grupo.nombre ?? 'Tomo',
          carillas: suma(cantidades.map((c) => c.carillas)),
          hojas: suma(cantidades.map((c) => c.hojas)),
          subtotal: guardado.subtotal,
          iva: guardado.iva,
          total: guardado.total,
          error: guardado.error,
        });
      } else {
        items.push(
          await this.agregarDocumento(
            tenantId,
            d,
            ctx,
            undefined,
            grupoCargaId,
            cotizacionId,
            periodo,
          ),
        );
      }
    }
    const validos = items.filter((i) => !i.error);
    return {
      cotizacionId,
      grupoCargaId,
      items,
      totales: {
        documentos: dto.documentos.length,
        tomos: dto.grupos?.length ?? 0,
        carillas: suma(items.map((i) => i.carillas)),
        hojasFisicas: suma(items.map((i) => i.hojas)),
        subtotal: redondear(suma(validos.map((i) => i.subtotal))),
        iva: redondear(suma(validos.map((i) => i.iva))),
        total: redondear(suma(validos.map((i) => i.total))),
      },
    };
  }

  /** Valida/crea la cotización borrador a la que se agregan los renglones. */
  private async asegurarCotizacion(
    tenantId: string,
    cotizacionId: string | undefined,
    clienteId: string | undefined,
  ): Promise<string> {
    if (cotizacionId) {
      const c = await this.prisma.cotizacion.findFirst({
        where: { id: cotizacionId, tenantId },
        select: { id: true, estado: true },
      });
      if (!c) throw new NotFoundException('No se encontró la cotización.');
      if (c.estado !== 'borrador') {
        throw new BadRequestException(
          'Solo se pueden agregar items a una cotización en borrador.',
        );
      }
      return c.id;
    }
    if (clienteId) {
      const cliente = await this.prisma.cliente.findFirst({
        where: { id: clienteId, tenantId, activo: true },
        select: { id: true },
      });
      if (!cliente) {
        throw new NotFoundException('No se encontró un cliente activo.');
      }
    }
    const nueva = await this.prisma.cotizacion.create({
      data: { tenantId, clienteId: clienteId ?? null, estado: 'borrador' },
    });
    return nueva.id;
  }

  /**
   * Resuelve papel + arma el jobContext (con metadata `_centroCopiado` para
   * agrupar/nombrar/rehidratar) y las especificaciones legibles del renglón.
   * Compartido por el guardado (agregar) y el staging (construir).
   */
  private prepararDoc(
    doc: DocumentoInput,
    ctx: Ctx,
    grupo: GrupoCentroCopiadoDto | undefined,
    grupoCargaId: string,
  ): {
    copias: number;
    carillas: number;
    hojas: number;
    anilladoActivo: boolean;
    nombre: string;
    jobContext: Record<string, unknown> | null;
    especificaciones: Record<string, string>;
    error: string | null;
  } {
    const copias = grupo ? grupo.juegos : doc.copias;
    const { carillas, hojas } = calcularHojas(doc.paginas, copias, doc.faz);
    const nombre = doc.nombre ?? 'Impresión de documento';
    // Terminaciones: las del tomo si está agrupado, o las del documento suelto.
    // Nunca se presupone una terminación que el usuario no haya solicitado.
    const terminaciones = grupo
      ? (grupo.terminaciones ?? [])
      : (doc.terminaciones ?? []);
    const terminacion = terminaciones.length
      ? terminaciones.join(', ')
      : 'Ninguna';
    const tomoNombre = grupo ? (grupo.nombre ?? 'Tomo anillado') : null;
    const { varianteId, label: papelLabel } = this.resolverPapel(
      ctx.papeles,
      doc.papelMateriaPrimaId,
      pliegoDeDoc(doc),
      doc.gramaje,
    );
    const especificaciones: Record<string, string> = {
      Archivo: nombre,
      Tamaño: doc.tamano,
      // "Papel" se omite: la fila MATERIAL de la cotización ya muestra el papel
      // (tipo · gramaje · acabado), igual que en los productos de catálogo.
      Color: doc.color === 'COLOR' ? 'Color' : 'Blanco y negro',
      Faz: doc.faz === 2 ? 'Doble faz (2 caras)' : 'Simple faz (1 cara)',
      Páginas: String(doc.paginas),
      Copias: String(copias),
      // "Carillas" (= páginas × copias) es redundante con Páginas/Copias; se
      // muestra "Hojas físicas" (lo que realmente se imprime).
      'Hojas físicas': String(hojas),
      Terminación: terminacion,
    };
    especificaciones['Cobertura'] =
      NIVEL_COBERTURA_LABELS[normalizarNivelCobertura(doc.cobertura ?? 'alta')];
    if (tomoNombre) especificaciones['Tomo'] = tomoNombre;
    if (!varianteId) {
      return {
        copias,
        carillas,
        hojas,
        anilladoActivo: false,
        nombre,
        jobContext: null,
        especificaciones,
        error: 'No hay papel disponible para ese tamaño.',
      };
    }
    const seg = construirSegmento(doc, ctx, copias, varianteId);
    // Anillado del SUELTO folded en el mismo jobContext (impresión + anillado).
    // Los miembros de un tomo NO anillan acá (lo hace el compuesto del tomo).
    const quiereAnillado =
      !grupo && (doc.terminaciones ?? []).includes('Anillado');
    const hojasPorLibro =
      doc.faz === 2 ? Math.ceil(doc.paginas / 2) : doc.paginas;
    const anil = quiereAnillado
      ? this.anilladoActivacion(
          ctx,
          copias,
          hojasPorLibro,
          doc.tipoAnillo ?? '',
          pliegoDeDoc(doc),
        )
      : null;
    if (quiereAnillado && (!anil || anil.meta.error || !anil.additions)) {
      return {
        copias,
        carillas,
        hojas,
        anilladoActivo: false,
        nombre,
        jobContext: null,
        especificaciones,
        error:
          anil?.meta.error ??
          'La terminación Anillado no está disponible para este documento.',
      };
    }
    const jobImpresion = this.foldAnillado(seg.jobContext, anil?.additions);
    if (anil?.meta && !anil.meta.error && anil.meta.diametroMm) {
      especificaciones['Anillo'] =
        `${labelTipoAnillo(anil.meta.tipoAnillo)} Ø${anil.meta.diametroMm} mm`;
      const tapasLabel = this.especificacionTapas(anil.tapas);
      if (tapasLabel) especificaciones['Tapas'] = tapasLabel;
    }
    const jobContext = {
      ...jobImpresion,
      _centroCopiado: metaDocumentoCentroCopiado({
        doc,
        grupoCargaId,
        grupoTomoId: doc.grupoId ?? null,
        tomoNombre,
        terminaciones,
        tipoAnillo: grupo
          ? (grupo.tipoAnillo ?? null)
          : (doc.tipoAnillo ?? null),
        copias,
        papelLabel,
        carillas,
        hojas,
      }),
    };
    return {
      copias,
      carillas,
      hojas,
      anilladoActivo: anil?.additions != null,
      nombre,
      jobContext,
      especificaciones,
      error: null,
    };
  }

  private async agregarDocumento(
    tenantId: string,
    doc: DocumentoInput,
    ctx: Ctx,
    grupo: GrupoCentroCopiadoDto | undefined,
    grupoCargaId: string,
    cotizacionId: string,
    periodo: string | null,
  ): Promise<ItemAgregado> {
    const p = this.prepararDoc(doc, ctx, grupo, grupoCargaId);
    const base = {
      documentoId: doc.id,
      grupoTomoId: doc.grupoId ?? null,
      nombre: doc.nombre ?? null,
      carillas: p.carillas,
      hojas: p.hojas,
    };
    if (!p.jobContext) {
      return {
        ...base,
        cotizacionItemId: null,
        subtotal: 0,
        iva: 0,
        total: 0,
        error: p.error,
      };
    }
    try {
      const { result, cotizacionItemId } = await this.motor.cotizarYGuardar({
        tenantId,
        productoId: ctx.productoId,
        jobContext: p.jobContext as never,
        cotizacionId,
        periodo,
      });
      if (!result.exitoso || !result.cotizacion || !cotizacionItemId) {
        return {
          ...base,
          cotizacionItemId: null,
          subtotal: 0,
          iva: 0,
          total: 0,
          error: result.errores?.[0]?.mensaje ?? 'No se pudo cotizar',
        };
      }
      const { subtotal, iva, total } = this.extraerMontos(result.cotizacion);
      return { ...base, cotizacionItemId, subtotal, iva, total, error: null };
    } catch (e) {
      return {
        ...base,
        cotizacionItemId: null,
        subtotal: 0,
        iva: 0,
        total: 0,
        error: e instanceof Error ? e.message : 'Error al guardar el renglón',
      };
    }
  }

  /**
   * Construye el payload por documento para stagear un PropuestaItem en el front
   * (no persiste). El front lo mapea a PropuestaItem; el guardado real lo hace el
   * flujo normal de la propuesta (cotizar-y-guardar con `jobContext`).
   */
  async construirItems(
    tenantId: string,
    dto: AgregarAOrdenCentroCopiadoDto,
    periodo: string | null = null,
  ): Promise<ConstruirItemsResultado> {
    const ctx = await this.contexto(tenantId);
    await this.validarOperacion(tenantId, dto, ctx);
    const grupoCargaId = dto.grupoCargaId ?? randomUUID();
    const gruposById = new Map((dto.grupos ?? []).map((g) => [g.id, g]));
    // Cada tomo colapsa a UN item compuesto (en la posición de su primer doc);
    // los sueltos siguen como un item cada uno.
    const emitidos = new Set<string>();
    const items: ItemConstruido[] = [];
    for (const doc of dto.documentos) {
      if (doc.grupoId) {
        if (emitidos.has(doc.grupoId)) continue;
        emitidos.add(doc.grupoId);
        const grupo = gruposById.get(doc.grupoId);
        const docs = dto.documentos.filter(
          (d) => d.grupoId === doc.grupoId,
        ) as DocumentoInput[];
        if (grupo) {
          // El anillado del tomo va FOLDED en el compuesto (agregarTomo mergea su
          // paso + costo), no como renglón aparte.
          items.push(
            await this.construirTomo(
              tenantId,
              docs,
              grupo,
              ctx,
              grupoCargaId,
              periodo,
            ),
          );
        }
      } else {
        // El anillado del suelto va FOLDED en el mismo ítem (construirDocumento
        // activa el paso opcional en el jobContext), no como renglón aparte.
        items.push(
          await this.construirDocumento(
            tenantId,
            doc as DocumentoInput,
            ctx,
            undefined,
            grupoCargaId,
            periodo,
          ),
        );
      }
    }
    return { grupoCargaId, items };
  }

  private async construirDocumento(
    tenantId: string,
    doc: DocumentoInput,
    ctx: Ctx,
    grupo: GrupoCentroCopiadoDto | undefined,
    grupoCargaId: string,
    periodo: string | null,
  ): Promise<ItemConstruido> {
    const p = this.prepararDoc(doc, ctx, grupo, grupoCargaId);
    // El renglón se mide en LIBROS cuando anilla (1 libro = 1 copia encuadernada)
    // y en HOJAS cuando son sueltas. El subtotal es el mismo; sólo cambia la
    // unidad y el precio unitario que se muestran.
    const cantidad = p.anilladoActivo ? p.copias : p.hojas;
    const unidad = p.anilladoActivo ? 'libros' : 'hojas';
    const base = {
      documentoId: doc.id,
      grupoTomoId: doc.grupoId ?? null,
      nombre: p.nombre,
      productoId: ctx.productoId,
      jobContext: p.jobContext ?? {},
      especificaciones: p.especificaciones,
      cantidad,
      unidad,
    };
    if (!p.jobContext) {
      return {
        ...base,
        precioUnitario: 0,
        subtotal: 0,
        impuestoPorcentaje: 0,
        impuestoMonto: 0,
        total: 0,
        cotizacion: null,
        error: p.error,
      };
    }
    const r = await this.motor.cotizar({
      tenantId,
      productoId: ctx.productoId,
      periodo,
      jobContext: p.jobContext as never,
    });
    if (!r.exitoso || !r.cotizacion) {
      return {
        ...base,
        precioUnitario: 0,
        subtotal: 0,
        impuestoPorcentaje: 0,
        impuestoMonto: 0,
        total: 0,
        cotizacion: null,
        error: r.errores?.[0]?.mensaje ?? 'No se pudo cotizar',
      };
    }
    const c = r.cotizacion;
    const d = c.desglosePrecio;
    const subtotal = redondear(
      d?.precioNetoTotal ?? c.precio?.precioTotal ?? 0,
    );
    const total = redondear(d?.precioBrutoTotal ?? subtotal);
    // IVA (por fuera) = bruto − neto (no totalImpuestos, que suma internos/unidad).
    const impuestoMonto = Math.max(0, total - subtotal);
    const precioUnitario =
      cantidad > 0 ? redondear(subtotal / cantidad) : subtotal;
    const impuestoPorcentaje =
      subtotal > 0 ? redondear((impuestoMonto / subtotal) * 100) : 0;
    return {
      ...base,
      precioUnitario,
      subtotal,
      impuestoPorcentaje,
      impuestoMonto,
      total,
      cotizacion: c,
      error: null,
    };
  }

  // ==========================================================================
  // TOMO COMPUESTO (Tomo-A): un tomo anillado = UN CotizacionItem sintético que
  // agrega la impresión de sus sub-documentos (+ anillado cuando exista). El
  // margen y el IVA son lineales por segmento (misma config del plantilla), así
  // que sumar subtotales/IVA/total por segmento = aplicarlos una vez al total.
  // ==========================================================================

  /** Cotiza cada sub-documento del tomo y agrega costos, pasos y montos. */
  private async agregarTomo(
    tenantId: string,
    docs: DocumentoInput[],
    grupo: GrupoCentroCopiadoDto,
    ctx: Ctx,
    grupoCargaId: string,
    periodo: string | null,
  ): Promise<{
    tomoNombre: string;
    juegos: number;
    anilladoActivo: boolean;
    costos: NonNullable<CotizarOutput['cotizacion']>['costos'];
    pasos: unknown[];
    subtotal: number;
    iva: number;
    total: number;
    especificaciones: Record<string, string>;
    jobContext: Record<string, unknown>;
    cotizacionSintetica: NonNullable<CotizarOutput['cotizacion']> | null;
    base: NonNullable<CotizarOutput['cotizacion']> | null;
    error: string | null;
  }> {
    const juegos = grupo.juegos;
    const tomoNombre = grupo.nombre ?? 'Tomo';
    const terminaciones = grupo.terminaciones ?? [];
    const terminacion = terminaciones.length
      ? terminaciones.join(', ')
      : 'Ninguna';

    const segs = await Promise.all(
      docs.map(async (doc) => {
        const prep = this.prepararDoc(doc, ctx, grupo, grupoCargaId);
        if (!prep.jobContext)
          return { doc, prep, cot: null, error: prep.error };
        const r = await this.motor.cotizar({
          tenantId,
          productoId: ctx.productoId,
          periodo,
          jobContext: prep.jobContext as never,
        });
        if (!r.exitoso || !r.cotizacion) {
          return {
            doc,
            prep,
            cot: null,
            error: r.errores?.[0]?.mensaje ?? 'No se pudo cotizar',
          };
        }
        return { doc, prep, cot: r.cotizacion, error: null };
      }),
    );

    let error = segs.find((s) => s.error)?.error ?? null;
    const validos = segs.filter(
      (s): s is typeof s & { cot: NonNullable<CotizarOutput['cotizacion']> } =>
        !!s.cot,
    );
    const hojasPorLibro = docs.reduce(
      (a, d) => a + (d.faz === 2 ? Math.ceil(d.paginas / 2) : d.paginas),
      0,
    );

    // Anillado del tomo mergeado en el MISMO ítem. Se recotiza un segmento real
    // con el paso activo y se toma la diferencia contra ese mismo segmento sin
    // anillado. Así no se usa una impresión ficticia con cantidad 0 (inválida
    // para el contrato financiero del motor).
    const quiereAnillado = terminaciones.includes('Anillado');
    let anilladoCot: NonNullable<CotizarOutput['cotizacion']> | null = null;
    let anilladoBase: NonNullable<CotizarOutput['cotizacion']> | null = null;
    let anilladoDiametro: number | null = null;
    if (quiereAnillado && !error) {
      const representante = validos[0];
      const activacion = representante
        ? this.anilladoActivacion(
            ctx,
            juegos,
            hojasPorLibro,
            grupo.tipoAnillo ?? '',
            pliegoDeDoc(representante.doc),
          )
        : null;
      if (!representante || !activacion) {
        error = 'La terminación Anillado no está disponible para este tomo.';
      } else if (activacion.meta.error || !activacion.additions) {
        error =
          activacion.meta.error ?? 'No se pudo preparar el anillado del tomo.';
      } else {
        const jobContext = this.foldAnillado(
          representante.prep.jobContext!,
          activacion.additions,
        );
        const rA = await this.motor.cotizar({
          tenantId,
          productoId: ctx.productoId,
          periodo,
          jobContext: jobContext as never,
        });
        if (rA.exitoso && rA.cotizacion) {
          anilladoCot = rA.cotizacion;
          anilladoBase = representante.cot;
          anilladoDiametro = activacion.meta.diametroMm;
        } else {
          error =
            rA.errores?.[0]?.mensaje ??
            'No se pudo cotizar el anillado del tomo.';
        }
      }
    }
    const montosAnil =
      anilladoCot && anilladoBase
        ? (() => {
            const con = this.extraerMontos(anilladoCot);
            const sin = this.extraerMontos(anilladoBase);
            return {
              subtotal: Math.max(0, con.subtotal - sin.subtotal),
              iva: Math.max(0, con.iva - sin.iva),
              total: Math.max(0, con.total - sin.total),
            };
          })()
        : { subtotal: 0, iva: 0, total: 0 };
    const costoAnillado = (
      campo: keyof NonNullable<CotizarOutput['cotizacion']>['costos'],
    ): number =>
      Math.max(
        0,
        Number(anilladoCot?.costos[campo] ?? 0) -
          Number(anilladoBase?.costos[campo] ?? 0),
      );

    const sum = (
      f: (m: { subtotal: number; iva: number; total: number }) => number,
    ) => validos.reduce((a, s) => a + f(this.extraerMontos(s.cot)), 0);
    const subtotal = redondear(sum((m) => m.subtotal) + montosAnil.subtotal);
    const iva = redondear(sum((m) => m.iva) + montosAnil.iva);
    const total = redondear(sum((m) => m.total) + montosAnil.total);

    const costos = {
      tiempoTotal:
        validos.reduce((a, s) => a + s.cot.costos.tiempoTotal, 0) +
        costoAnillado('tiempoTotal'),
      tiempoExtraTotal:
        validos.reduce((a, s) => a + (s.cot.costos.tiempoExtraTotal ?? 0), 0) +
        costoAnillado('tiempoExtraTotal'),
      materialesTotal:
        validos.reduce((a, s) => a + s.cot.costos.materialesTotal, 0) +
        costoAnillado('materialesTotal'),
      cargosDirectosTotal:
        validos.reduce((a, s) => a + s.cot.costos.cargosDirectosTotal, 0) +
        costoAnillado('cargosDirectosTotal'),
      cargosSinMargenTotal:
        validos.reduce(
          (a, s) => a + (s.cot.costos.cargosSinMargenTotal ?? 0),
          0,
        ) + costoAnillado('cargosSinMargenTotal'),
      tercerizadoTotal:
        validos.reduce((a, s) => a + s.cot.costos.tercerizadoTotal, 0) +
        costoAnillado('tercerizadoTotal'),
      total:
        validos.reduce((a, s) => a + s.cot.costos.total, 0) +
        costoAnillado('total'),
      unitario: 0,
    };
    costos.unitario = juegos > 0 ? costos.total / juegos : costos.total;

    // Re-indexar rutaPasoOrden global y etiquetar cada paso con su documento:
    // sin re-indexar, los pasos de todos los segmentos comparten orden 0 y la
    // ficha colisiona keys (rutaPasoOrden-familiaCodigo).
    let ordenGlobal = 0;
    const pasos: Array<Record<string, unknown>> = validos.flatMap((s) => {
      const docNombre = s.doc.nombre ?? 'Documento';
      return (
        ((s.cot.pasos as unknown as Array<Record<string, unknown>>) ?? [])
          // El anillado va UNA vez (mergeado abajo); el paso opcional inactivo de
          // cada segmento de impresión no debe aparecer.
          .filter(
            (p) =>
              !familiaPublicaOutput(
                p.familiaCodigo as string,
                'libros_anillados',
              ),
          )
          .map((p) => ({
            ...p,
            rutaPasoOrden: ordenGlobal++,
            nombreVisible: `${
              (p.nombreVisible as string) ?? (p.nombre as string) ?? 'Impresión'
            } — ${docNombre}`,
          }))
      );
    });
    // El paso de anillado del compuesto (la impresión andamiaje NO se agrega).
    if (anilladoCot) {
      const anilPaso = (
        anilladoCot.pasos as unknown as Array<Record<string, unknown>>
      ).find((p) =>
        familiaPublicaOutput(p.familiaCodigo as string, 'libros_anillados'),
      );
      if (anilPaso) {
        pasos.push({ ...anilPaso, rutaPasoOrden: ordenGlobal++ });
      }
    }
    const totalHojas = segs.reduce((a, s) => a + s.prep.hojas, 0);

    const especificaciones: Record<string, string> = {
      Terminación: terminacion,
      Juegos: String(juegos),
      Documentos: String(docs.length),
      'Hojas por juego': String(hojasPorLibro),
      'Hojas físicas': String(totalHojas),
    };
    if (anilladoDiametro) {
      especificaciones['Anillo'] =
        `${labelTipoAnillo(grupo.tipoAnillo || this.tipoAnilladoDefault(ctx))} Ø${anilladoDiametro} mm`;
      // Tapas del tomo: mismo tamaño que sus documentos (todos comparten pliego).
      const t = this.resolverTapasCC(
        ctx,
        pliegoDeDoc(docs[0]),
        grupo.tipoAnillo || this.tipoAnilladoDefault(ctx),
      );
      const tapasLabel = this.especificacionTapas({
        frontal: t.labelFrontal,
        posterior: t.labelPosterior,
      });
      if (tapasLabel) especificaciones['Tapas'] = tapasLabel;
    }
    docs.forEach((d, i) => {
      especificaciones[`Documento ${i + 1}`] =
        `${d.nombre ?? 'Documento'} · ${d.tamano} · ` +
        `${d.color === 'COLOR' ? 'Color' : 'B/N'} · ` +
        `${d.faz === 2 ? 'doble' : 'simple'} faz · ${d.paginas} pág`;
    });

    const jobContext: Record<string, unknown> = {
      _centroCopiado: metaTomoCentroCopiado({
        docs,
        grupoCargaId,
        tomoNombre,
        terminaciones,
        tipoAnillo: grupo.tipoAnillo ?? null,
        juegos,
        hojasPorLibro,
        hojas: totalHojas,
      }),
    };

    // Agregar precioBase y comisiones al TOTAL del tomo (no del seg 0): el
    // desglose de la ficha calcula IIBB = precioNeto − precioBase − comisiones
    // (residual) y margen = precioBase − costo. Si precioBase queda en escala de
    // un segmento, el IIBB explota y el margen sale negativo. Al fijar cantidad
    // de pricing = 1 y precioBase/comisiones = totales del tomo, todo reconcilia.
    const cantSeg = (c: NonNullable<CotizarOutput['cotizacion']>) =>
      Number(
        (c as unknown as Record<string, unknown>).cantidadComercialPricing ??
          (c as unknown as Record<string, unknown>).cantidadEfectiva ??
          1,
      ) || 1;
    const tomoBase = validos.reduce(
      (a, s) =>
        a + Number(s.cot.desglosePrecio?.precioBase ?? 0) * cantSeg(s.cot),
      0,
    );
    const tomoComisiones = validos.reduce(
      (a, s) =>
        a + Number(s.cot.desglosePrecio?.totalComisiones ?? 0) * cantSeg(s.cot),
      0,
    );
    const tomoTrasladoSinMargen =
      validos.reduce(
        (a, s) =>
          a +
          Number(s.cot.desglosePrecio?.trasladoSinMargenUnitario ?? 0) *
            cantSeg(s.cot),
        0,
      ) +
      Number(anilladoCot?.desglosePrecio?.trasladoSinMargenUnitario ?? 0) *
        (anilladoCot ? cantSeg(anilladoCot) : 0) -
      Number(anilladoBase?.desglosePrecio?.trasladoSinMargenUnitario ?? 0) *
        (anilladoBase ? cantSeg(anilladoBase) : 0);

    const base = validos[0]?.cot ?? null;
    const cotizacionSintetica = base
      ? ({
          ...base,
          // Pricing del tomo como 1 unidad: precioBase/comisiones ya son totales.
          cantidadComercialPricing: 1,
          cantidadEfectiva: 1,
          pasos: pasos as never,
          costos,
          desglosePrecio: base.desglosePrecio
            ? {
                ...base.desglosePrecio,
                precioBase: tomoBase,
                totalComisiones: tomoComisiones,
                trasladoSinMargenUnitario: tomoTrasladoSinMargen,
                margenEfectivoPct:
                  subtotal > 0
                    ? ((tomoBase - costos.total) / subtotal) * 100
                    : 0,
                precioNetoTotal: subtotal,
                precioBrutoTotal: total,
                totalImpuestos: iva,
                precioNetoUnitario: subtotal,
                precioBrutoUnitario: total,
              }
            : undefined,
          precio: base.precio
            ? {
                ...base.precio,
                precioTotal: total,
                precioUnitario: juegos > 0 ? redondear(total / juegos) : total,
              }
            : undefined,
        } as NonNullable<CotizarOutput['cotizacion']>)
      : null;

    return {
      tomoNombre,
      juegos,
      anilladoActivo: quiereAnillado,
      costos,
      pasos,
      subtotal,
      iva,
      total,
      especificaciones,
      jobContext,
      cotizacionSintetica,
      base,
      error,
    };
  }

  /** Payload de staging del tomo compuesto (un ItemConstruido para el front). */
  private async construirTomo(
    tenantId: string,
    docs: DocumentoInput[],
    grupo: GrupoCentroCopiadoDto,
    ctx: Ctx,
    grupoCargaId: string,
    periodo: string | null,
  ): Promise<ItemConstruido> {
    const a = await this.agregarTomo(
      tenantId,
      docs,
      grupo,
      ctx,
      grupoCargaId,
      periodo,
    );
    return {
      documentoId: grupo.id,
      grupoTomoId: null, // el compuesto ES un solo renglón (no se agrupa en la ficha)
      nombre: a.tomoNombre,
      productoId: ctx.productoId,
      jobContext: a.jobContext,
      especificaciones: a.especificaciones,
      cantidad: a.juegos,
      unidad: a.anilladoActivo ? 'libros' : 'unidad',
      precioUnitario:
        a.juegos > 0 ? redondear(a.subtotal / a.juegos) : a.subtotal,
      subtotal: a.subtotal,
      impuestoPorcentaje:
        a.subtotal > 0 ? redondear((a.iva / a.subtotal) * 100) : 0,
      impuestoMonto: a.iva,
      total: a.total,
      cotizacion: a.cotizacionSintetica,
      error: a.error,
    };
  }

  /**
   * Persiste el tomo compuesto como UN CotizacionItem sintético (pasos
   * concatenados → materializable; costos/precio sumados). Lo llama el "Guardar
   * cambios" del front para los renglones de tomo (que no pasan por cotizarYGuardar).
   */
  async guardarTomo(
    tenantId: string,
    dto: AgregarAOrdenCentroCopiadoDto,
    periodo: string | null = null,
  ): Promise<{
    cotizacionId: string | null;
    cotizacionItemId: string | null;
    subtotal: number;
    iva: number;
    total: number;
    error: string | null;
  }> {
    if (this.idempotencia && dto.idempotencyKey) {
      return this.idempotencia.ejecutar({
        tenantId,
        tipo: 'guardar_tomo',
        clave: dto.idempotencyKey,
        accion: () => this.guardarTomoInterno(tenantId, dto, periodo),
      });
    }
    return this.guardarTomoInterno(tenantId, dto, periodo);
  }

  private async guardarTomoInterno(
    tenantId: string,
    dto: AgregarAOrdenCentroCopiadoDto,
    periodo: string | null,
  ): Promise<{
    cotizacionId: string | null;
    cotizacionItemId: string | null;
    subtotal: number;
    iva: number;
    total: number;
    error: string | null;
  }> {
    const grupo = dto.grupos?.[0];
    if (!grupo) {
      return {
        cotizacionId: null,
        cotizacionItemId: null,
        subtotal: 0,
        iva: 0,
        total: 0,
        error: 'Falta el tomo.',
      };
    }
    const ctx = await this.contexto(tenantId);
    await this.validarOperacion(tenantId, dto, ctx);
    const grupoCargaId = dto.grupoCargaId ?? randomUUID();
    const a = await this.agregarTomo(
      tenantId,
      dto.documentos as DocumentoInput[],
      grupo,
      ctx,
      grupoCargaId,
      periodo,
    );
    if (a.error || !a.base) {
      return {
        cotizacionId: dto.cotizacionId ?? null,
        cotizacionItemId: null,
        subtotal: 0,
        iva: 0,
        total: 0,
        error: a.error ?? 'No se pudo cotizar el tomo.',
      };
    }
    const desg = a.base.desglosePrecio;
    const persistido = await this.prisma.$transaction(async (tx) => {
      let cotizacionId = dto.cotizacionId;
      if (cotizacionId) {
        const existente = await tx.cotizacion.findFirst({
          where: { id: cotizacionId, tenantId },
          select: { id: true, estado: true },
        });
        if (!existente) {
          throw new NotFoundException('No se encontró la cotización.');
        }
        if (existente.estado !== 'borrador') {
          throw new BadRequestException(
            'Solo se pueden agregar items a una cotización en borrador.',
          );
        }
      } else {
        if (dto.clienteId) {
          const cliente = await tx.cliente.findFirst({
            where: { id: dto.clienteId, tenantId, activo: true },
            select: { id: true },
          });
          if (!cliente) {
            throw new NotFoundException('No se encontró un cliente activo.');
          }
        }
        const nueva = await tx.cotizacion.create({
          data: {
            tenantId,
            clienteId: dto.clienteId ?? null,
            estado: 'borrador',
          },
          select: { id: true },
        });
        cotizacionId = nueva.id;
      }
      const item = await tx.cotizacionItem.create({
        data: dataCotizacionItemTomo({
          tenantId,
          cotizacionId,
          productoId: ctx.productoId,
          rutaAlternativaId: ctx.rutaAlternativaId,
          tomo: {
            juegos: a.juegos,
            anilladoActivo: a.anilladoActivo,
            costos: a.costos,
            subtotal: a.subtotal,
            iva: a.iva,
            total: a.total,
            jobContext: a.jobContext,
            pasos: a.pasos,
            precio: desg
              ? {
                  precioConfig: desg.precioConfig,
                  impuestos: desg.impuestos,
                  comisiones: desg.comisiones,
                  precioEspecialCliente: desg.precioEspecialCliente,
                }
              : null,
          },
        }),
        select: { id: true },
      });
      return { cotizacionId, itemId: item.id };
    });
    return {
      cotizacionId: persistido.cotizacionId,
      cotizacionItemId: persistido.itemId,
      subtotal: a.subtotal,
      iva: a.iva,
      total: a.total,
      error: null,
    };
  }
}
