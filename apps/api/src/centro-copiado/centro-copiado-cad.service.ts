import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import {
  cantidadImpresionesCad,
  mapaCopiasCad,
  errorCopiasPorPagina,
} from '../common/copias-paginas-cad';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MotorUniversalService } from '../motor-universal/motor.service';
import { CatalogoCadService } from './catalogo-cad.service';
import type { SeleccionCad } from '../common/seleccion-cad';
import { planPaginaCad } from '../common/cad-geometria';
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
    private readonly catalogo: CatalogoCadService,
    private readonly motor: MotorUniversalService,
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
  ) {}

  async opciones(tenantId: string) {
    await this.capacidades.exigirTodas(tenantId, [
      'centro_copiado',
      'cotizacion_cad',
    ]);
    return { perfiles: await this.catalogo.configuraciones(tenantId) };
  }

  private async resolver(tenantId: string, cad: SeleccionCad, color: string) {
    const opciones = await this.catalogo.configuraciones(tenantId);
    if (cad.cotizacion) {
      const opcion = opciones.find(
        (o) => o.id === cad.cotizacion!.id && o.color === color,
      );
      if (!opcion)
        throw new BadRequestException(
          'La configuración CAD ya no está disponible. Revisá la receta, el material y la máquina.',
        );
      if (opcion.revision !== cad.cotizacion.revision)
        throw new ConflictException(
          'La configuración CAD cambió. Actualizala antes de cotizar.',
        );
      return opcion;
    }
    // Adaptador de lectura para borradores históricos. Nuevas cotizaciones sólo
    // guardan la selección comercial y no dependen de un destino de impresión.
    const previo = cad.perfilId
      ? await this.prisma.impresionPerfil.findFirst({
          where: { id: cad.perfilId, tenantId, tamano: 'CAD' },
          include: { bandeja: { include: { destino: true } } },
        })
      : null;
    const enlace = previo?.cad as {
      rutaAlternativaId?: string;
      materialVarianteId?: string;
    } | null;
    const opcion = opciones.find(
      (o) =>
        o.maquinaId === previo?.bandeja.destino.maquinaId &&
        o.rutaAlternativaId === enlace?.rutaAlternativaId &&
        o.materialVarianteId === enlace?.materialVarianteId &&
        o.color === color,
    );
    if (!opcion)
      throw new BadRequestException(
        'Elegí una configuración CAD para volver a cotizar este plano.',
      );
    return opcion;
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
    if (!doc.cad) throw new BadRequestException('Elegí una configuración CAD.');
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
    await this.capacidades.exigirTodas(tenantId, [
      'centro_copiado',
      'cotizacion_cad',
    ]);
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
      const opcion = await this.resolver(tenantId, doc.cad!, doc.color);
      const p = opcion;
      const cad = { cotizacion: { id: opcion.id, revision: opcion.revision } };
      const rollo = {
        ...opcion.rollo,
        origenPapel: '',
        usarOrigenPredeterminado: true,
      };
      if (
        doc.color !== p.color ||
        doc.papelMateriaPrimaId !== p.papelMateriaPrimaId ||
        (doc.gramaje ?? null) !== p.gramaje
      )
        throw new BadRequestException(
          'El color y el papel deben coincidir con la configuración CAD elegida.',
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
            ...planPaginaCad(rollo, pagina),
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
        [`maquinaSeleccionada_${opcion.configPasoId}`]: opcion.maquinaId,
        slotMateriales: {
          [`${opcion.configPasoId}_sustrato_principal`]:
            opcion.materialVarianteId,
        },
        _centroCopiado: {
          version: 1,
          modo: 'CAD',
          cad,
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
          maquinaId: opcion.maquinaId,
          impresoraNombre: opcion.maquinaNombre,
          productoNombre: opcion.productoNombre,
          productoCodigo: opcion.productoCodigo,
          materialVarianteId: opcion.materialVarianteId,
          rutaAlternativaId: opcion.rutaAlternativaId,
          escala: 100,
          anchoRolloMm: opcion.rollo.anchoRolloMm,
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
          Máquina: opcion.maquinaNombre,
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
