import {
  compilarRutaLineal,
  reducirGrafoAClaves,
  validarYOrdenarGrafo,
  type AristaGrafoProduccion,
} from '../ordenes-trabajo/grafo-produccion';
import { ControlConsolidacionProduccion } from '../ordenes-trabajo/consolidacion-produccion';
import type {
  ComponenteFabricadoCosteado,
  CotizacionResultado,
  PasoEjecutado,
} from './tipos';

export type ProduccionPadreNesting = {
  grafoProduccion?: CotizacionResultado['grafoProduccion'];
  pasosPadre?: PasoEjecutado[];
};

export const claveOperacionNesting = (
  componenteCodigo: string,
  rutaPasoId: string,
) => JSON.stringify([componenteCodigo, rutaPasoId]);

function grafoEfectivo(
  grafo: CotizacionResultado['grafoProduccion'],
  pasos: PasoEjecutado[],
) {
  const nodos = grafo?.nodos?.map((nodo, index) => ({
    ...nodo,
    indice: nodo.indice ?? index,
  }));
  const completo = nodos?.length
    ? validarYOrdenarGrafo(nodos, grafo?.aristas ?? [])
    : compilarRutaLineal(
        pasos.map((paso, index) => ({
          clave: `ruta:${paso.rutaPasoId}`,
          indice: paso.rutaPasoOrden ?? index,
        })),
      );
  const idsActivos = new Set(
    pasos.filter((p) => p.activado).map((p) => p.rutaPasoId),
  );
  return reducirGrafoAClaves(
    completo,
    new Set(
      completo.nodos
        .filter((n) => idsActivos.has(n.clave.replace(/^(ruta|extra):/, '')))
        .map((n) => n.clave),
    ),
  );
}

/** Usa el DAG productivo y sus habilitaciones/incorporaciones, nunca el DAG
 * de outputs de cálculo. Replica la reducción de opcionales de la OT. */
export function controlPrecedenciasNesting(
  args: ProduccionPadreNesting & { componentes: ComponenteFabricadoCosteado[] },
) {
  const clavePadre = (clave: string) => JSON.stringify(['padre', clave]);
  const aristas: AristaGrafoProduccion[] = [];
  if (args.pasosPadre) {
    aristas.push(
      ...grafoEfectivo(args.grafoProduccion, args.pasosPadre).aristas.map(
        (a) => ({
          desdeClave: clavePadre(a.desdeClave),
          haciaClave: clavePadre(a.haciaClave),
        }),
      ),
    );
  }
  for (const componente of args.componentes) {
    if (componente.politicaEjecucion !== 'INDEPENDIENTE') continue;
    const grafo = grafoEfectivo(
      componente.grafoProduccion,
      componente.pasos ?? [],
    );
    const claveHija = (clave: string) =>
      claveOperacionNesting(
        componente.codigo,
        clave.replace(/^(ruta|extra):/, ''),
      );
    aristas.push(
      ...grafo.aristas.map((a) => ({
        desdeClave: claveHija(a.desdeClave),
        haciaClave: claveHija(a.haciaClave),
      })),
    );
    for (const predecesor of componente.nodosPredecesoresClaves ?? []) {
      for (const raiz of grafo.raices)
        aristas.push({
          desdeClave: clavePadre(predecesor),
          haciaClave: claveHija(raiz),
        });
    }
    if (componente.nodoIncorporacionClave) {
      for (const terminal of grafo.terminales)
        aristas.push({
          desdeClave: claveHija(terminal),
          haciaClave: clavePadre(componente.nodoIncorporacionClave),
        });
    }
  }
  return new ControlConsolidacionProduccion(aristas);
}
