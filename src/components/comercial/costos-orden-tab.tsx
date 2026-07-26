"use client";

/**
 * Tab "Costos" del detalle de una OT — la vista CONSOLIDADA.
 *
 * Es lo que ninguna vista por producto puede dar:
 *   · el costo de la orden entera, con los cargos de ORDEN imputados (flete,
 *     viático). Sin ellos el margen por producto está inflado, porque ningún
 *     item los carga;
 *   · qué centro de costo se comió la orden, cruzando los pasos de todos los
 *     productos;
 *   · si el trabajo costó lo que se dijo: tiempo REAL del taller contra el
 *     tiempo COTIZADO, valuado a la tarifa congelada al cotizar.
 *
 * La matemática vive en @/lib/costos-orden, compartida con el desglose por
 * producto (tab Productos › Costos) para que las dos pantallas no puedan
 * divergir. Ver docs/costos-consolidados-ot-diseno.md
 */

import * as React from "react";

import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import {
  consolidarCostosOrden,
  cruzarRealVsCotizado,
  MARGEN_ALERTA_PCT,
  type CostosOrdenConsolidado,
  type RealVsCotizado,
} from "@/lib/costos-orden";
import { getOrdenPasos } from "@/lib/ordenes-trabajo-api";
import {
  formatCurrency,
  formatUnidad,
  type PropuestaCargoDirecto,
  type PropuestaItem,
} from "@/lib/propuestas";
import { TIEMPO_FUENTE_LABELS, type TableroItemData } from "@/lib/tablero-produccion";

const pct1 = (valor: number) =>
  valor.toLocaleString("es-AR", { maximumFractionDigits: 1 });

function formatMin(min: number) {
  if (min < 60) return `${pct1(min)} min`;
  const horas = Math.floor(min / 60);
  const resto = Math.round(min % 60);
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

/** Firma del desvío, para el color: más caro es malo, más barato es bueno. */
function tonoDesvio(valor: number, umbral = 0.5) {
  if (valor > umbral) return "mal";
  if (valor < -umbral) return "bien";
  return "";
}

export function CostosOrdenTab({
  items,
  cargosOrden,
  ordenId,
}: {
  items: PropuestaItem[];
  cargosOrden: PropuestaCargoDirecto[];
  /** Ausente mientras la propuesta no se emitió: no hay pasos reales todavía. */
  ordenId?: string;
}) {
  const { moneda } = useConfigRegional();
  const fmt = (v: number) => formatCurrency(v, moneda);
  const consolidado = React.useMemo(
    () => consolidarCostosOrden(items, cargosOrden),
    [items, cargosOrden],
  );

  const [itemsTablero, setItemsTablero] = React.useState<
    TableroItemData[] | null
  >(null);
  const [errorPasos, setErrorPasos] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!ordenId) return;
    let vigente = true;
    setItemsTablero(null);
    setErrorPasos(null);
    getOrdenPasos(ordenId)
      .then((res) => {
        if (vigente) setItemsTablero(res.items);
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        setErrorPasos(
          e instanceof Error ? e.message : "No se pudo leer el taller.",
        );
      });
    return () => {
      vigente = false;
    };
  }, [ordenId]);

  const real = React.useMemo(
    () => (itemsTablero ? cruzarRealVsCotizado(items, itemsTablero) : null),
    [items, itemsTablero],
  );

  if (items.length === 0) {
    return (
      <div className="orden-tab-empty">
        <div className="ttl">Sin productos que costear</div>
        <div className="sub">
          Agregá productos a la orden para ver el desglose consolidado de
          materiales, máquina, mano de obra y márgenes.
        </div>
      </div>
    );
  }

  return (
    <div className="otc">
      <TirasKpi consolidado={consolidado} fmt={fmt} />

      {consolidado.itemsSinCostear > 0 ? (
        <div className="otc-aviso">
          {consolidado.itemsSinCostear === 1
            ? "1 producto todavía no está cotizado, así que no entra en ninguno de estos números."
            : `${consolidado.itemsSinCostear} productos todavía no están cotizados, así que no entran en ninguno de estos números.`}
        </div>
      ) : null}

      <Cascada consolidado={consolidado} fmt={fmt} />
      <Composicion consolidado={consolidado} fmt={fmt} />
      <TablaProductos consolidado={consolidado} fmt={fmt} />
      <Centros consolidado={consolidado} real={real} fmt={fmt} />

      {ordenId ? (
        <RealVsCotizadoSeccion
          real={real}
          error={errorPasos}
          fmt={fmt}
        />
      ) : (
        <section className="otc-card">
          <div className="otc-card-head">
            <span className="otc-ttl">Real vs. cotizado</span>
          </div>
          <div className="otc-vacio">
            Cuando la orden se emita y el taller registre tiempos, acá vas a ver
            si el trabajo costó lo que se cotizó.
          </div>
        </section>
      )}
    </div>
  );
}

function TirasKpi({
  consolidado,
  fmt,
}: {
  consolidado: CostosOrdenConsolidado;
  fmt: (v: number) => string;
}) {
  const margenBajo = consolidado.margenPct < MARGEN_ALERTA_PCT;
  return (
    <div className="otc-kpis">
      <div className="otc-kpi">
        <span className="otc-kpi-lbl">Costo de la orden</span>
        <span className="otc-kpi-val">{fmt(consolidado.costoTotal)}</span>
        <span className="otc-kpi-hint">
          {consolidado.cargosOrdenTotal > 0
            ? `incluye ${fmt(consolidado.cargosOrdenTotal)} de cargos de orden`
            : "materiales + producción + cargos"}
        </span>
      </div>
      <div className="otc-kpi">
        <span className="otc-kpi-lbl">Ventas (sin IVA)</span>
        <span className="otc-kpi-val">{fmt(consolidado.precioNeto)}</span>
        <span className="otc-kpi-hint">
          {fmt(consolidado.precioBruto)} con impuestos
        </span>
      </div>
      <div className={`otc-kpi ${margenBajo ? "mal" : "bien"}`}>
        <span className="otc-kpi-lbl">Margen</span>
        <span className="otc-kpi-val">{fmt(consolidado.margenMonto)}</span>
        <span className="otc-kpi-hint">
          {pct1(consolidado.margenPct)}% del neto
        </span>
      </div>
      <div className="otc-kpi">
        <span className="otc-kpi-lbl">Contribución</span>
        <span className="otc-kpi-val">{fmt(consolidado.contribucionMonto)}</span>
        <span className="otc-kpi-hint">
          {pct1(consolidado.contribucionPct)}% para cubrir la estructura
        </span>
      </div>
    </div>
  );
}

/**
 * La cascada de la ORDEN. Mismas filas que el desglose por producto, sumadas,
 * más la fila propia de los cargos de orden: son costo que ningún item cargó.
 */
function Cascada({
  consolidado,
  fmt,
}: {
  consolidado: CostosOrdenConsolidado;
  fmt: (v: number) => string;
}) {
  const neto = consolidado.precioNeto;
  const pctDelNeto = (monto: number) =>
    neto > 0 ? `${pct1((monto / neto) * 100)}%` : "—";
  const filas: Array<{
    key: string;
    label: string;
    hint?: string;
    tipo: string;
    monto: number;
    warn?: boolean;
  }> = [
    {
      key: "materiales",
      label: "Materiales",
      tipo: "Materia prima",
      monto: consolidado.materialesTotal,
    },
    {
      key: "maquina",
      label: "Centro · Máquina",
      tipo: "Centro de costo",
      monto: consolidado.maquinaTotal,
    },
    {
      key: "mano-obra",
      label: "Centro · Mano de obra",
      tipo: "Mano de obra",
      monto: consolidado.manoObraTotal,
    },
    {
      key: "proveedor",
      label: "Costo de proveedor",
      tipo: "Proveedor",
      monto: consolidado.tercerizadoTotal,
    },
    {
      key: "cargos",
      label: "Cargos directos",
      hint:
        consolidado.cargosOrdenTotal > 0
          ? `incluye ${fmt(consolidado.cargosOrdenTotal)} cargados a la orden, que no están en el costo de ningún producto`
          : undefined,
      tipo: "Cargo directo",
      monto: consolidado.cargosTotal,
    },
    {
      key: "impuestos-internos",
      label: "Impuestos internos",
      hint: "ya incluidos en el precio, no se muestran al cliente",
      tipo: "Impuesto",
      monto: consolidado.costosInternosTotal,
    },
    {
      key: "comisiones",
      label: "Comisiones",
      tipo: "Comisión",
      monto: consolidado.comisionesTotal,
    },
  ].filter((fila) => fila.monto > 0);

  return (
    <section className="otc-card">
      <div className="otc-card-head">
        <span className="otc-ttl">Del costo al precio</span>
        <span className="otc-sub">
          Cada fila suma hacia abajo hasta el precio de venta de la orden
        </span>
      </div>
      <div className="cost-waterfall">
        {filas.map((fila) => (
          <div className="cw-row" key={fila.key}>
            <span className="cw-label">
              {fila.label}
              {fila.hint ? <small>{fila.hint}</small> : null}
            </span>
            <span className="cw-tipo">{fila.tipo}</span>
            <span className="cw-pct">{pctDelNeto(fila.monto)}</span>
            <span className="cw-amount">{fmt(fila.monto)}</span>
          </div>
        ))}
        <div className="cw-row">
          <span className="cw-label">Margen</span>
          <span className="cw-tipo">Rentabilidad</span>
          <span className="cw-pct">{pctDelNeto(consolidado.margenMonto)}</span>
          <span
            className={`cw-amount ${
              consolidado.margenPct < MARGEN_ALERTA_PCT ? "cw-margen warn" : ""
            }`}
          >
            {fmt(consolidado.margenMonto)}
          </span>
        </div>
        <div className="cw-row cw-subtotal">
          <span className="cw-label">Precio neto (sin IVA)</span>
          <span className="cw-tipo" />
          <span className="cw-pct">100%</span>
          <span className="cw-amount">{fmt(neto)}</span>
        </div>
        {consolidado.ivaTotal > 0 ? (
          <div className="cw-row">
            <span className="cw-label">
              Impuestos al cliente
              <small>se agregan al neto y se discriminan en factura</small>
            </span>
            <span className="cw-tipo">Impuesto</span>
            <span className="cw-pct">+ {pctDelNeto(consolidado.ivaTotal)}</span>
            <span className="cw-amount">+ {fmt(consolidado.ivaTotal)}</span>
          </div>
        ) : null}
        <div className="cw-row cw-total">
          <span className="cw-label">Precio de venta</span>
          <span className="cw-tipo" />
          <span className="cw-pct" />
          <span className="cw-amount">{fmt(consolidado.precioBruto)}</span>
        </div>
      </div>
    </section>
  );
}

function Composicion({
  consolidado,
  fmt,
}: {
  consolidado: CostosOrdenConsolidado;
  fmt: (v: number) => string;
}) {
  if (consolidado.composicion.length === 0) return null;
  return (
    <section className="otc-card">
      <div className="otc-card-head">
        <span className="otc-ttl">Composición del costo</span>
        <span className="otc-sub">
          En qué se va lo que cuesta producir esta orden
        </span>
      </div>
      <div className="otc-barra">
        {consolidado.composicion.map((parte) => (
          <span
            key={parte.key}
            className={`otc-barra-seg seg-${parte.key}`}
            style={{ width: `${parte.pct}%` }}
            title={`${parte.label}: ${fmt(parte.monto)} (${pct1(parte.pct)}%)`}
          />
        ))}
      </div>
      <div className="otc-comp-list">
        {consolidado.composicion.map((parte) => (
          <div className="otc-comp" key={parte.key}>
            <span className={`otc-comp-dot seg-${parte.key}`} />
            <span className="otc-comp-lbl">{parte.label}</span>
            <span className="otc-comp-pct mono">{pct1(parte.pct)}%</span>
            <span className="otc-comp-val mono">{fmt(parte.monto)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TablaProductos({
  consolidado,
  fmt,
}: {
  consolidado: CostosOrdenConsolidado;
  fmt: (v: number) => string;
}) {
  return (
    <section className="otc-card">
      <div className="otc-card-head">
        <span className="otc-ttl">Por producto</span>
        <span className="otc-sub">
          Los cargos de orden no están acá: se imputan a la orden, no a un
          producto
        </span>
      </div>
      <div className="cost-steps-table-wrap">
        <table className="cost-steps-table otc-tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="num">Cantidad</th>
              <th className="num">Costo</th>
              <th className="num">Neto</th>
              <th className="num">Margen</th>
              <th className="num">Margen %</th>
              <th className="num">% del costo</th>
            </tr>
          </thead>
          <tbody>
            {consolidado.lineas.map((linea) => {
              if (linea.sinCostear) {
                return (
                  <tr className="muted-row" key={linea.itemId}>
                    <td>{linea.nombre}</td>
                    <td className="num">
                      {pct1(linea.cantidad)} {formatUnidad(linea.unidad)}
                    </td>
                    <td className="num" colSpan={5}>
                      Sin cotizar
                    </td>
                  </tr>
                );
              }
              const d = linea.desglose;
              const bajo = d.margenPct < MARGEN_ALERTA_PCT;
              return (
                <tr key={linea.itemId} className={bajo ? "otc-fila-warn" : ""}>
                  <td>{linea.nombre}</td>
                  <td className="num">
                    {pct1(linea.cantidad)} {formatUnidad(linea.unidad)}
                  </td>
                  <td className="num">{fmt(d.costo)}</td>
                  <td className="num">{fmt(d.precioNeto)}</td>
                  <td className={`num ${bajo ? "otc-mal" : ""}`}>
                    {fmt(d.margenMonto)}
                  </td>
                  <td className={`num ${bajo ? "otc-mal" : ""}`}>
                    {pct1(d.margenPct)}%
                  </td>
                  <td className="num">
                    {consolidado.costoTotal > 0
                      ? `${pct1((d.costo / consolidado.costoTotal) * 100)}%`
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {consolidado.cargosOrdenTotal > 0 ? (
              <tr className="otc-fila-orden">
                <td>
                  Cargos de la orden
                  <span>flete, viático y demás cargos no imputados a un producto</span>
                </td>
                <td className="num">—</td>
                <td className="num">{fmt(consolidado.cargosOrdenTotal)}</td>
                <td className="num">—</td>
                <td className="num">—</td>
                <td className="num">—</td>
                <td className="num">
                  {consolidado.costoTotal > 0
                    ? `${pct1((consolidado.cargosOrdenTotal / consolidado.costoTotal) * 100)}%`
                    : "—"}
                </td>
              </tr>
            ) : null}
            <tr className="otc-fila-total">
              <td className="strong">Total de la orden</td>
              <td className="num">—</td>
              <td className="num strong">{fmt(consolidado.costoTotal)}</td>
              <td className="num strong">{fmt(consolidado.precioNeto)}</td>
              <td className="num strong">{fmt(consolidado.margenMonto)}</td>
              <td className="num strong">{pct1(consolidado.margenPct)}%</td>
              <td className="num">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Costo por centro de costo, cruzando los pasos de TODOS los productos.
 * Responde "qué máquina se comió esta orden", que no se puede saber mirando
 * producto por producto. Cuando hay tiempos reales, agrega el desvío.
 */
function Centros({
  consolidado,
  real,
  fmt,
}: {
  consolidado: CostosOrdenConsolidado;
  real: RealVsCotizado | null;
  fmt: (v: number) => string;
}) {
  if (consolidado.centros.length === 0) return null;
  const desvioPorCentro = new Map(
    (real?.centros ?? []).map((centro) => [
      centro.centroCostoId ?? `sin-centro:${centro.nombre}`,
      centro,
    ]),
  );
  const hayReal = (real?.pasosMedidos ?? 0) > 0;

  return (
    <section className="otc-card">
      <div className="otc-card-head">
        <span className="otc-ttl">Por centro de costo</span>
        <span className="otc-sub">
          Sumando los pasos de todos los productos de la orden
        </span>
      </div>
      <div className="cost-steps-table-wrap">
        <table className="cost-steps-table otc-tabla">
          <thead>
            <tr>
              <th>Centro de costo</th>
              <th className="num">Pasos</th>
              <th className="num">Tiempo cotizado</th>
              <th className="num">Máquina</th>
              <th className="num">Mano de obra</th>
              <th className="num">Costo</th>
              {hayReal ? <th className="num">Desvío de tiempo</th> : null}
            </tr>
          </thead>
          <tbody>
            {consolidado.centros.map((centro) => {
              const clave =
                centro.centroCostoId ?? `sin-centro:${centro.nombre}`;
              const desvio = desvioPorCentro.get(clave);
              return (
                <tr key={clave}>
                  <td>{centro.nombre}</td>
                  <td className="num">{centro.pasos}</td>
                  <td className="num">{formatMin(centro.minutosCotizados)}</td>
                  <td className="num">{fmt(centro.costoMaquina)}</td>
                  <td className="num">
                    {centro.costoManoObra > 0 ? fmt(centro.costoManoObra) : "—"}
                  </td>
                  <td className="num strong">{fmt(centro.costoTotal)}</td>
                  {hayReal ? (
                    <td className="num">
                      {desvio && desvio.pasosMedidos > 0 ? (
                        <>
                          <strong
                            className={`otc-${tonoDesvio(desvio.desvioPct ?? 0, 5)}`}
                          >
                            {desvio.desvioMin >= 0 ? "+" : "−"}
                            {formatMin(Math.abs(desvio.desvioMin))}
                          </strong>
                          <span>
                            {desvio.desvioPct != null
                              ? `${desvio.desvioPct >= 0 ? "+" : "−"}${pct1(Math.abs(desvio.desvioPct))}% · ${desvio.pasosMedidos} de ${desvio.pasos} pasos`
                              : `${desvio.pasosMedidos} de ${desvio.pasos} pasos`}
                          </span>
                        </>
                      ) : (
                        <span>sin medir</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RealVsCotizadoSeccion({
  real,
  error,
  fmt,
}: {
  real: RealVsCotizado | null;
  error: string | null;
  fmt: (v: number) => string;
}) {
  if (error) {
    return (
      <section className="otc-card">
        <div className="otc-card-head">
          <span className="otc-ttl">Real vs. cotizado</span>
        </div>
        <div className="otc-vacio">No se pudo leer el taller: {error}</div>
      </section>
    );
  }
  if (!real) {
    return (
      <section className="otc-card">
        <div className="otc-card-head">
          <span className="otc-ttl">Real vs. cotizado</span>
        </div>
        <div className="otc-vacio">Leyendo los tiempos del taller…</div>
      </section>
    );
  }

  // Cobertura = de lo que YA se hizo, cuánto se midió de verdad. El
  // denominador son los pasos hechos y no todos: los pendientes no tienen
  // tiempo porque todavía no se trabajaron, y meterlos haría ver como falta de
  // registro lo que es simplemente trabajo por hacer.
  const coberturaPct =
    real.pasosHechos > 0 ? (real.pasosMedidos / real.pasosHechos) * 100 : 0;
  const conTiempo = real.pasos.filter((paso) => paso.minutosReales != null);

  return (
    <section className="otc-card">
      <div className="otc-card-head">
        <span className="otc-ttl">Real vs. cotizado</span>
        <span className="otc-sub">
          Tiempo que registró el taller, valuado a la tarifa con la que se
          cotizó
        </span>
      </div>

      {real.pasosMedidos === 0 ? (
        <div className="otc-vacio">
          Todavía no hay pasos con tiempo medido en esta orden.
          {real.pasosHechos > 0
            ? ` Hay ${real.pasosHechos} paso${real.pasosHechos === 1 ? "" : "s"} completado${real.pasosHechos === 1 ? "" : "s"}, pero sin tiempo utilizable.`
            : ""}
        </div>
      ) : (
        <>
          <div className="otc-real-kpis">
            <div className="otc-kpi">
              <span className="otc-kpi-lbl">Tiempo cotizado</span>
              <span className="otc-kpi-val">
                {formatMin(real.minutosCotizadosMedidos)}
              </span>
              <span className="otc-kpi-hint">de los pasos medidos</span>
            </div>
            <div className="otc-kpi">
              <span className="otc-kpi-lbl">Tiempo real</span>
              <span className="otc-kpi-val">
                {formatMin(real.minutosRealesMedidos)}
              </span>
              <span className="otc-kpi-hint">
                {real.minutosRealesMedidos >= real.minutosCotizadosMedidos
                  ? "+"
                  : "−"}
                {formatMin(
                  Math.abs(
                    real.minutosRealesMedidos - real.minutosCotizadosMedidos,
                  ),
                )}{" "}
                contra lo cotizado
              </span>
            </div>
            <div
              className={`otc-kpi ${tonoDesvio(real.desvioMonto, 0.5) === "mal" ? "mal" : tonoDesvio(real.desvioMonto, 0.5) === "bien" ? "bien" : ""}`}
            >
              <span className="otc-kpi-lbl">Desvío de costo</span>
              <span className="otc-kpi-val">
                {real.desvioMonto >= 0 ? "+" : "−"}
                {fmt(Math.abs(real.desvioMonto))}
              </span>
              <span className="otc-kpi-hint">
                {real.desvioPct != null
                  ? `${real.desvioPct >= 0 ? "+" : "−"}${pct1(Math.abs(real.desvioPct))}% sobre ${fmt(real.costoCotizadoMedido)} cotizados`
                  : "sin base para comparar"}
              </span>
            </div>
            <div className="otc-kpi">
              <span className="otc-kpi-lbl">Cobertura del dato</span>
              <span className="otc-kpi-val">{pct1(coberturaPct)}%</span>
              <span className="otc-kpi-hint">
                {real.pasosMedidos} de {real.pasosHechos} pasos hechos con
                tiempo medido
                {real.pasosTotal !== real.pasosHechos
                  ? ` · ${real.pasosTotal} pasos en la orden`
                  : ""}
              </span>
            </div>
          </div>

          {/* Sin esta línea el número de arriba miente por omisión: hay que
              poder ver de qué calidad es el tiempo con el que se comparó. */}
          <div className="otc-nota">
            {real.fuentes.length > 0 ? (
              <span>
                Fuente del tiempo:{" "}
                {real.fuentes
                  .map(
                    (f) =>
                      `${f.pasos} ${
                        TIEMPO_FUENTE_LABELS[
                          f.fuente as keyof typeof TIEMPO_FUENTE_LABELS
                        ] ?? f.fuente
                      }`,
                  )
                  .join(" · ")}
                .
              </span>
            ) : null}
            {real.pasosHechosSinMedir > 0 ? (
              <span>
                {" "}
                {real.pasosHechosSinMedir === 1
                  ? "1 paso hecho quedó afuera de la comparación: nadie lo cronometró, así que el sistema asentó el tiempo estimado y compararlo daría un desvío cero falso."
                  : `${real.pasosHechosSinMedir} pasos hechos quedaron afuera de la comparación: nadie los cronometró, así que el sistema asentó el tiempo estimado y compararlos daría un desvío cero falso.`}
              </span>
            ) : null}
            {real.pasosAtipicos > 0 ? (
              <span>
                {" "}
                {real.pasosAtipicos} de ellos por tiempo atípico (más de 8 h, o
                más de 5× el estimado).
              </span>
            ) : null}
            {real.pasosSinEmparejar > 0 ? (
              <span>
                {" "}
                {real.pasosSinEmparejar} paso
                {real.pasosSinEmparejar === 1 ? "" : "s"} del taller no se pudo
                cruzar con el costeo.
              </span>
            ) : null}
            <span>
              {" "}
              La mano de obra no se reescala: se paga sobre la preparación y la
              limpieza, no sobre el tiempo de máquina.
            </span>
          </div>

          <div className="cost-steps-table-wrap">
            <table className="cost-steps-table otc-tabla">
              <thead>
                <tr>
                  <th>Paso</th>
                  <th>Producto</th>
                  <th className="num">Cotizado</th>
                  <th className="num">Real</th>
                  <th className="num">Desvío</th>
                  <th className="num">Costo cotizado</th>
                  <th className="num">Costo real</th>
                </tr>
              </thead>
              <tbody>
                {conTiempo.map((paso) => {
                  const desvioMin =
                    (paso.minutosReales ?? 0) - paso.minutosCotizados;
                  const desvioPct =
                    paso.minutosCotizados > 0
                      ? (desvioMin / paso.minutosCotizados) * 100
                      : null;
                  const delta = (paso.costoReal ?? 0) - paso.costoCotizado;
                  return (
                    <tr key={paso.pasoId}>
                      <td>
                        {paso.nombre}
                        <span>{paso.centroCostoNombre}</span>
                      </td>
                      <td>{paso.itemNombre}</td>
                      <td className="num">{formatMin(paso.minutosCotizados)}</td>
                      <td className="num">
                        {formatMin(paso.minutosReales ?? 0)}
                      </td>
                      <td className={`num otc-${tonoDesvio(desvioMin, 1)}`}>
                        {desvioMin >= 0 ? "+" : "−"}
                        {formatMin(Math.abs(desvioMin))}
                        {desvioPct != null ? (
                          <span>
                            {desvioPct >= 0 ? "+" : "−"}
                            {pct1(Math.abs(desvioPct))}%
                          </span>
                        ) : null}
                      </td>
                      <td className="num">{fmt(paso.costoCotizado)}</td>
                      <td className={`num strong otc-${tonoDesvio(delta, 0.5)}`}>
                        {fmt(paso.costoReal ?? 0)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="otc-fila-total">
                  <td className="strong">Total medido</td>
                  <td>—</td>
                  <td className="num strong">
                    {formatMin(real.minutosCotizadosMedidos)}
                  </td>
                  <td className="num strong">
                    {formatMin(real.minutosRealesMedidos)}
                  </td>
                  <td
                    className={`num strong otc-${tonoDesvio(real.minutosRealesMedidos - real.minutosCotizadosMedidos, 1)}`}
                  >
                    {real.minutosRealesMedidos >= real.minutosCotizadosMedidos
                      ? "+"
                      : "−"}
                    {formatMin(
                      Math.abs(
                        real.minutosRealesMedidos -
                          real.minutosCotizadosMedidos,
                      ),
                    )}
                  </td>
                  <td className="num strong">{fmt(real.costoCotizadoMedido)}</td>
                  <td
                    className={`num strong otc-${tonoDesvio(real.desvioMonto, 0.5)}`}
                  >
                    {fmt(real.costoRealMedido)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
