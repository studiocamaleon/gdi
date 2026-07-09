/**
 * Agrupamiento de talonarios por pliego.
 *
 * Calcula cuántos pliegos POR COPIA se necesitan para producir T talonarios
 * de N números cuando en el pliego entran P poses.
 *
 * Modelo de producción:
 *  - Los talonarios se agrupan de a P (grupos completos): cada pliego lleva
 *    el MISMO número de P talonarios distintos, lado a lado. La pila sale
 *    de la impresora en orden (número 1 arriba, N abajo) → sin acomodado
 *    manual y sin desperdicio. Cada grupo completo consume N pliegos.
 *  - Si T no es múltiplo de P queda un residuo de talonarios sueltos, y ahí
 *    entra el dilema que resuelve `modoTalonarioIncompleto`:
 *     - 'aprovechar_pliego': los números de los talonarios sueltos comparten
 *       pliego (distintos números del mismo talonario en las poses) →
 *       ⌈residuo×N/P⌉ pliegos extra. Mínimo papel, pero ese bloque requiere
 *       cortar y acomodar a mano para armar la secuencia 1..N.
 *     - 'pose_completa': los sueltos se imprimen ocupando solo sus poses y
 *       el resto queda vacío → N pliegos extra. La pila sale lista para
 *       abrochar y cortar (la impresora intercala copias), a costa de
 *       desperdiciar (P−residuo)×N poses de papel.
 *
 * El resultado es POR COPIA: original y duplicado/triplicado son pasos de
 * impresión separados que heredan cada uno `pliegos_calculados`.
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
  /** Pliegos necesarios POR CAPA/COPIA (se multiplica × copias para total) */
  pliegosXCapa: number;
  /**
   * Pilas de pliegos que se abrochan/cortan juntas (grupos completos + 1 si
   * hay residuo). Base para insumos por pila, ej. el cartón de contratapa
   * (1 cartón del tamaño del pliego por pila → P contratapas al cortar).
   */
  pilas: number;
  /** Poses vacías (desperdicio de papel, en poses) */
  posesDesperdicio: number;
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
      pilas: 0,
      posesDesperdicio: 0,
      numerosXTalonario,
      modoIncompleto: modoTalonarioIncompleto,
    };
  }

  const talonariosPorGrupo = posesXPliego;
  const gruposCompletos = Math.floor(cantidadTalonarios / talonariosPorGrupo);
  const talonariosResiduo = cantidadTalonarios % talonariosPorGrupo;

  // Grupos completos: mismo número de P talonarios por pliego → N pliegos
  // por grupo, sin desperdicio ni acomodado.
  let pliegosXCapa = gruposCompletos * numerosXTalonario;
  let posesDesperdicio = 0;

  if (talonariosResiduo > 0) {
    if (modoTalonarioIncompleto === 'pose_completa') {
      // Los sueltos van en su propio bloque de N pliegos con poses vacías.
      pliegosXCapa += numerosXTalonario;
      posesDesperdicio =
        (talonariosPorGrupo - talonariosResiduo) * numerosXTalonario;
    } else {
      // 'aprovechar_pliego': los números de los sueltos comparten pliego.
      const posesResiduo = talonariosResiduo * numerosXTalonario;
      const pliegosResiduo = Math.ceil(posesResiduo / talonariosPorGrupo);
      pliegosXCapa += pliegosResiduo;
      posesDesperdicio = pliegosResiduo * talonariosPorGrupo - posesResiduo;
    }
  }

  return {
    talonariosEfectivos: cantidadTalonarios,
    talonariosPedidos: cantidadTalonarios,
    posesXPliego,
    talonariosPorGrupo,
    gruposCompletos,
    talonariosResiduo,
    pliegosXCapa,
    pilas: gruposCompletos + (talonariosResiduo > 0 ? 1 : 0),
    posesDesperdicio,
    numerosXTalonario,
    modoIncompleto: modoTalonarioIncompleto,
  };
}
