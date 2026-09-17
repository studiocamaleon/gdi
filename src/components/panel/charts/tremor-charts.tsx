"use client";

/**
 * Adaptado de Tremor BarChart, AreaChart y SparkAreaChart v1.0.0 (Apache-2.0).
 * https://github.com/tremorlabs/tremor/tree/main/src/components
 * Modificaciones Grafo: API tipada acotada, tokens locales, formatos regionales,
 * leyenda externa, teclado y dominio con valores negativos. Ver TREMOR-LICENSE.
 */
import { useId, useSyncExternalStore } from "react";
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./tremor-charts.module.css";

// Recharts mide los textos con el DOM: el SVG se monta tras hidratar, dentro
// de un marco de altura estable, para evitar ejes distintos entre servidor y cliente.
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const useChartReady = () =>
  useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);

export type ChartDatum = { [key: string]: string | number | null };
export type ChartCategory = {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
};

/** Series independientes: la mediana nunca se apila encima del promedio. */
export function TremorAreaChart({
  data,
  index,
  categories,
  valueFormatter,
  axisFormatter = valueFormatter,
  labelFormatter = String,
  tickFormatter = String,
  label,
  height = 260,
}: {
  data: ChartDatum[];
  index: string;
  categories: ChartCategory[];
  valueFormatter: (value: number) => string;
  axisFormatter?: (value: number) => string;
  labelFormatter?: (value: string) => string;
  tickFormatter?: (value: string) => string;
  label: string;
  height?: number;
}) {
  const id = useId().replace(/:/g, "");
  const ready = useChartReady();
  return (
    <div className={styles.chart} data-chart="tremor-area">
      <p id={`${id}-help`} className="sr-only">
        {label}. Usá las flechas izquierda y derecha para recorrer los períodos.
        Los valores también están disponibles en Ver datos.
      </p>
      <div className={styles.plot} style={{ height }}>
        {ready ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            initialDimension={{ width: 320, height }}
          >
            <RechartsAreaChart
              id={`${id}-chart`}
              data={data}
              accessibilityLayer
              aria-label={label}
              aria-describedby={`${id}-help`}
              margin={{ top: 12, right: 32, bottom: 8, left: 0 }}
            >
              <defs>
                {categories.map((c, i) => (
                  <linearGradient
                    key={c.key}
                    id={`${id}-${i}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={c.color} stopOpacity={0.18} />
                    <stop
                      offset="100%"
                      stopColor={c.color}
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                horizontal
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey={index}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
                interval="preserveStartEnd"
                tickFormatter={tickFormatter}
                tick={{ fill: "var(--muted-text)", fontSize: 11 }}
                tickMargin={12}
              />
              <YAxis
                width={64}
                axisLine={false}
                tickLine={false}
                tickFormatter={axisFormatter}
                domain={[(min: number) => Math.min(0, min), "auto"]}
                tick={{ fill: "var(--muted-text)", fontSize: 11 }}
                tickMargin={8}
              />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Tooltip
                isAnimationActive={false}
                wrapperStyle={{ outline: "none" }}
                cursor={{
                  stroke: "var(--border-strong)",
                  strokeDasharray: "3 4",
                }}
                offset={12}
                content={({ active, payload, label: pointLabel }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className={styles.tooltip} role="status">
                      <p>{labelFormatter(String(pointLabel))}</p>
                      <div>
                        {payload.map((item) => {
                          const c = categories.find(
                            (category) => category.key === item.dataKey,
                          );
                          if (!c || typeof item.value !== "number") return null;
                          return (
                            <div key={c.key} className={styles.tooltipRow}>
                              <span>
                                <i
                                  style={{ background: c.color }}
                                  aria-hidden="true"
                                />
                                {c.label}
                              </span>
                              <strong>{valueFormatter(item.value)}</strong>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }}
              />
              {categories.map((c, i) => (
                <Area
                  key={c.key}
                  name={c.label}
                  dataKey={c.key}
                  type="linear"
                  stroke={c.color}
                  strokeWidth={2}
                  strokeDasharray={c.dashed ? "5 4" : undefined}
                  fill={c.dashed ? "none" : `url(#${id}-${i})`}
                  dot={
                    data.length === 1
                      ? {
                          r: 4,
                          fill: c.color,
                          stroke: "var(--surface)",
                          strokeWidth: 2,
                        }
                      : false
                  }
                  activeDot={{
                    r: 4,
                    fill: c.color,
                    stroke: "var(--surface)",
                    strokeWidth: 2,
                  }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </RechartsAreaChart>
          </ResponsiveContainer>
        ) : null}
      </div>
      <ul className={styles.legend} aria-label="Series del gráfico">
        {categories.map((c) => (
          <li key={c.key}>
            <i
              className={styles.lineKey}
              style={{
                borderColor: c.color,
                borderStyle: c.dashed ? "dashed" : "solid",
              }}
              aria-hidden="true"
            />
            {c.label}
            {c.dashed ? " · discontinua" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TremorBarChart({
  data,
  index,
  categories,
  valueFormatter,
  axisFormatter = valueFormatter,
  labelFormatter = String,
  tickFormatter = String,
  label,
  height = 280,
  mode = "stacked",
  allowDecimals = true,
}: {
  data: ChartDatum[];
  index: string;
  categories: ChartCategory[];
  valueFormatter: (value: number) => string;
  axisFormatter?: (value: number) => string;
  labelFormatter?: (value: string) => string;
  tickFormatter?: (value: string) => string;
  label: string;
  height?: number;
  mode?: "stacked" | "grouped";
  allowDecimals?: boolean;
}) {
  const helpId = useId();
  const ready = useChartReady();
  return (
    <div className={styles.chart} data-chart="tremor-bar">
      <p id={helpId} className="sr-only">
        {label}. Usá las flechas izquierda y derecha para recorrer los períodos.
        Los valores también están disponibles en Ver datos.
      </p>
      <div className={styles.plot} style={{ height }}>
        {ready ? (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            initialDimension={{ width: 320, height }}
          >
            <RechartsBarChart
              id={`${helpId}-chart`}
              data={data}
              accessibilityLayer
              aria-label={label}
              aria-describedby={helpId}
              stackOffset="sign"
              margin={{ top: 12, right: 18, bottom: 8, left: 0 }}
              barCategoryGap="28%"
            >
              <CartesianGrid
                horizontal
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey={index}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
                interval="preserveStartEnd"
                tickFormatter={tickFormatter}
                tick={{ fill: "var(--muted-text)", fontSize: 11 }}
                tickMargin={12}
              />
              <YAxis
                allowDecimals={allowDecimals}
                width={64}
                axisLine={false}
                tickLine={false}
                tickFormatter={axisFormatter}
                domain={[(min: number) => Math.min(0, min), "auto"]}
                tick={{ fill: "var(--muted-text)", fontSize: 11 }}
                tickMargin={8}
              />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <Tooltip
                wrapperStyle={{ outline: "none" }}
                isAnimationActive={false}
                cursor={{ fill: "var(--foreground)", opacity: 0.035 }}
                offset={12}
                content={({ active, payload, label: pointLabel }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className={styles.tooltip} role="status">
                      <p>{labelFormatter(String(pointLabel))}</p>
                      <div>
                        {payload.map((item) => {
                          const category = categories.find(
                            (c) => c.key === item.dataKey,
                          );
                          if (!category || typeof item.value !== "number")
                            return null;
                          return (
                            <div
                              className={styles.tooltipRow}
                              key={category.key}
                            >
                              <span>
                                <i
                                  style={{ background: category.color }}
                                  aria-hidden="true"
                                />
                                {category.label}
                              </span>
                              <strong>{valueFormatter(item.value)}</strong>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }}
              />
              {categories.map((category) => (
                <Bar
                  key={category.key}
                  name={category.label}
                  dataKey={category.key}
                  stackId={mode === "stacked" ? "stack" : undefined}
                  fill={category.color}
                  maxBarSize={mode === "stacked" ? 56 : 96}
                  isAnimationActive={false}
                />
              ))}
            </RechartsBarChart>
          </ResponsiveContainer>
        ) : null}
      </div>
      <ul className={styles.legend} aria-label="Series del gráfico">
        {categories.map((category) => (
          <li key={category.key}>
            <i style={{ background: category.color }} aria-hidden="true" />
            {category.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TremorSparkAreaChart({
  data,
  index,
  category,
  color = "var(--accent)",
}: {
  data: ChartDatum[];
  index: string;
  category: string;
  color?: string;
}) {
  const areaId = useId().replace(/:/g, "");
  const ready = useChartReady();
  if (data.length < 2) return null;
  return (
    <div className={styles.spark} aria-hidden="true" data-chart="tremor-spark">
      {ready ? (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 120, height: 42 }}
        >
          <RechartsAreaChart
            id={`${areaId}-chart`}
            data={data}
            margin={{ bottom: 1, left: 1, right: 1, top: 1 }}
            accessibilityLayer={false}
          >
            <XAxis hide dataKey={index} />
            <YAxis hide domain={[(min: number) => Math.min(0, min), "auto"]} />
            <defs>
              <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.28} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="linear"
              dataKey={category}
              dot={false}
              stroke={color}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              isAnimationActive={false}
              connectNulls={false}
              fill={`url(#${areaId})`}
            />
          </RechartsAreaChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
