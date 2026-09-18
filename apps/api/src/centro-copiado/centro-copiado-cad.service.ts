import {
  cantidadImpresionesCad,
  mapaCopiasCad,
  errorCopiasPorPagina,
} from '../common/copias-paginas-cad';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MotorUniversalService } from '../motor-universal/motor.service';
import { PerfilesCadService } from '../impresion/perfiles-cad.service';
import { esConfiguracionCad, planPaginaCad } from '../impresion/cad.domain';
import { enlacePerfilCad } from '../impresion/perfiles-cad.domain';
import {
  errorMedidasDocumento,
  medidasSeleccionadas,
  resumenMedidas,
} from '../common/medidas-documento';
import {
  errorPaginasDocumento,
  metadataRangoPaginas,
} from '../common/rangos-paginas';
import type { DocumentoInput } from './adaptador';
import type {
  ItemConstruido,
  DocumentoResultado,
} from './centro-copiado.service';

const redondear = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class CentroCopiadoCadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perfiles: PerfilesCadService,
    private readonly motor: MotorUniversalService,
  ) {}

  /** Datos comerciales: no expone hosts, colas Windows ni permisos de ajustes. */
  async opciones(tenantId: string) {
    const perfiles = await this.prisma.impresionPerfil.findMany({
      where: {
        tenantId,
        activo: true,
        tamano: 'CAD',
        bandeja: { tenantId, destino: { tenantId, activo: true } },
      },
      include: { bandeja: { include: { destino: true } } },
      orderBy: [{ prioridad: 'desc' }, { nombre: 'asc' }],
    });
    const destinos = new Map<
      string,
      Awaited<ReturnType<PerfilesCadService['opciones']>>['opciones']
    >();
    const opciones = [];
    for (const p of perfiles) {
      const d = p.bandeja.destino;
      if (!esConfiguracionCad(d.cad)) continue;
      if (!destinos.has(d.id)) {
        try {
          destinos.set(
            d.id,
            (await this.perfiles.opciones(tenantId, d.id)).opciones,
          );
        } catch (e) {
          if (e instanceof BadRequestException) {
            destinos.set(d.id, []);
            continue;
          }
          throw e;
        }
      }
      const enlace = enlacePerfilCad(p.cad);
      const o = destinos
        .get(d.id)
        ?.find(
          (o) =>
            o.rutaAlternativaId === enlace?.rutaAlternativaId &&
            o.materialVarianteId === enlace?.materialVarianteId &&
            o.colores.includes(p.color as 'BN' | 'COLOR') &&
            o.papelMateriaPrimaId === p.papelMateriaPrimaId &&
            (o.gramaje == null || o.gramaje === p.gramaje),
        );
      if (!o) continue;
      opciones.push({
        perfilId: p.id,
        nombre: p.nombre,
        versionPerfil: p.version,
        versionDestino: d.version,
        destinoId: d.id,
        impresoraNombre: d.nombre,
        maquinaId: d.maquinaId,
        productoNombre: o.productoNombre,
        materialNombre: o.materialNombre,
        productoId: o.productoId,
        rutaAlternativaId: o.rutaAlternativaId,
        materialVarianteId: o.materialVarianteId,
        papelMateriaPrimaId: o.papelMateriaPrimaId,
        gramaje: p.gramaje,
        color: p.color as 'BN' | 'COLOR',
        prioridad: p.prioridad,
        probado: p.probado,
        modo: p.modo,
        rollo: { anchoRolloMm: d.cad.anchoRolloMm, margenMm: d.cad.margenMm },
      });
    }
    return { perfiles: opciones };
  }

  validar(doc: DocumentoInput) {
    const error =
      errorPaginasDocumento(doc) ||
      errorMedidasDocumento(doc) ||
      errorCopiasPorPagina(doc);
    if (error) throw new BadRequestException(error);
    if (
      !doc.archivoNombre?.toLowerCase().endsWith('.pdf') ||
      !doc.medidasPaginas?.length ||
      !doc.paginasOriginales
    )
      throw new BadRequestException(
        'Para Planos CAD, adjuntá un PDF con sus medidas por página.',
      );
    if (!doc.cad)
      throw new BadRequestException('Elegí un perfil CAD configurado.');
    if (doc.faz !== 1 || doc.grupoId || doc.terminaciones?.length)
      throw new BadRequestException(
        'Los planos CAD se cotizan en simple faz, sin anillado ni tomos.',
      );
    if (
      !Number.isSafeInteger(doc.copias) ||
      doc.copias < 1 ||
      doc.copias > 10000 ||
      cantidadImpresionesCad(doc) > 10000 ||
      doc.paginas > 5000
    )
      throw new BadRequestException(
        'Dividí la carga CAD: hasta 5.000 páginas y 10.000 impresiones por documento.',
      );
  }

  async construir(
    tenantId: string,
    doc: DocumentoInput,
    grupoCargaId: string,
    periodo: string | null,
    clienteId?: string,
  ): Promise<ItemConstruido> {
    const base = {
      documentoId: doc.id,
      grupoTomoId: null,
      nombre: doc.nombre ?? doc.archivoNombre ?? 'Plano',
      productoId: '',
      jobContext: {},
      especificaciones: {},
      cantidad: 0,
      unidad: 'unidad',
      precioUnitario: 0,
      subtotal: 0,
      impuestoPorcentaje: 0,
      impuestoMonto: 0,
      total: 0,
      cotizacion: null,
    };
    try {
      this.validar(doc);
      const cantidad = cantidadImpresionesCad(doc);
      base.cantidad = cantidad;
      const copiasPorPagina = mapaCopiasCad(doc);
      const { p, d, opcion } = await this.perfiles.resolverPerfil(
        tenantId,
        doc.cad!.perfilId,
        {
          version: doc.cad!.versionPerfil,
          versionDestino: doc.cad!.versionDestino,
        },
      );
      if (
        doc.color !== p.color ||
        doc.papelMateriaPrimaId !== p.papelMateriaPrimaId ||
        doc.gramaje !== p.gramaje
      )
        throw new BadRequestException(
          'El color y el papel deben coincidir con el perfil CAD elegido.',
        );
      const seleccionadas = medidasSeleccionadas(
        doc.medidasPaginas,
        doc.rangoPaginas,
      );
      const planes = seleccionadas.map((pagina) => {
        try {
          return {
            pagina: pagina.pagina,
            copias: copiasPorPagina.get(pagina.pagina) ?? doc.copias,
            ...planPaginaCad(d.cad, pagina),
          };
        } catch (e) {
          throw new BadRequestException(
            `Página ${pagina.pagina}: ${e instanceof Error ? e.message : 'No entra en el rollo.'}`,
          );
        }
      });
      const tamano = resumenMedidas(seleccionadas);
      const jobContext = {
        cantidad,
        caras: 1 as const,
        modoColor: p.color === 'BN' ? 'BN' : 'CMYK',
        piezas: seleccionadas.map((pagina) => ({
          cantidad: copiasPorPagina.get(pagina.pagina) ?? doc.copias,
          anchoMm: pagina.anchoMm,
          altoMm: pagina.altoMm,
        })),
        [`maquinaSeleccionada_${opcion.configPasoId}`]: d.maquinaId,
        slotMateriales: {
          [`${opcion.configPasoId}_sustrato_principal`]:
            opcion.materialVarianteId,
        },
        _centroCopiado: {
          version: 1,
          modo: 'CAD',
          cad: doc.cad,
          grupoCargaId,
          grupoTomoId: null,
          esTomo: false,
          nombre: base.nombre,
          archivoNombre: doc.archivoNombre,
          paginas: doc.paginas,
          ...metadataRangoPaginas(doc),
          medidasPaginas: doc.medidasPaginas,
          ...(doc.orientacionesPaginas
            ? { orientacionesPaginas: doc.orientacionesPaginas }
            : {}),
          copias: doc.copias,
          ...(doc.copiasPorPagina
            ? { copiasPorPagina: doc.copiasPorPagina }
            : {}),
          color: doc.color,
          faz: 1,
          tamano: 'CAD',
          tamanoAnchoMm: seleccionadas[0].anchoMm,
          tamanoAltoMm: seleccionadas[0].altoMm,
          papelMateriaPrimaId: p.papelMateriaPrimaId,
          gramaje: p.gramaje,
          papelLabel: opcion.materialNombre,
          carillas: cantidad,
          hojas: cantidad,
          terminaciones: [],
          destinoId: d.id,
          impresoraNombre: d.nombre,
          productoNombre: opcion.productoNombre,
          productoCodigo: opcion.productoCodigo,
          materialVarianteId: opcion.materialVarianteId,
          rutaAlternativaId: opcion.rutaAlternativaId,
          escala: 100,
          anchoRolloMm: d.cad.anchoRolloMm,
          planes,
        },
      };
      const r = await this.motor.cotizar({
        tenantId,
        productoId: opcion.productoId,
        rutaAlternativaId: opcion.rutaAlternativaId,
        clienteId,
        periodo,
        jobContext,
      });
      if (!r.exitoso || !r.cotizacion)
        throw new BadRequestException(
          [r.errores?.[0]?.mensaje, r.errores?.[0]?.sugerencia]
            .filter(Boolean)
            .join(' ') || 'No se pudo cotizar el plano.',
        );
      const c = r.cotizacion;
      const subtotal = redondear(
        c.desglosePrecio?.precioNetoTotal ?? c.precio?.precioTotal ?? 0,
      );
      const total = redondear(c.desglosePrecio?.precioBrutoTotal ?? subtotal);
      const impuestoMonto = redondear(Math.max(0, total - subtotal));
      return {
        ...base,
        productoId: opcion.productoId,
        jobContext,
        especificaciones: {
          Archivo: base.nombre,
          Tamaño: tamano,
          Escala: '100%',
          Color: p.color === 'BN' ? 'Blanco y negro' : 'Color',
          Páginas: String(doc.paginas),
          ...(doc.rangoPaginas
            ? {
                'Páginas seleccionadas':
                  metadataRangoPaginas(doc).rangoPaginas!,
              }
            : {}),
          Copias: doc.copiasPorPagina
            ? `Por página · ${cantidad} impresiones`
            : String(doc.copias),
          ...(doc.copiasPorPagina
            ? {
                'Detalle de copias':
                  planes
                    .slice(0, 10)
                    .map((p) => `Pág. ${p.pagina}: ${p.copias}`)
                    .join(' · ') + (planes.length > 10 ? ' · …' : ''),
              }
            : {}),
          Papel: opcion.materialNombre,
          Impresora: d.nombre,
        },
        subtotal,
        total,
        impuestoMonto,
        precioUnitario: redondear(subtotal / cantidad),
        impuestoPorcentaje:
          subtotal > 0 ? redondear((impuestoMonto / subtotal) * 100) : 0,
        cotizacion: c,
        error: null,
      };
    } catch (e) {
      return {
        ...base,
        error: e instanceof Error ? e.message : 'No se pudo cotizar el plano.',
      };
    }
  }

  async cotizar(
    tenantId: string,
    doc: DocumentoInput,
    periodo: string | null,
    clienteId?: string,
  ): Promise<DocumentoResultado> {
    const r = await this.construir(tenantId, doc, '', periodo, clienteId);
    return {
      id: doc.id,
      grupoId: null,
      carillas: r.cantidad,
      hojas: r.cantidad,
      pliegos: r.cantidad,
      subtotal: r.subtotal,
      iva: r.impuestoMonto,
      total: r.total,
      anillado: null,
      error: r.error,
    };
  }
}
