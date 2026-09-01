export type ConsumoPresentacionInput = {
  familiaCodigo?: string | null;
  slotCodigo?: string | null;
  formula?: string | null;
  materialLabel?: string | null;
  magnitudProduceLabel?: string | null;
  fuenteLabel?: string | null;
  paramsPaso?: Record<string, unknown> | null;
};

export type ConsumoAutomaticoPresentacion = {
  dato: string;
  resultado: string;
  resumen: string;
};

const FORMULA_DATO_LABELS: Record<string, string> = {
  por_unidad_productiva: "Resultado productivo del paso",
  por_m2: "Superficie total de las piezas",
  por_metro_lineal: "Metros lineales calculados",
  por_pieza: "Cantidad de piezas pedidas",
  fijo: "Una vez por trabajo",
};

const BASE_LABELS: Record<string, string> = {
  cantidad_pedida: "cantidad pedida",
  cantidad_efectiva_paso: "cantidad efectiva del paso",
  perimetro_piezas_m: "metro de perímetro",
  pliegos_impresos: "pliego impreso",
  talonario_pilas: "pila de talonario",
};

function lowerFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toLocaleLowerCase("es-AR") + value.slice(1);
}

function materialEnFrase(materialLabel?: string | null) {
  return lowerFirst(materialLabel?.trim() || "el material");
}

function usaPersonalizaciones(paramsPaso?: Record<string, unknown> | null) {
  const fuentes = paramsPaso?.fuenteMedidaPersonalizaciones;
  return Array.isArray(fuentes) && fuentes.length > 0;
}

export function etiquetaDatoConsumoAutomatico(input: ConsumoPresentacionInput) {
  const formula = input.formula || "por_unidad_productiva";
  const familia = input.familiaCodigo || "";

  if (familia === "impresion_por_area") {
    return usaPersonalizaciones(input.paramsPaso)
      ? "Estampas activadas y sus medidas"
      : "Acomodo real de las piezas";
  }
  if (familia === "impresion_por_hoja") {
    return "Pliegos resultantes de la imposición";
  }
  if (familia === "montaje_sobre_sustrato") {
    return "Acomodo sobre el material de montaje";
  }
  if (familia === "laminado") {
    return "Material heredado del paso anterior";
  }
  if (
    ["aplicacion_transfer", "aplicacion_transfer_textil"].includes(familia) &&
    ["textil", "prenda"].includes(input.slotCodigo || "")
  ) {
    return "Cantidad de productos pedidos";
  }
  if (input.fuenteLabel) return input.fuenteLabel;
  if (formula === "por_unidad_productiva" && input.magnitudProduceLabel) {
    return input.magnitudProduceLabel;
  }
  return FORMULA_DATO_LABELS[formula] || "Resultado productivo del paso";
}

export function describirConsumoAutomatico(
  input: ConsumoPresentacionInput,
): ConsumoAutomaticoPresentacion {
  const familia = input.familiaCodigo || "";
  const formula = input.formula || "por_unidad_productiva";
  const material = materialEnFrase(input.materialLabel);
  const dato = etiquetaDatoConsumoAutomatico(input);

  if (familia === "impresion_por_area") {
    if (usaPersonalizaciones(input.paramsPaso)) {
      return {
        dato,
        resultado: "Superficie y largo necesarios para producir las estampas",
        resumen: `El sistema descontará ${material} según las estampas activadas y las medidas cargadas al cotizar.`,
      };
    }
    return {
      dato,
      resultado: "Largo o superficie realmente utilizados por el acomodo",
      resumen: `El sistema descontará ${material} según cómo se acomoden las piezas en el rollo, pliego o placa.`,
    };
  }

  if (familia === "impresion_por_hoja") {
    return {
      dato,
      resultado: "Cantidad de pliegos que necesita el trabajo",
      resumen: `El sistema descontará ${material} según los pliegos que resulten de la imposición.`,
    };
  }

  if (familia === "montaje_sobre_sustrato") {
    return {
      dato,
      resultado: "Material de montaje ocupado por las piezas",
      resumen: `El sistema descontará ${material} según el acomodo de las piezas sobre el material de montaje.`,
    };
  }

  if (familia === "laminado") {
    return {
      dato,
      resultado: "Largo necesario para cubrir lo producido anteriormente",
      resumen: `El sistema descontará ${material} usando el tamaño y la cantidad publicados por el paso anterior.`,
    };
  }

  if (
    ["aplicacion_transfer", "aplicacion_transfer_textil"].includes(familia) &&
    ["textil", "prenda"].includes(input.slotCodigo || "")
  ) {
    return {
      dato,
      resultado: "Una unidad del material base por producto pedido",
      resumen: `Por cada producto pedido, el sistema descontará 1 ${material}.`,
    };
  }

  const resultadoPorFormula: Record<string, string> = {
    por_unidad_productiva: "La cantidad material que resulte de este paso",
    por_m2: "La superficie total calculada en m²",
    por_metro_lineal: "El largo total calculado en metros lineales",
    por_pieza: "Una unidad de material por pieza",
    fijo: "Una unidad de material por trabajo",
  };
  const resumenPorFormula: Record<string, string> = {
    por_unidad_productiva: `El sistema descontará ${material} usando el resultado productivo de este paso.`,
    por_m2: `El sistema descontará ${material} según la superficie total de las piezas.`,
    por_metro_lineal: `El sistema descontará ${material} según los metros lineales calculados.`,
    por_pieza: `El sistema descontará 1 ${material} por cada pieza pedida.`,
    fijo: `El sistema descontará 1 ${material} por cada trabajo.`,
  };

  return {
    dato,
    resultado:
      resultadoPorFormula[formula] || resultadoPorFormula.por_unidad_productiva,
    resumen:
      resumenPorFormula[formula] || resumenPorFormula.por_unidad_productiva,
  };
}

export function etiquetaBaseConsumo(base?: string | null) {
  return BASE_LABELS[base || "cantidad_pedida"] || "cantidad pedida";
}

export function resumirReglaCantidad({
  cantidad,
  base,
  materialLabel,
}: {
  cantidad?: number | string | null;
  base?: string | null;
  materialLabel?: string | null;
}) {
  const factor =
    cantidad === null || cantidad === undefined || cantidad === ""
      ? 1
      : Number(cantidad);
  const seguro = Number.isFinite(factor) ? factor : 1;
  return `Por cada ${etiquetaBaseConsumo(base)}, el sistema descontará ${seguro.toLocaleString(
    "es-AR",
  )} ${materialEnFrase(materialLabel)}.`;
}
