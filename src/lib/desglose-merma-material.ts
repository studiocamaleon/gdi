export type DesgloseMermaMaterial = {
  origen:
    | "MERMA_ADICIONAL"
    | "NESTING"
    | "NESTING_CONSOLIDADO"
    | "NESTING_Y_MERMA_ADICIONAL"
    | "NESTING_CONSOLIDADO_Y_MERMA_ADICIONAL";
  cantidadTrabajo: number;
  cantidadMerma: number;
  cantidadTotal: number;
  unidad: string;
  costoTrabajo: number;
  costoMerma: number;
  costoTotal: number;
  porcentajeMerma: number;
};

export type ItemMermaMaterial = {
  origen: "NESTING_GEOMETRICA" | "OPERATIVA";
  cantidadBase: number;
  cantidadMerma: number;
  unidad: string;
  costoMerma: number;
  porcentaje: number;
  consolidado: boolean;
};

type TiempoConMerma = {
  setupMin?: number;
  runMin?: number;
  runTrabajoMin?: number;
  runMermaMin?: number;
  cleanupMin?: number;
  tiempoFijoMin?: number;
  tarifaHora?: number;
  costo?: number;
};

type MaterialConMerma = {
  cantidad: number;
  unidad: string;
  costoTotal: number;
  detalleCosteoNesting?: unknown;
  mermaAdicional?: {
    porcentaje: number;
    cantidadTrabajo: number;
    cantidadMerma: number;
  };
};

type CosteoNesting = {
  chargedAreaMm2?: number;
  wasteAreaMm2?: number;
};

const esNumeroPositivo = (valor: unknown): valor is number =>
  typeof valor === "number" && Number.isFinite(valor) && valor > 0;

/**
 * Devuelve cada causa de merma por separado para que la UI pueda agruparlas
 * sin perder la reconciliación con la línea costeada por el motor.
 */
export function calcularItemsMermaMaterial({
  material,
  costeoNesting,
  porcentajeAsignacion = 100,
  consolidado = false,
}: {
  material: MaterialConMerma;
  costeoNesting?: CosteoNesting | null;
  porcentajeAsignacion?: number;
  consolidado?: boolean;
}): ItemMermaMaterial[] {
  const items: ItemMermaMaterial[] = [];
  const porcentajeOperativo = Math.max(
    0,
    Number(material.mermaAdicional?.porcentaje ?? 0),
  );

  if (
    material.detalleCosteoNesting &&
    esNumeroPositivo(costeoNesting?.chargedAreaMm2)
  ) {
    const totalMm2 = costeoNesting.chargedAreaMm2;
    const mermaFormatoMm2 = Math.min(
      totalMm2,
      Math.max(0, Number(costeoNesting.wasteAreaMm2 ?? 0)),
    );
    const factorAsignacion = Math.min(
      1,
      Math.max(0, porcentajeAsignacion / 100),
    );
    const factorOperativo = 1 + porcentajeOperativo / 100;
    const cantidadBase = (totalMm2 * factorAsignacion) / 1_000_000;
    const costoBase = material.costoTotal / factorOperativo;

    if (mermaFormatoMm2 > 0) {
      items.push({
        origen: "NESTING_GEOMETRICA",
        cantidadBase,
        cantidadMerma: (mermaFormatoMm2 * factorAsignacion) / 1_000_000,
        unidad: "m2",
        costoMerma: costoBase * (mermaFormatoMm2 / totalMm2),
        porcentaje: (mermaFormatoMm2 / totalMm2) * 100,
        consolidado,
      });
    }

    if (porcentajeOperativo > 0) {
      items.push({
        origen: "OPERATIVA",
        cantidadBase,
        cantidadMerma: cantidadBase * (porcentajeOperativo / 100),
        unidad: "m2",
        costoMerma: material.costoTotal - costoBase,
        porcentaje: porcentajeOperativo,
        consolidado,
      });
    }

    return items;
  }

  const adicional = material.mermaAdicional;
  if (!adicional || !esNumeroPositivo(adicional.cantidadMerma)) return items;

  const cantidadTotal = adicional.cantidadTrabajo + adicional.cantidadMerma;
  if (!esNumeroPositivo(cantidadTotal)) return items;
  const proporcionMerma = adicional.cantidadMerma / cantidadTotal;
  items.push({
    origen: "OPERATIVA",
    cantidadBase: adicional.cantidadTrabajo,
    cantidadMerma: adicional.cantidadMerma,
    unidad: material.unidad,
    costoMerma: material.costoTotal * proporcionMerma,
    porcentaje: Math.max(0, Number(adicional.porcentaje ?? 0)),
    consolidado,
  });
  return items;
}

/**
 * Asigna a la corrida desperdiciada su parte del costo horario congelado. El
 * prorrateo mantiene incluido cualquier redondeo aplicado por el motor y nunca
 * vuelve a sumar el costo al paso.
 */
export function calcularCostoMermaTiempo(tiempo: TiempoConMerma): number {
  const runMermaMin = Math.max(0, Number(tiempo.runMermaMin ?? 0));
  if (runMermaMin <= 0) return 0;

  const minutosCosteadosSinExtras =
    Math.max(0, Number(tiempo.setupMin ?? 0)) +
    Math.max(0, Number(tiempo.runMin ?? 0)) +
    Math.max(0, Number(tiempo.cleanupMin ?? 0)) +
    Math.max(0, Number(tiempo.tiempoFijoMin ?? 0));
  const costoCongelado = Math.max(0, Number(tiempo.costo ?? 0));
  if (minutosCosteadosSinExtras > 0 && costoCongelado > 0) {
    return costoCongelado * (runMermaMin / minutosCosteadosSinExtras);
  }

  const tarifaHora = Math.max(0, Number(tiempo.tarifaHora ?? 0));
  return (runMermaMin / 60) * tarifaHora;
}

/**
 * Separa la cantidad y el costo ya calculados por el motor. No vuelve a
 * estimar material: usa el área costeada del nesting o el desglose adicional
 * congelado en el snapshot.
 */
export function calcularDesgloseMermaMaterial({
  material,
  costeoNesting,
  porcentajeAsignacion = 100,
  consolidado = false,
}: {
  material: MaterialConMerma;
  costeoNesting?: CosteoNesting | null;
  porcentajeAsignacion?: number;
  consolidado?: boolean;
}): DesgloseMermaMaterial | null {
  const items = calcularItemsMermaMaterial({
    material,
    costeoNesting,
    porcentajeAsignacion,
    consolidado,
  });
  if (items.length === 0) return null;

  const geometrica = items.find((item) => item.origen === "NESTING_GEOMETRICA");
  const operativa = items.find((item) => item.origen === "OPERATIVA");
  const referencia = operativa ?? geometrica!;
  const cantidadBase = referencia.cantidadBase;
  const cantidadMerma = items.reduce(
    (total, item) => total + item.cantidadMerma,
    0,
  );
  const cantidadTotal = cantidadBase + (operativa?.cantidadMerma ?? 0);
  const costoMerma = items.reduce((total, item) => total + item.costoMerma, 0);

  return {
    origen: geometrica
      ? consolidado
        ? operativa
          ? "NESTING_CONSOLIDADO_Y_MERMA_ADICIONAL"
          : "NESTING_CONSOLIDADO"
        : operativa
          ? "NESTING_Y_MERMA_ADICIONAL"
          : "NESTING"
      : "MERMA_ADICIONAL",
    cantidadTrabajo: Math.max(0, cantidadTotal - cantidadMerma),
    cantidadMerma,
    cantidadTotal,
    unidad: referencia.unidad,
    costoTrabajo: Math.max(0, material.costoTotal - costoMerma),
    costoMerma,
    costoTotal: material.costoTotal,
    porcentajeMerma:
      cantidadTotal > 0 ? (cantidadMerma / cantidadTotal) * 100 : 0,
  };
}
