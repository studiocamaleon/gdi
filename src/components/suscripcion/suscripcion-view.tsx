"use client";

import * as React from "react";
import { toast } from "sonner";
import { useFecha } from "@/components/navigation/config-regional-provider";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import type { Paddle } from "@paddle/paddle-js";

import {
  abrirPortalSuscripcion,
  cambiarPlanSuscripcion,
  getSuscripcion,
  previsualizarCambio,
  reactivarSuscripcion,
  urlFacturaPdf,
  sincronizarSuscripcion,
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
 *  - Toggle Argentina/Internacional (Mercado Pago vs Paddle): MP todavía no
 *    está implementado — es F5. Hoy la pasarela es una sola.
 *  - Tarjeta "•••• 4509" y datos fiscales editables: esos datos los tiene
 *    Paddle, no nosotros. Se delega en su portal de cliente.
 *
 * El banner de prueba y el toggle Mensual/Anual SÍ están: los días salen
 * calculados de `trialHasta` (nunca guardados) y el ahorro anual lo calcula el
 * backend contra doce meses sueltos.
 *
 * El cobro lo hace Paddle (Merchant of Record): emite el comprobante y nosotros
 * nunca vemos los datos de la tarjeta.
 * Ver docs/suscripciones-cobro-diseno.md
 */

/**
 * Estados de una transacción de Paddle, en castellano.
 *
 * `billed` y `ready` son PROVISORIOS: Paddle crea la transacción al instante
 * pero el cobro se concreta unos segundos después. Mostrar "Billed" en inglés
 * y dejarlo ahí para siempre era doblemente malo — jerga del proveedor, y una
 * foto vieja que sólo se corregía recargando la página.
 */
const ESTADO_FACTURA: Record<string, { texto: string; tono: string }> = {
  completed: { texto: "Pagada", tono: "ok" },
  paid: { texto: "Pagada", tono: "ok" },
  billed: { texto: "Procesando", tono: "" },
  ready: { texto: "Procesando", tono: "" },
  past_due: { texto: "Vencida", tono: "warn" },
  canceled: { texto: "Anulada", tono: "" },
  draft: { texto: "Borrador", tono: "" },
};
const PROVISORIOS = new Set(["billed", "ready", "draft"]);

const NOMBRE_MARCA: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  american_express: "American Express",
  discover: "Discover",
  diners_club: "Diners Club",
  jcb: "JCB",
  union_pay: "UnionPay",
  maestro: "Maestro",
  elo: "Elo",
  hipercard: "Hipercard",
  mada: "mada",
};

/**
 * Marca de la tarjeta. Se dibujan versiones simples y reconocibles —no
 * reproducciones de los logos registrados— que es lo que se estila en las
 * interfaces de pago. La que no se reconoce cae a un ícono de tarjeta genérico.
 */
function LogoTarjeta({ marca }: { marca: string }) {
  const comun = { viewBox: "0 0 40 26", width: 40, height: 26 } as const;
  const fondo = (
    <rect width="40" height="26" rx="4" fill="#fff" stroke="#e7e5e2" />
  );
  if (marca === "visa") {
    return (
      <svg {...comun} aria-label="Visa">
        {fondo}
        <text
          x="20"
          y="17.5"
          textAnchor="middle"
          fontSize="10.5"
          fontWeight="700"
          fontStyle="italic"
          fontFamily="Georgia, serif"
          fill="#1434CB"
          letterSpacing="0.5"
        >
          VISA
        </text>
      </svg>
    );
  }
  if (marca === "mastercard" || marca === "maestro") {
    return (
      <svg {...comun} aria-label="Mastercard">
        {fondo}
        <circle cx="16" cy="13" r="7" fill="#EB001B" />
        <circle cx="24" cy="13" r="7" fill="#F79E1B" opacity="0.9" />
        <path
          d="M20 7.9a7 7 0 000 10.2 7 7 0 000-10.2z"
          fill="#FF5F00"
        />
      </svg>
    );
  }
  if (marca === "american_express") {
    return (
      <svg {...comun} aria-label="American Express">
        <rect width="40" height="26" rx="4" fill="#006FCF" />
        <text
          x="20"
          y="16.5"
          textAnchor="middle"
          fontSize="7.5"
          fontWeight="700"
          fontFamily="Helvetica, Arial, sans-serif"
          fill="#fff"
          letterSpacing="0.4"
        >
          AMEX
        </text>
      </svg>
    );
  }
  return (
    <svg {...comun} aria-label={NOMBRE_MARCA[marca] ?? "Tarjeta"}>
      {fondo}
      <rect x="4" y="9" width="32" height="3" fill="#d4d2cd" />
      <rect x="4" y="16" width="12" height="2.5" rx="1.2" fill="#e7e5e2" />
    </svg>
  );
}

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

const IcoDescarga = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
      stroke="currentColor"
      strokeWidth="2"
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
  const { fechaCorta } = useFecha();
  const fechaLarga = (iso: string | null) => (iso ? fechaCorta(iso) : "—");
  const [datos, setDatos] = React.useState(inicial);
  const [paddle, setPaddle] = React.useState<Paddle | null>(null);
  const [confirmando, setConfirmando] = React.useState(false);
  const [abriendo, setAbriendo] = React.useState<string | null>(null);
  const [yendoAlPortal, setYendoAlPortal] = React.useState(false);
  const [errorPaddle, setErrorPaddle] = React.useState<string | null>(null);
  const [confirmarCambio, setConfirmarCambio] =
    React.useState<PlanContratable | null>(null);
  const [previo, setPrevio] = React.useState<{
    aCobrar: number;
    aCredito: number;
    moneda: string;
  } | null>(null);
  const [cargandoPrevio, setCargandoPrevio] = React.useState(false);
  const [reactivando, setReactivando] = React.useState(false);
  const [bajando, setBajando] = React.useState<string | null>(null);
  const [ciclo, setCiclo] = React.useState<"mensual" | "anual">("mensual");
  const [elegido, setElegido] = React.useState<string | null>(
    () => inicial.actual?.planCodigo ?? inicial.planes.at(-1)?.codigo ?? null,
  );

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const entorno =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
      ? "production"
      : "sandbox";

  /**
   * Cierra el checkout → vamos a BUSCAR el resultado a la pasarela.
   *
   * Antes esto esperaba a que llegara el webhook, consultando cada 2s hasta 40.
   * Estaba mal por dos motivos: el usuario acaba de pagar y quedaba mirando una
   * pantalla de espera sin saber si salió bien, y si el webhook fallaba (o
   * tardaba) no se enteraba nunca. Ahora se resuelve en una llamada: leemos la
   * transacción en Paddle y aplicamos el resultado. El webhook sigue existiendo
   * como respaldo —es idempotente— para lo que pasa sin nadie mirando.
   */
  const traerResultado = React.useCallback(async (transaccionId?: string) => {
    setConfirmando(true);
    try {
      const fresco = transaccionId
        ? await sincronizarSuscripcion(transaccionId)
        : await getSuscripcion();
      setDatos(fresco);
      if (fresco.actual) setElegido(fresco.actual.planCodigo);
      toast.success(
        fresco.actual
          ? `Tu plan ${fresco.actual.planNombre} está activo.`
          : "Pago registrado.",
      );
      if (fresco.facturas.some((f) => PROVISORIOS.has(f.estado))) {
        seguirFacturasProvisorias();
      }
    } catch {
      // Si la lectura falla, el pago igual se hizo y el webhook lo va a
      // aplicar: se lo decimos en vez de dejarlo con una pantalla colgada.
      toast.info(
        "El pago se registró. Si no ves el cambio en un minuto, recargá la página.",
      );
    } finally {
      setConfirmando(false);
    }
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
              // El id de la transacción viene en el evento: con eso resolvemos
              // la suscripción en Paddle sin depender del webhook.
              const tx = (evento.data as { transaction_id?: string } | undefined)
                ?.transaction_id;
              void traerResultado(tx);
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

  /**
   * Dos caminos, y la diferencia importa: si el tenant YA tiene suscripción en
   * la pasarela, cambiar de plan NO abre checkout — se modifica la existente
   * con prorrateo y la tarjeta en archivo. Abrir un checkout le crearía una
   * SEGUNDA suscripción y le cobrarían las dos.
   */
  const elegirPlan = (plan: PlanContratable) => {
    if (datos.puedeCambiarSinPago) {
      setConfirmarCambio(plan);
      setPrevio(null);
      setCargandoPrevio(true);
      previsualizarCambio(plan.codigo, ciclo)
        .then((p) => setPrevio(p))
        .catch(() => setPrevio(null))
        .finally(() => setCargandoPrevio(false));
      return;
    }
    contratar(plan);
  };

  const aplicarCambio = async () => {
    if (!confirmarCambio || confirmando) return;
    const plan = confirmarCambio;
    setConfirmarCambio(null);
    setConfirmando(true);
    try {
      const fresco = await cambiarPlanSuscripcion(plan.codigo, ciclo);
      setDatos(fresco);
      if (fresco.actual) setElegido(fresco.actual.planCodigo);
      toast.success(`Tu plan ${plan.nombre} está activo.`);
      // El cobro del ajuste tarda unos segundos en confirmarse: se sigue solo.
      if (fresco.facturas.some((f) => PROVISORIOS.has(f.estado))) {
        seguirFacturasProvisorias();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo cambiar el plan.",
      );
    } finally {
      setConfirmando(false);
    }
  };

  const contratar = (plan: PlanContratable) => {
    if (!paddle) {
      toast.error("El checkout todavía se está cargando. Probá en un momento.");
      return;
    }
    setAbriendo(plan.codigo);
    // El ciclo define QUÉ precio de Paddle se cobra: son dos precios distintos
    // del mismo plan, no un descuento aplicado sobre el mensual.
    const priceId =
      ciclo === "anual" && plan.anual ? plan.anual.priceId : plan.priceId;
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      // El tenantId sale de la SESIÓN (lo puso el backend): es lo que el
      // webhook usa para saber a qué imprenta corresponde el pago.
      customData: { tenantId: datos.checkout.tenantId },
      customer: { email: datos.checkout.email },
      settings: { displayMode: "overlay", theme: "light" },
    });
    setTimeout(() => setAbriendo(null), 1500);
  };

  const reactivar = async () => {
    if (reactivando) return;
    setReactivando(true);
    try {
      setDatos(await reactivarSuscripcion());
      toast.success("Tu suscripción sigue activa. No se va a cancelar.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo reactivar.",
      );
    } finally {
      setReactivando(false);
    }
  };

  const descargarFactura = async (id: string) => {
    if (bajando) return;
    setBajando(id);
    try {
      const { url } = await urlFacturaPdf(id);
      // La URL de Paddle es firmada y temporal: se abre en el momento, no se
      // guarda ni se cachea.
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("No se pudo abrir la factura. Probá desde el portal.");
    } finally {
      setBajando(null);
    }
  };

  /**
   * Refresca mientras haya facturas en estado provisorio.
   *
   * Paddle crea la transacción al instante en `billed` y la cobra unos
   * segundos después. Sin esto, el cliente ve "Procesando" hasta que recarga
   * la página a mano. Se reintenta poco y con corte: es un ajuste cosmético,
   * no puede quedar consultando para siempre.
   */
  const seguirFacturasProvisorias = React.useCallback(() => {
    let intentos = 0;
    const tick = async () => {
      intentos += 1;
      await new Promise((r) => setTimeout(r, intentos === 1 ? 3000 : 6000));
      try {
        const fresco = await getSuscripcion();
        setDatos(fresco);
        const sigue = fresco.facturas.some((f) => PROVISORIOS.has(f.estado));
        if (sigue && intentos < 3) void tick();
      } catch {
        // Si falla, queda lo que ya se ve: recargar lo resuelve.
      }
    };
    void tick();
  }, []);

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
  // Paddle deja la suscripción en `active` con un cambio programado hasta el
  // fin del período: sin esto la pantalla diría "Activa" y el cliente no
  // sabría que se termina.
  const cancelaEl =
    actual?.cambioProgramado === "cancel" ? actual.cambioProgramadoEl : null;
  const planElegido =
    datos.planes.find((p) => p.codigo === elegido) ??
    datos.planes.at(-1) ??
    null;
  // El toggle sólo aparece si hay al menos un plan con precio anual cargado.
  const hayAnual = datos.planes.some((p) => p.anual !== null);
  const ahorroMaxPct = Math.max(
    0,
    ...datos.planes.map((p) => p.anual?.ahorroPct ?? 0),
  );
  const anualActivo = ciclo === "anual";

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

      {cancelaEl ? (
        <div className="sub-alert warn sub-alert-accion">
          <div>
            <b>Tu suscripción termina el {fechaLarga(cancelaEl)}.</b> Hasta esa
            fecha seguís con todo lo de tu plan. Después no se renueva y no se
            te cobra más.
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={reactivar}
            disabled={reactivando}
          >
            {reactivando ? "Reactivando…" : "Reactivar suscripción"}
          </button>
        </div>
      ) : null}

      {enMora ? (
        <div className="sub-alert warn">
          <b>No pudimos cobrar tu último pago.</b> Tu cuenta sigue activa
          mientras reintentamos, pero revisá el medio de pago para no perder el
          servicio.
        </div>
      ) : null}

      {datos.prueba.enPrueba && actual ? (
        <div className="sub-trial">
          <div className="sub-trial-info">
            <div className="sub-trial-badge">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
                <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M12 3v18M4 7.5l8 4.5 8-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="sub-trial-title">
                Estás probando el <strong>plan {actual.planNombre}</strong>
              </div>
              <div className="sub-trial-sub">
                {datos.prueba.diasRestantes === 1
                  ? "Te queda 1 día"
                  : `Te quedan ${datos.prueba.diasRestantes} días`}
                {" · tu prueba finaliza el "}
                <strong>{fechaLarga(datos.prueba.hasta)}</strong>. Activá antes
                para no perder acceso.
              </div>
            </div>
          </div>
          <div className="sub-trial-cta">
            <button
              type="button"
              className="btn-primary"
              onClick={() => planElegido && contratar(planElegido)}
              disabled={confirmando || !planElegido}
            >
              Activar suscripción
            </button>
            <span className="sub-trial-note">
              Sin cargo hasta el {fechaLarga(datos.prueba.hasta)}
            </span>
          </div>
        </div>
      ) : null}

      {datos.prueba.vencida && actual?.estado !== "activa" ? (
        <div className="sub-alert warn">
          <b>Tu prueba terminó.</b> Podés seguir entrando y viendo todo lo que
          cargaste, pero algunas funciones quedaron en pausa. Elegí un plan para
          reactivarlas.
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

      {confirmarCambio ? (
        <ConfirmacionDestructiva
          open
          onOpenChange={(o) => {
            if (!o) setConfirmarCambio(null);
          }}
          titulo={`Cambiar al plan ${confirmarCambio.nombre}`}
          nombreItem={confirmarCambio.nombre}
          requiereTipear={false}
          accionLabel="Confirmar cambio"
          descripcion={
            cargandoPrevio
              ? "Calculando el ajuste con Paddle…"
              : "Se usa la tarjeta que ya tenés registrada. No hace falta cargarla de nuevo."
          }
          impacto={[
            ciclo === "anual" && confirmarCambio.anual
              ? `Nuevo precio: ${precio(confirmarCambio.anual.precio, confirmarCambio.moneda)} al año`
              : `Nuevo precio: ${precio(confirmarCambio.precioMensual, confirmarCambio.moneda)} por mes`,
            previo
              ? previo.aCobrar > 0
                ? `Se te cobra ahora ${precio(previo.aCobrar, previo.moneda)} por lo que resta del período`
                : previo.aCredito > 0
                  ? `Te queda ${precio(previo.aCredito, previo.moneda)} a favor, que se descuenta solo de tus próximos cobros`
                  : "Sin cargo ahora"
              : cargandoPrevio
                ? "Calculando el ajuste…"
                : "Paddle ajusta el cobro de forma proporcional al período en curso",
            "El cambio es inmediato",
          ]}
          onConfirmar={aplicarCambio}
        />
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
              {hayAnual ? (
                <div className="sub-seg" role="tablist">
                  <button
                    type="button"
                    className={`sub-seg-btn ${ciclo === "mensual" ? "active" : ""}`}
                    onClick={() => setCiclo("mensual")}
                  >
                    Mensual
                  </button>
                  <button
                    type="button"
                    className={`sub-seg-btn ${ciclo === "anual" ? "active" : ""}`}
                    onClick={() => setCiclo("anual")}
                  >
                    Anual
                    {ahorroMaxPct > 0 ? (
                      <span className="sub-seg-note">−{ahorroMaxPct}%</span>
                    ) : null}
                  </button>
                </div>
              ) : null}
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
                          <span className="sub-plan-tag">Recomendado</span>
                        ) : null}
                      </div>
                      <div className={`sub-radio ${activo ? "on" : ""}`}>
                        {activo ? <Tick /> : null}
                      </div>
                    </div>
                    <div className="sub-plan-price">
                      <span className="amt">
                        {precio(
                          anualActivo && p.anual
                            ? p.anual.equivalenteMensual
                            : p.precioMensual,
                          p.moneda,
                        )}
                      </span>
                      <span className="per">/mes</span>
                    </div>
                    {anualActivo && p.anual ? (
                      <div className="sub-plan-billed">
                        {precio(p.anual.precio, p.moneda)} al año ·{" "}
                        <b>ahorrás {precio(p.anual.ahorro, p.moneda)}</b> frente
                        a {precio(p.anual.doceMeses, p.moneda)} pagando mes a
                        mes
                      </div>
                    ) : null}
                    {p.descripcion ? (
                      <p className="sub-plan-tagline">{p.descripcion}</p>
                    ) : null}
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
                            elegirPlan(p);
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
                  <span />
                </div>
                {datos.facturas.map((f) => (
                  <div key={f.id} className="sub-inv-row">
                    <span className="mono">
                      {f.numero ?? f.id.slice(0, 14)}
                    </span>
                    <span>{fechaLarga(f.fecha)}</span>
                    <span>
                      <em
                        className={`sub-chip ${ESTADO_FACTURA[f.estado]?.tono ?? ""}`}
                      >
                        {ESTADO_FACTURA[f.estado]?.texto ?? f.estado}
                      </em>
                    </span>
                    <span className="mono right">
                      {precio(f.total, f.moneda)}
                    </span>
                    <span className="right">
                      <button
                        type="button"
                        className="sub-inv-pdf"
                        onClick={() => descargarFactura(f.id)}
                        disabled={bajando === f.id}
                        title="Descargar el PDF"
                      >
                        {bajando === f.id ? (
                          "…"
                        ) : (
                          <>
                            <IcoDescarga />
                            PDF
                          </>
                        )}
                      </button>
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
                <strong>{anualActivo ? "Anual" : "Mensual"}</strong>
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
                <span>
                  {cancelaEl
                    ? "Termina el"
                    : actual
                      ? "Próximo cobro"
                      : "Primer cobro"}
                </span>
                <strong>
                  {cancelaEl
                    ? fechaLarga(cancelaEl)
                    : actual
                      ? precio(actual.precioMensual, actual.moneda)
                      : planElegido
                        ? precio(planElegido.precioMensual, planElegido.moneda)
                        : "—"}
                </strong>
              </div>
              {cancelaEl ? (
                <div className="sub-sum-row muted">
                  <span>Después de esa fecha</span>
                  <span>no se te cobra más</span>
                </div>
              ) : (
                <div className="sub-sum-row muted">
                  <span>Fecha</span>
                  <span>
                    {actual?.proximoCobro
                      ? fechaLarga(actual.proximoCobro)
                      : "al activar"}
                  </span>
                </div>
              )}
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
              {datos.tarjeta ? (
                <div className="sub-pay-card">
                  <LogoTarjeta marca={datos.tarjeta.marca} />
                  <div className="sub-pay-card-txt">
                    <div className="nro">
                      <span className="ptos">•••• •••• ••••</span>
                      {datos.tarjeta.ultimos4}
                    </div>
                    <div className="meta">
                      {NOMBRE_MARCA[datos.tarjeta.marca] ?? "Tarjeta"}
                      {datos.tarjeta.vence
                        ? ` · vence ${datos.tarjeta.vence}`
                        : ""}
                    </div>
                  </div>
                </div>
              ) : null}
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
              {cancelaEl ? null : (
                <button
                  type="button"
                  className="sub-manage danger"
                  onClick={irAlPortal}
                  disabled={yendoAlPortal}
                >
                  Cancelar suscripción
                </button>
              )}
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
      ? actual.cambioProgramado === "cancel"
        ? "Se cancela"
        : actual.estadoProveedor === "past_due"
          ? "Pago pendiente"
          : "Activa"
      : actual?.estado === "suspendida"
        ? "Suspendida"
        : actual
          ? "Dada de baja"
          : "Sin plan";
  const tono =
    actual?.cambioProgramado === "cancel" || actual?.estadoProveedor === "past_due"
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
