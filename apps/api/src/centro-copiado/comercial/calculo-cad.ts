import { planPaginaCad } from '../../common/cad-geometria';
import {
  cantidadImpresionesCad,
  errorCopiasPorPagina,
  mapaCopiasCad,
} from '../../common/copias-paginas-cad';
import {
  errorMedidasDocumento,
  medidasSeleccionadas,
} from '../../common/medidas-documento';
import { errorPaginasDocumento } from '../../common/rangos-paginas';
import { CENTRO_COPIADO_COBERTURAS } from '../centro-copiado.domain';
import type {
  CalculoComercialCad,
  DocumentoCalculoCad,
  GrupoComercialCad,
  ParteComercialCad,
  PedidoCalculoCad,
  ReglasComercialesCad,
  TarifarioCalculoCad,
} from './tipos-cad';
import {
  cantidadMl,
  claveCombinacionCad,
  indexarTarifarioCad,
  validarCombinacionCad,
} from './validaciones-cad';
import {
  DecimalComercial,
  enteroPositivo,
  exigir,
  identificador,
  sumarCantidad,
} from './validaciones';

function partesDocumento(
  cargaId: string,
  doc: DocumentoCalculoCad,
  reglas: Readonly<ReglasComercialesCad>,
): ParteComercialCad[] {
  identificador(doc.id, 'Documento CAD');
  exigir(doc.modo === 'CAD', 'El cálculo CAD no admite hojas ni carillas.');
  exigir(
    doc.faz === 1 && !doc.grupoId && !doc.terminaciones?.length,
    'CAD se cotiza en simple faz, sin tomos ni terminaciones.',
  );
  enteroPositivo(doc.copias, 'Copias CAD');
  const error =
    errorPaginasDocumento(doc) ||
    errorMedidasDocumento(doc) ||
    errorCopiasPorPagina(doc);
  exigir(!error, error ?? 'Revisá las páginas del documento CAD.');
  exigir(
    !!doc.medidasPaginas?.length &&
      !!doc.paginasOriginales &&
      !!doc.archivoNombre?.toLowerCase().endsWith('.pdf'),
    'CAD requiere las medidas de todas las páginas de su PDF original.',
  );
  exigir(
    doc.copias <= 10000 &&
      doc.paginas <= 5000 &&
      cantidadImpresionesCad(doc) <= 10000,
    'Dividí la carga CAD: hasta 5.000 páginas y 10.000 impresiones por documento.',
  );
  const cobertura = CENTRO_COPIADO_COBERTURAS.find(
    (c) => c === (doc.cobertura ?? 'alta'),
  );
  exigir(cobertura != null, 'La cobertura del archivo CAD no es válida.');
  const combinacion = {
    papelMateriaPrimaId: doc.papelMateriaPrimaId,
    gramaje: doc.gramaje,
    anchoRolloMm: doc.rolloProduccion.anchoRolloMm,
    color: doc.color,
    cobertura: reglas.cobertura === 'DIFERENCIADA' ? cobertura : null,
  };
  validarCombinacionCad(combinacion, reglas);
  const copias = mapaCopiasCad(doc);
  return medidasSeleccionadas(doc.medidasPaginas, doc.rangoPaginas).map(
    (pagina) => {
      let plan: ReturnType<typeof planPaginaCad>;
      try {
        // Mismo planificador que cotización y salida de impresión: no reescalar.
        plan = planPaginaCad(
          {
            ...doc.rolloProduccion,
            origenPapel: '',
            usarOrigenPredeterminado: true,
          },
          pagina,
        );
      } catch (e) {
        exigir(
          false,
          `Página ${pagina.pagina}: ${e instanceof Error ? e.message : 'No se pudo planificar.'}`,
        );
      }
      const copiasEfectivas = copias.get(pagina.pagina) ?? doc.copias;
      // Sumar los mismos márgenes y largo orientado en decimal evita que un residuo
      // binario dispare otro incremento comercial cuando ya es múltiplo exacto.
      const largo = new DecimalComercial(plan.altoMm).plus(
        new DecimalComercial(doc.rolloProduccion.margenMm).times(2),
      );
      const porCopia = cantidadMl(largo.div(1000).toFixed());
      const consumo = cantidadMl(porCopia.times(copiasEfectivas).toFixed());
      return {
        referencia: {
          cargaId,
          documentoId: doc.id,
          paginaOriginal: pagina.pagina,
        },
        combinacion: { ...combinacion },
        coberturaProduccion: cobertura,
        copiasEfectivas,
        margenMm: doc.rolloProduccion.margenMm,
        plan,
        largoPapelMm: largo.toFixed(),
        consumoMlPorCopia: porCopia.toFixed(),
        consumoMl: consumo.toFixed(),
      };
    },
  );
}

function sumarMl(a: InstanceType<typeof DecimalComercial>, b: string) {
  return cantidadMl(a.plus(b).toFixed());
}

/**
 * D31–D35: consumo real → tramo → redondeo único → precio de todo el grupo.
 * El caller resuelve oferta/gramaje/rollo y permisos. Componer hojas y CAD juntos
 * después para aplicar preparación y mínimo una sola vez en el pedido.
 */
export function calcularComercialCad(
  pedido: PedidoCalculoCad,
  tarifario: TarifarioCalculoCad,
): CalculoComercialCad {
  identificador(pedido.tenantId, 'Empresa del pedido');
  identificador(pedido.pedidoId, 'Pedido');
  exigir(
    pedido.tenantId === tarifario.tenantId,
    'El tarifario no pertenece a la empresa del pedido.',
  );
  const filas = indexarTarifarioCad(tarifario);
  const agrupadas = new Map<string, ParteComercialCad[]>();
  const cargasVistas = new Set<string>();
  for (const carga of pedido.cargas) {
    identificador(carga.id, 'Carga CAD');
    exigir(
      !cargasVistas.has(carga.id),
      'El pedido contiene cargas CAD repetidas.',
    );
    cargasVistas.add(carga.id);
    const documentosVistos = new Set<string>();
    for (const doc of carga.documentos) {
      identificador(doc.id, 'Documento CAD');
      exigir(
        !documentosVistos.has(doc.id),
        'La carga repite un documento CAD.',
      );
      documentosVistos.add(doc.id);
      for (const parte of partesDocumento(carga.id, doc, tarifario.reglas)) {
        const clave = JSON.stringify([
          pedido.tenantId,
          pedido.pedidoId,
          tarifario.tarifarioId,
          tarifario.versionId,
          'CAD',
          claveCombinacionCad(parte.combinacion),
          ...(tarifario.reglas.acumulacion === 'ARCHIVO'
            ? [carga.id, doc.id]
            : []),
        ]);
        const grupo = agrupadas.get(clave) ?? [];
        grupo.push(parte);
        agrupadas.set(clave, grupo);
      }
    }
  }
  const grupos: GrupoComercialCad[] = [];
  let consumoMl = new DecimalComercial(0);
  let facturableMl = new DecimalComercial(0);
  let importeConPrecio = new DecimalComercial(0);
  let impresionesFisicas = 0;
  for (const [clave, partes] of agrupadas) {
    const combinacion = partes[0].combinacion;
    const fila = filas.get(claveCombinacionCad(combinacion));
    const consumo = partes.reduce(
      (n, p) => sumarMl(n, p.consumoMl),
      new DecimalComercial(0),
    );
    const rangos = (fila?.rangosPropios ?? tarifario.rangosGenerales).map((r) =>
      cantidadMl(r),
    );
    const indice = rangos.findLastIndex((r) => r.lte(consumo));
    const desde = rangos[indice];
    const celda = fila?.precios.find((p) =>
      new DecimalComercial(p.desdeCantidad).eq(desde),
    );
    const precio =
      celda?.precioUnitario != null
        ? new DecimalComercial(celda.precioUnitario)
        : null;
    const redondeo = tarifario.reglas.redondeo;
    const incremento =
      redondeo.modalidad === 'HACIA_ARRIBA'
        ? cantidadMl(redondeo.incrementoMl)
        : null;
    // Cociente decimal: un múltiplo exacto no agrega otro incremento.
    const facturable = incremento
      ? cantidadMl(consumo.div(incremento).ceil().times(incremento).toFixed())
      : consumo;
    const ajuste = facturable.minus(consumo);
    const impresiones = partes.reduce(
      (n, p) => sumarCantidad(n, p.copiasEfectivas),
      0,
    );
    const importeMatriz = precio?.times(facturable) ?? null;
    grupos.push({
      clave,
      combinacion,
      unidad: 'ML',
      impresionesFisicas: impresiones,
      cantidadParaTramo: consumo.toFixed(),
      cantidadFacturable: facturable.toFixed(),
      ajusteRedondeoMl: ajuste.toFixed(),
      tramo: {
        desdeCantidad: desde.toFixed(),
        hastaCantidadExclusiva: rangos[indice + 1]?.toFixed() ?? null,
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
      importeConsumoMatriz: precio?.times(consumo).toFixed() ?? null,
      importeAjusteRedondeo: precio?.times(ajuste).toFixed() ?? null,
      importeMatriz: importeMatriz?.toFixed() ?? null,
      partes: partes.map((parte) => ({
        ...parte,
        importeConsumoMatriz: precio?.times(parte.consumoMl).toFixed() ?? null,
      })),
    });
    consumoMl = sumarMl(consumoMl, consumo.toFixed());
    facturableMl = sumarMl(facturableMl, facturable.toFixed());
    impresionesFisicas = sumarCantidad(impresionesFisicas, impresiones);
    importeConPrecio = importeConPrecio.plus(importeMatriz ?? 0);
  }
  const pendiente = grupos.some((g) => g.estado === 'PRECIO_PENDIENTE');
  return {
    tenantId: pedido.tenantId,
    pedidoId: pedido.pedidoId,
    tarifarioId: tarifario.tarifarioId,
    versionId: tarifario.versionId,
    reglas: { ...tarifario.reglas, redondeo: { ...tarifario.reglas.redondeo } },
    estado: pendiente ? 'PRECIO_PENDIENTE' : 'CALCULADO',
    grupos,
    impresionesFisicas,
    consumoMl: consumoMl.toFixed(),
    cantidadFacturable: facturableMl.toFixed(),
    ajusteRedondeoMl: facturableMl.minus(consumoMl).toFixed(),
    importeConPrecio: importeConPrecio.toFixed(),
    importeImpresionMatriz: pendiente ? null : importeConPrecio.toFixed(),
  };
}
