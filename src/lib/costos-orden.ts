/**
 * Costeo de una propuesta/OT: la matemática, sin JSX.
 *
 * Existe para que el desglose de UN producto (tab Productos › Costos) y la
 * vista CONSOLIDADA de la orden (tab Costos) salgan de la MISMA cuenta. La
 * cascada del precio tiene varias sutilezas —impuestos por dentro con base
 * NETO o BRUTO_COBRADO, el residuo de redondeo que absorbe el último, la
 * definición de costo variable— y tenerlas escritas dos veces garantizaba que
 * un día dieran distinto en dos pantallas que el usuario compara.
 *
 * Ver docs/costos-consolidados-ot-diseno.md
 */

import type {
  PropuestaCargoDirecto,
  PropuestaItem,
  UnidadPropuesta,
} from "@/lib/propuestas";
import type {
  TableroItemData,
  TableroPasoData,
} from "@/lib/tablero-produccion";

type CotizacionItem = PropuestaItem["cotizacion"];
type PasoCosteo = CotizacionItem["pasos"][number];

/** Bajo este margen el renglón se marca en rojo (mismo umbral que el item). */
export const MARGEN_ALERTA_PCT = 25;

function getCotizacionTotalBruto(cotizacion: CotizacionItem) {
  return (
    cotizacion.desglosePrecio?.precioBrutoTotal ??
    cotizacion.precio?.precioTotal ??
    cotizacion.costos.total
  );
}

function getCantidadPrecio(cotizacion: CotizacionItem, itemCantidad: number) {
  return (
    cotizacion.cantidadComercialPricing ??
    cotizacion.cantidadEfectiva ??
    itemCantidad
  );
}

/** Costo de tiempo del paso: la tarifa del centro por lo que lo ocupó. */
export function getCostoTiempoPaso(paso: PasoCosteo) {
  return paso.tiempo?.costo ?? 0;
}

export function sumMaterialesPaso(paso: PasoCosteo) {
  return (paso.materiales ?? []).reduce(
    (acc, material) => acc + material.costoTotal,
    0,
  );
}

export function sumCargosPaso(paso: PasoCosteo) {
  return (paso.cargosDirectosPaso ?? []).reduce(
    (acc, cargo) => acc + cargo.monto,
    0,
  );
}

/**
 * Bloques de tiempo extra del paso (preparación, traslado): tiempo que no
 * depende de la cantidad y puede tarifarse en otro centro. Sus minutos ya están
 * dentro de `tiempo.totalMin`; su costo va SEPARADO del tiempo de trabajo y se
 * muestra en la columna "Cargos" del paso.
 * Ver docs/cargos-por-paso-analisis-y-plan.md §7.
 */
export function sumTiempoExtraPaso(paso: PasoCosteo) {
  return (paso.tiempo?.tiemposExtra ?? []).reduce(
    (acc, bloque) => acc + bloque.costo,
    0,
  );
}

/** Lo que se muestra en la columna "Cargos" del paso: cargos monetarios + el
 *  costo de los bloques de tiempo extra. */
export function sumCargosYTiempoExtraPaso(paso: PasoCosteo) {
  return sumCargosPaso(paso) + sumTiempoExtraPaso(paso);
}

export function getVisibleCostSteps(pasos: PasoCosteo[]) {
  return pasos.filter((paso) => {
    if (paso.costoTotal > 0) return true;
    // Un paso activado pero SIN costo NI tiempo es andamiaje/ruido: p.ej. la
    // impresión en 0 del renglón de anillado, que sólo existe para que el motor
    // pueda cotizar el paso opcional. No aporta al costo → se oculta del desglose.
    return paso.activado && (paso.tiempo?.totalMin ?? 0) > 0;
  });
}

/** Un renglón de la cascada del precio. */
export type FilaCosto = {
  key: string;
  label: string;
  hint?: string;
  tipo: string;
  monto: number;
  warn?: boolean;
};

export type CostoItemDesglose = {
  /** Costo total de producirlo (materiales + centro + proveedor + cargos). */
  costo: number;
  precioNeto: number;
  precioBruto: number;
  precioBaseTotal: number;
  comisionesTotal: number;
  /** Parte de las comisiones que es de PASARELA (base bruto): la que depende de
   *  cómo pagó el cliente y se reconcilia contra los cobros reales (Fase B). */
  comisionesPasarelaTotal: number;
  /** Impuestos POR DENTRO: ya están en el precio, no se le muestran al cliente. */
  costosInternosTotal: number;
  impuestosInternosFilas: Array<{ key: string; nombre: string; monto: number }>;
  /** Nombres de los impuestos POR FUERA ("IVA 21%"), para rotular la fila. */
  impuestosPorFueraNombres: string;
  ivaTotal: number;
  margenMonto: number;
  margenPct: number;
  contribucionMonto: number;
  contribucionPct: number;
  /** Buckets del costo. */
  materialesTotal: number;
  /** Lo que costó el tiempo: la tarifa de cada centro por lo que lo ocupó. */
  tiempoTotal: number;
  /** Lo que costaron los bloques de tiempo extra (preparación, traslados). */
  tiempoExtraTotal: number;
  tercerizadoTotal: number;
  cargosTotal: number;
  /** Filas que componen el precio neto (suman 100%). */
  filasNeto: FilaCosto[];
};

/**
 * Desglose de costo/precio de UN item. `costo` entra por parámetro porque el
 * llamador ya lo tiene calculado (`calcularCostoTotal`).
 */
export function calcularCostoItem(
  item: PropuestaItem,
  costo: number,
): CostoItemDesglose {
  const precioNeto = item.subtotal;
  const precioBruto = getCotizacionTotalBruto(item.cotizacion);
  const desglosePrecio = item.cotizacion.desglosePrecio;
  const cantidadPrecio = getCantidadPrecio(item.cotizacion, item.cantidad);
  const precioBaseTotal = desglosePrecio
    ? desglosePrecio.precioBase * cantidadPrecio
    : precioNeto;
  const comisionesTotal = desglosePrecio
    ? desglosePrecio.totalComisiones * cantidadPrecio
    : 0;
  // La parte PASARELA es la de base BRUTO_COBRADO (% sobre lo cobrado). Es la
  // única que cambia según cómo pague el cliente; la de vendedor (base neto) es
  // real llueve o truene. precioBruto ya es el total, así que %×bruto = total.
  const comisionesPasarelaTotal = (desglosePrecio?.comisiones ?? [])
    .filter((c) => (c.baseCalculo ?? "NETO") === "BRUTO_COBRADO")
    .reduce((acc, c) => acc + (precioBruto * c.porcentaje) / 100, 0);
  const margenMonto = precioBaseTotal - costo;
  // El margen se expresa sobre el NETO (sin IVA): es la base sobre la que se
  // configura el margen del Tab Precio — así "margen 40%" configurado se lee
  // 40% acá (y no 33% como cuando se dividía por el bruto, que incluye el IVA
  // y no es ingreso).
  const margenPct = precioNeto > 0 ? (margenMonto / precioNeto) * 100 : 0;

  const materialesTotal = item.cotizacion.costos.materialesTotal;
  const tercerizadoTotal = item.cotizacion.costos.tercerizadoTotal ?? 0;
  const cargosTotal = item.cotizacion.costos.cargosDirectosTotal;
  const cargosSinMargenTotal = item.cotizacion.costos.cargosSinMargenTotal ?? 0;
  // Tiempo extra (preparación, traslados): son horas de un centro, no un
  // desembolso. Por eso tiene fila propia y NO entra en los costos variables:
  // la contribución tiene que cubrirlo, igual que al resto del tiempo.
  const tiempoExtraTotal = item.cotizacion.costos.tiempoExtraTotal ?? 0;

  // ── Cascada del precio: cada fila suma hacia abajo hasta el precio de venta.
  //    costo (materiales + centro de costo + cargos) + impuestos internos +
  //    comisiones + margen = precio neto; neto + IVA = precio de venta.
  const costosInternosTotal = Math.max(
    0,
    precioNeto - precioBaseTotal - comisionesTotal,
  );
  const ivaTotal = Math.max(0, precioBruto - precioNeto);
  // Margen de contribución = Precio neto − costos variables. Variables (decisión
  // del usuario): materiales + costo de proveedor (tercerizado) + cargos +
  // impuestos internos + comisiones. El centro de costo (máquina + mano de obra)
  // es estructura fija que la contribución cubre → MC = centro de costo + margen.
  const costosVariablesTotal =
    materialesTotal +
    cargosTotal +
    tercerizadoTotal +
    costosInternosTotal +
    comisionesTotal;
  const contribucionMonto = precioNeto - costosVariablesTotal;
  const contribucionPct =
    precioNeto > 0 ? (contribucionMonto / precioNeto) * 100 : 0;

  // Impuestos internos desglosados uno por uno (IIBB sobre NETO, cheque sobre
  // BRUTO_COBRADO). La suma da costosInternosTotal; el último absorbe el
  // residuo de redondeo para que el waterfall siga sumando exacto.
  const impuestosInternos = (desglosePrecio?.impuestos ?? [])
    .filter((impuesto) => (impuesto.traslado ?? "POR_DENTRO") !== "POR_FUERA")
    .slice()
    .sort((a, b) => a.orden - b.orden);
  let internosAcumulado = 0;
  const impuestosInternosFilas = impuestosInternos.map((impuesto, index) => {
    const base =
      (impuesto.baseCalculo ?? "NETO") === "BRUTO_COBRADO"
        ? precioBruto
        : precioNeto;
    const monto =
      index === impuestosInternos.length - 1
        ? costosInternosTotal - internosAcumulado
        : (base * impuesto.porcentaje) / 100;
    internosAcumulado += monto;
    return { key: `imp-${impuesto.codigo}`, nombre: impuesto.nombre, monto };
  });
  const impuestosPorFueraNombres = (desglosePrecio?.impuestos ?? [])
    .filter((impuesto) => impuesto.traslado === "POR_FUERA")
    .map((impuesto) => `${impuesto.nombre} ${impuesto.porcentaje}%`)
    .join(" + ");

  const buckets: FilaCosto[] = [
    {
      key: "materiales",
      label: "Materiales",
      tipo: "Materia prima",
      monto: materialesTotal,
    },
    {
      key: "centro-costo",
      label: "Centro de costo",
      tipo: "Centro de costo",
      monto: item.cotizacion.costos.tiempoTotal,
    },
    {
      key: "tiempo-extra",
      label: "Tiempo extra",
      hint: "preparación y traslados: no dependen de la cantidad",
      tipo: "Centro de costo",
      monto: tiempoExtraTotal,
    },
    {
      key: "tercerizado",
      label: "Costo de proveedor",
      tipo: "Proveedor",
      monto: tercerizadoTotal,
    },
    {
      key: "cargos",
      label: "Cargos directos",
      hint:
        cargosSinMargenTotal > 0
          ? "incluye desembolsos trasladados sin utilidad"
          : undefined,
      tipo: "Cargo directo",
      monto: cargosTotal,
    },
  ];

  const filasNeto: FilaCosto[] = [
    // Un bucket en cero no es información: se cae de la cascada. El desdoble de
    // máquina/mano de obra se filtra igual, así que un centro con MO pero sin
    // runtime (paso 100% manual) muestra sólo la fila que tiene plata.
    ...buckets.filter((bucket) => bucket.monto > 0),
    ...(impuestosInternosFilas.length > 0
      ? impuestosInternosFilas.map((fila) => ({
          key: fila.key,
          label: fila.nombre,
          hint: "ya incluido en el precio, no se muestra al cliente",
          tipo: "Impuesto",
          monto: fila.monto,
        }))
      : costosInternosTotal > 0
        ? [
            {
              key: "impuestos-internos",
              label: "Impuestos internos",
              hint: "ya incluidos en el precio, no se muestran al cliente",
              tipo: "Impuesto",
              monto: costosInternosTotal,
            },
          ]
        : []),
    ...(comisionesTotal > 0
      ? [
          {
            key: "comisiones",
            label: "Comisiones",
            tipo: "Comisión",
            monto: comisionesTotal,
          },
        ]
      : []),
    {
      key: "margen",
      label: "Margen",
      tipo: "Rentabilidad",
      monto: margenMonto,
      warn: margenPct < MARGEN_ALERTA_PCT,
    },
  ];

  return {
    costo,
    precioNeto,
    precioBruto,
    precioBaseTotal,
    comisionesTotal,
    comisionesPasarelaTotal,
    costosInternosTotal,
    impuestosInternosFilas,
    impuestosPorFueraNombres,
    ivaTotal,
    margenMonto,
    margenPct,
    contribucionMonto,
    contribucionPct,
    materialesTotal,
    tiempoTotal: item.cotizacion.costos.tiempoTotal,
    tiempoExtraTotal,
    tercerizadoTotal,
    cargosTotal,
    filasNeto,
  };
}

// ── Consolidado de la orden ──────────────────────────────────────────────

export type LineaItemCosto = {
  itemId: string;
  nombre: string;
  cantidad: number;
  unidad: UnidadPropuesta;
  desglose: CostoItemDesglose;
  /** El item todavía no se cotizó: no tiene costo que sumar. */
  sinCostear: boolean;
};

export type CentroCostoConsolidado = {
  centroCostoId: string | null;
  nombre: string;
  pasos: number;
  minutosCotizados: number;
  /** Lo que el centro le costó a la orden: su tarifa por el tiempo ocupado. */
  costoTotal: number;
};

export type CostosOrdenConsolidado = {
  /** Renglón por producto, en el orden en que están en la orden. */
  lineas: LineaItemCosto[];
  /** Cuántos items no se pueden costear (sin cotización). */
  itemsSinCostear: number;
  /** Suma de los costos de producción de todos los items. */
  costoItems: number;
  /**
   * Cargos directos cargados A NIVEL ORDEN (flete, viático). Son costo de la
   * orden que NINGÚN item ve: por eso el margen por producto está inflado
   * respecto del margen real de la orden, y por eso esta vista existe.
   */
  cargosOrdenTotal: number;
  /** costoItems + cargosOrdenTotal. */
  costoTotal: number;
  precioNeto: number;
  precioBruto: number;
  ivaTotal: number;
  comisionesTotal: number;
  /** Parte pasarela (base bruto) del total de comisiones — se reconcilia
   *  contra los cobros reales de la orden (Fase B). */
  comisionesPasarelaTotal: number;
  costosInternosTotal: number;
  margenMonto: number;
  margenPct: number;
  contribucionMonto: number;
  contribucionPct: number;
  materialesTotal: number;
  /** Lo que costó el tiempo de todos los centros. */
  centroCostoTotal: number;
  tercerizadoTotal: number;
  /** Cargos de los items + cargos de la orden. */
  cargosTotal: number;
  /**
   * Composición del costo, ordenada de mayor a menor. Suma `costoTotal`;
   * incluye un renglón "Sin desglosar" cuando el snapshot del item guardó el
   * total pero no sus buckets (órdenes viejas).
   */
  composicion: Array<{
    key: string;
    label: string;
    monto: number;
    pct: number;
  }>;
  centros: CentroCostoConsolidado[];
  minutosCotizados: number;
};

/** El item no se cotizó (mismo criterio que el detalle por producto). */
export function itemSinCostear(item: PropuestaItem) {
  return item.precioUnitario === 0 && item.total === 0;
}

export function consolidarCostosOrden(
  items: PropuestaItem[],
  cargosOrden: PropuestaCargoDirecto[],
): CostosOrdenConsolidado {
  const lineas: LineaItemCosto[] = items.map((item) => ({
    itemId: item.id,
    nombre: item.productoNombre,
    cantidad: item.cantidad,
    unidad: item.unidadMedida,
    desglose: calcularCostoItem(item, item.cotizacion.costos.total),
    sinCostear: itemSinCostear(item),
  }));
  const costeadas = lineas.filter((linea) => !linea.sinCostear);
  const suma = (pick: (d: CostoItemDesglose) => number) =>
    costeadas.reduce((acc, linea) => acc + pick(linea.desglose), 0);

  const costoItems = suma((d) => d.costo);
  // Los cargos de orden se toman por su NETO: el impuesto del cargo es del eje
  // del precio, no del costo (sumarlo contaría el IVA como si fuera costo).
  const cargosOrdenTotal = cargosOrden.reduce(
    (acc, cargo) => acc + cargo.montoNeto,
    0,
  );
  const costoTotal = costoItems + cargosOrdenTotal;
  const precioNeto = suma((d) => d.precioNeto);
  const precioBruto = suma((d) => d.precioBruto);
  const comisionesTotal = suma((d) => d.comisionesTotal);
  const comisionesPasarelaTotal = suma((d) => d.comisionesPasarelaTotal);
  const costosInternosTotal = suma((d) => d.costosInternosTotal);
  const materialesTotal = suma((d) => d.materialesTotal);
  // El tiempo extra son horas de un centro: entra al total de centros aunque el
  // desglose lo muestre aparte (docs/cargos-por-paso-analisis-y-plan.md §7.3).
  const centroCostoTotal = suma((d) => d.tiempoTotal + d.tiempoExtraTotal);
  const tercerizadoTotal = suma((d) => d.tercerizadoTotal);
  const cargosItems = suma((d) => d.cargosTotal);
  const cargosTotal = cargosItems + cargosOrdenTotal;

  // El margen de la orden NO es la suma de los márgenes de los items: los
  // cargos de orden son costo que ningún item cargó.
  const margenMonto = suma((d) => d.margenMonto) - cargosOrdenTotal;
  const margenPct = precioNeto > 0 ? (margenMonto / precioNeto) * 100 : 0;
  // Los cargos de orden son variables (se gastan por ESTE trabajo), así que
  // bajan la contribución igual que los cargos de item.
  const contribucionMonto = suma((d) => d.contribucionMonto) - cargosOrdenTotal;
  const contribucionPct =
    precioNeto > 0 ? (contribucionMonto / precioNeto) * 100 : 0;

  // Snapshots viejos guardan el costo total del item pero no sus buckets. El
  // resto se muestra como tal en vez de repartirlo: la composición tiene que
  // sumar el costo real de la orden, y un bucket inventado es peor que un
  // "sin desglosar" explícito.
  const sinDesglosar = Math.max(
    0,
    costoItems -
      (materialesTotal + centroCostoTotal + tercerizadoTotal + cargosItems),
  );

  const composicion = [
    { key: "materiales", label: "Materiales", monto: materialesTotal },
    { key: "centro-costo", label: "Centro de costo", monto: centroCostoTotal },
    { key: "proveedor", label: "Proveedor", monto: tercerizadoTotal },
    { key: "cargos", label: "Cargos directos", monto: cargosTotal },
    { key: "sin-desglosar", label: "Sin desglosar", monto: sinDesglosar },
  ]
    .filter((parte) => parte.monto > 0)
    .map((parte) => ({
      ...parte,
      pct: costoTotal > 0 ? (parte.monto / costoTotal) * 100 : 0,
    }))
    .sort((a, b) => b.monto - a.monto);

  // Centros de costo: se agrega POR CENTRO cruzando todos los items, que es lo
  // que ninguna vista por producto puede mostrar ("qué máquina se comió la
  // orden"). Los pasos tercerizados no tienen centro y quedan afuera: su costo
  // es del proveedor, no de un centro nuestro.
  const centrosPorId = new Map<string, CentroCostoConsolidado>();
  let minutosCotizados = 0;
  const acumularCentro = (
    centroCostoId: string | null,
    nombreCentro: string | null,
    minutos: number,
    costo: number,
    sumaUnPaso: boolean,
  ) => {
    const nombre = nombreCentro ?? "Sin centro asignado";
    const clave = centroCostoId ?? `sin-centro:${nombre}`;
    const actual = centrosPorId.get(clave) ?? {
      centroCostoId,
      nombre,
      pasos: 0,
      minutosCotizados: 0,
      costoTotal: 0,
    };
    if (sumaUnPaso) actual.pasos += 1;
    actual.minutosCotizados += minutos;
    actual.costoTotal += costo;
    centrosPorId.set(clave, actual);
    minutosCotizados += minutos;
  };
  for (const item of items) {
    if (itemSinCostear(item)) continue;
    for (const paso of item.cotizacion.pasos) {
      if (!paso.activado || !paso.tiempo) continue;
      // Los bloques de tiempo extra pueden vivir en OTRO centro que el paso
      // (el traslado en Instalación, el trabajo en Taller): se atribuyen al
      // suyo, o el centro que hizo las horas no las ve.
      const bloques = paso.tiempo.tiemposExtra ?? [];
      const extraMin = bloques.reduce((acc, b) => acc + b.minutos, 0);
      acumularCentro(
        paso.tiempo.centroCostoId ?? null,
        paso.tiempo.centroCostoNombre ?? null,
        Math.max(0, paso.tiempo.totalMin - extraMin),
        getCostoTiempoPaso(paso),
        true,
      );
      for (const bloque of bloques) {
        acumularCentro(
          bloque.centroCostoId ?? null,
          bloque.centroCostoNombre ?? paso.tiempo.centroCostoNombre ?? null,
          bloque.minutos,
          bloque.costo,
          false,
        );
      }
    }
  }

  return {
    lineas,
    itemsSinCostear: lineas.length - costeadas.length,
    costoItems,
    cargosOrdenTotal,
    costoTotal,
    precioNeto,
    precioBruto,
    ivaTotal: suma((d) => d.ivaTotal),
    comisionesTotal,
    comisionesPasarelaTotal,
    costosInternosTotal,
    margenMonto,
    margenPct,
    contribucionMonto,
    contribucionPct,
    materialesTotal,
    centroCostoTotal,
    tercerizadoTotal,
    cargosTotal,
    composicion,
    centros: [...centrosPorId.values()].sort(
      (a, b) => b.costoTotal - a.costoTotal,
    ),
    minutosCotizados,
  };
}

// ── Real vs. cotizado ────────────────────────────────────────────────────

/**
 * Un tiempo real ATÍPICO no se compara con nada: es el clásico "inicié y
 * completé sin querer" o el paso que quedó con el cronómetro corriendo toda la
 * noche. Mismo criterio que usa el Panel para sus medianas
 * (apps/api/src/reportes/produccion.service.ts): más de 8 horas, o más de 5
 * veces el estimado. Incluirlos no hace el número más completo, lo hace falso.
 */
export const REAL_MAX_MIN = 480;
export const REAL_MAX_FACTOR_ESTIMADO = 5;

export function tiempoRealAtipico(
  realMin: number,
  estimadoMin: number | null,
): boolean {
  if (realMin > REAL_MAX_MIN) return true;
  if (estimadoMin != null && estimadoMin > 0) {
    return realMin > REAL_MAX_FACTOR_ESTIMADO * estimadoMin;
  }
  return false;
}

/**
 * Un paso en modo `solo_completar` asienta como tiempo real una COPIA del
 * estimado (D3 de registro-tiempos): nadie lo midió. Contarlo como medido es
 * el error silencioso más fácil de cometer acá — mete un desvío cero
 * garantizado en el numerador y el denominador, así que diluye el desvío real
 * hacia cero y hace decir "cobertura 100%" cuando la mitad del dato no se
 * midió. Se excluye de la comparación y se informa aparte.
 */
export function tiempoFueMedido(fuente: string | null): boolean {
  return (
    fuente === "medido" || fuente === "medido_lote" || fuente === "declarado"
  );
}

export type PasoRealVsCotizado = {
  pasoId: string;
  nombre: string;
  itemNombre: string;
  centroCostoId: string | null;
  centroCostoNombre: string;
  estado: TableroPasoData["estado"];
  tipoEjecucion: string;
  minutosCotizados: number;
  /** Null mientras el paso no esté hecho (o su tiempo no valga). */
  minutosReales: number | null;
  tiempoFuente: TableroPasoData["tiempoFuente"];
  /** El tiempo real existe pero no se compara (ver `tiempoRealAtipico`). */
  atipico: boolean;
  /** Está hecho pero nadie lo midió: no entra en la comparación. */
  hechoSinMedir: boolean;
  /** Tarifa horaria del centro CONGELADA al cotizar. */
  tarifaHora: number;
  costoCotizado: number;
  /**
   * Costo con los minutos REALES a la tarifa cotizada. Null si el paso no
   * aportó tiempo comparable. La mano de obra se deja como cotizada: se paga
   * sobre setup/cleanup, y el cronómetro mide el paso entero, así que
   * reescalarla con el tiempo total la inflaría.
   * Ver docs/hora-hombre-setup-cleanup-diseno.md
   */
  costoReal: number | null;
};

export type CentroRealVsCotizado = CentroCostoConsolidado & {
  /** Pasos del centro con tiempo real comparable. */
  pasosMedidos: number;
  minutosRealesMedidos: number;
  /** Minutos cotizados SÓLO de los pasos medidos (compara peras con peras). */
  minutosCotizadosMedidos: number;
  costoCotizadoMedido: number;
  costoRealMedido: number;
  desvioMin: number;
  desvioPct: number | null;
};

export type RealVsCotizado = {
  pasos: PasoRealVsCotizado[];
  centros: CentroRealVsCotizado[];
  /** Pasos materializados en total (denominador de la cobertura). */
  pasosTotal: number;
  /** Pasos hechos: el universo que PODRÍA tener tiempo. */
  pasosHechos: number;
  /** Pasos con tiempo real comparable (numerador de la cobertura). */
  pasosMedidos: number;
  /**
   * Hechos que NO se pudieron comparar: el sistema asentó el estimado (modo
   * solo_completar), el tiempo se marcó inválido, o quedó fuera por atípico.
   * Es el complemento honesto de la cobertura.
   */
  pasosHechosSinMedir: number;
  /** Hechos con tiempo descartado por atípico. */
  pasosAtipicos: number;
  /** Pasos que no se pudieron emparejar con el snapshot (sin costo cotizado). */
  pasosSinEmparejar: number;
  minutosCotizadosMedidos: number;
  minutosRealesMedidos: number;
  costoCotizadoMedido: number;
  costoRealMedido: number;
  desvioMonto: number;
  desvioPct: number | null;
  /** Fuentes del tiempo presentes, para poder decir de qué calidad es el dato. */
  fuentes: Array<{ fuente: string; pasos: number }>;
};

/**
 * Cruza el tiempo REAL de los pasos materializados con el costo COTIZADO del
 * snapshot. Empareja por `rutaPasoId`, y cae al índice entre los pasos
 * ACTIVADOS del snapshot cuando falta (órdenes materializadas antes de que la
 * trazabilidad lo guardara) — ese es exactamente el orden que usó la
 * materialización, así que el índice es un fallback fiel y no una adivinanza.
 */
export function cruzarRealVsCotizado(
  items: PropuestaItem[],
  itemsTablero: TableroItemData[],
): RealVsCotizado {
  const snapshotPorItemId = new Map<string, PropuestaItem>();
  for (const item of items) {
    // El id del PropuestaItem rehidratado ES el id del OrdenTrabajoItem.
    snapshotPorItemId.set(item.id, item);
  }

  const pasos: PasoRealVsCotizado[] = [];
  let pasosTotal = 0;
  let pasosHechos = 0;
  let pasosSinEmparejar = 0;

  for (const itemTablero of itemsTablero) {
    const propuesta = snapshotPorItemId.get(itemTablero.id);
    const activados = (propuesta?.cotizacion.pasos ?? []).filter(
      (paso) => paso.activado,
    );
    const porRutaPasoId = new Map<string, PasoCosteo>();
    for (const paso of activados) {
      if (paso.rutaPasoId) porRutaPasoId.set(paso.rutaPasoId, paso);
    }

    for (const pasoReal of itemTablero.pasos) {
      pasosTotal += 1;
      if (pasoReal.estado === "hecho") pasosHechos += 1;
      const cotizado =
        (pasoReal.rutaPasoId
          ? porRutaPasoId.get(pasoReal.rutaPasoId)
          : undefined) ?? activados[pasoReal.indice];
      if (!cotizado) {
        pasosSinEmparejar += 1;
        continue;
      }

      const minutosCotizados = cotizado.tiempo?.totalMin ?? 0;
      const realCrudo =
        pasoReal.estado === "hecho" &&
        pasoReal.tiempoRealMin != null &&
        tiempoFueMedido(pasoReal.tiempoFuente)
          ? pasoReal.tiempoRealMin
          : null;
      const atipico =
        realCrudo != null &&
        tiempoRealAtipico(realCrudo, pasoReal.duracionEstimadaMin);
      const minutosReales = atipico ? null : realCrudo;
      // Hecho pero sin tiempo comparable, por cualquiera de las tres razones:
      // nadie lo cronometró (el sistema asentó el estimado), el tiempo se
      // marcó inválido, o quedó afuera por atípico. `pasosAtipicos` es un
      // subconjunto de esto, y así la nota puede decir "N, M de ellos por
      // atípico" sin que los números se contradigan.
      const hechoSinMedir =
        pasoReal.estado === "hecho" && minutosReales === null;
      const costoCotizado = getCostoTiempoPaso(cotizado);
      const tarifaHora = cotizado.tiempo?.tarifaHora ?? 0;
      // El costo real reescala con la tarifa cotizada: así el desvío que se ve
      // es el del TIEMPO, no una mezcla de tiempo con un cambio de tarifa
      // entre el día que se cotizó y hoy.
      const costoReal =
        minutosReales != null && minutosCotizados > 0
          ? (costoCotizado / minutosCotizados) * minutosReales
          : minutosReales != null
            ? costoCotizado
            : null;

      pasos.push({
        pasoId: pasoReal.id,
        nombre: pasoReal.nombre,
        itemNombre: itemTablero.nombre,
        centroCostoId: pasoReal.centroCostoId,
        centroCostoNombre:
          pasoReal.centroCostoNombre ??
          cotizado.tiempo?.centroCostoNombre ??
          "Sin centro asignado",
        estado: pasoReal.estado,
        tipoEjecucion: pasoReal.tipoEjecucion,
        minutosCotizados,
        minutosReales,
        tiempoFuente: pasoReal.tiempoFuente,
        atipico,
        hechoSinMedir,
        tarifaHora,
        costoCotizado,
        costoReal,
      });
    }
  }

  // Los agregados se calculan SÓLO sobre los pasos medidos: mezclar un paso sin
  // tiempo (que aportaría 0 real contra su cotizado) haría ver un ahorro que no
  // existe, y es el error más fácil de cometer en esta comparación.
  const medidos = pasos.filter((paso) => paso.minutosReales != null);
  const centrosPorClave = new Map<string, CentroRealVsCotizado>();
  for (const paso of pasos) {
    const clave = paso.centroCostoId ?? `sin-centro:${paso.centroCostoNombre}`;
    const actual = centrosPorClave.get(clave) ?? {
      centroCostoId: paso.centroCostoId,
      nombre: paso.centroCostoNombre,
      pasos: 0,
      minutosCotizados: 0,
      costoTotal: 0,
      pasosMedidos: 0,
      minutosRealesMedidos: 0,
      minutosCotizadosMedidos: 0,
      costoCotizadoMedido: 0,
      costoRealMedido: 0,
      desvioMin: 0,
      desvioPct: null,
    };
    actual.pasos += 1;
    actual.minutosCotizados += paso.minutosCotizados;
    actual.costoTotal += paso.costoCotizado;
    if (paso.minutosReales != null) {
      actual.pasosMedidos += 1;
      actual.minutosRealesMedidos += paso.minutosReales;
      actual.minutosCotizadosMedidos += paso.minutosCotizados;
      actual.costoCotizadoMedido += paso.costoCotizado;
      actual.costoRealMedido += paso.costoReal ?? 0;
    }
    centrosPorClave.set(clave, actual);
  }
  const centros = [...centrosPorClave.values()].map((centro) => {
    const desvioMin =
      centro.minutosRealesMedidos - centro.minutosCotizadosMedidos;
    return {
      ...centro,
      desvioMin,
      desvioPct:
        centro.minutosCotizadosMedidos > 0
          ? (desvioMin / centro.minutosCotizadosMedidos) * 100
          : null,
    };
  });

  const minutosCotizadosMedidos = medidos.reduce(
    (acc, paso) => acc + paso.minutosCotizados,
    0,
  );
  const minutosRealesMedidos = medidos.reduce(
    (acc, paso) => acc + (paso.minutosReales ?? 0),
    0,
  );
  const costoCotizadoMedido = medidos.reduce(
    (acc, paso) => acc + paso.costoCotizado,
    0,
  );
  const costoRealMedido = medidos.reduce(
    (acc, paso) => acc + (paso.costoReal ?? 0),
    0,
  );

  const fuentesPorClave = new Map<string, number>();
  for (const paso of medidos) {
    const clave = paso.tiempoFuente ?? "sin fuente";
    fuentesPorClave.set(clave, (fuentesPorClave.get(clave) ?? 0) + 1);
  }

  return {
    pasos,
    centros: centros.sort((a, b) => b.costoTotal - a.costoTotal),
    pasosTotal,
    pasosHechos,
    pasosMedidos: medidos.length,
    pasosHechosSinMedir: pasos.filter((paso) => paso.hechoSinMedir).length,
    pasosAtipicos: pasos.filter((paso) => paso.atipico).length,
    pasosSinEmparejar,
    minutosCotizadosMedidos,
    minutosRealesMedidos,
    costoCotizadoMedido,
    costoRealMedido,
    desvioMonto: costoRealMedido - costoCotizadoMedido,
    desvioPct:
      costoCotizadoMedido > 0
        ? ((costoRealMedido - costoCotizadoMedido) / costoCotizadoMedido) * 100
        : null,
    fuentes: [...fuentesPorClave.entries()]
      .map(([fuente, pasosFuente]) => ({ fuente, pasos: pasosFuente }))
      .sort((a, b) => b.pasos - a.pasos),
  };
}

// ── Reconciliación de la comisión de pasarela (Fase B) ───────────────────

/**
 * La comisión de pasarela se cotiza fija ("8% por las dudas"), pero el costo
 * REAL depende de cómo pagó el cliente (efectivo = 0). Esto compara la pasarela
 * ESTIMADA contra la REAL de los cobros y ajusta el margen. NUNCA toca el precio
 * al cliente: es un ajuste de margen interno, por eso el riesgo es bajo. Ver
 * docs/comisiones-modelo-diseno.md.
 */
export type ComisionPasarelaReconciliacion = {
  /** Pasarela cotizada (parte base-bruto de las comisiones estimadas). */
  estimada: number;
  /** Pasarela real: suma de la comisión de los cobros de la orden. */
  real: number;
  /** estimada − real. Positivo = margen a favor (se pagó más barato). */
  ahorro: number;
  /** Bruto cobrado hasta ahora. */
  cobradoBruto: number;
  /** Total bruto de la orden (lo que hay para cobrar). */
  totalOrden: number;
  /** Se cobró (casi) todo ⇒ reconciliación DEFINITIVA; si no, provisional. */
  saldada: boolean;
  /** Cantidad de cobros considerados. */
  cobros: number;
  margenAjustadoMonto: number;
  margenAjustadoPct: number | null;
};

export function reconciliarComisionPasarela(input: {
  comisionPasarelaEstimada: number;
  margenMonto: number;
  precioNeto: number;
  totalOrden: number;
  cobros: Array<{ montoBruto: number; comisionMonto: number }>;
}): ComisionPasarelaReconciliacion {
  const real = input.cobros.reduce((acc, c) => acc + c.comisionMonto, 0);
  const cobradoBruto = input.cobros.reduce((acc, c) => acc + c.montoBruto, 0);
  // Epsilon de 1 unidad de moneda: la orden puede quedar cobrada con centavos de
  // diferencia por redondeo y no por eso deja de estar saldada.
  const saldada = input.totalOrden > 0 && cobradoBruto >= input.totalOrden - 1;
  const ahorro = input.comisionPasarelaEstimada - real;
  const margenAjustadoMonto = input.margenMonto + ahorro;
  return {
    estimada: input.comisionPasarelaEstimada,
    real,
    ahorro,
    cobradoBruto,
    totalOrden: input.totalOrden,
    saldada,
    cobros: input.cobros.length,
    margenAjustadoMonto,
    margenAjustadoPct:
      input.precioNeto > 0
        ? (margenAjustadoMonto / input.precioNeto) * 100
        : null,
  };
}
