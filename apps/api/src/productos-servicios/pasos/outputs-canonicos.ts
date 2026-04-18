/**
 * A.2 — Catálogo de outputs semánticos canónicos
 *
 * Nombres estables que un paso puede producir como output, leibles por pasos
 * siguientes que los declaren en `leeDePasos`. Ver modelo universal §4.
 *
 * Cuando se define una familia de paso, sus `outputsCanonicos` deben salir
 * EXCLUSIVAMENTE de esta lista. Los consumers (otros pasos en la ruta, reglas
 * de selección, UI) se apoyan en estos nombres — cambiarlos es un breaking
 * change que requiere migración.
 *
 * Política: agregar es libre, renombrar/eliminar requiere deprecación explícita.
 */

export const OUTPUTS_CANONICOS = {
  // Impresión por hoja
  piezasPorPlaca: 'piezasPorPlaca',         // cuántas piezas caben nesting en una placa/pliego
  pliegos: 'pliegos',                        // cantidad de pliegos necesarios
  hojasImpresas: 'hojasImpresas',           // hojas que salen de la máquina (pliegos × caras)
  planchasNecesarias: 'planchasNecesarias', // offset: N planchas = colores × caras
  impresiones: 'impresiones',               // count total de impresiones (hojas × caras)

  // Impresión por área (gran formato)
  m2Impresos: 'm2Impresos',                  // superficie total impresa
  metrosLinealesConsumidos: 'metrosLinealesConsumidos', // de rollo
  panelesGenerados: 'panelesGenerados',      // segmentación en paneles
  areaDesperdicioM2: 'areaDesperdicioM2',    // sobrante por layout

  // Impresión por pieza (UV / rígidos)
  piezasImpresas: 'piezasImpresas',
  placasUsadas: 'placasUsadas',
  aprovechamientoPct: 'aprovechamientoPct',

  // DTF textil
  filmImpresoM2: 'filmImpresoM2',
  prendasTermofijadas: 'prendasTermofijadas',

  // Corte y formado
  cortesRealizados: 'cortesRealizados',      // guillotina: número de cortes lineales
  piezasCortadas: 'piezasCortadas',          // plotter/láser: cantidad de piezas
  metrosLinealesCortados: 'metrosLinealesCortados', // corte por contorno
  piezasVolumetricas: 'piezasVolumetricas',  // CNC, polifán
  plieguesRealizados: 'plieguesRealizados',
  perforacionesRealizadas: 'perforacionesRealizadas',
  troquelesUsados: 'troquelesUsados',

  // Grabado
  areaGrabadaM2: 'areaGrabadaM2',
  piezasGrabadas: 'piezasGrabadas',

  // Terminaciones
  peliculaLaminadaM2: 'peliculaLaminadaM2',
  piezasLaminadas: 'piezasLaminadas',
  areaDecoradaM2: 'areaDecoradaM2',          // foil, hot-stamping, relieve
  areaPintadaM2: 'areaPintadaM2',

  // Encuadernación
  cuadernosTerminados: 'cuadernosTerminados',
  espiralesConsumidas: 'espiralesConsumidas',
  grapasUsadas: 'grapasUsadas',
  metrosCosido: 'metrosCosido',

  // Estructural
  metrosSoldados: 'metrosSoldados',
  piezasEnsambladas: 'piezasEnsambladas',
  modulosLEDInstalados: 'modulosLEDInstalados',
  metrosCableado: 'metrosCableado',

  // Servicios
  horasDiseno: 'horasDiseno',
  horasPrePrensa: 'horasPrePrensa',
  visitaMedidasRealizada: 'visitaMedidasRealizada',
  horasInstalacionInSitu: 'horasInstalacionInSitu',
  kmTraslado: 'kmTraslado',

  // Operaciones manuales / logística
  piezasEmbaladas: 'piezasEmbaladas',
  piezasArmadas: 'piezasArmadas',
  insumosGestionados: 'insumosGestionados',

  // Subproducto (recursión — ver modelo universal §6)
  subProductoCotizado: 'subProductoCotizado',
} as const;

export type OutputCanonicoNombre = keyof typeof OUTPUTS_CANONICOS;

/**
 * Valida que un string sea un output canónico conocido.
 * Útil para validar declaraciones de pasos al cargar una ruta.
 */
export function isOutputCanonico(name: string): name is OutputCanonicoNombre {
  return name in OUTPUTS_CANONICOS;
}
