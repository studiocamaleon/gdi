import type {
  ContenidoTarifario,
  PoliticaPrecios,
} from "./centro-copiado-tarifarios-api";
import type {
  CeldaSimulacion,
  ResultadoCeldaSimulacion,
  EscenarioSimulado,
} from "../../apps/api/src/centro-copiado/tarifarios/simulacion-tarifario.types";
import { DecimalComercial as D } from "../../apps/api/src/centro-copiado/comercial/validaciones";
import { compararSimulacion } from "../../apps/api/src/centro-copiado/comercial/comparacion-simulacion";
import { ajustarPrecio, claveRango } from "./centro-copiado-tarifarios-editor";
import { claveCeldaSimulacion } from "../../apps/api/src/centro-copiado/tarifarios/simulacion-tarifario.types";

export function precioCelda(c: ContenidoTarifario, celda: CeldaSimulacion) {
  const matriz = c[celda.seccion];
  const fila = matriz?.filas[celda.fila];
  const desde = (fila?.rangosPropios ?? matriz?.rangosGenerales)?.[celda.tramo];
  if (!fila || desde == null) throw new Error("La celda ya no existe.");
  return {
    desde,
    fila,
    precio:
      fila.precios.find(
        (p) => claveRango(p.desdeCantidad) === claveRango(desde),
      )?.precioUnitario ?? null,
  };
}

export function ponerPrecio(
  c: ContenidoTarifario,
  celda: CeldaSimulacion,
  valor: string,
) {
  const { fila, desde } = precioCelda(c, celda);
  const precio = fila.precios.find(
    (p) => claveRango(p.desdeCantidad) === claveRango(desde),
  );
  if (precio) precio.precioUnitario = valor;
  else if (celda.seccion === "hojas")
    c.hojas!.filas[celda.fila].precios.push({
      desdeCantidad: Number(desde),
      precioUnitario: valor,
    });
  else
    c.cad!.filas[celda.fila].precios.push({
      desdeCantidad: String(desde),
      precioUnitario: valor,
    });
}

/** Precio fijo en la unidad comercial. Usa el precio neto real del motor;
 * descuenta la preparación cobrada aparte antes de dividir y convierte IVA una vez.
 * El mínimo es un piso de pedido, no una rebaja del precio unitario sugerido.
 */
export function sugerirCelda(
  c: ContenidoTarifario,
  r: ResultadoCeldaSimulacion,
  redondeo?: string,
  margenObjetivo?: string,
) {
  const { fila, desde, precio } = precioCelda(c, r.celda);
  const coberturas = fila.combinacion.cobertura
    ? [fila.combinacion.cobertura]
    : ["borrador", "normal", "alta"];
  if (
    r.escenarios.length !== coberturas.length ||
    coberturas.some(
      (v) => r.escenarios.filter((e) => e.cobertura === v).length !== 1,
    )
  )
    throw new Error(
      "Simulá todas las coberturas de la celda antes de sugerir.",
    );
  const avisos: string[] = [];
  let mayor = new D(0);
  for (const e of r.escenarios) {
    if (e.estado !== "CALCULADO")
      throw new Error("Hay una cobertura sin costo verificable.");
    if (
      e.comercial?.cargas == null ||
      (margenObjetivo === undefined && e.comercial.ventaMotorNeta == null)
    )
      throw new Error(
        e.comercial?.motivo ??
          "Volvé a simular para obtener el precio del motor.",
      );
    if (
      e.grupos.length !== 1 ||
      e.grupos[0].fila !== r.celda.fila ||
      !new D(e.grupos[0].desdeCantidad).eq(desde)
    )
      throw new Error(
        "La referencia distribuye la venta entre varias celdas; elegí otra referencia.",
      );
    avisos.push(...e.avisos);
    const factor = new D(1).plus(new D(e.ivaPorcentaje).div(100));
    const ventaNeta =
      margenObjetivo === undefined
        ? new D(e.comercial.ventaMotorNeta!)
        : ventaParaMargen(e, margenObjetivo);
    const enConvencion = ventaNeta.times(
      c.composicion.iva === "INCLUIDO" ? factor : 1,
    );
    const preparacion =
      c.composicion.preparacion.modalidad === "FIJA_PEDIDO"
        ? new D(c.composicion.preparacion.importe)
        : new D(0);
    const cantidad = new D(e.cantidadFacturable);
    if (!cantidad.gt(0) || !enConvencion.isFinite() || enConvencion.lt(0))
      throw new Error("El motor devolvió una referencia inválida.");
    const valor = D.max(0, enConvencion.minus(preparacion))
      .div(cantidad)
      .toDecimalPlaces(8, D.ROUND_CEIL);
    mayor = D.max(mayor, valor);
    if (preparacion.gte(enConvencion))
      avisos.push(
        "La preparación cubre el precio de referencia del motor; revisá el precio cero sugerido.",
      );
  }
  let nuevo = redondeo
    ? ajustarPrecio(mayor.toFixed(), "IMPORTE", "0", redondeo)
    : mayor.toFixed();
  if (nuevo == null || !/^\d{1,18}(\.\d{1,8})?$/.test(nuevo))
    throw new Error("El precio sugerido supera el importe admitido.");
  if (margenObjetivo !== undefined) {
    // La composición fiscal y las cargas se redondean a precisión monetaria.
    // Corregir hacia arriba si ese redondeo deja el resultado bajo el objetivo.
    const objetivo = leerMargenObjetivo(margenObjetivo).div(100);
    for (let intento = 0; intento < 12; intento++) {
      let aumento = new D(0);
      for (const e of r.escenarios) {
        if (e.estado !== "CALCULADO") continue;
        const { control, composicion } = compararSimulacion(
          c,
          r.celda.seccion,
          e,
          nuevo,
        );
        if (!composicion.total || control.cargasTotal == null)
          throw new Error(control.motivo);
        const neto = new D(composicion.total.neto);
        const utilidad = neto
          .minus(e.costoVariableTotal ?? e.costoTotal)
          .minus(control.cargasTotal);
        if (neto.gt(0) && utilidad.gte(neto.times(objetivo))) continue;
        const factor = new D(1).plus(new D(e.ivaPorcentaje).div(100));
        const pasoNeto = D.max(
          new D(10).pow(-e.decimalesPrecio),
          neto.times(objetivo).minus(utilidad),
        );
        aumento = D.max(
          aumento,
          pasoNeto
            .div(denominadorMargen(e, objetivo))
            .times(c.composicion.iva === "INCLUIDO" ? factor : 1)
            .div(e.cantidadFacturable),
        );
      }
      if (aumento.isZero()) break;
      if (intento === 11)
        throw new Error(
          "No se pudo alcanzar la contribución objetivo en todas las coberturas.",
        );
      nuevo = new D(nuevo)
        .plus(aumento)
        .toDecimalPlaces(8, D.ROUND_CEIL)
        .toFixed();
      if (redondeo) nuevo = ajustarPrecio(nuevo, "IMPORTE", "0", redondeo)!;
      if (!/^\d{1,18}(\.\d{1,8})?$/.test(nuevo))
        throw new Error("El precio sugerido supera el importe admitido.");
    }
  }

  const controles = r.escenarios.flatMap((e) =>
    e.estado === "CALCULADO"
      ? [
          {
            ...compararSimulacion(c, r.celda.seccion, e, nuevo).control,
            cobertura: e.cobertura,
          },
        ]
      : [],
  );
  if (coberturas.length > 1)
    avisos.push(
      "Precio único: se usa la mayor sugerencia de las tres coberturas.",
    );
  return { anterior: precio, nuevo, controles, avisos: [...new Set(avisos)] };
}

/** Eleva los tramos anteriores al mayor precio posterior de la misma fila.
 * Nunca rebaja una sugerencia por debajo de su costo/objetivo. No altera costos,
 * precios cargados ni cruza papeles, caras, coberturas o matrices.
 */
export function sugerirPorVolumen(
  contenido: ContenidoTarifario,
  resultados: Record<string, ResultadoCeldaSimulacion>,
  seccion: "hojas" | "cad",
  redondeo?: string,
  objetivo?: string | ((fila: number, tramo: number) => string),
) {
  type Sugerencia = ReturnType<typeof sugerirCelda> & {
    ajustadaPorVolumen?: boolean;
  };
  const propuestas = new Map<
    string,
    { sugerencia?: Sugerencia; error?: string }
  >();
  const matriz = contenido[seccion];
  matriz?.filas.forEach((fila, indice) => {
    const claves = (fila.rangosPropios ?? matriz.rangosGenerales).map(
      (_, tramo) => claveCeldaSimulacion({ seccion, fila: indice, tramo }),
    );
    if (!claves.some((k) => resultados[k])) return;
    try {
      const sugerencias = claves.map((k, tramo) => {
        if (!resultados[k])
          throw new Error(
            "Completá el cálculo de todos los tramos de esta combinación para ordenar sus sugerencias.",
          );
        return sugerirCelda(
          contenido,
          resultados[k],
          redondeo,
          typeof objetivo === "function" ? objetivo(indice, tramo) : objetivo,
        );
      });
      let mayor = new D(0);
      for (let i = claves.length - 1; i >= 0; i--) {
        const original = sugerencias[i];
        mayor = D.max(mayor, original.nuevo);
        const ajustada = mayor.gt(original.nuevo);
        propuestas.set(claves[i], {
          sugerencia: {
            ...original,
            nuevo: mayor.toFixed(),
            ajustadaPorVolumen: ajustada,
            controles: resultados[claves[i]].escenarios.flatMap((e) =>
              e.estado === "CALCULADO"
                ? [
                    {
                      ...compararSimulacion(
                        contenido,
                        seccion,
                        e,
                        mayor.toFixed(),
                      ).control,
                      cobertura: e.cobertura,
                    },
                  ]
                : [],
            ),
            avisos: ajustada
              ? [
                  ...original.avisos,
                  "Se elevó este precio para que un tramo de mayor cantidad no resulte más caro por unidad.",
                ]
              : original.avisos,
          },
        });
      }
    } catch (e) {
      for (const clave of claves)
        propuestas.set(clave, {
          error:
            e instanceof Error
              ? e.message
              : "No se pudo ordenar la sugerencia de esta combinación.",
        });
    }
  });
  return propuestas;
}

export function leerMargenObjetivo(valor: string) {
  const limpio = valor.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpio) || new D(limpio).gte(100))
    throw new Error("Usá una contribución objetivo desde 0 y menor que 100%.");
  return new D(limpio);
}

function denominadorMargen(
  e: EscenarioSimulado,
  margen: InstanceType<typeof D>,
) {
  const factorIva = new D(1).plus(new D(e.ivaPorcentaje).div(100));
  const cargas = e.comercial?.cargas;
  if (!cargas) throw new Error("Faltan cargas comerciales verificables.");
  const tasa = cargas.reduce(
    (s, c) =>
      s.plus(
        new D(c.porcentaje)
          .div(100)
          .times(c.base === "BRUTO_COBRADO" ? factorIva : 1),
      ),
    new D(0),
  );
  const denominador = new D(1).minus(margen).minus(tasa);
  if (!denominador.gt(0))
    throw new Error(
      "La contribución objetivo y las cargas comerciales no permiten calcular un precio.",
    );
  return denominador;
}

function ventaParaMargen(e: EscenarioSimulado, objetivo: string) {
  return new D(e.costoVariableTotal ?? e.costoTotal).div(
    denominadorMargen(e, leerMargenObjetivo(objetivo).div(100)),
  );
}

export function canalesDelTarifario(p: PoliticaPrecios, id: string) {
  return Object.entries(p.canales).flatMap(([canal, regla]) => {
    const efectiva = regla.modalidad === "HEREDAR" ? p.general : regla;
    return efectiva.modalidad === "TARIFARIO" && efectiva.tarifarioId === id
      ? [canal]
      : [];
  });
}

/** Alerta comercial en la frontera: compara impresión + preparación + mínimo.
 * En CAD se compara el límite por la izquierda con el nuevo tramo, respetando
 * el redondeo de ML. Con IVA común, el sentido de la caída no cambia.
 */
export function caidasEntreTramos(c: ContenidoTarifario) {
  const avisos: { seccion: "hojas" | "cad"; fila: number; desde: string }[] =
    [];
  const prep =
    c.composicion.preparacion.modalidad === "FIJA_PEDIDO"
      ? c.composicion.preparacion.importe
      : "0";
  const minimo =
    c.composicion.minimo.modalidad === "IMPORTE_PEDIDO"
      ? c.composicion.minimo.importe
      : "0";
  for (const seccion of ["hojas", "cad"] as const) {
    const m = c[seccion];
    m?.filas.forEach((f, fila) => {
      const rangos = f.rangosPropios ?? m.rangosGenerales;
      for (let i = 1; i < rangos.length; i++) {
        const anterior = precioCelda(c, { seccion, fila, tramo: i - 1 }).precio;
        const actual = precioCelda(c, { seccion, fila, tramo: i }).precio;
        if (anterior == null || actual == null) continue;
        const limite = new D(rangos[i]);
        let antes = seccion === "hojas" ? limite.minus(1) : limite;
        let despues = limite;
        if (
          seccion === "hojas" &&
          "faz" in f.combinacion &&
          f.combinacion.faz === 2 &&
          c.hojas?.reglas.unidad === "CARILLA" &&
          c.hojas.reglas.ultimaHojaImpar === "COBRAR_SIMPLE"
        ) {
          // La cara suelta acumula en simple faz: este grupo sólo admite pares.
          antes = antes.div(2).floor().times(2);
          despues = despues.div(2).ceil().times(2);
          if (
            antes.lt(rangos[i - 1]) ||
            (rangos[i + 1] != null && despues.gte(rangos[i + 1]))
          )
            continue;
        }
        if (
          seccion === "cad" &&
          c.cad?.reglas.redondeo.modalidad === "HACIA_ARRIBA"
        ) {
          const incremento = new D(c.cad.reglas.redondeo.incrementoMl);
          antes = antes.div(incremento).ceil().times(incremento);
          despues = despues.div(incremento).ceil().times(incremento);
        }
        const total = (cantidad: InstanceType<typeof D>, precio: string) =>
          D.max(minimo, cantidad.times(precio).plus(prep));
        if (total(despues, actual).lt(total(antes, anterior)))
          avisos.push({ seccion, fila, desde: limite.toFixed() });
      }
    });
  }
  return avisos;
}
