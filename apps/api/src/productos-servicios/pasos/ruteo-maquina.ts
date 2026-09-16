import { resolverFamilia } from './familias';

/** M-0 es una ejecución válida sin máquina. La ausencia de datos de una
 * familia desconocida no autoriza a tratar una OT histórica como manual. */
export function admitePasoSinMaquina(codigo: string): boolean {
  return resolverFamilia(codigo)?.relacionMaquinaSoportada?.includes('M-0') === true;
}
