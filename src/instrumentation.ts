import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs")
    await import("./sentry.server.config");
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  _request,
  context,
) => {
  // Mantener la importación dentro de la rama: Next también compila este
  // archivo para edge, donde las integraciones de procesos Node no existen.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reportarErrorServidor } = await import("./sentry.server.config");
    reportarErrorServidor(error, context.routePath);
  }
};
