"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DownloadIcon, FileTextIcon, PlusIcon, SearchIcon } from "lucide-react";

import {
  COMPROBANTE_TIPO_LABELS,
  COMPROBANTE_TIPO_SIGLA,
  estadoVisual,
  formatCuitODash,
  type Comprobante,
} from "@/lib/administracion";

const fmt = (n: number) =>
  (n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("es-AR");

const CHIPS_ESTADO: Array<[string, string]> = [
  ["todos", "Todos"],
  ["borrador", "Borrador"],
  ["emitido", "Emitido"],
  ["cae", "Con CAE"],
  ["rechazado", "Rechazado"],
  ["anulado", "Anulado"],
];

const CHIPS_TIPO: Array<[string, string]> = [
  ["todos", "Todos"],
  ["factura", "Factura"],
  ["nota_credito", "N. Crédito"],
  ["nota_debito", "N. Débito"],
];

function mesActual(fechaIso: string) {
  const hoy = new Date();
  const f = new Date(fechaIso);
  return (
    f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth()
  );
}

/** El total en pesos: las facturas E vienen en USD con su cotización. */
function totalEnPesos(c: Comprobante, campo: "total" | "saldoPendiente") {
  const v = c[campo];
  return c.moneda === "USD" && c.cotizacion ? v * c.cotizacion : v;
}

export function ComprobantesView({
  initialComprobantes,
}: {
  initialComprobantes: Comprobante[];
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [est, setEst] = React.useState("todos");
  const [tip, setTip] = React.useState("todos");

  const data = initialComprobantes;

  // "Con CAE" no es un estado del modelo: es emitido + CAE cargado.
  const cumple = (c: Comprobante, filtro: string) => {
    if (filtro === "todos") return true;
    if (filtro === "cae") return c.estado === "emitido" && !!c.cae;
    if (filtro === "emitido") return c.estado === "emitido" && !c.cae;
    return c.estado === filtro;
  };

  const estCounts = React.useMemo(() => {
    const counts: Record<string, number> = { todos: data.length };
    for (const [clave] of CHIPS_ESTADO) {
      if (clave === "todos") continue;
      counts[clave] = data.filter((c) => cumple(c, clave)).length;
    }
    return counts;
  }, [data]);

  const list = React.useMemo(
    () =>
      data.filter((c) => {
        if (!cumple(c, est)) return false;
        if (tip !== "todos" && c.tipo !== tip) return false;
        if (q) {
          const heno = [
            c.clienteNombre,
            c.numeroCompleto,
            c.clienteCuit ?? "",
            c.ordenNumero ?? "",
            c.letra,
          ]
            .join(" ")
            .toLowerCase();
          if (!heno.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [data, q, est, tip],
  );

  const vigentes = data.filter(
    (c) => c.estado === "emitido" || c.estado === "rechazado",
  );
  const emitidas = data.filter(
    (c) => c.estado === "emitido" && c.tipo === "factura" && mesActual(c.fecha),
  ).length;
  const facturado = data
    .filter((c) => c.estado === "emitido")
    .reduce((s, c) => s + totalEnPesos(c, "total"), 0);
  const pendiente = vigentes
    .filter((c) => c.estado === "emitido")
    .reduce((s, c) => s + totalEnPesos(c, "saldoPendiente"), 0);
  const ncCount = data.filter(
    (c) => c.tipo === "nota_credito" && mesActual(c.fecha),
  ).length;

  return (
    <div
      className="acp-page"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "32px 28px 90px",
      }}
    >
      <div className="acp-wrap">
        <div className="acp-head">
          <div>
            <h1>Comprobantes</h1>
            <div className="sub">
              Facturas, notas de crédito y débito emitidas — estado fiscal y
              cobro.
            </div>
          </div>
          <div className="right">
            <button type="button" className="btn" disabled>
              <DownloadIcon />
              Exportar
            </button>
            <Link className="btn btn-primary" href="/administracion/comprobantes/nuevo">
              <PlusIcon />
              Emitir comprobante
            </Link>
          </div>
        </div>

        <div className="acp-kpis">
          <div className="acp-kpi info">
            <div className="l">Emitidos del mes</div>
            <div className="v">{emitidas}</div>
            <div className="s">Facturas A/B/C/E</div>
          </div>
          <div className="acp-kpi">
            <div className="l">Monto facturado</div>
            <div className="v">{fmt(facturado)}</div>
            <div className="s">Neto de anulados</div>
          </div>
          <div className="acp-kpi warn">
            <div className="l">Pendiente de cobro</div>
            <div className="v">{fmt(pendiente)}</div>
            <div className="s">Saldo en comprobantes</div>
          </div>
          <div className="acp-kpi">
            <div className="l">Notas de crédito</div>
            <div className="v">{ncCount}</div>
            <div className="s">Emitidas este mes</div>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="acp-empty">
            <div className="ico">
              <FileTextIcon />
            </div>
            <h3>Todavía no emitiste comprobantes</h3>
            <p>
              Cuando factures una orden vas a ver acá cada comprobante con su
              CAE, estado fiscal y saldo pendiente de cobro.
            </p>
            <Link
              className="btn btn-primary"
              style={{ margin: "0 auto" }}
              href="/administracion/comprobantes/nuevo"
            >
              <PlusIcon />
              Emitir primer comprobante
            </Link>
          </div>
        ) : (
          <>
            <div className="acp-toolbar">
              <div className="acp-chips">
                {CHIPS_ESTADO.map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    className={`acp-chip ${est === k ? "on" : ""}`}
                    onClick={() => setEst(k)}
                  >
                    {l}
                    <span className="ct">{estCounts[k] ?? 0}</span>
                  </button>
                ))}
              </div>
              <div className="acp-search">
                <SearchIcon />
                <input
                  placeholder="Cliente, CUIT, Nº, orden…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            <div className="acp-subfilter">
              <span className="lbl">Tipo</span>
              {CHIPS_TIPO.map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  className={`acp-tipchip ${tip === k ? "on" : ""}`}
                  onClick={() => setTip(k)}
                >
                  {l}
                </button>
              ))}
              <span className="acp-tcount" style={{ marginLeft: "auto" }}>
                {list.length} de {data.length} comprobantes
              </span>
            </div>

            <div className="acp-tbl">
              <div className="acp-tr acp-th">
                <span>Comprobante</span>
                <span>Cliente</span>
                <span>Orden</span>
                <span>Fecha</span>
                <span className="r">Neto / IVA / Total</span>
                <span>Estado</span>
                <span className="r">Saldo</span>
              </div>
              {list.map((c) => {
                const ev = estadoVisual(c);
                const sigla = COMPROBANTE_TIPO_SIGLA[c.tipo];
                return (
                  <div
                    key={c.id}
                    className="acp-tr acp-row"
                    onClick={() =>
                      router.push(`/administracion/comprobantes/${c.id}`)
                    }
                  >
                    <span className="acp-cmp-id">
                      {/* La LETRA, no la sigla del tipo: es lo que define el
                          tratamiento de IVA y lo primero que se busca al
                          escanear la lista. El tipo lo sigue diciendo el color
                          —y, en texto, la línea de abajo—. Mismo criterio que
                          la ficha del comprobante. */}
                      <span
                        className={`acp-tipo-badge ${sigla.toLowerCase()}`}
                        title={`${COMPROBANTE_TIPO_LABELS[c.tipo]} ${c.letra}`}
                      >
                        {c.letra}
                      </span>
                      <span className="num">
                        <span className="n">{c.numeroCompleto}</span>
                        <span className="t">
                          {COMPROBANTE_TIPO_LABELS[c.tipo]} {c.letra}
                        </span>
                      </span>
                    </span>
                    <span className="acp-cli">
                      <span className="nm">{c.clienteNombre}</span>
                      <span className="cuit">
                        {formatCuitODash(c.clienteCuit)}
                      </span>
                    </span>
                    <span>
                      {c.ordenNumero ? (
                        <Link
                          className="acp-link"
                          href={`/produccion/ordenes/${c.ordenId}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.ordenNumero}
                        </Link>
                      ) : (
                        <span className="acp-fecha">—</span>
                      )}
                    </span>
                    <span className="acp-fecha">{c.fecha}</span>
                    <span className="acp-montos">
                      <span className="tot">{fmt(c.total)}</span>
                      <span className="disc">
                        Neto {fmt(c.netoGravado)} · IVA {fmt(c.ivaTotal)}
                      </span>
                      {c.moneda === "USD" ? (
                        <span className="cur">USD · TC {c.cotizacion}</span>
                      ) : null}
                    </span>
                    <span>
                      <span className={`acp-estado acp-e-${ev.clave}`}>
                        {c.estado !== "anulado" ? <span className="d" /> : null}
                        {ev.label}
                      </span>
                    </span>
                    <span
                      className={`acp-saldo-cell ${c.saldoPendiente > 0 ? "pend" : "ok"}`}
                    >
                      {c.total < 0
                        ? "—"
                        : c.saldoPendiente > 0
                          ? fmt(c.saldoPendiente)
                          : "Cobrado"}
                      {c.saldoPendiente > 0 && c.total > 0 ? (
                        <span className="sub">de {fmt(c.total)}</span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
              {list.length === 0 ? (
                <div className="acp-sin-resultados">
                  Ningún comprobante coincide con el filtro.
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

