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
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportarErrorServidor } = await import("./sentry.server.config");
  reportarErrorServidor(error, context.routePath);
};
