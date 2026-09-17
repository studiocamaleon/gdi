import {
  validarYOrdenarGrafo,
  type AristaGrafoProduccion,
} from './grafo-produccion';

/** Comprueba la contracción de operaciones, incluyendo los lotes ya aceptados.
 * Dos grupos seguros por separado también pueden formar un ciclo al combinarse.
 * Una arista interna no se descarta: representa una precedencia incompatible. */
export class ControlConsolidacionProduccion {
  private equivalencias = new Map<string, string>();

  constructor(private readonly aristas: AristaGrafoProduccion[]) {}

  private proyectar(ids: string[]) {
    if (!ids.length || new Set(ids).size !== ids.length) {
      throw new Error('El lote contiene operaciones ausentes o repetidas.');
    }
    const equivalencias = new Map(this.equivalencias);
    const representantes = new Set(
      ids.map((id) => equivalencias.get(id) ?? id),
    );
    const operativo = equivalencias.get(ids[0]) ?? ids[0];
    for (const [id, representante] of equivalencias) {
      if (representantes.has(representante)) equivalencias.set(id, operativo);
    }
    for (const id of ids) equivalencias.set(id, operativo);
    const unicas = new Map<string, AristaGrafoProduccion>();
    const claves = new Set<string>();
    for (const arista of this.aristas) {
      const desdeClave =
        equivalencias.get(arista.desdeClave) ?? arista.desdeClave;
      const haciaClave =
        equivalencias.get(arista.haciaClave) ?? arista.haciaClave;
      claves.add(desdeClave);
      claves.add(haciaClave);
      unicas.set(JSON.stringify([desdeClave, haciaClave]), {
        desdeClave,
        haciaClave,
      });
    }
    validarYOrdenarGrafo(
      [...claves].map((clave, indice) => ({ clave, indice })),
      [...unicas.values()],
    );
    return equivalencias;
  }

  motivoIncompatible(ids: string[]): string | undefined {
    try {
      this.proyectar(ids);
      return undefined;
    } catch {
      return 'Las precedencias de producción impiden ejecutar estas operaciones juntas; se conserva el cálculo independiente.';
    }
  }

  confirmar(ids: string[]) {
    this.equivalencias = this.proyectar(ids);
  }
}
