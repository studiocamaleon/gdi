import {
  construirColumnasProductivas,
  reducirAristasProductivas,
} from "@/lib/modelo-productivo-layout";

export type GrafoCotizacionSnapshot = {
  nodos?: Array<{ clave: string; indice?: number }>;
  aristas?: Array<{ desdeClave: string; haciaClave: string }>;
};

export type PasoWorkflowCotizacion = {
  rutaPasoId?: string;
  rutaPasoOrden: number;
  nombreVisible?: string | null;
  familiaCodigo: string;
  activado: boolean;
  operacionesInternas?: unknown[];
};

export type ComponenteWorkflowCotizacion<
  TPaso extends PasoWorkflowCotizacion = PasoWorkflowCotizacion,
> = {
  codigo: string;
  nombre: string;
  cantidad?: number;
  unidad?: string;
  nodoIncorporacionClave?: string | null;
  nodosPredecesoresClaves?: string[];
  pasos?: TPaso[];
  componentes?: ComponenteWorkflowCotizacion<TPaso>[];
  grafoProduccion?: GrafoCotizacionSnapshot | null;
};

export type NodoWorkflowCotizacion<
  TPaso extends PasoWorkflowCotizacion = PasoWorkflowCotizacion,
  TComponente extends ComponenteWorkflowCotizacion<TPaso> =
    ComponenteWorkflowCotizacion<TPaso>,
> =
  | {
      clave: string;
      tipo: "PASO" | "ETAPA";
      orden: number;
      paso: TPaso;
    }
  | {
      clave: string;
      tipo: "COMPONENTE";
      orden: number;
      componente: TComponente;
    };

function normalizarClave(clave?: string | null) {
  return (clave ?? "").replace(/^(ruta|extra):/, "");
}

/**
 * Proyecta exactamente el mismo contrato DAG que usa el editor, pero sobre el
 * snapshot congelado de una cotización. Si la OT es anterior al grafo, conserva
 * la ruta lineal histórica y conecta cada componente con su incorporación.
 */
export function construirWorkflowCotizacion<
  TPaso extends PasoWorkflowCotizacion,
  TComponente extends ComponenteWorkflowCotizacion<TPaso>,
>({
  pasos,
  componentes,
  grafoProduccion,
}: {
  pasos: TPaso[];
  componentes: TComponente[];
  grafoProduccion?: GrafoCotizacionSnapshot | null;
}) {
  const pasosActivos = pasos
    .filter((paso) => paso.activado)
    .slice()
    .sort((a, b) => a.rutaPasoOrden - b.rutaPasoOrden);
  const nodosGrafo = grafoProduccion?.nodos ?? [];
  const clavePorPaso = new Map<string, string>();

  for (const paso of pasosActivos) {
    const id = normalizarClave(paso.rutaPasoId);
    const claveGuardada = nodosGrafo.find(
      (nodo) => normalizarClave(nodo.clave) === id,
    )?.clave;
    clavePorPaso.set(id, claveGuardada ?? `ruta:${id}`);
  }

  const nodosPaso: NodoWorkflowCotizacion<TPaso, TComponente>[] =
    pasosActivos.map((paso, index) => ({
      clave:
        clavePorPaso.get(normalizarClave(paso.rutaPasoId)) ??
        `ruta:paso-${index}`,
      tipo: (paso.operacionesInternas?.length ?? 0) > 0 ? "ETAPA" : "PASO",
      orden: 100 + index,
      paso,
    }));
  const nodosComponente: NodoWorkflowCotizacion<TPaso, TComponente>[] =
    componentes.map((componente, index) => ({
      clave: `componente:${componente.codigo}`,
      tipo: "COMPONENTE",
      orden: index,
      componente,
    }));
  const nodos = [...nodosPaso, ...nodosComponente];
  const clavesValidas = new Set(nodos.map((nodo) => nodo.clave));

  const aristasGrafo = grafoProduccion?.aristas;
  const aristasBase =
    aristasGrafo != null
      ? aristasGrafo
      : nodosPaso.slice(1).map((nodo, index) => ({
          desdeClave: nodosPaso[index].clave,
          haciaClave: nodo.clave,
        }));
  const aristasComponentes = componentes.flatMap((componente) => {
    const clave = `componente:${componente.codigo}`;
    return [
      ...(componente.nodosPredecesoresClaves ?? []).map((desdeClave) => ({
        desdeClave,
        haciaClave: clave,
      })),
      ...(componente.nodoIncorporacionClave
        ? [
            {
              desdeClave: clave,
              haciaClave: componente.nodoIncorporacionClave,
            },
          ]
        : []),
    ];
  });
  const aristas = reducirAristasProductivas(
    [...aristasBase, ...aristasComponentes],
    clavesValidas,
  );

  return {
    nodos,
    aristas,
    columnas: construirColumnasProductivas(nodos, aristas),
  };
}
