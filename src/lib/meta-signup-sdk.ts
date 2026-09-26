import type {
  MetaConexionApi,
  PreparacionMeta,
  RespuestaIntentoMeta,
} from "./meta-conexion-api";

type Objeto = Record<string, unknown>;
const objeto = (value: unknown): Objeto =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Objeto)
    : {};
export type MetaSdk = {
  init: (config: {
    appId: string;
    version: string;
    xfbml: boolean;
    autoLogAppEvents: boolean;
  }) => void;
  login: (
    callback: (response: unknown) => void,
    options: {
      config_id: string;
      response_type: "code";
      override_default_response_type: true;
      extras: { setup: Objeto; featureType?: string };
    },
  ) => void;
};
declare global {
  interface Window {
    FB?: MetaSdk;
    fbAsyncInit?: () => void;
  }
}
let carga: Promise<MetaSdk> | undefined;
let inicializada: string | undefined;
/** Sólo se carga por un clic explícito y sobre HTTPS. Nunca recibe secretos de la app. */
export async function cargarMetaSdk(config: PreparacionMeta): Promise<MetaSdk> {
  if (window.location.protocol !== "https:") throw new Error("HTTPS_REQUERIDO");
  if (!carga)
    carga = new Promise<MetaSdk>((resolve, reject) => {
      if (window.FB) {
        resolve(window.FB);
        return;
      }
      const script = document.createElement("script");
      let cerrado = false;
      const timer = setTimeout(() => terminar(), 15_000);
      const terminar = (sdk?: MetaSdk) => {
        if (cerrado) return;
        cerrado = true;
        clearTimeout(timer);
        script.onerror = null;
        window.fbAsyncInit = undefined;
        if (sdk) resolve(sdk);
        else {
          script.remove();
          reject(new Error("SDK_NO_DISPONIBLE"));
        }
      };
      window.fbAsyncInit = () => terminar(window.FB);
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.onerror = () => terminar();
      document.head.append(script);
    }).catch((e) => {
      carga = undefined;
      throw e;
    });
  const sdk = await carga;
  const firma = `${config.appId}:${config.graphVersion}`;
  if (inicializada && inicializada !== firma)
    throw new Error("RECARGAR_CONFIGURACION");
  if (!inicializada) {
    sdk.init({
      appId: config.appId,
      version: config.graphVersion,
      xfbml: false,
      autoLogAppEvents: false,
    });
    inicializada = firma;
  }
  return sdk;
}
export type PasoAltaMeta =
  | "esperando_meta"
  | "verificando"
  | "completado"
  | "cancelado"
  | "error";
/** Un flujo por clic. El código se canjea inmediatamente; los activos pueden llegar antes o después.
 * No hay logs, almacenamiento en el navegador ni reintentos de canje/verificación. */
export function iniciarAltaMeta(opciones: {
  sdk: MetaSdk;
  preparacion: PreparacionMeta;
  api: MetaConexionApi;
  cambiar: (paso: PasoAltaMeta) => void;
}) {
  const { sdk, preparacion, api, cambiar } = opciones;
  const intento = {
    id: preparacion.id,
    estadoSecreto: preparacion.estadoSecreto,
  };
  let cerrado = false,
    codigoRecibido = false,
    canjeado = false,
    verificando = false;
  let activos: { wabaId: string; phoneNumberId?: string } | undefined;
  let espera: ReturnType<typeof setTimeout> | undefined;
  const limite = setTimeout(
    () => terminar("error", true),
    Math.max(0, Date.parse(preparacion.venceEl) - Date.now()),
  );
  function terminar(paso: PasoAltaMeta, cancelar = false) {
    if (cerrado) return;
    cerrado = true;
    clearTimeout(limite);
    clearTimeout(espera);
    window.removeEventListener("message", mensaje);
    if (cancelar) void api.cancelar(intento).catch(() => undefined);
    cambiar(paso);
  }
  async function recibir(respuesta: RespuestaIntentoMeta) {
    if (cerrado) return;
    if (respuesta.id !== intento.id || respuesta.modo !== preparacion.modo) {
      terminar("error", true);
      return;
    }
    if (respuesta.estado === "VERIFICADA") {
      terminar("completado");
      return;
    }
    if (respuesta.estado === "REINICIAR" || respuesta.estado === "CANCELADA") {
      terminar(respuesta.estado === "CANCELADA" ? "cancelado" : "error");
      return;
    }
    if (respuesta.estado === "CANJEADA") {
      canjeado = true;
      void verificar();
      return;
    }
    // Sólo leer mientras el servidor resuelve una petición que ya empezó.
    if (
      respuesta.estado === "CANJEANDO" ||
      respuesta.estado === "VERIFICANDO"
    ) {
      espera = setTimeout(() => {
        void api
          .consultar(intento)
          .then(recibir)
          .catch(() => terminar("error", true));
      }, 1000);
    } else terminar("error", true);
  }
  async function verificar() {
    if (cerrado || !canjeado || !activos || verificando) return;
    verificando = true;
    cambiar("verificando");
    try {
      await recibir(await api.verificar(intento, activos));
    } catch {
      terminar("error", true);
    }
  }
  function mensaje(event: MessageEvent) {
    if (
      cerrado ||
      !["https://www.facebook.com", "https://web.facebook.com"].includes(
        event.origin,
      ) ||
      typeof event.data !== "string" ||
      event.data.length > 32768
    )
      return;
    let datos: Objeto;
    try {
      datos = objeto(JSON.parse(event.data));
    } catch {
      return;
    }
    if (datos.type !== "WA_EMBEDDED_SIGNUP") return;
    if (datos.event === "CANCEL" || datos.event === "ERROR") {
      terminar(datos.event === "CANCEL" ? "cancelado" : "error", true);
      return;
    }
    const finalEsperado =
      preparacion.modo === "COEXISTENCIA"
        ? "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
        : "FINISH";
    if (datos.event !== finalEsperado) return;
    const data = objeto(datos.data);
    if (typeof data.waba_id !== "string" || !/^\d{1,32}$/.test(data.waba_id))
      return;
    const phone = data.phone_number_id;
    if (
      phone !== undefined &&
      (typeof phone !== "string" || !/^\d{1,32}$/.test(phone))
    )
      return;
    if (preparacion.modo === "COEXISTENCIA" && !phone) return;
    if (activos) return; // Una sola selección; los activos siempre se comprueban en Graph.
    activos = {
      wabaId: data.waba_id,
      ...(typeof phone === "string" ? { phoneNumberId: phone } : {}),
    };
    void verificar();
  }
  window.addEventListener("message", mensaje);
  cambiar("esperando_meta");
  try {
    // Invocar desde el clic sin un await previo para permitir la ventana de Meta.
    sdk.login(
      (response) => {
        if (cerrado || codigoRecibido) return;
        const codigo = objeto(objeto(response).authResponse).code;
        if (typeof codigo !== "string" || !codigo || codigo.length > 16384) {
          terminar("cancelado", true);
          return;
        }
        codigoRecibido = true;
        cambiar("verificando");
        void api
          .canjear(intento, codigo)
          .then(recibir)
          .catch(() => terminar("error", true));
      },
      {
        config_id: preparacion.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          ...(preparacion.modo === "COEXISTENCIA"
            ? { featureType: "whatsapp_business_app_onboarding" }
            : {}),
        },
      },
    );
  } catch {
    terminar("error", true);
  }
  return () => terminar("cancelado", true);
}
