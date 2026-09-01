export type BomMaterialDirecto = {
  id: string;
  pasoClave: string;
  pasoNombre: string;
  slotCodigo: string;
  slotNombre: string | null;
  rol: string | null;
  modoSeleccion: string;
  materialVarianteId: string | null;
  materialSku: string | null;
  materialNombre: string | null;
  unidad: string | null;
  formula: string;
  cantidadBase: string | null;
  cantidadFactor: number | null;
  fuenteMedida: string | null;
  mermaAdicionalPct: number;
  aplicaMultiCaras: boolean;
  orden: number;
};

export type BomRecursoDirecto = {
  id: string;
  pasoClave: string;
  pasoNombre: string;
  familiaCodigo: string;
  maquinaNombre: string | null;
  estacionNombre: string | null;
  perfilNombre: string | null;
  centroCostoNombre: string | null;
  dotacionOperarios: number;
  tercerizado: boolean;
  proveedorNombre: string | null;
  orden: number;
};

export type BomDocumentoDirecto = {
  id: string;
  alcance: string;
  pasoClave: string | null;
  codigo: string;
  nombre: string;
  proposito: string;
  etapa: string;
  requerido: boolean;
  orden: number;
};

export type BomComponenteReferencia = {
  id: string;
  productoComponenteId: string;
  recetaRevisionId: string;
  recetaVersion: number;
  recetaHuella: string;
  codigo: string;
  nombre: string;
  politicaEjecucion: 'INLINE' | 'INDEPENDIENTE';
  formula: string;
  cantidad: number;
  unidad: string;
  requerido: boolean;
  configuracionJson: unknown;
  nodoIncorporacionClave: string | null;
  orden: number;
};

export type BomRevisionFuente = {
  id: string;
  numero: number;
  estado: string;
  huellaConfiguracion: string;
  recetaId: string;
  rutaAlternativaId: string;
  rutaNombre: string;
  productoId: string;
  productoCodigo: string;
  productoNombre: string;
  unidadComercial: string;
  materiales: BomMaterialDirecto[];
  recursos: BomRecursoDirecto[];
  documentos: BomDocumentoDirecto[];
  componentes: BomComponenteReferencia[];
};

export type BomTotalesNodo = {
  materialesDirectos: number;
  materialesAcumulados: number;
  recursosDirectos: number;
  recursosAcumulados: number;
  documentosDirectos: number;
  documentosAcumulados: number;
  componentesDirectos: number;
  componentesAcumulados: number;
  nivelesDescendientes: number;
};

export type BomNodoMultinivel = {
  ocurrenciaId: string;
  nivel: number;
  productoId: string;
  productoCodigo: string;
  productoNombre: string;
  unidadComercial: string;
  recetaId: string;
  revisionId: string;
  revisionNumero: number;
  revisionEstado: string;
  revisionHuella: string;
  rutaAlternativaId: string;
  rutaNombre: string;
  relacion: null | {
    codigo: string;
    nombre: string;
    formula: string;
    cantidad: number;
    unidad: string;
    requerido: boolean;
    politicaEjecucion: 'INLINE' | 'INDEPENDIENTE';
    configuracionJson: unknown;
    nodoIncorporacionClave: string | null;
  };
  factorReferencia: number;
  materialesDirectos: BomMaterialDirecto[];
  recursosDirectos: BomRecursoDirecto[];
  documentosDirectos: BomDocumentoDirecto[];
  hijos: BomNodoMultinivel[];
  totales: BomTotalesNodo;
};

export type BomMaterialConsolidado = {
  clave: string;
  nombre: string;
  sku: string | null;
  unidad: string | null;
  formula: string;
  cantidadFactorReferencia: number | null;
  ocurrencias: Array<{
    ocurrenciaId: string;
    productoId: string;
    productoNombre: string;
    pasoNombre: string;
    nivel: number;
    rutaProductos: string[];
    factorReferencia: number;
    cantidadFactor: number | null;
  }>;
};

export type BomMultinivel = {
  revisionRaizId: string;
  generadoDesdeRevision: {
    numero: number;
    estado: string;
    huellaConfiguracion: string;
  };
  resumen: {
    niveles: number;
    productosFabricados: number;
    materialesDirectos: number;
    materialesAcumulados: number;
    recursosDirectos: number;
    recursosAcumulados: number;
    documentosDirectos: number;
    documentosAcumulados: number;
  };
  raiz: BomNodoMultinivel;
  materialesConsolidados: BomMaterialConsolidado[];
};

type CargarRevision = (revisionId: string) => Promise<BomRevisionFuente | null>;

const MAX_NIVELES_BOM = 12;

function sumarTotales(
  fuente: BomRevisionFuente,
  hijos: BomNodoMultinivel[],
): BomTotalesNodo {
  return {
    materialesDirectos: fuente.materiales.length,
    materialesAcumulados:
      fuente.materiales.length +
      hijos.reduce((total, hijo) => total + hijo.totales.materialesAcumulados, 0),
    recursosDirectos: fuente.recursos.length,
    recursosAcumulados:
      fuente.recursos.length +
      hijos.reduce((total, hijo) => total + hijo.totales.recursosAcumulados, 0),
    documentosDirectos: fuente.documentos.length,
    documentosAcumulados:
      fuente.documentos.length +
      hijos.reduce((total, hijo) => total + hijo.totales.documentosAcumulados, 0),
    componentesDirectos: hijos.length,
    componentesAcumulados:
      hijos.length +
      hijos.reduce((total, hijo) => total + hijo.totales.componentesAcumulados, 0),
    nivelesDescendientes: hijos.length
      ? 1 + Math.max(...hijos.map((hijo) => hijo.totales.nivelesDescendientes))
      : 0,
  };
}

function consolidarMateriales(raiz: BomNodoMultinivel): BomMaterialConsolidado[] {
  const grupos = new Map<string, BomMaterialConsolidado>();

  const visitar = (nodo: BomNodoMultinivel, rutaProductos: string[]) => {
    const rutaActual = [...rutaProductos, nodo.productoNombre];
    for (const material of nodo.materialesDirectos) {
      const identidad =
        material.materialVarianteId ||
        material.materialSku ||
        material.materialNombre ||
        `${material.slotCodigo}:${material.rol ?? ''}`;
      // Fórmulas o unidades distintas no se mezclan: hacerlo aparentaría un
      // total concreto cuando el JobContext todavía no fue resuelto.
      const clave = `${identidad}|${material.unidad ?? ''}|${material.formula}`;
      const grupo = grupos.get(clave) ?? {
        clave,
        nombre:
          material.materialNombre || material.slotNombre || material.slotCodigo,
        sku: material.materialSku,
        unidad: material.unidad,
        formula: material.formula,
        cantidadFactorReferencia: 0,
        ocurrencias: [],
      };
      const cantidadFactor = material.cantidadFactor;
      grupo.ocurrencias.push({
        ocurrenciaId: nodo.ocurrenciaId,
        productoId: nodo.productoId,
        productoNombre: nodo.productoNombre,
        pasoNombre: material.pasoNombre,
        nivel: nodo.nivel,
        rutaProductos: rutaActual,
        factorReferencia: nodo.factorReferencia,
        cantidadFactor,
      });
      if (cantidadFactor === null) {
        grupo.cantidadFactorReferencia = null;
      } else if (grupo.cantidadFactorReferencia !== null) {
        grupo.cantidadFactorReferencia += cantidadFactor * nodo.factorReferencia;
      }
      grupos.set(clave, grupo);
    }
    nodo.hijos.forEach((hijo) => visitar(hijo, rutaActual));
  };

  visitar(raiz, []);
  return [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function construirBomMultinivel(
  revisionRaizId: string,
  cargarRevision: CargarRevision,
): Promise<BomMultinivel | null> {
  const cache = new Map<string, BomRevisionFuente | null>();
  const cargar = async (revisionId: string) => {
    if (!cache.has(revisionId)) {
      cache.set(revisionId, await cargarRevision(revisionId));
    }
    return cache.get(revisionId) ?? null;
  };

  const raizFuente = await cargar(revisionRaizId);
  if (!raizFuente) return null;

  const construirNodo = async (
    fuente: BomRevisionFuente,
    nivel: number,
    ocurrenciaId: string,
    factorReferencia: number,
    relacion: BomNodoMultinivel['relacion'],
    revisionesEnCamino: Set<string>,
  ): Promise<BomNodoMultinivel> => {
    if (nivel > MAX_NIVELES_BOM) {
      throw new Error(`El BOM supera el máximo de ${MAX_NIVELES_BOM} niveles.`);
    }
    if (revisionesEnCamino.has(fuente.id)) {
      throw new Error(`El BOM contiene un ciclo en la revisión ${fuente.id}.`);
    }
    const siguienteCamino = new Set(revisionesEnCamino).add(fuente.id);
    const hijos: BomNodoMultinivel[] = [];
    for (const componente of fuente.componentes) {
      const hijoFuente = await cargar(componente.recetaRevisionId);
      if (!hijoFuente) {
        throw new Error(
          `No se encontró la revisión V${componente.recetaVersion} de ${componente.nombre}.`,
        );
      }
      const factorHijo = factorReferencia * componente.cantidad;
      hijos.push(
        await construirNodo(
          hijoFuente,
          nivel + 1,
          `${ocurrenciaId}/${componente.codigo}`,
          factorHijo,
          {
            codigo: componente.codigo,
            nombre: componente.nombre,
            formula: componente.formula,
            cantidad: componente.cantidad,
            unidad: componente.unidad,
            requerido: componente.requerido,
            politicaEjecucion: componente.politicaEjecucion,
            configuracionJson: componente.configuracionJson,
            nodoIncorporacionClave: componente.nodoIncorporacionClave,
          },
          siguienteCamino,
        ),
      );
    }
    return {
      ocurrenciaId,
      nivel,
      productoId: fuente.productoId,
      productoCodigo: fuente.productoCodigo,
      productoNombre: fuente.productoNombre,
      unidadComercial: fuente.unidadComercial,
      recetaId: fuente.recetaId,
      revisionId: fuente.id,
      revisionNumero: fuente.numero,
      revisionEstado: fuente.estado,
      revisionHuella: fuente.huellaConfiguracion,
      rutaAlternativaId: fuente.rutaAlternativaId,
      rutaNombre: fuente.rutaNombre,
      relacion,
      factorReferencia,
      materialesDirectos: fuente.materiales,
      recursosDirectos: fuente.recursos,
      documentosDirectos: fuente.documentos,
      hijos,
      totales: sumarTotales(fuente, hijos),
    };
  };

  const raiz = await construirNodo(
    raizFuente,
    0,
    `raiz:${revisionRaizId}`,
    1,
    null,
    new Set(),
  );
  return {
    revisionRaizId,
    generadoDesdeRevision: {
      numero: raizFuente.numero,
      estado: raizFuente.estado,
      huellaConfiguracion: raizFuente.huellaConfiguracion,
    },
    resumen: {
      niveles: raiz.totales.nivelesDescendientes + 1,
      productosFabricados: raiz.totales.componentesAcumulados + 1,
      materialesDirectos: raiz.totales.materialesDirectos,
      materialesAcumulados: raiz.totales.materialesAcumulados,
      recursosDirectos: raiz.totales.recursosDirectos,
      recursosAcumulados: raiz.totales.recursosAcumulados,
      documentosDirectos: raiz.totales.documentosDirectos,
      documentosAcumulados: raiz.totales.documentosAcumulados,
    },
    raiz,
    materialesConsolidados: consolidarMateriales(raiz),
  };
}
