import { calcularHojas } from '../adaptador';
import {
  CENTRO_COPIADO_COBERTURAS,
  CENTRO_COPIADO_FORMATOS,
  errorEstructuraCargaCentroCopiado,
} from '../centro-copiado.domain';
import { errorPaginasDocumento } from '../../common/rangos-paginas';
import { errorCopiasPorPagina } from '../../common/copias-paginas-cad';
import type {
  CalculoComercialHojas,
  DocumentoCalculoHojas,
  GrupoComercialHojas,
  ParteComercialHojas,
  PedidoCalculoHojas,
  ReglasComercialesHojas,
  TarifarioCalculoHojas,
} from './tipos';
import {
  claveCombinacion,
  DecimalComercial,
  enteroPositivo,
  exigir,
  identificador,
  indexarTarifario,
  sumarCantidad,
  validarCombinacion,
} from './validaciones';

/** Clasifica comercialmente cada original/copia sin cambiar el armado físico. */
function partesDocumento(
  cargaId: string,
  doc: DocumentoCalculoHojas,
  copias: number,
  reglas: Readonly<ReglasComercialesHojas>,
): ParteComercialHojas[] {
  identificador(doc.id, 'Documento');
  if (doc.grupoId != null) identificador(doc.grupoId, 'Tomo del documento');
  exigir(
    doc.modo == null || doc.modo === 'HOJAS',
    'El cálculo de hojas no admite CAD; los ML se calculan por separado.',
  );
  enteroPositivo(doc.copias, 'Copias del documento');
  enteroPositivo(copias, 'Copias efectivas');
  const error = errorPaginasDocumento(doc) || errorCopiasPorPagina(doc);
  exigir(!error, error ?? 'Páginas inválidas.');
  const cobertura = doc.cobertura ?? 'alta';
  const coberturaValida = CENTRO_COPIADO_COBERTURAS.find(
    (c) => c === cobertura,
  );
  exigir(coberturaValida != null, 'La cobertura del archivo no es válida.');
  const combinacion = {
    papelMateriaPrimaId: doc.papelMateriaPrimaId,
    gramaje: doc.gramaje,
    tamano: doc.tamano,
    color: doc.color,
    faz: doc.faz,
    cobertura: reglas.cobertura === 'DIFERENCIADA' ? coberturaValida : null,
  };
  validarCombinacion(combinacion, reglas);
  const formato = CENTRO_COPIADO_FORMATOS.find((f) => f.nombre === doc.tamano)!;
  exigir(
    formato.anchoMm === doc.tamanoAnchoMm &&
      formato.altoMm === doc.tamanoAltoMm,
    'Las medidas del documento no coinciden con su tamaño.',
  );
  const { hojas, carillas } = calcularHojas(doc.paginas, copias, doc.faz);
  enteroPositivo(hojas, 'Hojas físicas');
  enteroPositivo(carillas, 'Carillas impresas');

  const crear = (
    faz: 1 | 2,
    hojasFisicas: number,
    carillasImpresas: number,
  ): ParteComercialHojas => ({
    referencia: {
      cargaId,
      documentoId: doc.id,
      grupoTomoId: doc.grupoId ?? null,
    },
    combinacion: { ...combinacion, faz },
    paginasPorCopia: doc.paginas,
    copiasEfectivas: copias,
    fazProduccion: doc.faz,
    coberturaProduccion: coberturaValida,
    hojasFisicas,
    carillasImpresas,
    cantidadComercial:
      reglas.unidad === 'HOJA' ? hojasFisicas : carillasImpresas,
  });
  if (
    reglas.ultimaHojaImpar === 'COBRAR_SIMPLE' &&
    doc.faz === 2 &&
    doc.paginas % 2 === 1
  ) {
    // Cada original comienza en frente, incluso dentro del mismo tomo.
    const partes = [crear(1, copias, copias)];
    if (hojas > copias)
      partes.unshift(crear(2, hojas - copias, carillas - copias));
    return partes;
  }
  return [crear(doc.faz, hojas, carillas)];
}

function partesPedido(
  pedido: PedidoCalculoHojas,
  reglas: Readonly<ReglasComercialesHojas>,
): ParteComercialHojas[] {
  const partes: ParteComercialHojas[] = [];
  const cargasVistas = new Set<string>();
  for (const carga of pedido.cargas) {
    identificador(carga.id, 'Carga');
    exigir(!cargasVistas.has(carga.id), 'El pedido contiene cargas repetidas.');
    cargasVistas.add(carga.id);
    const grupos = carga.grupos ?? [];
    const error = errorEstructuraCargaCentroCopiado(
      [...carga.documentos],
      [...grupos],
    );
    exigir(!error, error ?? 'La estructura de la carga no es válida.');
    const juegosPorTomo = new Map<string, number>();
    for (const grupo of grupos) {
      identificador(grupo.id, 'Tomo');
      enteroPositivo(grupo.juegos, 'Juegos del tomo');
      juegosPorTomo.set(grupo.id, grupo.juegos);
    }
    for (const doc of carga.documentos) {
      // Los juegos REEMPLAZAN las copias del documento; no se multiplican por ellas.
      const copias = doc.grupoId ? juegosPorTomo.get(doc.grupoId)! : doc.copias;
      partes.push(...partesDocumento(carga.id, doc, copias, reglas));
    }
  }
  return partes;
}

/** Cálculo puro por pedido. Oferta, permisos y versión vigente se resuelven antes;
 * impuestos, acuerdos, descuentos, preparación, mínimo y terminaciones, después.
 * No conecta Prisma ni cambia precios del motor ni documentos recibidos.
 */
export function calcularComercialHojas(
  pedido: PedidoCalculoHojas,
  tarifario: TarifarioCalculoHojas,
): CalculoComercialHojas {
  identificador(pedido.tenantId, 'Empresa del pedido');
  identificador(pedido.pedidoId, 'Pedido');
  exigir(
    pedido.tenantId === tarifario.tenantId,
    'El tarifario no pertenece a la empresa del pedido.',
  );
  const filas = indexarTarifario(tarifario);
  const agrupadas = new Map<string, ParteComercialHojas[]>();
  for (const parte of partesPedido(pedido, tarifario.reglas)) {
    const { cargaId, documentoId } = parte.referencia;
    const clave = JSON.stringify([
      pedido.tenantId,
      pedido.pedidoId,
      tarifario.tarifarioId,
      tarifario.versionId,
      claveCombinacion(parte.combinacion),
      ...(tarifario.reglas.acumulacion === 'ARCHIVO'
        ? [cargaId, documentoId]
        : []),
    ]);
    const grupo = agrupadas.get(clave) ?? [];
    grupo.push(parte);
    agrupadas.set(clave, grupo);
  }

  const grupos: GrupoComercialHojas[] = [];
  let importeConPrecio = new DecimalComercial(0);
  let hojasFisicas = 0;
  let carillasImpresas = 0;
  let cantidadComercial = 0;
  for (const [clave, partes] of agrupadas) {
    const combinacion = partes[0].combinacion;
    const fila = filas.get(claveCombinacion(combinacion));
    const cantidad = partes.reduce(
      (n, p) => sumarCantidad(n, p.cantidadComercial),
      0,
    );
    const hojas = partes.reduce((n, p) => sumarCantidad(n, p.hojasFisicas), 0);
    const carillas = partes.reduce(
      (n, p) => sumarCantidad(n, p.carillasImpresas),
      0,
    );
    const rangos = fila?.rangosPropios ?? tarifario.rangosGenerales;
    const indice = rangos.findLastIndex((desde) => desde <= cantidad);
    const desdeCantidad = rangos[indice];
    const celda = fila?.precios.find((p) => p.desdeCantidad === desdeCantidad);
    const precio =
      celda?.precioUnitario != null
        ? new DecimalComercial(celda.precioUnitario)
        : null;
    const importe = precio?.times(cantidad) ?? null;
    grupos.push({
      clave,
      combinacion,
      unidad: tarifario.reglas.unidad,
      cantidadParaTramo: cantidad,
      cantidadFacturable: cantidad,
      hojasFisicas: hojas,
      carillasImpresas: carillas,
      tramo: {
        desdeCantidad,
        hastaCantidad:
          rangos[indice + 1] != null ? rangos[indice + 1] - 1 : null,
        origen: fila?.rangosPropios != null ? 'COMBINACION' : 'GENERAL',
      },
      estado: precio === null ? 'PRECIO_PENDIENTE' : 'CALCULADO',
      motivoPendiente:
        precio !== null
          ? null
          : fila
            ? 'TRAMO_SIN_PRECIO'
            : 'COMBINACION_SIN_PRECIO',
      precioUnitario: precio?.toFixed() ?? null,
      importeMatriz: importe?.toFixed() ?? null,
      partes: partes.map((parte) => ({
        ...parte,
        importeMatriz: precio?.times(parte.cantidadComercial).toFixed() ?? null,
      })),
    });
    importeConPrecio = importeConPrecio.plus(importe ?? 0);
    hojasFisicas = sumarCantidad(hojasFisicas, hojas);
    carillasImpresas = sumarCantidad(carillasImpresas, carillas);
    cantidadComercial = sumarCantidad(cantidadComercial, cantidad);
  }
  const pendiente = grupos.some((g) => g.estado === 'PRECIO_PENDIENTE');
  return {
    tenantId: pedido.tenantId,
    pedidoId: pedido.pedidoId,
    tarifarioId: tarifario.tarifarioId,
    versionId: tarifario.versionId,
    reglas: { ...tarifario.reglas },
    estado: pendiente ? 'PRECIO_PENDIENTE' : 'CALCULADO',
    grupos,
    hojasFisicas,
    carillasImpresas,
    cantidadComercial,
    importeConPrecio: importeConPrecio.toFixed(),
    importeImpresionMatriz: pendiente ? null : importeConPrecio.toFixed(),
  };
}
