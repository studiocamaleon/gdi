"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ReceiptTextIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import type {
  OrdenFacturable,
  ResultadoLoteFacturacion,
} from "@/lib/administracion";
import { facturarLote } from "@/lib/administracion-api";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { abreviarMoneda, formatearMoneda } from "@/lib/moneda";

/**
 * Administración → Facturación: órdenes finalizadas/entregadas con saldo
 * sin facturar. Seleccionás N y facturás — mismo cliente permite agrupar
 * en UNA factura (un renglón por orden); distinto cliente, una por orden.
 * La emisión es secuencial y nunca todo-o-nada: el resultado se informa
 * orden por orden. Ver docs/facturacion-ordenes-deuda-comercial-diseno.md §6.2.
 */
export function FacturacionView({
  initialOrdenes,
}: {
  initialOrdenes: OrdenFacturable[];
}) {
  const router = useRouter();
  const { moneda } = useConfigRegional();
  const fmt = (n: number) => formatearMoneda(n, moneda, { decimales: 0 });
  const fmtK = (n: number) => abreviarMoneda(n, moneda);
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState<Set<string>>(() => new Set());
  const [modo, setModo] = React.useState<"por_orden" | "agrupada">(
    "por_orden",
  );
  const [facturando, setFacturando] = React.useState(false);
  const [resultado, setResultado] =
    React.useState<ResultadoLoteFacturacion | null>(null);

  const data = initialOrdenes;
  const rows = React.useMemo(
    () =>
      data.filter(
        (o) =>
          !q ||
          `${o.numero} ${o.clienteNombre ?? ""}`
            .toLowerCase()
            .includes(q.toLowerCase()),
      ),
    [data, q],
  );

  const seleccionadas = data.filter((o) => sel.has(o.ordenId));
  const totalSel = seleccionadas.reduce((s, o) => s + o.saldoSinFacturar, 0);
  const clientesSel = new Set(seleccionadas.map((o) => o.clienteId ?? "CF"));
  const puedeAgrupar = seleccionadas.length > 1 && clientesSel.size === 1;
  const totalPendiente = data.reduce((s, o) => s + o.saldoSinFacturar, 0);

  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const facturar = async () => {
    if (seleccionadas.length === 0 || facturando) return;
    const modoFinal = puedeAgrupar ? modo : "por_orden";
    setFacturando(true);
    try {
      const res = await facturarLote({
        ordenIds: seleccionadas.map((o) => o.ordenId),
        modo: modoFinal,
      });
      setResultado(res);
      const ok = res.resultados.filter((r) => r.ok).length;
      const fail = res.resultados.length - ok;
      if (fail === 0) {
        toast.success(
          modoFinal === "agrupada"
            ? `Factura agrupada emitida para ${ok} órdenes.`
            : `${ok} factura${ok === 1 ? "" : "s"} emitida${ok === 1 ? "" : "s"}.`,
        );
      } else {
        toast.error(
          `${fail} de ${res.resultados.length} no se pudieron facturar.`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo facturar.");
    } finally {
      setFacturando(false);
    }
  };

  const cerrarResultado = () => {
    setResultado(null);
    setSel(new Set());
    router.refresh();
  };

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
            <h1>Facturación</h1>
            <div className="sub">
              Órdenes finalizadas con saldo sin facturar. La deuda del
              cliente corre igual — facturar es opcional y queda vinculado a
              la orden.
            </div>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="ade-empty">
            <div className="ico">
              <ReceiptTextIcon />
            </div>
            <h3>No hay nada para facturar</h3>
            <p>
              Cuando una orden se finalice con saldo sin facturar va a
              aparecer acá, lista para facturarse sola o en lote.
            </p>
          </div>
        ) : (
          <>
            <div className="ade-buckets" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="ade-bkt b0">
                <div className="l">Órdenes sin facturar</div>
                <div className="v">{data.length}</div>
                <div className="s">finalizadas o entregadas</div>
              </div>
              <div className="ade-bkt b1">
                <div className="l">Saldo sin facturar</div>
                <div className="v">{fmtK(totalPendiente)}</div>
                <div className="s">total con IVA</div>
              </div>
              <div className="ade-bkt total">
                <div className="l">Seleccionadas</div>
                <div className="v">{seleccionadas.length}</div>
                <div className="s">{fmtK(totalSel)} a facturar</div>
              </div>
            </div>

            <div className="ade-toolbar">
              <div className="ade-search">
                <SearchIcon />
                <input
                  placeholder="Buscar orden o cliente…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              {seleccionadas.length > 0 ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {puedeAgrupar ? (
                    <div className="ade-seg">
                      <button
                        type="button"
                        className={modo === "por_orden" ? "on" : ""}
                        onClick={() => setModo("por_orden")}
                      >
                        Una factura por orden
                      </button>
                      <button
                        type="button"
                        className={modo === "agrupada" ? "on" : ""}
                        onClick={() => setModo("agrupada")}
                      >
                        Agrupar en una
                      </button>
                    </div>
                  ) : seleccionadas.length > 1 ? (
                    <span style={{ fontSize: 12, color: "var(--muted-text-2)" }}>
                      Clientes distintos: una factura por orden
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={facturando}
                    onClick={() => void facturar()}
                  >
                    <ReceiptTextIcon />
                    {facturando
                      ? "Emitiendo…"
                      : `Facturar ${seleccionadas.length === 1 ? "orden" : `${seleccionadas.length} órdenes`} · ${fmt(totalSel)}`}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="ade-mtx">
              <div
                className="ade-mtx-tr ade-mtx-th"
                style={{
                  gridTemplateColumns:
                    "36px 1.4fr 1.4fr 0.9fr 1fr 1fr 1fr 1fr",
                }}
              >
                <span />
                <span>Orden</span>
                <span>Cliente</span>
                <span className="r">Finalizada</span>
                <span className="r">Total</span>
                <span className="r">Facturado</span>
                <span className="r">Cobrado</span>
                <span className="r">Sin facturar</span>
              </div>
              {rows.map((o) => (
                <div
                  key={o.ordenId}
                  className="ade-mtx-tr ade-mtx-row"
                  style={{
                    gridTemplateColumns:
                      "36px 1.4fr 1.4fr 0.9fr 1fr 1fr 1fr 1fr",
                  }}
                  onClick={() => toggle(o.ordenId)}
                >
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <input
                      type="checkbox"
                      checked={sel.has(o.ordenId)}
                      onChange={() => toggle(o.ordenId)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="ade-mtx-cli">
                    <Link
                      className="nm"
                      href={`/produccion/ordenes/${o.ordenId}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {o.numero}
                    </Link>
                    <span className="sub">{o.estado}</span>
                  </div>
                  <div className="ade-mtx-cli">
                    <span className="nm">
                      {o.clienteNombre ?? "Mostrador / sin cliente"}
                    </span>
                  </div>
                  <div className="ade-cell">{o.fechaFinalizada ?? "—"}</div>
                  <div className="ade-cell">{fmt(o.total)}</div>
                  <div className="ade-cell">
                    {o.facturado > 0 ? fmt(o.facturado) : "—"}
                  </div>
                  <div className="ade-cell">
                    {o.cobrado > 0 ? fmt(o.cobrado) : "—"}
                  </div>
                  <div className="ade-cell tot">{fmt(o.saldoSinFacturar)}</div>
                </div>
              ))}
              {rows.length === 0 ? (
                <div className="ade-sin-resultados">
                  Ninguna orden coincide con la búsqueda.
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {resultado ? (
        <div className="acc-backdrop show" onClick={cerrarResultado}>
          <div
            className="acc-modal"
            style={{ width: "min(560px,96vw)" }}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="acc-modal-head">
              <button
                type="button"
                className="acc-modal-x"
                onClick={cerrarResultado}
              >
                <XIcon />
              </button>
              <h2>Resultado del lote</h2>
              <div className="s">
                {resultado.resultados.filter((r) => r.ok).length} de{" "}
                {resultado.resultados.length} facturadas
                {resultado.modo === "agrupada" ? " (factura agrupada)" : ""}
              </div>
            </div>
            <div className="acc-modal-body">
              {resultado.resultados.map((r) => (
                <div
                  key={r.ordenId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 0",
                    borderBottom: "1px solid var(--hairline)",
                    fontSize: 13,
                  }}
                >
                  {r.ok ? (
                    <CheckIcon
                      style={{ width: 15, height: 15, color: "var(--ok)" }}
                    />
                  ) : (
                    <XIcon
                      style={{ width: 15, height: 15, color: "var(--danger)" }}
                    />
                  )}
                  <span style={{ fontWeight: 600 }}>{r.numero}</span>
                  {r.ok && r.comprobante ? (
                    <Link
                      href={`/administracion/comprobantes/${r.comprobante.id}`}
                      style={{ marginLeft: "auto" }}
                    >
                      {r.comprobante.numeroCompleto}
                    </Link>
                  ) : (
                    <span
                      style={{
                        marginLeft: "auto",
                        color: "var(--danger)",
                        textAlign: "right",
                      }}
                    >
                      {r.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
