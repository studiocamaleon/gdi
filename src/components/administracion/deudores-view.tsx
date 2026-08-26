"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon, SearchIcon, UsersIcon } from "lucide-react";

import {
  TRAMOS_AGING,
  TRAMO_AGING_LABELS,
  colorCeldaAging,
  colorTextoAging,
  formatCuitODash,
  type FilaDeudor,
  type TramoAging,
} from "@/lib/administracion";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { abreviarMoneda, formatearMoneda } from "@/lib/moneda";

export function DeudoresView({ initialFilas }: { initialFilas: FilaDeudor[] }) {
  const router = useRouter();
  const { moneda } = useConfigRegional();
  // "—" cuando es cero: el diseño deja las celdas vacías en blanco.
  const fmt = (n: number) =>
    n === 0 ? "—" : formatearMoneda(n, moneda, { decimales: 0 });
  // Compacto para las tarjetas de arriba.
  const fmtK = (n: number) => abreviarMoneda(n, moneda);
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<"total" | "overdue">("total");

  const data = initialFilas;

  const rows = React.useMemo(() => {
    const filtradas = data.filter(
      (d) =>
        !q ||
        `${d.nombre} ${d.cuit ?? ""}`.toLowerCase().includes(q.toLowerCase()),
    );
    return [...filtradas].sort((a, b) =>
      sort === "overdue" ? b.vencido - a.vencido : b.total - a.total,
    );
  }, [data, q, sort]);

  const totalCol = React.useMemo(() => {
    const acc = {} as Record<TramoAging, number>;
    for (const t of TRAMOS_AGING) {
      acc[t] = data.reduce((s, d) => s + d.aging[t], 0);
    }
    return acc;
  }, [data]);

  // El heatmap compara dentro de cada columna: un saldo grande en "+90"
  // pinta fuerte aunque sea chico contra el total general.
  const maxCol = React.useMemo(() => {
    const acc = {} as Record<TramoAging, number>;
    for (const t of TRAMOS_AGING) {
      acc[t] = Math.max(0, ...data.map((d) => d.aging[t]));
    }
    return acc;
  }, [data]);

  const grand = TRAMOS_AGING.reduce((s, t) => s + totalCol[t], 0);
  const vencidoTot = totalCol.d61_90 + totalCol.d90_mas;

  return (
    <div
      className="ade-page"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "32px 28px 90px",
      }}
    >
      <div className="ade-wrap">
        <div className="ade-head">
          <div>
            <h1>Cuentas por cobrar</h1>
            <div className="sub">
              Antigüedad de la deuda por cliente. Cuanto más intenso el color,
              mayor el saldo vencido.
            </div>
          </div>
          <div className="right">
            <button type="button" className="btn" disabled>
              <DownloadIcon />
              Exportar
            </button>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="ade-empty">
            <div className="ico">
              <UsersIcon />
            </div>
            <h3>Ningún cliente te debe plata</h3>
            <p>
              Acá vas a ver la deuda de cada cliente repartida por
              antigüedad: cada orden finalizada suma lo que falta cobrar,
              esté facturada o no.
            </p>
          </div>
        ) : (
          <>
            <div className="ade-buckets">
              {TRAMOS_AGING.map((t, i) => (
                <div key={t} className={`ade-bkt b${i}`}>
                  <div className="l">{TRAMO_AGING_LABELS[t]}</div>
                  <div className="v">{fmtK(totalCol[t])}</div>
                  <div className="s">
                    {grand > 0 ? Math.round((totalCol[t] / grand) * 100) : 0}%
                    del total
                  </div>
                </div>
              ))}
              <div className="ade-bkt total">
                <div className="l">Total deudor</div>
                <div className="v">{fmtK(grand)}</div>
                <div className="s">{fmtK(vencidoTot)} vencido (+60d)</div>
              </div>
            </div>

            <div className="ade-toolbar">
              <div className="ade-search">
                <SearchIcon />
                <input
                  placeholder="Buscar cliente o CUIT…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="ade-seg">
                <button
                  type="button"
                  className={sort === "total" ? "on" : ""}
                  onClick={() => setSort("total")}
                >
                  Por total
                </button>
                <button
                  type="button"
                  className={sort === "overdue" ? "on" : ""}
                  onClick={() => setSort("overdue")}
                >
                  Por vencido
                </button>
              </div>
            </div>

            <div className="ade-mtx">
              <div className="ade-mtx-tr ade-mtx-th">
                <span>Cliente</span>
                {TRAMOS_AGING.map((t) => (
                  <span key={t} className="r">
                    {TRAMO_AGING_LABELS[t]}
                  </span>
                ))}
                <span className="r">Total</span>
              </div>

              {rows.map((d) => (
                <div
                  key={d.clienteId ?? "mostrador"}
                  className="ade-mtx-tr ade-mtx-row"
                  style={d.clienteId ? undefined : { cursor: "default" }}
                  onClick={() =>
                    d.clienteId &&
                    router.push(`/crm/clientes/${d.clienteId}/cuenta-corriente`)
                  }
                >
                  <div className="ade-mtx-cli">
                    <span className="nm">{d.nombre}</span>
                    <span className="sub">
                      {formatCuitODash(d.cuit)}
                      {" · fact. "}
                      {d.facturadoPct}%
                    </span>
                  </div>
                  {TRAMOS_AGING.map((t) => (
                    <div
                      key={t}
                      className={`ade-cell ${d.aging[t] <= 0 ? "zero" : ""}`}
                      style={{
                        background: colorCeldaAging(t, d.aging[t], maxCol[t]),
                        color: colorTextoAging(t, d.aging[t], maxCol[t]),
                      }}
                    >
                      {fmt(d.aging[t])}
                    </div>
                  ))}
                  <div className="ade-cell tot">{fmt(d.total)}</div>
                </div>
              ))}

              {rows.length === 0 ? (
                <div className="ade-sin-resultados">
                  Ningún cliente coincide con la búsqueda.
                </div>
              ) : (
                <div className="ade-mtx-foot">
                  <div className="lbl">
                    Total general · {rows.length} cliente
                    {rows.length === 1 ? "" : "s"}
                  </div>
                  {TRAMOS_AGING.map((t) => (
                    <div key={t} className="ade-cell">
                      {fmt(totalCol[t])}
                    </div>
                  ))}
                  <div className="ade-cell tot">{fmt(grand)}</div>
                </div>
              )}
            </div>

            <div className="ade-legend">
              <div className="it">
                <span>Intensidad</span>
                <span className="grad" />
                <span>mayor saldo vencido</span>
              </div>
              <div className="it">
                <span
                  className="sw"
                  style={{ background: "hsl(150,60%,80%)" }}
                />
                Al día
              </div>
              <div className="it">
                <span className="sw" style={{ background: "hsl(0,72%,72%)" }} />
                +90 días
              </div>
              <div className="it" style={{ marginLeft: "auto" }}>
                Click en una fila → cuenta corriente del cliente
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
