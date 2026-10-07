import type { CostosPasosPrecio } from './aplicar-precio.types';

/** Importes productivos: no son precios ni incluyen cargas comerciales. */
type PasoCosteado = {
  activado?: boolean;
  activada?: boolean;
  esOpcional?: boolean;
  costoTotal: number;
  cargosDirectosPaso?: Array<{ aplicaMargen: boolean; monto: number }>;
  operacionesInternas?: PasoCosteado[];
};
type ComponenteCosteado = {
  pasos?: PasoCosteado[];
  componentes?: ComponenteCosteado[];
};

export function costosPasosPrecio(
  pasos: PasoCosteado[],
  componentes: ComponenteCosteado[] = [],
): CostosPasosPrecio {
  const total: CostosPasosPrecio = {
    opcionales: 0,
    opcionalesSinMargen: 0,
    incluidosSinMargen: 0,
  };
  const sumar = (otro: CostosPasosPrecio) => {
    total.opcionales += otro.opcionales;
    total.opcionalesSinMargen += otro.opcionalesSinMargen;
    total.incluidosSinMargen += otro.incluidosSinMargen;
  };
  for (const paso of pasos) {
    if (!(paso.activado ?? paso.activada)) continue;
    // La etapa ya suma sus operaciones: recorrerlas evita cobrar dos veces
    // y permite que una operación opcional conviva con otra obligatoria.
    if (paso.operacionesInternas?.length) {
      sumar(costosPasosPrecio(paso.operacionesInternas));
      continue;
    }
    const sinMargen = (paso.cargosDirectosPaso ?? []).reduce(
      (s, cargo) => s + (cargo.aplicaMargen ? 0 : cargo.monto),
      0,
    );
    if (paso.esOpcional) {
      total.opcionales += paso.costoTotal;
      total.opcionalesSinMargen += sinMargen;
    } else {
      total.incluidosSinMargen += sinMargen;
    }
  }
  for (const componente of componentes)
    sumar(costosPasosPrecio(componente.pasos ?? [], componente.componentes));
  return total;
}

export function escalarCostosPasos(
  c: CostosPasosPrecio,
  factor: number,
): CostosPasosPrecio {
  return {
    opcionales: c.opcionales * factor,
    opcionalesSinMargen: c.opcionalesSinMargen * factor,
    incluidosSinMargen: c.incluidosSinMargen * factor,
  };
}
