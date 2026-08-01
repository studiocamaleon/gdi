import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MotorUniversalService } from '../motor-universal/motor.service';
import type { CotizarOutput } from '../motor-universal/tipos';
import {
  provisionarPlantillaCentroCopiado,
  CC_PRODUCTO_CODIGO,
  CC_RUTA_CODIGO,
} from './provisionar-plantilla';
import {
  calcularHojas,
  construirSegmento,
  resolverVariantePapel,
  pliegoDeDoc,
  DocumentoInput,
  PlantillaContexto,
  VariantePapel,
} from './adaptador';
import { PliegoDim } from './pliegos';

/** Un tipo de papel (materia prima) con sus variantes y gramajes disponibles. */
interface PapelTipo {
  materiaPrimaId: string;
  nombre: string;
  gramajes: number[];
  variantes: VariantePapel[];
}

/** Contexto del plantilla + papeles disponibles (resueltos por request). */
type Ctx = PlantillaContexto & { papeles: PapelTipo[] };
import {
  AgregarAOrdenCentroCopiadoDto,
  CotizarCentroCopiadoDto,
  GrupoCentroCopiadoDto,
} from './dto/cotizar-centro-copiado.dto';

export interface DocumentoResultado {
  id: string;
  grupoId: string | null;
  carillas: number;
  hojas: number;
  pliegos: number;
  subtotal: number;
  iva: number;
  total: number;
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
  }> {
    const ctx = await this.contexto(tenantId);
    const obra = ctx.papeles.find((p) => /obra/i.test(p.nombre));
    return {
      papeles: ctx.papeles.map((p) => ({
        materiaPrimaId: p.materiaPrimaId,
        nombre: p.nombre,
        gramajes: p.gramajes,
        variantes: p.variantes.map((v) => ({
          formatoComercial: v.formatoComercial,
          anchoMm: v.anchoMm,
          altoMm: v.altoMm,
          gramajeGr: v.gramajeGr,
        })),
      })),
      papelDefaultId:
        obra?.materiaPrimaId ?? ctx.papeles[0]?.materiaPrimaId ?? null,
      terminaciones: TERMINACIONES_DISPONIBLES,
    };
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
    const producto = await this.prisma.producto.findUniqueOrThrow({
      where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
      include: {
        rutasAlternativas: {
          where: { activo: true },
          include: { configPasos: { include: { maquinasCandidatas: true } } },
        },
      },
    });
    const rutaAlt = producto.rutasAlternativas[0];
    const cp = rutaAlt.configPasos[0];
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
    return {
      productoId: producto.id,
      rutaAlternativaId: rutaAlt.id,
      configPasoId: cp.id,
      maquinaColorId: color?.maquinaId ?? null,
      maquinaBnId: bn?.maquinaId ?? null,
      papeles,
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
    const base = { id: doc.id, grupoId: doc.grupoId ?? null, carillas, hojas };
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
    const r = await this.motor.cotizar({
      tenantId,
      productoId: ctx.productoId,
      periodo,
      jobContext: seg.jobContext as never,
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
    return { ...base, ...this.extraerMontos(r.cotizacion), error: null };
  }

  /** Pliegos + subtotal (neto) / IVA / total (bruto) de una cotización exitosa. */
  private extraerMontos(cotizacion: NonNullable<CotizarOutput['cotizacion']>): {
    pliegos: number;
    subtotal: number;
    iva: number;
    total: number;
  } {
    const imp = cotizacion.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
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

    // Grupos (tomos): suma de sus documentos. Anillado DIFERIDO (se sumará su
    // línea cuando el taller cargue anilladora + anillos).
    const grupos: GrupoResultado[] = (dto.grupos ?? []).map((g) => {
      const miembros = documentos.filter((d) => d.grupoId === g.id);
      const validos = miembros.filter((d) => !d.error);
      const miembrosDto = dto.documentos.filter((d) => d.grupoId === g.id);
      const hojasPorLibro = suma(
        miembrosDto.map((d) =>
          d.faz === 2 ? Math.ceil(d.paginas / 2) : d.paginas,
        ),
      );
      return {
        id: g.id,
        juegos: g.juegos,
        hojasPorLibro,
        subtotal: redondear(suma(validos.map((d) => d.subtotal))),
        iva: redondear(suma(validos.map((d) => d.iva))),
        total: redondear(suma(validos.map((d) => d.total))),
        error: miembros.some((d) => d.error)
          ? 'Uno o más documentos del tomo no se pudieron cotizar'
          : null,
      };
    });

    const validos = documentos.filter((d) => !d.error);
    return {
      documentos,
      grupos,
      totales: {
        documentos: dto.documentos.length,
        tomos: grupos.length,
        carillas: suma(documentos.map((d) => d.carillas)),
        hojasFisicas: suma(documentos.map((d) => d.hojas)),
        subtotal: redondear(suma(validos.map((d) => d.subtotal))),
        iva: redondear(suma(validos.map((d) => d.iva))),
        total: redondear(suma(validos.map((d) => d.total))),
      },
    };
  }

  /**
   * Persiste la carga como N CotizacionItem (un renglón por documento) en una
   * cotización borrador. Anillado DIFERIDO ⇒ un tomo son N renglones agrupados
   * por `grupoTomoId` (no un item compuesto). La metadata de agrupación viaja en
   * `jobContext._centroCopiado`, que persiste en `jobContextJson` para el alta
   * de la OT (specsJson).
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

    const items = await Promise.all(
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
      Papel: papelLabel,
      Color: doc.color === 'COLOR' ? 'Color' : 'Blanco y negro',
      Faz: doc.faz === 2 ? 'Doble faz (2 caras)' : 'Simple faz (1 cara)',
      Páginas: String(doc.paginas),
      Copias: String(copias),
      Carillas: String(carillas),
      'Hojas físicas': String(hojas),
      Terminación: terminacion,
    };
    if (tomoNombre) especificaciones['Tomo'] = tomoNombre;
    if (!varianteId) {
      return {
        copias,
        carillas,
        hojas,
        nombre,
        jobContext: null,
        especificaciones,
        error: 'No hay papel disponible para ese tamaño.',
      };
    }
    const seg = construirSegmento(doc, ctx, copias, varianteId);
    const jobContext = {
      ...seg.jobContext,
      // Persiste en jobContextJson: agrupación + datos para nombrar/rehidratar.
      _centroCopiado: {
        grupoCargaId,
        grupoTomoId: doc.grupoId ?? null,
        tomoNombre,
        terminacion,
        terminaciones,
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
        carillas,
        hojas,
      },
    };
    return {
      copias,
      carillas,
      hojas,
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
        const docs = dto.documentos.filter((d) => d.grupoId === doc.grupoId);
        if (grupo) {
          items.push(
            await this.construirTomo(
              tenantId,
              docs as DocumentoInput[],
              grupo,
              ctx,
              grupoCargaId,
              periodo,
            ),
          );
        }
      } else {
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
    const base = {
      documentoId: doc.id,
      grupoTomoId: doc.grupoId ?? null,
      nombre: p.nombre,
      productoId: ctx.productoId,
      jobContext: p.jobContext ?? {},
      especificaciones: p.especificaciones,
      cantidad: p.hojas,
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
      p.hojas > 0 ? redondear(subtotal / p.hojas) : subtotal;
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

    const sum = (
      f: (m: { subtotal: number; iva: number; total: number }) => number,
    ) => validos.reduce((a, s) => a + f(this.extraerMontos(s.cot)), 0);
    const subtotal = redondear(sum((m) => m.subtotal));
    const iva = redondear(sum((m) => m.iva));
    const total = redondear(sum((m) => m.total));

    const costos = {
      tiempoTotal: validos.reduce((a, s) => a + s.cot.costos.tiempoTotal, 0),
      materialesTotal: validos.reduce(
        (a, s) => a + s.cot.costos.materialesTotal,
        0,
      ),
      cargosDirectosTotal: validos.reduce(
        (a, s) => a + s.cot.costos.cargosDirectosTotal,
        0,
      ),
      tercerizadoTotal: validos.reduce(
        (a, s) => a + s.cot.costos.tercerizadoTotal,
        0,
      ),
      total: validos.reduce((a, s) => a + s.cot.costos.total, 0),
      unitario: 0,
    };
    costos.unitario = juegos > 0 ? costos.total / juegos : costos.total;

    // Re-indexar rutaPasoOrden global y etiquetar cada paso con su documento:
    // sin re-indexar, los pasos de todos los segmentos comparten orden 0 y la
    // ficha colisiona keys (rutaPasoOrden-familiaCodigo).
    let ordenGlobal = 0;
    const pasos = validos.flatMap((s) => {
      const docNombre = s.doc.nombre ?? 'Documento';
      return (
        (s.cot.pasos as unknown as Array<Record<string, unknown>>) ?? []
      ).map((p) => ({
        ...p,
        rutaPasoOrden: ordenGlobal++,
        nombreVisible: `${
          (p.nombreVisible as string) ?? (p.nombre as string) ?? 'Impresión'
        } — ${docNombre}`,
      }));
    });
    const hojasPorLibro = docs.reduce(
      (a, d) => a + (d.faz === 2 ? Math.ceil(d.paginas / 2) : d.paginas),
      0,
    );
    const totalHojas = segs.reduce((a, s) => a + s.prep.hojas, 0);

    const especificaciones: Record<string, string> = {
      Terminación: terminacion,
      Juegos: String(juegos),
      Documentos: String(docs.length),
      'Hojas por juego': String(hojasPorLibro),
      'Hojas físicas': String(totalHojas),
    };
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
            unidadComercial: 'unidad',
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
