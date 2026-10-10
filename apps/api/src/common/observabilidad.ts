import * as Sentry from '@sentry/nestjs';
import {
  configurarMonitoreo,
  datosMinimos,
  eventoMinimo,
} from './observabilidad-segura';

let iniciado = false;
export function iniciarMonitoreo(servicio: 'api' | 'worker' | 'worker-pdf') {
  if (iniciado) return;
  const config = configurarMonitoreo(process.env);
  if (!config) return;
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
      traceLifecycle: 'static',
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
      initialScope: { tags: { servicio } },
    });
    iniciado = true;
  } catch {
    /* El monitor nunca debe impedir iniciar la aplicación. */
  }
}

export function reportarFallo(
  error: unknown,
  tags: Record<string, string | undefined> = {},
) {
  if (!iniciado) return;
  try {
    Sentry.withIsolationScope((scope) => {
      for (const [key, value] of Object.entries(tags))
        if (value) scope.setTag(key, value);
      const code =
        error && typeof error === 'object' && 'code' in error
          ? error.code
          : undefined;
      if (typeof code === 'string') scope.setTag('codigo', code);
      Sentry.captureException(error);
    });
  } catch {
    /* Un fallo del monitor no reemplaza el error original. */
  }
}

export async function cerrarMonitoreo() {
  if (iniciado) {
    try {
      await Sentry.flush(2000);
    } catch {
      /* best effort */
    }
  }
}
