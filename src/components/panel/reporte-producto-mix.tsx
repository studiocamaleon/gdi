"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  ChartColumnStackedIcon,
  ChevronDownIcon,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { abreviarMoneda, formatearMoneda } from "@/lib/moneda";
import {
  getPanelMixCategoria,
  type MetaPanel,
  type MixCategoriaPanel,
  type ProductoPanel,
  type ProductoMargenPanel,
  type PuntoMixPanel,
  type RangoPanel,
  type TabPanel,
} from "@/lib/panel-api";
import { prepararMixProducto } from "@/lib/reporte-producto";
import { fechaDelReporte } from "@/lib/reporte-resumen";
import { cn } from "@/lib/utils";
import { TremorBarChart } from "./charts/tremor-charts";
import { NoData, ReportCard } from "./reportes-ui";
import shared from "./reportes.module.css";
import styles from "./reporte-producto.module.css";

const numero = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const colores = [
  "var(--brand-graphite)",
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--muted-text)",
  "var(--danger)",
];

export function VentasProductoTabla({
  rows,
  categoria = false,
  margenes,
}: {
  rows: ProductoMargenPanel[];
  categoria?: boolean;
  margenes: boolean;
}) {
  const { moneda } = useConfigRegional();
  const pct = (v: number | undefined) => (v == null ? "—" : `${numero(v)}%`);
  if (!rows.length)
    return (
      <NoData
        title="Sin ventas en el período"
        description="Las ventas de órdenes emitidas aparecerán acá."
      />
    );
  return (
    <div
      className={cn(shared.tableScroll, styles.scroll)}
      role="region"
      aria-label={categoria ? "Ventas por categoría" : "Ventas por producto"}
      tabIndex={0}
    >
      <table
        className={cn(shared.table, styles.salesTable)}
        aria-label={categoria ? "Ventas por categoría" : "Ventas por producto"}
      >
        <thead>
          <tr>
            <th scope="col">{categoria ? "Categoría" : "Producto"}</th>
            <th scope="col">Ítems</th>
            <th scope="col">Ventas</th>
            {margenes ? (
              <>
                <th scope="col">Margen %</th>
                <th scope="col">Contribución %</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.nombre}>
              <th scope="row">{p.nombre}</th>
              <td>{numero(p.items)}</td>
              <td className={styles.salesAmount}>
                {formatearMoneda(p.ventas, moneda)}
              </td>
              {margenes ? (
                <>
                  <td data-negative={p.margenPct != null && p.margenPct < 0}>
                    {pct(p.margenPct)}
                  </td>
                  <td
                    data-negative={
                      p.contribucionPct != null && p.contribucionPct < 0
                    }
                  >
                    {pct(p.contribucionPct)}
                  </td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MixChart({
  puntos,
  meta,
  producto = false,
}: {
  puntos: PuntoMixPanel[];
  meta: MetaPanel;
  producto?: boolean;
}) {
  const { moneda } = useConfigRegional();
  const pivot = prepararMixProducto(puntos);
  const alfa = pivot.series
    .filter((s) => s.key !== "resto")
    .map((s) => s.nombre)
    .sort((a, b) => a.localeCompare(b, "es"));
  const categorias = pivot.series.map((s) => ({
    key: s.key,
    label: s.nombre,
    color:
      s.key === "resto"
        ? "var(--border-strong)"
        : colores[alfa.indexOf(s.nombre) % colores.length],
  }));
  const total = puntos.reduce((sum, p) => sum + p.monto, 0);
  const money = (v: number) => formatearMoneda(v, moneda);
  const fecha = (s: string, completa = false) =>
    fechaDelReporte(s, meta.granularidad, completa);
  if (!puntos.length)
    return (
      <NoData
        title="Sin ventas para graficar"
        description="Probá otro período para explorar la distribución de ventas."
      />
    );
  return (
    <>
      <div className={styles.mixSummary}>
        <div>
          <span>Ventas del alcance seleccionado · sin IVA</span>
          <strong>{money(total)}</strong>
        </div>
        <span>
          Agrupado por{" "}
          {meta.granularidad === "dia"
            ? "día"
            : meta.granularidad === "semana"
              ? "semana"
              : "mes"}
        </span>
      </div>
      <div className={shared.chartWrap}>
        <TremorBarChart
          data={pivot.data}
          index="fecha"
          categories={categorias}
          valueFormatter={money}
          axisFormatter={(v) => abreviarMoneda(v, moneda)}
          tickFormatter={(s) => fecha(s)}
          labelFormatter={(s) =>
            `${meta.granularidad === "semana" ? "Semana del " : ""}${fecha(s, true)}`
          }
          label={`Ventas por ${producto ? "producto" : "categoría"} en el tiempo`}
          height={270}
        />
      </div>
      {pivot.agrupadas > 0 ? (
        <p className={styles.note}>
          El gráfico reúne {pivot.agrupadas}{" "}
          {producto ? "productos" : "categorías"} en “Resto (agrupado)”. El
          detalle conserva cada nombre y su importe.
        </p>
      ) : null}
      <details className={shared.dataDetails}>
        <summary>
          Ver datos de la evolución
          <ChevronDownIcon size={14} aria-hidden="true" />
        </summary>
        <div
          className={cn(shared.tableScroll, styles.scroll)}
          role="region"
          aria-label="Datos de la evolución"
          tabIndex={0}
        >
          <table className={shared.table} aria-label="Datos de la evolución">
            <thead>
              <tr>
                <th scope="col">
                  {meta.granularidad === "semana" ? "Semana desde" : "Período"}
                </th>
                <th scope="col">{producto ? "Producto" : "Categoría"}</th>
                <th scope="col">Ventas sin IVA</th>
              </tr>
            </thead>
            <tbody>
              {puntos.map((p, i) => (
                <tr key={`${p.fecha}:${p.nombre}:${i}`}>
                  <th scope="row">{fecha(p.fecha, true)}</th>
                  <td className={styles.textCell}>{p.nombre}</td>
                  <td>{money(p.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function CategoriaMix({
  categoria,
  rango,
  margenes,
}: {
  categoria: string;
  rango: RangoPanel;
  margenes: boolean;
}) {
  const [resultado, setResultado] =
    useState<TabPanel<MixCategoriaPanel> | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const desde = rango.desde;
  const hasta = rango.hasta;
  useEffect(() => {
    let vivo = true;
    getPanelMixCategoria(categoria, { desde, hasta })
      .then((res) => {
        if (vivo) setResultado(res);
      })
      .catch(() => {
        if (vivo) setError(true);
      });
    return () => {
      vivo = false;
    };
  }, [categoria, desde, hasta, intento]);
  if (error)
    return (
      <div className={styles.loadState} role="alert">
        <strong>No se pudo abrir la categoría</strong>
        <p>Volvé a intentar para consultar sus ventas.</p>
        <ActionButton
          variant="outline"
          onPress={() => {
            setError(false);
            setIntento((n) => n + 1);
          }}
        >
          Reintentar
        </ActionButton>
      </div>
    );
  if (!resultado)
    return (
      <div className={styles.loadState} role="status" aria-live="polite">
        <ChartColumnStackedIcon aria-hidden="true" />
        <strong>Cargando productos de la categoría…</strong>
      </div>
    );
  return (
    <>
      <MixChart puntos={resultado.serie} meta={resultado.meta} producto />
      <div className={styles.drillHeading}>
        <strong>Productos de {categoria}</strong>
        <span>Hasta 20 productos por importe de ventas</span>
      </div>
      <VentasProductoTabla rows={resultado.productos} margenes={margenes} />
    </>
  );
}

/** La respuesta de cada categoría/rango tiene su propio montaje: nunca muestra datos del filtro anterior. */
export function ProductoMix({
  d,
  rango,
}: {
  d: TabPanel<ProductoPanel>;
  rango: RangoPanel;
}) {
  const [seleccion, setSeleccion] = useState("");
  const categorias = [...new Set(d.mixEvolutivo.map((p) => p.nombre))].sort(
    (a, b) => a.localeCompare(b, "es"),
  );
  const categoria = categorias.includes(seleccion) ? seleccion : "";
  return (
    <ReportCard
      title={categoria ? `Evolución · ${categoria}` : "Evolución de las ventas"}
      description={
        categoria
          ? "Productos de la categoría seleccionada · ventas sin IVA"
          : "Cómo se distribuyen las ventas por categoría en el tiempo"
      }
    >
      <div className={styles.mixToolbar}>
        <div className={styles.categorySelect}>
          <span>Explorar categoría</span>
          <SelectField
            aria-label="Explorar categoría"
            value={categoria}
            onChange={setSeleccion}
            options={[
              { value: "", label: "Todas las categorías" },
              ...categorias.map((c) => ({ value: c, label: c })),
            ]}
          />
        </div>
        {categoria ? (
          <ActionButton variant="outline" onPress={() => setSeleccion("")}>
            <ArrowLeftIcon data-icon="inline-start" />
            Todas las categorías
          </ActionButton>
        ) : (
          <span className={styles.toolbarHint}>
            Seleccioná una categoría para ver sus productos.
          </span>
        )}
      </div>
      {categoria ? (
        <CategoriaMix
          key={JSON.stringify([
            categoria,
            rango.desde,
            rango.hasta,
            d.meta.rango,
            d.margenesVisibles,
          ])}
          categoria={categoria}
          rango={rango}
          margenes={d.margenesVisibles}
        />
      ) : (
        <MixChart puntos={d.mixEvolutivo} meta={d.meta} />
      )}
      {d.margenesVisibles && categoria ? (
        <p className={styles.note}>
          Margen: ventas menos costo registrado. Contribución: ventas menos
          costos variables de materiales, consumibles y desgaste.
        </p>
      ) : null}
    </ReportCard>
  );
}
