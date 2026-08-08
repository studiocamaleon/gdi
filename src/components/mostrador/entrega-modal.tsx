"use client";

/**
 * Modal de entrega por escaneo (docs/entrega-por-escaneo-diseno.md).
 * Portado de claude.ai/design → mostrador/Entrega por escaneo.html.
 *
 * Se abre sobre cualquier pantalla: el operador escanea el QR que trae el
 * cliente y despacha sin perder dónde estaba. La entrega es POR ÍTEM — se
 * puede llevar lo que está listo y dejar el resto en producción.
 *
 * El cobro de acá es deliberadamente simple (medio + monto): el mostrador
 * necesita dos clicks. Un cobro con retenciones, cheque o comisión a mano
 * va por Administración, a un click de "Ver orden completa".
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  InfoIcon,
  ScanLineIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  entregarItems,
  escanearOrden,
  revertirEntrega,
  type ItemEntrega,
  type OrdenEscaneada,
} from "@/lib/entrega-api";
import {
  getCuentasFondos,
  getMetodosPago,
} from "@/lib/administracion-api";
import type { CuentaFondosResumen, MetodoPago } from "@/lib/administracion";
import { formatearMoneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import s from "./entrega-modal.module.css";

/** Iniciales para el avatar del ítem, como en el diseño. */
function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Color estable por nombre: el mismo trabajo se ve igual siempre. */
const COLORES = ["#c2410c", "#1d4ed8", "#7c4dd6", "#16794a", "#9a6a11"];
function colorDe(nombre: string) {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) | 0;
  return COLORES[Math.abs(h) % COLORES.length];
}

export function EntregaModal({
  codigo,
  onClose,
}: {
  /** Lo que salió del lector: el número de la orden. */
  codigo: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { moneda } = useConfigRegional();
  const fmt = (n: number) => formatearMoneda(n, moneda, { decimales: 0 });

  const [orden, setOrden] = React.useState<OrdenEscaneada | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sel, setSel] = React.useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = React.useState(false);

  // Cobro (sólo si hay saldo).
  const [metodos, setMetodos] = React.useState<MetodoPago[]>([]);
  const [cuentas, setCuentas] = React.useState<CuentaFondosResumen[]>([]);
  const [medioId, setMedioId] = React.useState("");
  const [monto, setMonto] = React.useState("");

  // Retiro por un tercero.
  const [tercero, setTercero] = React.useState(false);
  const [tNombre, setTNombre] = React.useState("");
  const [tDni, setTDni] = React.useState("");

  // Resolver el código escaneado. Preselecciona todo lo que está listo:
  // el caso normal es que el cliente se lleve todo lo que puede.
  React.useEffect(() => {
    let vivo = true;
    setError(null);
    escanearOrden(codigo)
      .then((o) => {
        if (!vivo) return;
        setOrden(o);
        const inicial: Record<string, boolean> = {};
        for (const item of o.items) {
          if (item.listo && !item.entregadoEl) inicial[item.id] = true;
        }
        setSel(inicial);
        setMonto(o.saldo > 0 ? String(Math.round(o.saldo)) : "");
      })
      .catch((e) => {
        if (vivo) {
          setError(
            e instanceof Error ? e.message : "No se pudo leer la orden.",
          );
        }
      });
    return () => {
      vivo = false;
    };
  }, [codigo]);

  // Catálogos del cobro: sólo si hay algo que cobrar.
  React.useEffect(() => {
    if (!orden || orden.saldo <= 0) return;
    let vivo = true;
    void Promise.all([getMetodosPago(), getCuentasFondos()])
      .then(([ms, cs]) => {
        if (!vivo) return;
        const activos = ms.filter((m) => m.activo);
        setMetodos(activos);
        setCuentas(cs);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [orden]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = orden?.items ?? [];
  const pendientes = items.filter((i) => !i.entregadoEl);
  const listos = pendientes.filter((i) => i.listo);
  const enProduccion = pendientes.filter((i) => !i.listo);
  const yaEntregados = items.filter((i) => i.entregadoEl);
  const elegidos = items.filter((i) => sel[i.id] && !i.entregadoEl);
  const todoEntregado = items.length > 0 && pendientes.length === 0;
  const saldo = orden?.saldo ?? 0;

  const montoNum = Number(String(monto).replace(/\./g, "").replace(",", ".")) || 0;
  const medio = metodos.find((m) => m.id === medioId) ?? null;

  const toggle = (item: ItemEntrega) => {
    if (!item.listo || item.entregadoEl) return;
    setSel((c) => ({ ...c, [item.id]: !c[item.id] }));
  };

  const confirmar = async () => {
    if (!orden || elegidos.length === 0) return;
    if (tercero && (!tNombre.trim() || !tDni.trim())) return;
    setGuardando(true);
    try {
      // La cuenta destino sale del método (su default) o de la primera
      // disponible: en el mostrador nadie elige la caja a mano.
      const cuentaDestinoId =
        medio?.cuentaDestinoId ?? cuentas[0]?.id ?? null;
      const cobra = saldo > 0 && medio != null && montoNum > 0;
      if (cobra && !cuentaDestinoId) {
        toast.error(
          "No hay una cuenta de fondos configurada para acreditar el cobro.",
        );
        setGuardando(false);
        return;
      }
      const r = await entregarItems(orden.id, {
        itemIds: elegidos.map((i) => i.id),
        ...(tercero
          ? { retiraTercero: { nombre: tNombre.trim(), dni: tDni.trim() } }
          : {}),
        ...(cobra
          ? {
              cobro: {
                fecha: new Date().toISOString().slice(0, 10),
                metodoPagoId: medio!.id,
                cuentaDestinoId: cuentaDestinoId!,
                montoBruto: montoNum,
                comisionPctAplicada: medio!.comisionPct,
              },
            }
          : {}),
      });
      toast.success(
        r.ordenCerrada
          ? `${orden.numero} entregada por completo.`
          : `${r.entregados} producto${r.entregados === 1 ? "" : "s"} entregado${r.entregados === 1 ? "" : "s"}. La orden queda abierta.`,
      );
      if (r.cobro) {
        toast.success(`Cobro registrado · recibo ${r.cobro.numeroRecibo}`);
      }
      router.refresh();
      onClose();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo completar la entrega.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const revertir = async () => {
    if (!orden) return;
    const motivo = "Revertida desde el mostrador";
    setGuardando(true);
    try {
      const r = await revertirEntrega(orden.id, {
        itemIds: yaEntregados.map((i) => i.id),
        motivo,
      });
      toast.success(
        `${r.revertidos} producto${r.revertidos === 1 ? "" : "s"} vuelve${r.revertidos === 1 ? "" : "n"} a pendiente de retiro.`,
      );
      router.refresh();
      onClose();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo revertir la entrega.",
      );
    } finally {
      setGuardando(false);
    }
  };

  // Texto del botón principal: dice exactamente qué va a pasar.
  const labelAccion = (() => {
    if (todoEntregado) return "Cerrar";
    if (elegidos.length === 0) return "Elegí qué se entrega";
    if (tercero && (!tNombre.trim() || !tDni.trim()))
      return "Completá quién retira";
    const ent = `${elegidos.length} ${elegidos.length === 1 ? "producto" : "productos"}`;
    return saldo > 0 && medio && montoNum > 0
      ? `Cobrar ${fmt(montoNum)} y entregar ${ent}`
      : `Entregar ${ent}`;
  })();
  const puedeConfirmar =
    !guardando &&
    elegidos.length > 0 &&
    (!tercero || (tNombre.trim() !== "" && tDni.trim() !== ""));

  return (
    <div className={s.overlay} onClick={onClose}>
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`Entrega de ${orden?.numero ?? codigo}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={s.mh}>
          <span className={s.scanTag}>
            <ScanLineIcon />
            Escaneado
          </span>
          <div className={s.who}>
            <h1>{orden?.numero ?? codigo}</h1>
            {orden ? (
              <span
                className={`${s.badge} ${
                  todoEntregado ? s.done : saldo > 0 ? s.warn : s.ok
                }`}
              >
                {todoEntregado
                  ? "Entregada"
                  : saldo > 0
                    ? "Saldo pendiente"
                    : "Paga"}
              </span>
            ) : null}
          </div>
          <div className={s.spacer} />
          {orden?.cliente ? (
            <div className={s.cli}>
              <span className={s.n}>{orden.cliente.nombre}</span>
              {orden.cliente.telefono ? (
                <span className={s.d}>{orden.cliente.telefono}</span>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className={s.x}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <XIcon />
          </button>
        </header>

        {error ? (
          <div className={`${s.note} ${s.warn}`}>
            <TriangleAlertIcon />
            <span>{error}</span>
          </div>
        ) : null}

        {!orden && !error ? (
          <div className={s.cargando}>Buscando la orden…</div>
        ) : null}

        {orden ? (
          <>
            {todoEntregado ? (
              <div className={`${s.note} ${s.done}`}>
                <CheckIcon />
                <span>
                  <b>Ya entregada.</b> Escaneala de nuevo sólo si necesitás
                  revertir la entrega.
                </span>
                <button
                  type="button"
                  className={s.lnk}
                  onClick={() => void revertir()}
                  disabled={guardando}
                >
                  Revertir entrega
                </button>
              </div>
            ) : enProduccion.length > 0 ? (
              <div className={`${s.note} ${s.warn}`}>
                <TriangleAlertIcon />
                <span>
                  <b>
                    {enProduccion.length} producto
                    {enProduccion.length === 1 ? "" : "s"} sin terminar.
                  </b>{" "}
                  Se entrega lo que está listo; el resto queda pendiente y la
                  orden no se cierra.
                </span>
              </div>
            ) : yaEntregados.length > 0 ? (
              <div className={`${s.note} ${s.info}`}>
                <InfoIcon />
                <span>
                  {yaEntregados.length} producto
                  {yaEntregados.length === 1 ? " ya se retiró" : "s ya se retiraron"}
                  . Queda{pendientes.length === 1 ? "" : "n"} {pendientes.length}{" "}
                  por entregar.
                </span>
              </div>
            ) : null}

            <div className={s.mb}>
              <section className={s.colItems}>
                <div className={s.ih}>
                  <span className={s.t}>
                    {listos.length} de {pendientes.length} listos para entregar
                    {elegidos.length > 0
                      ? ` · ${elegidos.length} seleccionado${elegidos.length === 1 ? "" : "s"}`
                      : ""}
                  </span>
                  <div className={s.spacer} />
                  {!todoEntregado && elegidos.length < listos.length ? (
                    <button
                      type="button"
                      className={s.lnk}
                      onClick={() =>
                        setSel(
                          Object.fromEntries(listos.map((i) => [i.id, true])),
                        )
                      }
                    >
                      Seleccionar todos los listos
                    </button>
                  ) : null}
                </div>

                <div className={s.items}>
                  {items.map((item) => {
                    const entregado = Boolean(item.entregadoEl);
                    const on = Boolean(sel[item.id]) && !entregado;
                    const bloqueado = !item.listo || entregado;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={`${s.it}${on ? ` ${s.on}` : ""}${
                          bloqueado ? ` ${s.lock}` : ""
                        }${entregado ? ` ${s.entregado}` : ""}`}
                        onClick={() => toggle(item)}
                        disabled={bloqueado}
                      >
                        <span className={s.bx}>
                          <CheckIcon />
                        </span>
                        <span
                          className={s.av}
                          style={{ background: colorDe(item.nombre) }}
                        >
                          {iniciales(item.nombre)}
                        </span>
                        <span className={s.nm}>
                          <span className={s.a}>{item.nombre}</span>
                          <span className={s.b}>
                            {item.cantidad.toLocaleString("es-AR")}{" "}
                            {item.cantidadUnidad}
                            {item.detalle ? ` · ${item.detalle}` : ""}
                          </span>
                        </span>
                        {entregado ? (
                          <span className={s.stk}>
                            <span className={`${s.st} ${s.ok}`}>Entregado</span>
                            {item.retiradoPorNombre ? (
                              <span className={s.eta}>
                                retiró {item.retiradoPorNombre}
                              </span>
                            ) : null}
                          </span>
                        ) : !item.listo ? (
                          <span className={s.stk}>
                            <span className={s.st}>
                              En producción
                              {item.pasoActual ? ` · ${item.pasoActual}` : ""}
                            </span>
                            <span className={s.eta}>
                              {item.pasosHechos} de {item.pasosTotal} pasos
                            </span>
                          </span>
                        ) : null}
                        <span className={s.pz}>{fmt(item.total)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <aside className={s.colMoney}>
                <div className={s.money}>
                  <div className={s.r}>
                    <span>Total de la orden</span>
                    <span className={s.v}>{fmt(orden.total)}</span>
                  </div>
                  <div className={s.r}>
                    <span>Pagado</span>
                    <span className={s.v}>
                      {orden.cobrado > 0 ? `− ${fmt(orden.cobrado)}` : "—"}
                    </span>
                  </div>
                  <div className={s.hr} />
                  <div className={`${s.big} ${saldo > 0 ? s.due : s.clear}`}>
                    <span className={s.k}>
                      {saldo > 0 ? "Saldo a cobrar" : "Sin saldo"}
                    </span>
                    <span className={s.v}>{fmt(saldo)}</span>
                  </div>
                </div>

                {saldo <= 0 ? (
                  <div className={s.paid}>
                    <CheckIcon />
                    Orden paga en su totalidad
                  </div>
                ) : !todoEntregado ? (
                  <div className={s.payBox}>
                    <div className={s.h}>Cobrar ahora</div>
                    {metodos.length === 0 ? (
                      <div className={s.f}>
                        <span className={s.k}>
                          No hay métodos de pago configurados. Se puede
                          entregar igual y cobrar después.
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className={s.f}>
                          <span className={s.k}>Medio</span>
                          <select
                            value={medioId}
                            onChange={(e) => setMedioId(e.target.value)}
                            style={{
                              height: 34,
                              padding: "0 9px",
                              border: "1px solid var(--border)",
                              borderRadius: 7,
                              background: "var(--surface)",
                              color: "var(--ink)",
                              font: "inherit",
                              fontSize: 13,
                            }}
                          >
                            <option value="">Sin cobrar ahora</option>
                            {metodos.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                        {medioId ? (
                          <div className={s.f} style={{ marginTop: 8 }}>
                            <span className={s.k}>Monto</span>
                            <input
                              value={monto}
                              inputMode="decimal"
                              onChange={(e) => setMonto(e.target.value)}
                            />
                            {montoNum > 0 && montoNum < saldo ? (
                              <span className={s.k} style={{ color: "#9a6a11" }}>
                                Queda un saldo de {fmt(saldo - montoNum)}.
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}

                {!todoEntregado ? (
                  <div className={s.opts}>
                    <button
                      type="button"
                      className={s.sw2}
                      aria-pressed={tercero}
                      onClick={() => setTercero((v) => !v)}
                    >
                      <span className={s.tr} />
                      <span>
                        <span className={s.t}>Retira otra persona</span>
                        <span className={s.d}>
                          Queda registrado quién se llevó el trabajo.
                        </span>
                      </span>
                    </button>
                    {tercero ? (
                      <div className={s.subf}>
                        <div className={s.f}>
                          <span className={s.k}>Nombre completo</span>
                          <input
                            value={tNombre}
                            onChange={(e) => setTNombre(e.target.value)}
                            placeholder="Como figura en el documento"
                          />
                        </div>
                        <div className={s.f}>
                          <span className={s.k}>DNI</span>
                          <input
                            value={tDni}
                            inputMode="numeric"
                            onChange={(e) => setTDni(e.target.value)}
                            placeholder="—"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </aside>
            </div>
          </>
        ) : null}

        <footer className={s.mf}>
          {orden ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                router.push(`/produccion/ordenes/${orden.id}`);
                onClose();
              }}
            >
              Ver orden completa
            </button>
          ) : null}
          <div className={s.spacer} />
          <span className={s.keys}>
            <kbd>Esc</kbd> cerrar
          </span>
          <button
            type="button"
            className={s.go}
            disabled={todoEntregado ? guardando : !puedeConfirmar}
            onClick={() => (todoEntregado ? onClose() : void confirmar())}
          >
            {guardando ? "Guardando…" : labelAccion}
          </button>
        </footer>
      </div>
    </div>
  );
}
