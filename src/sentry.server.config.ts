import * as Sentry from "@sentry/nextjs";
import {
  areaMonitoreo,
  configurarMonitoreo,
  datosMinimos,
  eventoMinimo,
} from "../apps/api/src/common/observabilidad-segura";
const config = configurarMonitoreo(process.env);
if (config) {
  try {
    Sentry.init({
      ...config,
      defaultIntegrations: false,
      integrations: [
        Sentry.onUncaughtExceptionIntegration(),
        Sentry.onUnhandledRejectionIntegration(),
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
      initialScope: { tags: { servicio: "web-servidor" } },
    });
  } catch {
    /* El monitor no impide iniciar la web. */
  }
}
export function reportarErrorServidor(error: unknown, route: string) {
  if (!config) return;
  try {
    Sentry.captureException(error, {
      tags: { operacion: "render", area: areaMonitoreo(route) },
    });
  } catch {
    /* No reemplazar el error original. */
  }
}
