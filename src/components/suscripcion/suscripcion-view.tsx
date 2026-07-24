"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Paddle } from "@paddle/paddle-js";

import {
  getSuscripcion,
  type EstadoSuscripcion,
  type PlanContratable,
} from "@/lib/suscripcion-api";

/**
 * La suscripción del tenant: qué plan tiene y a cuál puede pasarse.
 *
 * El cobro lo hace Paddle (Merchant of Record): el checkout se abre sobre esta
 * misma página y Paddle emite el comprobante. Nosotros nunca vemos los datos
 * de la tarjeta.
 *
 * Detalle que define la UX de acá: cuando el checkout termina, la suscripción
 * NO está actualizada todavía — la crea el webhook, que llega unos segundos
 * después. Por eso al cerrar el checkout se entra en un estado de "confirmando"
 * que consulta al backend hasta ver el cambio, en vez de mentirle al usuario
 * mostrándole un plan que el sistema todavía no tiene.
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

function detallesDe(features: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [clave, etiqueta] of Object.entries(ETIQUETA_FEATURE)) {
    if (features[clave] === true) out.push(etiqueta);
  }
  const usuarios = features.usuariosMax;
  out.push(
    typeof usuarios === "number" ? `Hasta ${usuarios} usuarios` : "Usuarios ilimitados",
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

export function SuscripcionView({ inicial }: { inicial: EstadoSuscripcion }) {
  const [datos, setDatos] = React.useState(inicial);
  const [paddle, setPaddle] = React.useState<Paddle | null>(null);
  const [confirmando, setConfirmando] = React.useState(false);
  const [abriendo, setAbriendo] = React.useState<string | null>(null);
  const [errorPaddle, setErrorPaddle] = React.useState<string | null>(null);

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const entorno =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "production" : "sandbox";

  // Espera a que el webhook aterrice. Consulta cada 2s hasta ~40s; si no
  // llega, no se rompe nada: el pago ya está hecho y el webhook puede
  // reintentar, así que se avisa y se deja recargar.
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
    // Carga DIFERIDA: el SDK no entra en el chunk inicial de la página. Si
    // se importa arriba y su evaluación falla, se cae la hidratación de toda
    // la vista y los botones quedan muertos sin ningún error visible.
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
      // Sin esto el fallo es MUDO: el botón queda inerte para siempre y no hay
      // forma de saber por qué. Pasó en desarrollo y costó encontrarlo.
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
    // Se inicializa una sola vez: recrear la instancia rompería el callback.
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
      // El tenantId sale de la sesión (lo puso el backend): es lo que el
      // webhook usa para saber a qué imprenta corresponde el pago.
      customData: { tenantId: datos.checkout.tenantId },
      customer: { email: datos.checkout.email },
      settings: { displayMode: "overlay", theme: "light" },
    });
    setTimeout(() => setAbriendo(null), 1500);
  };

  const actual = datos.actual;
  const enMora = actual?.estadoProveedor === "past_due";

  if (!token) {
    return (
      <main className="sus-wrap">
        <Encabezado />
        <div className="sus-aviso">
          El cobro por suscripción todavía no está configurado en este entorno.
        </div>
      </main>
    );
  }

  return (
    <main className="sus-wrap">
      <Encabezado />

      {errorPaddle ? (
        <div className="sus-mora">
          <b>No se pudo cargar el checkout.</b> {errorPaddle} — recargá la
          página; si sigue, avisanos.
        </div>
      ) : null}

      {enMora ? (
        <div className="sus-mora">
          <b>No pudimos cobrar tu último pago.</b> Tu cuenta sigue activa, pero
          revisá el medio de pago para no perder el servicio.
        </div>
      ) : null}

      {actual ? (
        <section className="sus-actual">
          <div className="sus-actual-info">
            <div className="eyebrow">Tu plan</div>
            <h2>{actual.planNombre}</h2>
            <div className="sus-actual-meta">
              {precio(actual.precioMensual, actual.moneda)} por mes
              {actual.proximoCobro ? (
                <>
                  {" · "}próximo cobro{" "}
                  {new Date(actual.proximoCobro).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </>
              ) : null}
            </div>
          </div>
          <span className={`sus-estado ${actual.estado}`}>
            {actual.estado === "activa"
              ? "Activa"
              : actual.estado === "suspendida"
                ? "Suspendida"
                : "Dada de baja"}
          </span>
        </section>
      ) : (
        <div className="sus-aviso">
          Todavía no tenés un plan contratado. Elegí uno para empezar.
        </div>
      )}

      {confirmando ? (
        <div className="sus-confirmando">
          <span className="sus-spin" aria-hidden="true" />
          Confirmando el pago con Paddle…
        </div>
      ) : null}

      <h3 className="sus-tit">{actual ? "Cambiar de plan" : "Planes"}</h3>
      <div className="sus-planes">
        {datos.planes.map((plan) => (
          <article
            key={plan.codigo}
            className={`sus-plan ${plan.esActual ? "actual" : ""}`}
          >
            <div className="sus-plan-nom">{plan.nombre}</div>
            <div className="sus-plan-precio">
              {precio(plan.precioMensual, plan.moneda)}
              <span>/mes</span>
            </div>
            <ul className="sus-plan-feats">
              {detallesDe(plan.features).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            {plan.esActual ? (
              <div className="sus-plan-actual">Tu plan actual</div>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => contratar(plan)}
                disabled={confirmando || abriendo === plan.codigo}
              >
                {abriendo === plan.codigo
                  ? "Abriendo…"
                  : actual
                    ? "Cambiar a este plan"
                    : "Contratar"}
              </button>
            )}
          </article>
        ))}
      </div>

      <p className="sus-pie">
        Los pagos los procesa <b>Paddle</b>, que emite el comprobante
        correspondiente. Grafo no almacena los datos de tu tarjeta.
      </p>
    </main>
  );
}

function Encabezado() {
  return (
    <header className="sus-head">
      <div className="eyebrow">Configuración</div>
      <h1>Suscripción</h1>
    </header>
  );
}
