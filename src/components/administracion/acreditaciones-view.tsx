"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  SearchIcon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useConfigRegional, useFecha } from "@/components/navigation/config-regional-provider";
import type { CobroPendienteAcreditacion } from "@/lib/administracion";
import { acreditarCobro } from "@/lib/administracion-api";
import { formatearMoneda } from "@/lib/moneda";

/** Días calendario hasta la acreditación, en texto corto. */
function cuandoAcredita(iso: string | null) {
  if (!iso) return { texto: "Sin fecha", tono: "neutro" as const, dias: null };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(iso);
  objetivo.setHours(0, 0, 0, 0);
  const dias = Math.round((objetivo.getTime() - hoy.getTime()) / 86400000);
  if (dias < 0)
    return { texto: `Venció hace ${-dias} d`, tono: "warn" as const, dias };
  if (dias === 0) return { texto: "Hoy", tono: "hoy" as const, dias };
  if (dias === 1) return { texto: "Mañana", tono: "pronto" as const, dias };
  if (dias <= 7)
    return { texto: `En ${dias} días`, tono: "pronto" as const, dias };
  return { texto: `En ${dias} días`, tono: "neutro" as const, dias };
}

const CHIPS = [
  ["todos", "Todos"],
  ["electronico", "Electrónicos"],
  ["cheque", "Cheques"],
] as const;

type Chip = (typeof CHIPS)[number][0];

export function AcreditacionesView({
  initialFilas,
}: {
  initialFilas: CobroPendienteAcreditacion[];
}) {
  const router = useRouter();
  const { moneda } = useConfigRegional();
  const { fechaCorta } = useFecha();
  // "25-jul" sin año: la vista mira la semana que viene, el año sobra.
  const fechaLarga = (iso: string | null) =>
    iso ? fechaCorta(iso).replace(/-\d{4}$/, "") : "—";
  const fmt = (n: number) => formatearMoneda(n, moneda, { decimales: 0 });
  const [filas, setFilas] = React.useState(initialFilas);
  const [chip, setChip] = React.useState<Chip>("todos");
  const [q, setQ] = React.useState("");
  const [acreditando, setAcreditando] = React.useState<string | null>(null);

  React.useEffect(() => setFilas(initialFilas), [initialFilas]);

  const counts = React.useMemo(
    () => ({
      todos: filas.length,
      electronico: filas.filter((f) => !f.esCheque).length,
      cheque: filas.filter((f) => f.esCheque).length,
    }),
    [filas],
  );

  const lista = React.useMemo(() => {
    const texto = q.trim().toLowerCase();
    return filas.filter((f) => {
      if (chip === "electronico" && f.esCheque) return false;
      if (chip === "cheque" && !f.esCheque) return false;
      if (!texto) return true;
      return [
        f.metodoNombre,
        f.clienteNombre,
        f.ordenNumero,
        f.cuentaDestinoNombre,
        f.valorNumero,
      ]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(texto));
    });
  }, [filas, chip, q]);

  const totalNeto = filas.reduce((s, f) => s + f.netoAcreditado, 0);
  const estaSemana = filas.filter((f) => {
    const d = cuandoAcredita(f.fechaAcreditacionEstimada).dias;
    return d !== null && d <= 7;
  });
  const enCartera = filas.filter((f) => f.esCheque);

  const acreditar = async (fila: CobroPendienteAcreditacion) => {
    setAcreditando(fila.id);
    try {
      await acreditarCobro(fila.id);
      toast.success(`Acreditado ${fmt(fila.netoAcreditado)} en ${fila.cuentaDestinoNombre}.`);
      setFilas((prev) => prev.filter((f) => f.id !== fila.id));
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo acreditar.",
      );
    } finally {
      setAcreditando(null);
    }
  };

  return (
    <div
      className="aac-page"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "32px 28px 90px",
      }}
    >
      <div className="aac-wrap">
        <div className="aac-head">
          <div>
            <Link href="/administracion/tesoreria" className="aac-back">
              <ArrowLeftIcon />
              Tesorería
            </Link>
            <h1>Acreditaciones pendientes</h1>
            <div className="sub">
              Plata ya cobrada que todavía no entró a la cuenta. Acredita sola
              al llegar la fecha; desde acá podés adelantarla.
            </div>
          </div>
        </div>

        <div className="aac-kpis">
          <div className="aac-kpi info">
            <div className="l">Total a acreditar</div>
            <div className="v">{fmt(totalNeto)}</div>
            <div className="s">Neto de comisiones</div>
          </div>
          <div className="aac-kpi">
            <div className="l">Cobros en tránsito</div>
            <div className="v">{filas.length}</div>
            <div className="s">Esperando fecha</div>
          </div>
          <div className="aac-kpi">
            <div className="l">Entra esta semana</div>
            <div className="v">
              {fmt(estaSemana.reduce((s, f) => s + f.netoAcreditado, 0))}
            </div>
            <div className="s">
              {estaSemana.length} cobro{estaSemana.length === 1 ? "" : "s"} en 7
              días
            </div>
          </div>
          <div className="aac-kpi">
            <div className="l">Cheques en cartera</div>
            <div className="v">
              {fmt(enCartera.reduce((s, f) => s + f.netoAcreditado, 0))}
            </div>
            <div className="s">
              {enCartera.length} valor{enCartera.length === 1 ? "" : "es"} sin
              depositar
            </div>
          </div>
        </div>

        {filas.length === 0 ? (
          <div className="aac-empty">
            <div className="ico">
              <WalletIcon />
            </div>
            <h3>No hay nada esperando acreditación</h3>
            <p>
              Todo lo que cobraste ya está disponible en tus cuentas. Los cobros
              con plazo (débito, QR, crédito) van a aparecer acá hasta que
              llegue su fecha.
            </p>
            <Link
              className="btn btn-primary"
              style={{ margin: "0 auto" }}
              href="/administracion/tesoreria"
            >
              Volver a Tesorería
            </Link>
          </div>
        ) : (
          <>
            <div className="aac-toolbar">
              <div className="aac-chips">
                {CHIPS.map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    className={`aac-chip ${chip === k ? "on" : ""}`}
                    onClick={() => setChip(k)}
                  >
                    {l}
                    <span className="ct">{counts[k]}</span>
                  </button>
                ))}
              </div>
              <div className="aac-search">
                <SearchIcon />
                <input
                  placeholder="Método, cliente, orden, cuenta…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            <div className="aac-tbl">
              <div className="aac-tr aac-th">
                <span>Acredita</span>
                <span>Método</span>
                <span>Cliente</span>
                <span>Orden</span>
                <span>Cuenta destino</span>
                <span className="r">Bruto</span>
                <span className="r">Neto</span>
                <span />
              </div>
              {lista.map((fila) => {
                const cuando = cuandoAcredita(fila.fechaAcreditacionEstimada);
                return (
                  <div key={fila.id} className="aac-tr aac-row">
                    <span className="aac-fecha">
                      <span className="d">
                        {fechaLarga(fila.fechaAcreditacionEstimada)}
                      </span>
                      <span className={`aac-when ${cuando.tono}`}>
                        {cuando.texto}
                      </span>
                    </span>
                    <span className="aac-metodo">
                      <span className="nm">{fila.metodoNombre}</span>
                      <span className="mt">
                        {fila.esCheque && fila.valorNumero
                          ? `Cheque ${fila.valorNumero}`
                          : `Cobrado ${fechaLarga(fila.fecha)}`}
                      </span>
                    </span>
                    <span className="aac-trunc">
                      {fila.clienteNombre ?? "—"}
                    </span>
                    <span>
                      {fila.ordenNumero ? (
                        <Link
                          className="aac-ot"
                          href={`/produccion/ordenes/${fila.ordenId}`}
                        >
                          {fila.ordenNumero}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="aac-trunc">{fila.cuentaDestinoNombre}</span>
                    <span className="r aac-bruto">{fmt(fila.montoBruto)}</span>
                    <span className="r aac-neto">
                      {fmt(fila.netoAcreditado)}
                    </span>
                    <span className="r">
                      {fila.esCheque ? (
                        <span
                          className="aac-cartera"
                          title="Los cheques se acreditan desde la cartera de valores."
                        >
                          <ClockIcon />
                          En cartera
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn aac-btn"
                          disabled={acreditando === fila.id}
                          onClick={() => void acreditar(fila)}
                        >
                          <CheckIcon />
                          {acreditando === fila.id ? "…" : "Acreditar"}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
              {lista.length === 0 ? (
                <div className="aac-sin-resultados">
                  Ningún cobro coincide con el filtro.
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
