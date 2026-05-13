/**
 * Agrupamiento de talonarios por pliego.
 *
 * Calcula cuántos pliegos son necesarios para producir N talonarios,
 * teniendo en cuenta el modo de manejar talonarios incompletos
 * (cuando la cantidad pedida no completa un grupo entero):
 *  - 'aprovechar_pliego': se imprimen pliegos parciales con poses vacías.
 *  - 'pose_completa': se imprime un grupo extra completo (las poses
 *    sobrantes son desperdicio).
 *
 * Ported (1:1) desde:
 *   motors/talonario.calculations.ts:calculateTalonarioGrouping
 *
 * Ubicación en el módulo de nesting porque opera sobre el resultado de
 * imposición (poses por pliego) para calcular consumo de sustratos.
 */

export type TalonarioGroupingInput = {
  cantidadTalonarios: number;
  posesXPliego: number;
  numerosXTalonario: number;
  modoTalonarioIncompleto: 'aprovechar_pliego' | 'pose_completa';
};

export type TalonarioGroupingResult = {
  /** Cantidad de talonarios que efectivamente se producen */
  talonariosEfectivos: number;
  /** Cantidad original pedida */
  talonariosPedidos: number;
  /** Poses por pliego */
  posesXPliego: number;
  /** Talonarios por grupo de pliegos (= posesXPliego) */
  talonariosPorGrupo: number;
  /** Grupos completos */
  gruposCompletos: number;
  /** Talonarios residuales (no llenan un grupo completo) */
  talonariosResiduo: number;
  /** Pliegos necesarios POR CAPA (se multiplica × capas para total) */
  pliegosXCapa: number;
  /** Pliegos de desperdicio (poses vacías) */
  pliegosDesperdicio: number;
  /** Número de hojas/números por talonario */
  numerosXTalonario: number;
  /** Modo usado para talonarios incompletos */
  modoIncompleto: string;
};

export function calculateTalonarioGrouping(
  input: TalonarioGroupingInput,
): TalonarioGroupingResult {
  const {
    cantidadTalonarios,
    posesXPliego,
    numerosXTalonario,
    modoTalonarioIncompleto,
  } = input;

  if (posesXPliego <= 0 || numerosXTalonario <= 0) {
    return {
      talonariosEfectivos: 0,
      talonariosPedidos: cantidadTalonarios,
      posesXPliego,
      talonariosPorGrupo: posesXPliego,
      gruposCompletos: 0,
      talonariosResiduo: 0,
      pliegosXCapa: 0,
      pliegosDesperdicio: 0,
      numerosXTalonario,
      modoIncompleto: modoTalonarioIncompleto,
    };
  }

  const talonariosPorGrupo = posesXPliego;
  const gruposCompletos = Math.floor(cantidadTalonarios / talonariosPorGrupo);
  const talonariosResiduo = cantidadTalonarios % talonariosPorGrupo;

  let pliegosXCapa: number;
  let pliegosDesperdicio: number;
  let talonariosEfectivos: number;

  if (talonariosResiduo === 0) {
    pliegosXCapa = gruposCompletos * numerosXTalonario;
    pliegosDesperdicio = 0;
    talonariosEfectivos = cantidadTalonarios;
  } else if (modoTalonarioIncompleto === 'pose_completa') {
    const gruposTotales = gruposCompletos + 1;
    pliegosXCapa = gruposTotales * numerosXTalonario;
    const posesVacias = talonariosPorGrupo - talonariosResiduo;
    pliegosDesperdicio = posesVacias * numerosXTalonario;
    talonariosEfectivos = gruposTotales * talonariosPorGrupo;
  } else {
    pliegosXCapa = gruposCompletos * numerosXTalonario + numerosXTalonario;
    const posesVacias = talonariosPorGrupo - talonariosResiduo;
    pliegosDesperdicio = posesVacias * numerosXTalonario;
    talonariosEfectivos = cantidadTalonarios;
  }

  return {
    talonariosEfectivos,
    talonariosPedidos: cantidadTalonarios,
    posesXPliego,
    talonariosPorGrupo,
    gruposCompletos,
    talonariosResiduo,
    pliegosXCapa,
    pliegosDesperdicio,
    numerosXTalonario,
    modoIncompleto: modoTalonarioIncompleto,
  };
}
