"use client";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpRightIcon,
  CheckIcon,
  CreditCardIcon,
  LockKeyholeIcon,
  ReceiptTextIcon,
  XIcon,
} from "lucide-react";
import { useFecha } from "@/components/navigation/config-regional-provider";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Paddle } from "@paddle/paddle-js";
import checkoutStyles from "./suscripcion-checkout.module.css";
import { ContratacionDialog } from "./contratacion-dialog";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import theme from "@/components/design-system/brand-workspace-theme.module.css";
import styles from "./suscripcion-view.module.css";

import {
  abrirPortalSuscripcion,
  cambiarPlanSuscripcion,
  getSuscripcion,
  previsualizarCambio,
  reactivarSuscripcion,
  urlFacturaPdf,
  sincronizarSuscripcion,
  actualizarEstadoSuscripcion,
  type EstadoSuscripcion,
  type PlanContratable,
  contratacionPendiente,
  consultarContratacion,
  type VistaContratacion,
} from "@/lib/suscripcion-api";

/**
 * Suscripción del tenant, con identidad Grafo y datos reales de facturación.
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
        <path d="M20 7.9a7 7 0 000 10.2 7 7 0 000-10.2z" fill="#FF5F00" />
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
  centroCopiado: "Centro de copiado",
};

function precio(monto: number, moneda: string): string {
  const simbolo = moneda === "USD" ? "US$" : "$";
  return `${simbolo}${monto.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

function detallesDe(features: Record<string, unknown>): string[] {
  if (features.todo === true) {
    return [
      "Todas las funciones presentes y futuras",
      "Usuarios ilimitados",
      "Órdenes ilimitadas",
      "Almacenamiento ilimitado",
    ];
  }
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

type CheckoutInline = {
  plan: PlanContratable;
  ciclo: "mensual" | "anual";
  priceId: string;
  contratacion?: VistaContratacion;
};

export function SuscripcionView({ inicial }: { inicial: EstadoSuscripcion }) {
  const router = useRouter();
  const { fechaCorta } = useFecha();
  const fechaLarga = (iso: string | null) => (iso ? fechaCorta(iso) : "—");
  const [datos, setDatos] = React.useState(inicial);
  const [paddle, setPaddle] = React.useState<Paddle | null>(null);
  const [planComercial, setPlanComercial] =
    React.useState<PlanContratable | null>(null);
  const [intentoComercial, setIntentoComercial] =
    React.useState<VistaContratacion | null>(null);
  const [revisionAbierta, setRevisionAbierta] = React.useState(false);
  const contratacionRef = React.useRef<string | null>(null);
  const paddleRef = React.useRef<Paddle | null>(null);
  const [confirmando, setConfirmando] = React.useState(false);
  const [abriendo, setAbriendo] = React.useState<string | null>(null);
  const [yendoAlPortal, setYendoAlPortal] = React.useState(false);
  const [errorPaddle, setErrorPaddle] = React.useState<string | null>(null);
  const [checkoutInline, setCheckoutInline] =
    React.useState<CheckoutInline | null>(null);
  const [checkoutCargando, setCheckoutCargando] = React.useState(false);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);
  const [checkoutIntento, setCheckoutIntento] = React.useState(0);
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

  React.useEffect(() => {
    let vivo = true;
    void contratacionPendiente()
      .then((r) => {
        if (vivo) setIntentoComercial(r);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  const refrescarContrato = async () => {
    try {
      const fresco = await getSuscripcion();
      setDatos(fresco);
      if (fresco.actual) setElegido(fresco.actual.planCodigo);
      router.refresh();
    } catch {
      toast.info(
        "El cambio fue confirmado. Recargá la página para actualizar el resumen.",
      );
    }
  };
  const abrirPagoComercial = (r: VistaContratacion) => {
    if (!paddle || !r.transaccionId) {
      toast.error(
        "El formulario de pago todavía se está cargando. Podés retomarlo en un momento.",
      );
      return;
    }
    const plan = datos.planes.find((p) => p.ofertaId === r.ofertaId) ?? {
      codigo: r.ofertaId,
      nombre: r.revision.destino.nombre,
      descripcion: null,
      precioMensual: r.revision.precioBase,
      moneda: "USD",
      priceId: "",
      anual: null,
      esActual: false,
      features: {
        usuariosMax: r.revision.destino.totalUsuarios,
        storageGb: r.revision.destino.gb,
      },
    };
    contratacionRef.current = r.id;
    setIntentoComercial(r);
    setRevisionAbierta(false);
    setCheckoutError(null);
    setCheckoutCargando(true);
    setCheckoutInline({
      plan: {
        ...plan,
        features: {
          ...plan.features,
          usuariosMax: r.revision.destino.totalUsuarios,
        },
      },
      ciclo: r.revision.ciclo,
      priceId: "",
      contratacion: r,
    });
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
  const traerResultado = React.useCallback(
    async (transaccionId?: string) => {
      setConfirmando(true);
      try {
        if (!transaccionId) {
          throw new Error(
            "Paddle no informó el identificador de la transacción.",
          );
        }
        const id = contratacionRef.current;
        if (id) {
          const resultado = await consultarContratacion(id);
          setIntentoComercial(resultado);
          if (resultado.estado !== "aplicada") {
            setRevisionAbierta(true);
            return;
          }
        }
        const fresco = id
          ? await getSuscripcion()
          : await sincronizarSuscripcion(transaccionId);
        if (
          fresco.actual?.proveedor !== "paddle" ||
          !fresco.puedeCambiarSinPago
        ) {
          throw new Error(
            "La suscripción todavía no quedó vinculada con Paddle.",
          );
        }
        setDatos(fresco);
        if (fresco.actual) setElegido(fresco.actual.planCodigo);
        router.refresh();
        toast.success(`Tu plan ${fresco.actual.planNombre} está activo.`);
        if (fresco.facturas.some((f) => PROVISORIOS.has(f.estado))) {
          seguirFacturasProvisorias();
        }
      } catch (error) {
        // El pago puede estar bien aunque la lectura inmediata falle. No lo
        // llamamos "activo" hasta comprobar la vinculación real con Paddle.
        toast.info(
          error instanceof Error
            ? `${error.message} El pago no se perdió; esperá unos segundos y recargá la página.`
            : "Paddle está terminando de confirmar la suscripción. Esperá unos segundos y recargá la página.",
        );
      } finally {
        setConfirmando(false);
      }
    },
    [router, seguirFacturasProvisorias],
  );

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
            if (evento.name === "checkout.loaded") {
              setCheckoutCargando(false);
              setAbriendo(null);
            }
            if (
              evento.name === "checkout.error" ||
              evento.name === "checkout.failed" ||
              evento.name === "checkout.payment.error" ||
              evento.name === "checkout.payment.failed"
            ) {
              setCheckoutCargando(false);
              setAbriendo(null);
              setCheckoutError(
                evento.detail ||
                  "Paddle no pudo preparar el formulario de pago. Probá nuevamente.",
              );
            }
            if (evento.name === "checkout.completed") {
              // El id de la transacción viene en el evento: con eso resolvemos
              // la suscripción en Paddle sin depender del webhook.
              const tx = (
                evento.data as { transaction_id?: string } | undefined
              )?.transaction_id;
              setCheckoutCargando(false);
              setCheckoutInline(null);
              paddleRef.current?.Checkout.close();
              void traerResultado(tx);
            }
          },
        }),
      )
      .then((p) => {
        if (vivo && p) {
          paddleRef.current = p;
          setPaddle(p);
        }
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
      paddleRef.current = null;
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
    if (plan.ofertaId) {
      if (
        intentoComercial &&
        ["enviando", "checkout", "verificar"].includes(intentoComercial.estado)
      ) {
        setPlanComercial(
          datos.planes.find((p) => p.ofertaId === intentoComercial.ofertaId) ??
            null,
        );
      } else {
        setPlanComercial(plan);
        setIntentoComercial(null);
      }
      setRevisionAbierta(true);
      return;
    }
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
    if (plan.ofertaId) {
      elegirPlan(plan);
      return;
    }
    if (!paddle) {
      toast.error("El checkout todavía se está cargando. Probá en un momento.");
      return;
    }
    setAbriendo(plan.codigo);
    contratacionRef.current = null;
    // El ciclo define QUÉ precio de Paddle se cobra: son dos precios distintos
    // del mismo plan, no un descuento aplicado sobre el mensual.
    const priceId =
      ciclo === "anual" && plan.anual ? plan.anual.priceId : plan.priceId;
    setCheckoutError(null);
    setCheckoutCargando(true);
    setCheckoutInline({ plan, ciclo, priceId });
  };

  const cerrarCheckout = React.useCallback(() => {
    paddleRef.current?.Checkout.close();
    setCheckoutInline(null);
    setCheckoutCargando(false);
    setCheckoutError(null);
    setAbriendo(null);
  }, []);

  const reintentarCheckout = React.useCallback(() => {
    paddleRef.current?.Checkout.close();
    setCheckoutError(null);
    setCheckoutCargando(true);
    setCheckoutIntento((actual) => actual + 1);
  }, []);

  React.useEffect(() => {
    if (!checkoutInline || !paddle) return;

    // El frameTarget tiene que existir en el DOM antes de llamar a Paddle.
    // El siguiente frame garantiza que el Dialog ya montó su contenido.
    const frame = window.requestAnimationFrame(() => {
      try {
        paddle.Checkout.open({
          ...(checkoutInline.contratacion?.transaccionId
            ? { transactionId: checkoutInline.contratacion.transaccionId }
            : {
                items: [{ priceId: checkoutInline.priceId, quantity: 1 }],
                // El tenantId sale de la SESIÓN (lo puso el backend): es lo que el
                // webhook usa para saber a qué imprenta corresponde el pago.
                customData: { tenantId: datos.checkout.tenantId },
              }),
          customer: { email: datos.checkout.email },
          settings: {
            displayMode: "inline",
            frameTarget: checkoutStyles.paddleFrame,
            frameInitialHeight: 560,
            frameStyle:
              "width:100%;min-width:286px;background-color:transparent;border:none;",
            variant: "one-page",
            theme: "light",
            locale: "es",
            allowLogout: false,
            showAddDiscounts: false,
          },
        });
      } catch (error) {
        setCheckoutCargando(false);
        setAbriendo(null);
        setCheckoutError(
          error instanceof Error
            ? error.message
            : "No se pudo abrir el formulario de pago.",
        );
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [checkoutInline, checkoutIntento, paddle, datos.checkout]);

  const reactivar = async () => {
    if (reactivando) return;
    setReactivando(true);
    try {
      setDatos(await reactivarSuscripcion());
      toast.success("Tu suscripción sigue activa. No se va a cancelar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reactivar.");
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

  const [verificandoPago, setVerificandoPago] = React.useState(false);
  const verificarPago = async () => {
    if (verificandoPago) return;
    setVerificandoPago(true);
    try {
      const fresco = await actualizarEstadoSuscripcion();
      setDatos(fresco);
      router.refresh();
      if (fresco.actual?.estadoProveedor === "active") {
        toast.success("El pago y la suscripción están al día.");
      } else {
        toast.info("Paddle todavía informa el pago como pendiente.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo verificar el pago.",
      );
    } finally {
      setVerificandoPago(false);
    }
  };

  const actual = datos.actual;
  const enMora = actual?.estadoProveedor === "past_due";
  const activadaEnPaddle =
    actual?.proveedor === "paddle" && actual.estado !== "baja";
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
      <SuscripcionWorkspace>
        <Cabecera actual={actual} />
        <div className="sub-empty">
          <div className="sub-empty-tt">Cobro no configurado</div>
          <div className="sub-empty-sub">
            La suscripción todavía no está habilitada en este entorno.
          </div>
        </div>
      </SuscripcionWorkspace>
    );
  }

  return (
    <SuscripcionWorkspace>
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
        <div className="sub-alert warn sub-alert-accion">
          <div>
            <b>No pudimos cobrar tu último pago.</b>{" "}
            {actual?.soloLectura
              ? "La cuenta quedó en modo solo lectura hasta regularizarlo."
              : `Te quedan ${actual?.diasGraciaRestantes ?? 7} días de gracia antes de pasar a solo lectura.`}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={verificarPago}
              disabled={verificandoPago}
            >
              {verificandoPago ? "Verificando…" : "Verificar pago"}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={irAlPortal}
              disabled={yendoAlPortal}
            >
              Actualizar medio de pago
            </button>
          </div>
        </div>
      ) : null}

      {datos.prueba.enPrueba && actual && !activadaEnPaddle ? (
        <div className="sub-trial">
          <div className="sub-trial-info">
            <div className="sub-trial-badge">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 3v18M4 7.5l8 4.5 8-4.5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
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
              {planElegido?.ofertaId
                ? "Revisá las condiciones antes de pagar"
                : `Sin cargo hasta el ${fechaLarga(datos.prueba.hasta)}`}
            </span>
          </div>
        </div>
      ) : null}

      {activadaEnPaddle && actual?.estadoProveedor === "trialing" ? (
        <div className="sub-trial sub-trial-active">
          <div className="sub-trial-info">
            <div className="sub-trial-badge">
              <CheckIcon size={20} strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <div className="sub-trial-title">
                Tu suscripción al <strong>plan {actual.planNombre}</strong> está
                activada
              </div>
              <div className="sub-trial-sub">
                El medio de pago quedó registrado. Tu primer cobro será el{" "}
                <strong>
                  {actual.proximoCobro
                    ? fechaLarga(actual.proximoCobro)
                    : "finalizar la prueba"}
                </strong>
                .
              </div>
            </div>
          </div>
          <div className="sub-trial-confirmed">Pago configurado</div>
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
          <GdiSpinner />
          Confirmando el pago con Paddle… no cierres esta página.
        </div>
      ) : null}

      {intentoComercial &&
        ["enviando", "checkout", "verificar"].includes(
          intentoComercial.estado,
        ) && (
          <div className="sub-alert info">
            <div>
              <b>Tenés una contratación pendiente</b>
              <p>
                {intentoComercial.revision.destino.nombre} ·{" "}
                {intentoComercial.revision.destino.totalUsuarios} usuarios.
                Retomá el pago o consultá su estado.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setPlanComercial(
                  datos.planes.find(
                    (p) => p.ofertaId === intentoComercial.ofertaId,
                  ) ?? null,
                );
                setRevisionAbierta(true);
              }}
            >
              Revisar contratación
            </Button>
          </div>
        )}
      {revisionAbierta && (
        <DesignSystemProvider theme="brand">
          <ContratacionDialog
            plan={planComercial}
            inicial={intentoComercial}
            cicloInicial={ciclo}
            adicionalesIniciales={datos.actual?.usuariosAdicionales ?? 0}
            cerrar={() => setRevisionAbierta(false)}
            onEstado={setIntentoComercial}
            abrirPago={abrirPagoComercial}
            completada={() => void refrescarContrato()}
          />{" "}
        </DesignSystemProvider>
      )}

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

      <Dialog
        open={checkoutInline !== null}
        onOpenChange={(open) => {
          if (!open) cerrarCheckout();
        }}
      >
        <DialogContent
          className={`${checkoutStyles.dialog} max-h-[calc(100dvh-2rem)] max-w-[1180px] gap-0 overflow-hidden p-0 sm:max-w-[1180px]`}
          showCloseButton={false}
        >
          {checkoutInline ? (
            <>
              <div className={checkoutStyles.topbar}>
                <div className={checkoutStyles.brand} aria-label="Grafoprint">
                  <span className={checkoutStyles.brandmark} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5.5 6.5 L18 6.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                      <path
                        d="M5.5 6.5 L12 17.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                      <path
                        d="M18 6.5 L12 17.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                      <circle cx="5.5" cy="6.5" r="2.2" fill="currentColor" />
                      <circle cx="18" cy="6.5" r="2.2" fill="currentColor" />
                      <circle cx="12" cy="17.5" r="2.2" fill="currentColor" />
                    </svg>
                  </span>
                  <strong>grafoprint</strong>
                </div>
                <div className={checkoutStyles.secure}>
                  <LockKeyholeIcon aria-hidden="true" />
                  Pago protegido
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={cerrarCheckout}
                  aria-label="Cerrar checkout"
                >
                  <XIcon />
                </Button>
              </div>

              <div className={checkoutStyles.layout}>
                <aside className={checkoutStyles.summary}>
                  <div>
                    <span className={checkoutStyles.kicker}>
                      Tu suscripción
                    </span>
                    <h3>Plan {checkoutInline.plan.nombre}</h3>
                    <p>
                      Todo listo para que tu equipo siga trabajando sin
                      interrupciones.
                    </p>
                  </div>

                  <div className={checkoutStyles.price}>
                    <strong>
                      {precio(
                        checkoutInline.contratacion
                          ? checkoutInline.contratacion.revision.totalPeriodo
                          : checkoutInline.ciclo === "anual" &&
                              checkoutInline.plan.anual
                            ? checkoutInline.plan.anual.precio
                            : checkoutInline.plan.precioMensual,
                        checkoutInline.plan.moneda,
                      )}
                    </strong>
                    <span>
                      /{checkoutInline.ciclo === "anual" ? "año" : "mes"}
                    </span>
                  </div>

                  {checkoutInline.contratacion?.revision.implementacion !=
                    null && (
                    <div>
                      <p>
                        Implementación · pago único:{" "}
                        {precio(
                          checkoutInline.contratacion.revision.implementacion,
                          checkoutInline.plan.moneda,
                        )}
                      </p>
                      <p>
                        <strong>
                          Primer pago:{" "}
                          {precio(
                            checkoutInline.contratacion.revision.totalInicial ??
                              checkoutInline.contratacion.revision.totalPeriodo,
                            checkoutInline.plan.moneda,
                          )}
                        </strong>
                      </p>
                      <small>
                        Antes de impuestos. No se repite en las renovaciones.
                      </small>
                    </div>
                  )}
                  <div className={checkoutStyles.trialNote}>
                    <span className={checkoutStyles.trialIcon}>
                      <CheckIcon aria-hidden="true" />
                    </span>
                    <div>
                      <strong>
                        {checkoutInline.contratacion
                          ? `${checkoutInline.contratacion.revision.destino.totalUsuarios} usuarios en total`
                          : "14 días sin cargo"}
                      </strong>
                      <span>
                        {checkoutInline.contratacion
                          ? "El total incluye el plan y los usuarios adicionales elegidos. Los impuestos se calculan en el pago."
                          : "Paddle te mostrará la fecha exacta del primer cobro."}
                      </span>
                    </div>
                  </div>

                  <ul className={checkoutStyles.features}>
                    {detallesDe(checkoutInline.plan.features)
                      .slice(0, 5)
                      .map((detalle) => (
                        <li key={detalle}>
                          <CheckIcon aria-hidden="true" />
                          <span>{detalle}</span>
                        </li>
                      ))}
                  </ul>

                  <div className={checkoutStyles.provider}>
                    <LogoPaddle s={24} />
                    <span>
                      Paddle procesa el pago y emite el comprobante fiscal.
                    </span>
                  </div>
                </aside>

                <section className={checkoutStyles.payment}>
                  <DialogHeader className={checkoutStyles.heading}>
                    <DialogTitle>Activá tu suscripción</DialogTitle>
                    <DialogDescription>
                      Completá los datos de facturación y elegí tu medio de
                      pago.{" "}
                      {checkoutInline.contratacion
                        ? "Revisá el importe final antes de autorizar el cobro."
                        : "No se realizará ningún cargo hoy."}
                    </DialogDescription>
                  </DialogHeader>

                  <div className={checkoutStyles.frameShell}>
                    {checkoutCargando ? (
                      <div className={checkoutStyles.loading} role="status">
                        <span
                          className={checkoutStyles.loader}
                          aria-hidden="true"
                        >
                          <i />
                          <i />
                          <i />
                        </span>
                        <strong>Preparando el pago seguro</strong>
                        <span>Estamos conectando con Paddle…</span>
                      </div>
                    ) : null}

                    <div className={checkoutStyles.paddleFrame} />

                    {checkoutError ? (
                      <div className={checkoutStyles.error} role="alert">
                        <strong>No pudimos cargar el formulario</strong>
                        <span>{checkoutError}</span>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={reintentarCheckout}
                        >
                          Reintentar
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className={checkoutStyles.legal}>
                    <LockKeyholeIcon aria-hidden="true" />
                    Grafoprint no almacena los datos de tu tarjeta.
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="sub-grid">
        {/* ── Columna principal ── */}
        <div className="sub-main">
          <section
            className={styles.plansSection}
            aria-labelledby="planes-heading"
          >
            <div className="sub-block-head">
              <div>
                <div className={styles.eyebrow}>Un plan para cada etapa</div>
                <h2 id="planes-heading">Elegí cómo seguir creciendo.</h2>
                <p>
                  Compará lo que incluye cada plan y elegí el que necesita tu
                  equipo.
                </p>
              </div>
              {hayAnual ? (
                <div className={styles.billingChoice}>
                  <SegmentedControl
                    aria-label="Ciclo de facturación de los planes"
                    tone="graphite"
                    value={ciclo}
                    onChange={(value) => {
                      if (value === "mensual" || value === "anual")
                        setCiclo(value);
                    }}
                    options={[
                      { value: "mensual", label: "Mensual", icon: null },
                      { value: "anual", label: "Anual", icon: null },
                    ]}
                  />
                  {ahorroMaxPct > 0 ? (
                    <span className={styles.savings}>
                      Hasta {ahorroMaxPct}% de ahorro anual
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className={styles.plans}>
              {datos.planes.map((p) => {
                const founder = p.codigo === "founder";
                const destacado = p.recomendado === true && !founder;
                const soloPlanActual =
                  p.esActual &&
                  !p.ofertaId &&
                  !(datos.prueba.enPrueba && actual?.proveedor === "manual");
                return (
                  <Card
                    key={p.codigo}
                    className={cn(styles.plan, founder && styles.founder)}
                  >
                    <CardHeader className={styles.planHeader}>
                      <div className={styles.planLabels}>
                        <span className={styles.eyebrow}>
                          {founder ? "Plan interno" : "Grafoprint"}
                        </span>
                        {p.esActual ? (
                          <Badge variant="outline">Plan actual</Badge>
                        ) : destacado ? (
                          <Badge>Recomendado</Badge>
                        ) : null}
                      </div>
                      <CardTitle>
                        <h3>{p.nombre}</h3>
                      </CardTitle>
                      {p.descripcion ? (
                        <CardDescription>{p.descripcion}</CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent className={styles.planContent}>
                      <div className={styles.planPricing}>
                        <div className={styles.price}>
                          <strong>
                            {precio(
                              anualActivo && p.anual
                                ? p.anual.equivalenteMensual
                                : p.precioMensual,
                              p.moneda,
                            )}
                          </strong>
                          <span>/mes</span>
                        </div>
                        {anualActivo && p.anual ? (
                          <p className={styles.priceNote}>
                            {precio(p.anual.precio, p.moneda)} al año.
                            <br />
                            <b>
                              Ahorrás {precio(p.anual.ahorro, p.moneda)}
                            </b>{" "}
                            frente a {precio(p.anual.doceMeses, p.moneda)}{" "}
                            pagando mes a mes.
                          </p>
                        ) : (
                          <p className={styles.priceNote}>
                            Facturación mensual
                          </p>
                        )}
                        {p.implementacion != null && (
                          <p className={styles.implementation}>
                            {p.implementacion > 0
                              ? `Implementación: ${precio(p.implementacion, p.moneda)} · una sola vez`
                              : "Sin cargo de implementación"}
                          </p>
                        )}
                      </div>
                      <ul className={styles.features}>
                        {detallesDe(p.features).map((f) => (
                          <li key={f}>
                            <CheckIcon aria-hidden="true" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      {soloPlanActual ? (
                        <span className={styles.currentLabel}>
                          <CheckIcon aria-hidden="true" /> Tu plan actual
                        </span>
                      ) : (
                        <ActionButton
                          variant={destacado ? "primary" : "secondary"}
                          className="w-full"
                          onPress={() => {
                            setElegido(p.codigo);
                            elegirPlan(p);
                          }}
                          isDisabled={confirmando || abriendo === p.codigo}
                        >
                          {abriendo === p.codigo
                            ? "Abriendo…"
                            : p.ofertaId && p.esActual && activadaEnPaddle
                              ? "Administrar plan y usuarios"
                              : p.esActual
                                ? `Contratar ${p.nombre}`
                                : `Elegir ${p.nombre}`}
                          <ArrowUpRightIcon aria-hidden="true" />
                        </ActionButton>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
            <p className={styles.plansNote}>
              <LockKeyholeIcon aria-hidden="true" />
              Los precios no incluyen impuestos. Al cambiar de plan, revisás el
              ajuste proporcional antes de confirmar.
            </p>
          </section>

          {/* ── Facturas ── */}
          <section className="sub-block">
            <div className="sub-block-head">
              <div>
                <div className={styles.eyebrow}>Historial de facturación</div>
                <h2>Facturas</h2>
                <p>Consultá y descargá los comprobantes de tus pagos.</p>
              </div>
            </div>

            {datos.facturas.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ReceiptTextIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>Todavía no hay facturas</EmptyTitle>
                  <EmptyDescription>
                    {actual?.proximoCobro
                      ? `Tu próximo cobro es el ${fechaLarga(actual.proximoCobro)}.`
                      : "Aparecerán acá en cuanto se registre el primer cobro."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
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
          <div className={cn("sub-card", styles.currentSummary)}>
            <div className="sub-card-h">
              {actual ? "Tu suscripción" : "Resumen del plan"}
            </div>
            <h2 className={styles.currentPlanName}>
              {actual?.planNombre ?? planElegido?.nombre ?? "Elegí tu plan"}
              <span>.</span>
            </h2>
            <div className="sub-summary">
              <div className="sub-sum-row">
                <span>Ciclo</span>
                <strong>
                  {(actual?.cicloFacturacion ??
                    (anualActivo ? "anual" : "mensual")) === "anual"
                    ? "Anual"
                    : "Mensual"}
                </strong>
              </div>
              <div className="sub-sum-row">
                <span>Precio</span>
                <strong>
                  {actual
                    ? precio(
                        actual.totalPeriodo ?? actual.precioMensual,
                        actual.moneda,
                      )
                    : planElegido
                      ? precio(planElegido.precioMensual, planElegido.moneda)
                      : "—"}
                  <em>
                    /{actual?.cicloFacturacion === "anual" ? "año" : "mes"}
                  </em>
                </strong>
              </div>
              <div className="sub-sum-div" />
              <div className="sub-sum-row big">
                <span>
                  {actual?.estado === "baja"
                    ? "Estado"
                    : cancelaEl
                      ? "Termina el"
                      : actual
                        ? "Renovación · precio base"
                        : "Primer pago · precio base"}
                </span>
                <strong>
                  {actual?.estado === "baja"
                    ? "Sin renovación"
                    : cancelaEl
                      ? fechaLarga(cancelaEl)
                      : actual
                        ? precio(
                            actual.totalPeriodo ?? actual.precioMensual,
                            actual.moneda,
                          )
                        : planElegido
                          ? precio(
                              planElegido.precioMensual,
                              planElegido.moneda,
                            )
                          : "—"}
                </strong>
              </div>
              {actual?.estado === "baja" ? null : cancelaEl ? (
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
              {!cancelaEl && actual?.estado !== "baja" && (
                <p className={styles.taxNote}>
                  Paddle aplica los impuestos, descuentos y saldos a favor al
                  calcular el cobro final.
                </p>
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
              {actual?.estado === "baja"
                ? "La suscripción finalizó. Podés contratar nuevamente desde esta página."
                : cancelaEl
                  ? "La renovación está cancelada. Conservás el acceso hasta la fecha indicada."
                  : "Se renueva automáticamente según el ciclo contratado. Cancelás cuando quieras."}
            </div>
          </div>

          {/* Método de pago */}
          <div className="sub-card">
            <div className="sub-card-h">
              <CreditCardIcon aria-hidden="true" /> Método de pago
            </div>
            <div className="sub-pay">
              <div className="sub-pay-head">
                <LogoPaddle />
                <div className="sub-pay-tt">
                  <div className="nm">Paddle</div>
                  <div className="sub">Pagos y facturación</div>
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
                <ActionButton
                  variant="secondary"
                  className="w-full"
                  onPress={irAlPortal}
                  isDisabled={yendoAlPortal}
                >
                  {yendoAlPortal ? "Abriendo…" : "Cambiar medio de pago"}
                  <ArrowUpRightIcon aria-hidden="true" />
                </ActionButton>
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
              {cancelaEl || actual?.estado === "baja" ? null : (
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
    </SuscripcionWorkspace>
  );
}

function SuscripcionWorkspace({ children }: { children: React.ReactNode }) {
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <div
        data-ui="heroui"
        data-appearance="light"
        className={cn(theme.theme, theme.legacy, styles.workspace)}
      >
        <div className={cn("sub-page", styles.page)}>{children}</div>
      </div>
    </DesignSystemProvider>
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
    actual?.cambioProgramado === "cancel" ||
    actual?.estadoProveedor === "past_due"
      ? "warn"
      : actual?.estado === "activa"
        ? "ok"
        : "";
  return (
    <div className="page-head">
      <div className="title-block">
        <div className={styles.eyebrow}>Administración · Tu empresa</div>
        <h1>
          Tu suscripción<span className={styles.titleDot}>.</span>
        </h1>
        <p className="sub-subhead">
          El plan de tu equipo, los próximos cobros y toda tu facturación, en un
          solo lugar.
        </p>
      </div>
      <div className={`sub-state-pill ${tono}`}>
        <span className="dot" /> {etiqueta}
      </div>
    </div>
  );
}
