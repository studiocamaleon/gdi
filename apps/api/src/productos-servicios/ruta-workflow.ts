import {
  compilarRutaLineal,
  validarYOrdenarGrafo,
} from '../ordenes-trabajo/grafo-produccion';

export type TipoNodoRutaWorkflow = 'PASO' | 'ETAPA' | 'COMPONENTE';

export type NodoRutaWorkflowPaso = {
  clave: string;
  tipo: 'PASO' | 'ETAPA';
  orden: number;
  familiaCodigo: string;
  nombreVisible: string | null;
  icono: string;
};

export type NodoRutaWorkflowComponente = {
  clave: string;
  tipo: 'COMPONENTE';
  orden: number;
  productoComponenteId: string;
  codigo: string;
  nombre: string;
  requerido: boolean;
};

export type NodoRutaWorkflow =
  NodoRutaWorkflowPaso | NodoRutaWorkflowComponente;

export type AristaRutaWorkflow = {
  desdeClave: string;
  haciaClave: string;
};

export type RutaWorkflow = {
  contractVersion: 1;
  topologia: 'LINEAL' | 'DAG';
  nodos: NodoRutaWorkflow[];
  aristas: AristaRutaWorkflow[];
};

type PasoPersistidoWorkflow = {
  id: string;
  orden: number;
  familiaCodigo: string;
  nombreVisible?: string | null;
  icono?: string | null;
};

function texto(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function entero(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function workflowLinealDesdePasos(
  pasos: PasoPersistidoWorkflow[],
): RutaWorkflow {
  const ordenados = [...pasos].sort((a, b) => a.orden - b.orden);
  const nodos: NodoRutaWorkflowPaso[] = ordenados.map((paso, index) => ({
    clave: `ruta:${paso.id}`,
    tipo: 'PASO',
    orden: index,
    familiaCodigo: paso.familiaCodigo,
    nombreVisible: paso.nombreVisible?.trim() || null,
    icono: paso.icono?.trim() || 'Layout',
  }));
  const grafo = compilarRutaLineal(
    nodos.map((nodo) => ({ clave: nodo.clave, indice: nodo.orden })),
  );
  return {
    contractVersion: 1,
    topologia: grafo.topologia,
    nodos,
    aristas: grafo.aristas,
  };
}

export function validarWorkflowRuta(input: RutaWorkflow): RutaWorkflow {
  if (!input || !Array.isArray(input.nodos) || !Array.isArray(input.aristas)) {
    throw new Error('El Workflow de la ruta está incompleto.');
  }
  if (input.nodos.length === 0) {
    throw new Error('La ruta debe contener al menos un nodo.');
  }

  const nodos = input.nodos.map((nodo, index): NodoRutaWorkflow => {
    const clave = texto(nodo.clave);
    if (!clave) throw new Error('Todo nodo de la ruta debe tener una clave.');
    if (nodo.tipo === 'COMPONENTE') {
      const productoComponenteId = texto(nodo.productoComponenteId);
      if (!productoComponenteId) {
        throw new Error(
          `El componente "${texto(nodo.nombre) || clave}" no identifica un producto hijo.`,
        );
      }
      return {
        clave,
        tipo: 'COMPONENTE',
        orden: entero(nodo.orden, index),
        productoComponenteId,
        codigo: texto(nodo.codigo) || clave.replace(/^componente:/, ''),
        nombre: texto(nodo.nombre) || 'Componente fabricado',
        requerido: nodo.requerido !== false,
      };
    }
    if (nodo.tipo !== 'PASO' && nodo.tipo !== 'ETAPA') {
      throw new Error(`El nodo "${clave}" tiene un tipo no soportado.`);
    }
    const familiaCodigo = texto(nodo.familiaCodigo);
    if (!familiaCodigo) {
      throw new Error(`El nodo "${clave}" no tiene una familia de paso.`);
    }
    return {
      clave,
      tipo: nodo.tipo,
      orden: entero(nodo.orden, index),
      familiaCodigo,
      nombreVisible: texto(nodo.nombreVisible) || null,
      icono: texto(nodo.icono) || 'Layout',
    };
  });

  const principales = nodos.filter((nodo) => nodo.tipo !== 'COMPONENTE');
  if (principales.length === 0) {
    throw new Error(
      'La ruta debe conservar al menos un Paso o una Etapa del flujo principal.',
    );
  }
  const codigosComponentes = new Set<string>();
  for (const nodo of nodos) {
    if (nodo.tipo !== 'COMPONENTE') continue;
    if (codigosComponentes.has(nodo.codigo)) {
      throw new Error(
        `El código de componente "${nodo.codigo}" está repetido en la ruta.`,
      );
    }
    codigosComponentes.add(nodo.codigo);
  }

  const aristas = input.aristas.map((arista) => ({
    desdeClave: texto(arista.desdeClave),
    haciaClave: texto(arista.haciaClave),
  }));
  const grafo = validarYOrdenarGrafo(
    nodos.map((nodo) => ({ clave: nodo.clave, indice: nodo.orden })),
    aristas,
  );
  const porClave = new Map(nodos.map((nodo) => [nodo.clave, nodo]));
  const ordenados = grafo.nodos.map((nodo, index) => ({
    ...porClave.get(nodo.clave)!,
    orden: index,
  }));

  for (const componente of ordenados.filter(
    (nodo): nodo is NodoRutaWorkflowComponente => nodo.tipo === 'COMPONENTE',
  )) {
    const salientes = grafo.aristas.filter(
      (arista) => arista.desdeClave === componente.clave,
    );
    if (salientes.length !== 1) {
      throw new Error(
        `El componente "${componente.nombre}" debe converger en un único Paso o Etapa del producto padre.`,
      );
    }
    const destino = porClave.get(salientes[0].haciaClave);
    if (!destino || destino.tipo === 'COMPONENTE') {
      throw new Error(
        `El componente "${componente.nombre}" debe incorporarse en un Paso o Etapa del producto padre.`,
      );
    }
    const conexionesConComponentes = grafo.aristas.filter(
      (arista) =>
        (arista.desdeClave === componente.clave &&
          porClave.get(arista.haciaClave)?.tipo === 'COMPONENTE') ||
        (arista.haciaClave === componente.clave &&
          porClave.get(arista.desdeClave)?.tipo === 'COMPONENTE'),
    );
    if (conexionesConComponentes.length > 0) {
      throw new Error(
        'Las dependencias directas entre componentes se configuran en la receta del producto, no en la plantilla reusable.',
      );
    }
  }

  return {
    contractVersion: 1,
    topologia: grafo.topologia,
    nodos: ordenados,
    aristas: grafo.aristas,
  };
}

export function pasosDesdeWorkflow(workflow: RutaWorkflow) {
  return validarWorkflowRuta(workflow)
    .nodos.filter(
      (nodo): nodo is NodoRutaWorkflowPaso => nodo.tipo !== 'COMPONENTE',
    )
    .map((nodo, index) => ({
      orden: index + 1,
      familiaCodigo: nodo.familiaCodigo,
      nombreVisible: nodo.nombreVisible,
      icono: nodo.icono,
    }));
}

export function remapearPasosWorkflow(
  workflowEntrada: RutaWorkflow,
  pasosPersistidos: PasoPersistidoWorkflow[],
): RutaWorkflow {
  const workflow = validarWorkflowRuta(workflowEntrada);
  const principales = workflow.nodos.filter(
    (nodo): nodo is NodoRutaWorkflowPaso => nodo.tipo !== 'COMPONENTE',
  );
  const persistidos = [...pasosPersistidos].sort((a, b) => a.orden - b.orden);
  if (principales.length !== persistidos.length) {
    throw new Error(
      'No se pudo relacionar el Workflow con los pasos persistidos de la ruta.',
    );
  }
  const reemplazos = new Map<string, string>();
  const nodos = workflow.nodos.map((nodo) => {
    if (nodo.tipo === 'COMPONENTE') return nodo;
    const index = principales.findIndex((item) => item.clave === nodo.clave);
    const paso = persistidos[index];
    const clave = `ruta:${paso.id}`;
    reemplazos.set(nodo.clave, clave);
    return {
      ...nodo,
      clave,
      familiaCodigo: paso.familiaCodigo,
      nombreVisible: paso.nombreVisible?.trim() || null,
      icono: paso.icono?.trim() || 'Layout',
    };
  });
  return validarWorkflowRuta({
    ...workflow,
    nodos,
    aristas: workflow.aristas.map((arista) => ({
      desdeClave: reemplazos.get(arista.desdeClave) ?? arista.desdeClave,
      haciaClave: reemplazos.get(arista.haciaClave) ?? arista.haciaClave,
    })),
  });
}

export function leerWorkflowRuta(
  snapshot: unknown,
  pasosFallback: PasoPersistidoWorkflow[],
): RutaWorkflow {
  if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
    const raw = snapshot as Record<string, unknown>;
    const workflow =
      raw.workflow ??
      (Array.isArray(raw.nodos) && Array.isArray(raw.aristas) ? raw : null);
    if (workflow && typeof workflow === 'object' && !Array.isArray(workflow)) {
      try {
        return validarWorkflowRuta(workflow as RutaWorkflow);
      } catch {
        // Un snapshot legado o incompleto nunca debe impedir abrir la ruta.
      }
    }
  }
  return workflowLinealDesdePasos(pasosFallback);
}
