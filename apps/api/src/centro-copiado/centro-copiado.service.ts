import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  CC_RUTA_CODIGO,
} from './provisionar-plantilla';
import {
  calcularHojas,
  construirSegmento,
  construirSegmentoAnillado,
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
function esTapaFrontalDetect(...textos: Array<string | null | undefined>): boolean {
  return TAPA_TRANSPARENTE_RX.test(textos.filter(Boolean).join(' '));
}

/** Un tipo de papel (materia prima) con sus variantes y gramajes disponibles. */
interface PapelTipo {
  materiaPrimaId: string;
  nombre: string;
  gramajes: number[];
  variantes: VariantePapel[];
}

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
  /**
   * Tapas de encuadernación instaladas (frontal transparente + contratapa
   * cartón). El anillado siempre las incluye; se resuelve por tamaño del
   * documento la variante que cubre (menor área) para cada rol.
   */
  tapas: Array<{
    materiaPrimaId: string;
    nombre: string;
    esFrontal: boolean;
    variantes: Array<{ id: string; anchoMm: number | null; altoMm: number | null }>;
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
const TERMINACIONES_DISPONIBLES = ['Anillado'];

@Injectable()
export class CentroCopiadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly motor: MotorUniversalService,
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
          ? p.gramajes.filter((g) => gramajesOk!.includes(g))
          : p.gramajes,
        variantes: p.variantes
          .filter(
            (v) =>
              !usaFiltro ||
              v.gramajeGr == null ||
              gramajesOk!.includes(v.gramajeGr),
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
      new Set(ctx.anillos.map((a) => a.tipoAnillo).filter(Boolean)),
    ).map((value) => ({ value, label: labelTipoAnillo(value) }));
    return {
      papeles,
      papelDefaultId:
        obra?.materiaPrimaId ?? papeles[0]?.materiaPrimaId ?? null,
      terminaciones:
        (config.terminacionesJson as string[] | null) ??
        TERMINACIONES_DISPONIBLES,
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
  async estado(tenantId: string): Promise<{ activo: boolean }> {
    const c = await this.prisma.centroCopiadoConfig.findUnique({
      where: { tenantId },
      select: { activo: true },
    });
    return { activo: c?.activo ?? true };
  }

  /** Carga (o crea vacía) la configuración del centro de copiado del tenant. */
  private async configDe(tenantId: string) {
    return this.prisma.centroCopiadoConfig.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  /**
   * Precio y tiempos de máquina del producto/paso plantilla de CC (que el usuario
   * no ve en el editor de rutas). Margen vive en Producto.precioConfigJson; setup/
   * cleanup en ProductoConfigPaso.setupOverrideMin/cleanupOverrideMin (override
   * propio de CC, gana sobre el perfil de la máquina sin pisarlo).
   */
  private async preciosYTiemposCC(tenantId: string): Promise<{
    productoId: string | null;
    configPasoId: string | null;
    margenPct: number;
    margenMinimoPct: number;
    setupMin: number;
    cleanupMin: number;
  }> {
    const producto = await this.prisma.producto.findUnique({
      where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
      select: {
        id: true,
        precioConfigJson: true,
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
    return {
      productoId: producto?.id ?? null,
      configPasoId: cp?.id ?? null,
      margenPct: Number(detalle.marginPct ?? 40),
      margenMinimoPct: Number(detalle.minimumMarginPct ?? 25),
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
      where: { tenantId, plantilla: 'IMPRESORA_LASER', activo: true },
      include: { componentesDesgaste: { select: { soloColor: true } } },
      orderBy: { nombre: 'asc' },
    });
    const anilladoras = await this.prisma.maquina.findMany({
      where: { tenantId, plantilla: 'ANILLADORA', activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    return {
      activo: config.activo,
      cobraSetup: config.cobraSetup,
      margenPct: precios.margenPct,
      margenMinimoPct: precios.margenMinimoPct,
      setupMin: precios.setupMin,
      cleanupMin: precios.cleanupMin,
      // Selección actual del tenant (null = todos / default / auto-resolver).
      papeles: (config.papelesJson as PapelConfig[] | null) ?? null,
      tamanos: (config.tamanosJson as string[] | null) ?? null,
      terminaciones: (config.terminacionesJson as string[] | null) ?? null,
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
        })),
        terminaciones: TERMINACIONES_DISPONIBLES,
        maquinas: laseres.map((m) => ({
          id: m.id,
          nombre: m.nombre,
          esColor: m.componentesDesgaste.some((c) => c.soloColor),
        })),
        anilladoras: anilladoras.map((m) => ({ id: m.id, nombre: m.nombre })),
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
  async actualizarConfig(
    tenantId: string,
    dto: ActualizarCentroCopiadoConfigDto,
  ) {
    await this.configDe(tenantId);
    const jsonOrNull = (v: unknown) =>
      v == null ? Prisma.DbNull : (v as never);
    await this.prisma.centroCopiadoConfig.update({
      where: { tenantId },
      data: {
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
          ? { tapaContratapaMateriaPrimaId: dto.tapaContratapaMateriaPrimaId }
          : {}),
      },
    });
    // Si cambió la selección de máquinas, se regeneran las candidatas del paso
    // (el motor sólo rutea a candidatas). Si no se eligió ninguna, se deja lo
    // auto-resuelto por el provisionador.
    if (dto.maquinaColorId !== undefined || dto.maquinaBnId !== undefined) {
      await this.regenerarCandidatas(tenantId);
    }
    // Margen (Producto.precioConfigJson) y setup/cleanup (config paso) viven en el
    // producto/paso plantilla, no en CentroCopiadoConfig — el motor los lee de ahí.
    await this.aplicarPrecioYTiempos(tenantId, dto);
    return this.getConfig(tenantId);
  }

  /**
   * Persiste margen (en el precioConfigJson del producto CC) y setup/cleanup (en
   * los overrides del config paso). Sólo escribe lo que vino en el dto.
   */
  private async aplicarPrecioYTiempos(
    tenantId: string,
    dto: ActualizarCentroCopiadoConfigDto,
  ): Promise<void> {
    const tocaMargen =
      dto.margenPct !== undefined || dto.margenMinimoPct !== undefined;
    const tocaTiempos =
      dto.setupMin !== undefined || dto.cleanupMin !== undefined;
    if (!tocaMargen && !tocaTiempos) return;

    const actual = await this.preciosYTiemposCC(tenantId);

    if (tocaMargen && actual.productoId) {
      await this.prisma.producto.update({
        where: { id: actual.productoId },
        data: {
          precioConfigJson: {
            metodoCalculo: 'por_margen',
            detalle: {
              marginPct: dto.margenPct ?? actual.margenPct,
              minimumMarginPct: dto.margenMinimoPct ?? actual.margenMinimoPct,
            },
          },
        },
      });
    }
    if (tocaTiempos && actual.configPasoId) {
      await this.prisma.productoConfigPaso.update({
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
   * selección, no toca nada (queda lo auto-resuelto). Idempotente y contenido:
   * ante error el motor cae a la M-1 default del paso.
   */
  private async regenerarCandidatas(tenantId: string): Promise<void> {
    const config = await this.configDe(tenantId);
    const colorId = config.maquinaColorId;
    const bnId = config.maquinaBnId;
    if (!colorId && !bnId) return; // sin selección: se respeta lo auto-resuelto

    const producto = await this.prisma.producto.findUnique({
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
    const maquinas = await this.prisma.maquina.findMany({
      where: { id: { in: ids }, tenantId },
      include: { perfilesOperativos: { select: { id: true, nombre: true } } },
    });
    const perfilId = (mid: string | null): string | null => {
      const m = maquinas.find((x) => x.id === mid);
      if (!m) return null;
      const simple = m.perfilesOperativos.find((p) => /simple/i.test(p.nombre));
      return (simple ?? m.perfilesOperativos[0])?.id ?? null;
    };
    const existe = (mid: string | null) =>
      !!mid && maquinas.some((m) => m.id === mid);

    await this.prisma.$transaction(async (tx) => {
      await tx.productoConfigPasoMaquinaCandidata.deleteMany({
        where: { productoConfigPasoId: cp.id },
      });
      if (existe(colorId) && colorId === bnId) {
        // Una sola láser hace color y B/N.
        await tx.productoConfigPasoMaquinaCandidata.create({
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
        await tx.productoConfigPasoMaquinaCandidata.create({
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
        await tx.productoConfigPasoMaquinaCandidata.create({
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
    });
  }

  /** Resuelve la variante + etiqueta legible para (tipo, gramaje, tamaño). */
  private resolverPapel(
    papeles: PapelTipo[],
    materiaPrimaId: string,
    pliego: PliegoDim,
    gramaje?: number | null,
  ): { varianteId: string | null; label: string } {
    const tipo =
      papeles.find((p) => p.materiaPrimaId === materiaPrimaId) ?? papeles[0];
    if (!tipo) return { varianteId: null, label: '—' };
    const varianteId = resolverVariantePapel(tipo.variantes, pliego, gramaje);
    const v = tipo.variantes.find((x) => x.id === varianteId);
    const partes = [tipo.nombre];
    if (v?.formatoComercial) partes.push(v.formatoComercial);
    if (v?.gramajeGr != null) partes.push(`${v.gramajeGr}g`);
    return { varianteId, label: partes.join(' · ') };
  }

  /** Provisiona (idempotente) y resuelve el contexto del plantilla + papeles. */
  private async contexto(tenantId: string): Promise<Ctx> {
    await provisionarPlantillaCentroCopiado(this.prisma, tenantId);
    const config = await this.configDe(tenantId);
    const producto = await this.prisma.producto.findUniqueOrThrow({
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
    const rutaAlt = producto.rutasAlternativas[0];
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
      tapas,
      tapaFrontalMpId: config.tapaFrontalMateriaPrimaId,
      tapaContratapaMpId: config.tapaContratapaMateriaPrimaId,
    };
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
    const r = await this.motor.cotizar({
      tenantId,
      productoId: ctx.productoId,
      periodo,
      jobContext: jobContext as never,
    });
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
    return {
      ...base,
      pliegos: montos.pliegos,
      subtotal: montos.subtotal,
      iva: montos.iva,
      total: montos.total,
      anillado: anil?.meta ?? null,
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
    const armado = this.armarAnillado(
      ctx,
      juegos,
      hojasPorLibro,
      miembrosDto,
      tipoAnillo,
    );
    if (!armado) return null; // sin anilladora/anillos o juegos/hojas <= 0
    if (armado.error) {
      return {
        subtotal: 0,
        iva: 0,
        total: 0,
        tipoAnillo: armado.tipoAnillo,
        diametroMm: armado.diametroMm,
        error: armado.error,
      };
    }
    const r = await this.motor.cotizar({
      tenantId,
      productoId: ctx.productoId,
      periodo,
      jobContext: armado.jobContext as never,
    });
    if (!r.exitoso || !r.cotizacion) {
      return {
        subtotal: 0,
        iva: 0,
        total: 0,
        tipoAnillo: armado.tipoAnillo,
        diametroMm: armado.diametroMm,
        error: r.errores?.[0]?.mensaje ?? 'No se pudo cotizar el anillado.',
      };
    }
    const m = this.extraerMontos(r.cotizacion);
    return {
      subtotal: m.subtotal,
      iva: m.iva,
      total: m.total,
      tipoAnillo: armado.tipoAnillo,
      diametroMm: armado.diametroMm,
      error: null,
    };
  }

  /**
   * Resuelve el jobContext del anillado (ítem propio: 1 anillo por libro, la
   * impresión de andamiaje va en 0) o el motivo de degradación. Compartido por el
   * preview (`cotizar`) y el guardado (`construirItems`) para que den lo mismo.
   */
  private armarAnillado(
    ctx: Ctx,
    juegos: number,
    hojasPorLibro: number,
    miembrosDto: DocumentoInput[],
    tipoAnillo: string,
  ): {
    jobContext: Record<string, unknown> | null;
    diametroMm: number | null;
    tipoAnillo: string;
    error: string | null;
  } | null {
    if (!ctx.anilladoConfigPasoId) return null; // sin anilladora/anillos: no aplica
    if (juegos <= 0 || hojasPorLibro <= 0) return null;
    const tipo = tipoAnillo || this.tipoAnilladoDefault(ctx);

    // Sub-doc representativo: el primero cuyo papel resuelve (sólo andamiaje).
    let repr: { doc: DocumentoInput; varianteId: string } | null = null;
    for (const d of miembrosDto) {
      const { varianteId } = this.resolverPapel(
        ctx.papeles,
        d.papelMateriaPrimaId,
        pliegoDeDoc(d),
        d.gramaje,
      );
      if (varianteId) {
        repr = { doc: d, varianteId };
        break;
      }
    }
    if (!repr) {
      return {
        jobContext: null,
        diametroMm: null,
        tipoAnillo: tipo,
        error: 'No hay papel disponible para el anillado.',
      };
    }

    // ¿Hay un anillo de ese tipo que cubra las hojas del libro? El motor elige el
    // mismo (menor capacidad que cumple, dentro del tipo); si ninguno cubre, se
    // degrada con motivo.
    const diametroMm = this.diametroAnilladoParaHojas(ctx, hojasPorLibro, tipo);
    if (diametroMm == null) {
      return {
        jobContext: null,
        diametroMm: null,
        tipoAnillo: tipo,
        error: `Ningún anillo de ese tipo cubre ${hojasPorLibro} hojas.`,
      };
    }

    // Tapa/contratapa resueltas por el tamaño del sub-doc representativo (todos
    // los del tomo comparten tamaño de anillado en v1). Wire-O no lleva tapas.
    const tapas = this.resolverTapasCC(ctx, pliegoDeDoc(repr.doc), tipo);
    const jobContext = construirSegmentoAnillado(
      repr.doc,
      ctx,
      juegos,
      hojasPorLibro,
      repr.varianteId,
      ctx.anilladoConfigPasoId,
      tipo,
      tapas.slotMateriales,
    );
    return { jobContext, diametroMm, tipoAnillo: tipo, error: null };
  }

  /** Tipo de anillo por defecto: el primero instalado (o espiral plástico). */
  private tipoAnilladoDefault(ctx: Ctx): string {
    return ctx.anillos[0]?.tipoAnillo || 'ESPIRAL_PLASTICO';
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
   * (additions=null) y el meta lleva el motivo (el ítem se cotiza sin anillado).
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
        const quiereAnillado = (g.terminaciones ?? ['Anillado']).some(
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
            : null,
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
   * Persiste la carga como N CotizacionItem (un renglón por documento) en una
   * cotización borrador. Un tomo son N renglones agrupados por `grupoTomoId`, más
   * un renglón de anillado (1 por tomo/suelto con la terminación). La metadata de
   * agrupación viaja en `jobContext._centroCopiado`, que persiste en
   * `jobContextJson` para el alta de la OT (specsJson).
   *
   * NOTA: el modal usa el flujo de staging (`construirItems`); este camino eager
   * se mantiene en paridad por si algún consumidor lo usa.
   */
  async agregarAOrden(
    tenantId: string,
    dto: AgregarAOrdenCentroCopiadoDto,
    periodo: string | null = null,
  ): Promise<AgregarAOrdenResultado> {
    const ctx = await this.contexto(tenantId);
    const grupoCargaId = dto.grupoCargaId ?? randomUUID();
    const cotizacionId = await this.asegurarCotizacion(
      tenantId,
      dto.cotizacionId,
      dto.clienteId,
    );
    const gruposById = new Map((dto.grupos ?? []).map((g) => [g.id, g]));

    const docItems = await Promise.all(
      dto.documentos.map((doc) =>
        this.agregarDocumento(
          tenantId,
          doc as DocumentoInput,
          ctx,
          doc.grupoId ? gruposById.get(doc.grupoId) : undefined,
          grupoCargaId,
          cotizacionId,
          periodo,
        ),
      ),
    );

    // Renglones de anillado (1 por tomo con Anillado + 1 por suelto con Anillado).
    const emitidos = new Set<string>();
    const anilladoJobs: Array<{
      juegos: number;
      hojasPorLibro: number;
      miembros: DocumentoInput[];
      tipoAnillo: string;
      nombreBase: string;
      grupoTomoId: string | null;
      idBase: string;
    }> = [];
    for (const doc of dto.documentos) {
      const d = doc as DocumentoInput;
      const hojasDe = (x: DocumentoInput) =>
        x.faz === 2 ? Math.ceil(x.paginas / 2) : x.paginas;
      if (d.grupoId) {
        if (emitidos.has(d.grupoId)) continue;
        emitidos.add(d.grupoId);
        const grupo = gruposById.get(d.grupoId);
        if (
          !grupo ||
          !(grupo.terminaciones ?? ['Anillado']).includes('Anillado')
        )
          continue;
        const miembros = dto.documentos.filter(
          (x) => x.grupoId === d.grupoId,
        ) as DocumentoInput[];
        anilladoJobs.push({
          juegos: grupo.juegos,
          hojasPorLibro: miembros.reduce((a, x) => a + hojasDe(x), 0),
          miembros,
          tipoAnillo: grupo.tipoAnillo ?? '',
          nombreBase: grupo.nombre ?? 'Tomo anillado',
          grupoTomoId: grupo.id,
          idBase: grupo.id,
        });
      }
      // Los sueltos NO llevan renglón de anillado: va folded en su propio ítem
      // (agregarDocumento activa el paso opcional en el jobContext).
    }
    const anilladoItems = (
      await Promise.all(
        anilladoJobs.map((j) =>
          this.agregarAnilladoItem(
            tenantId,
            ctx,
            j.juegos,
            j.hojasPorLibro,
            j.miembros,
            j.tipoAnillo,
            grupoCargaId,
            j.nombreBase,
            j.grupoTomoId,
            j.idBase,
            cotizacionId,
            periodo,
          ),
        ),
      )
    ).filter((i): i is ItemAgregado => !!i);

    const items = [...docItems, ...anilladoItems];
    const validos = items.filter((i) => !i.error);
    const tomos = new Set(
      items.map((i) => i.grupoTomoId).filter((g): g is string => !!g),
    );
    return {
      cotizacionId,
      grupoCargaId,
      items,
      totales: {
        documentos: dto.documentos.length,
        tomos: tomos.size,
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
        where: { id: clienteId, tenantId },
        select: { id: true },
      });
      if (!cliente) throw new NotFoundException('No se encontró el cliente.');
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
    // Terminaciones: las del tomo si está agrupado (Anillado por defecto), o las
    // del documento suelto. Sin costo aún (los pasos opcionales están diferidos).
    const terminaciones = grupo
      ? (grupo.terminaciones ?? ['Anillado'])
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
    const jobImpresion = this.foldAnillado(seg.jobContext, anil?.additions);
    if (anil?.meta && !anil.meta.error && anil.meta.diametroMm) {
      especificaciones['Anillo'] =
        `${labelTipoAnillo(anil.meta.tipoAnillo)} Ø${anil.meta.diametroMm} mm`;
      const tapasLabel = this.especificacionTapas(anil.tapas);
      if (tapasLabel) especificaciones['Tapas'] = tapasLabel;
    }
    const jobContext = {
      ...jobImpresion,
      // Persiste en jobContextJson: agrupación + datos para nombrar/rehidratar.
      _centroCopiado: {
        grupoCargaId,
        grupoTomoId: doc.grupoId ?? null,
        tomoNombre,
        terminacion,
        terminaciones,
        tipoAnillo: grupo
          ? (grupo.tipoAnillo ?? null)
          : (doc.tipoAnillo ?? null),
        nombre: doc.nombre ?? null,
        paginas: doc.paginas,
        copias,
        tamano: doc.tamano,
        tamanoAnchoMm: doc.tamanoAnchoMm,
        tamanoAltoMm: doc.tamanoAltoMm,
        papelMateriaPrimaId: doc.papelMateriaPrimaId,
        gramaje: doc.gramaje ?? null,
        papelLabel,
        color: doc.color,
        faz: doc.faz,
        cobertura: doc.cobertura ?? 'alta',
        carillas,
        hojas,
      },
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
   * Renglón de ANILLADO del TOMO en el camino EAGER `agregarAOrden` (que arma N
   * renglones por sub-doc, no un compuesto). El modal usa `construirItems`, donde
   * el anillado va FOLDED en el ítem. Devuelve null si no aplica o degrada.
   */
  private async agregarAnilladoItem(
    tenantId: string,
    ctx: Ctx,
    juegos: number,
    hojasPorLibro: number,
    miembrosDto: DocumentoInput[],
    tipoAnillo: string,
    grupoCargaId: string,
    nombreBase: string,
    grupoTomoId: string | null,
    idBase: string,
    cotizacionId: string,
    periodo: string | null,
  ): Promise<ItemAgregado | null> {
    const armado = this.armarAnillado(
      ctx,
      juegos,
      hojasPorLibro,
      miembrosDto,
      tipoAnillo,
    );
    if (!armado || armado.error || !armado.jobContext) return null;
    const jobContext = {
      ...armado.jobContext,
      _centroCopiado: {
        esAnillado: true,
        grupoCargaId,
        grupoTomoId,
        juegos,
        hojasPorLibro,
        diametroMm: armado.diametroMm,
        nombre: nombreBase,
      },
    };
    const base = {
      documentoId: `${idBase}::anillado`,
      grupoTomoId,
      nombre: `Anillado — ${nombreBase}`,
      carillas: 0,
      hojas: 0,
    };
    try {
      const { result, cotizacionItemId } = await this.motor.cotizarYGuardar({
        tenantId,
        productoId: ctx.productoId,
        jobContext: jobContext as never,
        cotizacionId,
        periodo,
      });
      if (!result.exitoso || !result.cotizacion || !cotizacionItemId) {
        return null;
      }
      const { subtotal, iva, total } = this.extraerMontos(result.cotizacion);
      return { ...base, cotizacionItemId, subtotal, iva, total, error: null };
    } catch {
      return null;
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
    const tomoNombre = grupo.nombre ?? 'Tomo anillado';
    const terminaciones = grupo.terminaciones ?? ['Anillado'];
    const terminacion = terminaciones.length
      ? terminaciones.join(', ')
      : 'Anillado';

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

    const error = segs.find((s) => s.error)?.error ?? null;
    const validos = segs.filter(
      (s): s is typeof s & { cot: NonNullable<CotizarOutput['cotizacion']> } =>
        !!s.cot,
    );
    const hojasPorLibro = docs.reduce(
      (a, d) => a + (d.faz === 2 ? Math.ceil(d.paginas / 2) : d.paginas),
      0,
    );

    // Anillado del tomo mergeado en el MISMO ítem: se cotiza aparte (andamiaje
    // de impresión en 0) y se foldean sus montos/costos/paso al compuesto. Sólo
    // su paso `encuadernado_anillado` (la impresión andamiaje se descarta).
    const quiereAnillado = terminaciones.includes('Anillado');
    let anilladoCot: NonNullable<CotizarOutput['cotizacion']> | null = null;
    let anilladoDiametro: number | null = null;
    if (quiereAnillado && !error) {
      const armado = this.armarAnillado(
        ctx,
        juegos,
        hojasPorLibro,
        docs,
        grupo.tipoAnillo ?? '',
      );
      if (armado && !armado.error && armado.jobContext) {
        const rA = await this.motor.cotizar({
          tenantId,
          productoId: ctx.productoId,
          periodo,
          jobContext: armado.jobContext as never,
        });
        if (rA.exitoso && rA.cotizacion) {
          anilladoCot = rA.cotizacion;
          anilladoDiametro = armado.diametroMm;
        }
      }
    }
    const montosAnil = anilladoCot
      ? this.extraerMontos(anilladoCot)
      : { subtotal: 0, iva: 0, total: 0 };

    const sum = (
      f: (m: { subtotal: number; iva: number; total: number }) => number,
    ) => validos.reduce((a, s) => a + f(this.extraerMontos(s.cot)), 0);
    const subtotal = redondear(sum((m) => m.subtotal) + montosAnil.subtotal);
    const iva = redondear(sum((m) => m.iva) + montosAnil.iva);
    const total = redondear(sum((m) => m.total) + montosAnil.total);

    const costos = {
      tiempoTotal:
        validos.reduce((a, s) => a + s.cot.costos.tiempoTotal, 0) +
        (anilladoCot?.costos.tiempoTotal ?? 0),
      materialesTotal:
        validos.reduce((a, s) => a + s.cot.costos.materialesTotal, 0) +
        (anilladoCot?.costos.materialesTotal ?? 0),
      cargosDirectosTotal:
        validos.reduce((a, s) => a + s.cot.costos.cargosDirectosTotal, 0) +
        (anilladoCot?.costos.cargosDirectosTotal ?? 0),
      tercerizadoTotal:
        validos.reduce((a, s) => a + s.cot.costos.tercerizadoTotal, 0) +
        (anilladoCot?.costos.tercerizadoTotal ?? 0),
      total:
        validos.reduce((a, s) => a + s.cot.costos.total, 0) +
        (anilladoCot?.costos.total ?? 0),
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
      _centroCopiado: {
        esTomo: true,
        grupoCargaId,
        tomoNombre,
        terminacion,
        terminaciones,
        tipoAnillo: grupo.tipoAnillo ?? null,
        juegos,
        hojasPorLibro,
        hojas: totalHojas,
        documentos: docs.length,
        // Los sub-documentos, para rehidratar al editar y para reconstruir al guardar.
        segmentos: docs.map((d) => ({
          nombre: d.nombre ?? null,
          paginas: d.paginas,
          tamano: d.tamano,
          tamanoAnchoMm: d.tamanoAnchoMm,
          tamanoAltoMm: d.tamanoAltoMm,
          papelMateriaPrimaId: d.papelMateriaPrimaId,
          gramaje: d.gramaje ?? null,
          color: d.color,
          faz: d.faz,
          cobertura: d.cobertura ?? 'alta',
        })),
      },
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
      // El tomo siempre anilla: se mide en libros (1 libro = 1 juego).
      unidad: 'libros',
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
    const grupoCargaId = dto.grupoCargaId ?? randomUUID();
    const cotizacionId = await this.asegurarCotizacion(
      tenantId,
      dto.cotizacionId,
      dto.clienteId,
    );
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
        cotizacionId,
        cotizacionItemId: null,
        subtotal: 0,
        iva: 0,
        total: 0,
        error: a.error ?? 'No se pudo cotizar el tomo.',
      };
    }
    const desg = a.base.desglosePrecio;
    const precioUnitario = a.juegos > 0 ? a.total / a.juegos : a.total;
    const item = await this.prisma.cotizacionItem.create({
      data: {
        tenantId,
        cotizacionId,
        productoId: ctx.productoId,
        rutaAlternativaId: ctx.rutaAlternativaId,
        cantidad: String(a.juegos),
        jobContextJson: a.jobContext as never,
        snapshotJson: {
          producto: {
            id: ctx.productoId,
            codigo: CC_PRODUCTO_CODIGO,
            nombre: 'Impresión por hoja',
            // El tomo siempre anilla: se mide en libros (1 libro = 1 juego).
            unidadComercial: 'libros',
            modoMedidas: 'MIXTA',
            minimoComercialBase: 'cantidad_comercial',
          },
          ruta: {
            codigo: CC_RUTA_CODIGO,
            nombre: 'Impresión de documento (centro de copiado)',
            alternativa: 'Impresión digital',
          },
          ejecucion: { cantidadComercialReal: a.juegos, costos: a.costos },
        } as never,
        costoUnitario: String(a.costos.unitario),
        costoTotal: String(a.costos.total),
        precioUnitario: String(precioUnitario),
        precioTotal: String(a.total),
        trazabilidadJson: {
          pasos: a.pasos,
          cargosDirectosCotizacion: [],
        } as never,
        precioConfigSnapshotJson: (desg?.precioConfig ?? null) as never,
        impuestosSnapshotJson: (desg?.impuestos ?? null) as never,
        comisionesSnapshotJson: (desg?.comisiones ?? null) as never,
        precioEspecialClienteSnapshotJson: (desg?.precioEspecialCliente ??
          null) as never,
      },
    });
    return {
      cotizacionId,
      cotizacionItemId: item.id,
      subtotal: a.subtotal,
      iva: a.iva,
      total: a.total,
      error: null,
    };
  }
}
