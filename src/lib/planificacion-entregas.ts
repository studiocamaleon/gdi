export type EntregaPlan = {
  clave: string;
  cantidad: number;
  fechaSolicitada?: string | null;
};
export type VinculoPlanEntrega = {
  planId: string;
  revisionId: string;
  expectedVersion: number;
};

export type ResumenDistribucion = {
  lotes?: { id: string; clave: string; secuencia: number; cantidad: number; fechaEntrega: string; revisionId: string }[];
  elegida: boolean;
  estado: string;
  entregas: {
    clave: string;
    cantidad: number;
    fechaSolicitada: string | null;
    fechaSugerida: string | null;
  }[];
};

/** Las sugerencias sólo participan de las fechas al elegir una alternativa. */
export function resumirDistribucion(
  plan: VistaPlanEntrega["plan"],
  entregas = plan?.entregas ?? [],
  editado = false,
): ResumenDistribucion | null {
  if (!entregas.length) return null;
  const alternativa =
    !editado && plan?.estado === "LISTA"
      ? plan.alternativas.find((a) => a.id === plan.alternativaElegidaId)
      : undefined;
  return {
    elegida: !!alternativa,
    estado: editado ? "EDITADA" : (plan?.estado ?? "EDITADA"),
    entregas: entregas.map((e) => ({
      clave: e.clave,
      cantidad: e.cantidad,
      fechaSolicitada: e.fechaSolicitada || null,
      fechaSugerida:
        alternativa?.entregas.find((a) => a.id === e.clave)?.fechaSugerida ??
        null,
    })),
  };
}

export function fechaFinalDistribucion(
  resumen?: ResumenDistribucion | null,
): string | null {
  if (!resumen?.elegida || !resumen.entregas.length) return null;
  const fechas = resumen.entregas.map(
    (e) => e.fechaSolicitada || e.fechaSugerida,
  );
  if (fechas.some((f) => !f)) return null;
  return fechaFinalItems(fechas);
}

/** La fecha global anterior es sólo respaldo, nunca impide adelantar la OT. */
export function fechaFinalItems(
  fechas: (string | null | undefined)[],
  respaldo = "",
): string {
  return (
    fechas.reduce<string>((max, f) => (f && f > max ? f : max), "") || respaldo
  );
}

export function nombreLoteEntrega(indice: number): string {
  let letra = "";
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26))
    letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
  return `Lote ${letra}`;
}

/** Se compara al abrir y al guardar; la huella no retiene copias del CAD. */
export async function huellaEntradaPlan(entrada: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(entrada));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}

/** El cliente cambia el precio comercial, no las piezas que deben fabricarse. */
export function huellaFabricacionPlan<T extends { clienteId?: string | null }>(entrada: T) {
  const { clienteId: _cliente, ...fabricacion } = entrada;
  void _cliente;
  return huellaEntradaPlan(fabricacion);
}

export function vinculoPlanPrevio(
  plan: VistaPlanEntrega["plan"],
  entregas: EntregaPlan[],
  versionVista?: number,
): VinculoPlanEntrega {
  if (!plan || firmaEntregas(entregas) !== firmaEntregas(plan.entregas))
    throw new Error(
      "Calculá la distribución con las últimas cantidades y fechas antes de guardar la OT.",
    );
  if (versionVista !== undefined && plan.version !== versionVista)
    throw new Error(
      "La distribución cambió en otra ventana. Revisala antes de guardar la OT.",
    );
  if (plan.estado === "SOLICITADA" || plan.estado === "CALCULANDO")
    throw new Error(
      "La distribución todavía se está calculando. Esperá a que termine antes de guardar la OT.",
    );
  if (plan.estado !== "LISTA")
    throw new Error(
      "Revisá la distribución de entregas antes de guardar la OT.",
    );
  if (!plan.alternativaElegidaId)
    throw new Error("Guardá la distribución elegida antes de crear la OT.");
  if (plan.desactualizado)
    throw new Error("Recalculá la distribución con la carga actual antes de guardar la OT.");
  return {
    planId: plan.id,
    revisionId: plan.revisionId,
    expectedVersion: plan.version,
  };
}
export type ReprogramacionEntrega = {
  nivel: "CON_MARGEN" | "MARGEN_REDUCIDO" | "CAMBIA_ENTREGAS";
  ordenesMovidas: string[];
  cambios: {pasoId:string;ordenId:string;ordenNumero:string;item:string;operacion:string;recurso:string;inicioAnterior:string;finAnterior:string;inicio:string;fin:string}[];
  entregasAfectadas: {ordenId:string;ordenNumero:string;raizId:string;nombre:string;fechaActual:string|null;fechaPropuesta:string|null;finAnterior:string;finPropuesto:string;margenAnterior:number|null;margenRestante:number|null;demoraHabiles:number;cambiaEntrega:boolean}[];
};
export type AlternativaEntrega = {
  reprogramacion?: ReprogramacionEntrega;
  id: string;
  nombre: string;
  estado: string;
  costo?: number | null;
  costoAdicional?: number | null;
  preparacionMin: number;
  condiciones: string[];
  esperaCola?: boolean;
  operacionesDesplazadas?: number;
  placas: number | null;
  entregas: {
    id: string;
    cantidad: number;
    fechaSolicitada: string | null;
    finProduccion: string | null;
    fechaSugerida: string | null;
    cumple: boolean | null;
    cumpleConMargen: boolean | null;
  }[];
  lotes: {
    id: string;
    nombre: string;
    cantidad: number;
    piezas: number;
    desde: number;
    hasta: number;
    minutos: number | null;
  }[];
};
export type VistaPlanEntrega = {
  reservaCapacidad: boolean;
  plan: null | {
    id: string;
    version: number;
    revisionId: string;
    revision: number;
    estado: string;
    cantidad: number;
    cantidadCalculada: number | null;
    alternativaElegidaId: string | null;
    ajusteNestingAceptado?: boolean;
    cambioEntregasAceptado?: boolean;
    reprogramacionAplicada?: boolean;
    reprogramacion?: {trabajos:{id:string;numero:string}[];excluidas:string[];evaluadas:number;motivo:string|null}|null;
    nesting?: null | {
      estado: "SIN_NESTING" | "CONSERVADO" | "REQUIERE_AJUSTE";
      motivo: string;
      placasOriginales: number | null;
      placasPlan: number;
      lotes: {
        modo?: "LOTE_COMPLETO";
        loteId: string;
        operacion: string;
        desde: number;
        hasta: number;
        cantidad: number;
        placas: number;
        layouts: {
          huella: string;
          copias: number;
          layoutOriginal: number | null;
        }[];
      }[];
    };
    entregas: EntregaPlan[];
    calculadaEl: string | null;
    zona: string | null;
    margenDiasHabiles: number | null;
    recomendadaId: string | null;
    economicaId: string | null;
    alternativas: AlternativaEntrega[];
    desactualizado: boolean;
    motivoDesactualizado: string | null;
    error: string | null;
    historial: {
      id: string;
      numero: number;
      estado: string;
      createdAt: string;
      calculadaEl: string | null;
    }[];
  };
};

export function repartirEntregas(
  cantidad: number,
  partes: number,
): EntregaPlan[] {
  if (
    !Number.isSafeInteger(cantidad) ||
    cantidad <= 0 ||
    !Number.isSafeInteger(partes) ||
    partes <= 0
  )
    return [];
  const n = Math.min(cantidad, partes, 50);
  const base = Math.floor(cantidad / n),
    resto = cantidad % n;
  return Array.from({ length: n }, (_, i) => ({
    clave: `entrega-${i + 1}`,
    cantidad: base + (i < resto ? 1 : 0),
  }));
}

export function validarDistribucion(
  cantidad: number,
  entregas: EntregaPlan[],
): string | null {
  if (
    !entregas.length ||
    entregas.length > 50 ||
    entregas.some((e) => !Number.isSafeInteger(e.cantidad) || e.cantidad <= 0)
  )
    return "Cada entrega necesita una cantidad entera mayor que cero.";
  const suma = entregas.reduce((s, e) => s + e.cantidad, 0);
  if (suma !== cantidad)
    return `Distribuí las ${cantidad} unidades: ahora hay ${suma}.`;
  let anterior = "";
  for (const e of entregas)
    if (e.fechaSolicitada) {
      const fecha = e.fechaSolicitada;
      const parsed = new Date(`${fecha}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
        !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== fecha
      )
        return "Revisá las fechas solicitadas.";
      if (fecha < anterior)
        return "Ordená las entregas desde la primera fecha hasta la última.";
      anterior = fecha;
    }
  return null;
}

/** Redistribuye cantidades, conservando las fechas y claves que siguen vigentes. */
export function regenerarEntregas(
  cantidad: number,
  partes: number,
  anteriores: EntregaPlan[],
): EntregaPlan[] {
  const claves = new Set(anteriores.map((e) => e.clave));
  return repartirEntregas(cantidad, partes).map((e, i) => {
    const anterior = anteriores[i];
    if (anterior) return { ...anterior, cantidad: e.cantidad };
    let n = i + 1;
    while (claves.has(`entrega-${n}`)) n += 1;
    const clave = `entrega-${n}`;
    claves.add(clave);
    return { ...e, clave };
  });
}

export function ordenarAlternativasPorCosto<
  T extends { costoAdicional?: number | null },
>(alternativas: readonly T[]): T[] {
  const valor = (a: T) =>
    typeof a.costoAdicional === "number" && Number.isFinite(a.costoAdicional)
      ? a.costoAdicional
      : Infinity;
  return [...alternativas].sort((a, b) => valor(a) - valor(b));
}

export function firmaEntregas(entregas: EntregaPlan[]) {
  return JSON.stringify(
    entregas.map((e) => [e.clave, e.cantidad, e.fechaSolicitada || null]),
  );
}
export function alternativaGuardable(estado: string) {
  return ["VIABLE", "SIN_MARGEN", "CONDICIONADA"].includes(estado);
}

export function motivoBloqueoDistribucion(datos: {
  calculando: boolean;
  editado: boolean;
  numeroPendiente: boolean;
  desactualizado?: boolean;
  motivoDesactualizado?: string | null;
  estado?: string;
  requiereAjuste: boolean;
  aceptaAjuste: boolean;
}): string | null {
  if (datos.calculando) return "Esperá a que termine el cálculo de las tandas.";
  if (datos.numeroPendiente)
    return "Generá las filas para la nueva cantidad de entregas.";
  if (datos.editado)
    return "Recalculá la propuesta con las cantidades y fechas que modificaste.";
  if (datos.desactualizado)
    return (
      datos.motivoDesactualizado || "Recalculá con la carga actual del taller."
    );
  if (!datos.estado)
    return "Calculá la propuesta para ver las fechas de cada tanda.";
  if (datos.estado === "DESPLAZA_TRABAJOS")
    return "Esta propuesta desplaza operaciones de otras órdenes. Recalculá con la carga actual antes de guardarla.";
  if (datos.estado === "FUERA_DE_FECHA")
    return "Una tanda termina después de la fecha solicitada. Cambiá esa fecha o dejala vacía para recibir una sugerencia y recalculá.";
  if (!alternativaGuardable(datos.estado))
    return "Faltan tiempos o recursos para estimar toda la producción. Revisá los datos indicados arriba.";
  if (datos.requiereAjuste && !datos.aceptaAjuste)
    return "Confirmá que aceptás el ajuste de los layouts y el costo adicional indicado.";
  return null;
}
