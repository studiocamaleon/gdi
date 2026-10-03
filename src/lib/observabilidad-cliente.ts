import * as Sentry from "@sentry/nextjs";
import {
  areaMonitoreo,
  datosMinimos,
  eventoMinimo,
  type ConfigMonitoreo,
} from "../../apps/api/src/common/observabilidad-segura";

let listo: Promise<boolean> | undefined;
export function iniciarMonitoreoCliente(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return (listo ??= (async () => {
    try {
      const response = await fetch("/api/observabilidad/config", {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) return false;
      const config: ConfigMonitoreo | null = await response.json();
      if (!config) return false;
      Sentry.init({
        ...config,
        defaultIntegrations: false,
        integrations: [
          Sentry.globalHandlersIntegration(),
          Sentry.browserApiErrorsIntegration(),
          Sentry.dedupeIntegration(),
        ],
        dataCollection: { ...datosMinimos, httpBodies: [] },
        tracesSampleRate: 0,
        traceLifecycle: "static",
        tracePropagationTargets: [],
        sendClientReports: false,
        beforeSend: (event, hint) =>
          eventoMinimo(
            event as unknown as Record<string, unknown>,
            hint.originalException,
          ) as Sentry.ErrorEvent | null,
        beforeSendLog: () => null,
        beforeSendMetric: () => null,
        ignoreSpans: [/.*/],
        beforeSendTransaction: () => null,
        initialScope: { tags: { servicio: "web-cliente" } },
      });
      return true;
    } catch {
      return false;
    }
  })());
}

export async function reportarErrorVista(error: unknown) {
  if (!(await iniciarMonitoreoCliente())) return;
  try {
    Sentry.captureException(error, {
      tags: {
        operacion: "render",
        area: areaMonitoreo(window.location.pathname),
      },
    });
  } catch {
    /* No interrumpir la vista. */
  }
}

const recientes = new Map<string, number>();
export async function reportarErrorApi(path: string, status: number) {
  if (status < 500 || !(await iniciarMonitoreoCliente())) return;
  const area = areaMonitoreo(path),
    clave = `${area}:${status}`;
  if (Date.now() - (recientes.get(clave) ?? 0) < 60_000) return;
  recientes.set(clave, Date.now());
  // Nunca adjuntar el texto de la respuesta, URL completa o formulario.
  try {
    Sentry.captureException(new Error("Fallo de solicitud"), {
      tags: { operacion: "http", area, status: String(status) },
    });
  } catch {
    /* No interrumpir la operación. */
  }
}
