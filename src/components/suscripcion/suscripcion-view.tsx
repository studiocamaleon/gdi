"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Paddle } from "@paddle/paddle-js";

import {
  abrirPortalSuscripcion,
  getSuscripcion,
  type EstadoSuscripcion,
  type PlanContratable,
} from "@/lib/suscripcion-api";

/**
 * Administrar suscripción — port del diseño `suscripcion.jsx` de Grafoprint
 * (claude.ai/design), cableado a datos reales.
 *
 * Qué se portó y qué NO, y por qué. El diseño se dibujó antes de decidir la
 * pasarela, así que mostraba cosas que hoy no existen; se dejaron afuera en vez
 * de rellenarlas con datos inventados:
 *  - Contador de prueba ("14 de 30 días"): el modelo no tiene vencimiento de
 *    trial. Se muestra el estado real y nada más.
 *  - Toggle Mensual/Anual: en Paddle sólo hay precios mensuales. Vuelve solo
 *    en cuanto se creen los anuales (un segundo priceId por plan).
 *  - Toggle Argentina/Internacional (Mercado Pago vs Paddle): MP todavía no
 *    está implementado — es F5. Hoy la pasarela es una sola.
 *  - Tarjeta "•••• 4509" y datos fiscales editables: esos datos los tiene
 *    Paddle, no nosotros. Se delega en su portal de cliente.
 *
 * El cobro lo hace Paddle (Merchant of Record): emite el comprobante y nosotros
 * nunca vemos los datos de la tarjeta.
 * Ver docs/suscripciones-cobro-diseno.md
 */

const ETIQUETA_FEATURE: Record<string, string> = {
  afip: "Facturación electrónica (ARCA)",
  whatsapp: "Notificaciones por WhatsApp",
};

function precio(monto: number, moneda: string): string {
  const simbolo = moneda === "USD" ? "US$" : "$";
  return `${simbolo}${monto.toLocaleString("es-AR")}`;
}

function fechaLarga(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function detallesDe(features: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [clave, etiqueta] of Object.entries(ETIQUETA_FEATURE)) {
    if (features[clave] === true) out.push(etiqueta);
  }
  const usuarios = features.usuariosMax;
  out.push(
    typeof usuarios === "number"
      ? `Hasta ${usuarios} usuarios`
      : "Usuarios ilimitados",
  );
  const ordenes = features.ordenesMesMax;
  out.push(
    typeof ordenes === "number"
      ? `${ordenes.toLocaleString("es-AR")} órdenes por mes`
      : "Órdenes ilimitadas",
  );
  const storage = features.storageGb;
  if (typeof storage === "number") out.push(`${storage} GB de archivos`);
  return out;
}

const Tick = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
    <path
      d="M5 12l4 4 10-10"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LogoPaddle = ({ s = 26 }: { s?: number }) => (
  <svg viewBox="0 0 32 32" width={s} height={s} aria-label="Paddle">
    <rect width="32" height="32" rx="8" fill="#0a0a0c" />
    <path
      d="M11 22V10h5.4c2.6 0 4.3 1.6 4.3 4s-1.7 4-4.3 4H13.6v0"
      fill="none"
      stroke="#fdd535"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="20.5" cy="21" r="1.6" fill="#fdd535" />
  </svg>
);

export function SuscripcionView({ inicial }: { inicial: EstadoSuscripcion }) {
  const [datos, setDatos] = React.useState(inicial);
  const [paddle, setPaddle] = React.useState<Paddle | null>(null);
  const [confirmando, setConfirmando] = React.useState(false);
  const [abriendo, setAbriendo] = React.useState<string | null>(null);
  const [yendoAlPortal, setYendoAlPortal] = React.useState(false);
  const [errorPaddle, setErrorPaddle] = React.useState<string | null>(null);
  const [elegido, setElegido] = React.useState<string | null>(
    () => inicial.actual?.planCodigo ?? inicial.planes.at(-1)?.codigo ?? null,
  );

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const entorno =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
      ? "production"
      : "sandbox";

  // Espera a que el webhook aterrice: el checkout cierra ANTES de que la
  // suscripción exista de nuestro lado. Consulta cada 2s hasta ~40s.
  const esperarWebhook = React.useCallback(async (planPrevio: string | null) => {
    setConfirmando(true);
    for (let intento = 0; intento < 20; intento += 1) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const fresco = await getSuscripcion();
        if (
          fresco.actual &&
          (fresco.actual.planCodigo !== planPrevio ||
            fresco.actual.proveedor === "paddle")
        ) {
          setDatos(fresco);
          setElegido(fresco.actual.planCodigo);
          setConfirmando(false);
          toast.success(`Tu plan ${fresco.actual.planNombre} está activo.`);
          return;
        }
      } catch {
        // Reintenta en la vuelta siguiente.
      }
    }
    setConfirmando(false);
    toast.info(
      "El pago se registró. La activación puede demorar un momento — recargá la página en unos minutos.",
    );
  }, []);

  React.useEffect(() => {
    if (!token) return;
    let vivo = true;
    // Carga DIFERIDA: el SDK no entra en el chunk inicial de la página.
    void import("@paddle/paddle-js")
      .then(({ initializePaddle }) =>
        initializePaddle({
          environment: entorno,
          token,
          eventCallback: (evento) => {
            if (evento.name === "checkout.completed") {
              void esperarWebhook(datos.actual?.planCodigo ?? null);
            }
          },
        }),
      )
      .then((p) => {
        if (vivo && p) setPaddle(p);
      })
      // Sin esto el fallo es MUDO: el botón queda inerte y nadie sabe por qué.
      .catch((err: unknown) => {
        if (!vivo) return;
        console.error("Paddle.js no se pudo inicializar:", err);
        setErrorPaddle(
          err instanceof Error ? err.message : "No se pudo cargar el checkout.",
        );
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, entorno]);

  const contratar = (plan: PlanContratable) => {
    if (!paddle) {
      toast.error("El checkout todavía se está cargando. Probá en un momento.");
      return;
    }
    setAbriendo(plan.codigo);
    paddle.Checkout.open({
      items: [{ priceId: plan.priceId, quantity: 1 }],
      // El tenantId sale de la SESIÓN (lo puso el backend): es lo que el
      // webhook usa para saber a qué imprenta corresponde el pago.
      customData: { tenantId: datos.checkout.tenantId },
      customer: { email: datos.checkout.email },
      settings: { displayMode: "overlay", theme: "light" },
    });
    setTimeout(() => setAbriendo(null), 1500);
  };

  const irAlPortal = async () => {
    if (yendoAlPortal) return;
    setYendoAlPortal(true);
    try {
      const { url } = await abrirPortalSuscripcion();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo abrir el portal.",
      );
    } finally {
      setYendoAlPortal(false);
    }
  };

  const actual = datos.actual;
  const enMora = actual?.estadoProveedor === "past_due";
  const planElegido =
    datos.planes.find((p) => p.codigo === elegido) ??
    datos.planes.at(-1) ??
    null;

  if (!token) {
    return (
      <div className="sub-page">
        <Cabecera actual={actual} />
        <div className="sub-empty">
          <div className="sub-empty-tt">Cobro no configurado</div>
          <div className="sub-empty-sub">
            La suscripción todavía no está habilitada en este entorno.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sub-page">
      <Cabecera actual={actual} />

      {errorPaddle ? (
        <div className="sub-alert danger">
          <b>No se pudo cargar el checkout.</b> {errorPaddle} — recargá la
          página; si sigue, avisanos.
        </div>
      ) : null}

      {enMora ? (
        <div className="sub-alert warn">
          <b>No pudimos cobrar tu último pago.</b> Tu cuenta sigue activa
          mientras reintentamos, pero revisá el medio de pago para no perder el
          servicio.
        </div>
      ) : null}

      {!actual ? (
        <div className="sub-alert">
          <b>Todavía no tenés un plan contratado.</b> Elegí uno abajo para
          activar tu suscripción.
        </div>
      ) : null}

      {confirmando ? (
        <div className="sub-alert info">
          <span className="sub-spin" aria-hidden="true" />
          Confirmando el pago con Paddle… no cierres esta página.
        </div>
      ) : null}

      <div className="sub-grid">
        {/* ── Columna principal ── */}
        <div className="sub-main">
          <section className="sub-block">
            <div className="sub-block-head">
              <div>
                <h2>Elegí tu plan</h2>
                <p>
                  Cambiá de plan cuando quieras. Paddle ajusta el cobro de forma
                  proporcional al período.
                </p>
              </div>
            </div>

            <div className="sub-plans">
              {datos.planes.map((p, i) => {
                const activo = elegido === p.codigo;
                const destacado = i === datos.planes.length - 1;
                return (
                  <div
                    key={p.codigo}
                    className={`sub-plan ${activo ? "active" : ""} ${destacado ? "hot" : ""}`}
                    onClick={() => setElegido(p.codigo)}
                    role="radio"
                    aria-checked={activo}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setElegido(p.codigo);
                      }
                    }}
                  >
                    <div className="sub-plan-top">
                      <div className="sub-plan-nm">
                        {p.nombre}
                        {destacado ? (
                          <span className="sub-plan-tag">Completo</span>
                        ) : null}
                      </div>
                      <div className={`sub-radio ${activo ? "on" : ""}`}>
                        {activo ? <Tick /> : null}
                      </div>
                    </div>
                    <div className="sub-plan-price">
                      <span className="amt">
                        {precio(p.precioMensual, p.moneda)}
                      </span>
                      <span className="per">/mes</span>
                    </div>
                    <ul className="sub-plan-feats">
                      {detallesDe(p.features).map((f) => (
                        <li key={f}>
                          <span className="tick">
                            <Tick />
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="sub-plan-cta">
                      {p.esActual ? (
                        <span className="sub-current-lbl">Plan actual</span>
                      ) : (
                        <button
                          type="button"
                          className="btn sm w"
                          onClick={(e) => {
                            e.stopPropagation();
                            contratar(p);
                          }}
                          disabled={confirmando || abriendo === p.codigo}
                        >
                          {abriendo === p.codigo
                            ? "Abriendo…"
                            : `Elegir ${p.nombre}`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Facturas ── */}
          <section className="sub-block">
            <div className="sub-block-head">
              <div>
                <h2>Facturas</h2>
                <p>
                  Los comprobantes los emite Paddle en cada cobro. Podés
                  descargarlos desde su portal.
                </p>
              </div>
            </div>

            {datos.facturas.length === 0 ? (
              <div className="sub-empty">
                <div className="sub-empty-tt">Todavía no hay facturas</div>
                <div className="sub-empty-sub">
                  {actual?.proximoCobro
                    ? `Tu próximo cobro es el ${fechaLarga(actual.proximoCobro)}.`
                    : "Aparecerán acá en cuanto se registre el primer cobro."}
                </div>
              </div>
            ) : (
              <div className="sub-inv-table">
                <div className="sub-inv-row head">
                  <span>Factura</span>
                  <span>Fecha</span>
                  <span>Estado</span>
                  <span className="right">Importe</span>
                </div>
                {datos.facturas.map((f) => (
                  <div key={f.id} className="sub-inv-row">
                    <span className="mono">
                      {f.numero ?? f.id.slice(0, 14)}
                    </span>
                    <span>{fechaLarga(f.fecha)}</span>
                    <span>
                      <em
                        className={`sub-chip ${f.estado === "completed" ? "ok" : ""}`}
                      >
                        {f.estado === "completed" ? "Pagada" : f.estado}
                      </em>
                    </span>
                    <span className="mono right">
                      {precio(f.total, f.moneda)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Aside ── */}
        <aside className="sub-aside">
          <div className="sub-card">
            <div className="sub-card-h">Resumen</div>
            <div className="sub-summary">
              <div className="sub-sum-row">
                <span>Plan</span>
                <strong>
                  {actual?.planNombre ?? planElegido?.nombre ?? "—"}
                </strong>
              </div>
              <div className="sub-sum-row">
                <span>Ciclo</span>
                <strong>Mensual</strong>
              </div>
              <div className="sub-sum-row">
                <span>Precio</span>
                <strong>
                  {actual
                    ? precio(actual.precioMensual, actual.moneda)
                    : planElegido
                      ? precio(planElegido.precioMensual, planElegido.moneda)
                      : "—"}
                  <em>/mes</em>
                </strong>
              </div>
              <div className="sub-sum-div" />
              <div className="sub-sum-row big">
                <span>{actual ? "Próximo cobro" : "Primer cobro"}</span>
                <strong>
                  {actual
                    ? precio(actual.precioMensual, actual.moneda)
                    : planElegido
                      ? precio(planElegido.precioMensual, planElegido.moneda)
                      : "—"}
                </strong>
              </div>
              <div className="sub-sum-row muted">
                <span>Fecha</span>
                <span>
                  {actual?.proximoCobro
                    ? fechaLarga(actual.proximoCobro)
                    : "al activar"}
                </span>
              </div>
            </div>
            {!actual && planElegido ? (
              <button
                type="button"
                className="btn-primary w"
                onClick={() => contratar(planElegido)}
                disabled={confirmando}
              >
                Activar suscripción
              </button>
            ) : null}
            <div className="sub-card-foot">
              Se cobra automáticamente cada mes. Cancelás cuando quieras.
            </div>
          </div>

          {/* Método de pago */}
          <div className="sub-card">
            <div className="sub-card-h">Método de pago</div>
            <div className="sub-pay">
              <div className="sub-pay-head">
                <LogoPaddle />
                <div className="sub-pay-tt">
                  <div className="nm">Paddle</div>
                  <div className="sub">Merchant of record · USD</div>
                </div>
                <span className={`sub-chip ${datos.puedePortal ? "ok" : ""}`}>
                  {datos.puedePortal ? "Conectado" : "Sin activar"}
                </span>
              </div>
              <div className="sub-pay-empty">
                Paddle procesa el pago, calcula los impuestos del país de tu
                empresa y emite la factura.
              </div>
              {datos.puedePortal ? (
                <button
                  type="button"
                  className="btn sm w"
                  onClick={irAlPortal}
                  disabled={yendoAlPortal}
                >
                  {yendoAlPortal ? "Abriendo…" : "Cambiar medio de pago"}
                </button>
              ) : null}
            </div>
          </div>

          {/* Gestión */}
          {datos.puedePortal ? (
            <div className="sub-card ghost">
              <button
                type="button"
                className="sub-manage"
                onClick={irAlPortal}
                disabled={yendoAlPortal}
              >
                Ver facturas y datos de facturación
              </button>
              <button
                type="button"
                className="sub-manage danger"
                onClick={irAlPortal}
                disabled={yendoAlPortal}
              >
                Cancelar suscripción
              </button>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Cabecera({ actual }: { actual: EstadoSuscripcion["actual"] }) {
  const etiqueta =
    actual?.estado === "activa"
      ? actual.estadoProveedor === "past_due"
        ? "Pago pendiente"
        : "Activa"
      : actual?.estado === "suspendida"
        ? "Suspendida"
        : actual
          ? "Dada de baja"
          : "Sin plan";
  const tono =
    actual?.estadoProveedor === "past_due"
      ? "warn"
      : actual?.estado === "activa"
        ? "ok"
        : "";
  return (
    <div className="page-head">
      <div className="title-block">
        <h1>Administrar suscripción</h1>
        <p className="sub-subhead">
          Plan, facturación y método de pago de tu empresa.
        </p>
      </div>
      <div className={`sub-state-pill ${tono}`}>
        <span className="dot" /> {etiqueta}
      </div>
    </div>
  );
}
